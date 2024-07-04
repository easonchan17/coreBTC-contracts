import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { checkComponentAddress, getContractInst, isEnableMultipleCollaterals } from '../../../helper-functions';
import { assert } from 'console';
import config from 'config'
const logger = require('node-color-log');


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check BurnRouterProxy Contract State...");

    const burnRouterProxyInst = await getContractInst(deployments, "BurnRouterProxy", "BurnRouterLogic", "BurnRouterLib");
    if (!burnRouterProxyInst) return;

    // init burner: slasher address
    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check slasher of BurnRouterProxy ...");

    let slasherAddress: string = await burnRouterProxyInst.slasher() as string;
    assert(ethers.utils.isAddress(slasherAddress), "Slasher address is invalid");
    if (!ethers.utils.isAddress(slasherAddress)) return;

    const expectedSlasherAddress = config.get("burner.slasher");
    if (slasherAddress !== expectedSlasherAddress) {
        console.log("Slasher of BurnRouterProxy is incorrect");
    } else {
        console.log("Slasher of BurnRouterProxy is correct");
    }
};

export default func;
