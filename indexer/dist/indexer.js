"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = getProvider;
exports.startIndexer = startIndexer;
exports.stopIndexer = stopIndexer;
const ethers_1 = require("ethers");
const db_1 = require("./db");
const config_1 = require("./config");
const abis_1 = require("./abis");
const event_emitter_1 = require("./handlers/event-emitter");
const factory_1 = require("./handlers/factory");
const market_nft_1 = require("./handlers/market-nft");
const pool_1 = require("./handlers/pool");
const token_1 = require("./handlers/token");
const usid_1 = require("./handlers/usid");
// ─── Interfaces for parsed contract events ───────────────────
const eventEmitterIface = new ethers_1.ethers.Interface(abis_1.EventEmitterABI);
const factoryIface = new ethers_1.ethers.Interface(abis_1.HLPMMFactoryABI);
const marketNFTIface = new ethers_1.ethers.Interface(abis_1.MarketNFTABI);
const poolIface = new ethers_1.ethers.Interface(abis_1.HLPMMPoolABI);
const erc20Iface = new ethers_1.ethers.Interface(abis_1.ERC20ABI);
// ─── Topic hashes for filtering ──────────────────────────────
const TOPICS = {
    // EventEmitter
    emitterMarketCreated: eventEmitterIface.getEvent("MarketCreated").topicHash,
    emitterSwap: eventEmitterIface.getEvent("Swap").topicHash,
    emitterFeeClaimed: eventEmitterIface.getEvent("FeeClaimed").topicHash,
    emitterFeeStrategyUpdated: eventEmitterIface.getEvent("FeeStrategyUpdated").topicHash,
    // Factory
    factoryMarketCreated: factoryIface.getEvent("MarketCreated").topicHash,
    // MarketNFT
    nftTransfer: marketNFTIface.getEvent("Transfer").topicHash,
    nftFeeStrategyUpdated: marketNFTIface.getEvent("FeeStrategyUpdated").topicHash,
    nftFeesClaimed: marketNFTIface.getEvent("FeesClaimed").topicHash,
    // Pool
    poolSync: poolIface.getEvent("Sync").topicHash,
    // ERC20
    erc20Transfer: erc20Iface.getEvent("Transfer").topicHash,
};
let provider;
let isRunning = false;
function getProvider() {
    if (!provider) {
        provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpcUrl);
    }
    return provider;
}
/** Load dynamically tracked pools and tokens from DB */
async function getTrackedAddresses() {
    const db = (0, db_1.getPool)();
    const poolsRes = await db.query("SELECT address FROM tracked_pool");
    const tokensRes = await db.query("SELECT address FROM tracked_token");
    return {
        pools: new Set(poolsRes.rows.map((r) => r.address.toLowerCase())),
        tokens: new Set(tokensRes.rows.map((r) => r.address.toLowerCase())),
    };
}
/** Fetch block timestamps for a range of blocks (batch via Promise.all) */
const blockTimestampCache = new Map();
async function getBlockTimestamp(blockNum) {
    if (blockTimestampCache.has(blockNum))
        return blockTimestampCache.get(blockNum);
    const p = getProvider();
    const block = await p.getBlock(blockNum);
    const ts = block?.timestamp ?? 0;
    blockTimestampCache.set(blockNum, ts);
    // Keep cache bounded
    if (blockTimestampCache.size > 10000) {
        const first = blockTimestampCache.keys().next().value;
        if (first !== undefined)
            blockTimestampCache.delete(first);
    }
    return ts;
}
/** Process a single log entry, dispatching to the correct handler */
async function processLog(log, timestamp, tracked) {
    const addr = log.address.toLowerCase();
    const topic0 = log.topics[0];
    const txHash = log.transactionHash;
    const blockNumber = log.blockNumber;
    const logIndex = log.index;
    try {
        // ── EventEmitter ──
        if (addr === config_1.config.contracts.eventEmitter.toLowerCase()) {
            if (topic0 === TOPICS.emitterMarketCreated) {
                const parsed = eventEmitterIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, event_emitter_1.handleMarketCreated)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            else if (topic0 === TOPICS.emitterSwap) {
                const parsed = eventEmitterIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, event_emitter_1.handleSwap)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            else if (topic0 === TOPICS.emitterFeeClaimed) {
                const parsed = eventEmitterIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, event_emitter_1.handleFeeClaimed)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            else if (topic0 === TOPICS.emitterFeeStrategyUpdated) {
                const parsed = eventEmitterIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, event_emitter_1.handleFeeStrategyUpdated)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            return;
        }
        // ── Factory ──
        if (addr === config_1.config.contracts.factory.toLowerCase()) {
            if (topic0 === TOPICS.factoryMarketCreated) {
                const parsed = factoryIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, factory_1.handleFactoryMarketCreated)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            return;
        }
        // ── MarketNFT ──
        if (addr === config_1.config.contracts.marketNFT.toLowerCase()) {
            if (topic0 === TOPICS.nftTransfer) {
                const parsed = marketNFTIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, market_nft_1.handleNFTTransfer)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            else if (topic0 === TOPICS.nftFeeStrategyUpdated) {
                const parsed = marketNFTIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, market_nft_1.handleNFTFeeStrategyUpdated)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            else if (topic0 === TOPICS.nftFeesClaimed) {
                const parsed = marketNFTIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, market_nft_1.handleNFTFeesClaimed)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            return;
        }
        // ── USID token ──
        if (addr === config_1.config.contracts.usid.toLowerCase()) {
            if (topic0 === TOPICS.erc20Transfer) {
                const parsed = erc20Iface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, usid_1.handleUSIDTransfer)(parsed, blockNumber, timestamp, txHash, logIndex);
            }
            return;
        }
        // ── Dynamic pools (Sync) ──
        if (tracked.pools.has(addr)) {
            if (topic0 === TOPICS.poolSync) {
                const parsed = poolIface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, pool_1.handleSync)(parsed, blockNumber, timestamp, txHash, logIndex, addr);
            }
            return;
        }
        // ── Dynamic tokens (ERC20 Transfer) ──
        if (tracked.tokens.has(addr)) {
            if (topic0 === TOPICS.erc20Transfer) {
                const parsed = erc20Iface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed)
                    await (0, token_1.handleTokenTransfer)(parsed, blockNumber, timestamp, txHash, logIndex, addr);
            }
            return;
        }
    }
    catch (err) {
        console.error(`[indexer] Error processing log ${txHash}:${logIndex} at block ${blockNumber}:`, err);
    }
}
/** Collect all topic0 hashes we care about */
const ALL_TOPICS0 = [
    TOPICS.emitterMarketCreated,
    TOPICS.emitterSwap,
    TOPICS.emitterFeeClaimed,
    TOPICS.emitterFeeStrategyUpdated,
    TOPICS.factoryMarketCreated,
    TOPICS.nftTransfer,
    TOPICS.nftFeeStrategyUpdated,
    TOPICS.nftFeesClaimed,
    TOPICS.poolSync,
    TOPICS.erc20Transfer,
];
/** Build full address list from static + tracked */
function buildAddressList(tracked) {
    return [
        config_1.config.contracts.eventEmitter.toLowerCase(),
        config_1.config.contracts.factory.toLowerCase(),
        config_1.config.contracts.marketNFT.toLowerCase(),
        config_1.config.contracts.usid.toLowerCase(),
        ...tracked.pools,
        ...tracked.tokens,
    ];
}
/** Fetch logs for a block range with automatic binary-split on oversized responses */
async function fetchLogsRange(from, to, addresses) {
    const p = getProvider();
    try {
        return await p.getLogs({
            address: addresses,
            topics: [ALL_TOPICS0],
            fromBlock: from,
            toBlock: to,
        });
    }
    catch (err) {
        const msg = err?.error?.message ?? err?.message ?? "";
        // If range returns too many results or exceeds limit, split in half
        if (msg.includes("query returned more than") ||
            msg.includes("Log response size exceeded") ||
            msg.includes("too many") ||
            err?.code === -32005) {
            if (from === to) {
                // Single block with too many logs — fetch without address filter as last resort
                console.warn(`[indexer] Block ${from} has too many matching logs, fetching unfiltered`);
                const allLogs = await p.getLogs({ fromBlock: from, toBlock: from });
                const addrSet = new Set(addresses);
                const topicSet = new Set(ALL_TOPICS0);
                return allLogs.filter(l => addrSet.has(l.address.toLowerCase()) && topicSet.has(l.topics[0]));
            }
            const mid = Math.floor((from + to) / 2);
            const [left, right] = await Promise.all([
                fetchLogsRange(from, mid, addresses),
                fetchLogsRange(mid + 1, to, addresses),
            ]);
            return [...left, ...right];
        }
        // For any other error, retry once
        await sleep(300);
        return await p.getLogs({
            address: addresses,
            topics: [ALL_TOPICS0],
            fromBlock: from,
            toBlock: to,
        });
    }
}
// ─── Main indexing loop ──────────────────────────────────────
async function startIndexer() {
    if (isRunning)
        return;
    isRunning = true;
    const p = getProvider();
    console.log("[indexer] Starting indexer...");
    console.log(`[indexer] RPC: ${config_1.config.rpcUrl}`);
    console.log(`[indexer] Batch size: ${config_1.config.batchSize} blocks, concurrency: ${config_1.config.concurrency}`);
    while (isRunning) {
        try {
            const lastBlock = await (0, db_1.getLastIndexedBlock)();
            const currentBlock = await p.getBlockNumber();
            const fromBlock = lastBlock + 1;
            if (fromBlock > currentBlock) {
                await sleep(2000);
                continue;
            }
            const toBlock = Math.min(fromBlock + config_1.config.batchSize - 1, currentBlock);
            const totalRange = currentBlock - config_1.config.startBlock;
            const done = fromBlock - config_1.config.startBlock;
            const pct = totalRange > 0 ? ((done / totalRange) * 100).toFixed(1) : "100.0";
            const count = toBlock - fromBlock + 1;
            const t0 = Date.now();
            const tracked = await getTrackedAddresses();
            const addresses = buildAddressList(tracked);
            // Fetch logs for the entire range in one call (auto-splits if needed)
            const logs = await fetchLogsRange(fromBlock, toBlock, addresses);
            // Batch-fetch block timestamps for all blocks that have logs
            if (logs.length > 0) {
                const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
                await Promise.all(uniqueBlocks.map(b => getBlockTimestamp(b)));
            }
            // Process logs sequentially in order (state consistency)
            let eventCount = 0;
            let currentTracked = tracked;
            for (const log of logs) {
                const ts = await getBlockTimestamp(log.blockNumber);
                await processLog(log, ts, currentTracked);
                eventCount++;
                // If this was a MarketCreated event, refresh tracked addresses
                const topic0 = log.topics[0];
                if (topic0 === TOPICS.emitterMarketCreated || topic0 === TOPICS.factoryMarketCreated) {
                    currentTracked = await getTrackedAddresses();
                }
            }
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            const bps = (count / parseFloat(elapsed || "1")).toFixed(0);
            console.log(`[indexer] Blocks ${fromBlock}–${toBlock} (${count} blks, ${eventCount} events, ${elapsed}s, ~${bps} blks/s, ${pct}% synced)`);
            await (0, db_1.setLastIndexedBlock)(toBlock);
        }
        catch (err) {
            console.error("[indexer] Error in indexing loop:", err);
            await sleep(5000);
        }
    }
}
function stopIndexer() {
    isRunning = false;
    console.log("[indexer] Stopping indexer...");
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=indexer.js.map