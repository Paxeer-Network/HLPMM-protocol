"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO_ADDRESS = exports.USID_ADDRESS = exports.ZERO = void 0;
exports.toDecimal = toDecimal;
exports.addDec = addDec;
exports.subDec = subDec;
exports.mulDec = mulDec;
exports.divDec = divDec;
exports.cmpDec = cmpDec;
exports.maxDec = maxDec;
exports.minDec = minDec;
exports.isZeroDec = isZeroDec;
exports.feeStrategyFromInt = feeStrategyFromInt;
exports.getOrCreateProtocol = getOrCreateProtocol;
exports.getOrCreateUser = getOrCreateUser;
exports.updateMarketHourData = updateMarketHourData;
exports.updateMarketDayData = updateMarketDayData;
exports.updateMarket5MinData = updateMarket5MinData;
exports.updateProtocolDayData = updateProtocolDayData;
exports.refreshMarketEnrichedFields = refreshMarketEnrichedFields;
const db_1 = require("../db");
const config_1 = require("../config");
exports.ZERO = "0";
exports.USID_ADDRESS = config_1.config.contracts.usid.toLowerCase();
exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// ─── Decimal math using native BigInt + string formatting ────
// We avoid bignumber.js entirely: store as raw string decimals, do math with
// a simple fixed-point approach (18 decimal places, backed by BigInt).
const DECIMALS = 18;
const SCALE = 10n ** BigInt(DECIMALS);
function toBI(dec) {
    // Parse a decimal string like "123.456" into a scaled bigint
    if (!dec || dec === "0")
        return 0n;
    const neg = dec.startsWith("-");
    const abs = neg ? dec.slice(1) : dec;
    const [intPart, fracPart = ""] = abs.split(".");
    const padded = (fracPart + "0".repeat(DECIMALS)).slice(0, DECIMALS);
    const raw = BigInt(intPart + padded);
    return neg ? -raw : raw;
}
function fromBI(bi) {
    const neg = bi < 0n;
    let abs = neg ? -bi : bi;
    const intPart = abs / SCALE;
    const fracPart = abs % SCALE;
    const fracStr = fracPart.toString().padStart(DECIMALS, "0");
    const result = `${intPart}.${fracStr}`;
    return neg ? `-${result}` : result;
}
/** Convert raw wei string to decimal string (18 decimals) */
function toDecimal(raw, decimals = 18) {
    const val = BigInt(raw.toString());
    if (decimals === 0)
        return val.toString() + "." + "0".repeat(DECIMALS);
    const divisorExp = BigInt(decimals);
    // Scale to our 18-decimal representation
    const scaled = (val * SCALE) / (10n ** divisorExp);
    return fromBI(scaled);
}
function addDec(a, b) { return fromBI(toBI(a) + toBI(b)); }
function subDec(a, b) { return fromBI(toBI(a) - toBI(b)); }
function mulDec(a, b) { return fromBI((toBI(a) * toBI(b)) / SCALE); }
function divDec(a, b) {
    const divisor = toBI(b);
    if (divisor === 0n)
        return exports.ZERO;
    return fromBI((toBI(a) * SCALE) / divisor);
}
function cmpDec(a, b) {
    const diff = toBI(a) - toBI(b);
    return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}
