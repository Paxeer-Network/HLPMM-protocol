const { ethers } = require("hardhat");
const fs = require("fs");

// FeeStrategy enum values
const FeeStrategy = {
  CLAIM: 0,     // direct claim to wallet
  BURN: 1,      // burn USID
  AIRDROP: 2,   // accumulate for community airdrop
  COMPOUND: 3   // compound back into pool
};

// Load deployment addresses
function loadDeployments() {
  const path = "./deployments.json";
  if (!fs.existsSync(path)) {
    throw new Error("deployments.json not found. Please run deploy.js first.");
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// HLPMMFactory ABI (only what we need)
const FACTORY_ABI = [
  "function createMarket(string memory name, string memory symbol, uint8 initialStrategy) external returns (address pool, address token, uint256 nftId)",
  "function marketCount() external view returns (uint256)",
  "function getAllPools() external view returns (address[])",
  "function tokenToPool(address token) external view returns (address)",
  "function nftToPool(uint256 nftId) external view returns (address)",
  "event MarketCreated(address indexed pool, address indexed token, uint256 indexed nftId, address creator)"
];

async function createMarket(name, symbol, feeStrategy = FeeStrategy.CLAIM) {
  const signers = await ethers.getSigners();
  
  if (!signers || signers.length === 0) {
    console.error("❌ ERROR: No signers available. Please set PRIVATE_KEY in your .env file.");
    process.exit(1);
  }

  const [creator] = signers;
  console.log("\n========================================");
  console.log("HLPMM Market Creation");
  console.log("========================================\n");
  console.log("Creator:", creator.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(creator.address)), "PAX");

  // Load deployed contract addresses
  const deployments = loadDeployments();
  console.log("\nUsing Factory at:", deployments.contracts.factory);

  // Connect to factory
  const factory = new ethers.Contract(
    deployments.contracts.factory,
    FACTORY_ABI,
    creator
  );

  // Get current market count
  const marketCountBefore = await factory.marketCount();
  console.log("Current market count:", marketCountBefore.toString());

  // Create the market
  console.log("\n--- Creating Market ---");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Fee Strategy:", Object.keys(FeeStrategy)[feeStrategy]);

  const tx = await factory.createMarket(name, symbol, feeStrategy);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Market created in block:", receipt.blockNumber);

  // Parse the MarketCreated event
  const marketCreatedEvent = receipt.logs.find(log => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed && parsed.name === "MarketCreated";
    } catch {
      return false;
    }
  });

  let poolAddress, tokenAddress, nftId;

  if (marketCreatedEvent) {
    const parsed = factory.interface.parseLog(marketCreatedEvent);
    poolAddress = parsed.args.pool;
    tokenAddress = parsed.args.token;
    nftId = parsed.args.nftId;
  } else {
    // Fallback: get from contract state
    const marketCountAfter = await factory.marketCount();
    nftId = marketCountAfter;
    poolAddress = await factory.nftToPool(nftId);
    // Token address would need to be fetched differently
  }

  console.log("\n========================================");
  console.log("Market Created Successfully!");
  console.log("========================================\n");
  console.log("Pool Address:  ", poolAddress);
  console.log("Token Address: ", tokenAddress);
  console.log("NFT ID:        ", nftId.toString());
  console.log("\n");

  // Save market info to file
  const marketsFile = "./markets.json";
  let markets = [];
  if (fs.existsSync(marketsFile)) {
    markets = JSON.parse(fs.readFileSync(marketsFile, "utf8"));
  }

  markets.push({
    name,
    symbol,
    pool: poolAddress,
    token: tokenAddress,
    nftId: nftId.toString(),
    feeStrategy: Object.keys(FeeStrategy)[feeStrategy],
    creator: creator.address,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(marketsFile, JSON.stringify(markets, null, 2));
  console.log("Market info saved to markets.json");

  return { pool: poolAddress, token: tokenAddress, nftId };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log("\nUsage: npx hardhat run scripts/createMarket.js --network <network> -- <name> <symbol> [feeStrategy]");
    console.log("\nFee Strategies:");
    console.log("  0 = CLAIM    (direct claim to wallet)");
    console.log("  1 = BURN     (burn USID)");
    console.log("  2 = AIRDROP  (accumulate for community airdrop)");
    console.log("  3 = COMPOUND (compound back into pool)");
    console.log("\nExample:");
    console.log('  npx hardhat run scripts/createMarket.js --network paxeer-network -- "Bitcoin" "BTC" 0');
    console.log('  npx hardhat run scripts/createMarket.js --network paxeer-network -- "Ethereum" "ETH" 1');
    
    // Default example market for testing
    console.log("\n--- Running with example market ---");
    await createMarket("Test Market", "TEST", FeeStrategy.CLAIM);
    return;
  }

  const name = args[0];
  const symbol = args[1];
  const feeStrategy = args[2] ? parseInt(args[2]) : FeeStrategy.CLAIM;

  if (feeStrategy < 0 || feeStrategy > 3) {
    console.error("Invalid fee strategy. Must be 0-3.");
    process.exit(1);
  }

  await createMarket(name, symbol, feeStrategy);
}

// Export for use as module
module.exports = { createMarket, FeeStrategy };

// Run if called directly (not via require)
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
