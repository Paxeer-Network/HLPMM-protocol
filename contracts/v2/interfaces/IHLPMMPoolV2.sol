// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IHLPMMPoolV2 {
    event Sync(uint256 effectiveReserveUSD, uint256 reserveToken);

    function token() external view returns (address);
    function factory() external view returns (address);
    function feeCollector() external view returns (address);
    function eventEmitter() external view returns (address);
    function marketNFT() external view returns (address);
    function stablecoinRegistry() external view returns (address);
    function nftId() external view returns (uint256);
    function createdAt() external view returns (uint32);

    function virtualReserveUSD() external view returns (uint256);
    function realReserveUSD() external view returns (uint256);
    function reserveToken() external view returns (uint256);

    function getEffectiveReserveUSD() external view returns (uint256);
    function getReserves() external view returns (uint256 effectiveUSD, uint256 tokenReserve);
    function getSpotPrice() external view returns (uint256);
    function getMarketCap() external view returns (uint256);
    function getVolatility() external view returns (uint256);

    function initialize(uint256 virtualUSD, uint256 tokenAmount) external;

    function swap(
        address stablecoinUsed,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external returns (uint256 amountOut, address tokenOut);

    function claimFees(address recipient) external returns (uint256 amount);
    function sync() external;

    function getStableBalance(address stablecoin) external view returns (uint256);
    function getTotalStableBalance() external view returns (uint256);
}
