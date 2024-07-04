import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { BigNumber } from 'ethers';
import { assert } from 'console';
import { deployments, ethers } from 'hardhat';
import config from 'config';
import { isEnableMultipleCollaterals, getContractInst, waitForInput } from "../../../helper-functions"
import { randomBytes } from 'crypto';
const Table  = require('cli-table3');
const chalk  = require('chalk');
const logger = require('node-color-log');

const TNT = "0x0000000000000000000000000000000000000001";
const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

interface LockerInfo {
    candidateLockingScript: string;
    lockerRescueScript: string;
    lockedToken: string;
    lockerRescueType: number;
    lockedAmount: BigNumber;
}

function sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function isValidBytes25HexString(str: string): boolean {
    const regex = /^0x[a-fA-F0-9]{50}$/;
    return regex.test(str);
}

function isValidBytes32HexString(str: string): boolean {
    const regex = /^0x[a-fA-F0-9]{64}$/;
    return regex.test(str);
}

function isValidPricePair(str: string): boolean {
    const regex = /^[A-Z]+\/[A-Z]+$/;
    return regex.test(str);
}

function incrHex(str: string): string {
    return BigNumber.from(str).add(1).toHexString();
}

function generateRandomBytes(bytes: number): string {
    const randomBuffer = randomBytes(bytes);
    const hexString = randomBuffer.toString('hex');

    return '0x' + hexString;
}

async function switchLockerSigner(lockersProxyInst: any, deployer: any) {
    let lockerTargetAddress = deployer;

    const ans = await waitForInput(`Need replace locker target address ${deployer}?(y/n):`);
    if (ans === 'y') {
        const lockerPrivateKey = await waitForInput(`Enter the private key of the locker:`);
        const lockerSigner = new ethers.Wallet(lockerPrivateKey as string, ethers.provider);
        lockerTargetAddress = await lockerSigner.getAddress();
        lockersProxyInst = lockersProxyInst.connect(lockerSigner);
    }

    return {
        lockersProxyInst: lockersProxyInst,
        lockerTargetAddress: lockerTargetAddress
    };
}

async function getLockersProxyInst(deployments: any) {
    return await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
}

async function getCollateralsProxyInst(deployments: any) {
    return await getContractInst(deployments, "CollateralsProxy", "CollateralsLogic", "");
}

async function getERC20Info(tokenAddress: any) {
    assert(ethers.utils.isAddress(tokenAddress), "Token address is invalid");
    if (!ethers.utils.isAddress(tokenAddress)) return;

    const erc20Factory = await ethers.getContractFactory("ERC20");
    const erc20Inst = await erc20Factory.attach(tokenAddress);
    assert(erc20Inst != null, "erc20Inst is null");
    if (!erc20Inst) return;

    try {
        return {
            name: await erc20Inst.name(),
            symbol: await erc20Inst.symbol(),
            decimals: await erc20Inst.decimals()
        };
    } catch (e: any) {
        logger.color('red').bold().log(`Token ${tokenAddress} is not erc20`);
    }
}

async function erc20Approve(deployments: any, erc20Address: any, spender: any, amount: any) {
    assert(ethers.utils.isAddress(erc20Address), "Erc20 address is invalid");
    if (!ethers.utils.isAddress(erc20Address)) return false;

    assert(ethers.utils.isAddress(spender), "Spender address is invalid");
    if (!ethers.utils.isAddress(spender)) return false;

    const erc20Factory = await ethers.getContractFactory("ERC20");
    const erc20Inst = await erc20Factory.attach(erc20Address);
    assert(erc20Inst != null, "erc20Inst is null");
    if (!erc20Inst) return false;

    let ok: any = false;
    try {
        const tx = await erc20Inst.approve(spender, amount);
        await tx.wait(1);
        console.log(`approved ${spender}, amount=${amount}`);
        ok = true;
    } catch (e: any) {
        console.log(e.message);
    }

    return ok;
}

