import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import config from 'config'
import { ethers } from 'hardhat';
import { assert } from 'console';
import { checkComponentAddress, getContractInst, isEnableMockPriceProxy, isEnableMultipleCollaterals } from '../../../helper-functions';
const logger = require('node-color-log');

async function addTokenPricePair(priceOracleInst: any, tokenAddr: any, pairName: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceOracleInst.addTokenPricePair(tokenAddr, pairName);
        await tx.wait(1);
        console.log("Added TokenPricePair in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase();
        if (msg.includes("price pair already exists")) {
            console.log("TokenPricePair", pairName, "already exist");
            ok = true;
        } else {
            console.log( msg );
        }
    }

    assert(ok, "PriceOracle addTokenPricePair " + tokenAddr + " failed!");
    return ok
}

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

async function setEarnWrappedToken(priceOracleInst: any, addr: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceOracleInst.setEarnWrappedToken(addr);
        await tx.wait(1);
        console.log("Setted earnWrappedToken address in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase();
        if (msg.includes("earn wrapped token unchanged")) {
            console.log("earn wrapped token unchanged");
            ok = true;
        } else {
            console.log( msg );
        }
    }

    assert(ok, "PriceOracle setEarnWrappedToken " + addr + " failed!");
    return ok
}

async function setEarnStrategy(priceOracleInst: any, addr: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceOracleInst.setEarnStrategy(addr);
        await tx.wait(1);
        console.log("Setted earnStrategy contract address in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase();
        if (msg.includes("earn strategy unchanged")) {
            console.log("earn strategy unchanged");
            ok = true;
        } else {
            console.log( msg );
        }
    }

    assert(ok, "PriceOracle setEarnStrategy " + addr + " failed!");
    return ok
}

function printUnexpectedResult(expectVal:any, returnedVal:any) {
    if (expectVal != returnedVal) {
        console.log({
            expectValue: expectVal,
            returnedValue: returnedVal
        });
    }
}

