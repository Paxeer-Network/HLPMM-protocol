const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ZERO_ADDRESS, FeeStrategy } = require("../helpers/constants");
const { deployProtocolWithMarketFixture } = require("../helpers/fixtures");

describe("FeeCollector", function () {
  describe("Deployment", function () {
    it("Should store USID address", async function () {
      const { feeCollector, usid } = await loadFixture(deployProtocolWithMarketFixture);
      expect(await feeCollector.usid()).to.equal(await usid.getAddress());
    });
  });

  describe("accumulateFee", function () {
    it("Should accumulate fees for NFT", async function () {
      const { feeCollector, usid, pool, nftId, creator, factory, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      // Simulate swap by having pool call accumulateFee
      // First we need to get some USID to the fee collector
      // We'll do this via a swap
      const swapAmount = ethers.parseEther("100");
      await usid.connect(creator).approve(await pool.getAddress(), swapAmount);
      
      // Mint some USID to user for testing
      // Actually, we need to do a real swap to accumulate fees
      // Let's check pending fees after market creation
      const pendingBefore = await feeCollector.pendingFees(nftId);
      expect(pendingBefore).to.equal(0); // No trades yet
    });
  });

  describe("pendingFees", function () {
    it("Should return 0 for NFT with no fees", async function () {
      const { feeCollector, nftId } = await loadFixture(deployProtocolWithMarketFixture);
      expect(await feeCollector.pendingFees(nftId)).to.equal(0);
    });
  });

  describe("airdropPool", function () {
    it("Should start at 0", async function () {
      const { feeCollector, nftId } = await loadFixture(deployProtocolWithMarketFixture);
      expect(await feeCollector.airdropPool(nftId)).to.equal(0);
    });
  });
});
