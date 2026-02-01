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

  async function deployUSIDWithOracleFixture() {
    const [deployer, factory, user1, user2] = await ethers.getSigners();
    
    // Deploy mock DEX
    const MockDEX = await ethers.getContractFactory("MockNativeCoinDEX");
    const mockDEX = await MockDEX.deploy();
    await mockDEX.waitForDeployment();

    // Deploy oracle
    const PaxPriceOracle = await ethers.getContractFactory("PaxPriceOracle");
    const oracle = await PaxPriceOracle.deploy(await mockDEX.getAddress());
    await oracle.waitForDeployment();

    // Deploy USID
    const USID = await ethers.getContractFactory("USID");
    const usid = await USID.deploy();
    await usid.waitForDeployment();

    // Set oracle
    await usid.connect(deployer).setOracle(await oracle.getAddress());

    return { usid, oracle, mockDEX, deployer, factory, user1, user2 };
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

  describe("setOracle", function () {
    it("Should allow deployer to set oracle", async function () {
      const { usid, deployer } = await loadFixture(deployUSIDFixture);
      
      const mockOracleAddress = "0x1234567890123456789012345678901234567890";
      await usid.connect(deployer).setOracle(mockOracleAddress);
      expect(await usid.oracle()).to.equal(mockOracleAddress);
    });

    it("Should revert if non-deployer tries to set oracle", async function () {
      const { usid, user1 } = await loadFixture(deployUSIDFixture);
      
      await expect(
        usid.connect(user1).setOracle("0x1234567890123456789012345678901234567890")
      ).to.be.revertedWithCustomError(usid, "Unauthorized");
    });

    it("Should revert if oracle already set", async function () {
      const { usid, deployer } = await loadFixture(deployUSIDFixture);
      
      await usid.connect(deployer).setOracle("0x1234567890123456789012345678901234567890");
      
      await expect(
        usid.connect(deployer).setOracle("0x0987654321098765432109876543210987654321")
      ).to.be.revertedWithCustomError(usid, "OracleAlreadySet");
    });

    it("Should emit OracleSet event", async function () {
      const { usid, deployer } = await loadFixture(deployUSIDFixture);
      
      const oracleAddress = "0x1234567890123456789012345678901234567890";
      await expect(usid.connect(deployer).setOracle(oracleAddress))
        .to.emit(usid, "OracleSet")
        .withArgs(oracleAddress);
    });
  });

  describe("deposit", function () {
    it("Should mint USID when depositing PAX at $1 price", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1")); // 1 PAX = $1
      
      const depositAmount = ethers.parseEther("100");
      await usid.connect(user1).deposit({ value: depositAmount });
      
      // 100 PAX * $1 = 100 USID
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
      expect(await usid.totalSupply()).to.equal(ethers.parseEther("100"));
    });

    it("Should mint correct USID when PAX price is $0.50", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("0.5")); // 1 PAX = $0.50
      
      const depositAmount = ethers.parseEther("100");
      await usid.connect(user1).deposit({ value: depositAmount });
      
      // 100 PAX * $0.50 = 50 USID
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should mint correct USID when PAX price is $2", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("2")); // 1 PAX = $2
      
      const depositAmount = ethers.parseEther("100");
      await usid.connect(user1).deposit({ value: depositAmount });
      
      // 100 PAX * $2 = 200 USID
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("200"));
    });

    it("Should receive PAX in contract", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      const depositAmount = ethers.parseEther("100");
      const usidAddress = await usid.getAddress();
      
      const balanceBefore = await ethers.provider.getBalance(usidAddress);
      await usid.connect(user1).deposit({ value: depositAmount });
      const balanceAfter = await ethers.provider.getBalance(usidAddress);
      
      expect(balanceAfter - balanceBefore).to.equal(depositAmount);
    });

    it("Should emit Deposit event", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      const depositAmount = ethers.parseEther("100");
      await expect(usid.connect(user1).deposit({ value: depositAmount }))
        .to.emit(usid, "Deposit")
        .withArgs(user1.address, depositAmount, ethers.parseEther("100"));
    });

    it("Should work via receive function (direct ETH transfer)", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      const depositAmount = ethers.parseEther("50");
      await user1.sendTransaction({
        to: await usid.getAddress(),
        value: depositAmount
      });
      
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should revert if deposit amount is zero", async function () {
      const { usid, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await expect(
        usid.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWithCustomError(usid, "ZeroAmount");
    });

    it("Should revert if oracle not set", async function () {
      const { usid, user1 } = await loadFixture(deployUSIDFixture);
      
      await expect(
        usid.connect(user1).deposit({ value: ethers.parseEther("100") })
      ).to.be.revertedWithCustomError(usid, "OracleNotSet");
    });
  });

  describe("withdraw", function () {
    it("Should return PAX when withdrawing USID at $1 price", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1")); // 1 PAX = $1
      
      // Deposit first
      const depositAmount = ethers.parseEther("100");
      await usid.connect(user1).deposit({ value: depositAmount });
      
      // Withdraw
      const withdrawAmount = ethers.parseEther("50"); // 50 USID
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await usid.connect(user1).withdraw(withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      // Should receive 50 PAX (50 USID / $1)
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(ethers.parseEther("50"));
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should return correct PAX when price changed", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      // Deposit at $1
      await mockDEX.setPrice(ethers.parseEther("1"));
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      // User has 100 USID
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
      
      // Price drops to $0.50 - now 100 USID = 200 PAX
      await mockDEX.setPrice(ethers.parseEther("0.5"));
      
      // But contract only has 100 PAX, so withdrawal should fail for full amount
      // Let's withdraw 50 USID which should return 100 PAX
      const withdrawAmount = ethers.parseEther("50");
      const usidAddress = await usid.getAddress();
      const contractBalance = await ethers.provider.getBalance(usidAddress);
      
      // Contract has 100 PAX, withdrawing 50 USID at $0.50/PAX = need 100 PAX
      expect(contractBalance).to.equal(ethers.parseEther("100"));
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await usid.connect(user1).withdraw(withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      // Should receive 100 PAX (50 USID / $0.50)
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(ethers.parseEther("100"));
    });

    it("Should emit Withdraw event", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      const withdrawAmount = ethers.parseEther("50");
      await expect(usid.connect(user1).withdraw(withdrawAmount))
        .to.emit(usid, "Withdraw")
        .withArgs(user1.address, withdrawAmount, ethers.parseEther("50"));
    });

    it("Should revert if insufficient balance", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      await expect(
        usid.connect(user1).withdraw(ethers.parseEther("150"))
      ).to.be.revertedWithCustomError(usid, "InsufficientBalance");
    });

    it("Should revert if withdraw amount is zero", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      await expect(
        usid.connect(user1).withdraw(0)
      ).to.be.revertedWithCustomError(usid, "ZeroAmount");
    });

    it("Should revert if oracle not set", async function () {
      const { usid, deployer, factory, user1 } = await loadFixture(deployUSIDFixture);
      
      // Set factory and mint some USID
      await usid.connect(deployer).setFactory(factory.address);
      await usid.connect(factory).mint(user1.address, ethers.parseEther("100"));
      
      await expect(
        usid.connect(user1).withdraw(ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(usid, "OracleNotSet");
    });

    it("Should revert if contract has insufficient PAX balance", async function () {
      const { usid, mockDEX, user1 } = await loadFixture(deployUSIDWithOracleFixture);
      
      // Deposit at $1
      await mockDEX.setPrice(ethers.parseEther("1"));
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      // Price rises to $0.25 - now 100 USID = 400 PAX needed
      await mockDEX.setPrice(ethers.parseEther("0.25"));
      
      // Contract only has 100 PAX, but we need 400 PAX for 100 USID
      await expect(
        usid.connect(user1).withdraw(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(usid, "InsufficientBalance");
    });
  });

  describe("Deposit and Withdraw Integration", function () {
    it("Should handle multiple deposits from different users", async function () {
      const { usid, mockDEX, user1, user2 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      await usid.connect(user2).deposit({ value: ethers.parseEther("200") });
      
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
      expect(await usid.balanceOf(user2.address)).to.equal(ethers.parseEther("200"));
      expect(await usid.totalSupply()).to.equal(ethers.parseEther("300"));
    });

    it("Should handle deposit -> transfer -> withdraw flow", async function () {
      const { usid, mockDEX, user1, user2 } = await loadFixture(deployUSIDWithOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      // User1 deposits 100 PAX -> gets 100 USID
      await usid.connect(user1).deposit({ value: ethers.parseEther("100") });
      
      // User1 transfers 50 USID to User2
      await usid.connect(user1).transfer(user2.address, ethers.parseEther("50"));
      
      // User2 withdraws 50 USID -> gets 50 PAX
      const balanceBefore = await ethers.provider.getBalance(user2.address);
      const tx = await usid.connect(user2).withdraw(ethers.parseEther("50"));
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user2.address);
      
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(ethers.parseEther("50"));
      expect(await usid.balanceOf(user2.address)).to.equal(0);
      expect(await usid.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });
  });
});
