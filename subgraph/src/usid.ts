import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/USID/ERC20";
import { Token, User, UserTokenBalance } from "../generated/schema";
import { convertToDecimal, getOrCreateUser, ZERO_BD, ONE_BI, USID_ADDRESS } from "./helpers";

export function handleUSIDTransfer(event: Transfer): void {
  let tokenId = USID_ADDRESS;
  let token = Token.load(tokenId);
  
  // Create USID token entity if not exists
  if (!token) {
    token = new Token(tokenId);
    token.address = Address.fromString(USID_ADDRESS);
    token.name = "USID";
    token.symbol = "USID";
    token.decimals = 18;
    token.totalSupply = ZERO_BD;
    token.holderCount = BigInt.fromI32(0);
    token.transferCount = BigInt.fromI32(0);
    token.createdAt = event.block.timestamp;
  }
  
  let amount = convertToDecimal(event.params.value, 18);
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  
  // Update transfer count
  token.transferCount = token.transferCount.plus(ONE_BI);
  
  // Handle mint (from zero address)
  if (fromAddress.toHexString() == "0x0000000000000000000000000000000000000000") {
    token.totalSupply = token.totalSupply.plus(amount);
  }
  
  // Handle burn (to zero address)
  if (toAddress.toHexString() == "0x0000000000000000000000000000000000000000") {
    token.totalSupply = token.totalSupply.minus(amount);
  }
  
  // Handle sender balance
  if (fromAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
    let fromUser = getOrCreateUser(fromAddress, event.block.timestamp);
    let fromBalanceId = fromUser.id + "-" + token.id;
    let fromBalance = UserTokenBalance.load(fromBalanceId);
    
    if (fromBalance) {
      fromBalance.balance = fromBalance.balance.minus(amount);
      fromBalance.updatedAt = event.block.timestamp;
      fromBalance.save();
      
      if (fromBalance.balance.equals(ZERO_BD)) {
        token.holderCount = token.holderCount.minus(ONE_BI);
      }
    }
  }
  
  // Handle receiver balance
  if (toAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
    let toUser = getOrCreateUser(toAddress, event.block.timestamp);
    let toBalanceId = toUser.id + "-" + token.id;
    let toBalance = UserTokenBalance.load(toBalanceId);
    
    if (!toBalance) {
      toBalance = new UserTokenBalance(toBalanceId);
      toBalance.user = toUser.id;
      toBalance.token = token.id;
      toBalance.balance = ZERO_BD;
      token.holderCount = token.holderCount.plus(ONE_BI);
    }
    
    toBalance.balance = toBalance.balance.plus(amount);
    toBalance.updatedAt = event.block.timestamp;
    toBalance.save();
  }
  
  token.save();
}
