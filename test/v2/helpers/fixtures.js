const { ethers } = require("hardhat");

async function deployV2ProtocolFixture() {
  const [deployer, creator, user1, user2, user3] = await ethers.getSigners();

  // Phase 1: Admin infrastructure
  const AdminController = await ethers.getContractFactory("AdminController");
  const adminController = await AdminController.deploy(
    deployer.address,
    3600 // 1 hour timelock
  );
  await adminController.waitForDeployment();

  // Grant OPERATOR role to deployer for setup
  await adminController.grantRole(deployer.address, 2); // Role.OPERATOR = would be redundant, deployer is ADMIN

  // Phase 2: Mock stablecoins (simulating 4 network stablecoins)
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usid = await MockERC20.deploy("USID Stablecoin", "USID", 18);
  await usid.waitForDeployment();
  const usdt = await MockERC20.deploy("Tether USD", "USDT", 18);
  await usdt.waitForDeployment();
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 18);
  await usdc.waitForDeployment();
  const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
  await dai.waitForDeployment();

  // Phase 3: StablecoinRegistry
  const StablecoinRegistry = await ethers.getContractFactory("StablecoinRegistry");
  const stablecoinRegistry = await StablecoinRegistry.deploy(
    await adminController.getAddress(),
    [
      await usid.getAddress(),
      await usdt.getAddress(),
      await usdc.getAddress(),
      await dai.getAddress()
    ]
  );
  await stablecoinRegistry.waitForDeployment();

  // Phase 4: EventEmitterV2
  const EventEmitterV2 = await ethers.getContractFactory("EventEmitterV2");
  const eventEmitter = await EventEmitterV2.deploy(await adminController.getAddress());
  await eventEmitter.waitForDeployment();

  // Phase 5: MarketNFTV2
  const MarketNFTV2 = await ethers.getContractFactory("MarketNFTV2");
  const marketNFT = await MarketNFTV2.deploy(await adminController.getAddress());
  await marketNFT.waitForDeployment();

  // Phase 6: FeeCollectorV2
  const FeeCollectorV2 = await ethers.getContractFactory("FeeCollectorV2");
  const feeCollector = await FeeCollectorV2.deploy(await adminController.getAddress());
  await feeCollector.waitForDeployment();

  // Phase 7: FactoryV2
  const HLPMMFactoryV2 = await ethers.getContractFactory("HLPMMFactoryV2");
  const factory = await HLPMMFactoryV2.deploy(
    await adminController.getAddress(),
    await stablecoinRegistry.getAddress(),
    await eventEmitter.getAddress(),
    await marketNFT.getAddress(),
    await feeCollector.getAddress()
  );
  await factory.waitForDeployment();

  // Phase 8: Wire permissions
  await eventEmitter.setFactory(await factory.getAddress());
  // Authorize factory, marketNFT, feeCollector as emitters
  await eventEmitter.authorizeEmitter(await factory.getAddress());
  await eventEmitter.authorizeEmitter(await marketNFT.getAddress());
  await eventEmitter.authorizeEmitter(await feeCollector.getAddress());

  await marketNFT.setProtocolAddresses(
    await factory.getAddress(),
    await feeCollector.getAddress(),
    await eventEmitter.getAddress()
  );

  await feeCollector.setProtocolAddresses(
    await factory.getAddress(),
    await marketNFT.getAddress(),
    await eventEmitter.getAddress(),
    await stablecoinRegistry.getAddress()
  );

  // Phase 9: Periphery
  const HLPMMQuoterV2 = await ethers.getContractFactory("HLPMMQuoterV2");
  const quoter = await HLPMMQuoterV2.deploy(await factory.getAddress());
  await quoter.waitForDeployment();

  const HLPMMRouterV2 = await ethers.getContractFactory("HLPMMRouterV2");
  const router = await HLPMMRouterV2.deploy(
    await factory.getAddress(),
    await stablecoinRegistry.getAddress()
  );
  await router.waitForDeployment();

  // Mint stablecoins to test users
  const mintAmount = ethers.parseEther("1000000"); // 1M each
  for (const user of [deployer, creator, user1, user2, user3]) {
    await usid.mint(user.address, mintAmount);
    await usdt.mint(user.address, mintAmount);
    await usdc.mint(user.address, mintAmount);
    await dai.mint(user.address, mintAmount);
  }

  return {
    adminController,
    stablecoinRegistry,
    eventEmitter,
    marketNFT,
    feeCollector,
    factory,
    quoter,
    router,
    usid, usdt, usdc, dai,
    deployer, creator, user1, user2, user3
  };
}

async function deployV2WithMarketFixture() {
  const protocol = await deployV2ProtocolFixture();

  // Create a market
  const tx = await protocol.factory.connect(protocol.creator).createMarket(
    "Test Token",
    "TEST",
    '{"description":"A test token","image":"https://example.com/test.png"}',
    0 // FeeStrategy.CLAIM
  );
  const receipt = await tx.wait();

  const marketCreatedEvent = receipt.logs.find(
    log => log.fragment && log.fragment.name === "MarketCreated"
  );

  const poolAddress = marketCreatedEvent.args[0];
  const tokenAddress = marketCreatedEvent.args[1];
  const nftId = marketCreatedEvent.args[2];

  const pool = await ethers.getContractAt("HLPMMPoolV2", poolAddress);
  const token = await ethers.getContractAt("HLPMMTokenV2", tokenAddress);

  return {
    ...protocol,
    pool,
    token,
    nftId,
    poolAddress,
    tokenAddress
  };
}

module.exports = {
  deployV2ProtocolFixture,
  deployV2WithMarketFixture
};
