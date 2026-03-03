"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
exports.typeDefs = `#graphql

# ─── Scalars ──────────────────────────────────────────────────
scalar BigInt
scalar BigDecimal
scalar Bytes

# ─── Enums ────────────────────────────────────────────────────
enum FeeStrategy { CLAIM BURN AIRDROP LP_REWARDS }
enum SwapSide { BUY SELL }

# ─── Protocol ─────────────────────────────────────────────────
type Protocol {
  id: ID!
  totalMarkets: BigInt!
  totalVolumeUSID: BigDecimal!
  totalFeesUSID: BigDecimal!
  totalSwaps: BigInt!
  totalUsers: BigInt!
  createdAt: BigInt!
  updatedAt: BigInt!
}

# ─── Market ───────────────────────────────────────────────────
type Market {
  id: ID!
  pool: Bytes!
  token: Token!
  nft: MarketNFT!
  creator: User!
  name: String!
  symbol: String!

  reserveUSID: BigDecimal!
  reserveToken: BigDecimal!

  spotPrice: BigDecimal!
  marketCap: BigDecimal!

  volumeUSID: BigDecimal!
  volumeToken: BigDecimal!
  feesUSID: BigDecimal!

  swapCount: BigInt!
  holderCount: BigInt!

  createdAt: BigInt!
  createdAtBlock: BigInt!
  updatedAt: BigInt!

  # ── Enriched fields (not in subgraph) ──
  priceChange1h: BigDecimal
  priceChange24h: BigDecimal
  priceChange7d: BigDecimal
  volumeUSID1h: BigDecimal
  volumeUSID24h: BigDecimal
  volumeUSID7d: BigDecimal
  ath: BigDecimal
  athTimestamp: BigInt
  atl: BigDecimal
  atlTimestamp: BigInt
  lastSwapAt: BigInt
  liquidityUSID: BigDecimal

  # ── Relations (The Graph style: plain lists; args optional) ──
  swaps(first: Int, skip: Int, orderBy: String, orderDirection: String): [Swap!]!
  hourData(first: Int, skip: Int, orderBy: String, orderDirection: String): [MarketHourData!]!
  dayData(first: Int, skip: Int, orderBy: String, orderDirection: String): [MarketDayData!]!
  fiveMinData(first: Int, skip: Int, orderBy: String, orderDirection: String): [Market5MinData!]!
}

# ─── Token ────────────────────────────────────────────────────
type Token {
  id: ID!
  address: Bytes!
  name: String!
  symbol: String!
  decimals: Int!
  totalSupply: BigDecimal!
  market: Market
  holderCount: BigInt!
  transferCount: BigInt!
  createdAt: BigInt!
}

# ─── MarketNFT ────────────────────────────────────────────────
type MarketNFT {
  id: ID!
  tokenId: BigInt!
  owner: User!
  market: Market!
  pool: Bytes!
  feeStrategy: FeeStrategy!
  totalFeesClaimed: BigDecimal!
  pendingFees: BigDecimal!
  mintedAt: BigInt!
  updatedAt: BigInt!

  # enriched
  lifetimeRevenue: BigDecimal
  strategyChanges: Int

  claims(first: Int, skip: Int): [FeeClaim!]!
  transfers(first: Int, skip: Int): [NFTTransfer!]!
}

# ─── User ─────────────────────────────────────────────────────
type User {
  id: ID!
  address: Bytes!
  totalSwaps: BigInt!
  totalVolumeUSID: BigDecimal!
  marketsCreated: BigInt!
  firstSeenAt: BigInt!
  lastSeenAt: BigInt!

  # enriched
  pnlUSID: BigDecimal
  uniqueMarkets: Int

  swaps(first: Int, skip: Int, orderBy: String, orderDirection: String): [Swap!]!
  ownedNFTs(first: Int, skip: Int): [MarketNFT!]!
  createdMarkets(first: Int, skip: Int): [Market!]!
  tokenBalances(first: Int, skip: Int): [UserTokenBalance!]!
}

# ─── UserTokenBalance ────────────────────────────────────────
type UserTokenBalance {
  id: ID!
  user: User!
  token: Token!
  balance: BigDecimal!
  updatedAt: BigInt!
}

# ─── Swap ─────────────────────────────────────────────────────
type Swap {
  id: ID!
  market: Market!
  user: User!
  txHash: Bytes!
  blockNumber: BigInt!
  timestamp: BigInt!
  logIndex: BigInt!
  tokenIn: Bytes!
  tokenOut: Bytes!
  amountIn: BigDecimal!
  amountOut: BigDecimal!
  amountInUSID: BigDecimal!
  reserveUSID: BigDecimal!
  reserveToken: BigDecimal!
  spotPrice: BigDecimal!
  feeAmount: BigDecimal!
  feeUSID: BigDecimal!

  # enriched
  priceImpact: BigDecimal
  side: SwapSide
}

# ─── FeeClaim ─────────────────────────────────────────────────
type FeeClaim {
  id: ID!
  nft: MarketNFT!
  recipient: User!
  amount: BigDecimal!
  txHash: Bytes!
  blockNumber: BigInt!
  timestamp: BigInt!
}

# ─── NFTTransfer ──────────────────────────────────────────────
type NFTTransfer {
  id: ID!
  nft: MarketNFT!
  from: User!
  to: User!
  txHash: Bytes!
  blockNumber: BigInt!
  timestamp: BigInt!
}

# ─── FeeStrategyChange ───────────────────────────────────────
type FeeStrategyChange {
  id: ID!
  nft: MarketNFT!
  oldStrategy: FeeStrategy!
  newStrategy: FeeStrategy!
  txHash: Bytes!
  blockNumber: BigInt!
  timestamp: BigInt!
}

# ─── OHLC time-series ────────────────────────────────────────
type MarketHourData {
  id: ID!
  market: Market!
  hourStartUnix: BigInt!
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!
  volumeUSID: BigDecimal!
  volumeToken: BigDecimal!
  feesUSID: BigDecimal!
  reserveUSID: BigDecimal!
  reserveToken: BigDecimal!
  swapCount: BigInt!
}

type MarketDayData {
  id: ID!
  market: Market!
  dayStartUnix: BigInt!
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!
  volumeUSID: BigDecimal!
  volumeToken: BigDecimal!
  feesUSID: BigDecimal!
  reserveUSID: BigDecimal!
  reserveToken: BigDecimal!
  swapCount: BigInt!
}

type Market5MinData {
  id: ID!
  market: Market!
  periodStart: BigInt!
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!
  volumeUSID: BigDecimal!
  volumeToken: BigDecimal!
  feesUSID: BigDecimal!
  reserveUSID: BigDecimal!
  reserveToken: BigDecimal!
  swapCount: BigInt!
}

type ProtocolDayData {
  id: ID!
  dayStartUnix: BigInt!
  volumeUSID: BigDecimal!
  feesUSID: BigDecimal!
  swapCount: BigInt!
  newMarkets: BigInt!
  activeUsers: BigInt!
  totalMarkets: BigInt!
  totalVolumeUSID: BigDecimal!
}

type Transaction {
  id: ID!
  blockNumber: BigInt!
  timestamp: BigInt!
  gasUsed: BigInt!
  gasPrice: BigInt!
}

# ─── Multi-timeframe Candle (1m,5m,15m,1h,4h,1d) ────────────
type Candle {
  id: ID!
  market: Market!
  timeframe: String!
  periodStart: BigInt!
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!
  volumeUSID: BigDecimal!
  volumeToken: BigDecimal!
  feesUSID: BigDecimal!
  tradeCount: BigInt!
}

# ─── Trending / FYP ──────────────────────────────────────────
type TrendingMarket {
  market: Market!
  score: Float!
  rank: Int!
  volumeVelocity: Float!
  priceMomentum: Float!
  tradeIntensity: Float!
  holderGrowth: Float!
  uniqueTraders1h: Int!
  freshness: Float!
  category: String!
  updatedAt: BigInt!
}

# ─── Indexer metadata ─────────────────────────────────────────
type _Meta {
  lastIndexedBlock: Int!
  hasIndexingErrors: Boolean!
}

# ─── Queries (The Graph compatible: String orderBy/orderDirection) ───
type Query {
  protocol(id: ID!): Protocol
  protocols(first: Int, skip: Int): [Protocol!]!

  market(id: ID!): Market
  markets(first: Int, skip: Int, orderBy: String, orderDirection: String, where: Market_filter): [Market!]!

  token(id: ID!): Token
  tokens(first: Int, skip: Int, orderBy: String, orderDirection: String): [Token!]!

  marketNFT(id: ID!): MarketNFT
  marketNFTs(first: Int, skip: Int): [MarketNFT!]!

  user(id: ID!): User
  users(first: Int, skip: Int, orderBy: String, orderDirection: String): [User!]!

  swap(id: ID!): Swap
  swaps(first: Int, skip: Int, orderBy: String, orderDirection: String, where: Swap_filter): [Swap!]!

  feeClaim(id: ID!): FeeClaim
  feeClaims(first: Int, skip: Int): [FeeClaim!]!

  nftTransfer(id: ID!): NFTTransfer
  nftTransfers(first: Int, skip: Int): [NFTTransfer!]!

  feeStrategyChange(id: ID!): FeeStrategyChange
  feeStrategyChanges(first: Int, skip: Int): [FeeStrategyChange!]!

  marketHourDatas(first: Int, skip: Int, where: MarketHourData_filter, orderBy: String, orderDirection: String): [MarketHourData!]!
  marketDayDatas(first: Int, skip: Int, where: MarketDayData_filter, orderBy: String, orderDirection: String): [MarketDayData!]!
  market5MinDatas(first: Int, skip: Int, where: Market5MinData_filter, orderBy: String, orderDirection: String): [Market5MinData!]!

  protocolDayDatas(first: Int, skip: Int, orderBy: String, orderDirection: String): [ProtocolDayData!]!

  userTokenBalance(id: ID!): UserTokenBalance
  userTokenBalances(first: Int, skip: Int, where: UserTokenBalance_filter, orderBy: String, orderDirection: String): [UserTokenBalance!]!

  transaction(id: ID!): Transaction

  # ── Candles (multi-timeframe OHLCV) ──
  candles(market: String!, timeframe: String!, first: Int, skip: Int, orderBy: String, orderDirection: String, where: Candle_filter): [Candle!]!

  # ── Trending / FYP ──
  trending(first: Int, skip: Int, category: String): [TrendingMarket!]!

  # Enriched: full-text search on market name
  searchMarkets(query: String!, first: Int): [Market!]!

  _meta: _Meta!
}

input Candle_filter {
  periodStart_gt: BigInt
  periodStart_lt: BigInt
  periodStart_gte: BigInt
  periodStart_lte: BigInt
}

# ─── Filters (The Graph compatible _gte/_lte/_gt/_lt/_contains) ───
input Market_filter {
  id: String
  id_in: [String!]
  pool: String
  creator: String
  creator_in: [String!]
  name: String
  name_contains: String
  name_contains_nocase: String
  symbol: String
  symbol_contains: String
  symbol_contains_nocase: String
  spotPrice_gt: BigDecimal
  spotPrice_lt: BigDecimal
  spotPrice_gte: BigDecimal
  spotPrice_lte: BigDecimal
  marketCap_gt: BigDecimal
  marketCap_lt: BigDecimal
  marketCap_gte: BigDecimal
  marketCap_lte: BigDecimal
  volumeUSID_gt: BigDecimal
  volumeUSID_lt: BigDecimal
  volumeUSID_gte: BigDecimal
  volumeUSID_lte: BigDecimal
  swapCount_gt: BigInt
  swapCount_lt: BigInt
  swapCount_gte: BigInt
  swapCount_lte: BigInt
  holderCount_gt: BigInt
  holderCount_lt: BigInt
  holderCount_gte: BigInt
  holderCount_lte: BigInt
  createdAt_gt: BigInt
  createdAt_lt: BigInt
  createdAt_gte: BigInt
  createdAt_lte: BigInt
  updatedAt_gt: BigInt
  updatedAt_lt: BigInt
  updatedAt_gte: BigInt
  updatedAt_lte: BigInt
}

input Swap_filter {
  id: String
  market: String
  market_in: [String!]
  user: String
  user_in: [String!]
  timestamp_gt: BigInt
  timestamp_lt: BigInt
  timestamp_gte: BigInt
  timestamp_lte: BigInt
  blockNumber_gt: BigInt
  blockNumber_lt: BigInt
  blockNumber_gte: BigInt
  blockNumber_lte: BigInt
  side: String
}

input MarketHourData_filter {
  id: String
  market: String
  market_in: [String!]
  hourStartUnix_gt: BigInt
  hourStartUnix_lt: BigInt
  hourStartUnix_gte: BigInt
  hourStartUnix_lte: BigInt
}

input MarketDayData_filter {
  id: String
  market: String
  market_in: [String!]
  dayStartUnix_gt: BigInt
  dayStartUnix_lt: BigInt
  dayStartUnix_gte: BigInt
  dayStartUnix_lte: BigInt
}

input Market5MinData_filter {
  id: String
  market: String
  market_in: [String!]
  periodStart_gt: BigInt
  periodStart_lt: BigInt
  periodStart_gte: BigInt
  periodStart_lte: BigInt
}

input UserTokenBalance_filter {
  id: String
  user: String
  user_in: [String!]
  token: String
  token_in: [String!]
  balance_gt: BigDecimal
  balance_lt: BigDecimal
  balance_gte: BigDecimal
  balance_lte: BigDecimal
}
`;
//# sourceMappingURL=schema.js.map