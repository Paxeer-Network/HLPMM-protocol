const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { INITIAL_USID, INITIAL_TOKENS, FeeStrategy, ZERO_ADDRESS } = require("../helpers/constants");
const { deployProtocolFixture } = require("../helpers/fixtures");

describe("HLPMMFactory", function () {
  describe("Deployment", function () {
    it("Should store all dependency addresses", async function () {
      const { factory, usid, eventEmitter, marketNFT, feeCollector } = 
        await loadFixture(deployProtocolFixture);
      
      expect(await factory.usid()).to.equal(await usid.getAddress());
      expect(await factory.eventEmitter()).to.equal(await eventEmitter.getAddress());
      expect(await factory.marketNFT()).to.equal(await marketNFT.getAddress());
      expect(await factory.feeCollector()).to.equal(await feeCollector.getAddress());
    });

    it("Should start with zero market count", async function () {
      const { factory } = await loadFixture(deployProtocolFixture);
      expect(await factory.marketCount()).to.equal(0);
    });

    it("Should have correct initial constants", async function () {
      const { factory } = await loadFixture(deployProtocolFixture);
      expect(await factory.INITIAL_USID()).to.equal(INITIAL_USID);
      expect(await factory.INITIAL_TOKENS()).to.equal(INITIAL_TOKENS);
    });
  });

  describe("createMarket", function () {
    it("Should create a new market", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      
      await tx.wait();
      
      expect(await factory.marketCount()).to.equal(1);
    });

    it("Should deploy token with correct name and symbol", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "My Token",
        "MTK",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const tokenAddress = event.args[1];
      
      const token = await ethers.getContractAt("HLPMMToken", tokenAddress);
      expect(await token.name()).to.equal("My Token");
      expect(await token.symbol()).to.equal("MTK");
    });

    it("Should mint USID to pool", async function () {
      const { factory, usid, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      
      expect(await usid.balanceOf(poolAddress)).to.equal(INITIAL_USID);
    });

    it("Should mint tokens to pool", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      const tokenAddress = event.args[1];
      
      const token = await ethers.getContractAt("HLPMMToken", tokenAddress);
      expect(await token.balanceOf(poolAddress)).to.equal(INITIAL_TOKENS);
    });

    it("Should mint NFT to creator", async function () {
      const { factory, marketNFT, creator } = await loadFixture(deployProtocolFixture);
      
      await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      
      expect(await marketNFT.balanceOf(creator.address)).to.equal(1);
      expect(await marketNFT.ownerOf(1)).to.equal(creator.address);
    });

    it("Should register token to pool mapping", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      const tokenAddress = event.args[1];
      
      expect(await factory.tokenToPool(tokenAddress)).to.equal(poolAddress);
      expect(await factory.poolToToken(poolAddress)).to.equal(tokenAddress);
    });

    it("Should register NFT to pool mapping", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      const nftId = event.args[2];
      
      expect(await factory.nftToPool(nftId)).to.equal(poolAddress);
    });

    it("Should emit MarketCreated event", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      await expect(
        factory.connect(creator).createMarket("Test Token", "TEST", FeeStrategy.CLAIM)
      ).to.emit(factory, "MarketCreated");
    });

    it("Should set initial fee strategy", async function () {
      const { factory, marketNFT, creator } = await loadFixture(deployProtocolFixture);
      
      await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.BURN
      );
      
      expect(await marketNFT.feeStrategy(1)).to.equal(FeeStrategy.BURN);
    });

    it("Should revert with empty name", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      await expect(
        factory.connect(creator).createMarket("", "TEST", FeeStrategy.CLAIM)
      ).to.be.revertedWithCustomError(factory, "InvalidName");
    });

    it("Should revert with empty symbol", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      await expect(
        factory.connect(creator).createMarket("Test Token", "", FeeStrategy.CLAIM)
      ).to.be.revertedWithCustomError(factory, "InvalidSymbol");
    });

    it("Should increment creator nonce", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      expect(await factory.creatorNonce(creator.address)).to.equal(0);
      
      await factory.connect(creator).createMarket("Token 1", "TK1", FeeStrategy.CLAIM);
      expect(await factory.creatorNonce(creator.address)).to.equal(1);
      
      await factory.connect(creator).createMarket("Token 2", "TK2", FeeStrategy.CLAIM);
      expect(await factory.creatorNonce(creator.address)).to.equal(2);
    });

    it("Should add pool to allPools array", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      
      expect(await factory.allPools(0)).to.equal(poolAddress);
      expect(await factory.getPoolCount()).to.equal(1);
    });

    it("Should authorize pool in EventEmitter", async function () {
      const { factory, eventEmitter, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      
      expect(await eventEmitter.isAuthorizedEmitter(poolAddress)).to.be.true;
    });
  });

  describe("getPool", function () {
    it("Should return pool address for token", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      const tokenAddress = event.args[1];
      
      expect(await factory.getPool(tokenAddress)).to.equal(poolAddress);
    });

    it("Should return zero address for unknown token", async function () {
      const { factory } = await loadFixture(deployProtocolFixture);
      
      const unknownToken = "0x1234567890123456789012345678901234567890";
      expect(await factory.getPool(unknownToken)).to.equal(ZERO_ADDRESS);
    });
  });

  describe("getAllPools", function () {
    it("Should return all pool addresses", async function () {
      const { factory, creator, user1 } = await loadFixture(deployProtocolFixture);
      
      await factory.connect(creator).createMarket("Token 1", "TK1", FeeStrategy.CLAIM);
      await factory.connect(user1).createMarket("Token 2", "TK2", FeeStrategy.CLAIM);
      await factory.connect(creator).createMarket("Token 3", "TK3", FeeStrategy.CLAIM);
      
      const allPools = await factory.getAllPools();
      expect(allPools.length).to.equal(3);
    });
  });

  describe("computeTokenAddress", function () {
    it("Should compute deterministic token address", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      const computedAddress = await factory.computeTokenAddress(
        "Test Token",
        "TEST",
        creator.address,
        0
      );
      
      const tx = await factory.connect(creator).createMarket(
        "Test Token",
        "TEST",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const actualTokenAddress = event.args[1];
      
      expect(computedAddress).to.equal(actualTokenAddress);
    });
  });

  describe("Multiple market creation", function () {
    it("Should allow same creator to create multiple markets", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);
      
      await factory.connect(creator).createMarket("Token A", "TKA", FeeStrategy.CLAIM);
      await factory.connect(creator).createMarket("Token B", "TKB", FeeStrategy.BURN);
      await factory.connect(creator).createMarket("Token C", "TKC", FeeStrategy.AIRDROP);
      
      expect(await factory.marketCount()).to.equal(3);
    });

    it("Should allow different creators", async function () {
      const { factory, creator, user1, user2 } = await loadFixture(deployProtocolFixture);
      
      await factory.connect(creator).createMarket("Token A", "TKA", FeeStrategy.CLAIM);
      await factory.connect(user1).createMarket("Token B", "TKB", FeeStrategy.CLAIM);
      await factory.connect(user2).createMarket("Token C", "TKC", FeeStrategy.CLAIM);
      
      expect(await factory.marketCount()).to.equal(3);
    });
  });
});
