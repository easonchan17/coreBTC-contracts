import * as dotenv from "dotenv";

import { HardhatUserConfig} from "hardhat/config";
import { HttpNetworkUserConfig } from "hardhat/types";
import '@openzeppelin/hardhat-upgrades';

import "@nomicfoundation/hardhat-verify"
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "hardhat-deploy-tenderly";
import "hardhat-contract-sizer";

dotenv.config();

function toggleSensitiveInfo(text:any, visibleChars:number = 4) {
	if (!text || text.length <= visibleChars * 2) return "*";

	const hiddenPart = '*'.repeat(text.length - visibleChars * 2);
	return text.slice(0, 4) + hiddenPart + text.slice(-4);
}

const {PRIVATE_KEY,ETHERSCAN_API_KEY,NETNAME,NETWORK} = process.env;
console.log(`PRIVATE_KEY=${toggleSensitiveInfo(PRIVATE_KEY)}`);
console.log(`ETHERSCAN_API_KEY=${toggleSensitiveInfo(ETHERSCAN_API_KEY)}`);
console.log(`NETWORK=${NETWORK}`);

if (NETWORK !== NETNAME) {
	console.log('NETWORK !== NETNAME');
	process.exit(1);
}

const infuraNetwork = (
	accounts: any,
	network: string,
	chainId?: number,
	gas?: number
): HttpNetworkUserConfig => {
	return {
		url: `https://${network}.infura.io/v3/${process.env.PROJECT_ID}`,
		chainId,
		gas,
		accounts,
		gasPrice: 200000000000,
	}
}

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: "0.8.4",
				settings: {
					optimizer: {
						enabled: true
					},
				},
			}
		],
	},
	networks: {
		core_devnet: {
			url: "https://rpc.dev.btcs.network/",
			chainId: 1112,
			accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
		},
		core_testnet_for_dev: {
			url: "https://rpc.test.btcs.network/",
			chainId: 1115,
			accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
		},
		core_testnet: {
			url: "https://rpc.test.btcs.network/",
			chainId: 1115,
			accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
		},
		core_mainnet: {
			url: "https://rpc.coredao.org/",
			chainId: 1116,
			accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
		}
	},
  	paths: {
		artifacts: "artifacts",
		deploy: "deploy",
		deployments: "deployments",
  	},
  	typechain: {
		outDir: "src/types",
		target: "ethers-v5",
  	},
  	namedAccounts: {
		deployer: {
			default: 0,
		},
  	},
  	gasReporter: {
		// enabled: process.env.REPORT_GAS !== undefined,
		enabled: true,
		currency: "USD",
  	},
  	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
		customChains: [
			{
				network: "core_devnet",
				chainId: 1112,
				urls: {
					apiURL: "http://18.221.10.178:8090/api",
					browserURL: "https://scan.dev.btcs.network/"
				}
			},
			{
				network: "core_testnet_for_dev",
				chainId: 1115,
				urls: {
					apiURL: "https://api.test.btcs.network/api",
					browserURL: "https://scan.test.btcs.network/"
				}
			},
			{
				network: "core_testnet",
				chainId: 1115,
				urls: {
					apiURL: "https://api.test.btcs.network/api",
					browserURL: "https://scan.test.btcs.network/"
				}
			},
			{
				network: "core_mainnet",
				chainId: 1116,
				urls: {
					apiURL: "https://openapi.coredao.org/api",
					browserURL: "https://scan.coredao.org/"
				}
			}
		]
  	},
	sourcify: {
		enabled: false
	}
};

export default config;