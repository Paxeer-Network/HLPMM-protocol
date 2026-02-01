const { ethers } = require("hardhat");

async function deployProtocolFixture() {
  const [deployer, creator, user1, user2, user3] = await ethers.getSigners();

  // Phase 1: Base Layer
  const USID = await ethers.getContractFactory("USID");
  const usid = await USID.deploy();
  await usid.waitForDeployment();

  const EventEmitter = await ethers.getContractFactory("EventEmitter");
  const eventEmitter = await EventEmitter.deploy();
  await eventEmitter.waitForDeployment();

  // Phase 2: Core Infrastructure
  const MarketNFT = await ethers.getContractFactory("MarketNFT");
  const marketNFT = await MarketNFT.deploy();
  await marketNFT.waitForDeployment();

  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(await usid.getAddress());
  await feeCollector.waitForDeployment();

  const HLPMMFactory = await ethers.getContractFactory("HLPMMFactory");
  const factory = await HLPMMFactory.deploy(
    await usid.getAddress(),
    await eventEmitter.getAddress(),
    await marketNFT.getAddress(),
    await feeCollector.getAddress()
  );
  await factory.waitForDeployment();

  // Wire permissions
  await usid.setFactory(await factory.getAddress());
  await eventEmitter.setFactory(await factory.getAddress(), await marketNFT.getAddress());
  await marketNFT.setFactory(
    await factory.getAddress(),
    await feeCollector.getAddress(),
    await eventEmitter.getAddress()
  );
  await feeCollector.setFactory(
    await factory.getAddress(),
    await marketNFT.getAddress(),
    await eventEmitter.getAddress()
  );

  // Phase 3: Periphery
  const HLPMMQuoter = await ethers.getContractFactory("HLPMMQuoter");
  const quoter = await HLPMMQuoter.deploy(
    await factory.getAddress(),
    await usid.getAddress()
  );
  await quoter.waitForDeployment();

  const HLPMMRouter = await ethers.getContractFactory("HLPMMRouter");
  const router = await HLPMMRouter.deploy(
    await factory.getAddress(),
    await usid.getAddress()
  );
  await router.waitForDeployment();

  return {
    usid,
    eventEmitter,
    marketNFT,
    feeCollector,
    factory,
    quoter,
    router,
    deployer,
    creator,
    user1,
    user2,
    user3
  };
}

async function deployProtocolWithMarketFixture() {
  const protocol = await deployProtocolFixture();
  
  // Create a market
  const tx = await protocol.factory.connect(protocol.creator).createMarket(
    "Test Token",
    "TEST",
    0 // FeeStrategy.CLAIM
  );
  const receipt = await tx.wait();
  
  // Get pool and token addresses from event
  const marketCreatedEvent = receipt.logs.find(
    log => log.fragment && log.fragment.name === "MarketCreated"
  );
  
  const poolAddress = marketCreatedEvent.args[0];
  const tokenAddress = marketCreatedEvent.args[1];
  const nftId = marketCreatedEvent.args[2];

  const pool = await ethers.getContractAt("HLPMMPool", poolAddress);
  const token = await ethers.getContractAt("HLPMMToken", tokenAddress);

  return {
    ...protocol,
    pool,
    token,
    nftId,
    poolAddress,
    tokenAddress
  };
}

async function deployUSIDFixture() {
  const [deployer, factory, user1, user2] = await ethers.getSigners();
  
  const USID = await ethers.getContractFactory("USID");
  const usid = await USID.deploy();
  await usid.waitForDeployment();

  return { usid, deployer, factory, user1, user2 };
}

async function deployEventEmitterFixture() {
  const [deployer, factory, pool1, pool2] = await ethers.getSigners();
  
  const EventEmitter = await ethers.getContractFactory("EventEmitter");
  const eventEmitter = await EventEmitter.deploy();
  await eventEmitter.waitForDeployment();

  return { eventEmitter, deployer, factory, pool1, pool2 };
}

async function deployHLPMMTokenFixture() {
  const [deployer, pool, user1, user2] = await ethers.getSigners();
  
  const HLPMMToken = await ethers.getContractFactory("HLPMMToken");
  const token = await HLPMMToken.deploy();
  await token.waitForDeployment();

  return { token, deployer, pool, user1, user2 };
}

module.exports = {
  deployProtocolFixture,
  deployProtocolWithMarketFixture,
  deployUSIDFixture,
  deployEventEmitterFixture,
  deployHLPMMTokenFixture
};
