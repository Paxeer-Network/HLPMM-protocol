const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv/config");

/**
 * HLPMM V2 Protocol Deployment Script
 * 
 * Deployment order:
 * 1. AdminController (foundation for all admin ops)
 * 2. StablecoinRegistry (with 4 approved stablecoins)
 * 3. EventEmitterV2
 * 4. MarketNFTV2
 * 5. FeeCollectorV2
 * 6. HLPMMFactoryV2
 * 7. HLPMMQuoterV2
 * 8. HLPMMRouterV2
 * 9. Wire permissions
 * 
 * Requires .env:
 *   PRIVATE_KEY - deployer private key
 *   STABLE_1 through STABLE_4 - addresses of 4 approved stablecoins
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying HLPMM V2 with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "PAX");
  console.log("─".repeat(60));

  const deployedAddresses = {};

  // ─── 1. AdminController ────────────────────────────────────────────
  console.log("\n[1/8] Deploying AdminController...");
  const AdminController = await ethers.getContractFactory("AdminController");
  const adminController = await AdminController.deploy(
    deployer.address,
    3600 // 1 hour initial timelock
  );
  await adminController.waitForDeployment();
  deployedAddresses.adminController = await adminController.getAddress();
  console.log("  AdminController:", deployedAddresses.adminController);

  // ─── 2. StablecoinRegistry ─────────────────────────────────────────
  console.log("\n[2/8] Deploying StablecoinRegistry...");
  
  // Get stablecoin addresses from env or use defaults
  const stablecoins = [
    process.env.STABLE_1 || process.env.V1_HLPMM_USID,
    process.env.STABLE_2 || "",
    process.env.STABLE_3 || "",
    process.env.STABLE_4 || ""
  ].filter(addr => addr && addr.length === 42);

  if (stablecoins.length === 0) {
    console.error("ERROR: No stablecoin addresses configured. Set STABLE_1..STABLE_4 in .env");
    process.exit(1);
  }
  console.log("  Approved stablecoins:", stablecoins.length);
  stablecoins.forEach((s, i) => console.log(`    STABLE_${i+1}: ${s}`));

  const StablecoinRegistry = await ethers.getContractFactory("StablecoinRegistry");
  const stablecoinRegistry = await StablecoinRegistry.deploy(
    deployedAddresses.adminController,
    stablecoins
  );
  await stablecoinRegistry.waitForDeployment();
  deployedAddresses.stablecoinRegistry = await stablecoinRegistry.getAddress();
  console.log("  StablecoinRegistry:", deployedAddresses.stablecoinRegistry);

  // ─── 3. EventEmitterV2 ─────────────────────────────────────────────
  console.log("\n[3/8] Deploying EventEmitterV2...");
  const EventEmitterV2 = await ethers.getContractFactory("EventEmitterV2");
  const eventEmitter = await EventEmitterV2.deploy(deployedAddresses.adminController);
  await eventEmitter.waitForDeployment();
  deployedAddresses.eventEmitter = await eventEmitter.getAddress();
  console.log("  EventEmitterV2:", deployedAddresses.eventEmitter);

  // ─── 4. MarketNFTV2 ────────────────────────────────────────────────
  console.log("\n[4/8] Deploying MarketNFTV2...");
  const MarketNFTV2 = await ethers.getContractFactory("MarketNFTV2");
  const marketNFT = await MarketNFTV2.deploy(deployedAddresses.adminController);
  await marketNFT.waitForDeployment();
  deployedAddresses.marketNFT = await marketNFT.getAddress();
  console.log("  MarketNFTV2:", deployedAddresses.marketNFT);

  // ─── 5. FeeCollectorV2 ─────────────────────────────────────────────
  console.log("\n[5/8] Deploying FeeCollectorV2...");
  const FeeCollectorV2 = await ethers.getContractFactory("FeeCollectorV2");
  const feeCollector = await FeeCollectorV2.deploy(deployedAddresses.adminController);
  await feeCollector.waitForDeployment();
  deployedAddresses.feeCollector = await feeCollector.getAddress();
  console.log("  FeeCollectorV2:", deployedAddresses.feeCollector);

  // ─── 6. HLPMMFactoryV2 ─────────────────────────────────────────────
  console.log("\n[6/8] Deploying HLPMMFactoryV2...");
  const HLPMMFactoryV2 = await ethers.getContractFactory("HLPMMFactoryV2");
  const factory = await HLPMMFactoryV2.deploy(
    deployedAddresses.adminController,
    deployedAddresses.stablecoinRegistry,
    deployedAddresses.eventEmitter,
    deployedAddresses.marketNFT,
    deployedAddresses.feeCollector
  );
  await factory.waitForDeployment();
  deployedAddresses.factory = await factory.getAddress();
  console.log("  HLPMMFactoryV2:", deployedAddresses.factory);

  // ─── 7. HLPMMQuoterV2 ──────────────────────────────────────────────
  console.log("\n[7/8] Deploying HLPMMQuoterV2...");
  const HLPMMQuoterV2 = await ethers.getContractFactory("HLPMMQuoterV2");
  const quoter = await HLPMMQuoterV2.deploy(deployedAddresses.factory);
  await quoter.waitForDeployment();
  deployedAddresses.quoter = await quoter.getAddress();
  console.log("  HLPMMQuoterV2:", deployedAddresses.quoter);

  // ─── 8. HLPMMRouterV2 ──────────────────────────────────────────────
  console.log("\n[8/8] Deploying HLPMMRouterV2...");
  const HLPMMRouterV2 = await ethers.getContractFactory("HLPMMRouterV2");
  const router = await HLPMMRouterV2.deploy(
    deployedAddresses.factory,
    deployedAddresses.stablecoinRegistry
  );
  await router.waitForDeployment();
  deployedAddresses.router = await router.getAddress();
  console.log("  HLPMMRouterV2:", deployedAddresses.router);

  // ─── 9. Wire permissions ───────────────────────────────────────────
  console.log("\n[WIRING] Setting up permissions...");

  console.log("  Setting factory on EventEmitter...");
  await eventEmitter.setFactory(deployedAddresses.factory);

  console.log("  Authorizing emitters (factory, marketNFT, feeCollector)...");
  await eventEmitter.authorizeEmitter(deployedAddresses.factory);
  await eventEmitter.authorizeEmitter(deployedAddresses.marketNFT);
  await eventEmitter.authorizeEmitter(deployedAddresses.feeCollector);

  console.log("  Setting protocol addresses on MarketNFTV2...");
  await marketNFT.setProtocolAddresses(
    deployedAddresses.factory,
    deployedAddresses.feeCollector,
    deployedAddresses.eventEmitter
  );

  console.log("  Setting protocol addresses on FeeCollectorV2...");
  await feeCollector.setProtocolAddresses(
    deployedAddresses.factory,
    deployedAddresses.marketNFT,
    deployedAddresses.eventEmitter,
    deployedAddresses.stablecoinRegistry
  );

  console.log("  ✅ All permissions wired.");

  // ─── Save deployment ───────────────────────────────────────────────
  const deployment = {
    version: "2.0.0",
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedAddresses,
    stablecoins: stablecoins
  };

  fs.writeFileSync(
    "deployments-v2.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n" + "═".repeat(60));
  console.log("HLPMM V2 DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log("\nContracts deployed:");
  Object.entries(deployedAddresses).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(22)} ${addr}`);
  });
  console.log("\nDeployment saved to: deployments-v2.json");
  console.log("═".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
