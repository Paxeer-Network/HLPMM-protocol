const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  
  if (!signers || signers.length === 0) {
    console.error("❌ ERROR: No signers available. Please set PRIVATE_KEY in your .env file.");
    console.error("   Example: PRIVATE_KEY=0x...");
    process.exit(1);
  }
  
  const [deployer] = signers;
  console.log("Deploying HLPMM Protocol with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const deployedAddresses = {};

  // ============================================
  // Phase 1: Base Layer (no dependencies)
  // ============================================
  console.log("\n--- Phase 1: Base Layer ---");

  // 1. Deploy USID
  console.log("Deploying USID...");
  const USID = await ethers.getContractFactory("USID");
  const usid = await USID.deploy();
  await usid.waitForDeployment();
  deployedAddresses.usid = await usid.getAddress();
  console.log("USID deployed to:", deployedAddresses.usid);

  // 2. Deploy EventEmitter
  console.log("Deploying EventEmitter...");
  const EventEmitter = await ethers.getContractFactory("EventEmitter");
  const eventEmitter = await EventEmitter.deploy();
  await eventEmitter.waitForDeployment();
  deployedAddresses.eventEmitter = await eventEmitter.getAddress();
  console.log("EventEmitter deployed to:", deployedAddresses.eventEmitter);

  // ============================================
  // Phase 2: Core Infrastructure
  // ============================================
  console.log("\n--- Phase 2: Core Infrastructure ---");

  // 3. Deploy MarketNFT
  console.log("Deploying MarketNFT...");
  const MarketNFT = await ethers.getContractFactory("MarketNFT");
  const marketNFT = await MarketNFT.deploy();
  await marketNFT.waitForDeployment();
  deployedAddresses.marketNFT = await marketNFT.getAddress();
  console.log("MarketNFT deployed to:", deployedAddresses.marketNFT);

  // 4. Deploy FeeCollector
  console.log("Deploying FeeCollector...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(deployedAddresses.usid);
  await feeCollector.waitForDeployment();
  deployedAddresses.feeCollector = await feeCollector.getAddress();
  console.log("FeeCollector deployed to:", deployedAddresses.feeCollector);

  // 5. Deploy HLPMMFactory
  console.log("Deploying HLPMMFactory...");
  const HLPMMFactory = await ethers.getContractFactory("HLPMMFactory");
  const factory = await HLPMMFactory.deploy(
    deployedAddresses.usid,
    deployedAddresses.eventEmitter,
    deployedAddresses.marketNFT,
    deployedAddresses.feeCollector
  );
  await factory.waitForDeployment();
  deployedAddresses.factory = await factory.getAddress();
  console.log("HLPMMFactory deployed to:", deployedAddresses.factory);

  // ============================================
  // Wire up permissions
  // ============================================
  console.log("\n--- Wiring Permissions ---");

  // Set factory on USID
  console.log("Setting factory on USID...");
  const usidContract = await ethers.getContractAt("USID", deployedAddresses.usid);
  await usidContract.setFactory(deployedAddresses.factory);
  console.log("USID factory set");

  // Set factory on EventEmitter
  console.log("Setting factory on EventEmitter...");
  const eventEmitterContract = await ethers.getContractAt("EventEmitter", deployedAddresses.eventEmitter);
  await eventEmitterContract.setFactory(deployedAddresses.factory, deployedAddresses.marketNFT);
  console.log("EventEmitter factory set");

  // Set factory on MarketNFT
  console.log("Setting factory on MarketNFT...");
  const marketNFTContract = await ethers.getContractAt("MarketNFT", deployedAddresses.marketNFT);
  await marketNFTContract.setFactory(
    deployedAddresses.factory,
    deployedAddresses.feeCollector,
    deployedAddresses.eventEmitter
  );
  console.log("MarketNFT factory set");

  // Set factory on FeeCollector
  console.log("Setting factory on FeeCollector...");
  const feeCollectorContract = await ethers.getContractAt("FeeCollector", deployedAddresses.feeCollector);
  await feeCollectorContract.setFactory(
    deployedAddresses.factory,
    deployedAddresses.marketNFT,
    deployedAddresses.eventEmitter
  );
  console.log("FeeCollector factory set");

  // ============================================
  // Phase 3: Periphery
  // ============================================
  console.log("\n--- Phase 3: Periphery ---");

  // 6. Deploy HLPMMQuoter
  console.log("Deploying HLPMMQuoter...");
  const HLPMMQuoter = await ethers.getContractFactory("HLPMMQuoter");
  const quoter = await HLPMMQuoter.deploy(deployedAddresses.factory, deployedAddresses.usid);
  await quoter.waitForDeployment();
  deployedAddresses.quoter = await quoter.getAddress();
  console.log("HLPMMQuoter deployed to:", deployedAddresses.quoter);

  // 7. Deploy HLPMMRouter
  console.log("Deploying HLPMMRouter...");
  const HLPMMRouter = await ethers.getContractFactory("HLPMMRouter");
  const router = await HLPMMRouter.deploy(deployedAddresses.factory, deployedAddresses.usid);
  await router.waitForDeployment();
  deployedAddresses.router = await router.getAddress();
  console.log("HLPMMRouter deployed to:", deployedAddresses.router);

  // ============================================
  // Summary
  // ============================================
  console.log("\n========================================");
  console.log("HLPMM Protocol Deployment Complete!");
  console.log("========================================\n");
  console.log("Deployed Addresses:");
  console.log("-------------------");
  console.log("USID:          ", deployedAddresses.usid);
  console.log("EventEmitter:  ", deployedAddresses.eventEmitter);
  console.log("MarketNFT:     ", deployedAddresses.marketNFT);
  console.log("FeeCollector:  ", deployedAddresses.feeCollector);
  console.log("Factory:       ", deployedAddresses.factory);
  console.log("Quoter:        ", deployedAddresses.quoter);
  console.log("Router:        ", deployedAddresses.router);
  console.log("\n");

  // Save deployment addresses to file
  const fs = require("fs");
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedAddresses
  };

  fs.writeFileSync(
    "./deployments.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment addresses saved to deployments.json");

  return deployedAddresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
