import { BigInt, BigDecimal, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  Protocol,
  User,
  Market,
  MarketHourData,
  MarketDayData,
  ProtocolDayData
} from "../generated/schema";

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let ZERO_BD = BigDecimal.fromString("0");
export let ONE_BD = BigDecimal.fromString("1");

export let USID_ADDRESS = "0x49345967360a401bf99840dafc8e51148a5b7897";
export let FACTORY_ADDRESS = "0x9e2952aa4409cdb4c755891d5214c5239cda99fd";
export let MARKET_NFT_ADDRESS = "0x10ea19646d0e2f773426b8bb45e09d2bcc322604";

export function exponentToBigDecimal(decimals: i32): BigDecimal {
  let bd = BigDecimal.fromString("1");
  for (let i = 0; i < decimals; i++) {
    bd = bd.times(BigDecimal.fromString("10"));
  }
  return bd;
}

export function convertToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  if (decimals == 0) {
    return amount.toBigDecimal();
  }
  return amount.toBigDecimal().div(exponentToBigDecimal(decimals));
}

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load("1");
  if (!protocol) {
    protocol = new Protocol("1");
    protocol.totalMarkets = ZERO_BI;
    protocol.totalVolumeUSID = ZERO_BD;
    protocol.totalFeesUSID = ZERO_BD;
    protocol.totalSwaps = ZERO_BI;
    protocol.totalUsers = ZERO_BI;
    protocol.createdAt = ZERO_BI;
    protocol.updatedAt = ZERO_BI;
  }
  return protocol;
}

export function getOrCreateUser(address: Address, timestamp: BigInt): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString());
    user.address = address;
    user.totalSwaps = ZERO_BI;
    user.totalVolumeUSID = ZERO_BD;
    user.marketsCreated = ZERO_BI;
    user.firstSeenAt = timestamp;
    user.lastSeenAt = timestamp;
    
    // Update protocol user count
    let protocol = getOrCreateProtocol();
    protocol.totalUsers = protocol.totalUsers.plus(ONE_BI);
    protocol.save();
  }
  return user;
}

export function feeStrategyFromInt(strategy: i32): string {
  if (strategy == 0) return "CLAIM";
  if (strategy == 1) return "BURN";
  if (strategy == 2) return "AIRDROP";
  if (strategy == 3) return "LP_REWARDS";
  return "CLAIM";
}

export function updateMarketHourData(
  market: Market,
  timestamp: BigInt,
  price: BigDecimal,
  volumeUSID: BigDecimal,
  feesUSID: BigDecimal
): MarketHourData {
  let hourIndex = timestamp.toI32() / 3600;
  let hourStartUnix = hourIndex * 3600;
  let hourId = market.id + "-" + hourIndex.toString();
  
  let hourData = MarketHourData.load(hourId);
  if (!hourData) {
    hourData = new MarketHourData(hourId);
    hourData.market = market.id;
    hourData.hourStartUnix = BigInt.fromI32(hourStartUnix);
    hourData.open = price;
    hourData.high = price;
    hourData.low = price;
    hourData.close = price;
    hourData.volumeUSID = ZERO_BD;
    hourData.volumeToken = ZERO_BD;
    hourData.feesUSID = ZERO_BD;
    hourData.reserveUSID = market.reserveUSID;
    hourData.reserveToken = market.reserveToken;
    hourData.swapCount = ZERO_BI;
  }
  
  if (price.gt(hourData.high)) {
    hourData.high = price;
  }
  if (price.lt(hourData.low)) {
    hourData.low = price;
  }
  hourData.close = price;
  hourData.volumeUSID = hourData.volumeUSID.plus(volumeUSID);
  hourData.feesUSID = hourData.feesUSID.plus(feesUSID);
  hourData.reserveUSID = market.reserveUSID;
  hourData.reserveToken = market.reserveToken;
  hourData.swapCount = hourData.swapCount.plus(ONE_BI);
  hourData.save();
  
  return hourData;
}

export function updateMarketDayData(
  market: Market,
  timestamp: BigInt,
  price: BigDecimal,
  volumeUSID: BigDecimal,
  feesUSID: BigDecimal
): MarketDayData {
  let dayIndex = timestamp.toI32() / 86400;
  let dayStartUnix = dayIndex * 86400;
  let dayId = market.id + "-" + dayIndex.toString();
  
  let dayData = MarketDayData.load(dayId);
  if (!dayData) {
    dayData = new MarketDayData(dayId);
    dayData.market = market.id;
    dayData.dayStartUnix = BigInt.fromI32(dayStartUnix);
    dayData.open = price;
    dayData.high = price;
    dayData.low = price;
    dayData.close = price;
    dayData.volumeUSID = ZERO_BD;
    dayData.volumeToken = ZERO_BD;
    dayData.feesUSID = ZERO_BD;
    dayData.reserveUSID = market.reserveUSID;
    dayData.reserveToken = market.reserveToken;
    dayData.swapCount = ZERO_BI;
  }
  
  if (price.gt(dayData.high)) {
    dayData.high = price;
  }
  if (price.lt(dayData.low)) {
    dayData.low = price;
  }
  dayData.close = price;
  dayData.volumeUSID = dayData.volumeUSID.plus(volumeUSID);
  dayData.feesUSID = dayData.feesUSID.plus(feesUSID);
  dayData.reserveUSID = market.reserveUSID;
  dayData.reserveToken = market.reserveToken;
  dayData.swapCount = dayData.swapCount.plus(ONE_BI);
  dayData.save();
  
  return dayData;
}

export function updateProtocolDayData(
  timestamp: BigInt,
  volumeUSID: BigDecimal,
  feesUSID: BigDecimal,
  swapCount: BigInt,
  newMarkets: BigInt
): ProtocolDayData {
  let dayIndex = timestamp.toI32() / 86400;
  let dayStartUnix = dayIndex * 86400;
  let dayId = dayIndex.toString();
  
  let protocol = getOrCreateProtocol();
  
  let dayData = ProtocolDayData.load(dayId);
  if (!dayData) {
    dayData = new ProtocolDayData(dayId);
    dayData.dayStartUnix = BigInt.fromI32(dayStartUnix);
    dayData.volumeUSID = ZERO_BD;
    dayData.feesUSID = ZERO_BD;
    dayData.swapCount = ZERO_BI;
    dayData.newMarkets = ZERO_BI;
    dayData.activeUsers = ZERO_BI;
    dayData.totalMarkets = protocol.totalMarkets;
    dayData.totalVolumeUSID = protocol.totalVolumeUSID;
  }
  
  dayData.volumeUSID = dayData.volumeUSID.plus(volumeUSID);
  dayData.feesUSID = dayData.feesUSID.plus(feesUSID);
  dayData.swapCount = dayData.swapCount.plus(swapCount);
  dayData.newMarkets = dayData.newMarkets.plus(newMarkets);
  dayData.totalMarkets = protocol.totalMarkets;
  dayData.totalVolumeUSID = protocol.totalVolumeUSID;
  dayData.save();
  
  return dayData;
}
