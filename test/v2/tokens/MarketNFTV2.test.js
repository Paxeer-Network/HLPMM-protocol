const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployV2WithMarketFixture, deployV2ProtocolFixture } = require("../helpers/fixtures");

describe("MarketNFTV2 — Unit Tests", function () {
  let p;

  beforeEach(async function () {
    p = await deployV2WithMarketFixture();
  });

  describe("Minting", function () {
    it("should mint NFT to creator on market creation", async function () {
      expect(await p.marketNFT.ownerOf(p.nftId)).to.equal(p.creator.address);
    });

    it("should track totalMinted", async function () {
      expect(await p.marketNFT.totalMinted()).to.equal(1);
    });

    it("should map nftToPool", async function () {
      expect(await p.marketNFT.nftToPool(p.nftId)).to.equal(p.poolAddress);
    });

    it("should set default fee strategy to CLAIM", async function () {
      expect(await p.marketNFT.feeStrategy(p.nftId)).to.equal(0);
    });

    it("should reject mint from non-factory", async function () {
      await expect(
        p.marketNFT.connect(p.user1).mint(p.user1.address, p.poolAddress, 0)
      ).to.be.revertedWithCustomError(p.marketNFT, "Unauthorized");
    });
  });

  describe("Fee Strategy", function () {
    it("should allow owner to change fee strategy", async function () {
      await p.marketNFT.connect(p.creator).setFeeStrategy(p.nftId, 1); // BURN
      expect(await p.marketNFT.feeStrategy(p.nftId)).to.equal(1);
    });

    it("should allow changing to all 4 strategies", async function () {
      for (let i = 0; i < 4; i++) {
        await p.marketNFT.connect(p.creator).setFeeStrategy(p.nftId, i);
        expect(await p.marketNFT.feeStrategy(p.nftId)).to.equal(i);
      }
    });

    it("should reject strategy change from non-owner", async function () {
      await expect(
        p.marketNFT.connect(p.user1).setFeeStrategy(p.nftId, 1)
      ).to.be.revertedWithCustomError(p.marketNFT, "NotOwnerOrApproved");
    });

    it("should allow approved operator to change strategy", async function () {
      await p.marketNFT.connect(p.creator).setApprovalForAll(p.user1.address, true);
      await p.marketNFT.connect(p.user1).setFeeStrategy(p.nftId, 2);
      expect(await p.marketNFT.feeStrategy(p.nftId)).to.equal(2);
    });

    it("should emit FeeStrategyUpdated event", async function () {
      await expect(
        p.marketNFT.connect(p.creator).setFeeStrategy(p.nftId, 3)
      ).to.emit(p.marketNFT, "FeeStrategyUpdated").withArgs(p.nftId, 3);
    });

    it("should emit via EventEmitter on strategy change", async function () {
      await expect(
        p.marketNFT.connect(p.creator).setFeeStrategy(p.nftId, 1)
      ).to.emit(p.eventEmitter, "FeeStrategyUpdated");
    });
  });

  describe("ERC721 Standard", function () {
    it("should report correct balanceOf", async function () {
      expect(await p.marketNFT.balanceOf(p.creator.address)).to.equal(1);
      expect(await p.marketNFT.balanceOf(p.user1.address)).to.equal(0);
    });

    it("should revert ownerOf for invalid tokenId", async function () {
      await expect(
        p.marketNFT.ownerOf(999)
      ).to.be.revertedWithCustomError(p.marketNFT, "InvalidTokenId");
    });

    it("should transfer NFT", async function () {
      await p.marketNFT.connect(p.creator).transferFrom(
        p.creator.address, p.user1.address, p.nftId
      );
      expect(await p.marketNFT.ownerOf(p.nftId)).to.equal(p.user1.address);
      expect(await p.marketNFT.balanceOf(p.creator.address)).to.equal(0);
      expect(await p.marketNFT.balanceOf(p.user1.address)).to.equal(1);
    });

    it("should revert transfer from incorrect owner", async function () {
      await expect(
        p.marketNFT.connect(p.user1).transferFrom(p.user1.address, p.user2.address, p.nftId)
      ).to.be.revertedWithCustomError(p.marketNFT, "NotOwnerOrApproved");
    });

    it("should revert transfer to zero address", async function () {
      await expect(
        p.marketNFT.connect(p.creator).transferFrom(p.creator.address, ethers.ZeroAddress, p.nftId)
      ).to.be.revertedWithCustomError(p.marketNFT, "TransferToZeroAddress");
    });

    it("should support approve and transferFrom", async function () {
      await p.marketNFT.connect(p.creator).approve(p.user1.address, p.nftId);
      expect(await p.marketNFT.getApproved(p.nftId)).to.equal(p.user1.address);

      await p.marketNFT.connect(p.user1).transferFrom(
        p.creator.address, p.user2.address, p.nftId
      );
      expect(await p.marketNFT.ownerOf(p.nftId)).to.equal(p.user2.address);
    });

    it("should clear approval after transfer", async function () {
      await p.marketNFT.connect(p.creator).approve(p.user1.address, p.nftId);
      await p.marketNFT.connect(p.creator).transferFrom(
        p.creator.address, p.user2.address, p.nftId
      );
      expect(await p.marketNFT.getApproved(p.nftId)).to.equal(ethers.ZeroAddress);
    });

    it("should support setApprovalForAll", async function () {
      await p.marketNFT.connect(p.creator).setApprovalForAll(p.user1.address, true);
      expect(await p.marketNFT.isApprovedForAll(p.creator.address, p.user1.address)).to.be.true;
    });

    it("should support supportsInterface", async function () {
      expect(await p.marketNFT.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await p.marketNFT.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await p.marketNFT.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
      expect(await p.marketNFT.supportsInterface("0xffffffff")).to.be.false;
    });
  });

  describe("Admin", function () {
    it("should allow operator to update protocol addresses", async function () {
      await p.marketNFT.connect(p.deployer).setProtocolAddresses(
        p.user1.address, p.user2.address, p.user3.address
      );
      expect(await p.marketNFT.factory()).to.equal(p.user1.address);
    });

    it("should reject non-operator updating addresses", async function () {
      await expect(
        p.marketNFT.connect(p.user1).setProtocolAddresses(
          p.user1.address, p.user2.address, p.user3.address
        )
      ).to.be.revertedWithCustomError(p.marketNFT, "Unauthorized");
    });

    it("should reject zero addresses in setProtocolAddresses", async function () {
      await expect(
        p.marketNFT.connect(p.deployer).setProtocolAddresses(
          ethers.ZeroAddress, p.user2.address, p.user3.address
        )
      ).to.be.revertedWithCustomError(p.marketNFT, "ZeroAddress");
    });
  });
});
