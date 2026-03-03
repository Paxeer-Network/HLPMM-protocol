import { Pool, PoolClient } from "pg";
import { config } from "../config";
import { MIGRATIONS } from "./schema";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return _pool;
}

/** Run schema migrations and ensure protocol row */
export async function initDb(): Promise<void> {
  const pool = getPool();
  await pool.query(MIGRATIONS);
  await pool.query(
    `INSERT INTO protocol (id, total_markets, total_volume_usid, total_fees_usid, total_swaps, total_users, created_at, updated_at)
     VALUES ('1', 0, '0', '0', 0, 0, 0, 0)
     ON CONFLICT (id) DO NOTHING`
  );
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/** Get a client from the pool for transaction batching */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/** Get the last indexed block from _meta */
export async function getLastIndexedBlock(): Promise<number> {
  const pool = getPool();
  const res = await pool.query("SELECT value FROM _meta WHERE key = 'last_block'");
  if (res.rows.length > 0) return parseInt(res.rows[0].value, 10);
  return config.startBlock - 1;
}

/** Save checkpoint */
export async function setLastIndexedBlock(block: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO _meta (key, value) VALUES ('last_block', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [block.toString()]
  );
}
