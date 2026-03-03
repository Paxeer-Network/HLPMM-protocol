const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const feeCollectorAddr = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  
  // Get on-chain bytecode
  const onChain = await ethers.provider.getCode(feeCollectorAddr);
  
  // Get compiled bytecode
  const artifact = JSON.parse(fs.readFileSync("artifacts/contracts/periphery/FeeCollector.sol/FeeCollector.json"));
  const compiled = artifact.deployedBytecode;
  
  console.log("On-chain length:", onChain.length);
  console.log("Compiled length:", compiled.length);
  
  // Strip metadata (last ~86 bytes typically)
  // Metadata starts with 0xa264 or 0xa265
  const metaStart1 = onChain.indexOf("a264");
  const metaStart2 = onChain.indexOf("a265");
  const metaStart = Math.min(
    metaStart1 > 0 ? metaStart1 : Infinity,
    metaStart2 > 0 ? metaStart2 : Infinity
  );
  
  const onChainCore = onChain.slice(0, metaStart);
  
  const metaStartCompiled1 = compiled.indexOf("a264");
  const metaStartCompiled2 = compiled.indexOf("a265");
  const metaStartCompiled = Math.min(
    metaStartCompiled1 > 0 ? metaStartCompiled1 : Infinity,
    metaStartCompiled2 > 0 ? metaStartCompiled2 : Infinity
  );
  const compiledCore = compiled.slice(0, metaStartCompiled);
  
  console.log("\nCore bytecode (without metadata):");
  console.log("On-chain core length:", onChainCore.length);
  console.log("Compiled core length:", compiledCore.length);
  
  // Find differences
  const minLen = Math.min(onChainCore.length, compiledCore.length);
  let diffCount = 0;
  let firstDiff = -1;
  
  for (let i = 0; i < minLen; i += 2) {
    if (onChainCore.slice(i, i+2) !== compiledCore.slice(i, i+2)) {
      diffCount++;
      if (firstDiff === -1) firstDiff = i;
    }
  }
  
  if (diffCount === 0 && onChainCore.length === compiledCore.length) {
    console.log("\n✓ Core bytecodes MATCH exactly!");
  } else {
    console.log("\n✗ Bytecodes DIFFER");
    console.log("  First difference at position:", firstDiff);
    console.log("  Total different bytes:", diffCount);
    
    if (firstDiff > 0) {
      console.log("\n  Context around first diff:");
      console.log("  On-chain:", onChainCore.slice(firstDiff-20, firstDiff+40));
      console.log("  Compiled:", compiledCore.slice(firstDiff-20, firstDiff+40));
    }
  }
  
  // Check if the immutable _deployer differs
  // Immutables are embedded in the bytecode
  const deployerOnChain = "f263ab36de550bda08b52d43eb253b3c0387e2bc";
  const deployerInCompiled = compiled.includes(deployerOnChain);
  
  console.log("\n=== Immutable Check ===");
  console.log("Deployer in on-chain:", onChain.toLowerCase().includes(deployerOnChain));
  console.log("Deployer in compiled:", deployerInCompiled);
}

main().catch(console.error);
