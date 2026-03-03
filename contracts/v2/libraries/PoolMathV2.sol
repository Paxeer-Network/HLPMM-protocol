// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/// @title PoolMathV2 - AMM math with virtual reserve support
/// @notice Constant product (x * y = k) calculations aware of virtual + real reserves
library PoolMathV2 {
    uint256 internal constant PRECISION = 1e18;
    uint256 internal constant BASIS_POINTS = 10_000;

    /// @notice Calculate output amount for a constant product swap
    /// @param amountIn Input amount (after fees)
    /// @param reserveIn Input reserve (effective = virtual + real for USD side)
    /// @param reserveOut Output reserve
    /// @return amountOut Output amount
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "PoolMathV2: INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "PoolMathV2: INSUFFICIENT_LIQUIDITY");

        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        amountOut = numerator / denominator;
    }

    /// @notice Calculate input amount needed for a desired output
    /// @param amountOut Desired output amount
    /// @param reserveIn Input reserve
    /// @param reserveOut Output reserve
    /// @return amountIn Required input amount
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "PoolMathV2: INSUFFICIENT_OUTPUT");
        require(reserveIn > 0 && reserveOut > amountOut, "PoolMathV2: INSUFFICIENT_LIQUIDITY");

        uint256 numerator = reserveIn * amountOut;
        uint256 denominator = reserveOut - amountOut;
        amountIn = (numerator / denominator) + 1;
    }

    /// @notice Get spot price of token in USD terms (18 decimals)
    /// @param effectiveReserveUSD Virtual + real USD reserve
    /// @param reserveToken Token reserve
    /// @return price Price per token in USD (18 decimals)
    function getSpotPrice(
        uint256 effectiveReserveUSD,
        uint256 reserveToken
    ) internal pure returns (uint256 price) {
        if (reserveToken == 0) return 0;
        price = (effectiveReserveUSD * PRECISION) / reserveToken;
    }

    /// @notice Get fully diluted market cap in USD
    /// @param effectiveReserveUSD Virtual + real USD reserve
    /// @param reserveToken Token reserve in pool
    /// @param totalSupply Total token supply
    /// @return marketCap Market cap in USD (18 decimals)
    function getMarketCap(
        uint256 effectiveReserveUSD,
        uint256 reserveToken,
        uint256 totalSupply
    ) internal pure returns (uint256 marketCap) {
        if (reserveToken == 0) return 0;
        uint256 price = getSpotPrice(effectiveReserveUSD, reserveToken);
        marketCap = (price * totalSupply) / PRECISION;
    }

    /// @notice Calculate price impact of a swap in basis points
    /// @param amountIn Input amount
    /// @param reserveIn Input reserve
    /// @return impact Price impact in basis points (100 = 1%)
    function calculatePriceImpact(
        uint256 amountIn,
        uint256 reserveIn
    ) internal pure returns (uint256 impact) {
        if (reserveIn == 0) return BASIS_POINTS;
        impact = (amountIn * BASIS_POINTS) / (reserveIn + amountIn);
    }

    /// @notice Check if a sell would breach the virtual reserve floor
    /// @dev When selling tokens for USD, output can't exceed realReserveUSD
    /// @param amountOut Desired USD output
    /// @param realReserveUSD Actual stablecoin held by pool
    /// @return allowed Whether the trade is within real liquidity bounds
    function isWithinRealLiquidity(
        uint256 amountOut,
        uint256 realReserveUSD
    ) internal pure returns (bool allowed) {
        allowed = amountOut <= realReserveUSD;
    }
}
