// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IEventEmitterV2 {
    enum FeeStrategy { CLAIM, BURN, AIRDROP, LP_REWARDS }

    // Market lifecycle
    event MarketCreated(
        address indexed pool,
        address indexed token,
        uint256 indexed nftId,
        address creator,
        string name,
        string symbol,
        string metadata,
        uint256 virtualReserveUSD,
        uint256 tokenSupply,
        uint256 timestamp
    );

    // Swap
    event Swap(
        address indexed pool,
        address indexed sender,
        address stablecoinIn,
        address stablecoinOut,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        uint256 newReserveUSD,
        uint256 newReserveToken,
        uint256 timestamp
    );

    // Token transfers (new in V2)
    event TokenTransfer(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // Fee events
    event FeeClaimed(
        address indexed pool,
        uint256 indexed nftId,
        address recipient,
        uint256 amount,
        uint256 timestamp
    );

    event FeeStrategyUpdated(
        uint256 indexed nftId,
        FeeStrategy newStrategy,
        uint256 timestamp
    );

    // Volatility tracking (new in V2)
    event VolatilityUpdated(
        address indexed pool,
        uint256 volatility,
        uint256 timestamp
    );

    function authorizeEmitter(address emitter) external;
    function revokeEmitter(address emitter) external;
    function isAuthorizedEmitter(address emitter) external view returns (bool);

    function emitMarketCreated(
        address pool, address token, uint256 nftId, address creator,
        string memory name, string memory symbol, string memory metadata,
        uint256 virtualReserveUSD, uint256 tokenSupply
    ) external;

    function emitSwap(
        address pool, address sender,
        address stablecoinIn, address stablecoinOut,
        address tokenIn, address tokenOut,
        uint256 amountIn, uint256 amountOut, uint256 feeAmount,
        uint256 newReserveUSD, uint256 newReserveToken
    ) external;

    function emitTokenTransfer(
        address token, address from, address to, uint256 amount
    ) external;

    function emitFeeClaimed(
        address pool, uint256 nftId, address recipient, uint256 amount
    ) external;

    function emitFeeStrategyUpdated(uint256 nftId, FeeStrategy newStrategy) external;

    function emitVolatilityUpdated(address pool, uint256 volatility) external;
}
