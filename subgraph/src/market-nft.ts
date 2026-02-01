import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Transfer, FeeStrategyUpdated, FeesClaimed } from "../generated/MarketNFT/MarketNFT";
import { MarketNFT, NFTTransfer, FeeStrategyChange, FeeClaim, User } from "../generated/schema";
import { getOrCreateUser, feeStrategyFromInt, convertToDecimal, ZERO_BD } from "./helpers";

export function handleNFTTransfer(event: Transfer): void {
  let nft = MarketNFT.load(event.params.tokenId.toString());
  
  // Skip if NFT doesn't exist (mint is handled by EventEmitter)
  if (!nft) return;
  
  // Skip mint events (from zero address)
  if (event.params.from.toHexString() == "0x0000000000000000000000000000000000000000") {
    return;
  }
  
  let fromUser = getOrCreateUser(event.params.from, event.block.timestamp);
  let toUser = getOrCreateUser(event.params.to, event.block.timestamp);
  
  // Create transfer entity
  let transferId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new NFTTransfer(transferId);
  transfer.nft = nft.id;
  transfer.from = fromUser.id;
  transfer.to = toUser.id;
  transfer.txHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.timestamp = event.block.timestamp;
  transfer.save();
  
  // Update NFT owner
  nft.owner = toUser.id;
  nft.updatedAt = event.block.timestamp;
  nft.save();
}

export function handleNFTFeeStrategyUpdated(event: FeeStrategyUpdated): void {
  let nft = MarketNFT.load(event.params.tokenId.toString());
  if (!nft) return;
  
  let oldStrategy = nft.feeStrategy;
  let newStrategy = feeStrategyFromInt(event.params.newStrategy);
  
  // Create strategy change entity
  let changeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let change = new FeeStrategyChange(changeId);
  change.nft = nft.id;
  change.oldStrategy = oldStrategy;
  change.newStrategy = newStrategy;
  change.txHash = event.transaction.hash;
  change.blockNumber = event.block.number;
  change.timestamp = event.block.timestamp;
  change.save();
  
  // Update NFT
  nft.feeStrategy = newStrategy;
  nft.updatedAt = event.block.timestamp;
  nft.save();
}

export function handleNFTFeesClaimed(event: FeesClaimed): void {
  let nft = MarketNFT.load(event.params.tokenId.toString());
  if (!nft) return;
  
  let recipient = getOrCreateUser(event.params.recipient, event.block.timestamp);
  let amount = convertToDecimal(event.params.amount, 18);
  
  // Create fee claim entity
  let claimId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let claim = new FeeClaim(claimId);
  claim.nft = nft.id;
  claim.recipient = recipient.id;
  claim.amount = amount;
  claim.txHash = event.transaction.hash;
  claim.blockNumber = event.block.number;
  claim.timestamp = event.block.timestamp;
  claim.save();
  
  // Update NFT
  nft.totalFeesClaimed = nft.totalFeesClaimed.plus(amount);
  nft.pendingFees = ZERO_BD;
  nft.updatedAt = event.block.timestamp;
  nft.save();
}
