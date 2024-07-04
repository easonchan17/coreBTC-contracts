import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from "hardhat";
import { checkComponentAddress, getContractInst } from '../../helper-functions';
const logger = require('node-color-log');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Set CoreBTCProxy Contract State...");

    logger.color('blue').log("-------------------------------------------------")
    logger.color('blue').bold().log("Set LockersProxy as minter and burner in coreBTC ...")

    const lockersProxyAddress   = await checkComponentAddress(deployments, "LockersProxy");
    if (!ethers.utils.isAddress(lockersProxyAddress)) return;

    // Set coreBTCProxy instance
    const coreBTCProxyInst = await getContractInst(deployments, "CoreBTCProxy", "CoreBTCLogic", "");
    if (!coreBTCProxyInst) return;

    // add lockersProxy as coreBTCproxy minter
    const isMinter = await coreBTCProxyInst.minters(lockersProxyAddress);
    if (!isMinter) {
        const addLockerAsMinter = await coreBTCProxyInst.addMinter(lockersProxyAddress);
        await addLockerAsMinter.wait(1);
        console.log("Added LockersProxy as minter in CoreBTCProxy: ", addLockerAsMinter.hash);
    } else {
        console.log("LockersProxy is already minter of CoreBTCProxy");
    }

    // add locksProxy as coreBTCProxy burner
    const isBurner = await coreBTCProxyInst.burners(lockersProxyAddress);
    if (!isBurner) {
        const addLockerAsBurner = await coreBTCProxyInst.addBurner(lockersProxyAddress);
        await addLockerAsBurner.wait(1);
        console.log("Added LockersProxy as burner in CoreBTCProxy: ", addLockerAsBurner.hash);
    } else {
        console.log("LockersProxy is already burner of CoreBTCProxy")
    }
};

export default func;