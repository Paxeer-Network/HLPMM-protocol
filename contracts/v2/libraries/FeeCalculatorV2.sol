// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

/// @title FeeCalculatorV2 - Real dynamic fee engine
/// @notice Multi-factor fee calculation: base + maturity + volatility + concentration
/// @dev All fee values in basis points (1 bp = 0.01%). Bounded [MIN_FEE, MAX_FEE].
library FeeCalculatorV2 {
    uint256 internal constant BASIS_POINTS = 10_000;
    uint256 internal constant BASE_FEE = 30;       // 0.30%
    uint256 internal constant MIN_FEE = 10;        // 0.10%
    uint256 internal constant MAX_FEE = 300;       // 3.00%

    // Maturity: new pools pay premium that decays over MATURITY_PERIOD
    uint256 internal constant MATURITY_MAX_ADDON = 50;       // +0.50% max for brand new pools
    uint256 internal constant MATURITY_PERIOD = 7 days;

    // Volatility: scales linearly from 0 to VOL_MAX_ADDON
    uint256 internal constant VOL_MAX_ADDON = 100;           // +1.00% max during extreme vol
    uint256 internal constant VOL_HIGH_THRESHOLD = 2000;     // 20% price change = max vol fee

    // Concentration: penalty for whale-dominated markets
    uint256 internal constant CONC_MAX_ADDON = 75;           // +0.75% max
    uint256 internal constant CONC_DISCOUNT = 10;            // -0.10% for well-distributed markets
    uint256 internal constant CONC_HIGH_THRESHOLD = 5000;    // 50% held by top holder = max penalty
    uint256 internal constant CONC_LOW_THRESHOLD = 500;      // <5% = discount

    /// @notice Calculate the dynamic fee for a swap
    /// @param amountIn Swap input amount
    /// @param poolAge Seconds since pool creation
    /// @param volatility Rolling volatility in basis points (e.g., 500 = 5%)
    /// @param topHolderBps Top holder's share of circulating supply in basis points
    /// @return feeAmount The fee to deduct from amountIn
    /// @return feeBps The effective fee rate in basis points
    function calculateFee(
        uint256 amountIn,
        uint32 poolAge,
        uint256 volatility,
        uint256 topHolderBps
    ) internal pure returns (uint256 feeAmount, uint256 feeBps) {
        uint256 fee = BASE_FEE;

        // Factor 1: Pool maturity (decays linearly over MATURITY_PERIOD)
        if (poolAge < MATURITY_PERIOD) {
            uint256 remaining = MATURITY_PERIOD - poolAge;
            fee += (MATURITY_MAX_ADDON * remaining) / MATURITY_PERIOD;
        }

        // Factor 2: Realized volatility
        if (volatility > 0) {
            uint256 volAddon = (volatility * VOL_MAX_ADDON) / VOL_HIGH_THRESHOLD;
            if (volAddon > VOL_MAX_ADDON) volAddon = VOL_MAX_ADDON;
            fee += volAddon;
        }

        // Factor 3: Holder concentration
        if (topHolderBps >= CONC_HIGH_THRESHOLD) {
            fee += CONC_MAX_ADDON;
        } else if (topHolderBps >= CONC_LOW_THRESHOLD) {
            uint256 range = CONC_HIGH_THRESHOLD - CONC_LOW_THRESHOLD;
            uint256 scaled = topHolderBps - CONC_LOW_THRESHOLD;
            fee += (scaled * CONC_MAX_ADDON) / range;
        } else if (topHolderBps > 0) {
            // Well-distributed: apply discount
            fee = fee > CONC_DISCOUNT ? fee - CONC_DISCOUNT : 0;
        }

        // Clamp to [MIN_FEE, MAX_FEE]
        if (fee < MIN_FEE) fee = MIN_FEE;
        if (fee > MAX_FEE) fee = MAX_FEE;

        feeBps = fee;
        feeAmount = (amountIn * fee) / BASIS_POINTS;
    }
}
