const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  
  const MARKET_NFT = "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08";
  const FEE_COLLECTOR = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  
  const marketNFT = new ethers.Contract(MARKET_NFT, [
    "function claimFees(uint256) returns (uint256)",
    "function feeCollector() view returns (address)"
  ], signer);

  const feeCollector = new ethers.Contract(FEE_COLLECTOR, [
    "function distributeFees(uint256,address,uint8) returns (uint256)",
    "function marketNFT() view returns (address)",
    "function pendingFees(uint256) view returns (uint256)"
  ], signer);

  console.log("=== Current State ===");
  console.log("MarketNFT.feeCollector():", await marketNFT.feeCollector());
  console.log("FeeCollector.marketNFT():", await feeCollector.marketNFT());
  console.log("Pending fees NFT 2:", ethers.formatEther(await feeCollector.pendingFees(2)));

  // Try staticCall to get error data
  console.log("\n=== Testing claimFees with staticCall ===");
  try {
    const result = await marketNFT.claimFees.staticCall(2);
    console.log("staticCall SUCCESS, would return:", result);
  } catch (error) {
    console.log("staticCall FAILED");
    console.log("Error message:", error.message);
    console.log("Error code:", error.code);
    if (error.data) console.log("Error data:", error.data);
    if (error.reason) console.log("Error reason:", error.reason);
    if (error.revert) console.log("Revert:", error.revert);
  }

  // Try low-level call to see raw error
  console.log("\n=== Testing with low-level eth_call ===");
  const calldata = marketNFT.interface.encodeFunctionData("claimFees", [2]);
  try {
    const result = await ethers.provider.call({
      to: MARKET_NFT,
      data: calldata,
      from: signer.address
    });
    console.log("Raw result:", result);
  } catch (error) {
    console.log("Raw call FAILED");
    console.log("Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
      // Decode known errors
      if (error.data === "0x82b42900") console.log("  -> Unauthorized()");
      else if (error.data === "0x211b6317") console.log("  -> NoFeesToClaim()"); 
      else if (error.data === "0xdb1453ce") console.log("  -> NotOwnerOrApproved()");
    }
  }

  // Test calling distributeFees directly from MarketNFT address
  console.log("\n=== Testing distributeFees call from MarketNFT address ===");
  const distData = feeCollector.interface.encodeFunctionData("distributeFees", [2, signer.address, 0]);
  try {
    const result = await ethers.provider.call({
      to: FEE_COLLECTOR,
      data: distData,
      from: MARKET_NFT  // Simulate from MarketNFT
    });
    console.log("Raw result:", result);
  } catch (error) {
    console.log("FAILED from MarketNFT address");
    if (error.data) {
      console.log("Error data:", error.data);
      if (error.data === "0x82b42900") console.log("  -> Unauthorized() - msg.sender != marketNFT check failed!");
    }
  }
}

main().catch(console.error);
