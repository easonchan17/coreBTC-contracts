import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { checkComponentAddress, getContractInst, isEnableMultipleCollaterals } from '../../../helper-functions';
const logger = require('node-color-log');
import config from 'config'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check LockersProxy Contract State...");

    const lockersProxyInst = await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
    if (!lockersProxyInst) return;

    console.log("lockersProxyInst is inited")

    // init lockers
    // addCCBurnRouter: ccBurnRouter is the sole caller of functions slashThiefLocker and slashIdleLocker
    // addBurner: mapping burners store addresses with permission to call the 'Burn' function
    // addMinter: mapping miners store addresses with permission to call the 'Mint' function
    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check ccBurnRouter of LockersProxy ...");

    const expectedCCBurnRouterAddress = await checkComponentAddress(deployments, "BurnRouterProxy");
    if (!ethers.utils.isAddress(expectedCCBurnRouterAddress as string)) return;

    const oldCCBurnRouterAddress = await lockersProxyInst.ccBurnRouter();
    if ( oldCCBurnRouterAddress != expectedCCBurnRouterAddress ) {
        console.log("ccBurnRouter of LockersProxy is incorrect");
        return;
    } else {
        console.log("ccBurnRouter of LocksProxy is correct");
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Check minter of LockersProxy ...");
    const expectedMinterAddress = await checkComponentAddress(deployments, "CcTransferRouterProxy");
    if (!ethers.utils.isAddress(expectedMinterAddress as string)) return;

    const isMinter = await lockersProxyInst.isMinter(expectedMinterAddress);
    if (!isMinter) {
        console.log("minter of LockersProxy is incorrect");
        return;
    } else {
        console.log("minter of LockersProxy is correct");
    }


    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Check burner of LockersProxy ...");
    const expectedBurnerAdderss = await checkComponentAddress(deployments, "BurnRouterProxy");
    if (!ethers.utils.isAddress(expectedBurnerAdderss as string)) return;

    const isBurner = await lockersProxyInst.isBurner(expectedBurnerAdderss);
    if (!isBurner) {
        console.log("burner of LockersProxy is incorrect");
        return;
    } else {
        console.log("burner of LockersProxy is correct");
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Check slash compensation ratio of LockersProxy ...");
    const expectedSlashCompensationRatio = config.get("locker.slash_compensation_ratio");

    const curSlashCompensationRatio = await lockersProxyInst.slashCompensationRatio();
    if (curSlashCompensationRatio != expectedSlashCompensationRatio) {
        console.log("slashCompensationRatio of LockersProxy is incorrect", curSlashCompensationRatio, expectedSlashCompensationRatio);
        return;
    } else {
        console.log("slashCompensationRatio of LockersProxy is correct");
    }

    if (isEnableMultipleCollaterals()) {
        logger.color('blue').log("-----------------------------------------");
        logger.color('blue').bold().log("Check Collaterals of LockersProxy ...");

        const expectedCollateralsAddress = await checkComponentAddress(deployments, "CollateralsProxy");
        if (!ethers.utils.isAddress(expectedCollateralsAddress as string)) return;

        const oldCollateralsAddress = await lockersProxyInst.collaterals();
        if ( oldCollateralsAddress != expectedCollateralsAddress ) {
            console.log("collaterals of LockersProxy is incorrect");
            return;
        } else {
            console.log("collaterals of LocksProxy is correct");
        }
    }
};

export default func;
