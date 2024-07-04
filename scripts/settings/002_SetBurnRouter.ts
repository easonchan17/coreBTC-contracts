import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { getContractInst } from '../../helper-functions';
import { assert } from 'console';
const logger = require('node-color-log');
import config from 'config'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Set BurnRouterProxy Contract State...");

    const burnRouterProxyInst = await getContractInst(deployments, "BurnRouterProxy", "BurnRouterLogic", "BurnRouterLib");
    if (!burnRouterProxyInst) return;

    // burnRouter: set slasher address
    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Set slasher in burnRouter ...");

    let slasherAddress: string = config.get("burner.slasher") as string;
    assert(ethers.utils.isAddress(slasherAddress), "Slasher address is invalid");
    if (!ethers.utils.isAddress(slasherAddress)) return;


    const oldSlasherAddress = await burnRouterProxyInst.slasher();
    if (oldSlasherAddress != slasherAddress) {
        const tx = await burnRouterProxyInst.setSlasher(slasherAddress);
        await tx.wait(1);
        console.log("Setted slasher in burnRouterProxy, tx hash is", tx.hash);
    } else {
        console.log("slasher is already setted");
    }
};

export default func;
