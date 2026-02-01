// SPDX-License-Identifier: GPL-3.0
// Copyright (C) 2026 PaxLabs Inc. GNU General Public License v3.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
pragma solidity ^0.8.20;

import "./IMarketNFT.sol";

interface IHLPMMFactory {
    event MarketCreated(
        address indexed pool,
        address indexed token,
        uint256 indexed nftId,
        address creator
    );

    function usid() external view returns (address);
    function eventEmitter() external view returns (address);
    function marketNFT() external view returns (address);
    function feeCollector() external view returns (address);

    function marketCount() external view returns (uint256);
    function tokenToPool(address token) external view returns (address);
    function nftToPool(uint256 nftId) external view returns (address);
    function poolToToken(address pool) external view returns (address);
    function allPools(uint256 index) external view returns (address);

    function createMarket(
        string memory name,
        string memory symbol,
        FeeStrategy initialStrategy
    ) external returns (address pool, address token, uint256 nftId);

    function getPool(address token) external view returns (address);
    function computeTokenAddress(
        string memory name,
        string memory symbol,
        address creator,
        uint256 nonce
    ) external view returns (address);
}
