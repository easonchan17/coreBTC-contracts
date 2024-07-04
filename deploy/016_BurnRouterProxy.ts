import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {verify} from "../helper-functions"
import config from 'config'
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const burnRouterLogic       = await deployments.get("BurnRouterLogic");
    const lockersProxy          = await deployments.get("LockersProxy");
    const coreBTCProxy          = await deployments.get("CoreBTCProxy");
    const bitcoinRelayProxy     = await deployments.get("BitcoinRelayProxy");

    const startingBlockHeight   = config.get("starting_block_height");
    const relayProxyAddress     = bitcoinRelayProxy.address;
    const lockersProxyAddress   = lockersProxy.address;
    const treasury              = config.get("treasury");
    const coreBTCProxyAddress   = coreBTCProxy.address;

    const transferDeadline      = config.get("burner.transfer_deadLine");
    const protocolPercentageFee = config.get("burner.protocol_percentage_fee");
    const slaherPercentageReward= config.get("burner.slasher_percentage_reward");
    const bitcoinFee            = config.get("burner.bitcoin_fee");

    const methodSig = ethers.utils.id(
        "initialize(uint256,address,address,address,address,uint256,uint256,uint256,uint256)"
    );

    const params = ethers.utils.defaultAbiCoder.encode(
        ['uint256','address','address','address','address','uint256','uint256','uint256','uint256'],
        [startingBlockHeight, relayProxyAddress, lockersProxyAddress, treasury, coreBTCProxyAddress, transferDeadline,
            protocolPercentageFee, slaherPercentageReward, bitcoinFee]
    );

    const initCode = ethers.utils.solidityPack(
        ['bytes', 'bytes'],
        [methodSig.slice(0,10), params]
    );

    const args = [
        burnRouterLogic.address,
        initCode
    ];

    const deployedContract = await deploy("BurnRouterProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args: args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/routers/BurnRouterProxy.sol:BurnRouterProxy",
            hre
        )
    }
};

export default func;
func.tags = ["BurnRouterProxy"];