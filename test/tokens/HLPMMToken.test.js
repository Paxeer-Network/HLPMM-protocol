const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { INITIAL_TOKENS, ZERO_ADDRESS } = require("../helpers/constants");

describe("HLPMMToken", function () {
  async function deployHLPMMTokenFixture() {
    const [deployer, pool, user1, user2] = await ethers.getSigners();
    
    const HLPMMToken = await ethers.getContractFactory("HLPMMToken");
    const token = await HLPMMToken.deploy();
    await token.waitForDeployment();

    return { token, deployer, pool, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should have correct decimals", async function () {
      const { token } = await loadFixture(deployHLPMMTokenFixture);
      expect(await token.decimals()).to.equal(18);
    });

    it("Should have zero supply before initialization", async function () {
      const { token } = await loadFixture(deployHLPMMTokenFixture);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  describe("initialize", function () {
    it("Should set name, symbol, and pool correctly", async function () {
      const { token, pool } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TEST");
      expect(await token.pool()).to.equal(pool.address);
    });

    it("Should mint 1 billion tokens to pool", async function () {
      const { token, pool } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      expect(await token.totalSupply()).to.equal(INITIAL_TOKENS);
      expect(await token.balanceOf(pool.address)).to.equal(INITIAL_TOKENS);
    });

    it("Should emit Transfer event on initialization", async function () {
      const { token, pool } = await loadFixture(deployHLPMMTokenFixture);
      
      await expect(token.initialize("Test Token", "TEST", pool.address))
        .to.emit(token, "Transfer")
        .withArgs(ZERO_ADDRESS, pool.address, INITIAL_TOKENS);
    });

    it("Should revert if already initialized", async function () {
      const { token, pool, user1 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await expect(
        token.initialize("Another Token", "ANTH", user1.address)
      ).to.be.revertedWithCustomError(token, "AlreadyInitialized");
    });
  });

  describe("transfer", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, pool, user1 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      const transferAmount = ethers.parseEther("1000000");
      await token.connect(pool).transfer(user1.address, transferAmount);
      
      expect(await token.balanceOf(user1.address)).to.equal(transferAmount);
      expect(await token.balanceOf(pool.address)).to.equal(INITIAL_TOKENS - transferAmount);
    });

    it("Should emit Transfer event", async function () {
      const { token, pool, user1 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      const transferAmount = ethers.parseEther("1000");
      await expect(token.connect(pool).transfer(user1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(pool.address, user1.address, transferAmount);
    });

    it("Should revert if insufficient balance", async function () {
      const { token, pool, user1, user2 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });
  });

  describe("transferFrom", function () {
    it("Should transfer with approval", async function () {
      const { token, pool, user1, user2 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await token.connect(pool).approve(user1.address, ethers.parseEther("5000"));
      await token.connect(user1).transferFrom(pool.address, user2.address, ethers.parseEther("3000"));
      
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("3000"));
      expect(await token.allowance(pool.address, user1.address)).to.equal(ethers.parseEther("2000"));
    });

    it("Should not decrease unlimited allowance", async function () {
      const { token, pool, user1, user2 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await token.connect(pool).approve(user1.address, ethers.MaxUint256);
      await token.connect(user1).transferFrom(pool.address, user2.address, ethers.parseEther("3000"));
      
      expect(await token.allowance(pool.address, user1.address)).to.equal(ethers.MaxUint256);
    });

    it("Should revert if insufficient allowance", async function () {
      const { token, pool, user1, user2 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await token.connect(pool).approve(user1.address, ethers.parseEther("1000"));
      
      await expect(
        token.connect(user1).transferFrom(pool.address, user2.address, ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });
  });

  describe("approve", function () {
    it("Should set allowance", async function () {
      const { token, pool, user1 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await token.connect(pool).approve(user1.address, ethers.parseEther("5000"));
      expect(await token.allowance(pool.address, user1.address)).to.equal(ethers.parseEther("5000"));
    });

    it("Should emit Approval event", async function () {
      const { token, pool, user1 } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      await expect(token.connect(pool).approve(user1.address, ethers.parseEther("5000")))
        .to.emit(token, "Approval")
        .withArgs(pool.address, user1.address, ethers.parseEther("5000"));
    });
  });

  describe("INITIAL_SUPPLY constant", function () {
    it("Should have correct initial supply constant", async function () {
      const { token, pool } = await loadFixture(deployHLPMMTokenFixture);
      
      await token.initialize("Test Token", "TEST", pool.address);
      
      // 1 billion tokens
      expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000000"));
    });
  });
});