async function addFeedId(priceProxyInst: any, pricepairName: any, feedId: any) {
    let ok: Boolean = false;
    try {
        const tx = await priceProxyInst.addFeedId( pricepairName, feedId );
        await tx.wait(1);
        console.log("Add feeId in PriceOracle, tx hash is", tx.hash);
        ok = true;
    } catch (e: any) {
        const msg = e.message.toLowerCase()
        if (msg.includes("feedid already exists")) {
            ok = true
        } else {
            console.log( msg )
        }
    }
    return ok

}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Init PriceOracle Contract State...");

    const coreBTCProxyAddress = await checkComponentAddress(deployments, "CoreBTCProxy");
    if (!ethers.utils.isAddress(coreBTCProxyAddress)) return;

    const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
    if (!priceOracleInst) return;

    if (isEnableMultipleCollaterals()) {
        const earnWrappedToken   = config.get("oracle.lst.stcore");
        const earnStrategy       = config.get("oracle.lst.earn");

        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Set earn wrapped token address in PriceOracle`);
        const oldEarnWrappedToken = await priceOracleInst.earnWrappedToken();
        if ( oldEarnWrappedToken != earnWrappedToken ) {
            await setEarnWrappedToken(priceOracleInst, earnWrappedToken);
        } else {
            console.log("earnWrappedToken address is already setted in PriceOracle");
        }


        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Set earn strategy contract address in PriceOracle`);
        const oldEarnStrategy = await priceOracleInst.earnStrategy();
        if ( oldEarnStrategy != earnStrategy ) {
            await setEarnStrategy(priceOracleInst, earnStrategy);
        } else {
            console.log("earnStrategy contract address is already setted in PriceOracle");
        }
    }

    let usdtTokenAddress: any, usdcTokenAddress: any;
    try {
        usdtTokenAddress     = config.get("oracle.usdt_token");
        usdcTokenAddress     = config.get("oracle.usdc_token");
    } catch(e: any) {

    }

    // init PriceOracle: add token price pairs, e.g. nativeTokenAddress=>"CORE/USDT"
    const nativeTokenAddress   = config.get("oracle.native_token");
    const nativeTokenPricePair = config.get("oracle.price_pairs.core_usdt");
    const coreBTCPricePair     = config.get("oracle.price_pairs.btc_usdt");
    const usdtPricePair        = config.get("oracle.price_pairs.usdt_usdt");
    const usdcPricePair        = config.get("oracle.price_pairs.usdc_usdt");

    let pricePairMap: Record<string, string> = {
        [nativeTokenAddress as string]: nativeTokenPricePair as string,
        [coreBTCProxyAddress as string]: coreBTCPricePair as string
    };

    if (isEnableMultipleCollaterals()) {
        // pricePairMap[usdtTokenAddress as string] = usdtPricePair as string;
        // pricePairMap[usdcTokenAddress as string] = usdcPricePair as string;
    }

    for (const [token, pairName] of Object.entries(pricePairMap)) {
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Add token ${token} price pair name (${pairName}) in PriceOracle`);
        let oldPairName = await priceOracleInst.pricePairMap(token);
        if ( oldPairName != pairName ) {
            await addTokenPricePair(priceOracleInst, token, pairName);
        } else {
            console.log(pairName, "is already added in PriceOracle");
        }
    }

    if (isEnableMockPriceProxy()) return;

    // init PriceOracle: add priceProxies
    const switchboardPriceProxyAddress = await checkComponentAddress(deployments, "SwitchboardPriceProxy");
    if (!ethers.utils.isAddress(switchboardPriceProxyAddress)) return;

    const pythPriceProxyInst = await getContractInst(deployments, "", "PythPriceProxy", "");
    if (!pythPriceProxyInst) return;

    const pythPriceProxyAddress = pythPriceProxyInst.address;
    if (!ethers.utils.isAddress(pythPriceProxyAddress)) return;

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Add PythPriceProxy in PriceOracle ...");
    let idx = await priceOracleInst.priceProxyIdxMap(pythPriceProxyAddress);
    if ( idx == 0 ) {
        await addPriceProxy(priceOracleInst, pythPriceProxyAddress);
    } else {
        console.log("PythPriceProxy is already added in PriceOracle");
    }

    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Add SwitchboardPriceProxy in PriceOracle ...");
    idx = await priceOracleInst.priceProxyIdxMap(switchboardPriceProxyAddress);
    if ( idx == 0 ) {
        await addPriceProxy(priceOracleInst, switchboardPriceProxyAddress);
    } else {
        console.log("SwitchboardPriceProxy is already added in PriceOracle");
    }

    // init PriceOracle: choose pyth as best priceProxy
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("Set PythPriceProxy as the best priceProxy in PriceOracle ...");
    const bestOne = await priceOracleInst.bestPriceProxy();
    if (bestOne != pythPriceProxyAddress) {
        await selectBestPriceProxy(priceOracleInst, pythPriceProxyAddress);
    } else {
        console.log("PythPriceProxy is already the best priceProxy in PriceOracle");
    }


    // init PythPriceProxy: add feed ids
    const pythBtcUsdtFeedId = config.get("oracle.pyth.feed_ids.btc_usdt");
    const pythCoreUsdtFeedId= config.get("oracle.pyth.feed_ids.core_usdt");
    const pythUsdtFeedId    = config.get("oracle.pyth.feed_ids.usdt_usdt");
    const pythUsdcFeedId    = config.get("oracle.pyth.feed_ids.usdc_usdt");

    let feedIdMap: Record<string, string> = {
        [coreBTCPricePair as string]: pythBtcUsdtFeedId as string,
        [nativeTokenPricePair as string]: pythCoreUsdtFeedId as string,
    };

    if (isEnableMultipleCollaterals()) {
        // feedIdMap[usdtPricePair as string] = pythUsdtFeedId as string;
        // feedIdMap[usdcPricePair as string] = pythUsdcFeedId as string;
    }

    for (const [pairName, feedId] of Object.entries(feedIdMap)) {
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Add feed id of ${pairName} in PythPriceProxy ...`);
        let oldFeedId = await pythPriceProxyInst.getFeedId(pairName);
        if (oldFeedId != feedId) {
            await addFeedId(pythPriceProxyInst, pairName, feedId);
        } else {
            console.log(pairName,"=>", feedId, "is already added in PythPriceProxy");
        }
    }
};

export default func;