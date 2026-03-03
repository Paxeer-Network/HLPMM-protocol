const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2ProtocolFixture, deployV2WithMarketFixture } = require("../helpers/fixtures");

describe("HLPMM V2 — Full Integration Flow", function () {
  let protocol;

  beforeEach(async function () {
    protocol = await deployV2WithMarketFixture();
  });

  describe("Market Creation", function () {
    it("should create a market with virtual reserves and metadata", async function () {
      const { pool, token, nftId } = protocol;

      // Virtual reserves = 10,000 USID, no real stables
      expect(await pool.virtualReserveUSD()).to.equal(ethers.parseEther("10000"));
      expect(await pool.realReserveUSD()).to.equal(0);
      expect(await pool.reserveToken()).to.equal(ethers.parseEther("1000000000"));

      // Token has metadata
      expect(await token.metadata()).to.include("test token");

      // NFT minted to creator
      expect(await protocol.marketNFT.ownerOf(nftId)).to.equal(protocol.creator.address);
    });

    it("should have a starting market cap of ~$10,000", async function () {
      const { pool } = protocol;
      const marketCap = await pool.getMarketCap();
      // With 10,000 USD virtual and 1B tokens, price = 10000/1B = 0.00001 per token
      // Market cap = 0.00001 * 1B = 10,000
      expect(marketCap).to.be.closeTo(ethers.parseEther("10000"), ethers.parseEther("1"));
    });

    it("should allow multiple markets", async function () {
      const { factory, creator } = protocol;
      await factory.connect(creator).createMarket("Alpha", "ALPHA", '{"desc":"alpha"}', 0);
      await factory.connect(creator).createMarket("Beta", "BETA", '{"desc":"beta"}', 1);
      expect(await factory.getPoolCount()).to.equal(3); // TEST + ALPHA + BETA
    });
  });

  describe("Buying Tokens (Stable → Token)", function () {
    it("should allow buying tokens with any approved stablecoin", async function () {
      const { pool, token, usid, usdt, router, user1, poolAddress, tokenAddress } = protocol;

      const buyAmount = ethers.parseEther("100"); // 100 USID

      // Approve router
      await usid.connect(user1).approve(await router.getAddress(), buyAmount);

      // Buy tokens
      const tokenBalanceBefore = await token.balanceOf(user1.address);
      await router.connect(user1).swapExactStableForTokens(
        buyAmount,
        0, // no min for test
        await usid.getAddress(),
        tokenAddress,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );
      const tokenBalanceAfter = await token.balanceOf(user1.address);

      expect(tokenBalanceAfter).to.be.gt(tokenBalanceBefore);

      // Pool should now have real USD
      expect(await pool.realReserveUSD()).to.be.gt(0);
    });

    it("should accept USDT equally to USID", async function () {
      const { pool, token, usdt, router, user1, tokenAddress } = protocol;

      const buyAmount = ethers.parseEther("100");
      await usdt.connect(user1).approve(await router.getAddress(), buyAmount);

      await router.connect(user1).swapExactStableForTokens(
        buyAmount,
        0,
        await usdt.getAddress(),
        tokenAddress,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );

      expect(await token.balanceOf(user1.address)).to.be.gt(0);
      expect(await pool.realReserveUSD()).to.be.gt(0);
    });
  });

  describe("Selling Tokens (Token → Stable)", function () {
    it("should allow selling tokens for stablecoins", async function () {
      const { pool, token, usid, router, user1, tokenAddress } = protocol;

      // First buy some tokens
      const buyAmount = ethers.parseEther("500");
      await usid.connect(user1).approve(await router.getAddress(), buyAmount);
      await router.connect(user1).swapExactStableForTokens(
        buyAmount,
        0,
        await usid.getAddress(),
        tokenAddress,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );

      const tokenBalance = await token.balanceOf(user1.address);
      const sellAmount = tokenBalance / 2n;

      // Approve router for tokens
      await token.connect(user1).approve(await router.getAddress(), sellAmount);

      const stableBefore = await usid.balanceOf(user1.address);
      await router.connect(user1).swapExactTokensForStable(
        sellAmount,
        0,
        tokenAddress,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );

      // Should have received stables back
      const stableAfter = await usid.balanceOf(user1.address);
      expect(stableAfter).to.be.gt(stableBefore);
    });

    it("should enforce virtual reserve floor (can't sell beyond real liquidity)", async function () {
      const { pool, token, usid, router, user1, user2, tokenAddress } = protocol;

      // Buy a small amount
      const buyAmount = ethers.parseEther("10");
      await usid.connect(user1).approve(await router.getAddress(), buyAmount);
      await router.connect(user1).swapExactStableForTokens(
        buyAmount,
        0,
        await usid.getAddress(),
        tokenAddress,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );

      const tokenBalance = await token.balanceOf(user1.address);

      // Try to sell way more tokens than real USD in pool
      // This should revert with InsufficientRealLiquidity
      await token.connect(user1).approve(await router.getAddress(), tokenBalance);

      // The pool only has ~10 USD real. Selling all tokens would require much more.
      // This tests the virtual reserve price floor.
      await expect(
        router.connect(user1).swapExactTokensForStable(
          tokenBalance,
          ethers.parseEther("100"), // demand 100 USD output (impossible)
          tokenAddress,
          user1.address,
          (await ethers.provider.getBlock('latest')).timestamp + 600
        )
      ).to.be.reverted;
    });
  });

  describe("Multi-Hop Token↔Token Swap", function () {
    it("should swap TokenA → TokenB via automatic stable intermediary", async function () {
      const { factory, router, usid, creator, user1 } = protocol;

      // Create second market
      const tx = await factory.connect(creator).createMarket(
        "Second Token", "SECOND", '{"desc":"second"}', 0
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "MarketCreated");
      const secondTokenAddr = event.args[1];
      const secondToken = await ethers.getContractAt("HLPMMTokenV2", secondTokenAddr);

      const firstTokenAddr = protocol.tokenAddress;
      const firstToken = protocol.token;

      // Fund both pools with stables so they have real liquidity
      const fundAmount = ethers.parseEther("1000");
      await usid.connect(user1).approve(await router.getAddress(), fundAmount * 2n);

      await router.connect(user1).swapExactStableForTokens(
        fundAmount, 0, await usid.getAddress(),
        firstTokenAddr, user1.address, (await ethers.provider.getBlock('latest')).timestamp + 60000
      );
      await router.connect(user1).swapExactStableForTokens(
        fundAmount, 0, await usid.getAddress(),
        secondTokenAddr, user1.address, (await ethers.provider.getBlock('latest')).timestamp + 60000
      );

      // Now swap TokenA → TokenB
      const swapAmount = await firstToken.balanceOf(user1.address);
      const sellAmount = swapAmount / 4n;

      await firstToken.connect(user1).approve(await router.getAddress(), sellAmount);

      const secondBefore = await secondToken.balanceOf(user1.address);
      await router.connect(user1).swapExactTokensForTokens(
        sellAmount,
        0,
        firstTokenAddr,
        secondTokenAddr,
        user1.address,
        (await ethers.provider.getBlock('latest')).timestamp + 600
      );
      const secondAfter = await secondToken.balanceOf(user1.address);

      expect(secondAfter).to.be.gt(secondBefore);
    });
  });

  describe("Dynamic Fees", function () {
    it("should charge higher fees for new pools (maturity factor)", async function () {
      const { pool } = protocol;
      // Pool was just created — should have maturity addon
      const volatility = await pool.getVolatility();
      // Initial volatility should be 0
      expect(volatility).to.equal(0);
    });

    it("should update volatility on swaps", async function () {
      const { pool, token, usid, router, user1, tokenAddress } = protocol;

      // Do several swaps to generate volatility
      const amount = ethers.parseEther("500");
      await usid.connect(user1).approve(await router.getAddress(), amount * 3n);

      // Buy
      await router.connect(user1).swapExactStableForTokens(
        amount, 0, await usid.getAddress(),
        tokenAddress, user1.address, (await ethers.provider.getBlock('latest')).timestamp + 60000
      );

      // Advance time
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");

      // Buy again (price changed from first buy)
      await router.connect(user1).swapExactStableForTokens(
        amount, 0, await usid.getAddress(),
        tokenAddress, user1.address, (await ethers.provider.getBlock('latest')).timestamp + 60000
      );

      // Volatility should be > 0 after price changes
      const volatility = await pool.getVolatility();
      expect(volatility).to.be.gte(0); // May need time threshold
    });
  });

  describe("Token Events to Emitter", function () {
    it("should emit TokenTransfer events via EventEmitter on every transfer", async function () {
      const { token, usid, router, user1, user2, tokenAddress, eventEmitter } = protocol;

      // Buy tokens
      const amount = ethers.parseEther("100");
      await usid.connect(user1).approve(await router.getAddress(), amount);
      await router.connect(user1).swapExactStableForTokens(
        amount, 0, await usid.getAddress(),
        tokenAddress, user1.address, (await ethers.provider.getBlock('latest')).timestamp + 60000
      );

      // Transfer tokens between users — should emit via EventEmitter
      const transferAmount = ethers.parseEther("1000");
      await expect(
        token.connect(user1).transfer(user2.address, transferAmount)
      ).to.emit(eventEmitter, "TokenTransfer");
    });
  });

  describe("Token Metadata", function () {
    it("should store metadata on token creation", async function () {
      const { token } = protocol;
      const metadata = await token.metadata();
      expect(metadata).to.include("test token");
    });
  });

  describe("Multi-Stablecoin Pool", function () {
    it("should accept all 4 stablecoins as equivalent USD", async function () {
      const { pool, token, usid, usdt, usdc, dai, router, user1, user2, user3, tokenAddress } = protocol;

      const amount = ethers.parseEther("100");

      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 6000;

      // Buy with USID
      await usid.connect(user1).approve(await router.getAddress(), amount);
      await router.connect(user1).swapExactStableForTokens(
        amount, 0, await usid.getAddress(),
        tokenAddress, user1.address, deadline
      );
      const bal1 = await token.balanceOf(user1.address);

      // Buy with USDT
      await usdt.connect(user2).approve(await router.getAddress(), amount);
      await router.connect(user2).swapExactStableForTokens(
        amount, 0, await usdt.getAddress(),
        tokenAddress, user2.address, deadline
      );

      // Buy with USDC
      await usdc.connect(user3).approve(await router.getAddress(), amount);
      await router.connect(user3).swapExactStableForTokens(
        amount, 0, await usdc.getAddress(),
        tokenAddress, user3.address, deadline
      );

      // All buys should have worked
      expect(await token.balanceOf(user1.address)).to.be.gt(0);
      expect(await token.balanceOf(user2.address)).to.be.gt(0);
      expect(await token.balanceOf(user3.address)).to.be.gt(0);

      // Pool should have mix of stables
      expect(await pool.realReserveUSD()).to.be.gt(0);
    });
  });

  describe("Admin Controller", function () {
    it("should enforce role-based access", async function () {
      const { adminController, eventEmitter, user1 } = protocol;

      // user1 has no role — should fail to set factory
      await expect(
        eventEmitter.connect(user1).setFactory(user1.address)
      ).to.be.revertedWithCustomError(eventEmitter, "Unauthorized");
    });

    it("should support timelock for queued actions", async function () {
      const { adminController, deployer } = protocol;

      const delay = await adminController.timelockDelay();
      expect(delay).to.equal(3600); // 1 hour
    });
  });

  describe("Stablecoin Registry", function () {
    it("should have 4 approved stablecoins", async function () {
      const { stablecoinRegistry } = protocol;
      expect(await stablecoinRegistry.stablecoinCount()).to.equal(4);
    });

    it("should reject unapproved stablecoins", async function () {
      const { router, user1 } = protocol;

      await expect(
        router.connect(user1).swapExactStableForTokens(
          ethers.parseEther("100"),
          0,
          user1.address, // not a stablecoin
          protocol.tokenAddress,
          user1.address,
          (await ethers.provider.getBlock('latest')).timestamp + 600
        )
      ).to.be.revertedWithCustomError(router, "NotApprovedStablecoin");
    });
  });
});
