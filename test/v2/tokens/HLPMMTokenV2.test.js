const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2WithMarketFixture } = require("../helpers/fixtures");

describe("HLPMMTokenV2 — Unit Tests", function () {
  let p, deadline;

  beforeEach(async function () {
    p = await deployV2WithMarketFixture();
    deadline = (await ethers.provider.getBlock("latest")).timestamp + 60000;
  });

  describe("Initialization", function () {
    it("should set name and symbol", async function () {
      expect(await p.token.name()).to.equal("Test Token");
      expect(await p.token.symbol()).to.equal("TEST");
    });

    it("should set metadata", async function () {
      const meta = await p.token.metadata();
      expect(meta).to.include("test token");
    });

    it("should set pool address", async function () {
      expect(await p.token.pool()).to.equal(p.poolAddress);
    });

    it("should set eventEmitter address", async function () {
      expect(await p.token.eventEmitter()).to.equal(await p.eventEmitter.getAddress());
    });

    it("should mint 1B tokens to pool", async function () {
      expect(await p.token.totalSupply()).to.equal(ethers.parseEther("1000000000"));
      expect(await p.token.balanceOf(p.poolAddress)).to.equal(ethers.parseEther("1000000000"));
    });

    it("should have 18 decimals", async function () {
      expect(await p.token.decimals()).to.equal(18);
    });

    it("should reject double initialization", async function () {
      await expect(
        p.token.initialize("X", "X", "", p.user1.address, p.user1.address)
      ).to.be.revertedWithCustomError(p.token, "AlreadyInitialized");
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      // Buy tokens so user1 has some
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("500"));
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("500"), 0, await p.usid.getAddress(),
        p.tokenAddress, p.user1.address, deadline
      );
    });

    it("should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("1000");
      const bal1Before = await p.token.balanceOf(p.user1.address);

      await p.token.connect(p.user1).transfer(p.user2.address, amount);

      expect(await p.token.balanceOf(p.user2.address)).to.equal(amount);
      expect(await p.token.balanceOf(p.user1.address)).to.equal(bal1Before - amount);
    });

    it("should emit Transfer event", async function () {
      await expect(
        p.token.connect(p.user1).transfer(p.user2.address, ethers.parseEther("100"))
      ).to.emit(p.token, "Transfer").withArgs(p.user1.address, p.user2.address, ethers.parseEther("100"));
    });

    it("should emit TokenTransfer via EventEmitter", async function () {
      await expect(
        p.token.connect(p.user1).transfer(p.user2.address, ethers.parseEther("100"))
      ).to.emit(p.eventEmitter, "TokenTransfer");
    });

    it("should revert on insufficient balance", async function () {
      const balance = await p.token.balanceOf(p.user1.address);
      await expect(
        p.token.connect(p.user1).transfer(p.user2.address, balance + 1n)
      ).to.be.revertedWithCustomError(p.token, "InsufficientBalance");
    });
  });

  describe("Approve and TransferFrom", function () {
    beforeEach(async function () {
      await p.usid.connect(p.user1).approve(await p.router.getAddress(), ethers.parseEther("500"));
      await p.router.connect(p.user1).swapExactStableForTokens(
        ethers.parseEther("500"), 0, await p.usid.getAddress(),
        p.tokenAddress, p.user1.address, deadline
      );
    });

    it("should approve spender", async function () {
      await p.token.connect(p.user1).approve(p.user2.address, ethers.parseEther("100"));
      expect(await p.token.allowance(p.user1.address, p.user2.address)).to.equal(ethers.parseEther("100"));
    });

    it("should allow transferFrom with allowance", async function () {
      const amount = ethers.parseEther("100");
      await p.token.connect(p.user1).approve(p.user2.address, amount);

      await p.token.connect(p.user2).transferFrom(p.user1.address, p.user3.address, amount);
      expect(await p.token.balanceOf(p.user3.address)).to.equal(amount);
    });

    it("should decrease allowance after transferFrom", async function () {
      const amount = ethers.parseEther("100");
      await p.token.connect(p.user1).approve(p.user2.address, amount);
      await p.token.connect(p.user2).transferFrom(p.user1.address, p.user3.address, amount / 2n);
      expect(await p.token.allowance(p.user1.address, p.user2.address)).to.equal(amount / 2n);
    });

    it("should not decrease max allowance", async function () {
      await p.token.connect(p.user1).approve(p.user2.address, ethers.MaxUint256);
      await p.token.connect(p.user2).transferFrom(p.user1.address, p.user3.address, ethers.parseEther("100"));
      expect(await p.token.allowance(p.user1.address, p.user2.address)).to.equal(ethers.MaxUint256);
    });

    it("should revert transferFrom without allowance", async function () {
      await expect(
        p.token.connect(p.user2).transferFrom(p.user1.address, p.user3.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(p.token, "InsufficientAllowance");
    });

    it("should revert transferFrom exceeding allowance", async function () {
      await p.token.connect(p.user1).approve(p.user2.address, ethers.parseEther("10"));
      await expect(
        p.token.connect(p.user2).transferFrom(p.user1.address, p.user3.address, ethers.parseEther("11"))
      ).to.be.revertedWithCustomError(p.token, "InsufficientAllowance");
    });
  });
});
