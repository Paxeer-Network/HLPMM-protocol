// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

contract MockNativeCoinDEX {
    uint256 private _price;

    constructor() {
        _price = 1e18; // Default 1 PAX = $1
    }

    function setPrice(uint256 price_) external {
        _price = price_;
    }

    function getCurrentPrice() external view returns (uint256) {
        return _price;
    }

    function getSpotPrice(address) external view returns (uint256) {
        return _price;
    }

    function reservePAX() external pure returns (uint256) {
        return 1000000e18;
    }

    function stablecoins(address) external pure returns (bool isSupported, uint8 decimals, uint256 reserve) {
        return (true, 18, 1000000e18);
    }
}
