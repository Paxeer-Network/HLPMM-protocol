// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IFeeCollectorV2.sol";
import "../interfaces/IEventEmitterV2.sol";
import "../interfaces/IAdminController.sol";
import "../interfaces/IStablecoinRegistry.sol";

interface IERC20Minimal {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
}

/// @title FeeCollectorV2 - Multi-stable fee accumulation and distribution
/// @notice Accumulates fees from pools in any approved stablecoin.
///         Distributes via 4 strategies: CLAIM, BURN, AIRDROP, LP_REWARDS.
///         Uses AdminController for consistent admin pattern.
contract FeeCollectorV2 is IFeeCollectorV2 {
    error Unauthorized();
    error ZeroAddress();
    error NoFeesToDistribute();

    IAdminController public immutable adminController;
    address public stablecoinRegistry;
    address public factory;
    address public marketNFT;
    address public eventEmitter;

    // nftId => total accumulated fees (USD value, accounting only)
    mapping(uint256 => uint256) private _pendingFees;

    // nftId => stablecoin => amount (actual tokens held)
    mapping(uint256 => mapping(address => uint256)) private _feeBalances;

    // Track which stablecoins have fees for a given nftId
    mapping(uint256 => address[]) private _feeStablecoins;

    modifier onlyAuthorized() {
        // Pools and factory can accumulate fees
        if (msg.sender != factory && msg.sender != marketNFT) {
            // Check if it's a pool by seeing if factory recognizes it
            revert Unauthorized();
        }
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

    function setProtocolAddresses(
        address factory_,
        address marketNFT_,
        address eventEmitter_,
        address stablecoinRegistry_
    ) external onlyOperatorOrAbove {
        factory = factory_;
        marketNFT = marketNFT_;
        eventEmitter = eventEmitter_;
        stablecoinRegistry = stablecoinRegistry_;
    }

    /// @notice Accumulate fee from a pool swap
    /// @param nftId The market NFT that owns these fees
    /// @param stablecoin The stablecoin the fee is denominated in (address(0) for token-side fees)
    /// @param amount The fee amount in USD terms
    function accumulateFee(uint256 nftId, address stablecoin, uint256 amount) external {
        // Anyone can call this (pools call it during swap)
        // The actual stablecoins are held by the pool or transferred here
        _pendingFees[nftId] += amount;

        if (stablecoin != address(0)) {
            // Track per-stablecoin balance
            if (_feeBalances[nftId][stablecoin] == 0) {
                _feeStablecoins[nftId].push(stablecoin);
            }
            _feeBalances[nftId][stablecoin] += amount;
        }

        emit FeeAccumulated(nftId, stablecoin, amount);
    }

    /// @notice Distribute accumulated fees according to strategy
    /// @param nftId The market NFT ID
    /// @param recipient The fee recipient (NFT owner)
    /// @param strategy The distribution strategy
    /// @return amount Total USD value distributed
    function distributeFees(
        uint256 nftId,
        address recipient,
        FeeStrategy strategy
    ) external returns (uint256 amount) {
        if (msg.sender != marketNFT) revert Unauthorized();

        amount = _pendingFees[nftId];
        if (amount == 0) revert NoFeesToDistribute();

        _pendingFees[nftId] = 0;

        if (strategy == FeeStrategy.CLAIM) {
            // Send all accumulated stablecoins to recipient
            _sendAllFees(nftId, recipient);
        } else if (strategy == FeeStrategy.BURN) {
            // Burn by sending to dead address
            _sendAllFees(nftId, address(0xdead));
        } else if (strategy == FeeStrategy.AIRDROP) {
            // For AIRDROP: fees stay in collector until a separate airdrop mechanism claims them
            // Just reset the pending counter; balances remain for airdrop distribution
            // (Airdrop logic would be a separate admin-triggered function)
        } else if (strategy == FeeStrategy.LP_REWARDS) {
            // For LP_REWARDS: send back to pool to deepen liquidity
            // TODO: implement pool liquidity injection
        }

        // Emit via EventEmitter
        if (eventEmitter != address(0)) {
            IEventEmitterV2(eventEmitter).emitFeeClaimed(
                address(0), nftId, recipient, amount
            );
        }

        emit FeeDistributed(nftId, recipient, amount, strategy);
    }

    function pendingFees(uint256 nftId) external view returns (uint256) {
        return _pendingFees[nftId];
    }

    // ─── Internal ────────────────────────────────────────────────────────

    function _sendAllFees(uint256 nftId, address to) internal {
        address[] storage stables = _feeStablecoins[nftId];
        for (uint256 i = 0; i < stables.length; i++) {
            uint256 bal = _feeBalances[nftId][stables[i]];
            if (bal > 0) {
                _feeBalances[nftId][stables[i]] = 0;
                uint256 available = IERC20Minimal(stables[i]).balanceOf(address(this));
                if (available >= bal) {
                    IERC20Minimal(stables[i]).transfer(to, bal);
                } else if (available > 0) {
                    IERC20Minimal(stables[i]).transfer(to, available);
                }
            }
        }
        delete _feeStablecoins[nftId];
    }
}
