import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import config from 'config'
import {verify,isEnableMockPriceProxy} from "../helper-functions"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    if (isEnableMockPriceProxy()) return;

    const switchboardAddress = config.get("oracle.switch_board.address");

    const deployedContract = await deploy("SwitchboardPriceProxy", {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        args: [
            switchboardAddress
        ],
    });

    if (network.name != "hardhat" && process.env.ETHERSCAN_API_KEY && process.env.VERIFY_OPTION == "1") {
        await verify(
            deployedContract.address,
            [switchboardAddress],
            "contracts/oracle/price-proxy-impl/SwitchboardPriceProxy.sol:SwitchboardPriceProxy")
    }
};

export default func;
func.tags = ["SwitchboardPriceProxy"];
