// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../libraries/Math.sol";

contract MathTest {
    using Math for uint256;

    function min(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.min(a, b);
    }

    function max(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.max(a, b);
    }

    function diff(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.diff(a, b);
    }

    function sqrt(uint256 x) external pure returns (uint256) {
        return Math.sqrt(x);
    }

    function mulDiv(uint256 a, uint256 b, uint256 denominator) external pure returns (uint256) {
        return Math.mulDiv(a, b, denominator);
    }

    function mulDivRoundingUp(uint256 a, uint256 b, uint256 denominator) external pure returns (uint256) {
        return Math.mulDivRoundingUp(a, b, denominator);
    }

    function ceilDiv(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.ceilDiv(a, b);
    }

    function clamp(uint256 value, uint256 minVal, uint256 maxVal) external pure returns (uint256) {
        return Math.clamp(value, minVal, maxVal);
    }
}
