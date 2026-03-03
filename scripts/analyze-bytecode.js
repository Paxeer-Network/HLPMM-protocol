const { ethers } = require("hardhat");

async function main() {
  const feeCollectorAddr = "0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0";
  
  // Get bytecode
  const code = await ethers.provider.getCode(feeCollectorAddr);
  
  // Find the distributeFees function selector: 0xdc73f738
  const selector = "dc73f738";
  const selectorPos = code.indexOf(selector);
  console.log("distributeFees selector position:", selectorPos);
  
  // Look for the Unauthorized error selector: 82b42900
  const errorSelector = "82b42900";
  let pos = 0;
  let occurrences = [];
  while ((pos = code.indexOf(errorSelector, pos)) !== -1) {
    occurrences.push(pos);
    pos++;
  }
  console.log("Unauthorized error positions:", occurrences);
  
  // Look for CALLER opcode (0x33) followed by comparison
  // In the bytecode, msg.sender check would be: CALLER SLOAD EQ or similar
  
  // Extract the function body around distributeFees
  // The function starts after the selector match in the dispatch
  
  // Check what addresses are hardcoded in the bytecode
  console.log("\n=== Addresses in bytecode ===");
  // Look for 20-byte sequences that look like addresses
  const addrPattern = /000000000000000000000000([a-f0-9]{40})/gi;
  let match;
  const addresses = new Set();
  while ((match = addrPattern.exec(code)) !== null) {
    const addr = "0x" + match[1];
    addresses.add(addr.toLowerCase());
  }
  
  // Also look for PUSH20 patterns (7f followed by 20 bytes)
  const push20Pattern = /7f([a-f0-9]{40})/gi;
  while ((match = push20Pattern.exec(code)) !== null) {
    const addr = "0x" + match[1];
    addresses.add(addr.toLowerCase());
  }
  
  addresses.forEach(addr => console.log(addr));
  
  // Check if MarketNFT address appears anywhere
  const marketNFT = "68c92dd2ce0cb45f7ed596da4afbfae69bd9da08";
  if (code.toLowerCase().includes(marketNFT)) {
    console.log("\nMarketNFT address IS in bytecode (hardcoded or as data)");
  } else {
    console.log("\nMarketNFT address is NOT hardcoded in bytecode");
  }
  
  // The key insight: if marketNFT is a storage variable, it should be read from slot 2
  // Let's check what storage slots are being read
  console.log("\n=== Storage slot access patterns ===");
  // SLOAD is 0x54, preceded by the slot number being pushed
  // Look for patterns like: 6002 54 (PUSH1 2 SLOAD) or similar
  
  // Slot 2 access for marketNFT
  if (code.includes("600254")) {
    console.log("Found PUSH1 2 SLOAD (reading slot 2 - marketNFT)");
  }
  if (code.includes("600254")) {
    console.log("Found slot 2 read");
  }
}

main().catch(console.error);
