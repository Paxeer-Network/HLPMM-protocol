const { ethers } = require("hardhat");

async function main() {
  const proxyAddr = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  
  // Get actual bytecode
  const code = await ethers.provider.getCode(proxyAddr);
  console.log("Bytecode:", code);
  console.log("Bytecode length:", code.length);
  
  // Check common proxy implementation slots
  const eip1967Slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
  
  console.log("\n=== Proxy Slot Check ===");
  console.log("EIP-1967 impl:", await ethers.provider.getStorage(proxyAddr, eip1967Slot));
  console.log("EIP-1967 admin:", await ethers.provider.getStorage(proxyAddr, adminSlot));
  
  // Check first few storage slots
  console.log("\n=== Regular Storage ===");
  for (let i = 0; i < 5; i++) {
    const val = await ethers.provider.getStorage(proxyAddr, i);
    console.log("Slot " + i + ":", val);
  }
}

main().catch(console.error);
