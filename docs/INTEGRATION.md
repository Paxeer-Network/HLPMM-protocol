# HLPMM Protocol Integration Guide

This guide covers integrating HLPMM protocol into your application, including frontend integration, backend indexing, and smart contract interactions.

## Table of Contents

- [Quick Start](#quick-start)
- [Contract Addresses](#contract-addresses)
- [Frontend Integration](#frontend-integration)
- [Backend Indexing](#backend-indexing)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Gas Optimization](#gas-optimization)

---

## Quick Start

### Install Dependencies

```bash
npm install ethers@6
```

### Initialize Contracts

```javascript
const { ethers } = require("ethers");

const ADDRESSES = {
    factory: "0x9E2952Aa4409cDb4c755891D5214c5239CDa99Fd",
    router: "0x228A1b26Dc4B01EDe1c34A4bbEC1BB624Df5e4f6",
    quoter: "0x7A7F18701bB323F9A36243914B9ea40088957194",
    usid: "0x49345967360A401BF99840DAFC8E51148a5B7897",
    marketNFT: "0x10ea19646D0E2F773426B8bb45e09d2BCc322604",
    feeCollector: "0xFc4C0e7086edA1c147E639D9AeCa29202023c124"
};

const provider = new ethers.JsonRpcProvider("https://rpc.paxeer.app");
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const factory = new ethers.Contract(ADDRESSES.factory, FACTORY_ABI, signer);
const router = new ethers.Contract(ADDRESSES.router, ROUTER_ABI, signer);
const quoter = new ethers.Contract(ADDRESSES.quoter, QUOTER_ABI, provider);
```

---

## Contract Addresses

**Network: Paxeer (Chain ID: 125)**

```javascript
const PAXEER_CONTRACTS = {
    usid: "0x49345967360A401BF99840DAFC8E51148a5B7897",
    eventEmitter: "0xF5e3E9AB378223837c744419fc21420c5B108F67",
    marketNFT: "0x10ea19646D0E2F773426B8bb45e09d2BCc322604",
    feeCollector: "0xFc4C0e7086edA1c147E639D9AeCa29202023c124",
    factory: "0x9E2952Aa4409cDb4c755891D5214c5239CDa99Fd",
    quoter: "0x7A7F18701bB323F9A36243914B9ea40088957194",
    router: "0x228A1b26Dc4B01EDe1c34A4bbEC1BB624Df5e4f6"
};
```

---

## Frontend Integration

### How do I create a new market?

```javascript
async function createMarket(name, symbol, feeStrategy = 0) {
    const tx = await factory.createMarket(name, symbol, feeStrategy);
    const receipt = await tx.wait();
    
    // Parse MarketCreated event
    const eventEmitter = new ethers.Contract(ADDRESSES.eventEmitter, EVENT_EMITTER_ABI, provider);
    const events = receipt.logs
        .map(log => {
            try {
                return eventEmitter.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .filter(e => e && e.name === "MarketCreated");
    
    if (events.length > 0) {
        const { pool, token, nftId, creator, name: tokenName, symbol: tokenSymbol } = events[0].args;
        return { pool, token, nftId, creator, tokenName, tokenSymbol };
    }
    
    throw new Error("MarketCreated event not found");
}

// Usage
const market = await createMarket("Pepe Token", "PEPE", 0);
console.log(`Pool: ${market.pool}`);
console.log(`Token: ${market.token}`);
console.log(`NFT ID: ${market.nftId}`);
```

### How do I get a swap quote?

```javascript
async function getSwapQuote(amountIn, tokenIn, tokenOut) {
    const [amountOut, priceImpactBps] = await quoter.quoteExactInput(
        amountIn,
        tokenIn,
        tokenOut
    );
    
    return {
        amountOut,
        priceImpact: Number(priceImpactBps) / 100, // Convert to percentage
        rate: Number(amountOut) / Number(amountIn)
    };
}

// Usage
const quote = await getSwapQuote(
    ethers.parseEther("1000"),
    tokenAddress,
    ADDRESSES.usid
);
console.log(`Output: ${ethers.formatEther(quote.amountOut)} USID`);
console.log(`Price Impact: ${quote.priceImpact}%`);
```

### How do I execute a swap?

```javascript
async function executeSwap(amountIn, tokenIn, tokenOut, slippageBps = 50) {
    // Get quote first
    const [expectedOut] = await quoter.quoteExactInput(amountIn, tokenIn, tokenOut);
    
    // Calculate minimum output with slippage
    const amountOutMin = expectedOut * (10000n - BigInt(slippageBps)) / 10000n;
    
    // Approve router if needed
    const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const allowance = await token.allowance(signer.address, ADDRESSES.router);
    
    if (allowance < amountIn) {
        const approveTx = await token.approve(ADDRESSES.router, ethers.MaxUint256);
        await approveTx.wait();
    }
    
    // Execute swap
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes
    
    const tx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        tokenIn,
        tokenOut,
        signer.address,
        deadline
    );
    
    const receipt = await tx.wait();
    return receipt;
}

// Usage
const receipt = await executeSwap(
    ethers.parseEther("100"),
    tokenAddress,
    ADDRESSES.usid,
    100 // 1% slippage
);
```

### How do I get pool information?

```javascript
async function getPoolInfo(tokenAddress) {
    const info = await quoter.getPoolInfo(tokenAddress);
    
    return {
        reserveUSID: ethers.formatEther(info[0]),
        reserveToken: ethers.formatEther(info[1]),
        spotPrice: ethers.formatEther(info[2]),
        marketCap: ethers.formatEther(info[3]),
        poolAge: Number(info[4])
    };
}

// Usage
const pool = await getPoolInfo(tokenAddress);
console.log(`Market Cap: $${pool.marketCap}`);
console.log(`Price: $${pool.spotPrice}`);
```

### How do I list all markets?

```javascript
async function getAllMarkets() {
    const pools = await factory.getAllPools();
    
    const markets = await Promise.all(pools.map(async (poolAddress) => {
        const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
        const token = await pool.token();
        const tokenContract = new ethers.Contract(token, ERC20_ABI, provider);
        
        const [name, symbol, reserves] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            pool.getReserves()
        ]);
        
        return {
            pool: poolAddress,
            token,
            name,
            symbol,
            reserveUSID: reserves[0],
            reserveToken: reserves[1]
        };
    }));
    
    return markets;
}
```

### How do I claim fees from my NFT?

```javascript
async function claimFees(nftId) {
    const marketNFT = new ethers.Contract(ADDRESSES.marketNFT, MARKET_NFT_ABI, signer);
    
    // Check pending fees first
    const feeCollector = new ethers.Contract(ADDRESSES.feeCollector, FEE_COLLECTOR_ABI, provider);
    const pending = await feeCollector.pendingFees(nftId);
    
    if (pending === 0n) {
        console.log("No fees to claim");
        return null;
    }
    
    console.log(`Pending fees: ${ethers.formatEther(pending)} USID`);
    
    const tx = await marketNFT.claimFees(nftId);
    const receipt = await tx.wait();
    
    return receipt;
}
```

### How do I change fee strategy?

```javascript
async function changeFeeStrategy(nftId, strategy) {
    // Strategy: 0=CLAIM, 1=BURN, 2=AIRDROP, 3=LP_REWARDS
    const marketNFT = new ethers.Contract(ADDRESSES.marketNFT, MARKET_NFT_ABI, signer);
    
    const tx = await marketNFT.setFeeStrategy(nftId, strategy);
    await tx.wait();
    
    console.log(`Fee strategy updated to ${["CLAIM", "BURN", "AIRDROP", "LP_REWARDS"][strategy]}`);
}
```

---

## Backend Indexing

### Event Listening

```javascript
const eventEmitter = new ethers.Contract(ADDRESSES.eventEmitter, EVENT_EMITTER_ABI, provider);

// Listen for new markets
eventEmitter.on("MarketCreated", (pool, token, nftId, creator, name, symbol, timestamp) => {
    console.log(`New market created: ${name} (${symbol})`);
    console.log(`  Pool: ${pool}`);
    console.log(`  Token: ${token}`);
    console.log(`  Creator: ${creator}`);
    console.log(`  NFT ID: ${nftId}`);
});

// Listen for swaps
eventEmitter.on("Swap", (pool, sender, tokenIn, tokenOut, amountIn, amountOut, reserveUSID, reserveToken, feeAmount, timestamp) => {
    console.log(`Swap on pool ${pool}`);
    console.log(`  ${ethers.formatEther(amountIn)} ${tokenIn} -> ${ethers.formatEther(amountOut)} ${tokenOut}`);
    console.log(`  Fee: ${ethers.formatEther(feeAmount)} USID`);
});

// Listen for fee claims
eventEmitter.on("FeeClaimed", (pool, nftId, recipient, amount, timestamp) => {
    console.log(`Fees claimed from NFT #${nftId}: ${ethers.formatEther(amount)} USID`);
});
```

### Historical Event Query

```javascript
async function getMarketHistory(fromBlock = 0) {
    const eventEmitter = new ethers.Contract(ADDRESSES.eventEmitter, EVENT_EMITTER_ABI, provider);
    
    const filter = eventEmitter.filters.MarketCreated();
    const events = await eventEmitter.queryFilter(filter, fromBlock, "latest");
    
    return events.map(event => ({
        pool: event.args.pool,
        token: event.args.token,
        nftId: event.args.nftId,
        creator: event.args.creator,
        name: event.args.name,
        symbol: event.args.symbol,
        timestamp: event.args.timestamp,
        blockNumber: event.blockNumber,
        txHash: event.transactionHash
    }));
}
```

### Pool Reserves Tracking

```javascript
async function trackPoolReserves(poolAddress) {
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    
    pool.on("Sync", (reserveUSID, reserveToken) => {
        const price = Number(reserveUSID) / Number(reserveToken);
        console.log(`Pool ${poolAddress} updated:`);
        console.log(`  USID: ${ethers.formatEther(reserveUSID)}`);
        console.log(`  Token: ${ethers.formatEther(reserveToken)}`);
        console.log(`  Price: ${price.toFixed(8)} USID/token`);
    });
}
```

---

## Common Patterns

### Multi-Hop Swap (Token A to Token B)

```javascript
async function swapTokenToToken(amountIn, tokenA, tokenB, slippageBps = 100) {
    // Path: TokenA -> USID -> TokenB
    const path = [tokenA, ADDRESSES.usid, tokenB];
    
    // Get quote
    const expectedOut = await quoter.quoteExactInputMultiHop(amountIn, path);
    const amountOutMin = expectedOut * (10000n - BigInt(slippageBps)) / 10000n;
    
    // Approve
    const tokenContract = new ethers.Contract(tokenA, ERC20_ABI, signer);
    await tokenContract.approve(ADDRESSES.router, amountIn);
    
    // Execute
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const tx = await router.swapExactTokensForTokensMultiHop(
        amountIn,
        amountOutMin,
        path,
        signer.address,
        deadline
    );
    
    return tx.wait();
}
```

### Check NFT Ownership

```javascript
async function getOwnedNFTs(ownerAddress) {
    const marketNFT = new ethers.Contract(ADDRESSES.marketNFT, MARKET_NFT_ABI, provider);
    const totalMinted = await marketNFT.totalMinted();
    
    const ownedNFTs = [];
    
    for (let i = 1; i <= totalMinted; i++) {
        try {
            const owner = await marketNFT.ownerOf(i);
            if (owner.toLowerCase() === ownerAddress.toLowerCase()) {
                const pool = await marketNFT.nftToPool(i);
                const strategy = await marketNFT.feeStrategy(i);
                const pending = await feeCollector.pendingFees(i);
                
                ownedNFTs.push({
                    nftId: i,
                    pool,
                    strategy: ["CLAIM", "BURN", "AIRDROP", "LP_REWARDS"][strategy],
                    pendingFees: ethers.formatEther(pending)
                });
            }
        } catch {
            // Token doesn't exist or burned
        }
    }
    
    return ownedNFTs;
}
```

---

## Error Handling

### Common Error Types

```javascript
async function handleSwapError(error) {
    const errorData = error.data || error.message;
    
    if (errorData.includes("Expired")) {
        return { code: "EXPIRED", message: "Transaction deadline passed" };
    }
    if (errorData.includes("InsufficientOutput")) {
        return { code: "SLIPPAGE", message: "Price moved beyond slippage tolerance" };
    }
    if (errorData.includes("InvalidToken")) {
        return { code: "INVALID_TOKEN", message: "Token not supported in this pool" };
    }
    if (errorData.includes("PoolNotFound")) {
        return { code: "NO_POOL", message: "No pool exists for this token pair" };
    }
    if (errorData.includes("InvalidPath")) {
        return { code: "INVALID_PATH", message: "Swap path is invalid" };
    }
    
    return { code: "UNKNOWN", message: error.message };
}

// Usage
try {
    await executeSwap(amountIn, tokenIn, tokenOut, 50);
} catch (error) {
    const parsed = await handleSwapError(error);
    console.error(`Swap failed: ${parsed.message}`);
}
```

### Retry Logic

```javascript
async function swapWithRetry(amountIn, tokenIn, tokenOut, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Increase slippage on retry
            const slippage = 50 + (i * 50); // 0.5%, 1%, 1.5%
            return await executeSwap(amountIn, tokenIn, tokenOut, slippage);
        } catch (error) {
            const parsed = await handleSwapError(error);
            
            if (parsed.code === "SLIPPAGE" && i < maxRetries - 1) {
                console.log(`Retrying with higher slippage...`);
                continue;
            }
            
            throw error;
        }
    }
}
```

---

## Gas Optimization

### Batch Read Operations

```javascript
// Use multicall for batch reads
async function batchGetPoolInfo(tokenAddresses) {
    const calls = tokenAddresses.map(token => ({
        target: ADDRESSES.quoter,
        callData: quoter.interface.encodeFunctionData("getPoolInfo", [token])
    }));
    
    // If using multicall contract
    const results = await multicall.aggregate(calls);
    
    return results.map((result, i) => {
        const decoded = quoter.interface.decodeFunctionResult("getPoolInfo", result);
        return {
            token: tokenAddresses[i],
            reserveUSID: decoded[0],
            reserveToken: decoded[1],
            spotPrice: decoded[2],
            marketCap: decoded[3],
            poolAge: decoded[4]
        };
    });
}
```

### Approve Once Pattern

```javascript
async function ensureApproval(tokenAddress, spender, amount) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const currentAllowance = await token.allowance(signer.address, spender);
    
    if (currentAllowance >= amount) {
        return; // Already approved
    }
    
    // Approve max to avoid repeated approvals
    const tx = await token.approve(spender, ethers.MaxUint256);
    await tx.wait();
}
```

### Gas Estimation

```javascript
async function estimateSwapGas(amountIn, tokenIn, tokenOut) {
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const [amountOut] = await quoter.quoteExactInput(amountIn, tokenIn, tokenOut);
    const amountOutMin = amountOut * 95n / 100n;
    
    const gasEstimate = await router.swapExactTokensForTokens.estimateGas(
        amountIn,
        amountOutMin,
        tokenIn,
        tokenOut,
        signer.address,
        deadline
    );
    
    const gasPrice = await provider.getFeeData();
    const gasCost = gasEstimate * gasPrice.gasPrice;
    
    return {
        gasLimit: gasEstimate,
        gasPrice: gasPrice.gasPrice,
        totalCost: ethers.formatEther(gasCost)
    };
}
```
