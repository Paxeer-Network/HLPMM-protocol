const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AdminController", function () {
  let admin, operator, guardian, nobody;
  let controller;

  beforeEach(async function () {
    [admin, operator, guardian, nobody] = await ethers.getSigners();
    const AC = await ethers.getContractFactory("AdminController");
    controller = await AC.deploy(admin.address, 3600);
    await controller.waitForDeployment();
  });

  describe("Constructor", function () {
    it("should set initial admin", async function () {
      expect(await controller.hasRole(admin.address, 2)).to.be.true; // ADMIN=2
    });

    it("should set timelock delay", async function () {
      expect(await controller.timelockDelay()).to.equal(3600);
    });

    it("should revert on zero address admin", async function () {
      const AC = await ethers.getContractFactory("AdminController");
      await expect(AC.deploy(ethers.ZeroAddress, 3600)).to.be.revertedWithCustomError(controller, "ZeroAddress");
    });

    it("should revert on timelock too short", async function () {
      const AC = await ethers.getContractFactory("AdminController");
      await expect(AC.deploy(admin.address, 60)).to.be.revertedWithCustomError(controller, "TimelockTooShort");
    });
  });

  describe("Role Management", function () {
    it("should allow admin to grant OPERATOR role", async function () {
      await controller.connect(admin).grantRole(operator.address, 1); // OPERATOR=1
      expect(await controller.hasRole(operator.address, 1)).to.be.true;
    });

    it("should allow admin to grant GUARDIAN role", async function () {
      await controller.connect(admin).grantRole(guardian.address, 3); // GUARDIAN=3
      expect(await controller.hasRole(guardian.address, 3)).to.be.true;
    });

    it("should allow admin to revoke roles", async function () {
      await controller.connect(admin).grantRole(operator.address, 1);
      await controller.connect(admin).revokeRole(operator.address);
      expect(await controller.hasRole(operator.address, 1)).to.be.false;
    });

    it("should revert when non-admin grants role", async function () {
      await expect(
        controller.connect(nobody).grantRole(operator.address, 1)
      ).to.be.revertedWithCustomError(controller, "NotAdmin");
    });

    it("should revert when granting NONE role", async function () {
      await expect(
        controller.connect(admin).grantRole(operator.address, 0) // NONE=0
      ).to.be.revertedWithCustomError(controller, "InvalidRole");
    });

    it("should revert when granting to zero address", async function () {
      await expect(
        controller.connect(admin).grantRole(ethers.ZeroAddress, 1)
      ).to.be.revertedWithCustomError(controller, "ZeroAddress");
    });

    it("should correctly report isOperatorOrAbove", async function () {
      await controller.connect(admin).grantRole(operator.address, 1);
      expect(await controller.isOperatorOrAbove(admin.address)).to.be.true;
      expect(await controller.isOperatorOrAbove(operator.address)).to.be.true;
      expect(await controller.isOperatorOrAbove(nobody.address)).to.be.false;
    });
  });

  describe("Timelock", function () {
    it("should allow admin to update timelock delay", async function () {
      await controller.connect(admin).setTimelockDelay(7200);
      expect(await controller.timelockDelay()).to.equal(7200);
    });

    it("should reject timelock below minimum", async function () {
      await expect(
        controller.connect(admin).setTimelockDelay(60)
      ).to.be.revertedWithCustomError(controller, "TimelockTooShort");
    });

    it("should cap timelock at maximum", async function () {
      await controller.connect(admin).setTimelockDelay(999999999);
      expect(await controller.timelockDelay()).to.equal(30 * 24 * 3600); // MAX_TIMELOCK
    });
  });

  describe("Action Queue/Execute/Cancel", function () {
    let target, actionData, actionId;

    beforeEach(async function () {
      // Queue an action to change timelock
      target = await controller.getAddress();
      actionData = controller.interface.encodeFunctionData("setTimelockDelay", [7200]);

      const tx = await controller.connect(admin).queueAction(target, actionData);
      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment && l.fragment.name === "ActionQueued");
      actionId = event.args[0];
    });

    it("should queue an action", async function () {
      const action = await controller.queuedActions(actionId);
      expect(action.target).to.equal(target);
      expect(action.executed).to.be.false;
      expect(action.cancelled).to.be.false;
    });

    it("should reject execution before timelock expires", async function () {
      await expect(
        controller.connect(admin).executeAction(actionId)
      ).to.be.revertedWithCustomError(controller, "ActionNotReady");
    });

    it("should execute action after timelock expires", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await controller.connect(admin).executeAction(actionId);
      expect(await controller.timelockDelay()).to.equal(7200);
    });

    it("should reject double execution", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await controller.connect(admin).executeAction(actionId);
      await expect(
        controller.connect(admin).executeAction(actionId)
      ).to.be.revertedWithCustomError(controller, "ActionAlreadyExecuted");
    });

    it("should allow guardian to cancel queued action", async function () {
      await controller.connect(admin).grantRole(guardian.address, 3); // GUARDIAN=3
      await controller.connect(guardian).cancelAction(actionId);

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await expect(
        controller.connect(admin).executeAction(actionId)
      ).to.be.revertedWithCustomError(controller, "ActionNotFound");
    });

    it("should reject cancel by non-guardian", async function () {
      await expect(
        controller.connect(nobody).cancelAction(actionId)
      ).to.be.revertedWithCustomError(controller, "NotGuardian");
    });

    it("should reject expired actions", async function () {
      // Advance past expiry (14 days + 1 hour timelock)
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 3600]);
      await ethers.provider.send("evm_mine");

      await expect(
        controller.connect(admin).executeAction(actionId)
      ).to.be.revertedWithCustomError(controller, "ActionExpired");
    });
  });
});
