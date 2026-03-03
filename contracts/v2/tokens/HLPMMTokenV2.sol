// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IHLPMMTokenV2.sol";
import "../interfaces/IEventEmitterV2.sol";

/// @title HLPMMTokenV2 - ERC20 market token with metadata and emitter-integrated transfers
/// @notice Each market gets one token with 1B supply. All transfers are reported to EventEmitter.
/// @dev Deployed via CREATE2 by the factory. Initialize-once pattern.
contract HLPMMTokenV2 is IHLPMMTokenV2 {
    error AlreadyInitialized();
    error InsufficientBalance();
    error InsufficientAllowance();

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    string public metadata;

    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public totalSupply;

    address public pool;
    address public eventEmitter;
    bool private _initialized;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function initialize(
        string memory name_,
        string memory symbol_,
        string memory metadata_,
        address pool_,
        address eventEmitter_
    ) external {
        if (_initialized) revert AlreadyInitialized();

        name = name_;
        symbol = symbol_;
        metadata = metadata_;
        pool = pool_;
        eventEmitter = eventEmitter_;

        totalSupply = INITIAL_SUPPLY;
        balanceOf[pool_] = INITIAL_SUPPLY;

        _initialized = true;

        emit Transfer(address(0), pool_, INITIAL_SUPPLY);
        // Report mint to emitter
        IEventEmitterV2(eventEmitter_).emitTokenTransfer(
            address(this), address(0), pool_, INITIAL_SUPPLY
        );
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];

        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = currentAllowance - amount;
        }

        return _transfer(from, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        if (balanceOf[from] < amount) revert InsufficientBalance();

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);

        // Report every transfer to EventEmitter for off-chain indexing
        if (eventEmitter != address(0)) {
            IEventEmitterV2(eventEmitter).emitTokenTransfer(
                address(this), from, to, amount
            );
        }

        return true;
    }
}
