import { ethers } from "ethers";
import { getPool } from "../db";
import { toDecimal, divDec, mulDec, ZERO, isZeroDec } from "./helpers";

export async function handleSync(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number, poolAddress: string) {
  const db = getPool();

  const addr = poolAddress.toLowerCase();
  const reserveUSID = toDecimal(log.args.reserve0.toString(), 18);
  const reserveToken = toDecimal(log.args.reserve1.toString(), 18);

  const mRes = await db.query("SELECT * FROM market WHERE id = $1", [addr]);
  if (mRes.rows.length === 0) return;
  const market = mRes.rows[0];

  let spotPrice = market.spot_price;
  if (!isZeroDec(reserveToken)) {
    spotPrice = divDec(reserveUSID, reserveToken);
  }

  // Calculate marketCap
  const tokenRes = await db.query("SELECT total_supply FROM token WHERE id = $1", [market.token_id]);
  const marketCap = tokenRes.rows.length > 0 ? mulDec(spotPrice, tokenRes.rows[0].total_supply) : "0";

  await db.query(
    `UPDATE market SET reserve_usid=$1, reserve_token=$2, spot_price=$3, market_cap=$4, updated_at=$5 WHERE id=$6`,
    [reserveUSID, reserveToken, spotPrice, marketCap, timestamp, addr]
  );
}
