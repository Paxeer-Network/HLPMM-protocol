const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2WithMarketFixture } = require("../helpers/fixtures");

describe("Fee Claim End-to-End — The Critical Path", function () {
  let p; // protocol
  let deadline;

  beforeEach(async function () {
    p = await deployV2WithMarketFixture();
    deadline = (await ethers.provider.getBlock("latest")).timestamp + 60000;
  });

  async function buyTokens(user, stable, amount) {
    await stable.connect(user).approve(await p.router.getAddress(), amount);
    await p.router.connect(user).swapExactStableForTokens(
      amount, 0, await stable.getAddress(), p.tokenAddress, user.address, deadline
    );
  }

  async function sellTokens(user, amount) {
    await p.token.connect(user).approve(await p.router.getAddress(), amount);
    await p.router.connect(user).swapExactTokensForStable(
      amount, 0, p.tokenAddress, user.address, deadline
    );
  }

  describe("Fee accumulation from BUY swaps (stable → token)", function () {
    it("should accumulate real stablecoins in FeeCollector on buy", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));

      const pending = await p.feeCollector.pendingFees(p.nftId);
      expect(pending).to.be.gt(0);

      // FeeCollector should actually hold stablecoins
      const fcBalance = await p.usid.balanceOf(await p.feeCollector.getAddress());
      expect(fcBalance).to.be.gt(0);
      expect(fcBalance).to.be.closeTo(pending, ethers.parseEther("1")); // close, not exact due to rounding
    });

    it("should allow NFT owner to claim fees after buy swap", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));

      const pending = await p.feeCollector.pendingFees(p.nftId);
      expect(pending).to.be.gt(0);

      // Creator owns the NFT — claim fees
      const creatorBalBefore = await p.usid.balanceOf(p.creator.address);
      await p.marketNFT.connect(p.creator).claimFees(p.nftId);
      const creatorBalAfter = await p.usid.balanceOf(p.creator.address);

      expect(creatorBalAfter - creatorBalBefore).to.be.gt(0);
      expect(await p.feeCollector.pendingFees(p.nftId)).to.equal(0);
    });
  });

  describe("Fee accumulation from SELL swaps (token → stable)", function () {
    it("should accumulate real stablecoins in FeeCollector on sell", async function () {
      // First buy tokens
      await buyTokens(p.user1, p.usid, ethers.parseEther("5000"));

      // Claim buy-side fees first to start clean
      await p.marketNFT.connect(p.creator).claimFees(p.nftId);

      // Now sell tokens
      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sellTokens(p.user1, tokenBal / 4n);

      const pendingAfterSell = await p.feeCollector.pendingFees(p.nftId);
      expect(pendingAfterSell).to.be.gt(0);

      // FeeCollector should hold real stablecoins for the sell-side fee too
      const fcBalance = await p.usid.balanceOf(await p.feeCollector.getAddress());
      expect(fcBalance).to.be.gt(0);
    });

    it("should allow NFT owner to claim sell-side fees", async function () {
      // Buy then sell to generate sell-side fees
      await buyTokens(p.user1, p.usid, ethers.parseEther("5000"));
      await p.marketNFT.connect(p.creator).claimFees(p.nftId); // clear buy fees

      const tokenBal = await p.token.balanceOf(p.user1.address);
      await sellTokens(p.user1, tokenBal / 4n);

      const pending = await p.feeCollector.pendingFees(p.nftId);
      expect(pending).to.be.gt(0);

      // Claim sell-side fees
      const creatorBalBefore = await p.usid.balanceOf(p.creator.address);
      await p.marketNFT.connect(p.creator).claimFees(p.nftId);
      const creatorBalAfter = await p.usid.balanceOf(p.creator.address);

      const claimed = creatorBalAfter - creatorBalBefore;
      expect(claimed).to.be.gt(0);
      expect(await p.feeCollector.pendingFees(p.nftId)).to.equal(0);
    });
  });

  describe("Fee accumulation from MIXED swaps", function () {
    it("should accumulate fees from multiple buys and sells then claim all", async function () {
      // Multiple buys with different stablecoins
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));
      await buyTokens(p.user2, p.usdt, ethers.parseEther("1000"));
      await buyTokens(p.user3, p.usdc, ethers.parseEther("1000"));

      // Sell some
      const tok1 = await p.token.balanceOf(p.user1.address);
      await sellTokens(p.user1, tok1 / 4n);

      const pending = await p.feeCollector.pendingFees(p.nftId);
      expect(pending).to.be.gt(0);

      // Claim all accumulated fees
      const creatorBalBefore = await p.usid.balanceOf(p.creator.address);
      const creatorUsdtBefore = await p.usdt.balanceOf(p.creator.address);
      const creatorUsdcBefore = await p.usdc.balanceOf(p.creator.address);

      await p.marketNFT.connect(p.creator).claimFees(p.nftId);

      // Creator should have received stables (could be any mix)
      const gotUsid = (await p.usid.balanceOf(p.creator.address)) - creatorBalBefore;
      const gotUsdt = (await p.usdt.balanceOf(p.creator.address)) - creatorUsdtBefore;
      const gotUsdc = (await p.usdc.balanceOf(p.creator.address)) - creatorUsdcBefore;
      const totalClaimed = gotUsid + gotUsdt + gotUsdc;

      expect(totalClaimed).to.be.gt(0);
    });
  });

  describe("Fee strategy variations", function () {
    it("BURN strategy should send fees to dead address", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));

      // Change strategy to BURN
      await p.marketNFT.connect(p.creator).setFeeStrategy(p.nftId, 1); // BURN

      const deadBalBefore = await p.usid.balanceOf("0x000000000000000000000000000000000000dEaD");
      await p.marketNFT.connect(p.creator).claimFees(p.nftId);
      const deadBalAfter = await p.usid.balanceOf("0x000000000000000000000000000000000000dEaD");

      expect(deadBalAfter - deadBalBefore).to.be.gt(0);
    });

    it("CLAIM strategy should send fees to NFT owner", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));

      const creatorBalBefore = await p.usid.balanceOf(p.creator.address);
      await p.marketNFT.connect(p.creator).claimFees(p.nftId);
      const creatorBalAfter = await p.usid.balanceOf(p.creator.address);

      expect(creatorBalAfter - creatorBalBefore).to.be.gt(0);
    });

    it("should revert when no fees to distribute", async function () {
      await expect(
        p.marketNFT.connect(p.creator).claimFees(p.nftId)
      ).to.be.revertedWithCustomError(p.feeCollector, "NoFeesToDistribute");
    });
  });

  describe("Permission checks on fee claiming", function () {
    it("should revert when non-owner tries to claim fees", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("100"));
      await expect(
        p.marketNFT.connect(p.user1).claimFees(p.nftId)
      ).to.be.revertedWithCustomError(p.marketNFT, "NotOwnerOrApproved");
    });

    it("should allow approved operator to claim fees", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("100"));

      // Approve user1 as operator for all NFTs
      await p.marketNFT.connect(p.creator).setApprovalForAll(p.user1.address, true);

      // user1 can now claim
      await expect(
        p.marketNFT.connect(p.user1).claimFees(p.nftId)
      ).to.not.be.reverted;
    });

    it("should allow single-token approved address to claim fees", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("100"));

      // Approve user1 for this specific NFT
      await p.marketNFT.connect(p.creator).approve(p.user1.address, p.nftId);

      await expect(
        p.marketNFT.connect(p.user1).claimFees(p.nftId)
      ).to.not.be.reverted;
    });

    it("should send fees to NFT owner even when claimed by approved operator", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("500"));
      await p.marketNFT.connect(p.creator).setApprovalForAll(p.user2.address, true);

      const creatorBalBefore = await p.usid.balanceOf(p.creator.address);
      const user2BalBefore = await p.usid.balanceOf(p.user2.address);

      // user2 claims on behalf of creator
      await p.marketNFT.connect(p.user2).claimFees(p.nftId);

      const creatorBalAfter = await p.usid.balanceOf(p.creator.address);
      const user2BalAfter = await p.usid.balanceOf(p.user2.address);

      // Fees go to NFT OWNER (creator), not the caller (user2)
      expect(creatorBalAfter - creatorBalBefore).to.be.gt(0);
      expect(user2BalAfter).to.equal(user2BalBefore);
    });

    it("should revert if FeeCollector.distributeFees called by non-marketNFT", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("100"));
      await expect(
        p.feeCollector.connect(p.user1).distributeFees(p.nftId, p.user1.address, 0)
      ).to.be.revertedWithCustomError(p.feeCollector, "Unauthorized");
    });
  });

  describe("NFT transfer and fee ownership", function () {
    it("fees should go to NEW owner after NFT transfer", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("1000"));

      // Transfer NFT from creator to user2
      await p.marketNFT.connect(p.creator).transferFrom(
        p.creator.address, p.user2.address, p.nftId
      );

      // user2 is now the owner
      expect(await p.marketNFT.ownerOf(p.nftId)).to.equal(p.user2.address);

      // user2 claims fees
      const user2Before = await p.usid.balanceOf(p.user2.address);
      await p.marketNFT.connect(p.user2).claimFees(p.nftId);
      const user2After = await p.usid.balanceOf(p.user2.address);

      expect(user2After - user2Before).to.be.gt(0);

      // Creator should NOT have received anything
      // (we can't check this perfectly since creator had existing balance)
    });

    it("old owner cannot claim after transfer", async function () {
      await buyTokens(p.user1, p.usid, ethers.parseEther("100"));
      await p.marketNFT.connect(p.creator).transferFrom(
        p.creator.address, p.user2.address, p.nftId
      );

      await expect(
        p.marketNFT.connect(p.creator).claimFees(p.nftId)
      ).to.be.revertedWithCustomError(p.marketNFT, "NotOwnerOrApproved");
    });
  });
});
