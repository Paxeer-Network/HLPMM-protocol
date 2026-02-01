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

import "./IERC20.sol";

interface IUSID is IERC20 {
    event Deposit(address indexed from, uint256 paxAmount, uint256 usidAmount);
    event Withdraw(address indexed to, uint256 usidAmount, uint256 paxAmount);
    event OracleSet(address indexed oracle);

    function factory() external view returns (address);
    function oracle() external view returns (address);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function setOracle(address oracle_) external;
}
