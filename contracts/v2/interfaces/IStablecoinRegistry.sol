// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IStablecoinRegistry {
    event StablecoinAdded(address indexed token);
    event StablecoinRemoved(address indexed token);

    function isApprovedStablecoin(address token) external view returns (bool);
    function getApprovedStablecoins() external view returns (address[] memory);
    function stablecoinCount() external view returns (uint256);
    function addStablecoin(address token) external;
    function removeStablecoin(address token) external;
}
