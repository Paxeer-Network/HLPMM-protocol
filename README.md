# HLPMM Protocol

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-274%20passing-brightgreen)](./test)
[![Paxeer Network](https://img.shields.io/badge/Network-Paxeer-purple)](https://paxeer.app)

**[Website](https://paxeer.app)** | **[Explorer](https://paxscan.paxeer.app)** | **[Documentation](https://docs.hyperpaxeer.com)** | **[Sidiora](https://sidiora.hyperpaxeer.com)** | **[Twitter](https://x.com/paxeer_app)**

---

**HLPMM** (Hyper-Scaling Leveraged Product Market Maker) is a next-generation decentralized exchange primitive that fundamentally reimagines how tokenized markets are created, bootstrapped, and governed on-chain. By fusing permissionless market instantiation, adaptive fee mechanics, and NFT-native revenue rights into a single atomic operation, HLPMM eliminates the fragmentation and capital inefficiency that plagues traditional DEX architectures.

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

HLPMM introduces a **zero-friction market genesis model**: any participant can deploy a fully operational token market in a single transaction, with no seed capital requirements, no whitelisting, and no external dependencies. The protocol handles token deployment, liquidity seeding, and governance allocation atomically via CREATE2 deterministic addressing.

Each market instantiation produces three interlocking primitives:

- **ERC20 Token** — 1B supply, deterministically deployed and immediately tradeable
- **AMM Pool** — Pre-seeded with 10,000 USID base liquidity, enabling instant price discovery
- **Fee Ownership NFT** — ERC721 representing perpetual claim on trading fees, transferable and composable

The underlying AMM employs a **constant product invariant** (x · y = k) augmented with a proprietary **multi-factor dynamic fee engine** that modulates swap costs based on pool maturity, realized volatility, and holder concentration metrics. This creates a self-balancing fee surface that protects nascent markets while rewarding mature, liquid pools with tighter spreads.

## Architecture

The protocol stack is organized into three tiers: a **Core Layer** handling market genesis and AMM logic, a **Token Layer** managing asset representation and ownership rights, and a **Periphery Layer** providing user-facing execution and query interfaces.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE LAYER                                     │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │   HLPMMFactory   │──▶│    HLPMMPool     │──▶│   HLPMMToken     │        │
│  │   (CREATE2)      │   │   (AMM Engine)   │   │   (ERC20)        │        │
│  └────────┬─────────┘   └────────┬─────────┘   └──────────────────┘        │
│           │                      │                                          │
│           ▼                      ▼                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │    MarketNFT     │   │   FeeCollector   │   │  EventEmitter    │        │
│  │   (Fee Rights)   │   │ (Revenue Engine) │   │  (Index Layer)   │        │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERIPHERY LAYER                                   │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │   HLPMMRouter    │   │   HLPMMQuoter    │   │      USID        │        │
│  │  (Execution)     │   │   (Simulation)   │   │  (Base Asset)    │        │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Contracts

| Contract | Role |
|----------|------|
| `HLPMMFactory` | Market genesis engine — deploys token/pool pairs via CREATE2 with deterministic addressing for front-runnable discovery |
| `HLPMMPool` | AMM execution layer implementing constant product invariant with integrated fee accumulation and multi-strategy distribution |
| `USID` | Native stablecoin serving as universal quote currency, backed 1:1 by PAX with oracle-driven minting/redemption |
| `PaxPriceOracle` | Price feed aggregator sourcing PAX/USD rates from NativeCoinDEX liquidity pools |
| `EventEmitter` | Canonical event bus enabling efficient off-chain indexing and subgraph construction |

### Token Contracts

| Contract | Role |
|----------|------|
| `HLPMMToken` | Minimal ERC20 implementation optimized for gas-efficient deployment and transfer operations |
| `MarketNFT` | ERC721 encoding perpetual fee ownership rights with on-chain strategy configuration |

### Periphery Contracts

| Contract | Role |
|----------|------|
| `HLPMMRouter` | User-facing swap interface with deadline protection, slippage guards, and multi-hop routing |
| `HLPMMQuoter` | Pure view functions for swap simulation, price impact analysis, and pool introspection |
| `FeeCollector` | Revenue accumulator supporting four distribution strategies: claim, burn, airdrop, and LP reinvestment |

## Deployed Contracts

**Live on Paxeer Mainnet** (Chain ID: `125`)

| Contract | Address | Verification |
|----------|---------|--------------|
| PaxPriceOracle | `0xF94cD7F4b890A0BbeC1031C706fe2eFF293246A0` | [View](https://paxscan.paxeer.app/address/0xF94cD7F4b890A0BbeC1031C706fe2eFF293246A0) |
| USID | `0x6C32c255EeBD6A72B56ee82454d7140020919652` | [View](https://paxscan.paxeer.app/address/0x6C32c255EeBD6A72B56ee82454d7140020919652) |
| EventEmitter | `0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6` | [View](https://paxscan.paxeer.app/address/0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6) |
| MarketNFT | `0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08` | [View](https://paxscan.paxeer.app/address/0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08) |
| FeeCollector | `0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0` | [View](https://paxscan.paxeer.app/address/0xB1fC5A4088E7Ff83C7bfF974b2C65f0d24c2Afa0) |
| Factory | `0xEF283FF45379e2d47Ce8db0C613125072c1A1c58` | [View](https://paxscan.paxeer.app/address/0xEF283FF45379e2d47Ce8db0C613125072c1A1c58) |
| Quoter | `0x1a97EE9Dc7d52aD4738ec2c9E857CdA262f3F60F` | [View](https://paxscan.paxeer.app/address/0x1a97EE9Dc7d52aD4738ec2c9E857CdA262f3F60F) |
| Router | `0xcA8005aCc73eb040fE91Ac7f145a5b6Db3F232Bb` | [View](https://paxscan.paxeer.app/address/0xcA8005aCc73eb040fE91Ac7f145a5b6Db3F232Bb) |

## Quick Start

Get a local development environment running in under 60 seconds.

### Installation

```bash
git clone https://github.com/Paxeer-Network/HLPMM-protocol.git
cd HLPMM-protocol
pnpm install
```

### Configuration

```bash
cp .example.env .env
# Edit .env with your credentials
```

Required environment variables:

```bash
PRIVATE_KEY=0x...               # Deployer private key
PAXEER_RPC_URL=https://...      # Network RPC endpoint (optional, defaults to public)
```

### Compile & Verify

```bash
npx hardhat compile              # Compile all contracts
npx hardhat test                 # Run full test suite (274 tests)
REPORT_GAS=true pnpm test        # Include gas consumption metrics
```

## Acquiring USID

**USID** is the protocol's native stablecoin and serves as the universal quote asset for all HLPMM markets. It maintains a 1:1 USD peg through a fully collateralized design backed by PAX, with real-time oracle pricing ensuring accurate mint/redeem ratios.

### Minting USID (PAX → USID)

```javascript
const usid = new ethers.Contract(USID_ADDRESS, usidABI, signer);

// Deposit native PAX to mint USID at oracle rate
const depositAmount = ethers.parseEther("100");
await usid.deposit({ value: depositAmount });

// Alternative: Direct transfer triggers automatic minting
await signer.sendTransaction({
    to: USID_ADDRESS,
    value: depositAmount
});
```

### Redeeming USID (USID → PAX)

```javascript
// Burn USID to receive PAX at current oracle rate
const redeemAmount = ethers.parseEther("50");
await usid.withdraw(redeemAmount);
```

### Oracle-Driven Exchange Rates

The `PaxPriceOracle` sources live PAX/USD pricing from NativeCoinDEX liquidity pools, ensuring accurate conversion at all times:

| PAX/USD Rate | 100 PAX Mints | 100 USID Redeems |
|--------------|---------------|------------------|
| $1.00 | 100 USID | 100 PAX |
| $0.50 | 50 USID | 200 PAX |
| $2.00 | 200 USID | 50 PAX |

> **Atomic Settlement**: All mint/redeem operations settle in a single transaction with no slippage—the oracle rate at block inclusion determines the exact conversion.

## Creating Markets

The `HLPMMFactory` executes a complete market bootstrap in a single atomic transaction. No external liquidity provision required—the protocol handles everything:

**Atomic Market Genesis:**
1. **Token Deployment** — ERC20 instantiated via CREATE2 (deterministic address, predictable before tx)
2. **Pool Deployment** — AMM contract initialized with token pairing
3. **Liquidity Seeding** — 10,000 USID + 1B tokens minted directly to pool reserves
4. **Fee Rights Issuance** — ERC721 minted to creator, encoding perpetual revenue claim

### Launch a New Market

```javascript
const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, signer);

// Fee distribution strategy (configurable post-launch)
// 0 = CLAIM (withdraw to wallet)
// 1 = BURN (deflationary)
// 2 = AIRDROP (community distribution)
// 3 = LP_REWARDS (liquidity incentives)

const tx = await factory.createMarket(
    "Hyperdrive Token",    // Token name
    "HYPR",                // Symbol
    0                      // Initial fee strategy
);

const receipt = await tx.wait();
const event = receipt.logs.find(log => log.fragment?.name === 'MarketCreated');
const { pool, token, nftId } = event.args;
```

### Query Market State

```javascript
const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

const {
    reserveUSID,    // Base liquidity depth
    reserveToken,   // Token reserve balance
    spotPrice,      // Current marginal price (18 decimals)
    marketCap,      // Fully diluted valuation in USID
    poolAge         // Seconds since pool creation
} = await quoter.getPoolInfo(tokenAddress);
```

## Trading

The `HLPMMRouter` provides a hardened execution layer with MEV protection, deadline enforcement, and slippage guards. All swaps route through USID as the intermediate asset, enabling cross-market arbitrage with minimal hops.

### Single-Hop Swap

```javascript
const router = new ethers.Contract(ROUTER_ADDRESS, routerABI, signer);

// Grant router spend authorization
await token.approve(ROUTER_ADDRESS, amountIn);

// Execute swap with MEV protection
const deadline = Math.floor(Date.now() / 1000) + 600; // 10-minute validity window

const amountOut = await router.swapExactTokensForTokens(
    amountIn,        // Exact input quantity
    amountOutMin,    // Minimum acceptable output (slippage bound)
    tokenIn,         // Source asset
    tokenOut,        // Destination asset (USID or any market token)
    recipient,       // Output recipient
    deadline         // Block timestamp ceiling
);
```

### Multi-Hop Routing

Execute cross-market swaps in a single transaction—optimal for token-to-token trades without manual USID conversion:

```javascript
// Route: TokenA → USID → TokenB (2 hops, 1 transaction)
const path = [tokenA, USID_ADDRESS, tokenB];

const amountOut = await router.swapExactTokensForTokensMultiHop(
    amountIn,
    amountOutMin,
    path,
    recipient,
    deadline
);
```

### Pre-Trade Simulation

The `HLPMMQuoter` enables gas-free swap simulation for UI integration and algorithmic trading:

```javascript
const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

// Simulate swap execution (pure view, no gas cost)
const [amountOut, priceImpact] = await quoter.quoteExactInput(
    amountIn,
    tokenIn,
    tokenOut
);

// Price impact returned in basis points (500 = 5%)
if (priceImpact > 500) {
    console.warn("Significant price impact detected—consider splitting order");
}
```

## Fee System

HLPMM implements a **multi-factor adaptive fee model** that dynamically adjusts swap costs based on real-time market conditions. This creates an anti-fragile fee surface: nascent markets are protected from manipulation while mature pools benefit from competitive spreads.

### Dynamic Fee Calculation

The fee engine evaluates four on-chain factors per swap:

| Factor | Range | Mechanism |
|--------|-------|-----------|
| **Base Fee** | 30 bps | Baseline swap cost (0.30%) |
| **Pool Maturity** | 0–50 bps | Decay function—new pools pay premium, mature pools converge to base |
| **Realized Volatility** | 0–100 bps | Rolling window vol calculation triggers fee escalation during turbulence |
| **Holder Concentration** | -10 to +75 bps | Gini-coefficient-inspired adjustment penalizing whale-dominated markets |

**Bounded Range:** Fees are hard-capped between **10 bps** (0.10%) and **300 bps** (3.00%) to ensure competitiveness while preventing manipulation.

### Fee Distribution Strategies

The `MarketNFT` holder controls how accumulated fees flow. Strategy selection is on-chain and can be modified at any time:

| Strategy | Enum | Behavior |
|----------|------|----------|
| **CLAIM** | `0` | Direct withdrawal to NFT holder wallet |
| **BURN** | `1` | Permanently remove USID from circulation (deflationary) |
| **AIRDROP** | `2` | Accumulate for periodic community distribution |
| **LP_REWARDS** | `3` | Reinject into pool reserves (compounding liquidity) |

### Revenue Extraction

```javascript
const marketNFT = new ethers.Contract(MARKET_NFT_ADDRESS, marketNFTABI, signer);
const feeCollector = new ethers.Contract(FEE_COLLECTOR_ADDRESS, feeCollectorABI, provider);

// Query accrued fees for a specific market
const pendingUSID = await feeCollector.pendingFees(nftId);

// Withdraw accumulated fees (NFT holder only)
const claimed = await marketNFT.claimFees(nftId);
```

### Strategy Modification

```javascript
// Transition fee strategy on-chain (NFT holder only)
await marketNFT.setFeeStrategy(nftId, 1); // Switch to BURN mode
```

## Development

### Repository Structure

```
contracts/
├── core/                    # Protocol primitives
│   ├── HLPMMFactory.sol     # Market genesis engine
│   ├── HLPMMPool.sol        # AMM execution layer
│   ├── USID.sol             # Collateralized stablecoin
│   └── EventEmitter.sol     # Canonical event bus
├── tokens/                  # Asset representations
│   ├── HLPMMToken.sol       # Market token template
│   └── MarketNFT.sol        # Fee rights registry
├── periphery/               # User-facing interfaces
│   ├── HLPMMRouter.sol      # Protected swap execution
│   ├── HLPMMQuoter.sol      # View-only simulation
│   └── FeeCollector.sol     # Revenue aggregation
├── libraries/               # Shared computation
│   ├── Math.sol             # Fixed-point arithmetic
│   ├── PoolMath.sol         # AMM invariant calculations
│   ├── FeeCalculator.sol    # Dynamic fee engine
│   └── TransferHelper.sol   # Safe ERC20 transfers
└── interfaces/              # Contract ABIs
test/                        # Hardhat test suite
scripts/                     # Deployment automation
subgraph/                    # TheGraph indexing
```

### Deployment

```bash
# Deploy full protocol stack to Paxeer mainnet
npx hardhat run scripts/deploy.js --network paxeer-network

# Verify source code on block explorer
npx hardhat verify --network paxeer-network <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Testing

The protocol ships with a battle-tested suite of **274 automated tests** covering unit, integration, and edge-case scenarios.

```bash
pnpm test                                    # Execute full suite
REPORT_GAS=true pnpm test                    # Include gas profiling
npx hardhat test test/core/HLPMMPool.test.js # Target specific module
```

### Coverage Matrix

| Layer | Modules | Coverage |
|-------|---------|----------|
| **Libraries** | Math, PoolMath, FeeCalculator | Arithmetic edge cases, overflow protection |
| **Core** | Factory, Pool, USID, EventEmitter | Market genesis, swap execution, oracle integration |
| **Tokens** | HLPMMToken, MarketNFT | ERC20/721 compliance, ownership transfers |
| **Periphery** | Router, Quoter, FeeCollector | Slippage enforcement, multi-hop routing, fee distribution |
| **Integration** | End-to-end flows | Market creation → trading → fee extraction lifecycle |

## Contributing

HLPMM is built in the open and welcomes contributions from the community. Whether you're fixing bugs, improving documentation, or proposing new features, we appreciate your involvement.

Review [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, code style, and PR requirements.

```bash
# Standard contribution workflow
git clone https://github.com/Paxeer-Network/HLPMM-protocol.git
git checkout -b feature/your-feature
# Make changes, write tests
pnpm test                           # Ensure all tests pass
git commit -m 'feat: description'   # Follow conventional commits
git push origin feature/your-feature
# Open PR against main branch
```

## Security

Protocol security is non-negotiable. HLPMM undergoes continuous security review and maintains an active bug bounty program.

See [SECURITY.md](SECURITY.md) for:
- Responsible disclosure process
- Bug bounty scope and rewards
- Security architecture documentation

> **⚠️ Critical:** Do not disclose vulnerabilities via public issues. Report security concerns directly to **security@paxeer.app** for coordinated disclosure.

## License

Licensed under the **GNU General Public License v3.0**—see [LICENSE](LICENSE) for terms.

```
Copyright (C) 2026 PaxLabs Inc.
SPDX-License-Identifier: GPL-3.0-only
```

## Contact & Resources

| Resource | Link |
|----------|------|
| **Protocol Documentation** | [docs.hyperpaxeer.com](https://docs.hyperpaxeer.com) |
| **Block Explorer** | [paxscan.paxeer.app](https://paxscan.paxeer.app) |
| **Sidiora Interface** | [sidiora.hyperpaxeer.com](https://sidiora.hyperpaxeer.com) |
| **Website** | [paxeer.app](https://paxeer.app) |
| **Twitter/X** | [@paxeer_app](https://x.com/paxeer_app) |
| **General Inquiries** | [infopaxeer@paxeer.app](mailto:infopaxeer@paxeer.app) |
| **Security Reports** | [security@paxeer.app](mailto:security@paxeer.app) |

---

<p align="center">
  <strong>Built for the permissionless economy.</strong><br>
  <sub>HLPMM Protocol © 2026 PaxLabs Inc.</sub>
</p>
