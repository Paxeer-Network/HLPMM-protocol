import { Pool, PoolClient } from "pg";
export declare function getPool(): Pool;
/** Run schema migrations and ensure protocol row */
export declare function initDb(): Promise<void>;
export declare function closeDb(): Promise<void>;
/** Get a client from the pool for transaction batching */
export declare function getClient(): Promise<PoolClient>;
/** Get the last indexed block from _meta */
export declare function getLastIndexedBlock(): Promise<number>;
/** Save checkpoint */
export declare function setLastIndexedBlock(block: number): Promise<void>;
//# sourceMappingURL=index.d.ts.map