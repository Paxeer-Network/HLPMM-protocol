import { ethers } from "ethers";
import { Pool, PoolClient } from "pg";
import { getPool } from "../db";
import {
  toDecimal, addDec, divDec, mulDec, ZERO, USID_ADDRESS,
  getOrCreateProtocol, getOrCreateUser,
  updateMarketHourData, updateMarketDayData, updateMarket5MinData, updateProtocolDayData,
  refreshMarketEnrichedFields, feeStrategyFromInt, subDec, cmpDec,
} from "./helpers";

// ─── MarketCreated (EventEmitter) ────────────────────────────

export async function handleMarketCreated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const pool = log.args.pool.toLowerCase();
  const tokenAddr = log.args.token.toLowerCase();
  const nftId = log.args.nftId.toString();
  const creator = log.args.creator.toLowerCase();
  const name = log.args.name as string;
  const symbol = log.args.symbol as string;

  await getOrCreateProtocol(db);
  await getOrCreateUser(creator, timestamp, db);

  // Increment creator market count
  await db.query('UPDATE "user" SET markets_created = markets_created + 1 WHERE id = $1', [creator]);

  // Create token
  const defaultSupply = toDecimal((BigInt(1_000_000_000) * BigInt(10 ** 18)).toString(), 18);
  await db.query(
    `INSERT INTO token (id, address, name, symbol, decimals, total_supply, holder_count, transfer_count, created_at)
     VALUES ($1, $2, $3, $4, 18, $5, 0, 0, $6) ON CONFLICT (id) DO NOTHING`,
    [tokenAddr, tokenAddr, name, symbol, defaultSupply, timestamp]
  );

  // Create market
  const reserveUSID = toDecimal((BigInt(10_000) * BigInt(10 ** 18)).toString(), 18);
  const reserveToken = toDecimal((BigInt(1_000_000_000) * BigInt(10 ** 18)).toString(), 18);
  const spotPrice = divDec(reserveUSID, reserveToken);
  const marketCap = mulDec(spotPrice, defaultSupply);

  await db.query(
    `INSERT INTO market (id, pool, token_id, nft_id, creator_id, name, symbol,
     reserve_usid, reserve_token, spot_price, market_cap,
     volume_usid, volume_token, fees_usid, swap_count, holder_count,
     created_at, created_at_block, updated_at,
     price_change_1h, price_change_24h, price_change_7d,
     volume_usid_1h, volume_usid_24h, volume_usid_7d,
     ath, ath_timestamp, atl, atl_timestamp, last_swap_at, liquidity_usid)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
     $8, $9, $10, $11,
     '0', '0', '0', 0, 1,
     $12, $13, $14,
     '0', '0', '0',
     '0', '0', '0',
     $15, $16, $17, $18, 0, $19) ON CONFLICT (id) DO NOTHING`,
    [
      pool, pool, tokenAddr, nftId, creator, name, symbol,
      reserveUSID, reserveToken, spotPrice, marketCap,
      timestamp, blockNumber, timestamp,
      spotPrice, timestamp, spotPrice, timestamp, reserveUSID
    ]
  );

  // Link token -> market
  await db.query("UPDATE token SET market_id = $1 WHERE id = $2", [pool, tokenAddr]);

  // Create NFT entity
  await db.query(
    `INSERT INTO market_nft (id, token_id_num, owner_id, market_id, pool, fee_strategy, total_fees_claimed, pending_fees, minted_at, updated_at, lifetime_revenue, strategy_changes)
     VALUES ($1, $2, $3, $4, $5, 'CLAIM', '0', '0', $6, $7, '0', 0) ON CONFLICT (id) DO NOTHING`,
    [nftId, parseInt(nftId), creator, pool, pool, timestamp, timestamp]
  );

  // Update protocol
  await db.query("UPDATE protocol SET total_markets = total_markets + 1, updated_at = $1 WHERE id = '1'", [timestamp]);

  // Update protocol day data
  await updateProtocolDayData(timestamp, ZERO, ZERO, 0, 1, db);

  // Track pool and token for dynamic event listening
  await db.query("INSERT INTO tracked_pool (address, token_address, created_at) VALUES ($1, $2, $3) ON CONFLICT (address) DO NOTHING", [pool, tokenAddr, timestamp]);
  await db.query("INSERT INTO tracked_token (address, created_at) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING", [tokenAddr, timestamp]);
}

// ─── Swap (EventEmitter) ────────────────────────────────────

