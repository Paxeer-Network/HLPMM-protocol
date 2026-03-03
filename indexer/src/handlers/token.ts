import { ethers } from "ethers";
import { getPool } from "../db";
import { toDecimal, addDec, subDec, isZeroDec, ZERO_ADDRESS, getOrCreateUser, ZERO } from "./helpers";

export async function handleTokenTransfer(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number, tokenAddress: string) {
  const db = getPool();

  const addr = tokenAddress.toLowerCase();
  const tokenRes = await db.query("SELECT * FROM token WHERE id = $1", [addr]);
  if (tokenRes.rows.length === 0) return;
  const token = tokenRes.rows[0];

  const amount = toDecimal(log.args.value.toString(), 18);
  const fromAddress = log.args.from.toLowerCase();
  const toAddress = log.args.to.toLowerCase();

  // Update transfer count
  await db.query("UPDATE token SET transfer_count = transfer_count + 1 WHERE id = $1", [addr]);

  // Handle sender balance (not mint)
  if (fromAddress !== ZERO_ADDRESS) {
    await getOrCreateUser(fromAddress, timestamp, db);
    const fromBalanceId = `${fromAddress}-${addr}`;
    const fbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [fromBalanceId]);

    if (fbRes.rows.length > 0) {
      const newBalance = subDec(fbRes.rows[0].balance, amount);
      await db.query(
        "UPDATE user_token_balance SET balance = $1, updated_at = $2 WHERE id = $3",
        [newBalance, timestamp, fromBalanceId]
      );
      // Decrease holder count if balance goes to zero
      if (isZeroDec(newBalance)) {
        await db.query("UPDATE token SET holder_count = holder_count - 1 WHERE id = $1", [addr]);
      }
    }
  }

  // Handle receiver balance (not burn)
  if (toAddress !== ZERO_ADDRESS) {
    await getOrCreateUser(toAddress, timestamp, db);
    const toBalanceId = `${toAddress}-${addr}`;
    const tbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [toBalanceId]);

    if (tbRes.rows.length === 0) {
      await db.query(
        `INSERT INTO user_token_balance (id, user_id, token_id, balance, updated_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [toBalanceId, toAddress, addr, amount, timestamp]
      );
      // New holder
      await db.query("UPDATE token SET holder_count = holder_count + 1 WHERE id = $1", [addr]);
    } else {
      const wasZero = isZeroDec(tbRes.rows[0].balance);
      const newBalance = addDec(tbRes.rows[0].balance, amount);
      await db.query(
        "UPDATE user_token_balance SET balance = $1, updated_at = $2 WHERE id = $3",
        [newBalance, timestamp, toBalanceId]
      );
      if (wasZero) {
        await db.query("UPDATE token SET holder_count = holder_count + 1 WHERE id = $1", [addr]);
      }
    }
  }

  // Sync Market holderCount with Token holderCount
  if (token.market_id) {
    const updatedToken = (await db.query("SELECT holder_count FROM token WHERE id = $1", [addr])).rows[0];
    if (updatedToken) {
      await db.query("UPDATE market SET holder_count = $1 WHERE id = $2", [updatedToken.holder_count, token.market_id]);
    }
  }
}
