import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {isEnableMultipleCollaterals, verify, checkComponentAddress, waitForInput, checkValue} from "../../../../helper-functions"
import config from 'config'
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    if (!isEnableMultipleCollaterals()) return;

    const minLockedNativeTokenAmount:any = config.get("locker.min_locked_native_token_amount");
    const amount = await checkValue("Check the minLockedNativeTokenAmount", minLockedNativeTokenAmount);
    const minLockedAmount = BigNumber.from(10).pow(18).mul(amount)

    const collateralsLogicAddress = await checkComponentAddress(deployments, "CollateralsLogic");
    if (!ethers.utils.isAddress(collateralsLogicAddress as string)) return;

    const lockersProxyAddress     = await checkComponentAddress(deployments, "LockersProxy");
    if (!ethers.utils.isAddress(lockersProxyAddress as string)) return;

    const methodSig = ethers.utils.id(
        "initialize(address,uint256)"
    );
    const params = ethers.utils.defaultAbiCoder.encode(
        ['address','uint256'],
        [lockersProxyAddress, minLockedAmount]
    );

    const initCode = ethers.utils.solidityPack(
        ['bytes', 'bytes'],
        [methodSig.slice(0,10), params]
    );

    const args = [
        collateralsLogicAddress,
        initCode
    ];

    const deployedContract = await deploy("CollateralsProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args: args
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            args,
            "contracts/lockers/CollateralsProxy.sol:CollateralsProxy",
            hre
        )
    }
};

export default func;
func.tags = ["CollateralsProxy"];
