"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSync = handleSync;
const db_1 = require("../db");
const helpers_1 = require("./helpers");
async function handleSync(log, blockNumber, timestamp, txHash, logIndex, poolAddress) {
    const db = (0, db_1.getPool)();
    const addr = poolAddress.toLowerCase();
    const reserveUSID = (0, helpers_1.toDecimal)(log.args.reserve0.toString(), 18);
    const reserveToken = (0, helpers_1.toDecimal)(log.args.reserve1.toString(), 18);
    const mRes = await db.query("SELECT * FROM market WHERE id = $1", [addr]);
    if (mRes.rows.length === 0)
        return;
    const market = mRes.rows[0];
    let spotPrice = market.spot_price;
    if (!(0, helpers_1.isZeroDec)(reserveToken)) {
        spotPrice = (0, helpers_1.divDec)(reserveUSID, reserveToken);
    }
    // Calculate marketCap
    const tokenRes = await db.query("SELECT total_supply FROM token WHERE id = $1", [market.token_id]);
    const marketCap = tokenRes.rows.length > 0 ? (0, helpers_1.mulDec)(spotPrice, tokenRes.rows[0].total_supply) : "0";
    await db.query(`UPDATE market SET reserve_usid=$1, reserve_token=$2, spot_price=$3, market_cap=$4, updated_at=$5 WHERE id=$6`, [reserveUSID, reserveToken, spotPrice, marketCap, timestamp, addr]);
}
//# sourceMappingURL=pool.js.map