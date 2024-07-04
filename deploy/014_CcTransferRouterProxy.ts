import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {verify} from "../helper-functions"
import config from 'config'
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const ccTransferRouterLogic = await deployments.get("CcTransferRouterLogic");
    const lockersProxy          = await deployments.get("LockersProxy");
    const coreBTCProxy          = await deployments.get("CoreBTCProxy");
    const bitcoinRelayProxy     = await deployments.get("BitcoinRelayProxy");

    const startingBlockHeight   = config.get("starting_block_height");
    const protocolPercentageFee = config.get("minter.protocol_percentage_fee");
    const version               = config.get("minter.version");
    const chainId               = config.get("chain_id");
    const appId                 = config.get("minter.app_id");
    const relayProxyAddress     = bitcoinRelayProxy.address;
    const lockerProxyAddress    = lockersProxy.address;
    const coreBTCProxyAddress   = coreBTCProxy.address;
    const treasury              = config.get("treasury");

    const methodSig = ethers.utils.id(
        "initialize(uint256,uint256,uint256,uint256,uint256,address,address,address,address)"
    );

    const params = ethers.utils.defaultAbiCoder.encode(
        ['uint256','uint256','uint256','uint256','uint256','address','address','address','address'],
        [startingBlockHeight, protocolPercentageFee, version, chainId, appId, relayProxyAddress,lockerProxyAddress,coreBTCProxyAddress,treasury]
    );

    const initCode = ethers.utils.solidityPack(
        ['bytes', 'bytes'],
        [methodSig.slice(0,10), params]
    );

    const args = [
        ccTransferRouterLogic.address,
        initCode
    ];

    const deployedContract = await deploy("CcTransferRouterProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args: args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/routers/CcTransferRouterProxy.sol:CcTransferRouterProxy",
            hre
        )
    }
};

export default func;
func.tags = ["CcTransferRouterProxy"];
