import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import config from 'config'
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { checkComponentAddress, getContractInst, isEnableMockPriceProxy, isEnableMultipleCollaterals } from '../../../helper-functions';
const logger = require('node-color-log');


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments } = hre;
    logger.color('blue').log("-----------------------------------------");
    logger.color('blue').bold().log("Check PriceOracle Contract State...");

    const coreBTCProxyAddress = await checkComponentAddress(deployments, "CoreBTCProxy");
    if (!ethers.utils.isAddress(coreBTCProxyAddress as string)) return;

    const priceOracleInst = await getContractInst(deployments, "", "PriceOracle", "");
    if (!priceOracleInst) return;

    let usdtTokenAddress: any, usdcTokenAddress: any;
    try {
        usdtTokenAddress     = config.get("oracle.usdt_token");
        usdcTokenAddress     = config.get("oracle.usdc_token");
    } catch(e: any) {

    }

    const nativeTokenAddress   = config.get("oracle.native_token");
    const nativeTokenPricePair = config.get("oracle.price_pairs.core_usdt");
    const coreBTCPricePair     = config.get("oracle.price_pairs.btc_usdt");
    const usdtPricePair        = config.get("oracle.price_pairs.usdt_usdt");
    const usdcPricePair        = config.get("oracle.price_pairs.usdc_usdt");

    /// PythPriceProxy init state:
    //  1. pairName => feeId
    //  2. CORE price
    //  3. BTC price
    let pairNameMap = {
        "CORE": nativeTokenPricePair,
        "CoreBTC": coreBTCPricePair,
    }

    if (isEnableMultipleCollaterals()) {
        // pairNameMap["USDT"] = usdtPricePair;
        // pairNameMap["USDC"] = usdcPricePair;
    }

    if (!isEnableMockPriceProxy()) {
        let price: any, err: string;

        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log("PythPriceProxy state checking...");

        const pythPriceProxyInst = await getContractInst(deployments, "", "PythPriceProxy", "");
        if (!pythPriceProxyInst) return;

        for (const [tokenName, pairName] of Object.entries(pairNameMap)) {
            const feedId = await pythPriceProxyInst.getFeedId(pairName);
            console.log(`${tokenName} price pair name is ${pairName}, feedId = ${feedId}`);
        }

        for (const [tokenName, pairName] of Object.entries(pairNameMap)) {
            [price, err] = await pythPriceProxyInst.getEmaPriceByPairName(pairName);
            console.log(tokenName, pairName, "Pyth EMA Price =", {
                price: price.price,
                decimals: price.decimals,
                publishTime: price.publishTime,
                err: err
            });
        }

        /// SwitchboardPriceProxy init state
        //  1.CORE price
        //  2.BTC price
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log("SwitchboardPriceProxy state checking...");

        const switchboardPriceProxyInst = await getContractInst(deployments, "", "SwitchboardPriceProxy", "");
        if (!switchboardPriceProxyInst) return;

        for (const [tokenName, pairName] of Object.entries(pairNameMap)) {
            [price, err] = await switchboardPriceProxyInst.getEmaPriceByPairName(pairName);
            console.log(tokenName, pairName, "Switchboard EMA Price =", {
                price: price.price,
                decimals: price.decimals,
                publishTime: price.publishTime,
                err: err
            });
        }
    }

    /// PriceOracle init state:
    //  1. tokenAddress => pricePairName
    //  2. proxyProxyAddress List
    //  3. bestPriceProxyAddress
    //  4. CORE price
    //  5. BTC price
    logger.color('blue').log("-------------------------------------------------");
    logger.color('blue').bold().log("PriceOracle state checking...");

    if (isEnableMultipleCollaterals()) {
        const earnWrappedToken = await priceOracleInst.earnWrappedToken();
        const earnStrategy     = await priceOracleInst.earnStrategy();
        console.log("Earn wrapped token address =", earnWrappedToken);
        console.log("Earn strategy contract address =", earnStrategy);
    }

    let tokenMap:{[key:string]: any} = {};
    tokenMap["CORE"] = nativeTokenAddress;
    tokenMap["CoreBTC"] = coreBTCProxyAddress;
    if (isEnableMultipleCollaterals()) {
        // tokenMap["USDT"] = usdtTokenAddress;
        // tokenMap["USDC"] = usdcTokenAddress;
    }

    for (const [tokenName, tokenAddress] of Object.entries(tokenMap)) {
        const pairName = await priceOracleInst.pricePairMap(tokenAddress);
        console.log(`The pair name of token ${tokenName} is ${pairName}`);
    }

    try {
        for (let i = 0; i < 2; i++) {
            const priceProxy = await priceOracleInst.priceProxyList(i);
            console.log(`PriceOracle priceProxy ${i} is ${priceProxy}`);
        }
    } catch (error) {

    }

    const bestProxy   = await priceOracleInst.bestPriceProxy();
    console.log("PriceOracle best priceProxy is", bestProxy);

    const generatePriceParam = (
        inputTokenName: any, outputTokenName: any,
        inputToken: any, outputToken: any,
        inputDecimals: any, outputDecimals: any, inputAmount: any) => {
        return {
            inputTokenName: inputTokenName,
            outputTokenName: outputTokenName,
            inputToken: inputToken,
            outputToken: outputToken,
            inputDecimals: inputDecimals,
            outputDecimals: outputDecimals,
            inputAmount: BigNumber.from(10).pow(inputDecimals).mul(inputAmount)
        }
    }

    const coreBtcDecimals = 8;
    const coreDecimals  = 18;
    const stCoreDecimals = 18;

    const BTC = "BTC";
    const CORE = "CORE";
    const stCORE = "stCORE";
    const USDT = "USDT";
    const USDC = "USDC";
    const SATOSHI = "Satoshi";
    const inputAmount = 1;

    let priceParams = [];
    priceParams.push(generatePriceParam(BTC, CORE, coreBTCProxyAddress, nativeTokenAddress, coreBtcDecimals, coreDecimals, inputAmount));
    priceParams.push(generatePriceParam(CORE, SATOSHI, nativeTokenAddress, coreBTCProxyAddress, coreDecimals, coreBtcDecimals, inputAmount));

    if (isEnableMultipleCollaterals()) {
        const earnWrappedToken = await priceOracleInst.earnWrappedToken();
        priceParams.push(generatePriceParam(BTC, stCORE, coreBTCProxyAddress, earnWrappedToken, coreBtcDecimals, stCoreDecimals, inputAmount));
        priceParams.push(generatePriceParam(stCORE, SATOSHI, earnWrappedToken, coreBTCProxyAddress, stCoreDecimals, coreBtcDecimals, inputAmount));
        // priceParams.push(generatePriceParam(BTC, USDT, coreBTCProxyAddress, usdtTokenAddress, coreBtcDecimals, 0, inputAmount));
        // priceParams.push(generatePriceParam(USDT, SATOSHI, usdtTokenAddress, coreBTCProxyAddress, 0, coreBtcDecimals, inputAmount));
        // priceParams.push(generatePriceParam(BTC, USDC, coreBTCProxyAddress, usdcTokenAddress, coreBtcDecimals, 0, inputAmount));
        // priceParams.push(generatePriceParam(USDC, SATOSHI, usdcTokenAddress, coreBTCProxyAddress, 0, coreBtcDecimals, inputAmount));
    }

    for (let i = 0; i < priceParams.length; i++) {
        const param = priceParams[i];
        logger.color('blue').log("-------------------------------------------------");
        logger.color('blue').bold().log(`Query ${inputAmount} ${param.inputTokenName} = ? ${param.outputTokenName} in PriceOracle ...`);
        try {
            const amount = await priceOracleInst.equivalentOutputAmount(
                param.inputAmount,
                param.inputDecimals,
                param.outputDecimals,
                param.inputToken,
                param.outputToken
            );

            // console.log('amount', amount.toString());
            let res = amount.div(BigNumber.from(10).pow(param.outputDecimals));
            if (param.outputTokenName === SATOSHI) {
                res = amount;
            }
            console.log(`PriceOracle, ${inputAmount} ${param.inputTokenName} = ${res.toNumber()} ${param.outputTokenName}`);
        } catch (e: any) {
            console.log(`Call equivalentOutputAmount error: inputTokenName=${param.inputTokenName}, outputTokenName=${param.outputTokenName}`)
            console.log(e.message)
        }
    }
};

export default func;
