import { BigInt, BigDecimal, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  MarketCreated,
  Swap as SwapEvent,
  FeeClaimed,
  FeeStrategyUpdated
} from "../generated/EventEmitter/EventEmitter";
import {
  Protocol,
  Market,
  Token,
  MarketNFT,
  User,
  Swap,
  FeeClaim,
  FeeStrategyChange,
  MarketHourData,
  MarketDayData,
  ProtocolDayData
} from "../generated/schema";
import { HLPMMPool, HLPMMToken } from "../generated/templates";
import { ERC20 } from "../generated/EventEmitter/ERC20";
import {
  ZERO_BD,
  ZERO_BI,
  ONE_BI,
  USID_ADDRESS,
  convertToDecimal,
  getOrCreateProtocol,
  getOrCreateUser,
  updateMarketHourData,
  updateMarketDayData,
  updateProtocolDayData,
  feeStrategyFromInt
} from "./helpers";

export function handleMarketCreated(event: MarketCreated): void {
  let protocol = getOrCreateProtocol();
  
  // Create token entity
  let tokenContract = ERC20.bind(event.params.token);
  let token = new Token(event.params.token.toHexString());
  token.address = event.params.token;
  token.name = event.params.name;
  token.symbol = event.params.symbol;
  token.decimals = 18;
  token.totalSupply = convertToDecimal(BigInt.fromI64(1000000000).times(BigInt.fromI64(10).pow(18)), 18);
  token.holderCount = ZERO_BI;
  token.transferCount = ZERO_BI;
  token.createdAt = event.block.timestamp;
  token.save();
  
  // Create user entity for creator
  let creator = getOrCreateUser(event.params.creator, event.block.timestamp);
  creator.marketsCreated = creator.marketsCreated.plus(ONE_BI);
  creator.save();
  
  // Create market entity
  let market = new Market(event.params.pool.toHexString());
  market.pool = event.params.pool;
  market.token = token.id;
  market.nft = event.params.nftId.toString();
  market.creator = creator.id;
  market.name = event.params.name;
  market.symbol = event.params.symbol;
  market.reserveUSID = convertToDecimal(BigInt.fromI64(10000).times(BigInt.fromI64(10).pow(18)), 18);
  market.reserveToken = convertToDecimal(BigInt.fromI64(1000000000).times(BigInt.fromI64(10).pow(18)), 18);
  market.spotPrice = market.reserveUSID.div(market.reserveToken);
  market.marketCap = market.spotPrice.times(token.totalSupply);
  market.volumeUSID = ZERO_BD;
  market.volumeToken = ZERO_BD;
  market.feesUSID = ZERO_BD;
  market.swapCount = ZERO_BI;
  market.holderCount = ONE_BI;
  market.createdAt = event.block.timestamp;
  market.createdAtBlock = event.block.number;
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Link token to market
  token.market = market.id;
  token.save();
  
  // Create NFT entity
  let nft = new MarketNFT(event.params.nftId.toString());
  nft.tokenId = event.params.nftId;
  nft.owner = creator.id;
  nft.market = market.id;
  nft.pool = event.params.pool;
  nft.feeStrategy = "CLAIM";
  nft.totalFeesClaimed = ZERO_BD;
  nft.pendingFees = ZERO_BD;
  nft.mintedAt = event.block.timestamp;
  nft.updatedAt = event.block.timestamp;
  nft.save();
  
  // Update protocol stats
  protocol.totalMarkets = protocol.totalMarkets.plus(ONE_BI);
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
  
  // Update daily data
  updateProtocolDayData(event.block.timestamp, ZERO_BD, ZERO_BD, ZERO_BI, ONE_BI);
  
  // Create dynamic data sources
  HLPMMPool.create(event.params.pool);
  HLPMMToken.create(event.params.token);
}

