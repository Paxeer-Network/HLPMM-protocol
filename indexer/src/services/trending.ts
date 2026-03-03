/**
 * Trending & FYP (For You Page) Algorithm
 *
 * Periodically scores every market using a weighted composite of:
 *   1. Volume Velocity   — rate of volume growth (recent vs previous window)
 *   2. Price Momentum    — magnitude + direction of price change
 *   3. Trade Intensity   — swap frequency acceleration
 *   4. Holder Growth     — new holders joining
 *   5. Unique Traders 1h — breadth of participation (whale-resistant)
 *   6. Freshness         — recency decay — older idle markets sink
 *
 * Each signal is normalized 0-1 then combined with tunable weights.
 * Markets are bucketed into categories: "hot", "rising", "warm", "cold".
 */

import { getPool } from "../db";

// ─── Tunable weights ─────────────────────────────────────────
const W = {
  volumeVelocity: 0.30,
  priceMomentum:  0.15,
  tradeIntensity: 0.20,
  holderGrowth:   0.10,
  uniqueTraders:  0.15,
  freshness:      0.10,
};

// ─── Time windows (seconds) ─────────────────────────────────
const WINDOW_RECENT = 3600;      // 1 hour
const WINDOW_PREVIOUS = 3600;    // the hour before that
const FRESHNESS_HALFLIFE = 7200; // 2 hours — score halves every 2h of inactivity

let running = false;
let loopHandle: ReturnType<typeof setTimeout> | null = null;

// ─── Scoring ─────────────────────────────────────────────────

