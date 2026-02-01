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

interface IHLPMMToken is IERC20 {
    function pool() external view returns (address);
    function initialize(string memory name_, string memory symbol_, address pool_) external;
}
