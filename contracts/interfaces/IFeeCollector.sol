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

interface IFeeCollector {
    event FeeAccumulated(uint256 indexed nftId, uint256 amount);
    event FeeDistributed(uint256 indexed nftId, address indexed recipient, uint256 amount, FeeStrategy strategy);

    function factory() external view returns (address);
    function usid() external view returns (address);
    function marketNFT() external view returns (address);

    function accumulatedFees(uint256 nftId) external view returns (uint256);
    function airdropPool(uint256 nftId) external view returns (uint256);

    function accumulateFee(uint256 nftId, uint256 amount) external;
    function distributeFees(uint256 nftId, address recipient, FeeStrategy strategy) external returns (uint256 amount);
    function pendingFees(uint256 nftId) external view returns (uint256);
    function setEventEmitter(address eventEmitter_) external;
    function setMarketNFT(address marketNFT_) external;
}
