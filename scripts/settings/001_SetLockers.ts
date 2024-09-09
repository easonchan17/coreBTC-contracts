import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { waitForInput,checkComponentAddress, isEnableMultipleCollaterals, getContractInst } from '../../helper-functions';
import { assert } from 'console';
const logger = require('node-color-log');
import config from 'config'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Set LockersProxy Contract State...");

    const lockersProxyInst = await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
    if (!lockersProxyInst) return;

    // setSlashCompensatoinRatio:...
    // setCollaterals:...
    // addCCBurnRouter: ccBurnRouter is the sole caller of functions slashThiefLocker and slashIdleLocker
    // addBurner: mapping burners store addresses with permission to call the 'Burn' function
    // addMinter: mapping miners store addresses with permission to call the 'Mint' function

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Set slash compensation ratio in lockers ...");
    const newSlashCompensationRatio = config.get("locker.slash_compensation_ratio");
    const oldSlashCompensationRatio = await lockersProxyInst.slashCompensationRatio();
    if (oldSlashCompensationRatio != newSlashCompensationRatio) {
        const tx = await lockersProxyInst.setSlashCompensationRatio(newSlashCompensationRatio);
        await tx.wait(1);
        console.log("Setted slash compensation ratio in lockersProxy: ", tx.hash);
    } else {
        console.log("slash compensation ratio is already setted");
    }

    // if (isEnableMultipleCollaterals()) {
    //     logger.color('blue').log("-----------------------------------------");
    //     logger.color('blue').bold().log("Set collaterals in lockers ...");

    //     const newCollateralsAddress = await waitForInput("Enter collaterals proxy Address:");
    //     assert(ethers.utils.isAddress(newCollateralsAddress as string), "collaterals proxy address is invalid!");
    //     if (!ethers.utils.isAddress(newCollateralsAddress as string)) return;

    //     const oldCollateralsAddress = await lockersProxyInst.collaterals();
    //     if (oldCollateralsAddress != newCollateralsAddress) {
    //         const tx = await lockersProxyInst.setCollaterals(newCollateralsAddress);
    //         await tx.wait(1);
    //         console.log("Setted collaterals in lockersProxy: ", tx.hash);
    //     } else {
    //         console.log("collaterals is already setted");
    //     }
    // }

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Set ccBurnRouter in lockers ...");

    const newCCBurnRouterAddress = await checkComponentAddress(deployments, "BurnRouterProxy");
    assert(ethers.utils.isAddress(newCCBurnRouterAddress as string), "ccBurnRouter proxy address is invalid!");
    if (!ethers.utils.isAddress(newCCBurnRouterAddress as string)) return;

    const oldCCBurnRouterAddress = await lockersProxyInst.ccBurnRouter();
    if (oldCCBurnRouterAddress != newCCBurnRouterAddress) {
        const tx = await lockersProxyInst.setCCBurnRouter(newCCBurnRouterAddress);
        await tx.wait(1);
        console.log("Setted ccBurnRouter in lockersProxy: ", tx.hash);
    } else {
        console.log("ccBurnRouter is already setted");
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Add minter in lockers ...");
    const minterAddress = await checkComponentAddress(deployments, "CcTransferRouterProxy");
    assert(ethers.utils.isAddress(minterAddress as string), "Minter proxy address is invalid!");
    if (!ethers.utils.isAddress(minterAddress as string)) return;

    const isMinter = await lockersProxyInst.isMinter(minterAddress);
    if (!isMinter) {
        const tx = await lockersProxyInst.addMinter(minterAddress);
        await tx.wait(1);
        console.log("Minter is added, tx hash is", tx.hash);
    } else {
        console.log("Minter is already added");
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Add burner in lockers ...");
    const burnerAddress = await checkComponentAddress(deployments, "BurnRouterProxy");
    assert(ethers.utils.isAddress(burnerAddress as string), "Burner proxy address is invalid!");
    if (!ethers.utils.isAddress(burnerAddress as string)) return;

    const isBurner = await lockersProxyInst.isBurner(burnerAddress);
    if (!isBurner) {
        const tx = await lockersProxyInst.addBurner(burnerAddress);
        await tx.wait(1);
        console.log("Burner is added, tx hash is", tx.hash);
    } else {
        console.log("Burner is already added");
    }
};

export default func;
