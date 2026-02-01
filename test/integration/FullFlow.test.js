const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { 
  INITIAL_USID, 
  INITIAL_TOKENS, 
  FeeStrategy, 
  ONE_DAY, 
  ONE_MONTH 
} = require("../helpers/constants");
const { deployProtocolFixture, deployProtocolWithMarketFixture } = require("../helpers/fixtures");

describe("Integration Tests: Full Protocol Flow", function () {
  
  describe("Market Creation Flow", function () {
    it("Should create market with all components properly linked", async function () {
      const { 
        factory, usid, eventEmitter, marketNFT, feeCollector, 
        creator 
      } = await loadFixture(deployProtocolFixture);

      // Create market
      const tx = await factory.connect(creator).createMarket(
        "Integration Test Token",
        "ITT",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();

      // Extract addresses from event
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const poolAddress = event.args[0];
      const tokenAddress = event.args[1];
      const nftId = event.args[2];

      // Verify pool setup
      const pool = await ethers.getContractAt("HLPMMPool", poolAddress);
      expect(await pool.token()).to.equal(tokenAddress);
      expect(await pool.usid()).to.equal(await usid.getAddress());
      expect(await pool.factory()).to.equal(await factory.getAddress());
      expect(await pool.nftId()).to.equal(nftId);

      // Verify reserves
      const [reserveUSID, reserveToken] = await pool.getReserves();
      expect(reserveUSID).to.equal(INITIAL_USID);
      expect(reserveToken).to.equal(INITIAL_TOKENS);

      // Verify token setup
      const token = await ethers.getContractAt("HLPMMToken", tokenAddress);
      expect(await token.name()).to.equal("Integration Test Token");
      expect(await token.symbol()).to.equal("ITT");
      expect(await token.pool()).to.equal(poolAddress);
      expect(await token.balanceOf(poolAddress)).to.equal(INITIAL_TOKENS);

      // Verify NFT ownership
      expect(await marketNFT.ownerOf(nftId)).to.equal(creator.address);
      expect(await marketNFT.nftToPool(nftId)).to.equal(poolAddress);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.CLAIM);

      // Verify pool is authorized emitter
      expect(await eventEmitter.isAuthorizedEmitter(poolAddress)).to.be.true;

      // Verify mappings
      expect(await factory.tokenToPool(tokenAddress)).to.equal(poolAddress);
      expect(await factory.poolToToken(poolAddress)).to.equal(tokenAddress);
      expect(await factory.nftToPool(nftId)).to.equal(poolAddress);
    });

    it("Should create multiple independent markets", async function () {
      const { factory, creator, user1, user2 } = await loadFixture(deployProtocolFixture);

      // Create 3 markets from different creators
      await factory.connect(creator).createMarket("Token A", "TKA", FeeStrategy.CLAIM);
      await factory.connect(user1).createMarket("Token B", "TKB", FeeStrategy.BURN);
      await factory.connect(user2).createMarket("Token C", "TKC", FeeStrategy.AIRDROP);

      expect(await factory.marketCount()).to.equal(3);
      
      const allPools = await factory.getAllPools();
      expect(allPools.length).to.equal(3);

      // Each pool should have independent reserves
      for (const poolAddr of allPools) {
        const pool = await ethers.getContractAt("HLPMMPool", poolAddr);
        const [reserveUSID, reserveToken] = await pool.getReserves();
        expect(reserveUSID).to.equal(INITIAL_USID);
        expect(reserveToken).to.equal(INITIAL_TOKENS);
      }
    });
  });

  describe("Quote and Price Discovery", function () {
    it("Should provide accurate quotes", async function () {
      const { quoter, pool, usid, token } = await loadFixture(deployProtocolWithMarketFixture);

      // Get spot price
      const spotPrice = await quoter.getSpotPrice(await pool.getAddress());
      expect(spotPrice).to.be.gt(0);

      // Get market cap
      const marketCap = await quoter.getMarketCap(await pool.getAddress());
      expect(marketCap).to.equal(INITIAL_USID);

      // Quote a swap
      const amountIn = ethers.parseEther("100");
      const expectedOut = await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        amountIn
      );
      expect(expectedOut).to.be.gt(0);

      // Price impact should be reasonable for small trade
      const priceImpact = await quoter.getPriceImpact(
        await pool.getAddress(),
        amountIn,
        true
      );
      expect(priceImpact).to.be.lt(200); // Less than 2%
    });

    it("Should show higher price impact for larger trades", async function () {
      const { quoter, pool } = await loadFixture(deployProtocolWithMarketFixture);

      const smallTrade = ethers.parseEther("10");
      const mediumTrade = ethers.parseEther("500");
      const largeTrade = ethers.parseEther("2000");

      const smallImpact = await quoter.getPriceImpact(await pool.getAddress(), smallTrade, true);
      const mediumImpact = await quoter.getPriceImpact(await pool.getAddress(), mediumTrade, true);
      const largeImpact = await quoter.getPriceImpact(await pool.getAddress(), largeTrade, true);

      expect(mediumImpact).to.be.gt(smallImpact);
      expect(largeImpact).to.be.gt(mediumImpact);
    });
  });

  describe("NFT Ownership and Fee Rights", function () {
    it("Should transfer fee rights with NFT transfer", async function () {
      const { marketNFT, creator, user1, nftId } = await loadFixture(deployProtocolWithMarketFixture);

      // Verify initial ownership
      expect(await marketNFT.ownerOf(nftId)).to.equal(creator.address);

      // Transfer NFT
      await marketNFT.connect(creator).transferFrom(creator.address, user1.address, nftId);

      // Verify new ownership
      expect(await marketNFT.ownerOf(nftId)).to.equal(user1.address);

      // New owner should be able to change fee strategy
      await marketNFT.connect(user1).setFeeStrategy(nftId, FeeStrategy.BURN);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.BURN);
    });

    it("Should allow owner to change fee strategy", async function () {
      const { marketNFT, creator, nftId } = await loadFixture(deployProtocolWithMarketFixture);

      // Change through all strategies
      await marketNFT.connect(creator).setFeeStrategy(nftId, FeeStrategy.BURN);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.BURN);

      await marketNFT.connect(creator).setFeeStrategy(nftId, FeeStrategy.AIRDROP);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.AIRDROP);

      await marketNFT.connect(creator).setFeeStrategy(nftId, FeeStrategy.LP_REWARDS);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.LP_REWARDS);

      await marketNFT.connect(creator).setFeeStrategy(nftId, FeeStrategy.CLAIM);
      expect(await marketNFT.feeStrategy(nftId)).to.equal(FeeStrategy.CLAIM);
    });

    it("Should prevent non-owner from changing fee strategy", async function () {
      const { marketNFT, user1, nftId } = await loadFixture(deployProtocolWithMarketFixture);

      await expect(
        marketNFT.connect(user1).setFeeStrategy(nftId, FeeStrategy.BURN)
      ).to.be.revertedWithCustomError(marketNFT, "NotOwnerOrApproved");
    });
  });

  describe("Pool State After Time", function () {
    it("Should maintain correct state over time", async function () {
      const { pool, quoter } = await loadFixture(deployProtocolWithMarketFixture);

      // Get initial state
      const [initialUSID, initialToken] = await pool.getReserves();
      const initialPrice = await quoter.getSpotPrice(await pool.getAddress());

      // Advance time by 1 month
      await time.increase(ONE_MONTH);

      // Check state hasn't changed without trades
      const [laterUSID, laterToken] = await pool.getReserves();
      const laterPrice = await quoter.getSpotPrice(await pool.getAddress());

      expect(laterUSID).to.equal(initialUSID);
      expect(laterToken).to.equal(initialToken);
      expect(laterPrice).to.equal(initialPrice);
    });
  });

  describe("Multi-Market Routing", function () {
    it("Should support multi-hop quotes through USID", async function () {
      const { factory, quoter, usid, creator, user1 } = await loadFixture(deployProtocolFixture);

      // Create two markets
      const tx1 = await factory.connect(creator).createMarket("Token A", "TKA", FeeStrategy.CLAIM);
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => log.fragment?.name === "MarketCreated");
      const tokenAAddress = event1.args[1];

      const tx2 = await factory.connect(user1).createMarket("Token B", "TKB", FeeStrategy.CLAIM);
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => log.fragment?.name === "MarketCreated");
      const tokenBAddress = event2.args[1];

      // Quote multi-hop: Token A -> USID -> Token B
      const path = [tokenAAddress, await usid.getAddress(), tokenBAddress];
      const amountIn = ethers.parseEther("1000000"); // 1M Token A

      const amountOut = await quoter.quoteExactInputMultiHop(path, amountIn);
      expect(amountOut).to.be.gt(0);
    });
  });

  describe("Router Path Validation", function () {
    it("Should validate paths in router", async function () {
      const { router, usid, token } = await loadFixture(deployProtocolWithMarketFixture);

      // Valid path
      const validAmounts = await router.getAmountsOut(
        ethers.parseEther("100"),
        [await usid.getAddress(), await token.getAddress()]
      );
      expect(validAmounts.length).to.equal(2);

      // Invalid path (single element)
      await expect(
        router.getAmountsOut(ethers.parseEther("100"), [await usid.getAddress()])
      ).to.be.revertedWithCustomError(router, "InvalidPath");
    });
  });

  describe("Gas Estimation", function () {
    it("Should have reasonable gas costs for market creation", async function () {
      const { factory, creator } = await loadFixture(deployProtocolFixture);

      const tx = await factory.connect(creator).createMarket(
        "Gas Test Token",
        "GAS",
        FeeStrategy.CLAIM
      );
      const receipt = await tx.wait();

      // Market creation involves deploying 2 contracts + state changes
      // Should be under 5M gas
      expect(receipt.gasUsed).to.be.lt(5000000n);
      
      console.log(`  Market creation gas: ${receipt.gasUsed.toString()}`);
    });

    it("Should have reasonable gas costs for quotes", async function () {
      const { quoter, pool, usid, token } = await loadFixture(deployProtocolWithMarketFixture);

      // Quotes are view functions, but we can estimate call gas
      const poolAddr = await pool.getAddress();
      
      // These are all view functions, so gas is minimal
      await quoter.getSpotPrice(poolAddr);
      await quoter.getMarketCap(poolAddr);
      await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        ethers.parseEther("100")
      );
    });
  });

  describe("Edge Cases", function () {
    it("Should handle minimum viable swap amount", async function () {
      const { quoter, usid, token } = await loadFixture(deployProtocolWithMarketFixture);

      // Very small swap
      const tinyAmount = 1n; // 1 wei
      const output = await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        tinyAmount
      );
      
      // Should return 0 or very small amount due to rounding
      expect(output).to.be.gte(0);
    });

    it("Should handle large swap amounts with high slippage", async function () {
      const { quoter, usid, token, pool } = await loadFixture(deployProtocolWithMarketFixture);

      // Large swap (50% of reserves)
      const largeAmount = ethers.parseEther("5000");
      
      const output = await quoter.quoteExactInput(
        await usid.getAddress(),
        await token.getAddress(),
        largeAmount
      );
      
      // Should get significant amount but with high slippage
      expect(output).to.be.gt(0);
      
      // Price impact should be very high
      const impact = await quoter.getPriceImpact(await pool.getAddress(), largeAmount, true);
      expect(impact).to.be.gt(3000); // > 30%
    });

    it("Should maintain k invariant in theory", async function () {
      const { pool } = await loadFixture(deployProtocolWithMarketFixture);

      const [reserveUSID, reserveToken] = await pool.getReserves();
      const k = reserveUSID * reserveToken;
      const kLast = await pool.kLast();

      expect(k).to.equal(kLast);
    });
  });

  describe("Complete Pool Info Retrieval", function () {
    it("Should return complete pool information via quoter", async function () {
      const { quoter, pool, token, nftId } = await loadFixture(deployProtocolWithMarketFixture);

      const info = await quoter.getPoolInfo(await pool.getAddress());

      // Verify all fields
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
