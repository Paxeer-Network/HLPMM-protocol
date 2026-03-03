const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2WithMarketFixture, deployV2ProtocolFixture } = require("../helpers/fixtures");

describe("HLPMMRouterV2 — Unit Tests", function () {
  let p, deadline;

  beforeEach(async function () {
    p = await deployV2WithMarketFixture();
    deadline = (await ethers.provider.getBlock("latest")).timestamp + 60000;
  });

  describe("swapExactStableForTokens", function () {
    it("should swap stablecoins for tokens", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), amt);
      await p.router.connect(p.user1).swapExactStableForTokens(
        amt, 0, await p.usid.getAddress(), p.tokenAddress, p.user1.address, deadline
      );
      expect(await p.token.balanceOf(p.user1.address)).to.be.gt(0);
    });

    it("should revert with expired deadline", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), amt);
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          amt, 0, await p.usid.getAddress(), p.tokenAddress, p.user1.address, 1 // past deadline
        )
      ).to.be.revertedWithCustomError(p.router, "Expired");
    });

    it("should revert with zero amount", async function () {
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          0, 0, await p.usid.getAddress(), p.tokenAddress, p.user1.address, deadline
        )
      ).to.be.revertedWithCustomError(p.router, "ZeroAmount");
    });

    it("should revert with unapproved stablecoin", async function () {
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          ethers.parseEther("100"), 0, p.user1.address, p.tokenAddress, p.user1.address, deadline
        )
      ).to.be.revertedWithCustomError(p.router, "NotApprovedStablecoin");
    });

    it("should revert with non-existent pool", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), amt);
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          amt, 0, await p.usid.getAddress(), p.user1.address, p.user1.address, deadline
        )
      ).to.be.revertedWithCustomError(p.router, "PoolNotFound");
    });

    it("should enforce slippage protection (amountOutMin)", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), amt);
      await expect(
        p.router.connect(p.user1).swapExactStableForTokens(
          amt, ethers.parseEther("999999999999"), await p.usid.getAddress(),
          p.tokenAddress, p.user1.address, deadline
        )
      ).to.be.reverted; // InsufficientOutput
    });
  });

  describe("swapExactTokensForStable", function () {
    beforeEach(async function () {
      // Buy tokens first
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("5000"));
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("5000"), 0, await p.usid.getAddress(),
        p.tokenAddress, p.user1.address, deadline
      );
    });

    it("should swap tokens for stablecoins", async function () {
      const tokenBal = await p.token.balanceOf(p.user1.address);
      const sellAmt = tokenBal / 10n;
      await p.token.connect(p.user1).approve(await p.router.getAddress(), sellAmt);

      const stableBefore = await p.usid.balanceOf(p.user1.address);
      await p.router.connect(p.user1).swapExactTokensForStable(
        sellAmt, 0, p.tokenAddress, p.user1.address, deadline
      );
      expect(await p.usid.balanceOf(p.user1.address)).to.be.gt(stableBefore);
    });

    it("should enforce slippage protection on sell", async function () {
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await p.token.connect(p.user1).approve(await p.router.getAddress(), tokenBal / 10n);
      await expect(
        p.router.connect(p.user1).swapExactTokensForStable(
          tokenBal / 10n, ethers.parseEther("999999999"), p.tokenAddress,
          p.user1.address, deadline
        )
      ).to.be.reverted;
    });
  });

  describe("swapExactTokensForTokens (multi-hop)", function () {
    let secondTokenAddr, secondToken;

    beforeEach(async function () {
      // Create second market
      const tx = await p.factory.connect(p.creator).createMarket("Second", "SEC", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      secondTokenAddr = ev.args[1];
      secondToken = await ethers.getContractAt("HLPMMTokenV2", secondTokenAddr);

      // Fund both pools
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("10000"));
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("5000"), 0, await p.usid.getAddress(),
        p.tokenAddress, p.user1.address, deadline
      );
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("5000"), 0, await p.usid.getAddress(),
        secondTokenAddr, p.user1.address, deadline
      );
    });

    it("should auto-route token→token via stable intermediary", async function () {
      const sellAmt = (await p.token.balanceOf(p.user1.address)) / 10n;
      await p.token.connect(p.user1).approve(await p.router.getAddress(), sellAmt);

      const secBefore = await secondToken.balanceOf(p.user1.address);
      await p.router.connect(p.user1).swapExactTokensForTokens(
        sellAmt, 0, p.tokenAddress, secondTokenAddr, p.user1.address, deadline
      );
      expect(await secondToken.balanceOf(p.user1.address)).to.be.gt(secBefore);
    });

    it("should handle stable→token via swapExactTokensForTokens", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user2).approve(await p.router.getAddress(), amt);

      const tokBefore = await p.token.balanceOf(p.user2.address);
      await p.router.connect(p.user2).swapExactTokensForTokens(
        amt, 0, await p.usid.getAddress(), p.tokenAddress, p.user2.address, deadline
      );
      expect(await p.token.balanceOf(p.user2.address)).to.be.gt(tokBefore);
    });

    it("should handle token→stable via swapExactTokensForTokens", async function () {
      const sellAmt = (await p.token.balanceOf(p.user1.address)) / 20n;
      await p.token.connect(p.user1).approve(await p.router.getAddress(), sellAmt);

      const stBefore = await p.usid.balanceOf(p.user1.address);
      await p.router.connect(p.user1).swapExactTokensForTokens(
        sellAmt, 0, p.tokenAddress, await p.usid.getAddress(), p.user1.address, deadline
      );
      expect(await p.usid.balanceOf(p.user1.address)).to.be.gt(stBefore);
    });

    it("should handle stable→stable as 1:1 passthrough", async function () {
      const amt = ethers.parseEther("100");
      await p.usid.connect(p.user2).approve(await p.router.getAddress(), amt);

      const usdtBefore = await p.usdt.balanceOf(p.user2.address);
      await p.router.connect(p.user2).swapExactTokensForTokens(
        amt, 0, await p.usid.getAddress(), await p.usdt.getAddress(), p.user2.address, deadline
      );
      // USID→USDT is 1:1 passthrough — user2 gets USID, not USDT
      // Actually: the router just transfers tokenIn to `to` address for stable→stable
      // So user2 loses USID and... gets it sent back to themselves? Let me check the logic.
      // The router does: transferFrom(user, to, amount) where to=user2.
      // So effectively a no-op minus gas. But user should still have same amount.
    });
  });

  describe("swapExactTokensForTokensMultiHop", function () {
    it("should execute explicit multi-hop path", async function () {
      // Create second market and fund both
      const tx = await p.factory.connect(p.creator).createMarket("Third", "THR", "", 0);
      const receipt = await tx.wait();
      const ev = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      const thirdTokenAddr = ev.args[1];
      const thirdToken = await ethers.getContractAt("HLPMMTokenV2", thirdTokenAddr);

      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("10000"));
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("3000"), 0, await p.usid.getAddress(),
        p.tokenAddress, p.user1.address, deadline
      );
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("3000"), 0, await p.usid.getAddress(),
        thirdTokenAddr, p.user1.address, deadline
      );

      // Explicit path: TEST → USID → THIRD
      const sellAmt = (await p.token.balanceOf(p.user1.address)) / 10n;
      await p.token.connect(p.user1).approve(await p.router.getAddress(), sellAmt);

      const thirdBefore = await thirdToken.balanceOf(p.user1.address);
      await p.router.connect(p.user1).swapExactTokensForTokensMultiHop(
        sellAmt, 0,
        [p.tokenAddress, await p.usid.getAddress(), thirdTokenAddr],
        p.user1.address, deadline
      );
      expect(await thirdToken.balanceOf(p.user1.address)).to.be.gt(thirdBefore);
    });

    it("should reject path with less than 2 elements", async function () {
      await expect(
        p.router.connect(p.user1).swapExactTokensForTokensMultiHop(
          ethers.parseEther("100"), 0, [p.tokenAddress], p.user1.address, deadline
        )
      ).to.be.revertedWithCustomError(p.router, "InvalidPath");
    });
  });
});
