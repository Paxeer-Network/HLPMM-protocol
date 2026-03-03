const { ethers } = require("hardhat");

async function main() {
  const marketNFT = new ethers.Contract(
    "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08",
    [
      "function nftToPool(uint256) view returns (address)",
      "function feeCollector() view returns (address)"
    ],
    ethers.provider
  );

  const feeCollector = new ethers.Contract(
    "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0",
    [
      "function marketNFT() view returns (address)",
      "function pendingFees(uint256) view returns (uint256)",
      "function usid() view returns (address)"
    ],
    ethers.provider
  );

  const usid = new ethers.Contract(
    "0x6C32c255EeBD6A72B56ee82454d7140020919652",
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );

  console.log("=== Debugging claimFees ===\n");

  // Check addresses
  const fcInNFT = await marketNFT.feeCollector();
  const nftInFC = await feeCollector.marketNFT();
  const pool2 = await marketNFT.nftToPool(2);

  console.log("MarketNFT.feeCollector():", fcInNFT);
  console.log("FeeCollector.marketNFT():", nftInFC);
  console.log("Pool for NFT 2:", pool2);

  // Check if addresses match
  console.log("\n=== Address Match Check ===");
  console.log("MarketNFT address: 0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08");
  console.log("FeeCollector.marketNFT matches?", nftInFC.toLowerCase() === "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08".toLowerCase());

  // Check balances
  const fcBalance = await usid.balanceOf("0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0");
  const pending = await feeCollector.pendingFees(2);

  console.log("\n=== Balance Check ===");
  console.log("FeeCollector USID balance:", ethers.formatEther(fcBalance), "USID");
  console.log("Pending fees for NFT 2:", ethers.formatEther(pending), "USID");
  console.log("Has enough balance?", fcBalance >= pending);

  // Check pool's feeCollector
  if (pool2 !== ethers.ZeroAddress) {
    const pool = new ethers.Contract(
      pool2,
      ["function feeCollector() view returns (address)"],
      ethers.provider
    );
    const poolFC = await pool.feeCollector();
    console.log("\n=== Pool Check ===");
    console.log("Pool.feeCollector():", poolFC);
    console.log("Matches FeeCollector?", poolFC.toLowerCase() === "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0".toLowerCase());
  }
}

main().catch(console.error);
