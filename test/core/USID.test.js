const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ZERO_ADDRESS } = require("../helpers/constants");

describe("USID", function () {
  async function deployUSIDFixture() {
    const [deployer, factory, user1, user2] = await ethers.getSigners();
    
    const USID = await ethers.getContractFactory("USID");
    const usid = await USID.deploy();
    await usid.waitForDeployment();

    return { usid, deployer, factory, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      const { usid } = await loadFixture(deployUSIDFixture);
      
      expect(await usid.name()).to.equal("USID Stablecoin");
      expect(await usid.symbol()).to.equal("USID");
      expect(await usid.decimals()).to.equal(18);
    });

    it("Should start with zero total supply", async function () {
      const { usid } = await loadFixture(deployUSIDFixture);
      expect(await usid.totalSupply()).to.equal(0);
    });

    it("Should have no factory set initially", async function () {
      const { usid } = await loadFixture(deployUSIDFixture);
      expect(await usid.factory()).to.equal(ZERO_ADDRESS);
    });
  });

  describe("setFactory", function () {
    it("Should allow deployer to set factory", async function () {
      const { usid, deployer, factory } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      expect(await usid.factory()).to.equal(factory.address);
    });

    it("Should revert if non-deployer tries to set factory", async function () {
      const { usid, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await expect(
        usid.connect(user1).setFactory(factory.address)
      ).to.be.revertedWithCustomError(usid, "Unauthorized");
    });

    it("Should revert if factory already set", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      await expect(
        usid.connect(deployer).setFactory(user1.address)
      ).to.be.revertedWithCustomError(usid, "FactoryAlreadySet");
    });
  });

  describe("mint", function () {
    it("Should allow factory to mint tokens", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("10000");
      await usid.connect(factory).mint(user1.address, mintAmount);
      
      expect(await usid.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await usid.totalSupply()).to.equal(mintAmount);
    });

    it("Should emit Transfer event on mint", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("10000");
      await expect(usid.connect(factory).mint(user1.address, mintAmount))
        .to.emit(usid, "Transfer")
        .withArgs(ZERO_ADDRESS, user1.address, mintAmount);
    });

    it("Should revert if non-factory tries to mint", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      await expect(
        usid.connect(user1).mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(usid, "Unauthorized");
    });
  });

  describe("burn", function () {
    it("Should allow token holder to burn their tokens", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("10000");
      await usid.connect(factory).mint(user1.address, mintAmount);
      
      const burnAmount = ethers.parseEther("3000");
      await usid.connect(user1).burn(user1.address, burnAmount);
      
      expect(await usid.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      expect(await usid.totalSupply()).to.equal(mintAmount - burnAmount);
    });

    it("Should allow approved spender to burn tokens", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("10000");
      await usid.connect(factory).mint(user1.address, mintAmount);
      
      await usid.connect(user1).approve(user2.address, ethers.parseEther("5000"));
      
      const burnAmount = ethers.parseEther("3000");
      await usid.connect(user2).burn(user1.address, burnAmount);
      
      expect(await usid.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
      expect(await usid.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("2000"));
    });

    it("Should revert if burning more than balance", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("1000");
      await usid.connect(factory).mint(user1.address, mintAmount);
      
      await expect(
        usid.connect(user1).burn(user1.address, ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(usid, "InsufficientBalance");
    });

    it("Should revert if burning without approval", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      await expect(
        usid.connect(user2).burn(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(usid, "InsufficientAllowance");
    });

    it("Should emit Transfer event on burn", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      const burnAmount = ethers.parseEther("3000");
      await expect(usid.connect(user1).burn(user1.address, burnAmount))
        .to.emit(usid, "Transfer")
        .withArgs(user1.address, ZERO_ADDRESS, burnAmount);
    });
  });

  describe("transfer", function () {
    it("Should transfer tokens between accounts", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      
      const mintAmount = ethers.parseEther("10000");
      await usid.connect(factory).mint(user1.address, mintAmount);
      
      const transferAmount = ethers.parseEther("4000");
      await usid.connect(user1).transfer(user2.address, transferAmount);
      
      expect(await usid.balanceOf(user1.address)).to.equal(mintAmount - transferAmount);
      expect(await usid.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should emit Transfer event", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      await expect(usid.connect(user1).transfer(user2.address, ethers.parseEther("1000")))
        .to.emit(usid, "Transfer")
        .withArgs(user1.address, user2.address, ethers.parseEther("1000"));
    });

    it("Should revert if insufficient balance", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("1000"));
      
      await expect(
        usid.connect(user1).transfer(user2.address, ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(usid, "InsufficientBalance");
    });
  });

  describe("transferFrom", function () {
    it("Should transfer with approval", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      await usid.connect(user1).approve(user2.address, ethers.parseEther("5000"));
      await usid.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("3000"));
      
      expect(await usid.balanceOf(user2.address)).to.equal(ethers.parseEther("3000"));
      expect(await usid.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("2000"));
    });

    it("Should not decrease unlimited allowance", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      await usid.connect(user1).approve(user2.address, ethers.MaxUint256);
      await usid.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("3000"));
      
      expect(await usid.allowance(user1.address, user2.address)).to.equal(ethers.MaxUint256);
    });

    it("Should revert if insufficient allowance", async function () {
      const { usid, deployer, factory, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("10000"));
      
      await usid.connect(user1).approve(user2.address, ethers.parseEther("1000"));
      
      await expect(
        usid.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(usid, "InsufficientAllowance");
    });
  });

  describe("approve", function () {
    it("Should set allowance", async function () {
      const { usid, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(user1).approve(user2.address, ethers.parseEther("5000"));
      expect(await usid.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("5000"));
    });

    it("Should emit Approval event", async function () {
      const { usid, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await expect(usid.connect(user1).approve(user2.address, ethers.parseEther("5000")))
        .to.emit(usid, "Approval")
        .withArgs(user1.address, user2.address, ethers.parseEther("5000"));
    });

    it("Should override previous allowance", async function () {
      const { usid, user1, user2 } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(user1).approve(user2.address, ethers.parseEther("5000"));
      await usid.connect(user1).approve(user2.address, ethers.parseEther("3000"));
      
      expect(await usid.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("3000"));
    });
  });
});
