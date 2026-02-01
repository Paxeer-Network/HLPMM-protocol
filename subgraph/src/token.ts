import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/templates/HLPMMToken/ERC20";
import { Token, User, UserTokenBalance } from "../generated/schema";
import { convertToDecimal, getOrCreateUser, ZERO_BD, ONE_BI } from "./helpers";

export function handleTokenTransfer(event: Transfer): void {
  let token = Token.load(event.address.toHexString());
  if (!token) return;
  
  let amount = convertToDecimal(event.params.value, 18);
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  
  // Update transfer count
  token.transferCount = token.transferCount.plus(ONE_BI);
  
  // Handle sender balance (not mint)
  if (fromAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
    let fromUser = getOrCreateUser(fromAddress, event.block.timestamp);
    let fromBalanceId = fromUser.id + "-" + token.id;
    let fromBalance = UserTokenBalance.load(fromBalanceId);
    
    if (fromBalance) {
      fromBalance.balance = fromBalance.balance.minus(amount);
      fromBalance.updatedAt = event.block.timestamp;
      fromBalance.save();
      
      // Decrease holder count if balance goes to zero
      if (fromBalance.balance.equals(ZERO_BD)) {
        token.holderCount = token.holderCount.minus(ONE_BI);
      }
    }
  }
  
  // Handle receiver balance (not burn)
  if (toAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
    let toUser = getOrCreateUser(toAddress, event.block.timestamp);
    let toBalanceId = toUser.id + "-" + token.id;
    let toBalance = UserTokenBalance.load(toBalanceId);
    
    if (!toBalance) {
      toBalance = new UserTokenBalance(toBalanceId);
      toBalance.user = toUser.id;
      toBalance.token = token.id;
      toBalance.balance = ZERO_BD;
      
      // Increase holder count for new holder
      token.holderCount = token.holderCount.plus(ONE_BI);
    }
    
    // Check if was zero before (new holder)
    let wasZero = toBalance.balance.equals(ZERO_BD);
    
    toBalance.balance = toBalance.balance.plus(amount);
    toBalance.updatedAt = event.block.timestamp;
    toBalance.save();
    
    // If was zero and now has balance, already counted above
  }
  
  token.save();
}
