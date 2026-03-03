// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IHLPMMRouterV2 {
    function factory() external view returns (address);
    function stablecoinRegistry() external view returns (address);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address tokenOut,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function swapExactTokensForTokensMultiHop(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function swapExactStableForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address stablecoin,
        address tokenOut,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function swapExactTokensForStable(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut, address stablecoinOut);
}
