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
export declare function startTrendingService(): Promise<void>;
export declare function stopTrendingService(): Promise<void>;
//# sourceMappingURL=trending.d.ts.map