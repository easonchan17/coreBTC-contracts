import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const Table  = require('cli-table3');
const chalk  = require('chalk');
const logger = require('node-color-log');

const getDeployment = async (component: any, deploymentName: string) => {
    let dep : any;

    try {
        dep = await component.get(deploymentName);
    } catch (e : any) {
        dep = {
            address: ""
        }
    }

    return dep;
}

const getByteCodeLenth = async (hre: any, contractName: string) => {
    let len : any;
    try {
        const artifact = await hre.artifacts.readArtifact(contractName);
        len = artifact.bytecode.length / 2;
        if (artifact.bytecode.startsWith('0x')) {
            len -= 1;
        }
    } catch (e: any) {
        len = 0;
    }

    return len;

}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    const bitcoinRelayLogic     = await getDeployment(deployments, "BitcoinRelayLogic");
    const bitcoinRelayProxy     = await getDeployment(deployments, "BitcoinRelayProxy");
    const coreBTCLogic          = await getDeployment(deployments, "CoreBTCLogic");
    const coreBTCProxy          = await getDeployment(deployments, "CoreBTCProxy");
    const pythPriceProxy        = await getDeployment(deployments, "PythPriceProxy");
    const switchboardPriceProxy = await getDeployment(deployments, "SwitchboardPriceProxy");
    const priceOracle           = await getDeployment(deployments, "PriceOracle");
    const lockersLib            = await getDeployment(deployments, "LockersLib");
    const lockersLogic          = await getDeployment(deployments, "LockersLogic");
    const lockersProxy          = await getDeployment(deployments, "LockersProxy");
    const ccTransferRouterLogic = await getDeployment(deployments, "CcTransferRouterLogic");
    const ccTransferRouterProxy = await getDeployment(deployments, "CcTransferRouterProxy");
    const burnRouterLib         = await getDeployment(deployments, "BurnRouterLib");
    const burnRouterLogic       = await getDeployment(deployments, "BurnRouterLogic");
    const burnRouterProxy       = await getDeployment(deployments, "BurnRouterProxy");
    const collateralsLogic      = await getDeployment(deployments, "CollateralsLogic");
    const collateralsProxy      = await getDeployment(deployments, "CollateralsProxy");

    const lockersLogicByteLen       = await getByteCodeLenth(hre, "LockersLogic");
    const burnRouterLogicByteLen    = await getByteCodeLenth(hre, "BurnRouterLogic");
    const collateralsLogicByteLen   = await getByteCodeLenth(hre, "CollateralsLogic");


    const contractTable = new Table({
        head: [chalk.blue('Contract'),chalk.blue('Proxy Address'),chalk.blue('Logic Address'),chalk.blue('Logic Bytecode Length')],
        colWidths: [30, 45, 45]
    })

    contractTable.push(
        [chalk.red('PriceOracle'), chalk.red('No Proxy'), priceOracle.address, ""],
        [chalk.red('BitcoinRelay'), bitcoinRelayProxy.address, bitcoinRelayLogic.address,""],
        [chalk.red('CoreBTC'), coreBTCProxy.address, coreBTCLogic.address,""],
        [chalk.red('Lockers'), lockersProxy.address, lockersLogic.address,lockersLogicByteLen],
        [chalk.red('CcTransferRouter'), ccTransferRouterProxy.address, ccTransferRouterLogic.address,""],
        [chalk.red('BurnRouter'), burnRouterProxy.address, burnRouterLogic.address,burnRouterLogicByteLen],
        [chalk.red('Collaterals'), collateralsProxy.address, collateralsLogic.address, collateralsLogicByteLen]
    );

    logger.color('blue').bold().log("Miain Contract Address List");
    console.log(contractTable.toString());

    const depContractTable  = new Table({
        head: [chalk.blue('Contract'),chalk.blue('Address'),chalk.blue('Note')],
        colWidths: [30, 45, 45]
    })
    depContractTable.push(
        [chalk.red('PythPriceProxy'), pythPriceProxy.address, 'Used by PriceOracle'],
        [chalk.red('SwitchboardPriceProxy'), switchboardPriceProxy.address, 'Used by PriceOracle'],
        [chalk.red('LockersLib'), lockersLib.address, 'Used by LockersLogic'],
        [chalk.red('BurnRouterLib'), burnRouterLib.address, 'Used by BurnRouterLogic']
    );
    logger.color('blue').bold().log("Dependency Contract Or Lib Address List");
    console.log(depContractTable.toString());
};

export default func;
