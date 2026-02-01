// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../libraries/PoolMath.sol";

contract PoolMathTest {
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256) {
        return PoolMath.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountOutWithFee(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) external pure returns (uint256 amountOut, uint256 feeAmount) {
        return PoolMath.getAmountOutWithFee(amountIn, reserveIn, reserveOut, feeBps);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256) {
        return PoolMath.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountInWithFee(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 feeBps
    ) external pure returns (uint256 amountIn, uint256 feeAmount) {
        return PoolMath.getAmountInWithFee(amountOut, reserveIn, reserveOut, feeBps);
    }

    function calculatePriceImpact(
        uint256 amountIn,
        uint256 reserveIn
    ) external pure returns (uint256) {
        return PoolMath.calculatePriceImpact(amountIn, reserveIn);
    }

    function getSpotPrice(
        uint256 reserveUSID,
        uint256 reserveToken
    ) external pure returns (uint256) {
        return PoolMath.getSpotPrice(reserveUSID, reserveToken);
    }

    function getMarketCap(
        uint256 reserveUSID,
        uint256 reserveToken,
        uint256 totalTokenSupply
    ) external pure returns (uint256) {
        return PoolMath.getMarketCap(reserveUSID, reserveToken, totalTokenSupply);
    }

    function getK(uint256 reserveUSID, uint256 reserveToken) external pure returns (uint256) {
        return PoolMath.getK(reserveUSID, reserveToken);
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256) {
        return PoolMath.quote(amountA, reserveA, reserveB);
    }
}
