require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv/config"); // Import and configure dotenv
const fs = require("fs");

// Retrieve the private key and API keys from the .env file
const privateKey = process.env.PRIVATE_KEY;

// Task: Create a new market
task("create-market", "Creates a new HLPMM market")
  .addParam("name", "The market name (e.g., 'Bitcoin')")
  .addParam("symbol", "The token symbol (e.g., 'BTC')")
  .addOptionalParam("strategy", "Fee strategy: 0=CLAIM, 1=BURN, 2=AIRDROP, 3=COMPOUND", "0")
  .setAction(async (taskArgs, hre) => {
    const { createMarket, FeeStrategy } = require("./scripts/createMarket");
    const strategy = parseInt(taskArgs.strategy);
    await createMarket(taskArgs.name, taskArgs.symbol, strategy);
  });

// Task: List all markets
task("list-markets", "Lists all created markets")
  .setAction(async (taskArgs, hre) => {
    const marketsFile = "./markets.json";
    if (!fs.existsSync(marketsFile)) {
      console.log("No markets created yet.");
      return;
    }
    const markets = JSON.parse(fs.readFileSync(marketsFile, "utf8"));
    console.log("\n=== Created Markets ===\n");
    markets.forEach((m, i) => {
      console.log(`${i + 1}. ${m.name} (${m.symbol})`);
      console.log(`   Pool:  ${m.pool}`);
      console.log(`   Token: ${m.token}`);
      console.log(`   NFT:   ${m.nftId}`);
      console.log(`   Strategy: ${m.feeStrategy}`);
      console.log("");
    });
  });

// Check if the private key is set
if (!privateKey) {
  console.warn("🚨 WARNING: PRIVATE_KEY is not set in the .env file. Deployments will not be possible.");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true, // Enable IR-based code generator to fix "Stack too deep" errors
        },
      },
      {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      }
    ]
  },
networks: {
    'paxeer-network': {
      url: 'http://147.93.139.18:8545',
      accounts: privateKey ? [privateKey] : [] // <-- ADD THIS LINE
    },
  },
  etherscan: {
    apiKey: {
      'paxeer-network': 'empty'
    },
    customChains: [
      {
        network: "paxeer-network",
        chainId: 125,
        urls: {
          apiURL: "https://paxscan.paxeer.app/api",
          browserURL: "https://paxscan.paxeer.app"
        }
      }
    ]
  }
};