"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUSIDTransfer = handleUSIDTransfer;
const db_1 = require("../db");
const helpers_1 = require("./helpers");
async function handleUSIDTransfer(log, blockNumber, timestamp, txHash, logIndex) {
    const db = (0, db_1.getPool)();
    const tokenId = helpers_1.USID_ADDRESS;
    // Create USID token entity if not exists
    const tokenRes = await db.query("SELECT * FROM token WHERE id = $1", [tokenId]);
    if (tokenRes.rows.length === 0) {
        await db.query(`INSERT INTO token (id, address, name, symbol, decimals, total_supply, holder_count, transfer_count, created_at)
       VALUES ($1, $2, 'USID', 'USID', 18, '0', 0, 0, $3) ON CONFLICT (id) DO NOTHING`, [tokenId, tokenId, timestamp]);
    }
    const amount = (0, helpers_1.toDecimal)(log.args.value.toString(), 18);
    const fromAddress = log.args.from.toLowerCase();
    const toAddress = log.args.to.toLowerCase();
    // Update transfer count
    await db.query("UPDATE token SET transfer_count = transfer_count + 1 WHERE id = $1", [tokenId]);
    // Handle mint (from zero address)
    if (fromAddress === helpers_1.ZERO_ADDRESS) {
        const cur = (await db.query("SELECT total_supply FROM token WHERE id = $1", [tokenId])).rows[0];
        await db.query("UPDATE token SET total_supply = $1 WHERE id = $2", [(0, helpers_1.addDec)(cur?.total_supply ?? "0", amount), tokenId]);
    }
    // Handle burn (to zero address)
    if (toAddress === helpers_1.ZERO_ADDRESS) {
        const cur = (await db.query("SELECT total_supply FROM token WHERE id = $1", [tokenId])).rows[0];
        await db.query("UPDATE token SET total_supply = $1 WHERE id = $2", [(0, helpers_1.subDec)(cur?.total_supply ?? "0", amount), tokenId]);
    }
    // Handle sender balance
    if (fromAddress !== helpers_1.ZERO_ADDRESS) {
        await (0, helpers_1.getOrCreateUser)(fromAddress, timestamp, db);
        const fromBalanceId = `${fromAddress}-${tokenId}`;
        const fbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [fromBalanceId]);
        if (fbRes.rows.length > 0) {
            const newBalance = (0, helpers_1.subDec)(fbRes.rows[0].balance, amount);
            await db.query("UPDATE user_token_balance SET balance=$1, updated_at=$2 WHERE id=$3", [newBalance, timestamp, fromBalanceId]);
            if ((0, helpers_1.isZeroDec)(newBalance)) {
                await db.query("UPDATE token SET holder_count = holder_count - 1 WHERE id = $1", [tokenId]);
            }
        }
    }
    // Handle receiver balance
    if (toAddress !== helpers_1.ZERO_ADDRESS) {
        await (0, helpers_1.getOrCreateUser)(toAddress, timestamp, db);
        const toBalanceId = `${toAddress}-${tokenId}`;
        const tbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [toBalanceId]);
        if (tbRes.rows.length === 0) {
            await db.query(`INSERT INTO user_token_balance (id, user_id, token_id, balance, updated_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [toBalanceId, toAddress, tokenId, amount, timestamp]);
            await db.query("UPDATE token SET holder_count = holder_count + 1 WHERE id = $1", [tokenId]);
        }
        else {
            const newBalance = (0, helpers_1.addDec)(tbRes.rows[0].balance, amount);
            await db.query("UPDATE user_token_balance SET balance=$1, updated_at=$2 WHERE id=$3", [newBalance, timestamp, toBalanceId]);
        }
    }
}
//# sourceMappingURL=usid.js.map