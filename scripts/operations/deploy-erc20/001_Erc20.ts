import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { verify,waitForInput } from '../../../helper-functions';
import { BigNumber } from 'ethers';
const logger = require('node-color-log');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Deploy ERC20 Token Contract ...");

    const name:string = await waitForInput("Enter The ERC20 Token Name:") as string;
    if (!name.length) {
        logger.color('red').bold().log("ERC20 token name is invalid");
        return;
    }

    const symbol: string = await waitForInput("Enter The ERC20 Token Symbol:") as string;
    if (!symbol.length) {
        logger.color('red').bold().log("ERC20 token symbol is invalid");
        return;
    }
    const initialMintedAmount: number = await waitForInput("Enter The ERC20 Token Mint Amount:") as number;
    if (!initialMintedAmount) {
        logger.color('red').bold().log("ERC20 token initial mint amount is invalid");
        return;
    }

    const initialMintedAmountWithDecimals = BigNumber.from(10).pow(18).mul(initialMintedAmount);

    const args = [
        name,
        symbol,
        initialMintedAmountWithDecimals
    ];

    const deployedContract = await deploy("erc20", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/erc20/erc20.sol:erc20"
        )
    }
};

export default func;
func.tags = ["erc20"];
