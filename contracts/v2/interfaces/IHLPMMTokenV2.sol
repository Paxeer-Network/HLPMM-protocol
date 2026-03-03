// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IHLPMMTokenV2 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function metadata() external view returns (string memory);
    function pool() external view returns (address);
    function eventEmitter() external view returns (address);

    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    function initialize(
        string memory name_,
        string memory symbol_,
        string memory metadata_,
        address pool_,
        address eventEmitter_
    ) external;

    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