function maxDec(a, b) { return cmpDec(a, b) >= 0 ? a : b; }
function minDec(a, b) { return cmpDec(a, b) <= 0 ? a : b; }
function isZeroDec(a) { return toBI(a) === 0n; }
/** Map fee strategy integer to enum string */
function feeStrategyFromInt(s) {
    switch (s) {
        case 0: return "CLAIM";
        case 1: return "BURN";
        case 2: return "AIRDROP";
        case 3: return "LP_REWARDS";
        default: return "CLAIM";
    }
}
// ─── Entity helpers (async, pg) ──────────────────────────────
async function getOrCreateProtocol(client) {
    const q = client ?? (0, db_1.getPool)();
    const res = await q.query("SELECT * FROM protocol WHERE id = '1'");
    if (res.rows.length > 0)
        return res.rows[0];
    await q.query(`INSERT INTO protocol (id, total_markets, total_volume_usid, total_fees_usid, total_swaps, total_users, created_at, updated_at)
     VALUES ('1', 0, '0', '0', 0, 0, 0, 0) ON CONFLICT (id) DO NOTHING`);
    const r2 = await q.query("SELECT * FROM protocol WHERE id = '1'");
    return r2.rows[0];
}
async function getOrCreateUser(address, timestamp, client) {
    const q = client ?? (0, db_1.getPool)();
    const addr = address.toLowerCase();
    const res = await q.query('SELECT * FROM "user" WHERE id = $1', [addr]);
    if (res.rows.length > 0)
        return res.rows[0];
    await q.query(`INSERT INTO "user" (id, address, total_swaps, total_volume_usid, markets_created, first_seen_at, last_seen_at, pnl_usid, unique_markets)
     VALUES ($1, $2, 0, '0', 0, $3, $4, '0', 0) ON CONFLICT (id) DO NOTHING`, [addr, addr, timestamp, timestamp]);
    // Increment protocol user count
    await q.query("UPDATE protocol SET total_users = total_users + 1 WHERE id = '1'");
    const r2 = await q.query('SELECT * FROM "user" WHERE id = $1', [addr]);
    return r2.rows[0];
}
// ─── Time-series helpers (async) ─────────────────────────────
async function upsertOHLC(table, idCol, timeCol, id, marketId, periodStart, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, prevId, client) {
    const q = client ?? (0, db_1.getPool)();
    const res = await q.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (res.rows.length === 0) {
        // Try previous candle for gap-free OHLC
        const prevRes = await q.query(`SELECT "close" FROM ${table} WHERE id = $1`, [prevId]);
        const openPrice = prevRes.rows.length > 0 ? prevRes.rows[0].close : price;
        const high = cmpDec(openPrice, price) > 0 ? openPrice : price;
        const low = cmpDec(openPrice, price) < 0 ? openPrice : price;
        await q.query(`INSERT INTO ${table} (id, market_id, ${timeCol}, "open", high, low, "close", volume_usid, volume_token, fees_usid, reserve_usid, reserve_token, swap_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1) ON CONFLICT (id) DO NOTHING`, [id, marketId, periodStart, openPrice, high, low, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken]);
        return;
    }
    const row = res.rows[0];
    const newHigh = maxDec(row.high, price);
    const newLow = minDec(row.low, price);
    await q.query(`UPDATE ${table} SET high = $1, low = $2, "close" = $3,
     volume_usid = $4, volume_token = $5, fees_usid = $6,
     reserve_usid = $7, reserve_token = $8, swap_count = swap_count + 1
     WHERE id = $9`, [
        newHigh, newLow, price,
        addDec(row.volume_usid, volumeUSID),
        addDec(row.volume_token, volumeToken),
        addDec(row.fees_usid, feesUSID),
        reserveUSID, reserveToken,
        id
    ]);
}
async function updateMarketHourData(marketId, timestamp, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, client) {
    const hourIndex = Math.floor(timestamp / 3600);
    const hourId = `${marketId}-${hourIndex}`;
    const prevId = `${marketId}-${hourIndex - 1}`;
    await upsertOHLC("market_hour_data", "id", "hour_start_unix", hourId, marketId, hourIndex * 3600, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, prevId, client);
}
async function updateMarketDayData(marketId, timestamp, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, client) {
    const dayIndex = Math.floor(timestamp / 86400);
    const dayId = `${marketId}-${dayIndex}`;
    const prevId = `${marketId}-${dayIndex - 1}`;
    await upsertOHLC("market_day_data", "id", "day_start_unix", dayId, marketId, dayIndex * 86400, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, prevId, client);
}
async function updateMarket5MinData(marketId, timestamp, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, client) {
    const periodIndex = Math.floor(timestamp / 300);
    const periodId = `${marketId}-${periodIndex}`;
    const prevId = `${marketId}-${periodIndex - 1}`;
    await upsertOHLC("market_5min_data", "id", "period_start", periodId, marketId, periodIndex * 300, price, volumeUSID, volumeToken, feesUSID, reserveUSID, reserveToken, prevId, client);
}
async function updateProtocolDayData(timestamp, volumeUSID, feesUSID, swapCount, newMarkets, client) {
    const q = client ?? (0, db_1.getPool)();
    const dayIndex = Math.floor(timestamp / 86400);
    const dayStartUnix = dayIndex * 86400;
    const dayId = dayIndex.toString();
    const protocol = await getOrCreateProtocol(q);
    const res = await q.query("SELECT * FROM protocol_day_data WHERE id = $1", [dayId]);
    if (res.rows.length === 0) {
        await q.query(`INSERT INTO protocol_day_data (id, day_start_unix, volume_usid, fees_usid, swap_count, new_markets, active_users, total_markets, total_volume_usid)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8) ON CONFLICT (id) DO UPDATE SET
       volume_usid = protocol_day_data.volume_usid::numeric + $3::numeric,
       fees_usid = protocol_day_data.fees_usid::numeric + $4::numeric,
       swap_count = protocol_day_data.swap_count + $5,
       new_markets = protocol_day_data.new_markets + $6,
       total_markets = $7, total_volume_usid = $8`, [dayId, dayStartUnix, volumeUSID, feesUSID, swapCount, newMarkets, protocol.total_markets, protocol.total_volume_usid]);
        return;
    }
    const row = res.rows[0];
    await q.query(`UPDATE protocol_day_data SET
     volume_usid = $1, fees_usid = $2,
     swap_count = swap_count + $3, new_markets = new_markets + $4,
     total_markets = $5, total_volume_usid = $6
     WHERE id = $7`, [
        addDec(row.volume_usid, volumeUSID),
        addDec(row.fees_usid, feesUSID),
        swapCount, newMarkets,
        protocol.total_markets, protocol.total_volume_usid,
        dayId
    ]);
}
/** Update enriched rolling window fields on market */
async function refreshMarketEnrichedFields(marketId, timestamp, client) {
    const q = client ?? (0, db_1.getPool)();
    const mRes = await q.query("SELECT * FROM market WHERE id = $1", [marketId]);
    if (mRes.rows.length === 0)
        return;
    const market = mRes.rows[0];
    const now = timestamp;
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;
    const sevenDaysAgo = now - 604800;
    // Volume windows
    const vol1h = (await q.query(`SELECT COALESCE(SUM(amount_in_usid::numeric), 0) as v FROM swap WHERE market_id = $1 AND "timestamp" > $2`, [marketId, oneHourAgo])).rows[0];
    const vol24h = (await q.query(`SELECT COALESCE(SUM(amount_in_usid::numeric), 0) as v FROM swap WHERE market_id = $1 AND "timestamp" > $2`, [marketId, oneDayAgo])).rows[0];
    const vol7d = (await q.query(`SELECT COALESCE(SUM(amount_in_usid::numeric), 0) as v FROM swap WHERE market_id = $1 AND "timestamp" > $2`, [marketId, sevenDaysAgo])).rows[0];
    // Price at past points
    const price1hAgo = (await q.query(`SELECT spot_price FROM swap WHERE market_id = $1 AND "timestamp" <= $2 ORDER BY "timestamp" DESC LIMIT 1`, [marketId, oneHourAgo])).rows[0];
    const price24hAgo = (await q.query(`SELECT spot_price FROM swap WHERE market_id = $1 AND "timestamp" <= $2 ORDER BY "timestamp" DESC LIMIT 1`, [marketId, oneDayAgo])).rows[0];
    const price7dAgo = (await q.query(`SELECT spot_price FROM swap WHERE market_id = $1 AND "timestamp" <= $2 ORDER BY "timestamp" DESC LIMIT 1`, [marketId, sevenDaysAgo])).rows[0];
    const currentPrice = market.spot_price;
    const pctChange = (cur, old) => {
        if (!old || isZeroDec(old))
            return exports.ZERO;
        return mulDec(divDec(subDec(cur, old), old), "100");
    };
    // ATH / ATL
    const athRow = (await q.query(`SELECT spot_price as p, "timestamp" FROM swap WHERE market_id = $1 ORDER BY spot_price::numeric DESC LIMIT 1`, [marketId])).rows[0];
    const atlRow = (await q.query(`SELECT spot_price as p, "timestamp" FROM swap WHERE market_id = $1 AND spot_price::numeric > 0 ORDER BY spot_price::numeric ASC LIMIT 1`, [marketId])).rows[0];
    await q.query(`UPDATE market SET
     price_change_1h = $1, price_change_24h = $2, price_change_7d = $3,
     volume_usid_1h = $4, volume_usid_24h = $5, volume_usid_7d = $6,
     ath = $7, ath_timestamp = $8,
     atl = $9, atl_timestamp = $10,
     last_swap_at = $11,
     liquidity_usid = $12
     WHERE id = $13`, [
        pctChange(currentPrice, price1hAgo?.spot_price),
        pctChange(currentPrice, price24hAgo?.spot_price),
        pctChange(currentPrice, price7dAgo?.spot_price),
        (vol1h?.v ?? 0).toString(),
        (vol24h?.v ?? 0).toString(),
        (vol7d?.v ?? 0).toString(),
        athRow?.p?.toString() ?? currentPrice,
        athRow?.timestamp ?? timestamp,
        atlRow?.p?.toString() ?? currentPrice,
        atlRow?.timestamp ?? timestamp,
        timestamp,
        market.reserve_usid,
        marketId
    ]);
}
//# sourceMappingURL=helpers.js.map