import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getContractInst, isEnableMockPriceProxy, isEnableMultipleCollaterals } from '../../../helper-functions';
import { ethers } from 'hardhat';
import { assert } from 'console';
const logger = require('node-color-log');
import config from 'config'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    const defaultOwner = config.get("ownerships.default") as string;
    assert(ethers.utils.isAddress(defaultOwner), "Default owner is invalid");
    if (!ethers.utils.isAddress(defaultOwner)) return;

    let instMap: {[key:string]: any} = {}
    const addInstToMap = function(name: any, inst: any, owner:any) {
        if (!owner || owner.length === 0) {
            owner = defaultOwner;
        }

        assert(ethers.utils.isAddress(owner), "Owner is invalid");
        if (!ethers.utils.isAddress(owner)) return;

        instMap[inst.address] = {
            inst:inst,
            owner: owner,
            name: name
        }
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Check ownerships of contracts ...");
    const bitcoinRelayProxyInst = await getContractInst(deployments, "BitcoinRelayProxy", "BitcoinRelayLogic", "");
    addInstToMap("BitcoinRelayProxy", bitcoinRelayProxyInst, defaultOwner);

    const coreBTCProxyInst = await getContractInst(deployments, "CoreBTCProxy", "CoreBTCLogic", "");
    addInstToMap("CoreBTCProxy", coreBTCProxyInst, defaultOwner);

    const lockersProxyInst = await getContractInst(deployments, "LockersProxy", "LockersLogic", "LockersLib");
    addInstToMap("LockersProxy", lockersProxyInst, defaultOwner);

    const transferRouterProxyInst = await getContractInst(deployments, "CcTransferRouterProxy", "CcTransferRouterLogic", "");
    addInstToMap("CcTransferRouterProxy", transferRouterProxyInst, defaultOwner);

    const burnRouterProxyInst = await getContractInst(deployments, "BurnRouterProxy", "BurnRouterLogic", "BurnRouterLib");
    addInstToMap("BurnRouterProxy", burnRouterProxyInst, defaultOwner);

    if (!isEnableMockPriceProxy()) {
        const pythInst = await getContractInst(deployments, "", "PythPriceProxy", "");
        addInstToMap("PythPriceProxy", pythInst, defaultOwner);

        const switchboardInst = await getContractInst(deployments, "", "SwitchboardPriceProxy", "");
        addInstToMap("SwitchboardPriceProxy", switchboardInst, defaultOwner);
    }

    const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
    addInstToMap("PriceOracle", priceOracleInst, defaultOwner);

    if (isEnableMultipleCollaterals()) {
        const collateralsProxyInst = await getContractInst(deployments, "CollateralsProxy", "CollateralsLogic", "");
        addInstToMap("CollateralsProxy", collateralsProxyInst, defaultOwner);
    }

    for (const [instAddr, item] of Object.entries(instMap)) {
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Check ownership of ${item.name}`);
        const curOwner = await item.inst.owner();
        const curPendingOwner = await item.inst.pendingOwner();
        console.log(`Current Owner is ${curOwner}, Expected Owner is ${item.owner}, Pending Owner is ${curPendingOwner}`);
    }
};

export default func;
