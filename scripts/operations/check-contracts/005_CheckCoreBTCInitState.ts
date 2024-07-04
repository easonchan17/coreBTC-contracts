import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from "hardhat";
import { checkComponentAddress, getContractInst } from '../../../helper-functions';
const logger = require('node-color-log');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-------------------------------------------------")
    logger.color('blue').bold().log("Check CoreBTCProxy Contract state...")

    const expectedLockersProxyAddress = await checkComponentAddress(deployments, "LockersProxy");
    if (!ethers.utils.isAddress(expectedLockersProxyAddress)) return;

    // init coreBTCProxy instance
    const coreBTCProxyInst = await getContractInst(deployments, "CoreBTCProxy", "CoreBTCLogic", "");
    if (!coreBTCProxyInst) return;

    const isMinter = await coreBTCProxyInst.minters(expectedLockersProxyAddress);
    if (!isMinter) {
        console.log("minter of CoreBTCProxy is incorrect");
    } else {
        console.log("minter of CoreBTCProxy is correct");
    }

    const isBurner = await coreBTCProxyInst.burners(expectedLockersProxyAddress);
    if (!isBurner) {
        console.log("burner of CoreBTCProxy is incorrect");
    } else {
       console.log("burner of CoreBTCProxy is correct");
    }
};

export default func;