const { ethers } = require("hardhat");
const axios = require("axios");
require("dotenv").config();

// Configuration
const UPDATE_INTERVAL_MS = 15000; // 15 seconds
const PRICE_API_URL = process.env.PRICE_API_URL || "https://sidiora.exchange/api/price/stats";
const PAX_PRICE_ORACLE_ADDRESS = process.env.PAX_PRICE_ORACLE_ADDRESS || "0xF94cD7F4b890A0BbeC1031C706fe2eFF293246A0";

// PaxPriceOracle ABI (only what we need)
const PAX_PRICE_ORACLE_ABI = [
  "function setFallbackPrice(uint256 _price) external",
  "function fallbackPrice() external view returns (uint256)",
  "function toggleFallbackMode(bool _useFallback) external",
  "function useFallback() external view returns (bool)",
  "function owner() external view returns (address)"
];

let lastPrice = 0n;
let updateCount = 0;
let errorCount = 0;

async function main() {
  console.log("========================================");
  console.log("   PAX Price Oracle Keeper Service");
  console.log("========================================");
  console.log(`Update interval: ${UPDATE_INTERVAL_MS / 1000} seconds`);
  console.log(`Price API: ${PRICE_API_URL}`);
  console.log(`PaxPriceOracle: ${PAX_PRICE_ORACLE_ADDRESS}`);
  console.log("========================================\n");

  const [signer] = await ethers.getSigners();
  console.log(`Keeper address: ${signer.address}`);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Keeper balance: ${ethers.formatEther(balance)} PAX\n`);

  // Initialize oracle contract
  const paxPriceOracle = new ethers.Contract(PAX_PRICE_ORACLE_ADDRESS, PAX_PRICE_ORACLE_ABI, signer);

  // Verify ownership
  const owner = await paxPriceOracle.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`❌ ERROR: Signer is not the oracle owner!`);
    console.error(`   Owner: ${owner}`);
    console.error(`   Signer: ${signer.address}`);
    process.exit(1);
  }
  console.log("✅ Signer is oracle owner\n");

  // Check if fallback mode is enabled
  const useFallback = await paxPriceOracle.useFallback();
  if (!useFallback) {
    console.log("⚠️  Fallback mode is DISABLED. Enabling...");
    try {
      const tx = await paxPriceOracle.toggleFallbackMode(true);
      await tx.wait();
      console.log("✅ Fallback mode enabled\n");
    } catch (error) {
      console.error("❌ Failed to enable fallback mode:", error.message);
      process.exit(1);
    }
  } else {
    console.log("✅ Fallback mode already enabled\n");
  }

  // Get initial price
  const currentFallback = await paxPriceOracle.fallbackPrice();
  console.log(`Current fallback price: $${ethers.formatEther(currentFallback)}\n`);

  console.log("Starting price update loop...\n");
  console.log("Press Ctrl+C to stop\n");

  // Main update loop
  while (true) {
    try {
      await updatePrice(paxPriceOracle);
    } catch (error) {
      errorCount++;
      console.error(`[${new Date().toISOString()}] ❌ Error: ${error.message}`);
      
      if (errorCount > 10) {
        console.error("Too many consecutive errors. Exiting...");
        process.exit(1);
      }
    }

    await sleep(UPDATE_INTERVAL_MS);
  }
}

async function updatePrice(paxPriceOracle) {
  // Fetch live price from Sidiora API
  const response = await axios.get(PRICE_API_URL);
  const priceData = response.data;
  
  if (!priceData || !priceData.current) {
    console.log(`[${new Date().toISOString()}] ⚠️  API returned invalid data, skipping`);
    return;
  }

  // Convert price to 18 decimals (e.g., 10.06 -> 10060000000000000000)
  const priceFloat = priceData.current;
  const livePrice = ethers.parseEther(priceFloat.toFixed(18));
  
  if (livePrice === 0n) {
    console.log(`[${new Date().toISOString()}] ⚠️  API returned 0, skipping update`);
    return;
  }

  // Only update if price changed (saves gas)
  if (livePrice === lastPrice) {
    console.log(`[${new Date().toISOString()}] Price unchanged: $${priceFloat.toFixed(4)}`);
    return;
  }

  // Calculate price change percentage
  let changePercent = 0;
  if (lastPrice > 0n) {
    const diff = livePrice > lastPrice ? livePrice - lastPrice : lastPrice - livePrice;
    changePercent = Number((diff * 10000n) / lastPrice) / 100;
  }

  const oldPrice = lastPrice > 0n ? ethers.formatEther(lastPrice) : "0";
  console.log(`[${new Date().toISOString()}] Updating price: $${oldPrice} → $${priceFloat.toFixed(4)} (${changePercent.toFixed(2)}%)`);

  // Update fallback price on-chain
  const tx = await paxPriceOracle.setFallbackPrice(livePrice);
  const receipt = await tx.wait();
  
  updateCount++;
  errorCount = 0; // Reset error count on success
  lastPrice = livePrice;

  console.log(`[${new Date().toISOString()}] ✅ Updated! Gas used: ${receipt.gasUsed.toString()} | Total updates: ${updateCount}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down keeper service...");
  console.log(`Total price updates: ${updateCount}`);
  console.log(`Total errors: ${errorCount}`);
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
