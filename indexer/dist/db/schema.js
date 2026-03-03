"use strict";
/** PostgreSQL schema for HLPMM indexer — mirrors subgraph entities with richer columns */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIGRATIONS = void 0;
exports.MIGRATIONS = `
-- ============================================================
-- Meta / checkpoint
-- ============================================================
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================
-- Protocol
-- ============================================================
CREATE TABLE IF NOT EXISTS protocol (
  id                TEXT PRIMARY KEY DEFAULT '1',
  total_markets     BIGINT NOT NULL DEFAULT 0,
  total_volume_usid TEXT NOT NULL DEFAULT '0',
  total_fees_usid   TEXT NOT NULL DEFAULT '0',
  total_swaps       BIGINT NOT NULL DEFAULT 0,
  total_users       BIGINT NOT NULL DEFAULT 0,
  created_at        BIGINT NOT NULL DEFAULT 0,
  updated_at        BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- Market
-- ============================================================
CREATE TABLE IF NOT EXISTS market (
  id               TEXT PRIMARY KEY,
  pool             TEXT NOT NULL,
  token_id         TEXT NOT NULL,
  nft_id           TEXT NOT NULL,
  creator_id       TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  symbol           TEXT NOT NULL DEFAULT '',

  reserve_usid     TEXT NOT NULL DEFAULT '0',
  reserve_token    TEXT NOT NULL DEFAULT '0',

  spot_price       TEXT NOT NULL DEFAULT '0',
  market_cap       TEXT NOT NULL DEFAULT '0',

  volume_usid      TEXT NOT NULL DEFAULT '0',
  volume_token     TEXT NOT NULL DEFAULT '0',
  fees_usid        TEXT NOT NULL DEFAULT '0',

  swap_count       BIGINT NOT NULL DEFAULT 0,
  holder_count     BIGINT NOT NULL DEFAULT 0,

  created_at       BIGINT NOT NULL DEFAULT 0,
  created_at_block BIGINT NOT NULL DEFAULT 0,
  updated_at       BIGINT NOT NULL DEFAULT 0,

  -- enriched fields (not in subgraph)
  price_change_1h  TEXT NOT NULL DEFAULT '0',
  price_change_24h TEXT NOT NULL DEFAULT '0',
  price_change_7d  TEXT NOT NULL DEFAULT '0',
  volume_usid_1h   TEXT NOT NULL DEFAULT '0',
  volume_usid_24h  TEXT NOT NULL DEFAULT '0',
  volume_usid_7d   TEXT NOT NULL DEFAULT '0',
  ath              TEXT NOT NULL DEFAULT '0',
  ath_timestamp    BIGINT NOT NULL DEFAULT 0,
  atl              TEXT NOT NULL DEFAULT '0',
  atl_timestamp    BIGINT NOT NULL DEFAULT 0,
  last_swap_at     BIGINT NOT NULL DEFAULT 0,
  liquidity_usid   TEXT NOT NULL DEFAULT '0'
);

CREATE INDEX IF NOT EXISTS idx_market_creator ON market(creator_id);
CREATE INDEX IF NOT EXISTS idx_market_token   ON market(token_id);
CREATE INDEX IF NOT EXISTS idx_market_created ON market(created_at);
CREATE INDEX IF NOT EXISTS idx_market_volume  ON market(volume_usid);
CREATE INDEX IF NOT EXISTS idx_market_name    ON market(LOWER(name));

-- ============================================================
-- Token
-- ============================================================
CREATE TABLE IF NOT EXISTS token (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  symbol          TEXT NOT NULL DEFAULT '',
  decimals        INT NOT NULL DEFAULT 18,
  total_supply    TEXT NOT NULL DEFAULT '0',
  market_id       TEXT,
  holder_count    BIGINT NOT NULL DEFAULT 0,
  transfer_count  BIGINT NOT NULL DEFAULT 0,
  created_at      BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- MarketNFT
-- ============================================================
CREATE TABLE IF NOT EXISTS market_nft (
  id                 TEXT PRIMARY KEY,
  token_id_num       BIGINT NOT NULL,
  owner_id           TEXT NOT NULL,
  market_id          TEXT NOT NULL,
  pool               TEXT NOT NULL,
  fee_strategy       TEXT NOT NULL DEFAULT 'CLAIM',
  total_fees_claimed TEXT NOT NULL DEFAULT '0',
  pending_fees       TEXT NOT NULL DEFAULT '0',
  minted_at          BIGINT NOT NULL DEFAULT 0,
  updated_at         BIGINT NOT NULL DEFAULT 0,

  -- enriched
  lifetime_revenue   TEXT NOT NULL DEFAULT '0',
  strategy_changes   INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nft_owner  ON market_nft(owner_id);
CREATE INDEX IF NOT EXISTS idx_nft_market ON market_nft(market_id);

-- ============================================================
-- User
-- ============================================================
CREATE TABLE IF NOT EXISTS "user" (
  id                TEXT PRIMARY KEY,
  address           TEXT NOT NULL,
  total_swaps       BIGINT NOT NULL DEFAULT 0,
  total_volume_usid TEXT NOT NULL DEFAULT '0',
  markets_created   BIGINT NOT NULL DEFAULT 0,
  first_seen_at     BIGINT NOT NULL DEFAULT 0,
  last_seen_at      BIGINT NOT NULL DEFAULT 0,

  -- enriched
  pnl_usid          TEXT NOT NULL DEFAULT '0',
  unique_markets    INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_volume ON "user"(total_volume_usid);
CREATE INDEX IF NOT EXISTS idx_user_swaps  ON "user"(total_swaps);

-- ============================================================
-- UserTokenBalance
-- ============================================================
CREATE TABLE IF NOT EXISTS user_token_balance (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_id   TEXT NOT NULL,
  balance    TEXT NOT NULL DEFAULT '0',
  updated_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_utb_user  ON user_token_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_utb_token ON user_token_balance(token_id);

-- ============================================================
-- Swap
-- ============================================================
CREATE TABLE IF NOT EXISTS swap (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  tx_hash         TEXT NOT NULL,
  block_number    BIGINT NOT NULL,
  "timestamp"     BIGINT NOT NULL,
  log_index       INT NOT NULL,
  token_in        TEXT NOT NULL,
  token_out       TEXT NOT NULL,
  amount_in       TEXT NOT NULL DEFAULT '0',
  amount_out      TEXT NOT NULL DEFAULT '0',
  amount_in_usid  TEXT NOT NULL DEFAULT '0',
  reserve_usid    TEXT NOT NULL DEFAULT '0',
  reserve_token   TEXT NOT NULL DEFAULT '0',
  spot_price      TEXT NOT NULL DEFAULT '0',
  fee_amount      TEXT NOT NULL DEFAULT '0',
  fee_usid        TEXT NOT NULL DEFAULT '0',

  -- enriched
  price_impact    TEXT NOT NULL DEFAULT '0',
  side            TEXT NOT NULL DEFAULT 'BUY'
);

CREATE INDEX IF NOT EXISTS idx_swap_market    ON swap(market_id);
CREATE INDEX IF NOT EXISTS idx_swap_user      ON swap(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_timestamp ON swap("timestamp");
CREATE INDEX IF NOT EXISTS idx_swap_block     ON swap(block_number);

-- ============================================================
-- FeeClaim
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_claim (
  id           TEXT PRIMARY KEY,
  nft_id       TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  amount       TEXT NOT NULL DEFAULT '0',
  tx_hash      TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  "timestamp"  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fc_nft ON fee_claim(nft_id);

-- ============================================================
-- NFTTransfer
-- ============================================================
CREATE TABLE IF NOT EXISTS nft_transfer (
  id           TEXT PRIMARY KEY,
  nft_id       TEXT NOT NULL,
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  tx_hash      TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  "timestamp"  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nt_nft ON nft_transfer(nft_id);

-- ============================================================
-- FeeStrategyChange
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_strategy_change (
  id            TEXT PRIMARY KEY,
  nft_id        TEXT NOT NULL,
  old_strategy  TEXT NOT NULL,
  new_strategy  TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  block_number  BIGINT NOT NULL,
  "timestamp"   BIGINT NOT NULL
);

-- ============================================================
-- MarketHourData
-- ============================================================
CREATE TABLE IF NOT EXISTS market_hour_data (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL,
  hour_start_unix BIGINT NOT NULL,
  "open"          TEXT NOT NULL DEFAULT '0',
  high            TEXT NOT NULL DEFAULT '0',
  low             TEXT NOT NULL DEFAULT '0',
  "close"         TEXT NOT NULL DEFAULT '0',
  volume_usid     TEXT NOT NULL DEFAULT '0',
  volume_token    TEXT NOT NULL DEFAULT '0',
  fees_usid       TEXT NOT NULL DEFAULT '0',
  reserve_usid    TEXT NOT NULL DEFAULT '0',
  reserve_token   TEXT NOT NULL DEFAULT '0',
  swap_count      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mhd_market ON market_hour_data(market_id, hour_start_unix);

-- ============================================================
-- MarketDayData
-- ============================================================
CREATE TABLE IF NOT EXISTS market_day_data (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL,
  day_start_unix  BIGINT NOT NULL,
  "open"          TEXT NOT NULL DEFAULT '0',
  high            TEXT NOT NULL DEFAULT '0',
  low             TEXT NOT NULL DEFAULT '0',
  "close"         TEXT NOT NULL DEFAULT '0',
  volume_usid     TEXT NOT NULL DEFAULT '0',
  volume_token    TEXT NOT NULL DEFAULT '0',
  fees_usid       TEXT NOT NULL DEFAULT '0',
  reserve_usid    TEXT NOT NULL DEFAULT '0',
  reserve_token   TEXT NOT NULL DEFAULT '0',
  swap_count      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mdd_market ON market_day_data(market_id, day_start_unix);

-- ============================================================
-- Market5MinData (enriched — finer granularity)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_5min_data (
  id              TEXT PRIMARY KEY,
  market_id       TEXT NOT NULL,
  period_start    BIGINT NOT NULL,
  "open"          TEXT NOT NULL DEFAULT '0',
  high            TEXT NOT NULL DEFAULT '0',
  low             TEXT NOT NULL DEFAULT '0',
  "close"         TEXT NOT NULL DEFAULT '0',
  volume_usid     TEXT NOT NULL DEFAULT '0',
  volume_token    TEXT NOT NULL DEFAULT '0',
  fees_usid       TEXT NOT NULL DEFAULT '0',
  reserve_usid    TEXT NOT NULL DEFAULT '0',
  reserve_token   TEXT NOT NULL DEFAULT '0',
  swap_count      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_m5d_market ON market_5min_data(market_id, period_start);

-- ============================================================
-- ProtocolDayData
-- ============================================================
CREATE TABLE IF NOT EXISTS protocol_day_data (
  id                TEXT PRIMARY KEY,
  day_start_unix    BIGINT NOT NULL,
  volume_usid       TEXT NOT NULL DEFAULT '0',
  fees_usid         TEXT NOT NULL DEFAULT '0',
  swap_count        BIGINT NOT NULL DEFAULT 0,
  new_markets       BIGINT NOT NULL DEFAULT 0,
  active_users      BIGINT NOT NULL DEFAULT 0,
  total_markets     BIGINT NOT NULL DEFAULT 0,
  total_volume_usid TEXT NOT NULL DEFAULT '0'
);

-- ============================================================
-- Transaction
-- ============================================================
CREATE TABLE IF NOT EXISTS "transaction" (
  id           TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  "timestamp"  BIGINT NOT NULL,
  gas_used     TEXT NOT NULL DEFAULT '0',
  gas_price    TEXT NOT NULL DEFAULT '0'
);

-- ============================================================
-- Dynamic pool tracking (replaces subgraph templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS tracked_pool (
  address       TEXT PRIMARY KEY,
  token_address TEXT NOT NULL,
  created_at    BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tracked_token (
  address    TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- Multi-timeframe candles (1m, 5m, 15m, 1h, 4h, 1d)
-- Single unified table partitioned by timeframe for efficiency
-- ============================================================
CREATE TABLE IF NOT EXISTS candle (
  id            TEXT PRIMARY KEY,
  market_id     TEXT NOT NULL,
  timeframe     TEXT NOT NULL,
  period_start  BIGINT NOT NULL,
  "open"        TEXT NOT NULL DEFAULT '0',
  high          TEXT NOT NULL DEFAULT '0',
  low           TEXT NOT NULL DEFAULT '0',
  "close"       TEXT NOT NULL DEFAULT '0',
  volume_usid   TEXT NOT NULL DEFAULT '0',
  volume_token  TEXT NOT NULL DEFAULT '0',
  fees_usid     TEXT NOT NULL DEFAULT '0',
  trade_count   BIGINT NOT NULL DEFAULT 0,
  UNIQUE(market_id, timeframe, period_start)
);

CREATE INDEX IF NOT EXISTS idx_candle_market_tf   ON candle(market_id, timeframe, period_start);
CREATE INDEX IF NOT EXISTS idx_candle_tf_period    ON candle(timeframe, period_start);

-- ============================================================
-- Trending scores — recomputed periodically by the FYP engine
-- ============================================================
CREATE TABLE IF NOT EXISTS trending_score (
  market_id           TEXT PRIMARY KEY,
  score               DOUBLE PRECISION NOT NULL DEFAULT 0,
  rank                INT NOT NULL DEFAULT 0,
  volume_velocity     DOUBLE PRECISION NOT NULL DEFAULT 0,
  price_momentum      DOUBLE PRECISION NOT NULL DEFAULT 0,
  trade_intensity     DOUBLE PRECISION NOT NULL DEFAULT 0,
  holder_growth       DOUBLE PRECISION NOT NULL DEFAULT 0,
  unique_traders_1h   INT NOT NULL DEFAULT 0,
  freshness           DOUBLE PRECISION NOT NULL DEFAULT 0,
  category            TEXT NOT NULL DEFAULT 'cold',
  updated_at          BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trending_score ON trending_score(score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_cat   ON trending_score(category, score DESC);
`;
//# sourceMappingURL=schema.js.map