import { Pool, PoolClient } from "pg";
export declare const ZERO = "0";
export declare const USID_ADDRESS: string;
export declare const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
/** Convert raw wei string to decimal string (18 decimals) */
export declare function toDecimal(raw: string | bigint, decimals?: number): string;
export declare function addDec(a: string, b: string): string;
export declare function subDec(a: string, b: string): string;
export declare function mulDec(a: string, b: string): string;
export declare function divDec(a: string, b: string): string;
export declare function cmpDec(a: string, b: string): number;
export declare function maxDec(a: string, b: string): string;
export declare function minDec(a: string, b: string): string;
export declare function isZeroDec(a: string): boolean;
/** Map fee strategy integer to enum string */
export declare function feeStrategyFromInt(s: number): string;
export declare function getOrCreateProtocol(client?: Pool | PoolClient): Promise<any>;
export declare function getOrCreateUser(address: string, timestamp: number, client?: Pool | PoolClient): Promise<any>;
export declare function updateMarketHourData(marketId: string, timestamp: number, price: string, volumeUSID: string, volumeToken: string, feesUSID: string, reserveUSID: string, reserveToken: string, client?: Pool | PoolClient): Promise<void>;
export declare function updateMarketDayData(marketId: string, timestamp: number, price: string, volumeUSID: string, volumeToken: string, feesUSID: string, reserveUSID: string, reserveToken: string, client?: Pool | PoolClient): Promise<void>;
export declare function updateMarket5MinData(marketId: string, timestamp: number, price: string, volumeUSID: string, volumeToken: string, feesUSID: string, reserveUSID: string, reserveToken: string, client?: Pool | PoolClient): Promise<void>;
export declare function updateProtocolDayData(timestamp: number, volumeUSID: string, feesUSID: string, swapCount: number, newMarkets: number, client?: Pool | PoolClient): Promise<void>;
/** Update enriched rolling window fields on market */
export declare function refreshMarketEnrichedFields(marketId: string, timestamp: number, client?: Pool | PoolClient): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map