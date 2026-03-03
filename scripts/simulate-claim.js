const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const marketNFT = new ethers.Contract(
    "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08",
    [
      "function claimFees(uint256) returns (uint256)",
      "function ownerOf(uint256) view returns (address)",
      "function feeCollector() view returns (address)"
    ],
    signer
  );

  const feeCollector = new ethers.Contract(
    "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0",
    [
      "function distributeFees(uint256, address, uint8) returns (uint256)",
      "function marketNFT() view returns (address)"
    ],
    signer
  );

  const tokenId = 2;

  // Check ownership
  const owner = await marketNFT.ownerOf(tokenId);
  console.log("NFT 2 owner:", owner);
  console.log("Signer is owner?", owner.toLowerCase() === signer.address.toLowerCase());

  // Try static call to simulate
  console.log("\n=== Simulating claimFees(2) ===");
  try {
    const result = await marketNFT.claimFees.staticCall(tokenId);
    console.log("Simulation SUCCESS! Amount:", ethers.formatEther(result));
  } catch (error) {
    console.log("Simulation FAILED!");
    console.log("Error:", error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Check if it's the Unauthorized error
    const unauthorizedSig = ethers.id("Unauthorized()").slice(0, 10);
    console.log("Unauthorized() signature:", unauthorizedSig);
  }

  // Try calling distributeFees directly from this signer (should fail)
  console.log("\n=== Direct distributeFees call (should fail) ===");
  try {
    await feeCollector.distributeFees.staticCall(tokenId, owner, 0);
    console.log("Direct call succeeded (unexpected!)");
  } catch (error) {
    console.log("Direct call failed as expected:", error.message.slice(0, 100));
  }
}

main().catch(console.error);
