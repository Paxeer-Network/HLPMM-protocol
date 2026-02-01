const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("PoolMath Library", function () {
  async function deployPoolMathTestFixture() {
    const PoolMathTest = await ethers.getContractFactory("PoolMathTest");
    const poolMathTest = await PoolMathTest.deploy();
    await poolMathTest.waitForDeployment();
    return { poolMathTest };
  }

  const PRECISION = ethers.parseEther("1");
  const INITIAL_USID = ethers.parseEther("10000");
  const INITIAL_TOKENS = ethers.parseEther("1000000000");

  describe("getAmountOut", function () {
    it("Should calculate correct output for constant product", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      // With reserves 10000 USID and 1B tokens
      // Swapping 100 USID should give: (1B * 100) / (10000 + 100) = 9900990.099...
      const amountIn = ethers.parseEther("100");
      const amountOut = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      
      // Verify it's approximately correct
      expect(amountOut).to.be.gt(ethers.parseEther("9900000"));
      expect(amountOut).to.be.lt(ethers.parseEther("10000000"));
    });

    it("Should revert with zero input amount", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      await expect(
        poolMathTest.getAmountOut(0, INITIAL_USID, INITIAL_TOKENS)
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientInputAmount");
    });

    it("Should revert with zero reserves", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      await expect(
        poolMathTest.getAmountOut(ethers.parseEther("100"), 0, INITIAL_TOKENS)
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientLiquidity");
      
      await expect(
        poolMathTest.getAmountOut(ethers.parseEther("100"), INITIAL_USID, 0)
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientLiquidity");
    });

    it("Should handle small swaps", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("1");
      const amountOut = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      
      expect(amountOut).to.be.gt(0);
    });

    it("Should handle large swaps", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("5000"); // 50% of reserve
      const amountOut = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      
      // Should get about 1/3 of output reserves due to slippage
      expect(amountOut).to.be.lt(INITIAL_TOKENS / 2n);
    });
  });

  describe("getAmountOutWithFee", function () {
    it("Should deduct fee from output", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("100");
      const feeBps = 30n; // 0.3%
      
      const [amountOut, feeAmount] = await poolMathTest.getAmountOutWithFee(
        amountIn, INITIAL_USID, INITIAL_TOKENS, feeBps
      );
      
      const amountOutNoFee = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      
      expect(amountOut).to.be.lt(amountOutNoFee);
      expect(feeAmount).to.equal(amountIn * feeBps / 10000n);
    });

    it("Should return zero fee with zero fee rate", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("100");
      const [amountOut, feeAmount] = await poolMathTest.getAmountOutWithFee(
        amountIn, INITIAL_USID, INITIAL_TOKENS, 0
      );
      
      const amountOutNoFee = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      
      expect(amountOut).to.equal(amountOutNoFee);
      expect(feeAmount).to.equal(0);
    });
  });

  describe("getAmountIn", function () {
    it("Should calculate correct input for desired output", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const desiredOutput = ethers.parseEther("1000000"); // 1M tokens
      const amountIn = await poolMathTest.getAmountIn(desiredOutput, INITIAL_USID, INITIAL_TOKENS);
      
      expect(amountIn).to.be.gt(0);
      
      // Verify by computing output with this input
      const actualOutput = await poolMathTest.getAmountOut(amountIn, INITIAL_USID, INITIAL_TOKENS);
      expect(actualOutput).to.be.gte(desiredOutput);
    });

    it("Should revert with zero output amount", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      await expect(
        poolMathTest.getAmountIn(0, INITIAL_USID, INITIAL_TOKENS)
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientOutputAmount");
    });

    it("Should revert when output exceeds reserve", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      await expect(
        poolMathTest.getAmountIn(INITIAL_TOKENS + 1n, INITIAL_USID, INITIAL_TOKENS)
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientLiquidity");
    });
  });

  describe("calculatePriceImpact", function () {
    it("Should return low impact for small trades", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("10"); // 0.1% of reserve
      const impact = await poolMathTest.calculatePriceImpact(amountIn, INITIAL_USID);
      
      expect(impact).to.be.lt(100); // Less than 1%
    });

    it("Should return high impact for large trades", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountIn = ethers.parseEther("5000"); // 50% of reserve
      const impact = await poolMathTest.calculatePriceImpact(amountIn, INITIAL_USID);
      
      expect(impact).to.be.gt(3000); // Greater than 30%
    });

    it("Should return max impact with zero reserve", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const impact = await poolMathTest.calculatePriceImpact(ethers.parseEther("100"), 0);
      expect(impact).to.equal(10000); // 100%
    });
  });

  describe("getSpotPrice", function () {
    it("Should calculate correct spot price", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      // Price = reserveUSID / reserveToken * 1e18
      // 10000 / 1B = 0.00001 USID per token
      const price = await poolMathTest.getSpotPrice(INITIAL_USID, INITIAL_TOKENS);
      
      const expectedPrice = (INITIAL_USID * PRECISION) / INITIAL_TOKENS;
      expect(price).to.equal(expectedPrice);
    });

    it("Should return 0 with zero token reserve", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const price = await poolMathTest.getSpotPrice(INITIAL_USID, 0);
      expect(price).to.equal(0);
    });
  });

  describe("getMarketCap", function () {
    it("Should calculate correct market cap", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const totalSupply = ethers.parseEther("1000000000");
      const marketCap = await poolMathTest.getMarketCap(INITIAL_USID, INITIAL_TOKENS, totalSupply);
      
      // Initial market cap should be ~$10,000
      expect(marketCap).to.equal(INITIAL_USID);
    });
  });

  describe("getK", function () {
    it("Should calculate constant product K", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const k = await poolMathTest.getK(INITIAL_USID, INITIAL_TOKENS);
      expect(k).to.equal(INITIAL_USID * INITIAL_TOKENS);
    });
  });

  describe("quote", function () {
    it("Should calculate proportional amount", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      const amountA = ethers.parseEther("100");
      const reserveA = ethers.parseEther("1000");
      const reserveB = ethers.parseEther("2000");
      
      const amountB = await poolMathTest.quote(amountA, reserveA, reserveB);
      expect(amountB).to.equal(ethers.parseEther("200")); // 100 * 2000 / 1000
    });

    it("Should revert with zero input", async function () {
      const { poolMathTest } = await loadFixture(deployPoolMathTestFixture);
      
      await expect(
        poolMathTest.quote(0, ethers.parseEther("1000"), ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(poolMathTest, "InsufficientInputAmount");
    });
  });
});
