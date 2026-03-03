// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IHLPMMFactoryV2 {
    enum FeeStrategy { CLAIM, BURN, AIRDROP, LP_REWARDS }

    event MarketCreated(address indexed pool, address indexed token, uint256 indexed nftId, address creator);

    function tokenToPool(address token) external view returns (address);
    function nftToPool(uint256 nftId) external view returns (address);
    function poolToToken(address pool) external view returns (address);

    function createMarket(
        string memory name,
        string memory symbol,
        string memory metadata,
        FeeStrategy initialStrategy
    ) external returns (address pool, address token, uint256 nftId);

    function getPool(address token) external view returns (address);
    function computeTokenAddress(
        string memory name, string memory symbol, address creator, uint256 nonce
    ) external view returns (address);
    function getAllPools() external view returns (address[] memory);
    function getPoolCount() external view returns (uint256);
}
