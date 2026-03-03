import { ethers } from "ethers";
/**
 * Factory fallback: if EventEmitter misses MarketCreated, create Market here.
 */
export declare function handleFactoryMarketCreated(log: ethers.LogDescription, blockNumber: number, timestamp: number, txHash: string, logIndex: number): Promise<void>;
//# sourceMappingURL=factory.d.ts.map