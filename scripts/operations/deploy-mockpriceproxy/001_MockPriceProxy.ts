import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { checkComponentAddress, verify,waitForInput } from '../../../helper-functions';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
const logger = require('node-color-log');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Deploy MockPriceProxy Contract ...");

    // Use a fake oracle address for deploying mock price proxy, the oracle address will not be used.
    const oracleAddress = await checkComponentAddress(deployments, "PriceOracle");
    if (!ethers.utils.isAddress(oracleAddress)) return;

    const args = [
        oracleAddress
    ];

    const deployedContract = await deploy("MockPriceProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/test/MockPriceProxy.sol:MockPriceProxy"
        )
    }
};

export default func;
func.tags = ["MockPriceProxy"];
