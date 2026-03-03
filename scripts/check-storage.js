const { ethers } = require("hardhat");

async function main() {
  const feeCollectorAddr = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  
  // Storage layout for FeeCollector:
  // slot 0: factory (address)
  // slot 1: usid (address)  
  // slot 2: marketNFT (address)
  // slot 3: eventEmitter (address)
  // _deployer is immutable (in bytecode, not storage)
  
  console.log("=== FeeCollector Storage ===\n");
  
  for (let i = 0; i <= 3; i++) {
    const slot = await ethers.provider.getStorage(feeCollectorAddr, i);
    const addr = "0x" + slot.slice(26); // Extract address from 32-byte slot
    console.log(`Slot ${i}: ${slot}`);
    console.log(`  -> Address: ${addr}`);
  }

  // Also get via getter for comparison
  const fc = new ethers.Contract(
    feeCollectorAddr,
    [
      "function factory() view returns (address)",
      "function usid() view returns (address)",
      "function marketNFT() view returns (address)",
      "function eventEmitter() view returns (address)"
    ],
    ethers.provider
  );

  console.log("\n=== Via Getters ===");
  console.log("factory():", await fc.factory());
  console.log("usid():", await fc.usid());
  console.log("marketNFT():", await fc.marketNFT());
  console.log("eventEmitter():", await fc.eventEmitter());

  // Check MarketNFT code at the address
  const marketNFTAddr = "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08";
  const code = await ethers.provider.getCode(marketNFTAddr);
  console.log("\n=== MarketNFT Code ===");
  console.log("Has code:", code.length > 2);
  console.log("Code length:", (code.length - 2) / 2, "bytes");
}

main().catch(console.error);
