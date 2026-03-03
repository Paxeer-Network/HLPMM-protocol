import { ethers } from "ethers";
import { getPool } from "../db";
import {
  toDecimal, addDec, ZERO_ADDRESS,
  getOrCreateUser, feeStrategyFromInt,
} from "./helpers";

export async function handleNFTTransfer(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const tokenId = log.args.tokenId.toString();
  const from = log.args.from.toLowerCase();
  const to = log.args.to.toLowerCase();

  const nftRes = await db.query("SELECT * FROM market_nft WHERE id = $1", [tokenId]);
  if (nftRes.rows.length === 0) return;

  // Skip mint events (from zero address)
  if (from === ZERO_ADDRESS) return;

  const fromUser = await getOrCreateUser(from, timestamp, db);
  const toUser = await getOrCreateUser(to, timestamp, db);

  const transferId = `${txHash}-${logIndex}`;
  await db.query(
    `INSERT INTO nft_transfer (id, nft_id, from_id, to_id, tx_hash, block_number, "timestamp")
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [transferId, tokenId, from, to, txHash, blockNumber, timestamp]
  );

  await db.query(
    "UPDATE market_nft SET owner_id = $1, updated_at = $2 WHERE id = $3",
    [to, timestamp, tokenId]
  );
}

export async function handleNFTFeeStrategyUpdated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const tokenId = log.args.tokenId.toString();
  const newStrategy = feeStrategyFromInt(Number(log.args.newStrategy));

  const nftRes = await db.query("SELECT * FROM market_nft WHERE id = $1", [tokenId]);
  if (nftRes.rows.length === 0) return;
  const nft = nftRes.rows[0];

  const changeId = `${txHash}-${logIndex}`;
  await db.query(
    `INSERT INTO fee_strategy_change (id, nft_id, old_strategy, new_strategy, tx_hash, block_number, "timestamp")
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [changeId, tokenId, nft.fee_strategy, newStrategy, txHash, blockNumber, timestamp]
  );

  await db.query(
    "UPDATE market_nft SET fee_strategy=$1, updated_at=$2, strategy_changes = strategy_changes + 1 WHERE id=$3",
    [newStrategy, timestamp, tokenId]
  );
}

export async function handleNFTFeesClaimed(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number) {
  const db = getPool();

  const tokenId = log.args.tokenId.toString();
  const recipient = log.args.recipient.toLowerCase();
  const amount = toDecimal(log.args.amount.toString(), 18);

  const nftRes = await db.query("SELECT * FROM market_nft WHERE id = $1", [tokenId]);
  if (nftRes.rows.length === 0) return;
  const nft = nftRes.rows[0];

  await getOrCreateUser(recipient, timestamp, db);

  const claimId = `${txHash}-${logIndex}`;
  await db.query(
    `INSERT INTO fee_claim (id, nft_id, recipient_id, amount, tx_hash, block_number, "timestamp")
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    [claimId, tokenId, recipient, amount, txHash, blockNumber, timestamp]
  );

  await db.query(
    `UPDATE market_nft SET total_fees_claimed=$1, pending_fees='0', updated_at=$2, lifetime_revenue=$3 WHERE id=$4`,
    [addDec(nft.total_fees_claimed, amount), timestamp, addDec(nft.lifetime_revenue, amount), tokenId]
  );
}
