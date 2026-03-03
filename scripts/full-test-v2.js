const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const USID_ADDR = "0x6C32c255EeBD6A72B56ee82454d7140020919652";
  const usid = new ethers.Contract(USID_ADDR, [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], deployer);
  
  // Deploy MockCaller
  console.log("\n1. Deploying MockCaller...");
  const MockCaller = await ethers.getContractFactory("MockCaller");
  const mockCaller = await MockCaller.deploy();
  await mockCaller.waitForDeployment();
  const mockCallerAddr = await mockCaller.getAddress();
  console.log("MockCaller:", mockCallerAddr);
  
  // Deploy FeeCollector
  console.log("\n2. Deploying FeeCollector...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const fc = await FeeCollector.deploy(USID_ADDR);
  await fc.waitForDeployment();
  const fcAddr = await fc.getAddress();
  console.log("FeeCollector:", fcAddr);
  
  // Set MockCaller as marketNFT
  console.log("\n3. Setting up FeeCollector (marketNFT = MockCaller)...");
  await (await fc.setFactory(deployer.address, mockCallerAddr, deployer.address)).wait();
  console.log("fc.marketNFT():", await fc.marketNFT());
  
  // Fund FeeCollector with USID
  console.log("\n4. Funding FeeCollector with USID...");
  const deployerBal = await usid.balanceOf(deployer.address);
  console.log("Deployer USID balance:", ethers.formatEther(deployerBal));
  
  if (deployerBal > 0n) {
    const amount = ethers.parseEther("100");
    await (await usid.transfer(fcAddr, amount)).wait();
    console.log("Transferred 100 USID to FeeCollector");
  } else {
    console.log("WARNING: Deployer has no USID!");
  }
  
  console.log("FeeCollector USID balance:", ethers.formatEther(await usid.balanceOf(fcAddr)));
  
  // Add fees to accounting
  console.log("\n5. Adding fees to accounting...");
  await (await fc.accumulateFee(1, ethers.parseEther("10"))).wait();
  console.log("Pending fees for NFT 1:", ethers.formatEther(await fc.pendingFees(1)));
  
  // Try distributeFees
  console.log("\n6. MockCaller calling distributeFees...");
  try {
    const tx = await mockCaller.callDistributeFees(fcAddr, 1, deployer.address, 0);
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    console.log("Deployer USID after:", ethers.formatEther(await usid.balanceOf(deployer.address)));
  } catch (error) {
    console.log("FAILED!");
    console.log("Error:", error.message);
    if (error.data) console.log("Error data:", error.data);
    
    // Try to decode
    const errSig = error.data?.slice(0, 10);
    console.log("Error signature:", errSig);
    if (errSig === "0x82b42900") console.log("-> Unauthorized()");
    if (errSig === "0x211b6317") console.log("-> NoFeesToClaim()");
  }
}

main().catch(console.error);
