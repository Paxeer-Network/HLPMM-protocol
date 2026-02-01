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

interface IHLPMMPool {
    event Sync(uint256 reserveUSID, uint256 reserveToken);

    function token() external view returns (address);
    function usid() external view returns (address);
    function nftId() external view returns (uint256);
    function factory() external view returns (address);
    function createdAt() external view returns (uint32);

    function reserveUSID() external view returns (uint256);
    function reserveToken() external view returns (uint256);
    function kLast() external view returns (uint256);
    function cumulativeFees() external view returns (uint256);

    function getReserves() external view returns (uint256 _reserveUSID, uint256 _reserveToken);
    
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external returns (uint256 amountOut);

    function claimFees(address recipient) external returns (uint256 amount);
    
    function sync() external;
}
