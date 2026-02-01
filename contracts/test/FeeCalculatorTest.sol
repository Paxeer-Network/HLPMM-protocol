// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../libraries/FeeCalculator.sol";

contract FeeCalculatorTest {
    function calculateFee(
        uint256 amountIn,
        uint32 poolAge,
        uint256 volatilityBps,
        uint256 topHolderBps
    ) external pure returns (uint256 feeAmount, uint256 effectiveFeeBps) {
        return FeeCalculator.calculateFee(amountIn, poolAge, volatilityBps, topHolderBps);
    }

    function getAgeModifier(uint32 poolAge) external pure returns (int256) {
        return FeeCalculator.getAgeModifier(poolAge);
    }

    function getVolatilityModifier(uint256 volatilityBps) external pure returns (int256) {
        return FeeCalculator.getVolatilityModifier(volatilityBps);
    }

    function getConcentrationModifier(uint256 topHolderBps) external pure returns (int256) {
        return FeeCalculator.getConcentrationModifier(topHolderBps);
    }

    function calculateBaseFee(uint256 amountIn) external pure returns (uint256) {
        return FeeCalculator.calculateBaseFee(amountIn);
    }

    function getEffectiveFee(
        uint32 poolAge,
        uint256 volatilityBps,
        uint256 topHolderBps
    ) external pure returns (uint256) {
        return FeeCalculator.getEffectiveFee(poolAge, volatilityBps, topHolderBps);
    }

    function getConstants() external pure returns (
        uint256 baseFee,
        uint256 maxFee,
        uint256 minFee,
        uint256 feeDenominator
    ) {
        return (
            FeeCalculator.BASE_FEE,
            FeeCalculator.MAX_FEE,
            FeeCalculator.MIN_FEE,
            FeeCalculator.FEE_DENOMINATOR
        );
    }
}