async function computeScores(): Promise<void> {
  const pool = getPool();
  const now = Math.floor(Date.now() / 1000);
  const recentStart = now - WINDOW_RECENT;
  const prevStart = recentStart - WINDOW_PREVIOUS;

  // 1. Get all markets
  const mkts = await pool.query(
    "SELECT id, spot_price, volume_usid, swap_count, holder_count, last_swap_at FROM market"
  );
  if (mkts.rows.length === 0) return;

  // 2. Pre-fetch aggregate swap data for all markets in recent + previous windows
  const recentSwaps = await pool.query(
    `SELECT market_id,
            COUNT(*)::int AS cnt,
            COUNT(DISTINCT user_id)::int AS unique_traders,
            COALESCE(SUM(amount_in_usid::numeric), 0) AS vol
     FROM swap WHERE "timestamp" >= $1
     GROUP BY market_id`,
    [recentStart]
  );
  const prevSwaps = await pool.query(
    `SELECT market_id,
            COUNT(*)::int AS cnt,
            COALESCE(SUM(amount_in_usid::numeric), 0) AS vol
     FROM swap WHERE "timestamp" >= $1 AND "timestamp" < $2
     GROUP BY market_id`,
    [prevStart, recentStart]
  );

  // 3. Pre-fetch price an hour ago per market (from candles or swaps)
  const priceAnHourAgo = await pool.query(
    `SELECT DISTINCT ON (market_id) market_id, spot_price
     FROM swap
     WHERE "timestamp" <= $1
     ORDER BY market_id, "timestamp" DESC`,
    [recentStart]
  );

  // Build lookup maps
  const recentMap = new Map<string, { cnt: number; uniqueTraders: number; vol: number }>();
  for (const r of recentSwaps.rows) {
    recentMap.set(r.market_id, {
      cnt: Number(r.cnt),
      uniqueTraders: Number(r.unique_traders),
      vol: Number(r.vol),
    });
  }
  const prevMap = new Map<string, { cnt: number; vol: number }>();
  for (const r of prevSwaps.rows) {
    prevMap.set(r.market_id, { cnt: Number(r.cnt), vol: Number(r.vol) });
  }
  const priceMap = new Map<string, number>();
  for (const r of priceAnHourAgo.rows) {
    priceMap.set(r.market_id, parseFloat(r.spot_price) || 0);
  }

  // 4. Compute raw signals
  interface RawScore {
    marketId: string;
    volumeVelocity: number;
    priceMomentum: number;
    tradeIntensity: number;
    holderGrowth: number;
    uniqueTraders1h: number;
    freshness: number;
  }

  const rawScores: RawScore[] = [];

  for (const m of mkts.rows) {
    const mid = m.id as string;
    const currentPrice = parseFloat(m.spot_price) || 0;
    const holderCount = Number(m.holder_count) || 0;
    const lastSwapAt = Number(m.last_swap_at) || 0;

    const recent = recentMap.get(mid) || { cnt: 0, uniqueTraders: 0, vol: 0 };
    const prev = prevMap.get(mid) || { cnt: 0, vol: 0 };
    const oldPrice = priceMap.get(mid) || currentPrice;

    // Volume velocity: (recentVol - prevVol) / max(prevVol, 1)
    const volVelocity = prev.vol > 0
      ? (recent.vol - prev.vol) / prev.vol
      : recent.vol > 0 ? 1 : 0;

    // Price momentum: abs(price change %) — capped at 10x (1000%)
    const priceMom = oldPrice > 0
      ? Math.min(Math.abs((currentPrice - oldPrice) / oldPrice), 10)
      : 0;

    // Trade intensity: (recentCount - prevCount) / max(prevCount, 1)
    const tradeInt = prev.cnt > 0
      ? (recent.cnt - prev.cnt) / prev.cnt
      : recent.cnt > 0 ? 1 : 0;

    // Holder growth: holderCount (will be normalized later)
    const hGrowth = holderCount;

    // Unique traders 1h
    const uTraders = recent.uniqueTraders;

    // Freshness: exponential decay based on time since last swap
    const staleness = Math.max(now - lastSwapAt, 0);
    const fresh = Math.exp(-0.693 * staleness / FRESHNESS_HALFLIFE); // ln(2) ≈ 0.693

    rawScores.push({
      marketId: mid,
      volumeVelocity: volVelocity,
      priceMomentum: priceMom,
      tradeIntensity: tradeInt,
      holderGrowth: hGrowth,
      uniqueTraders1h: uTraders,
      freshness: fresh,
    });
  }

  if (rawScores.length === 0) return;

  // 5. Normalize each signal 0-1 using min-max across all markets
  const normalize = (vals: number[]): number[] => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    if (range === 0) return vals.map(() => 0);
    return vals.map(v => (v - min) / range);
  };

  const nVolVel = normalize(rawScores.map(s => s.volumeVelocity));
  const nPriceMom = normalize(rawScores.map(s => s.priceMomentum));
  const nTradeInt = normalize(rawScores.map(s => s.tradeIntensity));
  const nHolder = normalize(rawScores.map(s => s.holderGrowth));
  const nTraders = normalize(rawScores.map(s => s.uniqueTraders1h));
  const nFresh = normalize(rawScores.map(s => s.freshness));

  // 6. Weighted composite score
  interface FinalScore {
    marketId: string;
    score: number;
    volumeVelocity: number;
    priceMomentum: number;
    tradeIntensity: number;
    holderGrowth: number;
    uniqueTraders1h: number;
    freshness: number;
    category: string;
  }

  const finals: FinalScore[] = rawScores.map((raw, i) => {
    const score =
      W.volumeVelocity * nVolVel[i] +
      W.priceMomentum  * nPriceMom[i] +
      W.tradeIntensity * nTradeInt[i] +
      W.holderGrowth   * nHolder[i] +
      W.uniqueTraders  * nTraders[i] +
      W.freshness      * nFresh[i];

    return {
      marketId: raw.marketId,
      score,
      volumeVelocity: raw.volumeVelocity,
      priceMomentum: raw.priceMomentum,
      tradeIntensity: raw.tradeIntensity,
      holderGrowth: raw.holderGrowth,
      uniqueTraders1h: raw.uniqueTraders1h,
      freshness: raw.freshness,
      category: "cold",
    };
  });

  // 7. Sort by score desc and assign ranks + categories
  finals.sort((a, b) => b.score - a.score);

  const total = finals.length;
  for (let i = 0; i < total; i++) {
    finals[i].category = classifyRank(i, total, finals[i].score);
  }

  // 8. Upsert into DB
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < finals.length; i++) {
      const f = finals[i];
      await client.query(
        `INSERT INTO trending_score
           (market_id, score, rank, volume_velocity, price_momentum, trade_intensity,
            holder_growth, unique_traders_1h, freshness, category, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (market_id) DO UPDATE SET
           score = $2, rank = $3, volume_velocity = $4, price_momentum = $5,
           trade_intensity = $6, holder_growth = $7, unique_traders_1h = $8,
           freshness = $9, category = $10, updated_at = $11`,
        [f.marketId, f.score, i + 1, f.volumeVelocity, f.priceMomentum,
         f.tradeIntensity, f.holderGrowth, f.uniqueTraders1h, f.freshness,
         f.category, now]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`[trending] Scored ${finals.length} markets — top: ${finals[0]?.marketId} (${finals[0]?.score.toFixed(4)}, ${finals[0]?.category})`);
}

// ─── Category assignment ─────────────────────────────────────

function classifyRank(rank: number, total: number, score: number): string {
  // If score is essentially zero, always cold
  if (score < 0.01) return "cold";

  const pct = rank / total;
  if (pct <= 0.05) return "hot";       // top 5%
  if (pct <= 0.15) return "rising";    // top 15%
  if (pct <= 0.40) return "warm";      // top 40%
  return "cold";
}

// ─── Main loop ───────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!running) return;

  try {
    await computeScores();
  } catch (err) {
    console.error("[trending] Error computing scores:", err);
  }

  // Recompute every 30 seconds — fast enough for a live FYP feed
  if (running) {
    loopHandle = setTimeout(tick, 30_000);
  }
}

// ─── Public API ──────────────────────────────────────────────

export async function startTrendingService(): Promise<void> {
  if (running) return;
  running = true;
  console.log("[trending] Starting trending/FYP scoring engine (30s cadence)");
  // Delay first tick 10s to let the indexer populate some data first
  loopHandle = setTimeout(tick, 10_000);
}

export async function stopTrendingService(): Promise<void> {
  running = false;
  if (loopHandle) clearTimeout(loopHandle);
  console.log("[trending] Trending service stopped.");
}
