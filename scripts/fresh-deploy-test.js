const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const USID_ADDR = "0x6C32c255EeBD6A72B56ee82454d7140020919652";
  const usid = new ethers.Contract(USID_ADDR, [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], deployer);

  // Deploy fresh MarketNFT
  console.log("\n1. Deploying fresh MarketNFT...");
  const MarketNFT = await ethers.getContractFactory("MarketNFT");
  const marketNFT = await MarketNFT.deploy();
  await marketNFT.waitForDeployment();
  const nftAddr = await marketNFT.getAddress();
  console.log("MarketNFT:", nftAddr);

  // Deploy fresh FeeCollector
  console.log("\n2. Deploying fresh FeeCollector...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const fc = await FeeCollector.deploy(USID_ADDR);
  await fc.waitForDeployment();
  const fcAddr = await fc.getAddress();
  console.log("FeeCollector:", fcAddr);

  // Set up MarketNFT (deployer as factory for testing)
  console.log("\n3. Setting up MarketNFT...");
  await (await marketNFT.setFactory(deployer.address, fcAddr, deployer.address)).wait();
  console.log("MarketNFT.feeCollector():", await marketNFT.feeCollector());

  // Set up FeeCollector
  console.log("\n4. Setting up FeeCollector...");
  await (await fc.setFactory(deployer.address, nftAddr, deployer.address)).wait();
  console.log("FeeCollector.marketNFT():", await fc.marketNFT());

  // Mint an NFT to deployer (simulating factory)
  console.log("\n5. Minting NFT to deployer...");
  await (await marketNFT.mint(deployer.address, deployer.address, 0)).wait();
  const tokenId = await marketNFT.totalMinted();
  console.log("Minted NFT ID:", tokenId.toString());
  console.log("Owner:", await marketNFT.ownerOf(tokenId));

  // Fund FeeCollector with USID
  console.log("\n6. Funding FeeCollector with USID...");
  await (await usid.transfer(fcAddr, ethers.parseEther("1000"))).wait();
  console.log("FeeCollector USID balance:", ethers.formatEther(await usid.balanceOf(fcAddr)));

  // Add fees via accumulateFee
  console.log("\n7. Adding fees...");
  await (await fc.accumulateFee(tokenId, ethers.parseEther("100"))).wait();
  console.log("Pending fees:", ethers.formatEther(await fc.pendingFees(tokenId)));

  // Try to claim
  console.log("\n8. Attempting claimFees...");
  const balBefore = await usid.balanceOf(deployer.address);
  
  try {
    const tx = await marketNFT.claimFees(tokenId);
    const receipt = await tx.wait();
    console.log("SUCCESS!");
    console.log("Gas used:", receipt.gasUsed.toString());
    
    const balAfter = await usid.balanceOf(deployer.address);
    console.log("USID received:", ethers.formatEther(balAfter - balBefore));
    console.log("Pending fees after:", ethers.formatEther(await fc.pendingFees(tokenId)));
  } catch (error) {
    console.log("FAILED!");
    console.log("Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
      if (error.data === "0x82b42900") console.log("  -> Unauthorized()");
    }
  }
}

main().catch(console.error);
