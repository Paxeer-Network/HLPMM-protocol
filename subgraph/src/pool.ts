import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Sync } from "../generated/templates/HLPMMPool/HLPMMPool";
import { Market, Token } from "../generated/schema";
import { convertToDecimal, ZERO_BD } from "./helpers";

export function handleSync(event: Sync): void {
  let market = Market.load(event.address.toHexString());
  if (!market) return;
  
  let reserveUSID = convertToDecimal(event.params.reserve0, 18);
  let reserveToken = convertToDecimal(event.params.reserve1, 18);
  
  market.reserveUSID = reserveUSID;
  market.reserveToken = reserveToken;
  
  if (reserveToken.gt(ZERO_BD)) {
    market.spotPrice = reserveUSID.div(reserveToken);
  }
  
  // Calculate marketCap as spotPrice × totalSupply
  let token = Token.load(market.token);
  if (token) {
    market.marketCap = market.spotPrice.times(token.totalSupply);
  }
  
  market.updatedAt = event.block.timestamp;
  market.save();
}
