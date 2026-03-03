const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ZERO_ADDRESS, FeeStrategy } = require("../helpers/constants");

describe("MarketNFT", function () {
  async function deployMarketNFTFixture() {
    const [deployer, factory, feeCollector, eventEmitter, pool1, pool2, user1, user2] = await ethers.getSigners();
    
    const MarketNFT = await ethers.getContractFactory("MarketNFT");
    const marketNFT = await MarketNFT.deploy();
    await marketNFT.waitForDeployment();

    // Deploy mock EventEmitter
    const EventEmitter = await ethers.getContractFactory("EventEmitter");
    const eventEmitterContract = await EventEmitter.deploy();
    await eventEmitterContract.waitForDeployment();

    // Deploy mock FeeCollector
    const USID = await ethers.getContractFactory("USID");
    const usid = await USID.deploy();
    await usid.waitForDeployment();

    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    const feeCollectorContract = await FeeCollector.deploy(await usid.getAddress());
    await feeCollectorContract.waitForDeployment();

    return { 
      marketNFT, 
      usid,
      eventEmitterContract,
      feeCollectorContract,
      deployer, 
      factory, 
      feeCollector, 
      eventEmitter, 
      pool1, 
      pool2, 
      user1, 
      user2 
    };
  }

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      const { marketNFT } = await loadFixture(deployMarketNFTFixture);
      
      expect(await marketNFT.name()).to.equal("HLPMM Market Position");
      expect(await marketNFT.symbol()).to.equal("HLPMM-POS");
    });

    it("Should have zero total minted initially", async function () {
      const { marketNFT } = await loadFixture(deployMarketNFTFixture);
      expect(await marketNFT.totalMinted()).to.equal(0);
    });

    it("Should support ERC721 interfaces", async function () {
      const { marketNFT } = await loadFixture(deployMarketNFTFixture);
      
      // ERC165
      expect(await marketNFT.supportsInterface("0x01ffc9a7")).to.be.true;
      // ERC721
      expect(await marketNFT.supportsInterface("0x80ac58cd")).to.be.true;
      // ERC721Metadata
      expect(await marketNFT.supportsInterface("0x5b5e139f")).to.be.true;
    });
  });

  describe("setFactory", function () {
    it("Should allow deployer to set factory", async function () {
      const { marketNFT, deployer, factory, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      expect(await marketNFT.factory()).to.equal(factory.address);
    });

    it("Should revert if non-deployer tries to set factory", async function () {
      const { marketNFT, factory, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await expect(
        marketNFT.connect(user1).setFactory(
          factory.address,
          await feeCollectorContract.getAddress(),
          await eventEmitterContract.getAddress()
        )
      ).to.be.revertedWithCustomError(marketNFT, "Unauthorized");
    });

    it("Should revert if factory already set", async function () {
      const { marketNFT, deployer, factory, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await expect(
        marketNFT.connect(deployer).setFactory(
          user1.address,
          await feeCollectorContract.getAddress(),
          await eventEmitterContract.getAddress()
        )
      ).to.be.revertedWithCustomError(marketNFT, "FactoryAlreadySet");
    });
  });

  describe("mint", function () {
    it("Should mint NFT to recipient", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      expect(await marketNFT.totalMinted()).to.equal(1);
      expect(await marketNFT.ownerOf(1)).to.equal(user1.address);
      expect(await marketNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("Should link NFT to pool", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      expect(await marketNFT.nftToPool(1)).to.equal(pool1.address);
    });

    it("Should set default fee strategy to CLAIM", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      expect(await marketNFT.feeStrategy(1)).to.equal(FeeStrategy.CLAIM);
    });

    it("Should emit Transfer event", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await expect(marketNFT.connect(factory).mint(user1.address, pool1.address, 0))
        .to.emit(marketNFT, "Transfer")
        .withArgs(ZERO_ADDRESS, user1.address, 1);
    });

    it("Should revert if non-factory tries to mint", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await expect(
        marketNFT.connect(user1).mint(user1.address, pool1.address, 0)
      ).to.be.revertedWithCustomError(marketNFT, "Unauthorized");
    });

    it("Should revert if minting to zero address", async function () {
      const { marketNFT, deployer, factory, pool1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await expect(
        marketNFT.connect(factory).mint(ZERO_ADDRESS, pool1.address, 0)
      ).to.be.revertedWithCustomError(marketNFT, "MintToZeroAddress");
    });

    it("Should increment token IDs", async function () {
      const { marketNFT, deployer, factory, pool1, pool2, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(factory).mint(user2.address, pool2.address, 0);
      
      expect(await marketNFT.totalMinted()).to.equal(2);
      expect(await marketNFT.ownerOf(1)).to.equal(user1.address);
      expect(await marketNFT.ownerOf(2)).to.equal(user2.address);
    });
  });

  describe("setFeeStrategy", function () {
    it("Should allow owner to change fee strategy", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await eventEmitterContract.connect(deployer).setFactory(factory.address, await marketNFT.getAddress(), await feeCollectorContract.getAddress());
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(user1).setFeeStrategy(1, FeeStrategy.BURN);
      
      expect(await marketNFT.feeStrategy(1)).to.equal(FeeStrategy.BURN);
    });

    it("Should emit FeeStrategyUpdated event", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await eventEmitterContract.connect(deployer).setFactory(factory.address, await marketNFT.getAddress(), await feeCollectorContract.getAddress());
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      await expect(marketNFT.connect(user1).setFeeStrategy(1, FeeStrategy.AIRDROP))
        .to.emit(marketNFT, "FeeStrategyUpdated")
        .withArgs(1, FeeStrategy.AIRDROP);
    });

    it("Should revert if non-owner tries to change strategy", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await eventEmitterContract.connect(deployer).setFactory(factory.address, await marketNFT.getAddress(), await feeCollectorContract.getAddress());
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      await expect(
        marketNFT.connect(user2).setFeeStrategy(1, FeeStrategy.BURN)
      ).to.be.revertedWithCustomError(marketNFT, "NotOwnerOrApproved");
    });
  });

  describe("ERC721 transfers", function () {
    it("Should transfer NFT between accounts", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(user1).transferFrom(user1.address, user2.address, 1);
      
      expect(await marketNFT.ownerOf(1)).to.equal(user2.address);
      expect(await marketNFT.balanceOf(user1.address)).to.equal(0);
      expect(await marketNFT.balanceOf(user2.address)).to.equal(1);
    });

    it("Should allow approved operator to transfer", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(user1).approve(user2.address, 1);
      await marketNFT.connect(user2).transferFrom(user1.address, user2.address, 1);
      
      expect(await marketNFT.ownerOf(1)).to.equal(user2.address);
    });

    it("Should clear approval after transfer", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(user1).approve(user2.address, 1);
      await marketNFT.connect(user1).transferFrom(user1.address, user2.address, 1);
      
      expect(await marketNFT.getApproved(1)).to.equal(ZERO_ADDRESS);
    });

    it("Should allow operator for all to transfer", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      await marketNFT.connect(user1).setApprovalForAll(user2.address, true);
      await marketNFT.connect(user2).transferFrom(user1.address, user2.address, 1);
      
      expect(await marketNFT.ownerOf(1)).to.equal(user2.address);
    });

    it("Should revert transfer from incorrect owner", async function () {
      const { marketNFT, deployer, factory, pool1, user1, user2, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      await expect(
        marketNFT.connect(user2).transferFrom(user2.address, user1.address, 1)
      ).to.be.revertedWithCustomError(marketNFT, "NotOwnerOrApproved");
    });

    it("Should revert transfer to zero address", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      await expect(
        marketNFT.connect(user1).transferFrom(user1.address, ZERO_ADDRESS, 1)
      ).to.be.revertedWithCustomError(marketNFT, "TransferToZeroAddress");
    });
  });

  describe("ownerOf", function () {
    it("Should return correct owner", async function () {
      const { marketNFT, deployer, factory, pool1, user1, feeCollectorContract, eventEmitterContract } = await loadFixture(deployMarketNFTFixture);
      
      await marketNFT.connect(deployer).setFactory(
        factory.address,
        await feeCollectorContract.getAddress(),
        await eventEmitterContract.getAddress()
      );
      
      await marketNFT.connect(factory).mint(user1.address, pool1.address, 0);
      
      expect(await marketNFT.ownerOf(1)).to.equal(user1.address);
    });

    it("Should revert for non-existent token", async function () {
      const { marketNFT } = await loadFixture(deployMarketNFTFixture);
      
      await expect(
        marketNFT.ownerOf(999)
      ).to.be.revertedWithCustomError(marketNFT, "InvalidTokenId");
    });
  });
});
