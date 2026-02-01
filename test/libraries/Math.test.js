const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Math Library", function () {
  async function deployMathTestFixture() {
    const MathTest = await ethers.getContractFactory("MathTest");
    const mathTest = await MathTest.deploy();
    await mathTest.waitForDeployment();
    return { mathTest };
  }

  describe("min", function () {
    it("Should return smaller value when a < b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.min(5, 10)).to.equal(5);
    });

    it("Should return smaller value when a > b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.min(10, 5)).to.equal(5);
    });

    it("Should return same value when a == b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.min(7, 7)).to.equal(7);
    });

    it("Should handle zero", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.min(0, 100)).to.equal(0);
    });

    it("Should handle large numbers", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      const large = ethers.parseEther("1000000000");
      const small = ethers.parseEther("1");
      expect(await mathTest.min(large, small)).to.equal(small);
    });
  });

  describe("max", function () {
    it("Should return larger value when a < b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.max(5, 10)).to.equal(10);
    });

    it("Should return larger value when a > b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.max(10, 5)).to.equal(10);
    });

    it("Should return same value when a == b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.max(7, 7)).to.equal(7);
    });
  });

  describe("diff", function () {
    it("Should return difference when a > b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.diff(10, 3)).to.equal(7);
    });

    it("Should return difference when a < b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.diff(3, 10)).to.equal(7);
    });

    it("Should return zero when a == b", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.diff(5, 5)).to.equal(0);
    });
  });

  describe("sqrt", function () {
    it("Should return 0 for sqrt(0)", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.sqrt(0)).to.equal(0);
    });

    it("Should return 1 for sqrt(1)", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.sqrt(1)).to.equal(1);
    });

    it("Should return correct sqrt for perfect squares", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.sqrt(4)).to.equal(2);
      expect(await mathTest.sqrt(9)).to.equal(3);
      expect(await mathTest.sqrt(16)).to.equal(4);
      expect(await mathTest.sqrt(100)).to.equal(10);
      expect(await mathTest.sqrt(10000)).to.equal(100);
    });

    it("Should floor non-perfect squares", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.sqrt(2)).to.equal(1);
      expect(await mathTest.sqrt(3)).to.equal(1);
      expect(await mathTest.sqrt(5)).to.equal(2);
      expect(await mathTest.sqrt(8)).to.equal(2);
    });

    it("Should handle large numbers", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      // sqrt(1e24) = 1e12
      const large = ethers.parseEther("1000000"); // 1e24 (1000000 * 1e18)
      const result = await mathTest.sqrt(large);
      // sqrt(1e24) = 1e12
      expect(result).to.equal(1000000000000n);
    });
  });

  describe("mulDiv", function () {
    it("Should calculate (a * b) / denominator correctly", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.mulDiv(10, 20, 5)).to.equal(40);
    });

    it("Should handle large numbers without overflow", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      const a = ethers.parseEther("1000000");
      const b = ethers.parseEther("1000000");
      const denominator = ethers.parseEther("1000000");
      expect(await mathTest.mulDiv(a, b, denominator)).to.equal(ethers.parseEther("1000000"));
    });

    it("Should revert on division by zero", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      await expect(mathTest.mulDiv(10, 20, 0)).to.be.revertedWithCustomError(
        mathTest,
        "MathDivisionByZero"
      );
    });
  });

  describe("mulDivRoundingUp", function () {
    it("Should round up when there is a remainder", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.mulDivRoundingUp(10, 3, 4)).to.equal(8); // 30/4 = 7.5 -> 8
    });

    it("Should not round up for exact division", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.mulDivRoundingUp(10, 20, 5)).to.equal(40);
    });
  });

  describe("ceilDiv", function () {
    it("Should return ceiling of division", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.ceilDiv(10, 3)).to.equal(4); // 10/3 = 3.33 -> 4
      expect(await mathTest.ceilDiv(9, 3)).to.equal(3);  // exact
      expect(await mathTest.ceilDiv(11, 3)).to.equal(4);
    });

    it("Should return 0 for ceilDiv(0, x)", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.ceilDiv(0, 5)).to.equal(0);
    });

    it("Should revert on division by zero", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      await expect(mathTest.ceilDiv(10, 0)).to.be.revertedWithCustomError(
        mathTest,
        "MathDivisionByZero"
      );
    });
  });

  describe("clamp", function () {
    it("Should return value when within range", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.clamp(50, 10, 100)).to.equal(50);
    });

    it("Should return min when value < min", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.clamp(5, 10, 100)).to.equal(10);
    });

    it("Should return max when value > max", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.clamp(150, 10, 100)).to.equal(100);
    });

    it("Should handle edge cases", async function () {
      const { mathTest } = await loadFixture(deployMathTestFixture);
      expect(await mathTest.clamp(10, 10, 100)).to.equal(10);
      expect(await mathTest.clamp(100, 10, 100)).to.equal(100);
    });
  });
});