export async function handleSwap(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const pool = log.args.pool.toLowerCase();
  const sender = log.args.sender.toLowerCase();
  const tokenIn = log.args.tokenIn.toLowerCase();
  const tokenOut = log.args.tokenOut.toLowerCase();
  const amountIn = toDecimal(log.args.amountIn.toString(), 18);
  const amountOut = toDecimal(log.args.amountOut.toString(), 18);
  const reserveUSID = toDecimal(log.args.newReserveUSID.toString(), 18);
  const reserveToken = toDecimal(log.args.newReserveToken.toString(), 18);
  const feeAmount = toDecimal(log.args.feeAmount.toString(), 18);

  const mRes = await db.query("SELECT * FROM market WHERE id = $1", [pool]);
  if (mRes.rows.length === 0) return;
  const market = mRes.rows[0];

  const user = await getOrCreateUser(sender, timestamp, db);

  const isUSIDIn = tokenIn === USID_ADDRESS;
  const volumeUSID = isUSIDIn ? amountIn : amountOut;
  const side = isUSIDIn ? "BUY" : "SELL";

  const spotPrice = divDec(reserveUSID, reserveToken);

  // Price impact
  const oldPrice = market.spot_price;
  const priceImpact = cmpDec(oldPrice, ZERO) !== 0
    ? mulDec(divDec(subDec(spotPrice, oldPrice), oldPrice), "100")
    : ZERO;

  const swapId = `${txHash}-${logIndex}`;

  await db.query(
    `INSERT INTO swap (id, market_id, user_id, tx_hash, block_number, "timestamp", log_index,
     token_in, token_out, amount_in, amount_out, amount_in_usid,
     reserve_usid, reserve_token, spot_price, fee_amount, fee_usid,
     price_impact, side)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (id) DO NOTHING`,
    [
      swapId, pool, sender, txHash, blockNumber, timestamp, logIndex,
      tokenIn, tokenOut, amountIn, amountOut, volumeUSID,
      reserveUSID, reserveToken, spotPrice, feeAmount, feeAmount,
      priceImpact, side
    ]
  );

  // Get token for marketCap
  const tokenRes = await db.query("SELECT total_supply FROM token WHERE id = $1", [market.token_id]);
  const token = tokenRes.rows[0];
  const marketCap = token ? mulDec(spotPrice, token.total_supply) : "0";

  // Token volume in USID
  const tokenAmount = subDec(addDec(amountIn, amountOut), volumeUSID);
  const tokenVolumeInUSID = mulDec(tokenAmount, spotPrice);

  // Update market
  await db.query(
    `UPDATE market SET
     reserve_usid=$1, reserve_token=$2, spot_price=$3, market_cap=$4,
     volume_usid=$5, volume_token=$6, fees_usid=$7,
     swap_count = swap_count + 1, updated_at=$8
     WHERE id=$9`,
    [
      reserveUSID, reserveToken, spotPrice, marketCap,
      addDec(market.volume_usid, volumeUSID),
      addDec(market.volume_token, tokenVolumeInUSID),
      addDec(market.fees_usid, feeAmount),
      timestamp, pool
    ]
  );

  // Update user
  await db.query(
    `UPDATE "user" SET total_swaps = total_swaps + 1, total_volume_usid = $1, last_seen_at = $2 WHERE id = $3`,
    [addDec(user.total_volume_usid, volumeUSID), timestamp, sender]
  );

  // Update protocol
  const protocol = await getOrCreateProtocol(db);
  await db.query(
    `UPDATE protocol SET total_volume_usid=$1, total_fees_usid=$2, total_swaps = total_swaps + 1, updated_at=$3 WHERE id = '1'`,
    [addDec(protocol.total_volume_usid, volumeUSID), addDec(protocol.total_fees_usid, feeAmount), timestamp]
  );

  // Update NFT pending fees
  const nftRes = await db.query("SELECT pending_fees FROM market_nft WHERE id = $1", [market.nft_id]);
  if (nftRes.rows.length > 0) {
    await db.query(
      "UPDATE market_nft SET pending_fees=$1, updated_at=$2 WHERE id=$3",
      [addDec(nftRes.rows[0].pending_fees, feeAmount), timestamp, market.nft_id]
    );
  }

  // Time-series
  await updateMarketHourData(pool, timestamp, spotPrice, volumeUSID, tokenVolumeInUSID, feeAmount, reserveUSID, reserveToken, db);
  await updateMarketDayData(pool, timestamp, spotPrice, volumeUSID, tokenVolumeInUSID, feeAmount, reserveUSID, reserveToken, db);
  await updateMarket5MinData(pool, timestamp, spotPrice, volumeUSID, tokenVolumeInUSID, feeAmount, reserveUSID, reserveToken, db);
  await updateProtocolDayData(timestamp, volumeUSID, feeAmount, 1, 0, db);

  // Refresh enriched fields
  await refreshMarketEnrichedFields(pool, timestamp, db);
}

// ─── FeeClaimed (EventEmitter) ──────────────────────────────

export async function handleFeeClaimed(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const nftId = log.args.nftId.toString();
  const recipient = log.args.recipient.toLowerCase();
  const amount = toDecimal(log.args.amount.toString(), 18);

  const nftRes = await db.query("SELECT * FROM market_nft WHERE id = $1", [nftId]);
  if (nftRes.rows.length === 0) return;
  const nft = nftRes.rows[0];

  await getOrCreateUser(recipient, timestamp, db);

  const claimId = `${txHash}-${logIndex}`;
  await db.query(
    `INSERT INTO fee_claim (id, nft_id, recipient_id, amount, tx_hash, block_number, "timestamp")
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [claimId, nftId, recipient, amount, txHash, blockNumber, timestamp]
  );

  await db.query(
    `UPDATE market_nft SET total_fees_claimed=$1, pending_fees='0', updated_at=$2, lifetime_revenue=$3 WHERE id=$4`,
    [addDec(nft.total_fees_claimed, amount), timestamp, addDec(nft.lifetime_revenue, amount), nftId]
  );
}

// ─── FeeStrategyUpdated (EventEmitter) ──────────────────────

export async function handleFeeStrategyUpdated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const nftId = log.args.nftId.toString();
  const newStrategy = feeStrategyFromInt(Number(log.args.newStrategy));

  const nftRes = await db.query("SELECT * FROM market_nft WHERE id = $1", [nftId]);
  if (nftRes.rows.length === 0) return;
  const nft = nftRes.rows[0];

  const changeId = `${txHash}-${logIndex}`;
  await db.query(
    `INSERT INTO fee_strategy_change (id, nft_id, old_strategy, new_strategy, tx_hash, block_number, "timestamp")
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [changeId, nftId, nft.fee_strategy, newStrategy, txHash, blockNumber, timestamp]
  );

  await db.query(
    "UPDATE market_nft SET fee_strategy=$1, updated_at=$2, strategy_changes = strategy_changes + 1 WHERE id=$3",
    [newStrategy, timestamp, nftId]
  );
}
