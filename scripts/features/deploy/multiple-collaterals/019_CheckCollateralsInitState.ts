import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from "hardhat";
import { checkComponentAddress, getContractInst, isEnableMultipleCollaterals } from '../../../../helper-functions';
import { BigNumber } from 'ethers';
const logger = require('node-color-log');

function splitInteger(num: number): string {
    let numStr = num.toString().split('').reverse().join('');
    numStr = numStr.replace(/\d{3}(?=\d)/g, match => match + ',');
    return numStr.split('').reverse().join('');
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    if (!isEnableMultipleCollaterals()) return;

    logger.color('blue').log("-------------------------------------------------")
    logger.color('blue').bold().log("Check CollateralsProxy Contract state...")

    const expectedLockersProxyAddress = await checkComponentAddress(deployments, "LockersProxy");
    if (!ethers.utils.isAddress(expectedLockersProxyAddress)) return;

    // init collateralsProxy instance
    const collateralsProxyInst = await getContractInst(deployments, "CollateralsProxy", "CollateralsLogic", "");
    if (!collateralsProxyInst) return;

    // check lockersProxy address
    const lockers = await collateralsProxyInst.lockers();
    if (lockers != expectedLockersProxyAddress) {
        console.log("lockers of CollateralsProxy is incorrect");
    } else {
        console.log("lockers of CollateralsProxy is correct");
    }

    // check collateral infos
    const totalNumber = await collateralsProxyInst.getTotalNumber();
    for (let i = 0; i < totalNumber; i++) {
        const collateral = await collateralsProxyInst.getCollateral(i);

        const decimals = await collateralsProxyInst.getDecimals(collateral.token);
        const minLockedAmount = await collateralsProxyInst.getMinLockedAmount(collateral.token);
        const mappingIndex = await collateralsProxyInst.collateralsMap(collateral.token);

        if (i != mappingIndex - 1) {
            console.log(`Collateral ${i}, token=${collateral.token} mapping error`);
        } else {
            const amount = BigNumber.from(minLockedAmount).div(BigNumber.from(10).pow(decimals));
            console.log(`Collateral ${i}, token=${collateral.token}, minLockedAmount=${amount}`);
        }
    }
};

export default func;