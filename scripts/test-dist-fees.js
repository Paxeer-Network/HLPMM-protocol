const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Deploy fresh FeeCollector to test
  const USID_ADDR = "0x6C32c255EeBD6A72B56ee82454d7140020919652";
  const MARKET_NFT = "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08";
  const FACTORY = "0xEF283FF45379e2d47Ce8db0C613125072c1A1c58";
  const EVENT_EMITTER = "0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6";
  
  console.log("Deploying fresh FeeCollector for testing...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const fc = await FeeCollector.deploy(USID_ADDR);
  await fc.waitForDeployment();
  const fcAddr = await fc.getAddress();
  console.log("New FeeCollector:", fcAddr);
  
  // Set factory
  console.log("\nCalling setFactory...");
  const tx = await fc.setFactory(FACTORY, MARKET_NFT, EVENT_EMITTER);
  await tx.wait();
  
  // Verify
  console.log("\nVerifying setup:");
  console.log("fc.marketNFT():", await fc.marketNFT());
  console.log("Expected:", MARKET_NFT);
  console.log("Match:", (await fc.marketNFT()).toLowerCase() === MARKET_NFT.toLowerCase());
  
  // Now try calling distributeFees from MarketNFT address (simulated)
  console.log("\n=== Testing distributeFees ===");
  
  // First, let's add some fees so there's something to distribute
  // accumulateFee is onlyPool modifier which just checks msg.sender != address(0)
  console.log("Adding test fees...");
  await fc.accumulateFee(2, ethers.parseEther("100"));
  console.log("Pending fees for NFT 2:", ethers.formatEther(await fc.pendingFees(2)));
  
  // Try simulated call from MarketNFT
  const distFeesData = fc.interface.encodeFunctionData("distributeFees", [2, signer.address, 0]);
  
  console.log("\nSimulating call from MarketNFT address...");
  try {
    const result = await ethers.provider.call({
      to: fcAddr,
      data: distFeesData,
      from: MARKET_NFT
    });
    console.log("SUCCESS! Result:", result);
  } catch (error) {
    console.log("FAILED:", error.message);
  }
  
  // Try from signer (should fail)
  console.log("\nSimulating call from signer (should fail)...");
  try {
    const result = await ethers.provider.call({
      to: fcAddr,
      data: distFeesData,
      from: signer.address
    });
    console.log("SUCCESS (unexpected):", result);
  } catch (error) {
    console.log("FAILED as expected");
  }
}

main().catch(console.error);
