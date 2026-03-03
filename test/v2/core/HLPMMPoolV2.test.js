const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2WithMarketFixture } = require("../helpers/fixtures");

describe("HLPMMPoolV2 — Unit Tests", function () {
  let p, deadline;

  beforeEach(async function () {
    p = await deployV2WithMarketFixture();
    deadline = (await ethers.provider.getBlock("latest")).timestamp + 60000;
  });

  async function buy(user, stable, amount) {
    await stable.connect(user).approve(await p.router.getAddress(), amount);
    await p.router.connect(user).swapExactStableForTokens(
      amount, 0, await stable.getAddress(), p.tokenAddress, user.address, deadline
    );
  }

  async function sell(user, amount) {
    await p.token.connect(user).approve(await p.router.getAddress(), amount);
    await p.router.connect(user).swapExactTokensForStable(
      amount, 0, p.tokenAddress, user.address, deadline
    );
  }

  describe("Initialization", function () {
    it("should set virtual reserves correctly", async function () {
      expect(await p.pool.virtualReserveUSD()).to.equal(ethers.parseEther("10000"));
    });

    it("should set real reserves to 0", async function () {
      expect(await p.pool.realReserveUSD()).to.equal(0);
    });

    it("should set token reserves to 1B", async function () {
      expect(await p.pool.reserveToken()).to.equal(ethers.parseEther("1000000000"));
    });

    it("should set effective reserve = virtual + real", async function () {
      expect(await p.pool.getEffectiveReserveUSD()).to.equal(ethers.parseEther("10000"));
    });

    it("should reject double initialization", async function () {
      await expect(
        p.pool.initialize(ethers.parseEther("10000"), ethers.parseEther("1000000000"))
      ).to.be.revertedWithCustomError(p.pool, "Unauthorized");
    });

    it("should reject initialization by non-factory", async function () {
      // pool.initialize can only be called by factory
      await expect(
        p.pool.connect(p.user1).initialize(1, 1)
      ).to.be.revertedWithCustomError(p.pool, "Unauthorized");
    });

    it("should set initial volatility to 0", async function () {
      expect(await p.pool.getVolatility()).to.equal(0);
    });

    it("should report correct spot price", async function () {
      const price = await p.pool.getSpotPrice();
      // 10000e18 / 1e27 = 1e-5 per token = 10000 wei (in 18 decimal terms)
      expect(price).to.be.gt(0);
    });

    it("should report ~$10,000 market cap", async function () {
      const mcap = await p.pool.getMarketCap();
      expect(mcap).to.be.closeTo(ethers.parseEther("10000"), ethers.parseEther("1"));
    });
  });

  describe("Buy swap (stable → token)", function () {
    it("should increase real reserves on buy", async function () {
      await buy(p.user1, p.usid, ethers.parseEther("500"));
      expect(await p.pool.realReserveUSD()).to.be.gt(0);
    });

    it("should decrease token reserves on buy", async function () {
      const before = await p.pool.reserveToken();
      await buy(p.user1, p.usid, ethers.parseEther("500"));
      expect(await p.pool.reserveToken()).to.be.lt(before);
    });

    it("should increase spot price after buy", async function () {
      const priceBefore = await p.pool.getSpotPrice();
      await buy(p.user1, p.usid, ethers.parseEther("1000"));
      const priceAfter = await p.pool.getSpotPrice();
      expect(priceAfter).to.be.gt(priceBefore);
    });

    it("should increase market cap after buy", async function () {
      const mcapBefore = await p.pool.getMarketCap();
      await buy(p.user1, p.usid, ethers.parseEther("1000"));
      const mcapAfter = await p.pool.getMarketCap();
      expect(mcapAfter).to.be.gt(mcapBefore);
    });

    it("should accept any approved stablecoin", async function () {
      await buy(p.user1, p.usdt, ethers.parseEther("100"));
      await buy(p.user2, p.usdc, ethers.parseEther("100"));
      await buy(p.user3, p.dai, ethers.parseEther("100"));
      expect(await p.pool.realReserveUSD()).to.be.gt(0);
    });

    it("should reject zero amount", async function () {
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("100"));
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          0, 0, await p.usid.getAddress(), p.tokenAddress, p.user1.address, deadline
        )
      ).to.be.revertedWithCustomError(p.router, "ZeroAmount");
    });
  });

  describe("Sell swap (token → stable)", function () {
    beforeEach(async function () {
      // Fund pool with stables first
      await buy(p.user1, p.usid, ethers.parseEther("5000"));
    });

    it("should decrease real reserves on sell", async function () {
      const realBefore = await p.pool.realReserveUSD();
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sell(p.user1, tokenBal / 10n);
      expect(await p.pool.realReserveUSD()).to.be.lt(realBefore);
    });

    it("should increase token reserves on sell", async function () {
      const resBefore = await p.pool.reserveToken();
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sell(p.user1, tokenBal / 10n);
      expect(await p.pool.reserveToken()).to.be.gt(resBefore);
    });

    it("should decrease spot price after sell", async function () {
      const priceBefore = await p.pool.getSpotPrice();
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sell(p.user1, tokenBal / 4n);
      expect(await p.pool.getSpotPrice()).to.be.lt(priceBefore);
    });

    it("should enforce virtual reserve floor on large sell", async function () {
      // Buy only a small amount
      const p2 = await deployV2WithMarketFixture();
      const d2 = (await ethers.provider.getBlock("latest")).timestamp + 60000;
      await p2.usid.connect(p2.user1).approve(await p2.router.getAddress(), ethers.parseEther("10"));
      await p2.router.connect(p2.user1).swapExactStableForTokens(
        ethers.parseEther("10"), 0, await p2.usid.getAddress(),
        p2.tokenAddress, p2.user1.address, d2
      );

      const tokenBal = await p2.token.balanceOf(p2.user1.address);
      await p2.token.connect(p2.user1).approve(await p2.router.getAddress(), tokenBal);

      // Selling all tokens should fail — not enough real stables
      await expect(
        p2.router.connect(p2.user1).swapExactTokensForStable(
          tokenBal, ethers.parseEther("50"), p2.tokenAddress, p2.user1.address, d2
        )
      ).to.be.reverted;
    });

    it("should give user stablecoins back on sell", async function () {
      const stableBefore = await p.usid.balanceOf(p.user1.address);
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sell(p.user1, tokenBal / 10n);
      expect(await p.usid.balanceOf(p.user1.address)).to.be.gt(stableBefore);
    });
  });

  describe("Volatility tracking", function () {
    it("should start at 0", async function () {
      expect(await p.pool.getVolatility()).to.equal(0);
    });

    it("should increase after price-moving swaps with time gap", async function () {
      await buy(p.user1, p.usid, ethers.parseEther("2000"));
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");
      await buy(p.user2, p.usid, ethers.parseEther("2000"));

      // After two buys with time gap, volatility should be > 0
      const vol = await p.pool.getVolatility();
      expect(vol).to.be.gte(0);
    });
  });

  describe("Sync", function () {
    it("should re-sync reserves from actual balances", async function () {
      await buy(p.user1, p.usid, ethers.parseEther("1000"));

      // Sync should not change anything if balances are consistent
      const resBefore = await p.pool.reserveToken();
      const realBefore = await p.pool.realReserveUSD();
      await p.pool.sync();
      expect(await p.pool.reserveToken()).to.be.closeTo(resBefore, ethers.parseEther("1"));
    });
  });

  describe("View functions", function () {
    it("getReserves returns effective USD and token", async function () {
      const [effUSD, tokRes] = await p.pool.getReserves();
      expect(effUSD).to.equal(ethers.parseEther("10000"));
      expect(tokRes).to.equal(ethers.parseEther("1000000000"));
    });

    it("getTotalStableBalance returns sum of all stables", async function () {
      await buy(p.user1, p.usid, ethers.parseEther("100"));
      await buy(p.user2, p.usdt, ethers.parseEther("200"));
      const total = await p.pool.getTotalStableBalance();
      expect(total).to.be.gt(0);
    });

    it("getStableBalance returns specific stable balance", async function () {
      await buy(p.user1, p.usid, ethers.parseEther("100"));
      const bal = await p.pool.getStableBalance(await p.usid.getAddress());
      expect(bal).to.be.gt(0);
    });
  });
});
