const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Signer PAX balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)));

  // Contract addresses
  const CONTRACTS = {
    FeeCollector: "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0",
    MarketNFT: "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08",
    Factory: "0xEF283FF45379e2d47Ce8db0C613125072c1A1c58",
    EventEmitter: "0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6",
    USID: "0x6C32c255EeBD6A72B56ee82454d7140020919652"
  };

  const usid = new ethers.Contract(CONTRACTS.USID, [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);

  const feeCollector = new ethers.Contract(CONTRACTS.FeeCollector, [
    "function pendingFees(uint256) view returns (uint256)",
    "function marketNFT() view returns (address)"
  ], signer);

  const marketNFT = new ethers.Contract(CONTRACTS.MarketNFT, [
    "function claimFees(uint256) returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
    "function feeCollector() view returns (address)"
  ], signer);

  // 1. Check PAX balances (skip sending - contracts may not accept native)
  console.log("\n=== Contract PAX balances ===");
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    if (name === "USID") continue;
    const balance = await ethers.provider.getBalance(addr);
    console.log(`${name}: ${ethers.formatEther(balance)} PAX`);
  }

  // 2. Send 2500 USID to FeeCollector and MarketNFT
  console.log("\n=== Sending 2500 USID to FeeCollector and MarketNFT ===");
  const usidAmount = ethers.parseEther("2500");
  const signerUsidBal = await usid.balanceOf(signer.address);
  console.log(`Signer USID balance: ${ethers.formatEther(signerUsidBal)}`);

  for (const name of ["FeeCollector", "MarketNFT"]) {
    const addr = CONTRACTS[name];
    const balance = await usid.balanceOf(addr);
    console.log(`${name} USID balance: ${ethers.formatEther(balance)}`);
    
    if (balance < usidAmount) {
      const toSend = usidAmount - balance;
      console.log(`  Sending ${ethers.formatEther(toSend)} USID...`);
      try {
        const tx = await usid.transfer(addr, toSend);
        await tx.wait();
        console.log(`  Done. New balance: ${ethers.formatEther(await usid.balanceOf(addr))} USID`);
      } catch (e) {
        console.log(`  Failed: ${e.message}`);
      }
    } else {
      console.log(`  Already has enough USID`);
    }
  }

  // 3. Check state before claiming
  console.log("\n=== Pre-claim state ===");
  console.log("FeeCollector.marketNFT():", await feeCollector.marketNFT());
  console.log("MarketNFT.feeCollector():", await marketNFT.feeCollector());
  
  const tokenId = 2;
  const owner = await marketNFT.ownerOf(tokenId);
  console.log(`NFT ${tokenId} owner:`, owner);
  console.log(`Signer is owner:`, owner.toLowerCase() === signer.address.toLowerCase());
  
  const pending = await feeCollector.pendingFees(tokenId);
  console.log(`Pending fees for NFT ${tokenId}:`, ethers.formatEther(pending), "USID");
  
  console.log(`FeeCollector USID balance:`, ethers.formatEther(await usid.balanceOf(CONTRACTS.FeeCollector)));

  // 4. Try to claim
  console.log("\n=== Attempting claimFees ===");
  try {
    console.log("Calling marketNFT.claimFees(2)...");
    const tx = await marketNFT.claimFees(tokenId);
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("SUCCESS!");
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Check balances after
    console.log("\n=== Post-claim state ===");
    console.log(`Signer USID balance:`, ethers.formatEther(await usid.balanceOf(signer.address)));
    console.log(`Pending fees for NFT ${tokenId}:`, ethers.formatEther(await feeCollector.pendingFees(tokenId)));
  } catch (error) {
    console.log("FAILED!");
    console.log("Error:", error.message);
    
    // Try to extract revert reason
    if (error.data) {
      console.log("Error data:", error.data);
      if (error.data.startsWith("0x82b42900")) console.log("  -> Unauthorized()");
      if (error.data.startsWith("0x211b6317")) console.log("  -> NoFeesToClaim()");
    }
  }
}

main().catch(console.error);
