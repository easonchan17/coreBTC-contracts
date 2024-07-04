import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getContractInst, isEnableMultipleCollaterals } from '../../../helper-functions';
import { ethers } from 'hardhat';
import { assert } from 'console';
const logger = require('node-color-log');
import config from 'config'

async function initContractInstMap(deployments:any) {
    let contractInstMap: {[key:string]: any} = {}

    const addContractInstMap = async function(proxyName: any, logicName: any, libName: any) {
        const contractInst = await getContractInst(deployments, proxyName, logicName, libName);

        if (proxyName.length > 0) {
            contractInstMap[proxyName] = contractInst;
        } else if (logicName.length > 0) {
            contractInstMap[logicName] = contractInst;
        } else {
            assert(false, "addContractInstMap invalid key");
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

async function initTransferOwnershipTaskMap(deployments:any, contractArr: any, defaultOwner:any) {
    const contractInstMap = await initContractInstMap(deployments);

    let taskMap: {[key:string]: any} = {}
    const addTaskToMap = function(contractName: any, owner:any) {
        if (!owner || owner.length === 0) {
            owner = defaultOwner;
        }

        assert(ethers.utils.isAddress(owner), "Owner is invalid");
        if (!ethers.utils.isAddress(owner)) return false;

        const contractInst = contractInstMap[contractName];
        if (!contractInst) return false;

        taskMap[contractInst.address] = {
            contractInst: contractInst,
            contractOwner: owner,
            contractName: contractName
        }

        return true;
    }

    for (let i = 0; i < contractArr.length; i++) {
        if ( !addTaskToMap(contractArr[i], defaultOwner) ) {
            logger.color('red').bold().log(`addTaskToMap error, contractName ${contractArr[i]}`);
            return null;
        }
    }

    return taskMap;
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    const defaultOwner = config.get("ownerships.default") as string;
    assert(ethers.utils.isAddress(defaultOwner), "Default owner is invalid");
    if (!ethers.utils.isAddress(defaultOwner)) return;

    const contractArr = config.get("ownerships.contracts") as string[];
    assert(contractArr.length == 0, "Contract List is empty");
    if (contractArr.length == 0) return;


    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Transfer ownerships of contracts");

    const taskMap = await initTransferOwnershipTaskMap(deployments, contractArr, defaultOwner);
    if (!taskMap) return;

    for (const [contractAddr, task] of Object.entries(taskMap)) {
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Transfer ownership of ${task.contractName} to ${task.contractOwner}`);

        const curOwner = await task.contractInst.owner();
        if (curOwner != task.contractOwner) {
            const tx = await task.contractInst.transferOwnership(task.contractOwner);
            await tx.wait(1);

            const pendingOwner = await task.contractInst.pendingOwner();
            console.log(`Owner is setted in ${task.contractName}, pendingOwner is ${pendingOwner}`);
        } else {
            console.log("Owner is already setted");
        }
    }
};

export default func;
