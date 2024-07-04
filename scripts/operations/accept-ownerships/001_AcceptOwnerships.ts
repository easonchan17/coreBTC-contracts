import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getContractInst, isEnableMultipleCollaterals } from '../../../helper-functions';
import { ethers } from 'hardhat';
import { assert } from 'console';
const logger = require('node-color-log');
import config from 'config'
import { send } from 'process';

async function initContractInstMap(deployments:any) {
    let contractInstMap: {[key:string]: any} = {}

    const addContractInstMap = async function(proxyName: any, logicName: any, libName: any) {
        const contractInst = await getContractInst(deployments, proxyName, logicName, libName);

        if (proxyName.length > 0) {
            contractInstMap[proxyName] = contractInst;
        } else if (logicName.length > 0) {
            contractInstMap[logicName] = contractInst;
        }
    }

    await addContractInstMap("BitcoinRelayProxy", "BitcoinRelayLogic", "");
    await addContractInstMap("CoreBTCProxy", "CoreBTCLogic", "");
    await addContractInstMap("LockersProxy", "LockersLogic", "LockersLib");
    await addContractInstMap("CcTransferRouterProxy", "CcTransferRouterLogic", "");
    await addContractInstMap("BurnRouterProxy", "BurnRouterLogic", "BurnRouterLib");
    await addContractInstMap("", "PythPriceProxy", "");
    await addContractInstMap("", "SwitchboardPriceProxy", "");
    await addContractInstMap("", "PriceOracle", "");
    if (isEnableMultipleCollaterals()) {
        await addContractInstMap("CollateralsProxy", "CollateralsLogic", "");
    }

    return contractInstMap;
}

async function initAcceptOwnershipTaskMap(deployments:any, contractArr: any) {
    const contractInstMap = await initContractInstMap(deployments);

    let taskMap: {[key:string]: any} = {}

    for (let i = 0; i < contractArr.length; i++) {
        const contractInst = contractInstMap[contractArr[i]];
        assert(contractInst != null, `${contractArr[i]} instance is null`);
        if (!contractInst) return null;

        taskMap[contractInst.address] = {
            contractInst: contractInst,
            contractName: contractArr[i]
        };
    }

    return taskMap;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();

    const contractArr = config.get("ownerships.contracts") as string[];
    assert(contractArr.length == 0, "Contract List is empty");
    if (contractArr.length == 0) return;

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Accept ownerships of contracts");

    const taskMap = await initAcceptOwnershipTaskMap(deployments, contractArr);
    if (!taskMap) return;

    for (const [contractAddr, task] of Object.entries(taskMap)) {
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Accept ownership of ${task.contractName}`);

        const curOwner = await task.contractInst.owner();
        const curPendingOwner = await task.contractInst.pendingOwner();
        if (curOwner != deployer) {
            if (curPendingOwner != deployer) {
                logger.color('red').bold().log(`Can not acceptOwnership, deployer=${deployer}, pendingOwner=${curPendingOwner}`);
                return;
            }

            const tx = await task.contractInst.acceptOwnership();
            await tx.wait(1);

            console.log(`Owner is acceptted in ${task.contractName}, owner=${await task.contractInst.owner()}`);
        } else {
            console.log("Owner is already acceptted");
        }
    }
};

export default func;
