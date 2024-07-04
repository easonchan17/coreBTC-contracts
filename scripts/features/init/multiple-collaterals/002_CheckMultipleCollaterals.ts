import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { isEnableMultipleCollaterals, getContractInst } from '../../../../helper-functions';
import { assert } from 'console';
import { ethers } from 'hardhat';
import config from 'config'
const logger = require('node-color-log');


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

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    if (!isEnableMultipleCollaterals()) return;

    logger.color('blue').log("-----------------------------------------------");
    logger.color('blue').bold().log("Check Multiple Collaterals State ...");

    const nativeToken      = config.get("oracle.native_token");
    const earnWrappedToken = config.get("oracle.lst.stcore");

    const collateralsProxyInst  = await getContractInst(deployments, "CollateralsProxy", "CollateralsLogic", "");
    assert(collateralsProxyInst != null, "CollateralsProxy inst is null");
    if (!collateralsProxyInst) return;

    const lockersProxyInst      = await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
    assert(lockersProxyInst != null, "LockersProxy inst is null");
    if (!lockersProxyInst) return;

    const priceOracleInst       = await getContractInst(deployments, "", "PriceOracle", "");
    assert(priceOracleInst != null, "PriceOracle inst is null");
    if (!priceOracleInst) return;

    // check storage layout
    logger.color('blue').log("----------------------------------------------");
    logger.color('blue').bold().log("Check LockersProxy Storage Layout");
    const lockerOwner = await lockersProxyInst.owner();
    console.log(`Owner of LockersProxy is ${lockerOwner}`);


    const checkLocker = async(id:any, targetAddress:any) => {
        const locker = await lockersProxyInst.lockersMapping(targetAddress);
        const lockerType = locker.isCandidate ? "Candidate" : (locker.isLocker ? "Approved" : "Invalid");
        logger.color('blue').bold().log(`Check ${lockerType} Locker ${id}:`);

        let lockedTokenType = "Native Token";
        if (locker.lockedToken != nativeToken) {
            const tokenInfo = await getERC20Info(locker.lockedToken);
            if (tokenInfo) {
                lockedTokenType = tokenInfo.symbol;
            }
        }

        logger.color('blue').bold().log(`   Locked Token Is ${lockedTokenType}`);

        let isValid = true;

        let minLockedAmount = 0;
        try {
            minLockedAmount = await collateralsProxyInst.getMinLockedAmount(locker.lockedToken);
        } catch (e: any) {
            logger.color('red').bold().log(`    getMinLockedAmount for ${locker.lockedToken} error,`, e.message);
            isValid = false;
        }

        if (locker.lockedToken != nativeToken) {
            logger.color('red').bold().log(`    lockedToken ${locker.lockedToken} is not supported`);
            isValid = false;
        }

        if (locker.lockedAmount < minLockedAmount) {
            logger.color('red').bold().log(`    lockedAmount is invalid, minLockedAmount=${minLockedAmount}, locker.lockedAmount=${locker.lockedAmount}`);
            isValid = false;
        }

        const inactivationTimestamp = await lockersProxyInst.lockerInactivationTimestamp(targetAddress);
        if (!locker.inactivationTimestamp.eq(inactivationTimestamp)) {
            logger.color('red').bold().log("    `inactivationTimestamp` of locker is invalid,", `inactivationTimestamp=${inactivationTimestamp}, locker.inactivationTimestamp=${locker.inactivationTimestamp}`);
            isValid = false;
        }

        if (isValid) {
            logger.color('blue').bold().log(`   Locker Info Is Valid`);
            console.log({
                lockerLockingScript: locker.lockerLockingScript,
                lockerRescueType: locker.lockerRescueType,
                lockerRescueScript: locker.lockerRescueScript,
                lockedAmount: locker.lockedAmount,
                netMinted: locker.netMinted,
                slashingCoreBTCAmount: locker.slashingCoreBTCAmount,
                reservedTokenForSlash: locker.reservedTokenForSlash,
                isLocker: locker.isLocker,
                isCandidate: locker.isCandidate,
                isScriptHash: locker.isScriptHash,
                lockedToken: locker.lockedToken,
                inactivationTimestamp: locker.inactivationTimestamp
            });
        }
        console.log("");

        return locker;
    }

    // check candidate locker state
    logger.color('blue').log("--------------------------------------------------");
    logger.color('blue').bold().log("Check LockersProxy Candidate Lockers State");
    const candidateLockerCount = await lockersProxyInst.totalNumberOfCandidates();
    logger.color('blue').bold().log(`Number Of Candidate Lockers Is ${candidateLockerCount}`);
    for (let i = 0; i < candidateLockerCount; i++) {
        const locker = await checkLocker(i, await lockersProxyInst.candidateLockers(i));
        if (!locker.isCandidate) {
            logger.color('red').bold().log("`isCandidate` of locker is error");
        }
    }

    // check approved locker state
    logger.color('blue').log("--------------------------------------------------");
    logger.color('blue').bold().log("Check LockersProxy Approved Lockers State");
    const approvedLockerCount = await lockersProxyInst.totalNumberOfLockers();
    logger.color('blue').bold().log(`Number Of Approved Lockers Is ${approvedLockerCount}`);
    for (let i = 0; i < approvedLockerCount; i++) {
        const locker = await checkLocker(i, await lockersProxyInst.approvedLockers(i));
        if (!locker.isLocker) {
            logger.color('red').bold().log("`isLocker` of locker is error");
        }
    }

    // check collaterals price
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Check Collateral Token Price In BTC");
    try {
        const nativeTokenPriceInBTC = await lockersProxyInst.priceOfOneUnitOfCollateralInBTC(nativeToken);
        console.log(`1 CORE = ${nativeTokenPriceInBTC} Satoshi`);

        if (await collateralsProxyInst.collateralsMap[earnWrappedToken as string] > 0) {
            const earnWrappedTokenPriceInBTC = await lockersProxyInst.priceOfOneUnitOfCollateralInBTC(earnWrappedToken);
            console.log(`1 stCORE = ${earnWrappedTokenPriceInBTC} Satoshi`);
        }
    } catch (error: any) {
        if (error.code === ethers.errors.CALL_EXCEPTION) {
            const iface = new ethers.utils.Interface([
                "error ExpiredPrice(address token, uint publishTime, uint currentTime)"
            ])

            try {
                const [token, publishTime, currentTime] = iface.decodeErrorResult("ExpiredPrice", error.data);
                logger.color('red').bold().log(`ExpiredPrice error: token ${token}, diffTime ${currentTime-publishTime}`);
            } catch (decodeError: any) {
                logger.color('red').bold().log(error);
                logger.color('red').bold().log(decodeError);
            }
        } else {
            logger.color('red').bold().log(error);
        }
    }
};

export default func;
