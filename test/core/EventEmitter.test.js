const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ZERO_ADDRESS, FeeStrategy } = require("../helpers/constants");

describe("EventEmitter", function () {
  async function deployEventEmitterFixture() {
    const [deployer, factory, pool1, pool2, user1] = await ethers.getSigners();
    
    const EventEmitter = await ethers.getContractFactory("EventEmitter");
    const eventEmitter = await EventEmitter.deploy();
    await eventEmitter.waitForDeployment();

    return { eventEmitter, deployer, factory, pool1, pool2, user1 };
  }

  describe("Deployment", function () {
    it("Should have no factory set initially", async function () {
      const { eventEmitter } = await loadFixture(deployEventEmitterFixture);
      expect(await eventEmitter.factory()).to.equal(ZERO_ADDRESS);
    });
  });

  describe("setFactory", function () {
    it("Should allow deployer to set factory", async function () {
      const { eventEmitter, deployer, factory, pool1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      expect(await eventEmitter.factory()).to.equal(factory.address);
      expect(await eventEmitter.isAuthorizedEmitter(factory.address)).to.be.true;
      expect(await eventEmitter.isAuthorizedEmitter(pool1.address)).to.be.true;
    });

    it("Should revert if non-deployer tries to set factory", async function () {
      const { eventEmitter, factory, pool1, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await expect(
        eventEmitter.connect(user1).setFactory(factory.address, pool1.address)
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });

    it("Should revert if factory already set", async function () {
      const { eventEmitter, deployer, factory, pool1, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      await expect(
        eventEmitter.connect(deployer).setFactory(user1.address, pool1.address)
      ).to.be.revertedWithCustomError(eventEmitter, "FactoryAlreadySet");
    });
  });

  describe("authorizeEmitter", function () {
    it("Should allow factory to authorize emitters", async function () {
      const { eventEmitter, deployer, factory, pool1, pool2 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      await eventEmitter.connect(factory).authorizeEmitter(pool2.address);
      
      expect(await eventEmitter.isAuthorizedEmitter(pool1.address)).to.be.true;
    });

    it("Should revert if non-factory tries to authorize", async function () {
      const { eventEmitter, deployer, factory, pool1, pool2, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      await expect(
        eventEmitter.connect(user1).authorizeEmitter(pool1.address)
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });
  });

  describe("revokeEmitter", function () {
    it("Should allow factory to revoke emitters", async function () {
      const { eventEmitter, deployer, factory, pool1, pool2 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      await eventEmitter.connect(factory).authorizeEmitter(pool2.address);
      await eventEmitter.connect(factory).revokeEmitter(pool2.address);
      
      expect(await eventEmitter.isAuthorizedEmitter(pool2.address)).to.be.false;
    });
  });

  describe("emitMarketCreated", function () {
    it("Should emit MarketCreated event from authorized emitter", async function () {
      const { eventEmitter, deployer, factory, pool1, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      const tokenAddress = "0x1234567890123456789012345678901234567890";
      const nftId = 1;
      
      await expect(
        eventEmitter.connect(factory).emitMarketCreated(
          pool1.address,
          tokenAddress,
          nftId,
          user1.address,
          "Test Token",
          "TEST"
        )
      ).to.emit(eventEmitter, "MarketCreated");
    });

    it("Should revert if unauthorized emitter", async function () {
      const { eventEmitter, deployer, factory, pool1, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      await expect(
        eventEmitter.connect(user1).emitMarketCreated(
          pool1.address,
          ZERO_ADDRESS,
          1,
          user1.address,
          "Test",
          "TST"
        )
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });
  });

  describe("emitSwap", function () {
    it("Should emit Swap event from authorized pool", async function () {
      const { eventEmitter, deployer, factory, pool1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      const tokenIn = "0x1111111111111111111111111111111111111111";
      const tokenOut = "0x2222222222222222222222222222222222222222";
      const sender = "0x3333333333333333333333333333333333333333";
      
      await expect(
        eventEmitter.connect(pool1).emitSwap(
          pool1.address,
          sender,
          tokenIn,
          tokenOut,
          ethers.parseEther("100"),
          ethers.parseEther("99"),
          ethers.parseEther("10100"),
          ethers.parseEther("999900000"),
          ethers.parseEther("0.3")
        )
      ).to.emit(eventEmitter, "Swap");
    });
  });

  describe("emitFeeClaimed", function () {
    it("Should emit FeeClaimed event", async function () {
      const { eventEmitter, deployer, factory, pool1, user1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      await expect(
        eventEmitter.connect(pool1).emitFeeClaimed(
          pool1.address,
          1,
          user1.address,
          ethers.parseEther("50")
        )
      ).to.emit(eventEmitter, "FeeClaimed");
    });
  });

  describe("emitFeeStrategyUpdated", function () {
    it("Should emit FeeStrategyUpdated event", async function () {
      const { eventEmitter, deployer, factory, pool1 } = await loadFixture(deployEventEmitterFixture);
      
      await eventEmitter.connect(deployer).setFactory(factory.address, pool1.address);
      
      await expect(
        eventEmitter.connect(factory).emitFeeStrategyUpdated(1, FeeStrategy.BURN)
      ).to.emit(eventEmitter, "FeeStrategyUpdated");
    });
  });
});
