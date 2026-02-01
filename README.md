# HLPMM Protocol

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-274%20passing-brightgreen)](./test)
[![Paxeer Network](https://img.shields.io/badge/Network-Paxeer-purple)](https://paxeer.app)

**[Website](https://paxeer.app)** | **[Explorer](https://paxscan.paxeer.app)** | **[Documentation](https://docs.hyperpaxeer.com)** | **[Sidiora](https://sidiora.hyperpaxeer.com)** | **[Twitter](https://x.com/paxeer_app)**

---

Hyper-Scaling Leveraged Product Market Maker (HLPMM) is a decentralized protocol for creating and trading tokenized markets with automated market making, dynamic fee calculation, and NFT-based fee ownership rights.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Deployed Contracts](#deployed-contracts)
- [Quick Start](#quick-start)
- [Acquiring USID](#acquiring-usid)
- [Creating Markets](#creating-markets)
- [Trading](#trading)
- [Fee System](#fee-system)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Contact](#contact)

## Overview

HLPMM enables permissionless market creation where anyone can launch a new token market with a single transaction. Each market consists of:

- A newly deployed ERC20 token (1 billion initial supply)
- An AMM pool paired with USID stablecoin (10,000 USID initial liquidity)
- An NFT representing fee ownership rights for that market

The protocol uses a constant product formula (x * y = k) with dynamic fees that adjust based on pool age, volatility, and token concentration.

## Architecture

```
+------------------+     +------------------+     +------------------+
|   HLPMMFactory   |---->|    HLPMMPool     |---->|   HLPMMToken     |
|                  |     |                  |     |   (ERC20)        |
+------------------+     +------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|    MarketNFT     |     |   FeeCollector   |
|    (ERC721)      |     |                  |
+------------------+     +------------------+
        |
        v
+------------------+     +------------------+
|  EventEmitter    |     |      USID        |
|                  |     |   (Stablecoin)   |
+------------------+     +------------------+

Periphery:
+------------------+     +------------------+
|   HLPMMRouter    |     |   HLPMMQuoter    |
+------------------+     +------------------+
```

### Core Contracts

| Contract | Description |
|----------|-------------|
| `HLPMMFactory` | Creates markets, deploys tokens and pools via CREATE2 |
| `HLPMMPool` | AMM pool with swap logic and fee accumulation |
| `USID` | Protocol stablecoin used as quote currency (PAX-backed) |
| `PaxPriceOracle` | Fetches PAX/USD price from NativeCoinDEX |
| `EventEmitter` | Centralized event logging for indexing |

### Token Contracts

| Contract | Description |
|----------|-------------|
| `HLPMMToken` | ERC20 token deployed for each market |
| `MarketNFT` | ERC721 representing fee ownership per market |

### Periphery Contracts

| Contract | Description |
|----------|-------------|
| `HLPMMRouter` | Handles swaps with deadline protection |
| `HLPMMQuoter` | Read-only quotes and pool information |
| `FeeCollector` | Accumulates and distributes trading fees |

## Deployed Contracts

**Network: Paxeer (Chain ID: 125)**

| Contract | Address |
|----------|---------|
| PaxPriceOracle | `0xF94cD7F4b890A0BbeC1031C706fe2eFF293246A0` |
| USID | `0x6C32c255EeBD6A72B56ee82454d7140020919652` |
| EventEmitter | `0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6` |
| MarketNFT | `0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08` |
| FeeCollector | `0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0` |
| Factory | `0xEF283FF45379e2d47Ce8db0C613125072c1A1c58` |
| Quoter | `0x1a97EE9Dc7d52aD4738ec2c9E857CdA262f3F60F` |
| Router | `0xcA8005aCc73eb040fE91Ac7f145a5b6Db3F232Bb` |

## Quick Start

### Installation

```bash
git clone https://github.com/Paxeer-Network/HLPMM-protocol.git
cd HLPMM-protocol
pnpm install
```

### Configuration

Create a `.env` file:

```bash
PRIVATE_KEY=your_private_key_here
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
pnpm run test
```

## Acquiring USID

USID is the protocol stablecoin used for all trading pairs. Users can acquire USID by depositing native PAX tokens. The exchange rate is determined by the **PaxPriceOracle** which fetches real-time PAX/USD prices from the NativeCoinDEX.

### Deposit PAX → Get USID

```solidity
const usid = new ethers.Contract(USID_ADDRESS, usidABI, signer);

// Deposit 100 PAX to get USID (amount depends on PAX/USD price)
const depositAmount = ethers.parseEther("100");
const tx = await usid.deposit({ value: depositAmount });
await tx.wait();

// Or simply send PAX directly to the USID contract
await signer.sendTransaction({
    to: USID_ADDRESS,
    value: depositAmount
});
```

### Withdraw USID → Get PAX

```solidity
// Withdraw 50 USID to get PAX back
const withdrawAmount = ethers.parseEther("50");
await usid.withdraw(withdrawAmount);
```

### Exchange Rate Example

| PAX Price | 100 PAX Deposit | 100 USID Withdrawal |
|-----------|-----------------|---------------------|
| $1.00 | 100 USID | 100 PAX |
| $0.50 | 50 USID | 200 PAX |
| $2.00 | 200 USID | 50 PAX |

> **Note:** The exchange rate is determined at the time of deposit/withdrawal based on the current PAX/USD price from the oracle.

## Creating Markets

Markets are created through the `HLPMMFactory` contract. Each market creation:

1. Deploys a new ERC20 token via CREATE2
2. Deploys a new AMM pool
3. Mints 10,000 USID to the pool
4. Mints 1 billion tokens to the pool
5. Mints an NFT to the creator representing fee rights

### Create Market Example

```solidity
// Using ethers.js
const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, signer);

// FeeStrategy: 0 = CLAIM, 1 = BURN, 2 = AIRDROP, 3 = LP_REWARDS
const tx = await factory.createMarket(
    "My Token",           // name
    "MTK",                // symbol
    0                     // initialStrategy (CLAIM)
);

const receipt = await tx.wait();
// Parse MarketCreated event to get pool and token addresses
```

### Get Market Information

```solidity
const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

const poolInfo = await quoter.getPoolInfo(tokenAddress);
// Returns: reserveUSID, reserveToken, spotPrice, marketCap, poolAge
```

## Trading

### Direct Swap via Router

```solidity
const router = new ethers.Contract(ROUTER_ADDRESS, routerABI, signer);

// Approve router to spend tokens
await token.approve(ROUTER_ADDRESS, amountIn);

// Swap exact tokens for tokens
const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

const amountOut = await router.swapExactTokensForTokens(
    amountIn,           // amount of tokenIn
    amountOutMin,       // minimum output (slippage protection)
    tokenIn,            // input token address
    tokenOut,           // output token address (USID or market token)
    recipient,          // recipient address
    deadline            // transaction deadline
);
```

### Multi-Hop Swap

```solidity
// Swap TokenA -> USID -> TokenB
const path = [tokenA, usidAddress, tokenB];

const amountOut = await router.swapExactTokensForTokensMultiHop(
    amountIn,
    amountOutMin,
    path,
    recipient,
    deadline
);
```

### Get Quote Before Swap

```solidity
const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

// Get expected output amount
const [amountOut, priceImpact] = await quoter.quoteExactInput(
    amountIn,
    tokenIn,
    tokenOut
);

// Check if price impact is acceptable
if (priceImpact > 500) { // 5%
    console.log("High price impact, consider smaller trade");
}
```

## Fee System

### Dynamic Fee Calculation

Fees are calculated dynamically based on:

| Factor | Modifier Range | Description |
|--------|----------------|-------------|
| Base Fee | 30 bps | Standard 0.30% fee |
| Pool Age | 0-50 bps | Higher fees for new pools |
| Volatility | 0-100 bps | Higher fees during volatile periods |
| Concentration | -10 to +75 bps | Adjusts based on holder distribution |

**Fee Bounds:** Minimum 10 bps (0.10%), Maximum 300 bps (3.00%)

### Fee Strategies

NFT owners can choose how accumulated fees are handled:

| Strategy | Value | Description |
|----------|-------|-------------|
| CLAIM | 0 | Direct withdrawal to wallet |
| BURN | 1 | Burn USID permanently |
| AIRDROP | 2 | Accumulate for community distribution |
| LP_REWARDS | 3 | Redistribute to pool liquidity |

### Claiming Fees

```solidity
const marketNFT = new ethers.Contract(MARKET_NFT_ADDRESS, marketNFTABI, signer);

// Check pending fees
const feeCollector = new ethers.Contract(FEE_COLLECTOR_ADDRESS, feeCollectorABI, provider);
const pending = await feeCollector.pendingFees(nftId);

// Claim fees (only NFT owner)
const amount = await marketNFT.claimFees(nftId);
```

### Change Fee Strategy

```solidity
// Only NFT owner can change strategy
await marketNFT.setFeeStrategy(nftId, 1); // Set to BURN
```

## Development

### Project Structure

```
contracts/
  core/           # Core protocol contracts
    HLPMMFactory.sol
    HLPMMPool.sol
    USID.sol
    EventEmitter.sol
  tokens/         # Token contracts
    HLPMMToken.sol
    MarketNFT.sol
  periphery/      # User-facing contracts
    HLPMMRouter.sol
    HLPMMQuoter.sol
    FeeCollector.sol
  libraries/      # Shared libraries
    Math.sol
    PoolMath.sol
    FeeCalculator.sol
    TransferHelper.sol
  interfaces/     # Contract interfaces
test/             # Test files
scripts/          # Deployment scripts
```

### Deploy to Network

```bash
npx hardhat run scripts/deploy.js --network paxeer-network
```

### Verify Contracts

```bash
npx hardhat verify --network paxeer-network <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Testing

The protocol includes comprehensive unit and integration tests:

```bash
# Run all tests
pnpm run test

# Run with gas reporting
REPORT_GAS=true pnpm run test

# Run specific test file
npx hardhat test test/core/HLPMMPool.test.js
```

**Test Coverage:** 274 passing tests covering:
- Library functions (Math, PoolMath, FeeCalculator)
- Core contracts (Factory, Pool, USID, EventEmitter)
- Token contracts (HLPMMToken, MarketNFT)
- Periphery contracts (Router, Quoter, FeeCollector, PaxPriceOracle)
- USID deposit/withdraw with oracle integration
- Integration tests (full market creation and swap flows)

## Contributing

We welcome contributions to the HLPMM Protocol. Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

Security is a top priority for the HLPMM Protocol. Please review our [Security Policy](SECURITY.md) for:

- Reporting vulnerabilities
- Bug bounty program
- Security best practices

**Do not open public issues for security vulnerabilities.** Instead, email security concerns to **infopaxeer@paxeer.app**.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Copyright (C) 2026 PaxLabs Inc.

## Contact

| Channel | Link |
|---------|------|
| Website | [paxeer.app](https://paxeer.app) |
| Explorer | [paxscan.paxeer.app](https://paxscan.paxeer.app) |
| Documentation | [docs.hyperpaxeer.com](https://docs.hyperpaxeer.com) |
| Sidiora | [sidiora.hyperpaxeer.com](https://sidiora.hyperpaxeer.com) |
| Twitter | [@paxeer_app](https://x.com/paxeer_app) |
| Email | [infopaxeer@paxeer.app](mailto:infopaxeer@paxeer.app) |
