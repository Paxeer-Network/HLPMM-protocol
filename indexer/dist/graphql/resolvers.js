"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const db_1 = require("../db");
// ─── Helpers ─────────────────────────────────────────────────
const ORDER_MAP = {
    // Market
    id: "id", createdAt: "created_at", createdAtBlock: "created_at_block",
    updatedAt: "updated_at",
    volumeUSID: "volume_usid::numeric", volumeToken: "volume_token::numeric",
    feesUSID: "fees_usid::numeric",
    spotPrice: "spot_price::numeric", marketCap: "market_cap::numeric",
    swapCount: "swap_count", holderCount: "holder_count",
    reserveUSID: "reserve_usid::numeric", reserveToken: "reserve_token::numeric",
    volumeUSID24h: "volume_usid_24h::numeric", priceChange24h: "price_change_24h::numeric",
    lastSwapAt: "last_swap_at",
    name: "name", symbol: "symbol",
    // Swap
    timestamp: "\"timestamp\"", amountInUSID: "amount_in_usid::numeric",
    amountIn: "amount_in::numeric", amountOut: "amount_out::numeric",
    blockNumber: "block_number", logIndex: "log_index",
    // MarketHourData
    hourStartUnix: "hour_start_unix",
    // MarketDayData
    dayStartUnix: "day_start_unix",
    // Market5MinData
    periodStart: "period_start",
    // User
    totalSwaps: "total_swaps", totalVolumeUSID: "total_volume_usid::numeric",
    firstSeenAt: "first_seen_at", lastSeenAt: "last_seen_at",
    marketsCreated: "markets_created",
    // UserTokenBalance
    balance: "balance::numeric",
};
function orderCol(orderBy) {
    if (!orderBy)
        return "id";
    return ORDER_MAP[orderBy] || "id";
}
function orderDir(dir) {
    return dir === "desc" ? "DESC" : "ASC";
}
function pagination(first, skip) {
    const limit = Math.min(first ?? 100, 1000);
    const offset = skip ?? 0;
    return `LIMIT ${limit} OFFSET ${offset}`;
}
// ─── Generic The Graph-style filter builder ──────────────────
// Maps filter field names like "updatedAt_gte" to SQL conditions
const FILTER_COL_MAP = {
    id: "id",
    pool: "pool",
    creator: "creator_id",
    name: "name",
    symbol: "symbol",
    spotPrice: "spot_price::numeric",
    marketCap: "market_cap::numeric",
    volumeUSID: "volume_usid::numeric",
    swapCount: "swap_count",
    holderCount: "holder_count",
    createdAt: "created_at",
    updatedAt: "updated_at",
    createdAtBlock: "created_at_block",
    // Swap
    market: "market_id",
    user: "user_id",
    timestamp: "\"timestamp\"",
    blockNumber: "block_number",
    logIndex: "log_index",
    side: "side",
    // OHLC
    hourStartUnix: "hour_start_unix",
    dayStartUnix: "day_start_unix",
    periodStart: "period_start",
    // UserTokenBalance
    token: "token_id",
    balance: "balance::numeric",
};
function buildWhereClause(where, params) {
    if (!where)
        return "";
    const conditions = [];
    for (const [key, value] of Object.entries(where)) {
        if (value === null || value === undefined)
            continue;
        // Handle _in arrays
        if (key.endsWith("_in")) {
            const baseField = key.slice(0, -3);
            const col = FILTER_COL_MAP[baseField];
            if (!col)
                continue;
            const arr = value;
            if (arr.length === 0)
                continue;
            const placeholders = arr.map((v) => { params.push(typeof v === "string" ? v.toLowerCase() : v); return `$${params.length}`; }).join(",");
            conditions.push(`${col} IN (${placeholders})`);
            continue;
        }
        // Handle _contains / _contains_nocase
        if (key.endsWith("_contains_nocase")) {
            const baseField = key.slice(0, -16);
            const col = FILTER_COL_MAP[baseField];
            if (!col)
                continue;
            params.push(`%${value}%`);
            conditions.push(`${col} ILIKE $${params.length}`);
            continue;
        }
        if (key.endsWith("_contains")) {
            const baseField = key.slice(0, -9);
            const col = FILTER_COL_MAP[baseField];
            if (!col)
                continue;
            params.push(`%${value}%`);
            conditions.push(`${col} ILIKE $${params.length}`);
            continue;
        }
        // Handle comparison suffixes
        let op = "=";
        let baseField = key;
        if (key.endsWith("_gte")) {
            op = ">=";
            baseField = key.slice(0, -4);
        }
        else if (key.endsWith("_lte")) {
            op = "<=";
            baseField = key.slice(0, -4);
        }
        else if (key.endsWith("_gt")) {
            op = ">";
            baseField = key.slice(0, -3);
        }
        else if (key.endsWith("_lt")) {
            op = "<";
            baseField = key.slice(0, -3);
        }
        const col = FILTER_COL_MAP[baseField];
        if (!col)
            continue;
        const v = typeof value === "string" && (baseField === "creator" || baseField === "market" || baseField === "user" || baseField === "token" || baseField === "pool" || baseField === "id")
            ? value.toLowerCase()
            : value;
        params.push(v);
        conditions.push(`${col} ${op} $${params.length}`);
    }
    return conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
}
// ─── Row mappers ─────────────────────────────────────────────
function mapProtocol(r) {
    if (!r)
        return null;
    return {
        id: r.id, totalMarkets: r.total_markets, totalVolumeUSID: r.total_volume_usid,
        totalFeesUSID: r.total_fees_usid, totalSwaps: r.total_swaps, totalUsers: r.total_users,
        createdAt: r.created_at, updatedAt: r.updated_at,
    };
}
function mapMarket(r) {
    if (!r)
        return null;
    return {
        id: r.id, pool: r.pool, _tokenId: r.token_id, _nftId: r.nft_id, _creatorId: r.creator_id,
        name: r.name, symbol: r.symbol,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token,
        spotPrice: r.spot_price, marketCap: r.market_cap,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        swapCount: r.swap_count, holderCount: r.holder_count,
        createdAt: r.created_at, createdAtBlock: r.created_at_block, updatedAt: r.updated_at,
        priceChange1h: r.price_change_1h, priceChange24h: r.price_change_24h, priceChange7d: r.price_change_7d,
        volumeUSID1h: r.volume_usid_1h, volumeUSID24h: r.volume_usid_24h, volumeUSID7d: r.volume_usid_7d,
        ath: r.ath, athTimestamp: r.ath_timestamp, atl: r.atl, atlTimestamp: r.atl_timestamp,
        lastSwapAt: r.last_swap_at, liquidityUSID: r.liquidity_usid,
    };
}
function mapToken(r) {
    if (!r)
        return null;
    return {
        id: r.id, address: r.address, name: r.name, symbol: r.symbol, decimals: r.decimals,
        totalSupply: r.total_supply, _marketId: r.market_id,
        holderCount: r.holder_count, transferCount: r.transfer_count, createdAt: r.created_at,
    };
}
function mapMarketNFT(r) {
    if (!r)
        return null;
    return {
        id: r.id, tokenId: r.token_id_num, _ownerId: r.owner_id, _marketId: r.market_id,
        pool: r.pool, feeStrategy: r.fee_strategy,
        totalFeesClaimed: r.total_fees_claimed, pendingFees: r.pending_fees,
        mintedAt: r.minted_at, updatedAt: r.updated_at,
        lifetimeRevenue: r.lifetime_revenue, strategyChanges: r.strategy_changes,
    };
}
function mapUser(r) {
    if (!r)
        return null;
    return {
        id: r.id, address: r.address, totalSwaps: r.total_swaps,
        totalVolumeUSID: r.total_volume_usid, marketsCreated: r.markets_created,
        firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at,
        pnlUSID: r.pnl_usid, uniqueMarkets: r.unique_markets,
    };
}
function mapSwap(r) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id, _userId: r.user_id,
        txHash: r.tx_hash, blockNumber: r.block_number, timestamp: r.timestamp,
        logIndex: r.log_index, tokenIn: r.token_in, tokenOut: r.token_out,
        amountIn: r.amount_in, amountOut: r.amount_out, amountInUSID: r.amount_in_usid,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token, spotPrice: r.spot_price,
        feeAmount: r.fee_amount, feeUSID: r.fee_usid,
        priceImpact: r.price_impact, side: r.side,
    };
}
function mapFeeClaim(r) {
    if (!r)
        return null;
    return {
        id: r.id, _nftId: r.nft_id, _recipientId: r.recipient_id,
        amount: r.amount, txHash: r.tx_hash, blockNumber: r.block_number, timestamp: r.timestamp,
    };
}
function mapNFTTransfer(r) {
    if (!r)
        return null;
    return {
        id: r.id, _nftId: r.nft_id, _fromId: r.from_id, _toId: r.to_id,
        txHash: r.tx_hash, blockNumber: r.block_number, timestamp: r.timestamp,
    };
}
function mapFeeStrategyChange(r) {
    if (!r)
        return null;
    return {
        id: r.id, _nftId: r.nft_id, oldStrategy: r.old_strategy, newStrategy: r.new_strategy,
        txHash: r.tx_hash, blockNumber: r.block_number, timestamp: r.timestamp,
    };
}
function mapOHLC(r, timeField) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id,
        [timeField]: r[timeField.replace(/([A-Z])/g, '_$1').toLowerCase()] ?? r[Object.keys(r).find(k => k.includes("start") || k.includes("period"))],
        open: r.open, high: r.high, low: r.low, close: r.close,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token, swapCount: r.swap_count,
    };
}
function mapMarketHourData(r) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id, hourStartUnix: r.hour_start_unix,
        open: r.open, high: r.high, low: r.low, close: r.close,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token, swapCount: r.swap_count,
    };
}
function mapMarketDayData(r) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id, dayStartUnix: r.day_start_unix,
        open: r.open, high: r.high, low: r.low, close: r.close,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token, swapCount: r.swap_count,
    };
}
function mapMarket5MinData(r) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id, periodStart: r.period_start,
        open: r.open, high: r.high, low: r.low, close: r.close,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        reserveUSID: r.reserve_usid, reserveToken: r.reserve_token, swapCount: r.swap_count,
    };
}
function mapProtocolDayData(r) {
    if (!r)
        return null;
    return {
        id: r.id, dayStartUnix: r.day_start_unix, volumeUSID: r.volume_usid,
        feesUSID: r.fees_usid, swapCount: r.swap_count, newMarkets: r.new_markets,
        activeUsers: r.active_users, totalMarkets: r.total_markets, totalVolumeUSID: r.total_volume_usid,
    };
}
function mapUserTokenBalance(r) {
    if (!r)
        return null;
    return {
        id: r.id, _userId: r.user_id, _tokenId: r.token_id,
        balance: r.balance, updatedAt: r.updated_at,
    };
}
function mapCandle(r) {
    if (!r)
        return null;
    return {
        id: r.id, _marketId: r.market_id, timeframe: r.timeframe,
        periodStart: r.period_start, open: r.open, high: r.high, low: r.low, close: r.close,
        volumeUSID: r.volume_usid, volumeToken: r.volume_token, feesUSID: r.fees_usid,
        tradeCount: r.trade_count,
    };
}
function mapTrending(r) {
    if (!r)
        return null;
    return {
        _marketId: r.market_id,
        score: r.score, rank: r.rank,
        volumeVelocity: r.volume_velocity, priceMomentum: r.price_momentum,
        tradeIntensity: r.trade_intensity, holderGrowth: r.holder_growth,
        uniqueTraders1h: r.unique_traders_1h, freshness: r.freshness,
        category: r.category, updatedAt: r.updated_at,
    };
}
// ─── Resolvers ───────────────────────────────────────────────
exports.resolvers = {
    Query: {
        protocol: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM protocol WHERE id = $1", [id]);
            return mapProtocol(res.rows[0]);
        },
        protocols: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM protocol ${pagination(first, skip)}`);
            return res.rows.map(mapProtocol);
        },
        market: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [id]);
            return mapMarket(res.rows[0]);
        },
        markets: async (_, { first, skip, orderBy, orderDirection, where }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM market${whereClause} ORDER BY ${orderCol(orderBy)} ${orderDir(orderDirection)} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapMarket);
        },
        token: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM token WHERE id = $1", [id]);
            return mapToken(res.rows[0]);
        },
        tokens: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM token ORDER BY created_at DESC ${pagination(first, skip)}`);
            return res.rows.map(mapToken);
        },
        marketNFT: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market_nft WHERE id = $1", [id]);
            return mapMarketNFT(res.rows[0]);
        },
        marketNFTs: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market_nft ORDER BY minted_at DESC ${pagination(first, skip)}`);
            return res.rows.map(mapMarketNFT);
        },
        user: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [id.toLowerCase()]);
            return mapUser(res.rows[0]);
        },
        users: async (_, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM "user" ORDER BY ${orderCol(orderBy)} ${orderDir(orderDirection)} ${pagination(first, skip)}`);
            return res.rows.map(mapUser);
        },
        swap: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM swap WHERE id = $1", [id]);
            return mapSwap(res.rows[0]);
        },
        swaps: async (_, { first, skip, orderBy, orderDirection, where }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM swap${whereClause} ORDER BY ${orderCol(orderBy || "timestamp")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapSwap);
        },
        feeClaim: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM fee_claim WHERE id = $1", [id]);
            return mapFeeClaim(res.rows[0]);
        },
        feeClaims: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM fee_claim ORDER BY "timestamp" DESC ${pagination(first, skip)}`);
            return res.rows.map(mapFeeClaim);
        },
        nftTransfer: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM nft_transfer WHERE id = $1", [id]);
            return mapNFTTransfer(res.rows[0]);
        },
        nftTransfers: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM nft_transfer ORDER BY "timestamp" DESC ${pagination(first, skip)}`);
            return res.rows.map(mapNFTTransfer);
        },
        feeStrategyChange: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM fee_strategy_change WHERE id = $1", [id]);
            return mapFeeStrategyChange(res.rows[0]);
        },
        feeStrategyChanges: async (_, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM fee_strategy_change ORDER BY "timestamp" DESC ${pagination(first, skip)}`);
            return res.rows.map(mapFeeStrategyChange);
        },
        marketHourDatas: async (_, { first, skip, where, orderBy, orderDirection }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM market_hour_data${whereClause} ORDER BY ${orderCol(orderBy || "hourStartUnix")} ${orderDir(orderDirection || "asc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapMarketHourData);
        },
        marketDayDatas: async (_, { first, skip, where, orderBy, orderDirection }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM market_day_data${whereClause} ORDER BY ${orderCol(orderBy || "dayStartUnix")} ${orderDir(orderDirection || "asc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapMarketDayData);
        },
        market5MinDatas: async (_, { first, skip, where, orderBy, orderDirection }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM market_5min_data${whereClause} ORDER BY ${orderCol(orderBy || "periodStart")} ${orderDir(orderDirection || "asc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapMarket5MinData);
        },
        protocolDayDatas: async (_, { first, skip, orderBy, orderDirection }) => {
            const sql = `SELECT * FROM protocol_day_data ORDER BY ${orderCol(orderBy || "dayStartUnix")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql);
            return res.rows.map(mapProtocolDayData);
        },
        userTokenBalance: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM user_token_balance WHERE id = $1", [id]);
            return mapUserTokenBalance(res.rows[0]);
        },
        userTokenBalances: async (_, { first, skip, where, orderBy, orderDirection }) => {
            const params = [];
            const whereClause = buildWhereClause(where, params);
            const sql = `SELECT * FROM user_token_balance${whereClause} ORDER BY ${orderCol(orderBy || "updatedAt")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapUserTokenBalance);
        },
        transaction: async (_, { id }) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "transaction" WHERE id = $1', [id]);
            const r = res.rows[0];
            if (!r)
                return null;
            return { id: r.id, blockNumber: r.block_number, timestamp: r.timestamp, gasUsed: r.gas_used, gasPrice: r.gas_price };
        },
        candles: async (_, { market, timeframe, first, skip, orderBy, orderDirection, where }) => {
            const params = [market.toLowerCase(), timeframe];
            let conditions = "market_id = $1 AND timeframe = $2";
            if (where) {
                if (where.periodStart_gt != null) {
                    params.push(where.periodStart_gt);
                    conditions += ` AND period_start > $${params.length}`;
                }
                if (where.periodStart_lt != null) {
                    params.push(where.periodStart_lt);
                    conditions += ` AND period_start < $${params.length}`;
                }
                if (where.periodStart_gte != null) {
                    params.push(where.periodStart_gte);
                    conditions += ` AND period_start >= $${params.length}`;
                }
                if (where.periodStart_lte != null) {
                    params.push(where.periodStart_lte);
                    conditions += ` AND period_start <= $${params.length}`;
                }
            }
            const col = orderBy === "periodStart" ? "period_start" : (orderBy === "tradeCount" ? "trade_count" : "period_start");
            const dir = orderDirection === "desc" ? "DESC" : "ASC";
            const sql = `SELECT * FROM candle WHERE ${conditions} ORDER BY ${col} ${dir} ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapCandle);
        },
        trending: async (_, { first, skip, category }) => {
            const params = [];
            let where = "";
            if (category) {
                params.push(category);
                where = ` WHERE category = $${params.length}`;
            }
            const sql = `SELECT * FROM trending_score${where} ORDER BY score DESC ${pagination(first, skip)}`;
            const res = await (0, db_1.getPool)().query(sql, params);
            return res.rows.map(mapTrending);
        },
        searchMarkets: async (_, { query, first }) => {
            const limit = Math.min(first ?? 20, 100);
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE name ILIKE $1 OR symbol ILIKE $1 ORDER BY volume_usid::numeric DESC LIMIT $2", [`%${query}%`, limit]);
            return res.rows.map(mapMarket);
        },
        _meta: async () => {
            const lastBlock = await (0, db_1.getLastIndexedBlock)();
            return { lastIndexedBlock: lastBlock, hasIndexingErrors: false };
        },
    },
    // ─── Nested resolvers ───────────────────────────────────────
    Market: {
        token: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM token WHERE id = $1", [parent._tokenId]);
            return mapToken(res.rows[0]);
        },
        nft: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market_nft WHERE id = $1", [parent._nftId]);
            return mapMarketNFT(res.rows[0]);
        },
        creator: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._creatorId]);
            return mapUser(res.rows[0]);
        },
        swaps: async (parent, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM swap WHERE market_id = $1 ORDER BY ${orderCol(orderBy || "timestamp")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapSwap);
        },
        hourData: async (parent, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market_hour_data WHERE market_id = $1 ORDER BY ${orderCol(orderBy || "hourStartUnix")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapMarketHourData);
        },
        dayData: async (parent, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market_day_data WHERE market_id = $1 ORDER BY ${orderCol(orderBy || "dayStartUnix")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapMarketDayData);
        },
        fiveMinData: async (parent, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market_5min_data WHERE market_id = $1 ORDER BY ${orderCol(orderBy || "periodStart")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapMarket5MinData);
        },
    },
    Token: {
        market: async (parent) => {
            if (!parent._marketId)
                return null;
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
    MarketNFT: {
        owner: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._ownerId]);
            return mapUser(res.rows[0]);
        },
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
        claims: async (parent, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM fee_claim WHERE nft_id = $1 ORDER BY "timestamp" DESC ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapFeeClaim);
        },
        transfers: async (parent, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM nft_transfer WHERE nft_id = $1 ORDER BY "timestamp" DESC ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapNFTTransfer);
        },
    },
    User: {
        swaps: async (parent, { first, skip, orderBy, orderDirection }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM swap WHERE user_id = $1 ORDER BY ${orderCol(orderBy || "timestamp")} ${orderDir(orderDirection || "desc")} ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapSwap);
        },
        ownedNFTs: async (parent, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market_nft WHERE owner_id = $1 ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapMarketNFT);
        },
        createdMarkets: async (parent, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM market WHERE creator_id = $1 ORDER BY created_at DESC ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapMarket);
        },
        tokenBalances: async (parent, { first, skip }) => {
            const res = await (0, db_1.getPool)().query(`SELECT * FROM user_token_balance WHERE user_id = $1 ${pagination(first, skip)}`, [parent.id]);
            return res.rows.map(mapUserTokenBalance);
        },
    },
    Swap: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
        user: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._userId]);
            return mapUser(res.rows[0]);
        },
    },
    FeeClaim: {
        nft: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market_nft WHERE id = $1", [parent._nftId]);
            return mapMarketNFT(res.rows[0]);
        },
        recipient: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._recipientId]);
            return mapUser(res.rows[0]);
        },
    },
    NFTTransfer: {
        nft: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market_nft WHERE id = $1", [parent._nftId]);
            return mapMarketNFT(res.rows[0]);
        },
        from: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._fromId]);
            return mapUser(res.rows[0]);
        },
        to: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._toId]);
            return mapUser(res.rows[0]);
        },
    },
    FeeStrategyChange: {
        nft: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market_nft WHERE id = $1", [parent._nftId]);
            return mapMarketNFT(res.rows[0]);
        },
    },
    MarketHourData: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
    MarketDayData: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
    Market5MinData: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
    UserTokenBalance: {
        user: async (parent) => {
            const res = await (0, db_1.getPool)().query('SELECT * FROM "user" WHERE id = $1', [parent._userId]);
            return mapUser(res.rows[0]);
        },
        token: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM token WHERE id = $1", [parent._tokenId]);
            return mapToken(res.rows[0]);
        },
    },
    Candle: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
    TrendingMarket: {
        market: async (parent) => {
            const res = await (0, db_1.getPool)().query("SELECT * FROM market WHERE id = $1", [parent._marketId]);
            return mapMarket(res.rows[0]);
        },
    },
};
//# sourceMappingURL=resolvers.js.map