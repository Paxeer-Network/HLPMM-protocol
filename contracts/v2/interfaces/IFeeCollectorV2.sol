// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IFeeCollectorV2 {
    enum FeeStrategy { CLAIM, BURN, AIRDROP, LP_REWARDS }

    event FeeAccumulated(uint256 indexed nftId, address stablecoin, uint256 amount);
    event FeeDistributed(uint256 indexed nftId, address recipient, uint256 amount, FeeStrategy strategy);

    function accumulateFee(uint256 nftId, address stablecoin, uint256 amount) external;
    function distributeFees(uint256 nftId, address recipient, FeeStrategy strategy) external returns (uint256 amount);
    function pendingFees(uint256 nftId) external view returns (uint256);
}
