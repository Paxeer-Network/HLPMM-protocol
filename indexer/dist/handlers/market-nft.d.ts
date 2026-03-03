import { ethers } from "ethers";
export declare function handleNFTTransfer(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
export declare function handleNFTFeeStrategyUpdated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
export declare function handleNFTFeesClaimed(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
//# sourceMappingURL=market-nft.d.ts.map