const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2ProtocolFixture } = require("../helpers/fixtures");

describe("HLPMMFactoryV2 — Unit Tests", function () {
  let p;

  beforeEach(async function () {
    p = await deployV2ProtocolFixture();
  });

  describe("Market Creation", function () {
    it("should create market and return pool, token, nftId", async function () {
      const tx = await p.factory.connect(p.creator).createMarket("Alpha", "ALPH", '{"img":"x"}', 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      expect(ev.args[0]).to.not.equal(ethers.ZeroAddress); // pool
      expect(ev.args[1]).to.not.equal(ethers.ZeroAddress); // token
      expect(ev.args[2]).to.equal(1); // nftId
    });

    it("should increment marketCount", async function () {
      await p.factory.connect(p.creator).createMarket("A", "A", "", 0);
      await p.factory.connect(p.creator).createMarket("B", "B", "", 0);
      expect(await p.factory.getPoolCount()).to.equal(2);
    });

    it("should revert on empty name", async function () {
      await expect(
        p.factory.connect(p.creator).createMarket("", "SYM", "", 0)
      ).to.be.revertedWithCustomError(p.factory, "InvalidName");
    });

    it("should revert on empty symbol", async function () {
      await expect(
        p.factory.connect(p.creator).createMarket("Name", "", "", 0)
      ).to.be.revertedWithCustomError(p.factory, "InvalidSymbol");
    });

    it("should register tokenToPool mapping", async function () {
      const tx = await p.factory.connect(p.creator).createMarket("X", "X", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      const tokenAddr = ev.args[1];
      const poolAddr = ev.args[0];
      expect(await p.factory.tokenToPool(tokenAddr)).to.equal(poolAddr);
    });

    it("should register poolToToken mapping", async function () {
      const tx = await p.factory.connect(p.creator).createMarket("Y", "Y", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      expect(await p.factory.poolToToken(ev.args[0])).to.equal(ev.args[1]);
    });

    it("should authorize pool and token as emitters", async function () {
      const tx = await p.factory.connect(p.creator).createMarket("Z", "Z", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      expect(await p.eventEmitter.isAuthorizedEmitter(ev.args[0])).to.be.true;
      expect(await p.eventEmitter.isAuthorizedEmitter(ev.args[1])).to.be.true;
    });

    it("should allow same creator to create multiple markets", async function () {
      await p.factory.connect(p.creator).createMarket("A", "A", "", 0);
      await p.factory.connect(p.creator).createMarket("B", "B", "", 0);
      await p.factory.connect(p.creator).createMarket("C", "C", "", 0);
      expect(await p.factory.getPoolCount()).to.equal(3);
    });

    it("should allow different creators to create markets", async function () {
      await p.factory.connect(p.creator).createMarket("A", "A", "", 0);
      await p.factory.connect(p.user1).createMarket("B", "B", "", 0);
      expect(await p.factory.getPoolCount()).to.equal(2);
    });

    it("should mint NFT to creator", async function () {
      const tx = await p.factory.connect(p.creator).createMarket("T", "T", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      expect(await p.marketNFT.ownerOf(ev.args[2])).to.equal(p.creator.address);
    });

    it("should set fee strategy on NFT", async function () {
      await p.factory.connect(p.creator).createMarket("T", "T", "", 2); // AIRDROP
      expect(await p.marketNFT.feeStrategy(1)).to.equal(2);
    });
  });

  describe("computeTokenAddress", function () {
    it("should predict token address before deployment", async function () {
      const predicted = await p.factory.computeTokenAddress("Test", "TST", p.creator.address, 0);
      const tx = await p.factory.connect(p.creator).createMarket("Test", "TST", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      expect(ev.args[1]).to.equal(predicted);
    });
  });

  describe("getAllPools", function () {
    it("should return all created pools", async function () {
      await p.factory.connect(p.creator).createMarket("A", "A", "", 0);
      await p.factory.connect(p.creator).createMarket("B", "B", "", 0);
      const pools = await p.factory.getAllPools();
      expect(pools.length).to.equal(2);
    });
  });
});
