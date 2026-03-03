const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const USID_ADDR = "0x6C32c255EeBD6A72B56ee82454d7140020919652";
  
  // Deploy a mock caller contract that will call FeeCollector
  console.log("\n1. Deploying MockCaller...");
  const MockCaller = await ethers.getContractFactory("contracts/test/MockCaller.sol:MockCaller");
  
  // Check if MockCaller exists, if not create it
  let mockCaller;
  try {
    mockCaller = await MockCaller.deploy();
    await mockCaller.waitForDeployment();
  } catch (e) {
    console.log("MockCaller not found, creating it...");
    // We'll create it below
    return;
  }
  
  const mockCallerAddr = await mockCaller.getAddress();
  console.log("MockCaller deployed at:", mockCallerAddr);
  
  // Deploy FeeCollector
  console.log("\n2. Deploying FeeCollector...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const fc = await FeeCollector.deploy(USID_ADDR);
  await fc.waitForDeployment();
  const fcAddr = await fc.getAddress();
  console.log("FeeCollector deployed at:", fcAddr);
  
  // Set MockCaller as the marketNFT
  console.log("\n3. Setting up FeeCollector...");
  await (await fc.setFactory(deployer.address, mockCallerAddr, deployer.address)).wait();
  console.log("FeeCollector.marketNFT():", await fc.marketNFT());
  
  // Add fees (onlyPool allows any non-zero sender)
  console.log("\n4. Adding fees...");
  await (await fc.accumulateFee(1, ethers.parseEther("10"))).wait();
  console.log("Pending fees:", ethers.formatEther(await fc.pendingFees(1)));
  
  // Now have MockCaller call distributeFees
  console.log("\n5. MockCaller calling distributeFees...");
  try {
    const tx = await mockCaller.callDistributeFees(fcAddr, 1, deployer.address, 0);
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.log("FAILED:", error.message);
  }
}

main().catch(console.error);
