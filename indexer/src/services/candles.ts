/**
 * Multi-timeframe candle service
 *
 * Workers poll the swap table tick-by-tick per market and build OHLCV candles
 * for 1m, 5m, 15m, 1h, 4h, 1d timeframes.
 *
 * When there is no new swap data for a market the last known price is carried
 * forward in memory but NO empty candles are written to the database — only
 * candles that contain at least one trade are persisted.
 */

import { getPool } from "../db";

// ─── Timeframe definitions (label → seconds) ────────────────
export const TIMEFRAMES: Record<string, number> = {
  "1m":  60,
  "5m":  300,
  "15m": 900,
  "1h":  3600,
  "4h":  14400,
  "1d":  86400,
};

const TF_KEYS = Object.keys(TIMEFRAMES);

// ─── Per-market in-memory state ──────────────────────────────
interface CandleWIP {
  open: string;
  high: string;
  low: string;
  close: string;
  volumeUSID: string;
  volumeToken: string;
  feesUSID: string;
  tradeCount: number;
  periodStart: number;
}

interface MarketWorkerState {
  lastPrice: string;                       // carry-forward price
  lastProcessedSwapTs: number;             // timestamp of last swap we consumed
  lastProcessedSwapId: string;             // id of last swap we consumed
  candles: Record<string, CandleWIP>;      // tf → WIP candle
}

const workers = new Map<string, MarketWorkerState>();

let running = false;
let loopHandle: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ─────────────────────────────────────────────────

function periodStart(timestamp: number, intervalSec: number): number {
  return Math.floor(timestamp / intervalSec) * intervalSec;
}

function candleId(marketId: string, tf: string, pStart: number): string {
  return `${marketId}-${tf}-${pStart}`;
}

/** Compare two numeric strings (18-decimal fixed-point or plain) */
function gt(a: string, b: string): boolean {
  // Fast path — both are "0"
  if (a === b) return false;
  try {
    // Remove leading zeros, compare as BigInt after stripping decimal (all 18-dec)
    const toBI = (s: string) => {
      const parts = s.split(".");
      const whole = parts[0] || "0";
      const frac = (parts[1] || "").padEnd(18, "0").slice(0, 18);
      return BigInt(whole + frac);
    };
    return toBI(a) > toBI(b);
  } catch {
    return parseFloat(a) > parseFloat(b);
  }
}

function lt(a: string, b: string): boolean {
  if (a === b) return false;
  return gt(b, a);
}

function addStr(a: string, b: string): string {
  try {
    const toBI = (s: string) => {
      const parts = s.split(".");
      const whole = parts[0] || "0";
      const frac = (parts[1] || "").padEnd(18, "0").slice(0, 18);
      return BigInt(whole + frac);
    };
    const sum = toBI(a) + toBI(b);
    const s = sum.toString().padStart(19, "0");
    const whole = s.slice(0, s.length - 18) || "0";
    const frac = s.slice(s.length - 18).replace(/0+$/, "") || "0";
    return frac === "0" ? whole : `${whole}.${frac}`;
  } catch {
    return (parseFloat(a) + parseFloat(b)).toString();
  }
}

// ─── Core: process new swaps for a single market ─────────────

async function processMarketTicks(marketId: string, state: MarketWorkerState): Promise<void> {
  const pool = getPool();

  // Fetch new swaps since last processed, ordered by time+logIndex
  const res = await pool.query(
    `SELECT id, "timestamp", spot_price, amount_in_usid, amount_in, amount_out, fee_usid, side
     FROM swap
     WHERE market_id = $1
       AND ("timestamp" > $2 OR ("timestamp" = $2 AND id > $3))
     ORDER BY "timestamp" ASC, log_index ASC
     LIMIT 500`,
    [marketId, state.lastProcessedSwapTs, state.lastProcessedSwapId]
  );

  if (res.rows.length === 0) return; // no new data — don't store anything

  for (const swap of res.rows) {
    const ts = Number(swap.timestamp);
    const price = swap.spot_price as string;
    const volUSID = swap.amount_in_usid as string;
    const volToken = swap.amount_in as string;
    const fee = swap.fee_usid as string;

    state.lastPrice = price;
    state.lastProcessedSwapTs = ts;
    state.lastProcessedSwapId = swap.id;

    // Update every timeframe's WIP candle
    for (const tf of TF_KEYS) {
      const interval = TIMEFRAMES[tf];
      const pStart = periodStart(ts, interval);

      let c = state.candles[tf];

      // If no WIP candle or the period rolled over → flush old & start new
      if (!c || c.periodStart !== pStart) {
        // Flush the old candle to DB if it exists
        if (c && c.tradeCount > 0) {
          await flushCandle(marketId, tf, c);
        }
        // Start fresh candle
        c = {
          open: price,
          high: price,
          low: price,
          close: price,
          volumeUSID: "0",
          volumeToken: "0",
          feesUSID: "0",
          tradeCount: 0,
          periodStart: pStart,
        };
        state.candles[tf] = c;
      }

      // Update OHLCV
      if (gt(price, c.high)) c.high = price;
      if (lt(price, c.low)) c.low = price;
      c.close = price;
      c.volumeUSID = addStr(c.volumeUSID, volUSID);
      c.volumeToken = addStr(c.volumeToken, volToken);
      c.feesUSID = addStr(c.feesUSID, fee);
      c.tradeCount++;
    }
  }
}

