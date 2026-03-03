import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
import { MarketCreated } from "../generated/HLPMMFactory/HLPMMFactory";
import { ERC20 } from "../generated/HLPMMFactory/ERC20";
import { HLPMMPool as HLPMMPoolContract } from "../generated/HLPMMFactory/HLPMMPool";
import { Protocol, Market, Token, MarketNFT } from "../generated/schema";
import { HLPMMPool, HLPMMToken } from "../generated/templates";
import {
  ZERO_BD,
  ZERO_BI,
  ONE_BI,
  convertToDecimal,
  getOrCreateProtocol,
  getOrCreateUser,
} from "./helpers";

// Factory fallback: if EventEmitter misses MarketCreated, we still create the Market entity here.
export function handleFactoryMarketCreated(event: MarketCreated): void {
  // If market already exists (created by EventEmitter), skip
  let existing = Market.load(event.params.pool.toHexString());
  if (existing) return;

  let protocol = getOrCreateProtocol();

  // Creator
  let creator = getOrCreateUser(event.params.creator, event.block.timestamp);
  creator.marketsCreated = creator.marketsCreated.plus(ONE_BI);
  creator.save();

  // Token entity
  let token = new Token(event.params.token.toHexString());
  token.address = event.params.token;

  let tokenContract = ERC20.bind(event.params.token);

  // Use try_ calls to avoid handler aborts if any token is non-standard
  let nameResult = tokenContract.try_name();
  let symbolResult = tokenContract.try_symbol();
  let decimalsResult = tokenContract.try_decimals();
  let totalSupplyResult = tokenContract.try_totalSupply();

  let decimals = decimalsResult.reverted ? 18 : decimalsResult.value;
  token.decimals = decimals;

  token.name = nameResult.reverted ? "Token" : nameResult.value;
  token.symbol = symbolResult.reverted ? "TKN" : symbolResult.value;

  if (!totalSupplyResult.reverted) {
    token.totalSupply = convertToDecimal(totalSupplyResult.value, decimals);
  } else {
    token.totalSupply = ZERO_BD;
  }

  token.holderCount = ZERO_BI;
  token.transferCount = ZERO_BI;
  token.createdAt = event.block.timestamp;
  token.save();

  // Market entity
  let market = new Market(event.params.pool.toHexString());
  market.pool = event.params.pool;
  market.token = token.id;
  market.nft = event.params.nftId.toString();
  market.creator = creator.id;
  market.name = token.name;
  market.symbol = token.symbol;

  // Pull reserves from pool if possible; otherwise default to the fair-launch constants
  let pool = HLPMMPoolContract.bind(event.params.pool);

  // Defaults (same as EventEmitter handler)
  let reserveUSIDRaw = BigInt.fromI64(10000).times(BigInt.fromI64(10).pow(18));
  let reserveTokenRaw = BigInt.fromI64(1000000000).times(BigInt.fromI64(10).pow(18));

  let reservesResult = pool.try_getReserves();
  if (!reservesResult.reverted) {
    reserveUSIDRaw = reservesResult.value.getReserveUSID();
    reserveTokenRaw = reservesResult.value.getReserveToken();
  }

  market.reserveUSID = convertToDecimal(reserveUSIDRaw, 18);
  market.reserveToken = convertToDecimal(reserveTokenRaw, decimals);

  // spotPrice: keep consistent with existing indexing logic
  if (market.reserveToken.equals(ZERO_BD)) {
    market.spotPrice = ZERO_BD;
  } else {
    market.spotPrice = market.reserveUSID.div(market.reserveToken);
  }

  market.marketCap = market.reserveUSID;

  market.volumeUSID = ZERO_BD;
  market.volumeToken = ZERO_BD;
  market.feesUSID = ZERO_BD;

  market.swapCount = ZERO_BI;
  market.holderCount = ONE_BI;

  market.createdAt = event.block.timestamp;
  market.createdAtBlock = event.block.number;
  market.updatedAt = event.block.timestamp;
  market.save();

  // Link token -> market
  token.market = market.id;
  token.save();

  // Create NFT entity (minimal init; MarketNFT datasource will enrich on transfers/strategy updates)
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

  // Ensure dynamic datasources exist (so Sync/Transfer events get indexed)
  HLPMMPool.create(event.params.pool);
  HLPMMToken.create(event.params.token);
}