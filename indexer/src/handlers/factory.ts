import { ethers } from "ethers";
import { getPool } from "../db";
import {
  toDecimal, divDec, ZERO,
  getOrCreateProtocol, getOrCreateUser,
} from "./helpers";

/**
 * Factory fallback: if EventEmitter misses MarketCreated, create Market here.
 */
export async function handleFactoryMarketCreated(
  log: ethers.LogDescription,
  blockNumber: number,
  timestamp: number,
  txHash: string,
  logIndex: number
) {
  const db = getPool();

  const pool = log.args.pool.toLowerCase();
  const tokenAddr = log.args.token.toLowerCase();
  const nftId = log.args.nftId.toString();
  const creator = log.args.creator.toLowerCase();

  // If market already exists (created by EventEmitter handler), skip
  const existing = await db.query("SELECT id FROM market WHERE id = $1", [pool]);
  if (existing.rows.length > 0) return;

  await getOrCreateProtocol(db);
  await getOrCreateUser(creator, timestamp, db);
  await db.query('UPDATE "user" SET markets_created = markets_created + 1 WHERE id = $1', [creator]);

  const tokenName = "Token";
  const tokenSymbol = "TKN";
  const decimals = 18;

  const reserveUSIDRaw = (BigInt(10_000) * BigInt(10 ** 18)).toString();
  const reserveTokenRaw = (BigInt(1_000_000_000) * BigInt(10 ** 18)).toString();

  const tokenTotalSupply = toDecimal((BigInt(1_000_000_000) * BigInt(10 ** 18)).toString(), decimals);
  await db.query(
    `INSERT INTO token (id, address, name, symbol, decimals, total_supply, holder_count, transfer_count, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,0,0,$7) ON CONFLICT (id) DO NOTHING`,
    [tokenAddr, tokenAddr, tokenName, tokenSymbol, decimals, tokenTotalSupply, timestamp]
  );

  const reserveUSID = toDecimal(reserveUSIDRaw, 18);
  const reserveToken = toDecimal(reserveTokenRaw, decimals);
  const spotPrice = divDec(reserveUSID, reserveToken);

  await db.query(
    `INSERT INTO market (id, pool, token_id, nft_id, creator_id, name, symbol,
     reserve_usid, reserve_token, spot_price, market_cap,
     volume_usid, volume_token, fees_usid, swap_count, holder_count,
     created_at, created_at_block, updated_at,
     price_change_1h, price_change_24h, price_change_7d,
     volume_usid_1h, volume_usid_24h, volume_usid_7d,
     ath, ath_timestamp, atl, atl_timestamp, last_swap_at, liquidity_usid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,
     $8,$9,$10,$11,
     '0','0','0',0,1,
     $12,$13,$14,
     '0','0','0',
     '0','0','0',
     $15,$16,$17,$18,0,$19) ON CONFLICT (id) DO NOTHING`,
    [
      pool, pool, tokenAddr, nftId, creator, tokenName, tokenSymbol,
      reserveUSID, reserveToken, spotPrice, reserveUSID,
      timestamp, blockNumber, timestamp,
      spotPrice, timestamp, spotPrice, timestamp, reserveUSID
    ]
  );

  await db.query("UPDATE token SET market_id = $1 WHERE id = $2", [pool, tokenAddr]);

  await db.query(
    `INSERT INTO market_nft (id, token_id_num, owner_id, market_id, pool, fee_strategy, total_fees_claimed, pending_fees, minted_at, updated_at, lifetime_revenue, strategy_changes)
     VALUES ($1,$2,$3,$4,$5,'CLAIM','0','0',$6,$7,'0',0) ON CONFLICT (id) DO NOTHING`,
    [nftId, parseInt(nftId), creator, pool, pool, timestamp, timestamp]
  );

  await db.query("UPDATE protocol SET total_markets = total_markets + 1, updated_at = $1 WHERE id = '1'", [timestamp]);

  await db.query("INSERT INTO tracked_pool (address, token_address, created_at) VALUES ($1,$2,$3) ON CONFLICT (address) DO NOTHING", [pool, tokenAddr, timestamp]);
  await db.query("INSERT INTO tracked_token (address, created_at) VALUES ($1,$2) ON CONFLICT (address) DO NOTHING", [tokenAddr, timestamp]);
}