export function handleSwap(event: SwapEvent): void {
  let market = Market.load(event.params.pool.toHexString());
  if (!market) return;
  
  let user = getOrCreateUser(event.params.sender, event.block.timestamp);
  let protocol = getOrCreateProtocol();
  
  let amountIn = convertToDecimal(event.params.amountIn, 18);
  let amountOut = convertToDecimal(event.params.amountOut, 18);
  let feeAmount = convertToDecimal(event.params.feeAmount, 18);
  let reserveUSID = convertToDecimal(event.params.newReserveUSID, 18);
  let reserveToken = convertToDecimal(event.params.newReserveToken, 18);
  
  // Determine USID volume - check if tokenIn is USID
  let volumeUSID: BigDecimal;
  let isUSIDIn = event.params.tokenIn.toHexString() == USID_ADDRESS;
  if (isUSIDIn) {
    volumeUSID = amountIn;
  } else {
    volumeUSID = amountOut;
  }
  
  // Create swap entity
  let swapId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let swap = new Swap(swapId);
  swap.market = market.id;
  swap.user = user.id;
  swap.txHash = event.transaction.hash;
  swap.blockNumber = event.block.number;
  swap.timestamp = event.block.timestamp;
  swap.logIndex = event.logIndex;
  swap.tokenIn = event.params.tokenIn;
  swap.tokenOut = event.params.tokenOut;
  swap.amountIn = amountIn;
  swap.amountOut = amountOut;
  swap.amountInUSID = volumeUSID;
  swap.reserveUSID = reserveUSID;
  swap.reserveToken = reserveToken;
  swap.spotPrice = reserveUSID.div(reserveToken);
  swap.feeAmount = feeAmount;
  swap.feeUSID = feeAmount;
  swap.save();
  
  // Update market
  market.reserveUSID = reserveUSID;
  market.reserveToken = reserveToken;
  market.spotPrice = reserveUSID.div(reserveToken);
  
  // Calculate marketCap as spotPrice × totalSupply
  let token = Token.load(market.token);
  if (token) {
    market.marketCap = market.spotPrice.times(token.totalSupply);
  }
  market.volumeUSID = market.volumeUSID.plus(volumeUSID);
  // Convert token volume to USID value using spot price
  let tokenAmount = amountIn.plus(amountOut).minus(volumeUSID);
  let tokenVolumeInUSID = tokenAmount.times(market.spotPrice);
  market.volumeToken = market.volumeToken.plus(tokenVolumeInUSID);
  market.feesUSID = market.feesUSID.plus(feeAmount);
  market.swapCount = market.swapCount.plus(ONE_BI);
  market.updatedAt = event.block.timestamp;
  market.save();
  
  // Update user
  user.totalSwaps = user.totalSwaps.plus(ONE_BI);
  user.totalVolumeUSID = user.totalVolumeUSID.plus(volumeUSID);
  user.lastSeenAt = event.block.timestamp;
  user.save();
  
  // Update protocol
  protocol.totalVolumeUSID = protocol.totalVolumeUSID.plus(volumeUSID);
  protocol.totalFeesUSID = protocol.totalFeesUSID.plus(feeAmount);
  protocol.totalSwaps = protocol.totalSwaps.plus(ONE_BI);
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
  
  // Update NFT pending fees
  let nft = MarketNFT.load(market.nft);
  if (nft) {
    nft.pendingFees = nft.pendingFees.plus(feeAmount);
    nft.updatedAt = event.block.timestamp;
    nft.save();
  }
  
  // Update time series data
  updateMarketHourData(market, event.block.timestamp, market.spotPrice, volumeUSID, tokenVolumeInUSID, feeAmount);
  updateMarketDayData(market, event.block.timestamp, market.spotPrice, volumeUSID, tokenVolumeInUSID, feeAmount);
  updateProtocolDayData(event.block.timestamp, volumeUSID, feeAmount, ONE_BI, ZERO_BI);
}

export function handleFeeClaimed(event: FeeClaimed): void {
  let nft = MarketNFT.load(event.params.nftId.toString());
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

export function handleFeeStrategyUpdated(event: FeeStrategyUpdated): void {
  let nft = MarketNFT.load(event.params.nftId.toString());
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
