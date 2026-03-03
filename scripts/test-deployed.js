const { ethers } = require("hardhat");

const DEPLOYED = {
  PaxPriceOracle: "0xd0079A1dF72b462e183a4f00528aFb10d55672Bd",
  USID: "0x035a308719A91047BcA94D2738c0e1C05516ad4C",
  EventEmitter: "0x156EA65069705c858d0C96cdF8a4A0037e707997",
  MarketNFT: "0x6408681CabAd5AC1cb7d5ACF41275bDbeeE3EB45",
  FeeCollector: "0xe8ab6e7133832f30871C7eb7E04bf48104ED562e",
  Factory: "0xD6B196772eF1f04e41E1f5Ff934687ED55A8C12F",
  Quoter: "0x5Ad8Bc93061D8560eaE127B9802CE2E5Cc8a4F4b",
  Router: "0xE61C9d6Ec9710f6c38166ca8d20428EBa8dB9007"
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing with account:", signer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(signer.address)).toString());
  console.log("\n========================================");
  console.log("Testing Deployed HLPMM Protocol");
  console.log("========================================\n");

  // Get contract instances
  const usid = await ethers.getContractAt("USID", DEPLOYED.USID);
  const eventEmitter = await ethers.getContractAt("EventEmitter", DEPLOYED.EventEmitter);
  const marketNFT = await ethers.getContractAt("MarketNFT", DEPLOYED.MarketNFT);
  const feeCollector = await ethers.getContractAt("FeeCollector", DEPLOYED.FeeCollector);
  const factory = await ethers.getContractAt("HLPMMFactory", DEPLOYED.Factory);
  const quoter = await ethers.getContractAt("HLPMMQuoter", DEPLOYED.Quoter);
  const router = await ethers.getContractAt("HLPMMRouter", DEPLOYED.Router);

  let passed = 0;
  let failed = 0;

  // Helper function
  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  // === USID Tests ===
  console.log("\n--- USID Tests ---");
  await test("USID name is correct", async () => {
    const name = await usid.name();
    if (name !== "USID Stablecoin") throw new Error(`Expected "USID Stablecoin", got "${name}"`);
  });

  await test("USID factory is set", async () => {
    const factoryAddr = await usid.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("USID oracle is set", async () => {
    const oracleAddr = await usid.oracle();
    if (oracleAddr !== DEPLOYED.PaxPriceOracle) throw new Error(`Oracle mismatch`);
  });

  // === EventEmitter Tests ===
  console.log("\n--- EventEmitter Tests ---");
  await test("EventEmitter factory is set", async () => {
    const factoryAddr = await eventEmitter.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("Factory is authorized emitter", async () => {
    const isAuth = await eventEmitter.isAuthorizedEmitter(DEPLOYED.Factory);
    if (!isAuth) throw new Error(`Factory not authorized`);
  });

  await test("MarketNFT is authorized emitter", async () => {
    const isAuth = await eventEmitter.isAuthorizedEmitter(DEPLOYED.MarketNFT);
    if (!isAuth) throw new Error(`MarketNFT not authorized`);
  });

  await test("FeeCollector is authorized emitter", async () => {
    const isAuth = await eventEmitter.isAuthorizedEmitter(DEPLOYED.FeeCollector);
    if (!isAuth) throw new Error(`FeeCollector not authorized`);
  });

  // === MarketNFT Tests ===
  console.log("\n--- MarketNFT Tests ---");
  await test("MarketNFT name is correct", async () => {
    const name = await marketNFT.name();
    if (name !== "HLPMM Market Position") throw new Error(`Expected "HLPMM Market Position", got "${name}"`);
  });

  await test("MarketNFT factory is set", async () => {
    const factoryAddr = await marketNFT.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("MarketNFT feeCollector is set", async () => {
    const fcAddr = await marketNFT.feeCollector();
    if (fcAddr !== DEPLOYED.FeeCollector) throw new Error(`FeeCollector mismatch`);
  });

  // === FeeCollector Tests ===
  console.log("\n--- FeeCollector Tests ---");
  await test("FeeCollector usid is set", async () => {
    const usidAddr = await feeCollector.usid();
    if (usidAddr !== DEPLOYED.USID) throw new Error(`USID mismatch`);
  });

  await test("FeeCollector factory is set", async () => {
    const factoryAddr = await feeCollector.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("FeeCollector marketNFT is set", async () => {
    const nftAddr = await feeCollector.marketNFT();
    if (nftAddr !== DEPLOYED.MarketNFT) throw new Error(`MarketNFT mismatch`);
  });

  await test("FeeCollector eventEmitter is set", async () => {
    const eeAddr = await feeCollector.eventEmitter();
    if (eeAddr !== DEPLOYED.EventEmitter) throw new Error(`EventEmitter mismatch`);
  });

  // === Factory Tests ===
  console.log("\n--- Factory Tests ---");
  await test("Factory usid is set", async () => {
    const usidAddr = await factory.usid();
    if (usidAddr !== DEPLOYED.USID) throw new Error(`USID mismatch`);
  });

  await test("Factory eventEmitter is set", async () => {
    const eeAddr = await factory.eventEmitter();
    if (eeAddr !== DEPLOYED.EventEmitter) throw new Error(`EventEmitter mismatch`);
  });

  // === Quoter Tests ===
  console.log("\n--- Quoter Tests ---");
  await test("Quoter factory is set", async () => {
    const factoryAddr = await quoter.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("Quoter usid is set", async () => {
    const usidAddr = await quoter.usid();
    if (usidAddr !== DEPLOYED.USID) throw new Error(`USID mismatch`);
  });

  // === Router Tests ===
  console.log("\n--- Router Tests ---");
  await test("Router factory is set", async () => {
    const factoryAddr = await router.factory();
    if (factoryAddr !== DEPLOYED.Factory) throw new Error(`Factory mismatch`);
  });

  await test("Router usid is set", async () => {
    const usidAddr = await router.usid();
    if (usidAddr !== DEPLOYED.USID) throw new Error(`USID mismatch`);
  });

  // === Admin Functions Tests ===
  // NOTE: These tests only work if contracts were deployed with admin functions
  // The current deployment was made before admin functions were added
  console.log("\n--- Admin Functions Tests ---");

  await test("Can call adminAuthorizeEmitter (EventEmitter)", async () => {
    // Test by authorizing a random address, then revoking
    const testAddr = "0x0000000000000000000000000000000000000001";
    await eventEmitter.adminAuthorizeEmitter(testAddr);
    const isAuth = await eventEmitter.isAuthorizedEmitter(testAddr);
    if (!isAuth) throw new Error(`Failed to authorize`);
    await eventEmitter.adminRevokeEmitter(testAddr);
    const isAuthAfter = await eventEmitter.isAuthorizedEmitter(testAddr);
    if (isAuthAfter) throw new Error(`Failed to revoke`);
  });

  // === Summary ===
  console.log("\n========================================");
  console.log(`Tests Complete: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