async function isOracleSupportToken(deployments: any, tokenInfo: any) {
    const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
    if (!priceOracleInst) {
        console.log("priceOralceInst is null");
        return false;
    }

    const coreBTCInst = await getContractInst(deployments, "CoreBTCProxy", "CoreBTCLogic", "");
    if (!coreBTCInst) {
        console.log("coreBTCInst is null");
        return false;
    }

    let collateralPriceInBTC = 0;
    try {
        collateralPriceInBTC = await priceOracleInst.equivalentOutputAmount(
            BigNumber.from(10).pow(tokenInfo.decimals),
            tokenInfo.decimals,
            await coreBTCInst.decimals(),
            tokenInfo.address,
            coreBTCInst.address
        );
    } catch (e: any) {
        console.log(e.message);
    }

    assert(collateralPriceInBTC > 0, "collateralPriceInBTC is invalid");
    if (!collateralPriceInBTC) {
        logger.color('red').bold().log(`The oracle does not supports price queries for this token, please init the oracle first by command TARGET=call-func FUNC=addTokenPricePair`);
        return false;
    }

    logger.color('blue').bold().log(`The oracle already supports price queries for this token, the collateral price of 1 unit is ${collateralPriceInBTC} Satoshi`);
    return true;
}

async function lockersMapping(lockersProxyInst: any, lockerTargetAddress: any) {
    if (!lockersProxyInst) return;

    const locker = await lockersProxyInst.lockersMapping(lockerTargetAddress);
    console.log(`locker ${lockerTargetAddress} info:`, {
        lockerLockingScript: locker.lockerLockingScript,
        lockerRescueType: locker.lockerRescueScript,
        lockerRescueScript: locker.lockerRescueScript,
        nativeTokenLockedAmount: locker.nativeTokenLockedAmount,
        netMinted: locker.netMinted,
        slashingCoreBTCAmount: locker.slashingCoreBTCAmount,
        reservedNativeTokenForSlash: locker.reservedNativeTokenForSlash,
        isLocker: locker.isLocker,
        isCandidate: locker.isCandidate,
        isScriptHash: locker.isScriptHash
    });
}

async function getMinLockedAmount (collateralsProxyInst: any, tokenAddress: any) {
    if (!collateralsProxyInst) return 0;

    assert(ethers.utils.isAddress(tokenAddress), "Token address is invalid");
    if (!ethers.utils.isAddress(tokenAddress)) return 0;

    let amount = 0;
    try {
        amount = await collateralsProxyInst.getMinLockedAmount(tokenAddress);
    } catch (e: any) {
        console.log(e.message);
    }

    return amount;
}

async function registerLockerV1(
    lockersProxyInst: any,
    lockerPrivateKey: any,
    lockerTargetAddress:any,
    lockerInfo:any) {
    assert(lockersProxyInst != null, "lockersProxyInst is null");
    if (!lockersProxyInst) return false;

    // create locker signer and bind to locker proxy inst
    const lockerSigner = new ethers.Wallet(lockerPrivateKey, ethers.provider);
    const lockersProxyInstWithSigner = lockersProxyInst.connect(lockerSigner);

    const returnedLocker = await lockersProxyInstWithSigner.lockersMapping(lockerTargetAddress);
    if (returnedLocker && returnedLocker.lockerLockingScript != '0x') {
        logger.color('red').bold().log("locker is already exist");
        return true;
    }

    let ret = false;
    try {
        const tx = await lockersProxyInstWithSigner.requestToBecomeLocker(
            lockerInfo.candidateLockingScript,
            lockerInfo.lockedAmount,
            lockerInfo.lockerRescueType,
            lockerInfo.lockerRescueScript,
            {
                value: lockerInfo.lockedAmount
            }
        );

        await tx.wait(1);
        ret = true;
        console.log("requestToBecomeLocker tx hash", tx.hash);
    } catch (e: any) {
        console.log(e.message);
    }

    return ret;
}

interface Operations {
    [key: string]: (deploymens: any, deployer: any) => Promise<void>;
}

