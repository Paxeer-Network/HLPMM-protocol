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

interface IEventEmitter {
    event MarketCreated(
        address indexed pool,
        address indexed token,
        uint256 indexed nftId,
        address creator,
        string name,
        string symbol,
        uint256 timestamp
    );

    event Swap(
        address indexed pool,
        address indexed sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 newReserveUSID,
        uint256 newReserveToken,
        uint256 feeAmount,
        uint256 timestamp
    );

    event FeeClaimed(
        address indexed pool,
        uint256 indexed nftId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    event FeeStrategyUpdated(
        uint256 indexed nftId,
        FeeStrategy newStrategy,
        uint256 timestamp
    );

    function factory() external view returns (address);
    function isAuthorizedEmitter(address emitter) external view returns (bool);

    function authorizeEmitter(address emitter) external;
    function revokeEmitter(address emitter) external;

    function emitMarketCreated(
        address pool,
        address token,
        uint256 nftId,
        address creator,
        string memory name,
        string memory symbol
    ) external;

    function emitSwap(
        address pool,
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 newReserveUSID,
        uint256 newReserveToken,
        uint256 feeAmount
    ) external;

    function emitFeeClaimed(
        address pool,
        uint256 nftId,
        address recipient,
        uint256 amount
    ) external;

    function emitFeeStrategyUpdated(
        uint256 nftId,
        FeeStrategy newStrategy
    ) external;
}