// ─── Flush a completed candle to PostgreSQL ──────────────────

async function flushCandle(marketId: string, tf: string, c: CandleWIP): Promise<void> {
  const pool = getPool();
  const id = candleId(marketId, tf, c.periodStart);
  await pool.query(
    `INSERT INTO candle (id, market_id, timeframe, period_start, "open", high, low, "close", volume_usid, volume_token, fees_usid, trade_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (market_id, timeframe, period_start) DO UPDATE SET
       high = CASE WHEN EXCLUDED.high::numeric > candle.high::numeric THEN EXCLUDED.high ELSE candle.high END,
       low  = CASE WHEN EXCLUDED.low::numeric  < candle.low::numeric  THEN EXCLUDED.low  ELSE candle.low  END,
       "close" = EXCLUDED."close",
       volume_usid  = (candle.volume_usid::numeric  + EXCLUDED.volume_usid::numeric)::text,
       volume_token = (candle.volume_token::numeric + EXCLUDED.volume_token::numeric)::text,
       fees_usid    = (candle.fees_usid::numeric    + EXCLUDED.fees_usid::numeric)::text,
       trade_count  = candle.trade_count + EXCLUDED.trade_count`,
    [id, marketId, tf, c.periodStart, c.open, c.high, c.low, c.close,
     c.volumeUSID, c.volumeToken, c.feesUSID, c.tradeCount]
  );
}

// ─── Flush all in-flight WIP candles (on shutdown or period end) ──

async function flushAllWIP(): Promise<void> {
  for (const [marketId, state] of workers) {
    for (const tf of TF_KEYS) {
      const c = state.candles[tf];
      if (c && c.tradeCount > 0) {
        await flushCandle(marketId, tf, c);
      }
    }
  }
}

// ─── Main loop ───────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!running) return;

  try {
    const pool = getPool();

    // Discover all markets that have swaps
    const mkts = await pool.query("SELECT DISTINCT id FROM market");

    for (const row of mkts.rows) {
      const marketId = row.id as string;

      // Lazily create worker state
      if (!workers.has(marketId)) {
        // Seed from the last candle we wrote (resume after restart)
        const lastCandle = await pool.query(
          `SELECT period_start, "close" FROM candle WHERE market_id = $1 ORDER BY period_start DESC LIMIT 1`,
          [marketId]
        );
        const seedPrice = lastCandle.rows[0]?.close ?? "0";
        const seedTs = lastCandle.rows[0] ? Number(lastCandle.rows[0].period_start) : 0;

        workers.set(marketId, {
          lastPrice: seedPrice,
          lastProcessedSwapTs: seedTs,
          lastProcessedSwapId: "",
          candles: {},
        });
      }

      await processMarketTicks(marketId, workers.get(marketId)!);
    }
  } catch (err) {
    console.error("[candles] Error in candle tick:", err);
  }

  // Schedule next tick (2s cadence — fast enough for tick-by-tick, light on DB)
  if (running) {
    loopHandle = setTimeout(tick, 2000);
  }
}

// ─── Public API ──────────────────────────────────────────────

export async function startCandleService(): Promise<void> {
  if (running) return;
  running = true;
  console.log("[candles] Starting multi-timeframe candle service (1m,5m,15m,1h,4h,1d)");
  tick();
}

export async function stopCandleService(): Promise<void> {
  running = false;
  if (loopHandle) clearTimeout(loopHandle);
  await flushAllWIP();
  console.log("[candles] Candle service stopped, WIP candles flushed.");
}