const FUNC_MAP: Operations = {
    requestToBecomeLocker: async function (deployments: any, deployer: any) {
        const lockerExampleInfo = new Table({
            head: [chalk.blue('Locker Field'),chalk.blue('Example value')],
            colWidths: [30, 60]
        })

        lockerExampleInfo.push(
            [chalk.red('candidateLockingScript'), chalk.red('0x76a914d3a978cf1736469e6b3982130937345343255c1988ac')],
            [chalk.red('lockerRescueType'), 3],
            [chalk.red('lockerRescueScript'), chalk.red('0xd3a978cf1736469e6b3982130937345343255c19')]
        );

        logger.color('blue').bold().log("Locker Example Info");
        console.log(lockerExampleInfo.toString());

        let collateralsProxyInst;
        if (isEnableMultipleCollaterals()) {
            const collateralTokens = new Table({
                head: [chalk.blue('Symbol'),chalk.blue('Address'),chalk.blue('MinLockedAmount'),chalk.blue('Decimals')],
                colWidths: [30, 45, 30, 10]
            })

            interface TokenInfo {
                address: string;
                symbol: string;
                minLockedAmount: any;
                minLockedAmountWithoutDecimals: any;
                decimals: number
            }

            const addTokenItem = async function(collateralsProxyInst: any, tokenAddress: any) {
                if (!ethers.utils.isAddress(tokenAddress)) return;

                const index = await collateralsProxyInst.collateralsMap(tokenAddress);
                if (index == 0) return;

                const minLockedAmount = await getMinLockedAmount(collateralsProxyInst, tokenAddress);

                let tokenInfo: TokenInfo = {
                    address : tokenAddress,
                    minLockedAmount : minLockedAmount,
                    minLockedAmountWithoutDecimals: 0,
                    symbol: "",
                    decimals: 0
                }

                if (tokenInfo.address != TNT) { // erc20
                    const erc20Info = await getERC20Info(tokenInfo.address);
                    if (!erc20Info) return;

                    tokenInfo.symbol = erc20Info.symbol;
                    tokenInfo.decimals = erc20Info.decimals;
                } else {
                    tokenInfo.symbol = "CORE";
                    tokenInfo.decimals = 18;
                }

                tokenInfo.minLockedAmountWithoutDecimals = BigNumber.from(tokenInfo.minLockedAmount).div(BigNumber.from(10).pow(tokenInfo.decimals));

                collateralTokens.push([
                    chalk.red(tokenInfo.symbol),
                    chalk.red(tokenInfo.address),
                    chalk.red(`${tokenInfo.minLockedAmount}(${tokenInfo.minLockedAmountWithoutDecimals})`),
                    chalk.red(tokenInfo.decimals)
                ])
            }

            collateralsProxyInst = await getCollateralsProxyInst(deployments);
            assert(collateralsProxyInst != null, "collateralsProxyInst is null");
            if (!collateralsProxyInst) return;

            await addTokenItem(collateralsProxyInst, TNT);

            const stCORE = config.get("oracle.lst.stcore");
            await addTokenItem(collateralsProxyInst, stCORE);

            const usdt = config.get("oracle.usdt_token");
            await addTokenItem(collateralsProxyInst, usdt);

            const usdc = config.get("oracle.usdc_token");
            await addTokenItem(collateralsProxyInst, usdc);

            logger.color('blue').bold().log("Colateral Token List");
            console.log(collateralTokens.toString());
        }

        const candidateLockingScript = await waitForInput("Enter The CandidateLockingScript Of The Locker (e.g. 0x76a914d3a978cf1736469e6b3982130937345343255c1988ac):");
        if (!isValidBytes25HexString(candidateLockingScript as string)) {
            logger.color('red').bold().log("candidateLockingScript is invalid");
            return;
        }

        const lockerRescueType = await waitForInput("Enter The LockerRescueType Of The Locker (e.g. 3):");
        if (lockerRescueType == 0) {
            logger.color('red').bold().log("lockerRescueType is invalid");
            return;
        }

        const lockerRescueScript = await waitForInput("Enter The LockerRescueScript Of The Locker (e.g. 0xd3a978cf1736469e6b3982130937345343255c19):");
        if (!ethers.utils.isAddress(lockerRescueScript as string)) {
            logger.color('red').bold().log("lockerRescueScript is invalid");
            return;
        }

        let lockedToken:any, decimals:any;
        if (isEnableMultipleCollaterals()) {
           lockedToken = await waitForInput("Enter The Address Of The Locked Token:");
           if (!ethers.utils.isAddress(lockedToken)) {
                logger.color('red').bold().log("lockedToken is invalid");
                return;
           }

           if (!collateralsProxyInst) return;
           decimals = await collateralsProxyInst.getDecimals(lockedToken);
        } else {
            lockedToken = TNT;
            decimals = 18;
        }

        logger.color('blue').bold().log(`The Decimals Of The Token Is ${decimals}`);
        const lockedAmount = await waitForInput("Enter The Locked Amount:");
        const lockedAmountWithDecimals = BigNumber.from(10).pow(decimals).mul(lockedAmount as number);

        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        let minLockedAmount;
        if (isEnableMultipleCollaterals()) {
            minLockedAmount = await getMinLockedAmount(collateralsProxyInst, lockedToken);
        } else {
            minLockedAmount = await lockersProxyInst.minRequiredTNTLockedAmount();
        }

        if (lockedAmountWithDecimals < minLockedAmount) {
            logger.color('red').bold().log("lockedAmount is too low");
            return;
        }

        const lockerInfo = {
            targetAddress: deployer,
            candidateLockingScript: candidateLockingScript,
            lockerRescueType: lockerRescueType,
            lockerRescueScript: lockerRescueScript,
            lockedToken: lockedToken,
            lockedAmount: lockedAmountWithDecimals
        }

        let options = {}
        if (lockerInfo.lockedToken === TNT) {
            options = {
                value: lockerInfo.lockedAmount
            }
        }

        const returnedLocker = await lockersProxyInst.lockersMapping(lockerInfo.targetAddress);
        if (returnedLocker && returnedLocker.lockedAmount > 0) {
            logger.color('red').bold().log("locker is already exist");
            return;
        }

        try {
            let tx: any;
            if (isEnableMultipleCollaterals()) {
                if (lockerInfo.lockedToken != TNT) {
                    const ok = await erc20Approve(deployments, lockerInfo.lockedToken, lockersProxyInst.address, lockerInfo.lockedAmount);
                    if (!ok) {
                        logger.color('red').bold().log("approve locker failed");
                        return;
                    }
                }

                tx = await lockersProxyInst.requestToBecomeLocker(
                    lockerInfo.candidateLockingScript,
                    lockerInfo.lockedAmount,
                    lockerInfo.lockerRescueType,
                    lockerInfo.lockerRescueScript,
                    lockerInfo.lockedToken,
                    options
                );
            } else {
                tx = await lockersProxyInst.requestToBecomeLocker(
                    lockerInfo.candidateLockingScript,
                    lockerInfo.lockedAmount,
                    lockerInfo.lockerRescueType,
                    lockerInfo.lockerRescueScript,
                    options
                );
            }

            await tx.wait(1);
            console.log("requestToBecomeLocker tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerInfo.targetAddress);
    },

    addLocker: async function (deployments: any, deployer: any) {
        const lockerTargetAddress = await waitForInput("Enter The Target Address Of The Locker:");
        if (!ethers.utils.isAddress(lockerTargetAddress as string)) {
            logger.color('red').bold().log("lockerTargetAddress is invalid");
            return;
        }

        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        try {
            const tx = await lockersProxyInst.addLocker(lockerTargetAddress);
            await tx.wait(1);
            console.log("addLocker tx hash", tx.hash);
        } catch(e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    requestInactivation: async function (deployments: any, deployer: any) {
        let lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const switched = await switchLockerSigner(lockersProxyInst, deployer);
        if (!switched) return;

        try {
            const tx = await switched.lockersProxyInst.requestInactivation();
            await tx.wait(1);
            console.log("requestInactivation tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, switched.lockerTargetAddress);
    },

    requestActivation: async function (deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        try {
            const tx = await lockersProxyInst.requestActivation();
            await tx.wait(1);
            console.log("requestActivation tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, deployer);
    },

    addCollateral: async function (deployments: any, deployer: any) {
        const lockerTargetAddress = await waitForInput("Enter The Target Address Of The Locker:");
        if (!ethers.utils.isAddress(lockerTargetAddress as string)) {
            logger.color('red').bold().log("lockerTargetAddress is invalid");
            return;
        }

        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const lockerInfo = await lockersProxyInst.lockersMapping(lockerTargetAddress);
        if(!lockerInfo || lockerInfo.lockedToken == EMPTY_ADDRESS) {
            logger.color('red').bold().log("locker does not exist");
            return;
        }

        logger.color('blue').bold().log("Current Locker State...");
        console.log(lockerInfo);

        const addingAmount = await waitForInput("Enter The Adding Amount:");
        if (addingAmount == 0) {
            logger.color('red').bold().log("addingAmount is invalid");
            return;
        }

        let decimals = 18;
        if (isEnableMultipleCollaterals()) {
            const collateralsProxyInst = await getCollateralsProxyInst(deployments);
            if (!collateralsProxyInst) {
                logger.color('red').bold().log("collateralsProxyInst is null");
                return;
            }

            decimals = await collateralsProxyInst.getDecimals(lockerInfo.lockedToken);
            if (decimals == 0) {
                logger.color('red').bold().log("collateralsProxyInst is null");
                return;
            }
        }

        logger.color('blue').bold().log(`Locked token decimals is ${decimals}`);
        const addingAmountWithDecimals = BigNumber.from(10).pow(decimals).mul(addingAmount as number);

        let options = {}
        if (lockerInfo.lockedToken == EMPTY_ADDRESS || lockerInfo.lockedToken == TNT) {
            options = {
                value: addingAmountWithDecimals
            }
        }

        try {
            if (lockerInfo.lockedToken != EMPTY_ADDRESS && lockerInfo.lockedToken != TNT) {
                const ok = await erc20Approve(deployments, lockerInfo.lockedToken, lockersProxyInst.address, addingAmountWithDecimals);
                if (!ok) {
                    logger.color('red').bold().log("approve locker failed");
                    return;
                }
            }

            const tx = await lockersProxyInst.addCollateral(lockerTargetAddress, addingAmountWithDecimals, options);
            await tx.wait(1);
            console.log("addCollateral tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    removeCollateral: async function (deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const lockerTargetAddress = deployer;
        const lockerInfo = await lockersProxyInst.lockersMapping(lockerTargetAddress);
        if(!lockerInfo || lockerInfo.lockerLockingScript == EMPTY_ADDRESS) {
            logger.color('red').bold().log("locker does not exist");
            return;
        }

        logger.color('blue').bold().log("Current Locker State...");
        console.log(lockerInfo);

        const removingAmount = await waitForInput("Enter The Removing Amount:");
        if (removingAmount == 0) {
            logger.color('red').bold().log("removingAmount is invalid");
            return;
        }

        let decimals = 18;
        if (isEnableMultipleCollaterals()) {
            const collateralsProxyInst = await getCollateralsProxyInst(deployments);
            if (!collateralsProxyInst) {
                logger.color('red').bold().log("collateralsProxyInst is null");
                return;
            }

            decimals = await collateralsProxyInst.getDecimals(lockerInfo.lockedToken);
            if (decimals == 0) {
                logger.color('red').bold().log("collateralsProxyInst is null");
                return;
            }
        }

        logger.color('blue').bold().log(`Locked token decimals is ${decimals}`);
        const removingAmountWithDecimals = BigNumber.from(10).pow(decimals).mul(removingAmount as number);

        try {
            const tx = await lockersProxyInst.removeCollateral(removingAmountWithDecimals);
            await tx.wait(1);
            console.log("removeCollateral tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    getMaximumBuyableCollateral: async function (deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const lockerTargetAddress = deployer;
        try {
            const amount = await lockersProxyInst.getMaximumBuyableCollateral(lockerTargetAddress);
            console.log("maximum buyable collateral amount", amount);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    revokeRequest: async function (deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const lockerTargetAddress = deployer;
        try {
            const tx = await lockersProxyInst.revokeRequest();
            await tx.wait(1);
            console.log("revokeRequest tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    selfRemoveLocker: async function (deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const lockerTargetAddress = deployer;
        try {
            const tx = await lockersProxyInst.selfRemoveLocker();
            await tx.wait(1);
            console.log("selfRemoveLocker tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        await lockersMapping(lockersProxyInst, lockerTargetAddress);
    },

    removeCollateralToken: async function (deployments: any, deployer: any) {
        if (!isEnableMultipleCollaterals()) {
            logger.color('red').bold().log("Please enable the config option enable_multiple_collaterals");
            return;
        }

        const tokenAddress = await waitForInput("Enter The Token Address To Be Removed:");
        if (!ethers.utils.isAddress(tokenAddress as string)) {
            logger.color('red').bold().log("tokenAddress is invalid");
            return;
        }

        const collateralsProxyInst = await getCollateralsProxyInst(deployments);
        assert(collateralsProxyInst != null, "collateralsProxyInst is null");
        if (!collateralsProxyInst) return;

        try {
            const tx = await collateralsProxyInst.removeCollateral(tokenAddress);
            await tx.wait(1);
            console.log("removeCollateralToken tx hash", tx.hash);
        } catch (e: any) {
            console.log(e.message);
        }

        const index = await collateralsProxyInst.collateralsMap(tokenAddress);
        if (index == 0) {
            logger.color('blue').bold().log("collateral is removed");
        } else {
            logger.color('red').bold().log("collateral does not remove");
        }
    },

    addCollateralToken: async function (deployments: any, deployer: any) {
        if (!isEnableMultipleCollaterals()) {
            logger.color('red').bold().log("Please enable the config option enable_multiple_collaterals");
            return;
        }

        const tokenAddress = await waitForInput("Enter The Token Address To Be Added:");
        const tokenInfo = await getERC20Info(tokenAddress);
        if (!tokenInfo || tokenInfo.decimals == 0) return;

        logger.color('red').bold().log(`The decimals of the token is ${tokenInfo.decimals}`);
        const minLockedAmount = await waitForInput("Enter The Min Locked Amount Of The Token:");
        if (minLockedAmount == 0) {
            logger.color('red').bold().log("minLockedAmount is invalid");
            return;
        }

        const isSupported = await isOracleSupportToken(deployments, {
            address: tokenAddress,
            decimals: tokenInfo.decimals
        });
        if (!isSupported) return;

        const collateralsProxyInst = await getCollateralsProxyInst(deployments);
        assert(collateralsProxyInst != null, "collateralsProxyInst is null");
        if (!collateralsProxyInst) return;

        const index = await collateralsProxyInst.collateralsMap(tokenAddress);
        if (index > 0) {
            logger.color('red').bold().log(`Collateral ${tokenAddress} is already added`);
            return;
        }

        try {
            const minLockedAmountWithDecimals = BigNumber.from(10).pow(tokenInfo.decimals).mul(minLockedAmount as number);
            const tx = await collateralsProxyInst.addCollateral(tokenAddress, minLockedAmountWithDecimals);
            await tx.wait(1);
            console.log("addCollateralToken tx hash", tx.hash);

            const returnedMinLockedAmount = await collateralsProxyInst.getMinLockedAmount(tokenAddress);
            const returnedDecimals = await collateralsProxyInst.getDecimals(tokenAddress);
            const returnedMinLockedAmountWithoutDecimals = BigNumber.from(returnedMinLockedAmount).div(BigNumber.from(10).pow(returnedDecimals))
            assert(returnedMinLockedAmountWithoutDecimals.eq(minLockedAmount as number), "MinLockedAmount of the collateral  token is invalid");
        } catch (e: any) {
            console.log(e.message);
        }
    },

    addTokenPricePair: async function (deployments: any, deployer: any) {
         // Add pricePairName => feedId to PythPriceProxy
        logger.color('blue').log("-----------------------------------------");
        logger.color('blue').bold().log("Add feedId to PythPriceProxy ...");

        const pricePairName = await waitForInput("Enter Price Pair Name (e.g. USDT/USDT, USDC/USDT):");
        assert(isValidPricePair(pricePairName as string), "pricePairName is invalid")
        if (!isValidPricePair(pricePairName as string)) return;

        const pythFeedId = await waitForInput(`Enter The Pyth FeedId Corresponding To ${pricePairName}:`);
        assert(isValidBytes32HexString(pythFeedId as string), "pythFeedId is invalid");
        if (!isValidBytes32HexString(pythFeedId as string)) return;

        const pythPriceProxyInst = await getContractInst(deployments, "", "PythPriceProxy", "");
        assert(pythPriceProxyInst != null, "pythPriceProxy is null");
        if (!pythPriceProxyInst) return;
        const oldPythFeedId = await pythPriceProxyInst.getFeedId(pricePairName);
        if (oldPythFeedId != pythFeedId) {
            const tx = await pythPriceProxyInst.addFeedId(pricePairName, pythFeedId);
            await tx.wait(1);
            console.log(`Added feedId map ${pricePairName}=>${pythFeedId} to pythPriceProxy`);
        } else {
            console.log("Pyth feedId is already added");
        }

        // Add token => pricePairName to PriceOracle
        logger.color('blue').log("-----------------------------------------");
        logger.color('blue').bold().log("Add token price pair to PriceOracle ...");

        const tokenAddress = await waitForInput(`Enter The Token Address Corresponding To ${pricePairName}:`);
        assert(ethers.utils.isAddress(tokenAddress as string), "token address is invalid");
        if (!ethers.utils.isAddress(tokenAddress as string)) return;

        //Verify tokenAddress is erc20
        const tokenInfo = await getERC20Info(tokenAddress);
        assert(tokenInfo != null, "token info is null");
        if (!tokenInfo) return;

        console.log(`Token name is ${tokenInfo.name}, symbol is ${tokenInfo.symbol}, decimals is ${tokenInfo.decimals}`);

        const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
        assert(priceOracleInst != null, "priceOracleInst is null");
        if (!priceOracleInst) return;

        const oldPricePairName = await priceOracleInst.pricePairMap(tokenAddress);
        if (oldPricePairName != pricePairName) {
            const tx = await priceOracleInst.addTokenPricePair(tokenAddress, pricePairName);
            await tx.wait(1);
            console.log(`Added token price pair ${tokenAddress}=>${pricePairName} to PriceOracle`);
        } else {
            console.log("Token price pair is already added");
        }

        // Check token price in BTC
        const coreBTCInst = await getContractInst(deployments, "CoreBTCProxy", "CoreBTCLogic", "");
        if (!coreBTCInst) return;

        const tokenPriceInBTC = await priceOracleInst.equivalentOutputAmount(
            BigNumber.from(10).pow(tokenInfo.decimals),
            tokenInfo.decimals,
            await coreBTCInst.decimals(),
            tokenAddress,
            coreBTCInst.address
        );

        assert(tokenPriceInBTC > 0, "tokenPriceInBTC is invalid");
        if (!tokenPriceInBTC) {
            logger.color('red').bold().log(`The oracle does not supports price queries for this token, please init the oracle first`);
            return;
        }

        logger.color('blue').bold().log(`The oracle already supports price queries for this token, the token price of 1 unit is ${tokenPriceInBTC} Satoshi`);
    },

    priceOfOneUnitOfCollateralInBTCV1: async function(deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        if (!lockersProxyInst) return;

        const price = await lockersProxyInst.priceOfOneUnitOfCollateralInBTC();
        logger.color('blue').bold().log(`Native token price is ${price} Satoshi`);
    },

    priceOfOneUnitOfCollateralInBTC: async function(deployments: any, deployer: any) {
        const lockersProxyInst = await getLockersProxyInst(deployments);
        if (!lockersProxyInst) return;

        const collateralsProxyInst = await getCollateralsProxyInst(deployments);
        if (!collateralsProxyInst) return;

        const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
        if (!priceOracleInst) return;

        let tokenArr: string[] = [];
        tokenArr.push(TNT);

        const stCORE = config.get("oracle.lst.stcore");
        tokenArr.push(stCORE as string);

        const usdt = config.get("oracle.usdt_token");
        tokenArr.push(usdt as string);

        const usdc = config.get("oracle.usdc_token");
        tokenArr.push(usdc as string);

        for (let i =0; i < tokenArr.length; i++) {
            if (ethers.utils.isAddress(tokenArr[i])) {
                const index = await collateralsProxyInst.collateralsMap(tokenArr[i]);
                if (index > 0) {
                    const price = await lockersProxyInst.priceOfOneUnitOfCollateralInBTC(tokenArr[i]);
                    const pricePair = await priceOracleInst.pricePairMap(tokenArr[i]);

                    logger.color('blue').bold().log(`Token ${tokenArr[i]}, pairName is ${pricePair}, price is ${price} Satoshi`);
                } else {
                    logger.color('red').bold().log(`Token ${tokenArr[i]} is not a collateral`);
                }
            }
        }

    },

    testIncrHex: async function(deploymens: any, deployer: any) {
        let hexStr = "0x01";
        for (let i = 0; i < 100; i++) {
            hexStr = incrHex(hexStr);
            console.log('incr:', hexStr);
        }
    },

    registerLockerV1WithRandomData: async function(deploymens: any, deployer: any) {
        // create locker proxy inst
        const lockersProxyInst = await getLockersProxyInst(deploymens);
        assert(lockersProxyInst != null, "lockersProxyInst is null");
        if (!lockersProxyInst) return;

        const minLockedAmount = await lockersProxyInst.minRequiredTNTLockedAmount();

        // sponsor the locker
        const [sponsor] = await ethers.getSigners();

        let ans: any;
        while ((ans = await waitForInput("Register a locker based on random data? (y/n):")) == "y") {
            logger.color('blue').bold().log("---------------------------------------------------------");

            // create locker target address
            const lockerWallet = ethers.Wallet.createRandom();
            const lockerTargetAddress = lockerWallet.address;
            const lockerPrivateKey = lockerWallet.privateKey;

            // random generate locker info
            const lockerInfo: LockerInfo = {
                candidateLockingScript: generateRandomBytes(25),
                lockerRescueScript: generateRandomBytes(20),
                lockedToken: TNT,
                lockerRescueType: 3,
                lockedAmount: BigNumber.from(minLockedAmount)
            };

            // sponsor funds to the locker target address
            const tx = await sponsor.sendTransaction({
                to: lockerTargetAddress,
                value: lockerInfo.lockedAmount.add(BigNumber.from(10).pow(18))
            });
            await tx.wait();

            // query locker balance
            const lockerBalance = await ethers.provider.getBalance(lockerTargetAddress);
            logger.color('blue').bold().log(`Locker ${lockerTargetAddress} Balance is ${lockerBalance}`);

            // reigster locker
            logger.color('blue').bold().log(`Registering locker for V1 targetAddress=${lockerTargetAddress}, privateKey=${lockerPrivateKey}, lockeringScript=${lockerInfo.candidateLockingScript}`);
            const ret = await registerLockerV1(lockersProxyInst, lockerPrivateKey, lockerTargetAddress, lockerInfo)
            if (ret) {
                logger.color('blue').bold().log(`Locker ${lockerTargetAddress} register success`);
                await lockersMapping(lockersProxyInst, lockerTargetAddress);
            } else {
                logger.color('red').bold().log(`Locker ${lockerTargetAddress} register failed`);
            }
            console.log("");
        }
    },
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log(`TARGET=${process.env.TARGET}, FUNC=${process.env.FUNC}, deployer=${deployer}`);
    if (!process.env.FUNC) {
        logger.color('red').bold().log("FUNC is empty");
        return;
    }

    if (!FUNC_MAP[process.env.FUNC as string]) {
        logger.color('red').bold().log("FUNC is not defined");
        return;
    }

    await FUNC_MAP[process.env.FUNC as string](deployments, deployer);
};

export default func;
