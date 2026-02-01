# HLPMM Protocol Subgraph

The Graph subgraph for indexing HLPMM Protocol events on Paxeer Network.

## Overview

This subgraph indexes all HLPMM protocol events for frontend consumption:

- Market creation and metadata
- Swap transactions with volume/fee tracking
- NFT ownership and fee claims
- Token transfers and holder tracking
- Hourly/daily OHLC data for charts
- Protocol-wide statistics

## Entities

| Entity | Description |
|--------|-------------|
| `Protocol` | Protocol-level statistics |
| `Market` | Pool with reserves, volume, fees |
| `Token` | ERC20 token metadata and holders |
| `MarketNFT` | Fee ownership NFT with strategy |
| `User` | User activity and balances |
| `Swap` | Individual swap transactions |
| `FeeClaim` | Fee claim events |
| `MarketHourData` | Hourly OHLC candles |
| `MarketDayData` | Daily OHLC candles |
| `ProtocolDayData` | Daily protocol stats |

## Setup

### Prerequisites

- Node.js >= 18
- The Graph CLI

### Installation

```bash
cd subgraph
npm install
```

### Generate Types

```bash
npm run codegen
```

### Build

```bash
npm run build
```

## Deployment

### The Graph Studio

1. Create a subgraph at [The Graph Studio](https://thegraph.com/studio/)
2. Authenticate:
   ```bash
   graph auth --studio <DEPLOY_KEY>
   ```
3. Deploy:
   ```bash
   npm run deploy:studio
   ```

### Self-Hosted Graph Node

```bash
# Create subgraph
npm run create:local

# Deploy
npm run deploy:local
```

## Example Queries

### Get All Markets

```graphql
{
  markets(first: 100, orderBy: volumeUSID, orderDirection: desc) {
    id
    name
    symbol
    reserveUSID
    reserveToken
    spotPrice
    marketCap
    volumeUSID
    swapCount
    createdAt
    token {
      address
      holderCount
    }
    nft {
      owner {
        address
      }
      feeStrategy
    }
  }
}
```

### Get Market with Price History

```graphql
{
  market(id: "0x...") {
    name
    symbol
    spotPrice
    dayData(first: 30, orderBy: dayStartUnix, orderDirection: desc) {
      dayStartUnix
      open
      high
      low
      close
      volumeUSID
    }
  }
}
```

### Get Recent Swaps

```graphql
{
  swaps(first: 50, orderBy: timestamp, orderDirection: desc) {
    id
    market {
      name
      symbol
    }
    user {
      address
    }
    amountIn
    amountOut
    amountInUSID
    feeAmount
    spotPrice
    timestamp
    txHash
  }
}
```

### Get User Portfolio

```graphql
{
  user(id: "0x...") {
    address
    totalSwaps
    totalVolumeUSID
    marketsCreated
    ownedNFTs {
      tokenId
      market {
        name
        symbol
      }
      feeStrategy
      totalFeesClaimed
      pendingFees
    }
    tokenBalances {
      token {
        name
        symbol
      }
      balance
    }
  }
}
```

### Get Protocol Stats

```graphql
{
  protocol(id: "1") {
    totalMarkets
    totalVolumeUSID
    totalFeesUSID
    totalSwaps
    totalUsers
  }
  protocolDayDatas(first: 30, orderBy: dayStartUnix, orderDirection: desc) {
    dayStartUnix
    volumeUSID
    feesUSID
    swapCount
    newMarkets
  }
}
```

### Get Top Holders for a Token

```graphql
{
  userTokenBalances(
    where: { token: "0x..." }
    first: 100
    orderBy: balance
    orderDirection: desc
  ) {
    user {
      address
    }
    balance
  }
}
```

## Contract Addresses (Paxeer Network)

| Contract | Address |
|----------|---------|
| EventEmitter | `0xF5e3E9AB378223837c744419fc21420c5B108F67` |
| MarketNFT | `0x10ea19646D0E2F773426B8bb45e09d2BCc322604` |
| Factory | `0x9E2952Aa4409cDb4c755891D5214c5239CDa99Fd` |
| USID | `0x49345967360A401BF99840DAFC8E51148a5B7897` |

## File Structure

```
subgraph/
  schema.graphql      # GraphQL schema
  subgraph.yaml       # Subgraph manifest
  networks.json       # Network configuration
  package.json        # Dependencies
  tsconfig.json       # TypeScript config
  abis/               # Contract ABIs
    EventEmitter.json
    HLPMMFactory.json
    HLPMMPool.json
    MarketNFT.json
    ERC20.json
  src/                # Mapping handlers
    helpers.ts        # Utility functions
    event-emitter.ts  # EventEmitter handlers
    market-nft.ts     # MarketNFT handlers
    factory.ts        # Factory handlers
    pool.ts           # Pool sync handlers
    token.ts          # Token transfer handlers
    usid.ts           # USID transfer handlers
```

## License

GPL-3.0
