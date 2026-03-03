const { ethers } = require("hardhat");

async function main() {
  const EVENT_EMITTER = "0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6";
  const FEE_COLLECTOR = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  const MARKET_NFT = "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08";
  const FACTORY = "0xEF283FF45379e2d47Ce8db0C613125072c1A1c58";

  const eventEmitter = new ethers.Contract(EVENT_EMITTER, [
    "function isAuthorizedEmitter(address) view returns (bool)",
    "function factory() view returns (address)"
  ], ethers.provider);

  console.log("=== EventEmitter Authorization Check ===\n");
  console.log("EventEmitter.factory():", await eventEmitter.factory());
  console.log("\nAuthorized emitters:");
  console.log("  Factory:", await eventEmitter.isAuthorizedEmitter(FACTORY));
  console.log("  MarketNFT:", await eventEmitter.isAuthorizedEmitter(MARKET_NFT));
  console.log("  FeeCollector:", await eventEmitter.isAuthorizedEmitter(FEE_COLLECTOR));
  
  console.log("\n*** FeeCollector calls EventEmitter.emitFeeClaimed() ***");
  console.log("*** But FeeCollector is NOT authorized! ***");
}

main().catch(console.error);
