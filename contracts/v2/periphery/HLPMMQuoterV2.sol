// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IHLPMMQuoterV2.sol";
import "../interfaces/IHLPMMFactoryV2.sol";
import "../interfaces/IHLPMMPoolV2.sol";
import "../interfaces/IHLPMMTokenV2.sol";
import "../libraries/PoolMathV2.sol";
import "../libraries/FeeCalculatorV2.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
}

/// @title HLPMMQuoterV2 - View-only swap simulation and pool introspection
/// @notice Gas-free quote functions for UI integration and algorithmic trading.
///         Aware of virtual reserves and multi-stable pools.
contract HLPMMQuoterV2 is IHLPMMQuoterV2 {
    error PoolNotFound();

    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    /// @notice Quote a token-to-token swap (multi-hop through USD)
    /// @param amountIn Input amount
    /// @param tokenIn Source token (could be a stablecoin or market token)
    /// @param tokenOut Destination token
    /// @return amountOut Expected output
    /// @return priceImpact Price impact in basis points
    function quoteExactInput(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256 amountOut, uint256 priceImpact) {
        // If tokenIn is a market token, first leg: tokenIn → USD
        address poolIn = IHLPMMFactoryV2(factory).tokenToPool(tokenIn);
        address poolOut = IHLPMMFactoryV2(factory).tokenToPool(tokenOut);

        if (poolIn != address(0) && poolOut != address(0)) {
            // Token → Token (multi-hop): tokenIn → USD → tokenOut
            (uint256 usdAmount, uint256 impact1) = _quoteTokenToUSD(poolIn, amountIn);
            (amountOut, priceImpact) = _quoteUSDToToken(poolOut, usdAmount);
            // Combine price impacts (approximate)
            priceImpact = impact1 + priceImpact;
        } else if (poolIn != address(0)) {
            // Token → Stable
            (amountOut, priceImpact) = _quoteTokenToUSD(poolIn, amountIn);
        } else if (poolOut != address(0)) {
            // Stable → Token
            (amountOut, priceImpact) = _quoteUSDToToken(poolOut, amountIn);
        } else {
            revert PoolNotFound();
        }
    }

    /// @notice Quote a stablecoin-to-token swap
    function quoteStableToToken(
        uint256 amountIn,
        address token
    ) external view returns (uint256 amountOut, uint256 priceImpact) {
        address pool = IHLPMMFactoryV2(factory).tokenToPool(token);
        if (pool == address(0)) revert PoolNotFound();
        (amountOut, priceImpact) = _quoteUSDToToken(pool, amountIn);
    }

    /// @notice Quote a token-to-stablecoin swap
    function quoteTokenToStable(
        uint256 amountIn,
        address token
    ) external view returns (uint256 amountOut, uint256 priceImpact) {
        address pool = IHLPMMFactoryV2(factory).tokenToPool(token);
        if (pool == address(0)) revert PoolNotFound();
        (amountOut, priceImpact) = _quoteTokenToUSD(pool, amountIn);
    }

    /// @notice Get comprehensive pool information
    function getPoolInfo(address token) external view returns (PoolInfo memory info) {
        address pool = IHLPMMFactoryV2(factory).tokenToPool(token);
        if (pool == address(0)) revert PoolNotFound();

        IHLPMMPoolV2 p = IHLPMMPoolV2(pool);

        info.virtualReserveUSD = p.virtualReserveUSD();
        info.realReserveUSD = p.realReserveUSD();
        info.effectiveReserveUSD = p.getEffectiveReserveUSD();
        info.reserveToken = p.reserveToken();
        info.spotPrice = p.getSpotPrice();
        info.marketCap = p.getMarketCap();
        info.volatility = p.getVolatility();
        info.poolAge = uint32(block.timestamp) - p.createdAt();
    }

    // ─── Internal quote helpers ──────────────────────────────────────────

    function _quoteUSDToToken(
        address pool,
        uint256 usdAmountIn
    ) internal view returns (uint256 amountOut, uint256 priceImpact) {
        IHLPMMPoolV2 p = IHLPMMPoolV2(pool);

        uint256 effectiveUSD = p.getEffectiveReserveUSD();
        uint256 tokenReserve = p.reserveToken();

        // Calculate fee
        uint32 poolAge = uint32(block.timestamp) - p.createdAt();
        uint256 volatility = p.getVolatility();

        (uint256 feeAmount, ) = FeeCalculatorV2.calculateFee(
            usdAmountIn, poolAge, volatility, 500 // approximate concentration for quote
        );

        uint256 amountInAfterFee = usdAmountIn - feeAmount;
        amountOut = PoolMathV2.getAmountOut(amountInAfterFee, effectiveUSD, tokenReserve);
        priceImpact = PoolMathV2.calculatePriceImpact(amountInAfterFee, effectiveUSD);
    }

    function _quoteTokenToUSD(
        address pool,
        uint256 tokenAmountIn
    ) internal view returns (uint256 amountOut, uint256 priceImpact) {
        IHLPMMPoolV2 p = IHLPMMPoolV2(pool);

        uint256 effectiveUSD = p.getEffectiveReserveUSD();
        uint256 tokenReserve = p.reserveToken();

        // Calculate fee
        uint32 poolAge = uint32(block.timestamp) - p.createdAt();
        uint256 volatility = p.getVolatility();

        (uint256 feeAmount, ) = FeeCalculatorV2.calculateFee(
            tokenAmountIn, poolAge, volatility, 500
        );

        uint256 amountInAfterFee = tokenAmountIn - feeAmount;
        amountOut = PoolMathV2.getAmountOut(amountInAfterFee, tokenReserve, effectiveUSD);
        priceImpact = PoolMathV2.calculatePriceImpact(amountInAfterFee, tokenReserve);

        // Check against real liquidity
        uint256 realUSD = p.realReserveUSD();
        if (amountOut > realUSD) {
            amountOut = realUSD; // Cap at available real stables
        }
    }
}
