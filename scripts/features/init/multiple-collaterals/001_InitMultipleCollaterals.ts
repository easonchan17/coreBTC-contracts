import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { checkComponentAddress, isEnableMultipleCollaterals, getContractInst } from '../../../../helper-functions';
import { assert } from 'console';
const logger = require('node-color-log');


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    if (!isEnableMultipleCollaterals()) return;

    const lockersProxyInst = await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
    assert(lockersProxyInst != null, "lockersProxyInst is null");
    if (!lockersProxyInst) return;

    // init lockers
    // setCollaterals
    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Set Collaterals In Lockers ...");

    const newCollateralsAddress = await checkComponentAddress(deployments, "CollateralsProxy");
    assert(ethers.utils.isAddress(newCollateralsAddress as string), "collaterals proxy address is invalid!");
    if (!ethers.utils.isAddress(newCollateralsAddress as string)) return;

    const oldCollateralsAddress = await lockersProxyInst.collaterals();
    if (oldCollateralsAddress != newCollateralsAddress) {
        const tx = await lockersProxyInst.setCollaterals(newCollateralsAddress);
        await tx.wait(1);
        console.log("Setted collaterals in lockersProxy: ", tx.hash);
    } else {
        console.log("collaterals is already setted");
    }
};

export default func;
