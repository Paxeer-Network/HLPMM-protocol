# HLPMM Protocol v1 — Architecture Document

## Overview

HyperScailing Leveraged Product Market Maker (HLPMM) is a token launchpad AMM protocol on Paxeer Network. Users create markets (pools) consisting of the protocol's stablecoin (USID) paired with a newly minted user token. All markets use constant product AMM (x × y = k) with dynamic fees.

## Core Mechanics

### Market Creation
- **Initial State**: 10,000 USID + 1,000,000,000 user tokens
- **Initial Market Cap**: $10,000 USD equivalent
- **Token Deployment**: Factory deploys via CREATE2 for deterministic addresses
- **Ownership**: Creator receives an NFT representing fee rights

### AMM Formula
```
x × y = k (Constant Product)
amountOut = (reserveOut × amountIn) / (reserveIn + amountIn)
```

### Dynamic Fee Model
Fees calculated based on:
- **Pool Age**: Younger pools = higher fees (incentivize early creation)
- **Volatility**: Higher volatility = higher fees (protect LPs)
- **Ownership Concentration**: Whale concentration = higher fees (discourage manipulation)

Fee range: 0.10% (min) to 3.00% (max), base 0.30%

### Fee Strategies
NFT holders choose how fees are allocated:
- `CLAIM` — Direct claim to wallet
- `BURN` — Burn USID (deflationary)
- `AIRDROP` — Accumulate for community airdrops
- `LP_REWARDS` — Redistribute to pool liquidity

---

## Contract Architecture

```
contracts/
├── core/
│   ├── HLPMMFactory.sol          # Creates markets, deploys tokens, mints NFTs
│   ├── HLPMMPool.sol             # Individual AMM pool (x*y=k)
│   ├── USID.sol                  # Protocol stablecoin (algorithmic)
│   └── EventEmitter.sol          # Centralized event logging
│
├── tokens/
│   ├── HLPMMToken.sol            # User token implementation (CREATE2)
│   └── MarketNFT.sol             # ERC721 - fee ownership per market
│
├── periphery/
│   ├── HLPMMRouter.sol           # Swap routing, multi-hop
│   ├── HLPMMQuoter.sol           # Off-chain price/quote simulation
│   └── FeeCollector.sol          # Accumulates & distributes fees
│
├── libraries/
│   ├── Math.sol                  # Safe math, sqrt, mulDiv
│   ├── PoolMath.sol              # AMM formulas (getAmountOut, etc.)
│   ├── TransferHelper.sol        # Safe ERC20 transfers
│   └── FeeCalculator.sol         # Dynamic fee logic
│
└── interfaces/
    ├── IHLPMMFactory.sol
    ├── IHLPMMPool.sol
    ├── IUSID.sol
    ├── IHLPMMToken.sol
    ├── IMarketNFT.sol
    ├── IHLPMMRouter.sol
    ├── IHLPMMQuoter.sol
    ├── IFeeCollector.sol
    ├── IEventEmitter.sol
    └── IERC20.sol
```

---

## Contract Specifications

### HLPMMFactory.sol
**Purpose**: Protocol entry point for market creation.

**Key Functions**:
- `createMarket(string name, string symbol, uint8 feeStrategy)` → atomic market creation

**State**:
- `mapping(address => address) tokenToPool` — token → pool lookup
- `mapping(uint256 => address) nftToPool` — NFT ID → pool lookup
- `uint256 marketCount` — total markets created

### HLPMMPool.sol
**Purpose**: AMM engine for individual markets.

**Key Functions**:
- `swap(address tokenIn, uint256 amountIn, uint256 minOut, address to)`
- `getReserves() → (uint256, uint256)`

**State**:
- `uint256 reserveUSID`
- `uint256 reserveToken`
- `uint256 kLast`
- `uint256 cumulativeFees`
- `uint32 createdAt`

**Immutables**:
- `address token`
- `address usid`
- `uint256 nftId`

### USID.sol
**Purpose**: Network-backed stablecoin. Only Factory can mint.

**Key Functions**:
- `mint(address to, uint256 amount)` — Factory only
- `burn(address from, uint256 amount)`
- Standard ERC20

### EventEmitter.sol
**Purpose**: Centralized event hub for off-chain indexers.

**Events**:
- `MarketCreated(pool, token, nftId, creator, name, symbol, timestamp)`
- `Swap(pool, sender, tokenIn, tokenOut, amountIn, amountOut, reserves, fee, timestamp)`
- `FeeClaimed(pool, nftId, recipient, amount, timestamp)`
- `FeeStrategyUpdated(nftId, newStrategy, timestamp)`

