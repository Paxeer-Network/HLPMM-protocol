# HLPMM Protocol API Reference

This document provides complete API documentation for all HLPMM protocol contracts.

## Table of Contents

- [HLPMMFactory](#hlpmmfactory)
- [HLPMMPool](#hlpmmpool)
- [HLPMMRouter](#hlpmmrouter)
- [HLPMMQuoter](#hlpmmquoter)
- [MarketNFT](#marketnft)
- [FeeCollector](#feecollector)
- [USID](#usid)
- [EventEmitter](#eventemitter)

---

## HLPMMFactory

Creates and manages HLPMM markets.

### State Variables

```solidity
uint256 public constant INITIAL_USID = 10_000 * 1e18;
uint256 public constant INITIAL_TOKENS = 1_000_000_000 * 1e18;

address public immutable usid;
address public immutable eventEmitter;
address public immutable marketNFT;
address public immutable feeCollector;

uint256 public marketCount;
mapping(address => address) public tokenToPool;
mapping(uint256 => address) public nftToPool;
mapping(address => address) public poolToToken;
mapping(address => uint256) public creatorNonce;
address[] public allPools;
```

### Functions

#### createMarket

Creates a new market with a token and AMM pool.

```solidity
function createMarket(
    string calldata name,
    string calldata symbol,
    FeeStrategy initialStrategy
) external returns (address pool, address token, uint256 nftId)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| name | string | Token name (e.g., "My Token") |
| symbol | string | Token symbol (e.g., "MTK") |
| initialStrategy | FeeStrategy | Fee strategy (0=CLAIM, 1=BURN, 2=AIRDROP, 3=LP_REWARDS) |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| pool | address | Deployed pool address |
| token | address | Deployed token address |
| nftId | uint256 | Minted NFT ID |

**Example:**
```javascript
const factory = new ethers.Contract(FACTORY_ADDRESS, factoryABI, signer);

const tx = await factory.createMarket("Pepe Token", "PEPE", 0);
const receipt = await tx.wait();

// Parse events to get addresses
const event = receipt.logs.find(log => 
    log.topics[0] === ethers.id("MarketCreated(address,address,uint256,address,string,string,uint256)")
);
```

#### getPool

Returns the pool address for a given token.

```solidity
function getPool(address token) external view returns (address)
```

#### getAllPools

Returns array of all pool addresses.

```solidity
function getAllPools() external view returns (address[] memory)
```

#### computeTokenAddress

Computes the deterministic token address before deployment.

```solidity
function computeTokenAddress(address creator, uint256 nonce) external view returns (address)
```

---

## HLPMMPool

Individual AMM pool for token-USID trading.

### State Variables

```solidity
address public immutable token;
address public immutable usid;
address public immutable factory;
address public immutable feeCollector;
address public immutable eventEmitter;
address public immutable marketNFT;
uint256 public immutable nftId;
uint32 public immutable createdAt;

uint256 public reserveUSID;
uint256 public reserveToken;
uint256 public kLast;
uint256 public cumulativeFees;
```

### Functions

#### swap

Executes a token swap.

```solidity
function swap(
    address tokenIn,
    uint256 amountIn,
    uint256 amountOutMin,
    address to
) external returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tokenIn | address | Input token address |
| amountIn | uint256 | Amount of input tokens |
| amountOutMin | uint256 | Minimum output (slippage protection) |
| to | address | Recipient address |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| amountOut | uint256 | Actual output amount |

**Reverts:**
- `InvalidToken()` - tokenIn is not usid or pool token
- `InsufficientOutput()` - output < amountOutMin
- `ReentrancyGuard()` - reentrancy detected

#### getReserves

Returns current pool reserves.

```solidity
function getReserves() external view returns (uint256 reserveUSID_, uint256 reserveToken_)
```

#### getSpotPrice

Returns current spot price in USID per token.

```solidity
function getSpotPrice() external view returns (uint256)
```

#### getMarketCap

Returns current market cap in USID.

```solidity
function getMarketCap() external view returns (uint256)
```

#### sync

Synchronizes reserves with actual token balances.

```solidity
function sync() external
```

---

## HLPMMRouter

User-facing swap interface with deadline protection.

### State Variables

```solidity
address public immutable factory;
address public immutable usid;
```

### Functions

#### swapExactTokensForTokens

Swaps exact input for minimum output.

```solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address tokenIn,
    address tokenOut,
    address to,
    uint256 deadline
) external returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| amountIn | uint256 | Exact input amount |
| amountOutMin | uint256 | Minimum acceptable output |
| tokenIn | address | Input token address |
| tokenOut | address | Output token address |
| to | address | Recipient address |
| deadline | uint256 | Unix timestamp deadline |

**Example:**
```javascript
const router = new ethers.Contract(ROUTER_ADDRESS, routerABI, signer);

// Approve router first
await token.approve(ROUTER_ADDRESS, amountIn);

const deadline = Math.floor(Date.now() / 1000) + 600;
const amountOut = await router.swapExactTokensForTokens(
    ethers.parseEther("100"),    // amountIn
    ethers.parseEther("95"),     // amountOutMin (5% slippage)
    tokenAddress,                 // tokenIn
    usidAddress,                  // tokenOut
    userAddress,                  // to
    deadline
);
```

#### swapExactTokensForTokensMultiHop

Multi-hop swap through multiple pools.

```solidity
function swapExactTokensForTokensMultiHop(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256 amountOut)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| amountIn | uint256 | Exact input amount |
| amountOutMin | uint256 | Minimum acceptable output |
| path | address[] | Token path (must include USID as intermediary) |
| to | address | Recipient address |
| deadline | uint256 | Unix timestamp deadline |

**Example:**
```javascript
// TokenA -> USID -> TokenB
const path = [tokenA, usidAddress, tokenB];

const amountOut = await router.swapExactTokensForTokensMultiHop(
    ethers.parseEther("100"),
    ethers.parseEther("90"),
    path,
    userAddress,
    deadline
);
```

#### getAmountsOut

Calculates output amounts for a path.

```solidity
function getAmountsOut(
    uint256 amountIn,
    address[] calldata path
) external view returns (uint256[] memory amounts)
```

---

## HLPMMQuoter

Read-only quote and pool information.

### Functions

#### quoteExactInput

Quotes expected output for exact input.

```solidity
function quoteExactInput(
    uint256 amountIn,
    address tokenIn,
    address tokenOut
) external view returns (uint256 amountOut, uint256 priceImpactBps)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| amountOut | uint256 | Expected output amount |
| priceImpactBps | uint256 | Price impact in basis points |

**Example:**
```javascript
const quoter = new ethers.Contract(QUOTER_ADDRESS, quoterABI, provider);

const [amountOut, priceImpact] = await quoter.quoteExactInput(
    ethers.parseEther("1000"),
    tokenAddress,
    usidAddress
);

console.log(`Expected output: ${ethers.formatEther(amountOut)} USID`);
console.log(`Price impact: ${priceImpact / 100}%`);
```

#### quoteExactInputMultiHop

Quotes multi-hop swap output.

```solidity
function quoteExactInputMultiHop(
    uint256 amountIn,
    address[] calldata path
) external view returns (uint256 amountOut)
```

#### quoteExactOutput

Quotes required input for exact output.

```solidity
function quoteExactOutput(
    uint256 amountOut,
    address tokenIn,
    address tokenOut
) external view returns (uint256 amountIn)
```

#### getPriceImpact

Returns price impact for a trade.

```solidity
function getPriceImpact(
    address pool,
    uint256 amountIn,
    bool isUSIDIn
) external view returns (uint256 impactBps)
```

#### getSpotPrice

Returns spot price for a pool.

```solidity
function getSpotPrice(address pool) external view returns (uint256)
```

#### getMarketCap

Returns market cap for a pool.

```solidity
function getMarketCap(address pool) external view returns (uint256)
```

#### getPoolInfo

Returns comprehensive pool information.

```solidity
function getPoolInfo(address token) external view returns (
    uint256 reserveUSID,
    uint256 reserveToken,
    uint256 spotPrice,
    uint256 marketCap,
    uint256 poolAge
)
```

**Example:**
```javascript
const info = await quoter.getPoolInfo(tokenAddress);

console.log(`Reserves: ${ethers.formatEther(info.reserveUSID)} USID / ${ethers.formatEther(info.reserveToken)} Token`);
console.log(`Price: ${ethers.formatEther(info.spotPrice)} USID per token`);
console.log(`Market Cap: ${ethers.formatEther(info.marketCap)} USID`);
console.log(`Pool Age: ${info.poolAge} seconds`);
```

---

## MarketNFT

ERC721 representing fee ownership rights.

### State Variables

```solidity
address public factory;
address public feeCollector;
address public eventEmitter;
uint256 public totalMinted;

mapping(uint256 => address) public nftToPool;
mapping(uint256 => FeeStrategy) public feeStrategy;
```

### Functions

#### setFeeStrategy

Changes fee distribution strategy for a market.

```solidity
function setFeeStrategy(uint256 tokenId, FeeStrategy strategy) external
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tokenId | uint256 | NFT token ID |
| strategy | FeeStrategy | New fee strategy |

**Access:** Owner or approved operator only.

**Example:**
```javascript
const marketNFT = new ethers.Contract(MARKET_NFT_ADDRESS, marketNFTABI, signer);

// Change to BURN strategy
await marketNFT.setFeeStrategy(1, 1);
```

#### claimFees

Claims accumulated fees for a market.

```solidity
function claimFees(uint256 tokenId) external returns (uint256 amount)
```

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| amount | uint256 | Amount of USID claimed |

**Access:** Owner or approved operator only.

---

## FeeCollector

Accumulates and distributes trading fees.

### Functions

#### pendingFees

Returns pending fees for an NFT.

```solidity
function pendingFees(uint256 nftId) external view returns (uint256)
```

#### accumulateFee

Accumulates fee from a pool swap.

```solidity
function accumulateFee(uint256 nftId, uint256 amount) external
```

**Access:** Pool contracts only.

#### distributeFees

Distributes accumulated fees based on strategy.

```solidity
function distributeFees(
    uint256 nftId,
    address recipient,
    FeeStrategy strategy
) external returns (uint256 amount)
```

**Access:** MarketNFT contract only.

---

## USID

Protocol stablecoin.

### Functions

#### mint

Mints USID tokens.

```solidity
function mint(address to, uint256 amount) external
```

**Access:** Factory only.

#### burn

Burns USID tokens.

```solidity
function burn(address from, uint256 amount) external
```

**Access:** Token holder or approved spender.

Standard ERC20 functions also available: `transfer`, `transferFrom`, `approve`, `allowance`, `balanceOf`, `totalSupply`.

---

## EventEmitter

Centralized event logging for off-chain indexing.

### Events

```solidity
event MarketCreated(
    address indexed pool,
    address indexed token,
    uint256 indexed nftId,
    address creator,
    string name,
    string symbol,
    uint256 timestamp
);

event Swap(
    address indexed pool,
    address indexed sender,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 newReserveUSID,
    uint256 newReserveToken,
    uint256 feeAmount,
    uint256 timestamp
);

event FeeClaimed(
    address indexed pool,
    uint256 indexed nftId,
    address indexed recipient,
    uint256 amount,
    uint256 timestamp
);

event FeeStrategyUpdated(
    uint256 indexed nftId,
    FeeStrategy newStrategy,
    uint256 timestamp
);
```

---

## Error Reference

### Common Errors

| Error | Contract | Description |
|-------|----------|-------------|
| `Unauthorized()` | Multiple | Caller lacks permission |
| `InvalidToken()` | HLPMMPool | Token not in pool |
| `InsufficientOutput()` | HLPMMPool, Router | Slippage exceeded |
| `ReentrancyGuard()` | HLPMMPool | Reentrancy detected |
| `Expired()` | HLPMMRouter | Deadline passed |
| `InvalidPath()` | HLPMMRouter | Path validation failed |
| `PoolNotFound()` | HLPMMRouter, Quoter | No pool for token pair |
| `MarketAlreadyExists()` | HLPMMFactory | Duplicate market |
| `InvalidName()` | HLPMMFactory | Empty token name |
| `InvalidSymbol()` | HLPMMFactory | Empty token symbol |
| `NotOwnerOrApproved()` | MarketNFT | NFT permission denied |
| `FactoryAlreadySet()` | Multiple | Factory already configured |

---

## Fee Strategy Enum

```solidity
enum FeeStrategy {
    CLAIM,      // 0 - Direct claim to wallet
    BURN,       // 1 - Burn USID
    AIRDROP,    // 2 - Accumulate for community airdrop
    LP_REWARDS  // 3 - Redistribute to pool liquidity
}
```
