const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { INITIAL_USID, INITIAL_TOKENS, ZERO_ADDRESS } = require("../helpers/constants");
const { deployProtocolWithMarketFixture } = require("../helpers/fixtures");

describe("HLPMMRouter", function () {
  describe("Deployment", function () {
    it("Should store factory and USID addresses", async function () {
      const { router, factory, usid } = await loadFixture(deployProtocolWithMarketFixture);
      
      expect(await router.factory()).to.equal(await factory.getAddress());
      expect(await router.usid()).to.equal(await usid.getAddress());
    });
  });

  describe("swapExactTokensForTokens", function () {
    it("Should revert with expired deadline", async function () {
      const { router, usid, token, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const pastDeadline = (await time.latest()) - 100;
      
      await expect(
        router.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("100"),
          0,
          await usid.getAddress(),
          await token.getAddress(),
          user1.address,
          pastDeadline
        )
      ).to.be.revertedWithCustomError(router, "Expired");
    });

    it("Should revert for non-existent pool", async function () {
      const { router, usid, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const fakeToken = "0x1234567890123456789012345678901234567890";
      const futureDeadline = (await time.latest()) + 3600;
      
      await expect(
        router.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("100"),
          0,
          await usid.getAddress(),
          fakeToken,
          user1.address,
          futureDeadline
        )
      ).to.be.revertedWithCustomError(router, "PoolNotFound");
    });
  });

  describe("swapExactUSIDForTokens", function () {
    it("Should revert with expired deadline", async function () {
      const { router, token, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const pastDeadline = (await time.latest()) - 100;
      
      await expect(
        router.connect(user1).swapExactUSIDForTokens(
          ethers.parseEther("100"),
          0,
          await token.getAddress(),
          user1.address,
          pastDeadline
        )
      ).to.be.revertedWithCustomError(router, "Expired");
    });

    it("Should revert for non-existent token pool", async function () {
      const { router, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const fakeToken = "0x1234567890123456789012345678901234567890";
      const futureDeadline = (await time.latest()) + 3600;
      
      await expect(
        router.connect(user1).swapExactUSIDForTokens(
          ethers.parseEther("100"),
          0,
          fakeToken,
          user1.address,
          futureDeadline
        )
      ).to.be.revertedWithCustomError(router, "PoolNotFound");
    });
  });

  describe("swapExactTokensForUSID", function () {
    it("Should revert with expired deadline", async function () {
      const { router, token, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const pastDeadline = (await time.latest()) - 100;
      
      await expect(
        router.connect(user1).swapExactTokensForUSID(
          ethers.parseEther("100"),
          0,
          await token.getAddress(),
          user1.address,
          pastDeadline
        )
      ).to.be.revertedWithCustomError(router, "Expired");
    });
  });

  describe("swapExactTokensForTokensMultiHop", function () {
    it("Should revert with invalid path (less than 2 elements)", async function () {
      const { router, usid, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const futureDeadline = (await time.latest()) + 3600;
      
      await expect(
        router.connect(user1).swapExactTokensForTokensMultiHop(
          ethers.parseEther("100"),
          0,
          [await usid.getAddress()],
          user1.address,
          futureDeadline
        )
      ).to.be.revertedWithCustomError(router, "InvalidPath");
    });

    it("Should revert with expired deadline", async function () {
      const { router, usid, token, user1 } = await loadFixture(deployProtocolWithMarketFixture);
      
      const pastDeadline = (await time.latest()) - 100;
      
      await expect(
        router.connect(user1).swapExactTokensForTokensMultiHop(
          ethers.parseEther("100"),
          0,
          [await usid.getAddress(), await token.getAddress()],
          user1.address,
          pastDeadline
        )
      ).to.be.revertedWithCustomError(router, "Expired");
    });
  });

  describe("getAmountsOut", function () {
    it("Should return amounts for valid path", async function () {
      const { router, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("100");
      const path = [await usid.getAddress(), await token.getAddress()];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      
      expect(amounts.length).to.equal(2);
      expect(amounts[0]).to.equal(amountIn);
      expect(amounts[1]).to.be.gt(0);
    });

    it("Should revert with invalid path", async function () {
      const { router, usid } = await loadFixture(deployProtocolWithMarketFixture);
      
      await expect(
        router.getAmountsOut(ethers.parseEther("100"), [await usid.getAddress()])
      ).to.be.revertedWithCustomError(router, "InvalidPath");
    });

    it("Should calculate correct output with fees", async function () {
      const { router, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      const amountIn = ethers.parseEther("100");
      const path = [await usid.getAddress(), await token.getAddress()];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      
      // Output should be less than input due to AMM formula and fees
      // With 10000 USID and 1B tokens, 100 USID should get ~9.9M tokens
      expect(amounts[1]).to.be.lt(ethers.parseEther("10000000"));
      expect(amounts[1]).to.be.gt(ethers.parseEther("9000000"));
    });
  });

  describe("_getPool internal", function () {
    it("Should find pool for USID/Token pair", async function () {
      const { router, usid, token, factory } = await loadFixture(deployProtocolWithMarketFixture);
      
      // Test via getAmountsOut which uses _getPool internally
      const amounts = await router.getAmountsOut(
        ethers.parseEther("100"),
        [await usid.getAddress(), await token.getAddress()]
      );
      
      expect(amounts[1]).to.be.gt(0);
    });

    it("Should find pool for Token/USID pair (reverse)", async function () {
      const { router, usid, token } = await loadFixture(deployProtocolWithMarketFixture);
      
      // Test reverse direction
      const amounts = await router.getAmountsOut(
        ethers.parseEther("1000000"),
        [await token.getAddress(), await usid.getAddress()]
      );
      
      expect(amounts[1]).to.be.gt(0);
    });

    it("Should revert for Token/Token pair (no USID)", async function () {
      const { router, factory, creator } = await loadFixture(deployProtocolWithMarketFixture);
      
      // Create another market
      const tx = await factory.connect(creator).createMarket("Token B", "TKB", 0);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketCreated"
      );
      const tokenBAddress = event.args[1];
      
      // Get first token address
      const pools = await factory.getAllPools();
      const pool1 = await ethers.getContractAt("HLPMMPool", pools[0]);
      const tokenAAddress = await pool1.token();
      
      // Try to route Token A to Token B directly
      await expect(
        router.getAmountsOut(
          ethers.parseEther("100"),
          [tokenAAddress, tokenBAddress]
        )
      ).to.be.revertedWithCustomError(router, "InvalidPath");
    });
  });
});
