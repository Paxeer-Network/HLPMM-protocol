// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IEventEmitterV2.sol";
import "../interfaces/IAdminController.sol";

/// @title EventEmitterV2 - Canonical event bus with consistent admin pattern
/// @notice All protocol events flow through here for off-chain indexing.
///         V2 adds token transfer events and uses AdminController instead of _deployer.
contract EventEmitterV2 is IEventEmitterV2 {
    error Unauthorized();
    error ZeroAddress();

    IAdminController public immutable adminController;
    address public factory;

    mapping(address => bool) private _authorizedEmitters;

    modifier onlyAuthorized() {
        if (!_authorizedEmitters[msg.sender] && msg.sender != factory) revert Unauthorized();
        _;
    }

    modifier onlyOperatorOrAbove() {
        if (!adminController.hasRole(msg.sender, IAdminController.Role.ADMIN) &&
            !adminController.hasRole(msg.sender, IAdminController.Role.OPERATOR)) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address adminController_) {
        if (adminController_ == address(0)) revert ZeroAddress();
        adminController = IAdminController(adminController_);
    }

    /// @notice Set factory address. Can be updated by admin (not one-shot).
    function setFactory(address factory_) external onlyOperatorOrAbove {
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function authorizeEmitter(address emitter) external {
        if (msg.sender != factory &&
            !adminController.hasRole(msg.sender, IAdminController.Role.ADMIN) &&
            !adminController.hasRole(msg.sender, IAdminController.Role.OPERATOR)) {
            revert Unauthorized();
        }
        _authorizedEmitters[emitter] = true;
    }

    function revokeEmitter(address emitter) external onlyOperatorOrAbove {
        _authorizedEmitters[emitter] = false;
    }

    function isAuthorizedEmitter(address emitter) external view returns (bool) {
        return _authorizedEmitters[emitter];
    }

    // ─── Event emission functions ────────────────────────────────────────

    function emitMarketCreated(
        address pool,
        address token,
        uint256 nftId,
        address creator,
        string memory name,
        string memory symbol,
        string memory metadata,
        uint256 virtualReserveUSD,
        uint256 tokenSupply
    ) external onlyAuthorized {
        emit MarketCreated(
            pool, token, nftId, creator,
            name, symbol, metadata,
            virtualReserveUSD, tokenSupply,
            block.timestamp
        );
    }

    function emitSwap(
        address pool,
        address sender,
        address stablecoinIn,
        address stablecoinOut,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        uint256 newReserveUSD,
        uint256 newReserveToken
    ) external onlyAuthorized {
        emit Swap(
            pool, sender,
            stablecoinIn, stablecoinOut,
            tokenIn, tokenOut,
            amountIn, amountOut, feeAmount,
            newReserveUSD, newReserveToken,
            block.timestamp
        );
    }

    function emitTokenTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external onlyAuthorized {
        emit TokenTransfer(token, from, to, amount, block.timestamp);
    }

    function emitFeeClaimed(
        address pool,
        uint256 nftId,
        address recipient,
        uint256 amount
    ) external onlyAuthorized {
        emit FeeClaimed(pool, nftId, recipient, amount, block.timestamp);
    }

    function emitFeeStrategyUpdated(
        uint256 nftId,
        FeeStrategy newStrategy
    ) external onlyAuthorized {
        emit FeeStrategyUpdated(nftId, newStrategy, block.timestamp);
    }

    function emitVolatilityUpdated(
        address pool,
        uint256 volatility
    ) external onlyAuthorized {
        emit VolatilityUpdated(pool, volatility, block.timestamp);
    }
}
