import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {verify,isEnableMultipleCollaterals} from "../helper-functions"
import config from 'config'
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

async function generateInitCode(deployments: any) {
    const coreBTCProxy          = await deployments.get("CoreBTCProxy");
    const priceOracle           = await deployments.get("PriceOracle");

    const coreBTCProxyAddress   = coreBTCProxy.address;
    const priceOracleAddress    = priceOracle.address;
    const collateralRatio       = config.get("locker.collateral_ratio");
    const liquidationRatio      = config.get("locker.liquidation_ratio");
    const lockerPercentageFee   = config.get("locker.locker_percentage_fee");
    const priceWithDiscountRatio= config.get("locker.price_with_discount_ratio");
    const minLockedNativeTokenAmount:any = config.get("locker.min_locked_native_token_amount");

    if (!isEnableMultipleCollaterals()) {
        const methodSig = ethers.utils.id(
            "initialize(address,address,uint256,uint256,uint256,uint256,uint256)"
        );

        const transferedAmount = BigNumber.from(10).pow(18).mul(minLockedNativeTokenAmount)
        const params = ethers.utils.defaultAbiCoder.encode(
            ['address','address','uint256','uint256','uint256','uint256','uint256'],
            [coreBTCProxyAddress,priceOracleAddress,transferedAmount,
                collateralRatio,liquidationRatio,lockerPercentageFee,priceWithDiscountRatio]
        );

        return ethers.utils.solidityPack(
            ['bytes', 'bytes'],
            [methodSig.slice(0,10), params]
        );
    } else {
        const methodSig = ethers.utils.id(
            "initialize(address,address,uint256,uint256,uint256,uint256)"
        );

        const params = ethers.utils.defaultAbiCoder.encode(
            ['address','address','uint256','uint256','uint256','uint256'],
            [coreBTCProxyAddress,priceOracleAddress,
                collateralRatio,liquidationRatio,lockerPercentageFee,priceWithDiscountRatio]
        );

        return ethers.utils.solidityPack(
            ['bytes', 'bytes'],
            [methodSig.slice(0,10), params]
        );
    }
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const lockersLogic = await deployments.get("LockersLogic");
    const initCode = await generateInitCode(deployments);

    const args = [
        lockersLogic.address,
        initCode
    ];

    const deployedContract = await deploy("LockersProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args: args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/lockers/LockersProxy.sol:LockersProxy",
            hre
        )
    }
};

export default func;
func.tags = ["LockersProxy"];