### HLPMMToken.sol
**Purpose**: ERC20 user token deployed per market.

**Immutables**:
- `name`, `symbol`, `decimals`
- `pool` — linked pool address
- Fixed supply: 1,000,000,000 tokens

### MarketNFT.sol
**Purpose**: ERC721 representing fee ownership.

**Key Functions**:
- `mint(address to, uint256 poolId)` — Factory only
- `setFeeStrategy(uint256 tokenId, uint8 strategy)`
- `claimFees(uint256 tokenId)`

**State**:
- `mapping(uint256 => address) nftToPool`
- `mapping(uint256 => uint8) feeStrategy`

### FeeCollector.sol
**Purpose**: Fee accumulation and distribution.

**Key Functions**:
- `accumulateFee(uint256 nftId, uint256 amount)`
- `distributeFees(uint256 nftId, address recipient, uint8 strategy)`
- `pendingFees(uint256 nftId) → uint256`

### HLPMMRouter.sol
**Purpose**: User-facing swap interface.

**Key Functions**:
- `swapExactTokensForTokens(...)`
- `swapExactTokensForTokensMultiHop(...)`
- `swapExactUSIDForTokens(...)`
- `swapExactTokensForUSID(...)`

### HLPMMQuoter.sol
**Purpose**: Read-only price simulation.

**Key Functions**:
- `quoteExactInput(tokenIn, tokenOut, amountIn) → amountOut`
- `quoteExactInputMultiHop(path[], amountIn) → amountOut`
- `getPriceImpact(pool, amountIn) → impactBps`
- `getSpotPrice(pool) → price`

---

## Data Flows

### Market Creation Flow
```
User → Factory.createMarket(name, symbol, strategy)
         │
         ├─► Deploy HLPMMToken via CREATE2 (1B supply)
         ├─► Deploy HLPMMPool (token, usid, nftId)
         ├─► USID.mint(pool, 10_000e18)
         ├─► Transfer 1B tokens → Pool
         ├─► MarketNFT.mint(user, poolId)
         ├─► Register tokenToPool mapping
         ├─► Authorize pool in EventEmitter
         └─► EventEmitter.emitMarketCreated(...)
```

### Swap Execution Flow
```
User → Router.swapExactTokensForTokens(amountIn, minOut, tokenIn, tokenOut, to, deadline)
         │
         ├─► Validate deadline
         ├─► Lookup pool via Factory
         ├─► TransferHelper.safeTransferFrom(tokenIn, user, pool, amountIn)
         └─► Pool.swap(tokenIn, amountIn, minOut, to)
                │
                ├─► Calculate dynamic fee
                ├─► Calculate amountOut via PoolMath
                ├─► Validate slippage
                ├─► Update reserves
                ├─► FeeCollector.accumulateFee(nftId, feeAmount)
                ├─► TransferHelper.safeTransfer(tokenOut, to, amountOut)
                └─► EventEmitter.emitSwap(...)
```

---

## Deployment Order

```
Phase 1: Base Layer
  1. USID.sol
  2. EventEmitter.sol

Phase 2: Core Infrastructure
  3. MarketNFT.sol
  4. FeeCollector.sol
  5. HLPMMFactory.sol
     └── Wire: USID.setFactory(), EventEmitter.setFactory(), etc.

Phase 3: Periphery
  6. HLPMMQuoter.sol
  7. HLPMMRouter.sol
```

---

## Security Considerations

- **Immutable contracts**: No upgrade paths, maximum trust guarantees
- **Reentrancy**: All external calls follow checks-effects-interactions
- **Access control**: Factory-only minting for USID and NFTs
- **Overflow protection**: Solidity 0.8.x built-in checks + custom Math library
- **Slippage protection**: User-specified minimums on all swaps
- **Deadline protection**: Transactions expire to prevent stale execution

---

## Constants

| Name | Value | Description |
|------|-------|-------------|
| INITIAL_USID | 10,000 | USID minted per market |
| INITIAL_TOKENS | 1,000,000,000 | User tokens per market |
| BASE_FEE | 30 (0.30%) | Default fee rate |
| MIN_FEE | 10 (0.10%) | Minimum fee rate |
| MAX_FEE | 300 (3.00%) | Maximum fee rate |
| FEE_DENOMINATOR | 10,000 | Basis points denominator |

---

## License

GPL-3.0
