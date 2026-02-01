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

interface IHLPMMRouter {
    function factory() external view returns (address);
    function usid() external view returns (address);

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

    function swapExactUSIDForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenOut,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function swapExactTokensForUSID(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}
