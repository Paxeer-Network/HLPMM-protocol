# HLPMM Protocol Indexer

High-performance custom indexer for the HLPMM Protocol — a drop-in replacement for the subgraph with richer data and faster historical sync.

## Features

- **Batch `eth_getLogs`** — indexes thousands of blocks per RPC call with automatic range splitting
- **PostgreSQL** — production-grade storage with proper indexes for fast queries
- **Subgraph-compatible GraphQL API** — same entity names, same query patterns
- **Enriched data beyond the subgraph:**
  - `priceChange1h`, `priceChange24h`, `priceChange7d`
  - `volumeUSID1h`, `volumeUSID24h`, `volumeUSID7d`
  - `ath` / `atl` with timestamps
  - `priceImpact` and `side` (BUY/SELL) on every swap
  - `lifetimeRevenue` and `strategyChanges` on NFTs
  - **5-minute OHLC candles** (`Market5MinData`)
  - `searchMarkets(query)` full-text search
  - `liquidityUSID`, `lastSwapAt` on markets
- **WebSocket subscriptions** via `graphql-ws`
- **Subgraph-compatible endpoint** at `/subgraphs/name/hlpmm-protocol/hlpmm`

## Quick Start

```bash
cd indexer
npm install
cp .env.example .env   # edit with your RPC + DB credentials
npm run dev             # starts indexer + GraphQL server
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `RPC_URL` | JSON-RPC endpoint | `https://rpc.paxeer.network` |
| `RPC_WS_URL` | WebSocket RPC (optional) | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `START_BLOCK` | Block to start indexing from | `1535000` |
| `BATCH_SIZE` | Blocks per `eth_getLogs` call | `2000` |
| `CONCURRENCY` | Parallel batch chunks | `6` |
| `PORT` | HTTP server port | `4000` |

## Architecture

```
src/
├── index.ts              # Entry point: Express + Apollo + WS + indexer
├── config.ts             # Environment config
├── indexer.ts            # Core engine: batch log fetching + dispatch
├── abis.ts              # ABI fragments for all contracts
├── db/
│   ├── index.ts          # PostgreSQL pool + helpers
│   └── schema.ts         # DDL migrations
├── handlers/
│   ├── helpers.ts        # Decimal math, entity upserts, OHLC updates
│   ├── event-emitter.ts  # MarketCreated, Swap, FeeClaimed, FeeStrategyUpdated
│   ├── factory.ts        # Factory fallback MarketCreated
│   ├── market-nft.ts     # NFT Transfer, FeeStrategyUpdated, FeesClaimed
│   ├── pool.ts           # Sync (reserve updates)
│   ├── token.ts          # ERC20 Transfer (holder tracking)
│   └── usid.ts           # USID Transfer (supply + balance tracking)
└── graphql/
    ├── schema.ts         # GraphQL type definitions
    └── resolvers.ts      # Query + nested resolvers
```

## Production

```bash
npm run build
npm start
```
