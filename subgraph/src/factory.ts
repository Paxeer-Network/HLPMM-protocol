import { BigInt, Address } from "@graphprotocol/graph-ts";
import { MarketCreated } from "../generated/HLPMMFactory/HLPMMFactory";
import { Protocol, Market } from "../generated/schema";
import { getOrCreateProtocol, ONE_BI } from "./helpers";

// This handler is a backup in case EventEmitter doesn't emit
// Primary market creation is handled by EventEmitter.handleMarketCreated
export function handleFactoryMarketCreated(event: MarketCreated): void {
  let market = Market.load(event.params.pool.toHexString());
  
  // If market already exists (created by EventEmitter), skip
  if (market) return;
  
  // Otherwise, this is a fallback - but we won't have full info
  // The EventEmitter handler should be the primary source
  let protocol = getOrCreateProtocol();
  protocol.totalMarkets = protocol.totalMarkets.plus(ONE_BI);
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
}
