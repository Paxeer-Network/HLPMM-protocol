const { ethers } = require("hardhat");

async function main() {
  const marketNFTAddr = "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08";
  const feeCollectorAddr = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  const callerAddr = "0xf263aB36de550bDa08b52d43eB253b3C0387e2bc";
  
  // Encode claimFees(2) call
  const marketNFTIface = new ethers.Interface([
    "function claimFees(uint256 tokenId) returns (uint256)"
  ]);
  const claimFeesData = marketNFTIface.encodeFunctionData("claimFees", [2]);
  
  console.log("=== Call Data ===");
  console.log("claimFees(2) encoded:", claimFeesData);
  
  // Encode distributeFees call that MarketNFT would make
  const fcIface = new ethers.Interface([
    "function distributeFees(uint256 nftId, address recipient, uint8 strategy) returns (uint256)"
  ]);
  const owner = callerAddr; // NFT owner
  const strategy = 0; // CLAIM
  const distFeesData = fcIface.encodeFunctionData("distributeFees", [2, owner, strategy]);
  
  console.log("distributeFees encoded:", distFeesData);
  
  // Try calling distributeFees directly from MarketNFT address (simulated)
  console.log("\n=== Simulating distributeFees from MarketNFT ===");
  
  try {
    // Use eth_call with 'from' set to MarketNFT address
    const result = await ethers.provider.call({
      to: feeCollectorAddr,
      data: distFeesData,
      from: marketNFTAddr  // Simulate call FROM MarketNFT
    });
    console.log("SUCCESS! Result:", result);
  } catch (error) {
    console.log("FAILED!");
    console.log("Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
  }
  
  // Also try from a random address (should fail)
  console.log("\n=== Simulating distributeFees from random address ===");
  try {
    const result = await ethers.provider.call({
      to: feeCollectorAddr,
      data: distFeesData,
      from: callerAddr  // From user, not MarketNFT
    });
    console.log("SUCCESS (unexpected)! Result:", result);
  } catch (error) {
    console.log("FAILED as expected");
  }
}

main().catch(console.error);
