import { ethers } from "ethers";
import { getPool } from "../db";
import { toDecimal, addDec, subDec, isZeroDec, ZERO_ADDRESS, USID_ADDRESS, getOrCreateUser, ZERO } from "./helpers";

export async function handleUSIDTransfer(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const tokenId = USID_ADDRESS;

  // Create USID token entity if not exists
  const tokenRes = await db.query("SELECT * FROM token WHERE id = $1", [tokenId]);
  if (tokenRes.rows.length === 0) {
    await db.query(
      `INSERT INTO token (id, address, name, symbol, decimals, total_supply, holder_count, transfer_count, created_at)
       VALUES ($1, $2, 'USID', 'USID', 18, '0', 0, 0, $3) ON CONFLICT (id) DO NOTHING`,
      [tokenId, tokenId, timestamp]
    );
  }

  const amount = toDecimal(log.args.value.toString(), 18);
  const fromAddress = log.args.from.toLowerCase();
  const toAddress = log.args.to.toLowerCase();

  // Update transfer count
  await db.query("UPDATE token SET transfer_count = transfer_count + 1 WHERE id = $1", [tokenId]);

  // Handle mint (from zero address)
  if (fromAddress === ZERO_ADDRESS) {
    const cur = (await db.query("SELECT total_supply FROM token WHERE id = $1", [tokenId])).rows[0];
    await db.query("UPDATE token SET total_supply = $1 WHERE id = $2", [addDec(cur?.total_supply ?? "0", amount), tokenId]);
  }

  // Handle burn (to zero address)
  if (toAddress === ZERO_ADDRESS) {
    const cur = (await db.query("SELECT total_supply FROM token WHERE id = $1", [tokenId])).rows[0];
    await db.query("UPDATE token SET total_supply = $1 WHERE id = $2", [subDec(cur?.total_supply ?? "0", amount), tokenId]);
  }

  // Handle sender balance
  if (fromAddress !== ZERO_ADDRESS) {
    await getOrCreateUser(fromAddress, timestamp, db);
    const fromBalanceId = `${fromAddress}-${tokenId}`;
    const fbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [fromBalanceId]);

    if (fbRes.rows.length > 0) {
      const newBalance = subDec(fbRes.rows[0].balance, amount);
      await db.query("UPDATE user_token_balance SET balance=$1, updated_at=$2 WHERE id=$3", [newBalance, timestamp, fromBalanceId]);
      if (isZeroDec(newBalance)) {
        await db.query("UPDATE token SET holder_count = holder_count - 1 WHERE id = $1", [tokenId]);
      }
    }
  }

  // Handle receiver balance
  if (toAddress !== ZERO_ADDRESS) {
    await getOrCreateUser(toAddress, timestamp, db);
    const toBalanceId = `${toAddress}-${tokenId}`;
    const tbRes = await db.query("SELECT * FROM user_token_balance WHERE id = $1", [toBalanceId]);

    if (tbRes.rows.length === 0) {
      await db.query(
        `INSERT INTO user_token_balance (id, user_id, token_id, balance, updated_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [toBalanceId, toAddress, tokenId, amount, timestamp]
      );
      await db.query("UPDATE token SET holder_count = holder_count + 1 WHERE id = $1", [tokenId]);
    } else {
      const newBalance = addDec(tbRes.rows[0].balance, amount);
      await db.query("UPDATE user_token_balance SET balance=$1, updated_at=$2 WHERE id=$3", [newBalance, timestamp, toBalanceId]);
    }
  }
}
