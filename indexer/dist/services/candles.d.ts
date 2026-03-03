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
export declare const TIMEFRAMES: Record<string, number>;
export declare function startCandleService(): Promise<void>;
export declare function stopCandleService(): Promise<void>;
//# sourceMappingURL=candles.d.ts.map