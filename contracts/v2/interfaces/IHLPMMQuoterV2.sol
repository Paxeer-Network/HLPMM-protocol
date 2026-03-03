// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IHLPMMQuoterV2 {
    struct PoolInfo {
        uint256 virtualReserveUSD;
        uint256 realReserveUSD;
        uint256 effectiveReserveUSD;
        uint256 reserveToken;
        uint256 spotPrice;
        uint256 marketCap;
        uint256 volatility;
        uint32 poolAge;
    }

    function factory() external view returns (address);

    function quoteExactInput(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256 amountOut, uint256 priceImpact);

    function quoteStableToToken(
        uint256 amountIn,
        address token
    ) external view returns (uint256 amountOut, uint256 priceImpact);

    function quoteTokenToStable(
        uint256 amountIn,
        address token
    ) external view returns (uint256 amountOut, uint256 priceImpact);

    function getPoolInfo(address token) external view returns (PoolInfo memory);
}
