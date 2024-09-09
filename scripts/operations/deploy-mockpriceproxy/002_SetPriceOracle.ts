import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { assert } from 'console';
import config from 'config'
import { getContractInst, isEnableMockPriceProxy, checkComponentAddress } from '../../../helper-functions';
import { BigNumber } from 'ethers';
const logger = require('node-color-log');

async function addPriceProxy(priceOracleInst: any, priceProxyAddress: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceOracleInst.addPriceProxy( priceProxyAddress );
        await tx.wait(1);
        console.log("Added PriceProxy in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase()
        if (msg.includes("price proxy already exists")) {
            console.log("PriceProxy", priceProxyAddress, "already exist");
            ok = true
        } else {
            console.log( msg )
        }
    }
    assert(ok, "PriceOracle addPriceProxy " + priceProxyAddress + " failed!")
    return ok
}

async function selectBestPriceProxy(priceOracleInst: any, priceProxyAddress: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceOracleInst.selectBestPriceProxy( priceProxyAddress );
        await tx.wait(1);
        console.log("Set best PriceProxy in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase()
        if (msg.includes("price proxy is already best")) {
            console.log("PriceProxy", priceProxyAddress, "is already the best one");
            ok = true
        } else {
            console.log( msg )
        }
    }

    assert( ok, "PriceOracle selectBestPriceProxy failed!" )
    return ok
}

async function setTokenPrice(mockPriceProxyInst: any, pricePair: any, price: any, decimals: any, diffTime: any) {
    let ok: Boolean = false;
    try {
        const tx = await mockPriceProxyInst.setPrice(pricePair, price, decimals, diffTime);
        await tx.wait(1);
        console.log(`Set ${pricePair} price in MockPriceProxy, tx hash is`, tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase()
        console.log( msg )
    }

    assert( ok, `MockPriceProxy set ${pricePair} Price failed!` )
    return ok
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    if (!isEnableMockPriceProxy()) return;

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Set PriceOracle Contract State...");

    const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
    if (!priceOracleInst) return;

    const mockPriceProxyInst = await getContractInst(deployments, "", "MockPriceProxy", "");
    if (!mockPriceProxyInst) return;

    const mockPriceProxyAddress = mockPriceProxyInst.address;
    if (!ethers.utils.isAddress(mockPriceProxyAddress)) return;

    const coreBTCProxyAddress = await checkComponentAddress(deployments, "CoreBTCProxy");
    if (!ethers.utils.isAddress(coreBTCProxyAddress)) return;

    // Set PriceOracle: add priceProxies
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Add MockPriceProxy in PriceOracle ...");
    let idx = await priceOracleInst.priceProxyIdxMap(mockPriceProxyAddress);
    if ( idx == 0 ) {
        await addPriceProxy(priceOracleInst, mockPriceProxyAddress);
    } else {
        console.log("MockPriceProxy is already added in PriceOracle");
    }

    // Set PriceOracle: choose MockPriceProxy as best priceProxy
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Set MockPriceProxy as the best priceProxy in PriceOracle ...");
    const bestOne = await priceOracleInst.bestPriceProxy();
    if (bestOne != mockPriceProxyAddress) {
        await selectBestPriceProxy(priceOracleInst, mockPriceProxyAddress);
    } else {
        console.log("MockPriceProxy is already the best priceProxy in PriceOracle");
    }

    // Add CORE/USDT price to MockPriceProxy
    const nativeTokenPricePair = config.get("oracle.price_pairs.core_usdt");
    const nativeTokenDecimals = 18
    const nativeTokenPrice = BigNumber.from(10).pow(nativeTokenDecimals).mul(1)
    await setTokenPrice(
        mockPriceProxyInst,
        nativeTokenPricePair,
        nativeTokenPrice,
        nativeTokenDecimals,
        0
    )

    // Add BTC/USDT price to MockPriceProxy
    const coreBTCPricePair = config.get("oracle.price_pairs.btc_usdt");
    const coreBTCDecimals = 1
    const coreBTCPrice = BigNumber.from(10).pow(coreBTCDecimals).mul(60000)
    await setTokenPrice(
        mockPriceProxyInst,
        coreBTCPricePair,
        coreBTCPrice,
        coreBTCDecimals,
        0
    )
};

export default func;