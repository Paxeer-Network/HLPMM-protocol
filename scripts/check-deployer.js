const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  
  const FACTORY = "0xEF283FF45379e2d47Ce8db0C613125072c1A1c58";
  const EVENT_EMITTER = "0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6";
  
  const eventEmitter = new ethers.Contract(EVENT_EMITTER, [
    "function factory() view returns (address)"
  ], ethers.provider);

  const factoryInEE = await eventEmitter.factory();
  
  console.log("Current signer:", signer.address);
  console.log("EventEmitter.factory():", factoryInEE);
  console.log("Factory matches deployed?", factoryInEE.toLowerCase() === FACTORY.toLowerCase());
  
  console.log("\n=== The Problem ===");
  console.log("EventEmitter ONLY allows the Factory contract to call authorizeEmitter.");
  console.log("The deployed Factory has no admin function to authorize arbitrary addresses.");
  console.log("\n=== Possible Solutions ===");
  console.log("1. Redeploy Factory with admin function, BUT EventEmitter only trusts OLD Factory");
  console.log("2. Redeploy EventEmitter, BUT then need to redeploy everything that references it");
  console.log("3. Accept claimFees doesn't work (not acceptable)");
  
  console.log("\n=== ACTUAL SOLUTION ===");
  console.log("Since EventEmitter trusts the DEPLOYED Factory address, and that Factory");
  console.log("can call authorizeEmitter, we need to make Factory call authorizeEmitter(feeCollector).");
  console.log("The Factory only does this in createMarket for pools.");
  console.log("\nThere is NO way to fix this without modifying and redeploying at least one contract.");
}

main().catch(console.error);
