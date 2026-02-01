const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { INITIAL_USID, INITIAL_TOKENS } = require("../helpers/constants");
const { deployProtocolWithMarketFixture } = require("../helpers/fixtures");

describe("HLPMMQuoter", function () {
  describe("Deployment", function () {
    it("Should store factory and USID addresses", async function () {
      const { quoter, factory, usid } = await loadFixture(deployProtocolWithMarketFixture);
      
      expect(await quoter.factory()).to.equal(await factory.getAddress());
      expect(await quoter.usid()).to.equal(await usid.getAddress());
    });
  });

  describe("quoteExactInput", function () {
    it("Should quote USID to token swap", async function () {
      const { quoter, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("100");
      const amountOut = await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        amountIn
      );
      
      // With fees and AMM formula, should get roughly 9.9M tokens for 100 USID
      expect(amountOut).to.be.gt(ethers.parseEther("9000000"));
      expect(amountOut).to.be.lt(ethers.parseEther("10000000"));
    });

    it("Should quote token to USID swap", async function () {
      const { quoter, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("10000000"); // 10M tokens
      const amountOut = await quoter.quoteExactInput(
        await token.getAddress(),
        await usid.getAddress(),
        amountIn
      );
      
      // Should get some USID back
      expect(amountOut).to.be.gt(0);
      expect(amountOut).to.be.lt(ethers.parseEther("100")); // Less than ~100 USID due to slippage
    });

    it("Should revert for non-existent pool", async function () {
      const { quoter, usid } = await loadFixture(deployProtocolWithMarketFixture);
      
      const fakeToken = "0x1234567890123456789012345678901234567890";
      
      await expect(
        quoter.quoteExactInput(
          await usid.getAddress(),
          fakeToken,
          ethers.parseEther("100")
        )
      ).to.be.revertedWithCustomError(quoter, "PoolNotFound");
    });
  });

  describe("quoteExactInputMultiHop", function () {
    it("Should quote multi-hop swap", async function () {
      const { quoter, usid, token, factory, creator } = await loadFixture(deployProtocolWithMarketFixture);
      
      // Create a second market for multi-hop testing
      const tx = await factory.connect(creator).createMarket("Token B", "TKB", 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const tokenBAddress = event.args[1];
      
      // Path: Token A -> USID -> Token B
      const path = [
        await token.getAddress(),
        await usid.getAddress(),
        tokenBAddress
      ];
      
      const amountIn = ethers.parseEther("1000000"); // 1M Token A
      const amountOut = await quoter.quoteExactInputMultiHop(path, amountIn);
      
      expect(amountOut).to.be.gt(0);
    });

    it("Should revert with invalid path", async function () {
      const { quoter, usid } = await loadFixture(deployProtocolWithMarketFixture);
      
      await expect(
        quoter.quoteExactInputMultiHop([await usid.getAddress()], ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(quoter, "InvalidPath");
    });
  });

  describe("quoteExactOutput", function () {
    it("Should quote input needed for desired output", async function () {
      const { quoter, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const desiredOutput = ethers.parseEther("1000000"); // 1M tokens
      const requiredInput = await quoter.quoteExactOutput(
        await usid.getAddress(),
        await token.getAddress(),
        desiredOutput
      );
      
      // Should need some USID
      expect(requiredInput).to.be.gt(0);
    });

    it("Should be consistent with quoteExactInput", async function () {
      const { quoter, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("100");
      const expectedOut = await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        amountIn
      );
      
      // Now calculate input needed for that output
      const calculatedIn = await quoter.quoteExactOutput(
        await usid.getAddress(),
        await token.getAddress(),
        expectedOut
      );
      
      // Should be close to original input (may differ slightly due to rounding)
      const diff = calculatedIn > amountIn 
        ? calculatedIn - amountIn 
        : amountIn - calculatedIn;
      expect(diff).to.be.lt(ethers.parseEther("1")); // Within 1 USID
    });
  });

  describe("getPriceImpact", function () {
    it("Should return low impact for small trades", async function () {
      const { quoter, pool } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("10"); // Small trade
      const impact = await quoter.getPriceImpact(await pool.getAddress(), amountIn, true);
      
      // Should be less than 1%
      expect(impact).to.be.lt(100);
    });

    it("Should return higher impact for larger trades", async function () {
      const { quoter, pool } = await loadFixture(deployProtocolWithMarketFixture);
      
      const smallTrade = ethers.parseEther("10");
      const largeTrade = ethers.parseEther("1000");
      
      const smallImpact = await quoter.getPriceImpact(await pool.getAddress(), smallTrade, true);
      const largeImpact = await quoter.getPriceImpact(await pool.getAddress(), largeTrade, true);
      
      expect(largeImpact).to.be.gt(smallImpact);
    });
  });

  describe("getSpotPrice", function () {
    it("Should return correct spot price", async function () {
      const { quoter, pool } = await loadFixture(deployProtocolWithMarketFixture);
      
      const spotPrice = await quoter.getSpotPrice(await pool.getAddress());
      
      // Price = reserveUSID * 1e18 / reserveToken
      const expectedPrice = (INITIAL_USID * ethers.parseEther("1")) / INITIAL_TOKENS;
      expect(spotPrice).to.equal(expectedPrice);
    });
  });

  describe("getMarketCap", function () {
    it("Should return initial market cap", async function () {
      const { quoter, pool } = await loadFixture(deployProtocolWithMarketFixture);
      
      const marketCap = await quoter.getMarketCap(await pool.getAddress());
      
      // Initial market cap should be ~$10,000
      expect(marketCap).to.equal(INITIAL_USID);
    });
  });

  describe("getPoolInfo", function () {
    it("Should return complete pool information", async function () {
      const { quoter, pool, token, nftId } = await loadFixture(deployProtocolWithMarketFixture);
      
      const info = await quoter.getPoolInfo(await pool.getAddress());
      
      expect(info.token).to.equal(await token.getAddress());
      expect(info.reserveUSID).to.equal(INITIAL_USID);
      expect(info.reserveToken).to.equal(INITIAL_TOKENS);
      expect(info.spotPrice).to.be.gt(0);
      expect(info.marketCap).to.equal(INITIAL_USID);
      expect(info.createdAt).to.be.gt(0);
      expect(info.nftId).to.equal(nftId);
    });
  });
});
