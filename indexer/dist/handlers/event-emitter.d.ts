import { ethers } from "ethers";
export declare function handleMarketCreated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
export declare function handleSwap(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
export declare function handleFeeClaimed(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
export declare function handleFeeStrategyUpdated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
//# sourceMappingURL=event-emitter.d.ts.map