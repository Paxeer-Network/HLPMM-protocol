const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Admin Functions", function () {
  let deployer, user1, user2;
  let eventEmitter, feeCollector, marketNFT, usid;

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy USID
    const USID = await ethers.getContractFactory("USID");
    usid = await USID.deploy();
    await usid.waitForDeployment();

    // Deploy EventEmitter
    const EventEmitter = await ethers.getContractFactory("EventEmitter");
    eventEmitter = await EventEmitter.deploy();
    await eventEmitter.waitForDeployment();

    // Deploy FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(await usid.getAddress());
    await feeCollector.waitForDeployment();

    // Deploy MarketNFT
    const MarketNFT = await ethers.getContractFactory("MarketNFT");
    marketNFT = await MarketNFT.deploy();
    await marketNFT.waitForDeployment();
  });

  describe("EventEmitter Admin Functions", function () {
    it("should allow deployer to adminAuthorizeEmitter", async function () {
      expect(await eventEmitter.isAuthorizedEmitter(user1.address)).to.be.false;
      
      await eventEmitter.connect(deployer).adminAuthorizeEmitter(user1.address);
      
      expect(await eventEmitter.isAuthorizedEmitter(user1.address)).to.be.true;
    });

    it("should allow deployer to adminRevokeEmitter", async function () {
      await eventEmitter.connect(deployer).adminAuthorizeEmitter(user1.address);
      expect(await eventEmitter.isAuthorizedEmitter(user1.address)).to.be.true;
      
      await eventEmitter.connect(deployer).adminRevokeEmitter(user1.address);
      
      expect(await eventEmitter.isAuthorizedEmitter(user1.address)).to.be.false;
    });

    it("should revert when non-deployer calls adminAuthorizeEmitter", async function () {
      await expect(
        eventEmitter.connect(user1).adminAuthorizeEmitter(user2.address)
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });

    it("should revert when non-deployer calls adminRevokeEmitter", async function () {
      await expect(
        eventEmitter.connect(user1).adminRevokeEmitter(user2.address)
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });
  });

  describe("FeeCollector Admin Functions", function () {
    it("should allow deployer to setEventEmitter", async function () {
      const newEventEmitter = user1.address;
      
      await feeCollector.connect(deployer).setEventEmitter(newEventEmitter);
      
      expect(await feeCollector.eventEmitter()).to.equal(newEventEmitter);
    });

    it("should allow deployer to setMarketNFT", async function () {
      const newMarketNFT = user1.address;
      
      await feeCollector.connect(deployer).setMarketNFT(newMarketNFT);
      
      expect(await feeCollector.marketNFT()).to.equal(newMarketNFT);
    });

    it("should revert when non-deployer calls setEventEmitter", async function () {
      await expect(
        feeCollector.connect(user1).setEventEmitter(user2.address)
      ).to.be.revertedWithCustomError(feeCollector, "Unauthorized");
    });

    it("should revert when non-deployer calls setMarketNFT", async function () {
      await expect(
        feeCollector.connect(user1).setMarketNFT(user2.address)
      ).to.be.revertedWithCustomError(feeCollector, "Unauthorized");
    });
  });

  describe("MarketNFT Admin Functions", function () {
    it("should allow deployer to setFeeCollector", async function () {
      const newFeeCollector = user1.address;
      
      await marketNFT.connect(deployer).setFeeCollector(newFeeCollector);
      
      expect(await marketNFT.feeCollector()).to.equal(newFeeCollector);
    });

    it("should allow deployer to setEventEmitter", async function () {
      const newEventEmitter = user1.address;
      
      await marketNFT.connect(deployer).setEventEmitter(newEventEmitter);
      
      expect(await marketNFT.eventEmitter()).to.equal(newEventEmitter);
    });

    it("should revert when non-deployer calls setFeeCollector", async function () {
      await expect(
        marketNFT.connect(user1).setFeeCollector(user2.address)
      ).to.be.revertedWithCustomError(marketNFT, "Unauthorized");
    });

    it("should revert when non-deployer calls setEventEmitter", async function () {
      await expect(
        marketNFT.connect(user1).setEventEmitter(user2.address)
      ).to.be.revertedWithCustomError(marketNFT, "Unauthorized");
    });
  });

  describe("Integration: Admin can fix authorization issues", function () {
    it("should allow admin to authorize FeeCollector in EventEmitter post-deployment", async function () {
      // Simulate the scenario where FeeCollector wasn't authorized initially
      expect(await eventEmitter.isAuthorizedEmitter(await feeCollector.getAddress())).to.be.false;
      
      // Admin fixes by authorizing FeeCollector
      await eventEmitter.connect(deployer).adminAuthorizeEmitter(await feeCollector.getAddress());
      
      expect(await eventEmitter.isAuthorizedEmitter(await feeCollector.getAddress())).to.be.true;
    });

    it("should allow admin to update FeeCollector's eventEmitter reference", async function () {
      const newEventEmitter = await eventEmitter.getAddress();
      
      await feeCollector.connect(deployer).setEventEmitter(newEventEmitter);
      
      expect(await feeCollector.eventEmitter()).to.equal(newEventEmitter);
    });

    it("should allow admin to update MarketNFT's feeCollector reference", async function () {
      const feeCollectorAddr = await feeCollector.getAddress();
      
      await marketNFT.connect(deployer).setFeeCollector(feeCollectorAddr);
      
      expect(await marketNFT.feeCollector()).to.equal(feeCollectorAddr);
    });
  });
});
