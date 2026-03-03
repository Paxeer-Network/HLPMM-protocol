// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IFeeCollector.sol";
import "../interfaces/IMarketNFT.sol";

contract MockCaller {
    function callDistributeFees(
        address feeCollector,
        uint256 nftId,
        address recipient,
        FeeStrategy strategy
    ) external returns (uint256) {
        return IFeeCollector(feeCollector).distributeFees(nftId, recipient, strategy);
    }
}
