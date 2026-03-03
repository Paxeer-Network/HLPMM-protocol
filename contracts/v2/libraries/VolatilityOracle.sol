// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/// @title VolatilityOracle - EMA-based rolling volatility tracker
/// @notice Tracks price changes and computes an exponential moving average of volatility
/// @dev Volatility is expressed in basis points (500 = 5% price movement)
library VolatilityOracle {
    struct State {
        uint256 lastPrice;           // Last recorded price (18 decimals)
        uint256 emaVolatility;       // EMA of absolute price changes in bps
        uint32 lastUpdateTime;       // Timestamp of last update
        uint32 observationCount;     // Number of observations recorded
    }

    uint256 internal constant BASIS_POINTS = 10_000;
    uint256 internal constant EMA_ALPHA = 2000;      // 20% weight on new observation (in bps)
    uint256 internal constant MIN_UPDATE_INTERVAL = 30; // Minimum seconds between updates

    /// @notice Initialize the volatility oracle state
    /// @param self The oracle state to initialize
    /// @param initialPrice The starting price
    function initialize(State storage self, uint256 initialPrice) internal {
        self.lastPrice = initialPrice;
        self.emaVolatility = 0;
        self.lastUpdateTime = uint32(block.timestamp);
        self.observationCount = 0;
    }

    /// @notice Record a new price observation and update volatility EMA
    /// @param self The oracle state
    /// @param currentPrice The current spot price
    /// @return volatility The updated EMA volatility in basis points
    function update(
        State storage self,
        uint256 currentPrice
    ) internal returns (uint256 volatility) {
        if (currentPrice == 0 || self.lastPrice == 0) {
            return self.emaVolatility;
        }

        uint32 elapsed = uint32(block.timestamp) - self.lastUpdateTime;
        if (elapsed < MIN_UPDATE_INTERVAL) {
            return self.emaVolatility;
        }

        // Calculate absolute price change in basis points
        uint256 priceDiff = currentPrice > self.lastPrice
            ? currentPrice - self.lastPrice
            : self.lastPrice - currentPrice;
        uint256 changeBps = (priceDiff * BASIS_POINTS) / self.lastPrice;

        // Update EMA: new_ema = alpha * observation + (1 - alpha) * old_ema
        if (self.observationCount == 0) {
            self.emaVolatility = changeBps;
        } else {
            self.emaVolatility =
                (EMA_ALPHA * changeBps + (BASIS_POINTS - EMA_ALPHA) * self.emaVolatility) /
                BASIS_POINTS;
        }

        self.lastPrice = currentPrice;
        self.lastUpdateTime = uint32(block.timestamp);
        self.observationCount++;

        volatility = self.emaVolatility;
    }

    /// @notice Get current volatility without updating state
    /// @param self The oracle state
    /// @return volatility Current EMA volatility in basis points
    function getVolatility(State storage self) internal view returns (uint256 volatility) {
        volatility = self.emaVolatility;
    }
}
