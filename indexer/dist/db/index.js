"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.initDb = initDb;
exports.closeDb = closeDb;
exports.getClient = getClient;
exports.getLastIndexedBlock = getLastIndexedBlock;
exports.setLastIndexedBlock = setLastIndexedBlock;
const pg_1 = require("pg");
const config_1 = require("../config");
const schema_1 = require("./schema");
let _pool = null;
function getPool() {
    if (_pool)
        return _pool;
    _pool = new pg_1.Pool({
        connectionString: config_1.config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
    return _pool;
}
/** Run schema migrations and ensure protocol row */
async function initDb() {
    const pool = getPool();
    await pool.query(schema_1.MIGRATIONS);
    await pool.query(`INSERT INTO protocol (id, total_markets, total_volume_usid, total_fees_usid, total_swaps, total_users, created_at, updated_at)
     VALUES ('1', 0, '0', '0', 0, 0, 0, 0)
     ON CONFLICT (id) DO NOTHING`);
}
async function closeDb() {
    if (_pool) {
        await _pool.end();
        _pool = null;
    }
}
/** Get a client from the pool for transaction batching */
async function getClient() {
    return getPool().connect();
}
/** Get the last indexed block from _meta */
async function getLastIndexedBlock() {
    const pool = getPool();
    const res = await pool.query("SELECT value FROM _meta WHERE key = 'last_block'");
    if (res.rows.length > 0)
        return parseInt(res.rows[0].value, 10);
    return config_1.config.startBlock - 1;
}
/** Save checkpoint */
async function setLastIndexedBlock(block) {
    const pool = getPool();
    await pool.query(`INSERT INTO _meta (key, value) VALUES ('last_block', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`, [block.toString()]);
}
//# sourceMappingURL=index.js.map