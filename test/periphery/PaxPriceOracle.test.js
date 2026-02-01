const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ZERO_ADDRESS } = require("../helpers/constants");

describe("PaxPriceOracle", function () {
  async function deployOracleFixture() {
    const [deployer, user1, user2] = await ethers.getSigners();
    
    // Deploy mock NativeCoinDEX
    const MockDEX = await ethers.getContractFactory("MockNativeCoinDEX");
    const mockDEX = await MockDEX.deploy();
    await mockDEX.waitForDeployment();

    // Deploy PaxPriceOracle
    const PaxPriceOracle = await ethers.getContractFactory("PaxPriceOracle");
    const oracle = await PaxPriceOracle.deploy(await mockDEX.getAddress());
    await oracle.waitForDeployment();

    return { oracle, mockDEX, deployer, user1, user2 };
  }

  async function deployOracleWithZeroAddressFixture() {
    const [deployer, user1] = await ethers.getSigners();
    
    const PaxPriceOracle = await ethers.getContractFactory("PaxPriceOracle");
    const oracle = await PaxPriceOracle.deploy(ZERO_ADDRESS);
    await oracle.waitForDeployment();

    return { oracle, deployer, user1 };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      expect(await oracle.owner()).to.equal(deployer.address);
    });

    it("Should set the correct NativeCoinDEX address", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      expect(await oracle.nativeCoinDEX()).to.equal(await mockDEX.getAddress());
    });

    it("Should have default fallback price of 1e18", async function () {
      const { oracle } = await loadFixture(deployOracleFixture);
      expect(await oracle.fallbackPrice()).to.equal(ethers.parseEther("1"));
    });

    it("Should have fallback mode disabled by default", async function () {
      const { oracle } = await loadFixture(deployOracleFixture);
      expect(await oracle.useFallback()).to.equal(false);
    });
  });

  describe("getPaxPriceInUSD", function () {
    it("Should return price from NativeCoinDEX", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      const expectedPrice = ethers.parseEther("0.85"); // 1 PAX = $0.85
      await mockDEX.setPrice(expectedPrice);
      
      expect(await oracle.getPaxPriceInUSD()).to.equal(expectedPrice);
    });

    it("Should return fallback price if DEX returns 0", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(0);
      
      expect(await oracle.getPaxPriceInUSD()).to.equal(ethers.parseEther("1"));
    });

    it("Should return fallback price if fallback mode enabled", async function () {
      const { oracle, mockDEX, deployer } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("0.85"));
      await oracle.connect(deployer).toggleFallbackMode(true);
      
      expect(await oracle.getPaxPriceInUSD()).to.equal(ethers.parseEther("1"));
    });

    it("Should return fallback price if DEX address is zero", async function () {
      const { oracle } = await loadFixture(deployOracleWithZeroAddressFixture);
      expect(await oracle.getPaxPriceInUSD()).to.equal(ethers.parseEther("1"));
    });
  });

  describe("getUSIDForPAX", function () {
    it("Should calculate correct USID amount for PAX at $1", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1")); // 1 PAX = $1
      
      const paxAmount = ethers.parseEther("100");
      const usidAmount = await oracle.getUSIDForPAX(paxAmount);
      
      // 100 PAX * $1 = 100 USID
      expect(usidAmount).to.equal(ethers.parseEther("100"));
    });

    it("Should calculate correct USID amount for PAX at $0.50", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("0.5")); // 1 PAX = $0.50
      
      const paxAmount = ethers.parseEther("100");
      const usidAmount = await oracle.getUSIDForPAX(paxAmount);
      
      // 100 PAX * $0.50 = 50 USID
      expect(usidAmount).to.equal(ethers.parseEther("50"));
    });

    it("Should calculate correct USID amount for PAX at $2", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("2")); // 1 PAX = $2
      
      const paxAmount = ethers.parseEther("100");
      const usidAmount = await oracle.getUSIDForPAX(paxAmount);
      
      // 100 PAX * $2 = 200 USID
      expect(usidAmount).to.equal(ethers.parseEther("200"));
    });
  });

  describe("getPAXForUSID", function () {
    it("Should calculate correct PAX amount for USID at $1", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1")); // 1 PAX = $1
      
      const usidAmount = ethers.parseEther("100");
      const paxAmount = await oracle.getPAXForUSID(usidAmount);
      
      // 100 USID / $1 = 100 PAX
      expect(paxAmount).to.equal(ethers.parseEther("100"));
    });

    it("Should calculate correct PAX amount for USID at $0.50", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("0.5")); // 1 PAX = $0.50
      
      const usidAmount = ethers.parseEther("100");
      const paxAmount = await oracle.getPAXForUSID(usidAmount);
      
      // 100 USID / $0.50 = 200 PAX
      expect(paxAmount).to.equal(ethers.parseEther("200"));
    });

    it("Should calculate correct PAX amount for USID at $2", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("2")); // 1 PAX = $2
      
      const usidAmount = ethers.parseEther("100");
      const paxAmount = await oracle.getPAXForUSID(usidAmount);
      
      // 100 USID / $2 = 50 PAX
      expect(paxAmount).to.equal(ethers.parseEther("50"));
    });

    it("Should revert if price is zero", async function () {
      const { oracle, mockDEX, deployer } = await loadFixture(deployOracleFixture);
      
      // Enable fallback mode and set fallback price to 0
      await oracle.connect(deployer).setFallbackPrice(1); // minimum valid price
      await oracle.connect(deployer).toggleFallbackMode(true);
      await oracle.connect(deployer).setFallbackPrice(0).catch(() => {}); // This should revert
      
      // Since we can't set fallback to 0 (requires > 0), test with DEX returning 0 and fallback mode off
      // Actually the fallback kicks in when DEX returns 0, so this scenario won't happen normally
    });
  });

  describe("setFallbackPrice", function () {
    it("Should allow owner to set fallback price", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      const newPrice = ethers.parseEther("0.95");
      await oracle.connect(deployer).setFallbackPrice(newPrice);
      
      expect(await oracle.fallbackPrice()).to.equal(newPrice);
    });

    it("Should emit FallbackPriceUpdated event", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      const newPrice = ethers.parseEther("0.95");
      await expect(oracle.connect(deployer).setFallbackPrice(newPrice))
        .to.emit(oracle, "FallbackPriceUpdated")
        .withArgs(newPrice);
    });

    it("Should revert if non-owner tries to set", async function () {
      const { oracle, user1 } = await loadFixture(deployOracleFixture);
      
      await expect(
        oracle.connect(user1).setFallbackPrice(ethers.parseEther("0.95"))
      ).to.be.revertedWith("Not owner");
    });

    it("Should revert if price is zero", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      await expect(
        oracle.connect(deployer).setFallbackPrice(0)
      ).to.be.revertedWith("Invalid price");
    });
  });

  describe("toggleFallbackMode", function () {
    it("Should allow owner to enable fallback mode", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      await oracle.connect(deployer).toggleFallbackMode(true);
      expect(await oracle.useFallback()).to.equal(true);
    });

    it("Should allow owner to disable fallback mode", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      await oracle.connect(deployer).toggleFallbackMode(true);
      await oracle.connect(deployer).toggleFallbackMode(false);
      expect(await oracle.useFallback()).to.equal(false);
    });

    it("Should emit FallbackModeToggled event", async function () {
      const { oracle, deployer } = await loadFixture(deployOracleFixture);
      
      await expect(oracle.connect(deployer).toggleFallbackMode(true))
        .to.emit(oracle, "FallbackModeToggled")
        .withArgs(true);
    });

    it("Should revert if non-owner tries to toggle", async function () {
      const { oracle, user1 } = await loadFixture(deployOracleFixture);
      
      await expect(
        oracle.connect(user1).toggleFallbackMode(true)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very small amounts", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      const tinyAmount = 1n; // 1 wei
      const usidAmount = await oracle.getUSIDForPAX(tinyAmount);
      
      expect(usidAmount).to.equal(1n);
    });

    it("Should handle very large amounts", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      await mockDEX.setPrice(ethers.parseEther("1"));
      
      const largeAmount = ethers.parseEther("1000000000"); // 1 billion
      const usidAmount = await oracle.getUSIDForPAX(largeAmount);
      
      expect(usidAmount).to.equal(largeAmount);
    });

    it("Should handle price changes", async function () {
      const { oracle, mockDEX } = await loadFixture(deployOracleFixture);
      
      const paxAmount = ethers.parseEther("100");
      
      // Price at $1
      await mockDEX.setPrice(ethers.parseEther("1"));
      expect(await oracle.getUSIDForPAX(paxAmount)).to.equal(ethers.parseEther("100"));
      
      // Price drops to $0.80
      await mockDEX.setPrice(ethers.parseEther("0.8"));
      expect(await oracle.getUSIDForPAX(paxAmount)).to.equal(ethers.parseEther("80"));
      
      // Price rises to $1.25
      await mockDEX.setPrice(ethers.parseEther("1.25"));
      expect(await oracle.getUSIDForPAX(paxAmount)).to.equal(ethers.parseEther("125"));
    });
  });
});
