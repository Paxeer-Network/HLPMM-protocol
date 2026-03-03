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

import "./IERC721.sol";

enum FeeStrategy {
    CLAIM,      // 0 - direct claim to wallet
    BURN,       // 1 - burn USID
    AIRDROP,    // 2 - accumulate for community airdrop
    LP_REWARDS  // 3 - redistribute to pool liquidity
}

interface IMarketNFT is IERC721 {
    event FeeStrategyUpdated(uint256 indexed tokenId, FeeStrategy newStrategy);
    event FeesClaimed(uint256 indexed tokenId, address indexed recipient, uint256 amount);

    function factory() external view returns (address);
    function feeCollector() external view returns (address);
    
    function nftToPool(uint256 tokenId) external view returns (address);
    function feeStrategy(uint256 tokenId) external view returns (FeeStrategy);
    function totalMinted() external view returns (uint256);

    function mint(address to, address pool, FeeStrategy initialStrategy) external returns (uint256 tokenId);
    function setFeeStrategy(uint256 tokenId, FeeStrategy strategy) external;
    function claimFees(uint256 tokenId) external returns (uint256 amount);
    function setFeeCollector(address feeCollector_) external;
    function setEventEmitter(address eventEmitter_) external;
}
