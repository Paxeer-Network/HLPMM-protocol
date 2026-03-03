// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IStablecoinRegistry.sol";
import "../interfaces/IAdminController.sol";

/// @title StablecoinRegistry - Whitelist of approved stablecoins treated as fungible USD
/// @notice All approved stablecoins are valued at 1:1 USD within the protocol.
///         Admin can add/remove stablecoins via the AdminController.
contract StablecoinRegistry is IStablecoinRegistry {
    error NotAuthorized();
    error AlreadyApproved();
    error NotApproved();
    error ZeroAddress();

    IAdminController public immutable adminController;

    mapping(address => bool) private _approved;
    address[] private _stablecoins;

    modifier onlyOperatorOrAbove() {
        if (!adminController.hasRole(msg.sender, IAdminController.Role.ADMIN) &&
            !adminController.hasRole(msg.sender, IAdminController.Role.OPERATOR)) {
            revert NotAuthorized();
        }
        _;
    }

    constructor(address adminController_, address[] memory initialStablecoins) {
        if (adminController_ == address(0)) revert ZeroAddress();
        adminController = IAdminController(adminController_);

        for (uint256 i = 0; i < initialStablecoins.length; i++) {
            if (initialStablecoins[i] == address(0)) revert ZeroAddress();
            _approved[initialStablecoins[i]] = true;
            _stablecoins.push(initialStablecoins[i]);
            emit StablecoinAdded(initialStablecoins[i]);
        }
    }

    function isApprovedStablecoin(address token) external view returns (bool) {
        return _approved[token];
    }

    function getApprovedStablecoins() external view returns (address[] memory) {
        return _stablecoins;
    }

    function stablecoinCount() external view returns (uint256) {
        return _stablecoins.length;
    }

    function addStablecoin(address token) external onlyOperatorOrAbove {
        if (token == address(0)) revert ZeroAddress();
        if (_approved[token]) revert AlreadyApproved();

        _approved[token] = true;
        _stablecoins.push(token);
        emit StablecoinAdded(token);
    }

    function removeStablecoin(address token) external onlyOperatorOrAbove {
        if (!_approved[token]) revert NotApproved();

        _approved[token] = false;

        // Remove from array (swap-and-pop)
        for (uint256 i = 0; i < _stablecoins.length; i++) {
            if (_stablecoins[i] == token) {
                _stablecoins[i] = _stablecoins[_stablecoins.length - 1];
                _stablecoins.pop();
                break;
            }
        }

        emit StablecoinRemoved(token);
    }
}
