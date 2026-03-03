// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IAdminController.sol";

/// @title AdminController - Role-based access control with timelock
/// @notice Replaces the raw _deployer pattern. Supports OPERATOR, ADMIN, GUARDIAN roles.
/// @dev ADMIN can grant/revoke roles and queue timelocked actions.
///      OPERATOR can execute day-to-day operations (e.g., authorize emitters).
///      GUARDIAN can cancel queued actions (emergency brake).
contract AdminController is IAdminController {
    error NotAdmin();
    error NotGuardian();
    error InvalidRole();
    error ActionNotFound();
    error ActionNotReady();
    error ActionAlreadyExecuted();
    error ActionExpired();
    error TimelockTooShort();
    error ZeroAddress();

    uint256 public constant MIN_TIMELOCK = 1 hours;
    uint256 public constant MAX_TIMELOCK = 30 days;
    uint256 public constant ACTION_EXPIRY = 14 days;

    struct QueuedAction {
        address target;
        bytes data;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    mapping(address => Role) public roles;
    mapping(bytes32 => QueuedAction) public queuedActions;
    uint256 public timelockDelay;

    modifier onlyAdmin() {
        if (roles[msg.sender] != Role.ADMIN) revert NotAdmin();
        _;
    }

    modifier onlyGuardian() {
        if (roles[msg.sender] != Role.GUARDIAN && roles[msg.sender] != Role.ADMIN) revert NotGuardian();
        _;
    }

    constructor(address initialAdmin, uint256 initialDelay) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        if (initialDelay < MIN_TIMELOCK) revert TimelockTooShort();

        roles[initialAdmin] = Role.ADMIN;
        roles[address(this)] = Role.ADMIN; // Self-authorize for timelocked self-calls
        timelockDelay = initialDelay;

        emit RoleGranted(initialAdmin, Role.ADMIN);
    }

    function hasRole(address account, Role role) external view returns (bool) {
        return roles[account] == role;
    }

    function grantRole(address account, Role role) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        if (role == Role.NONE) revert InvalidRole();
        roles[account] = role;
        emit RoleGranted(account, role);
    }

    function revokeRole(address account) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        roles[account] = Role.NONE;
        emit RoleRevoked(account);
    }

    function setTimelockDelay(uint256 newDelay) external onlyAdmin {
        if (newDelay < MIN_TIMELOCK) revert TimelockTooShort();
        if (newDelay > MAX_TIMELOCK) newDelay = MAX_TIMELOCK;
        timelockDelay = newDelay;
        emit TimelockUpdated(newDelay);
    }

    function queueAction(
        address target,
        bytes calldata data
    ) external onlyAdmin returns (bytes32 actionId) {
        if (target == address(0)) revert ZeroAddress();

        uint256 executeAfter = block.timestamp + timelockDelay;
        actionId = keccak256(abi.encodePacked(target, data, executeAfter, block.timestamp));

        queuedActions[actionId] = QueuedAction({
            target: target,
            data: data,
            executeAfter: executeAfter,
            executed: false,
            cancelled: false
        });

        emit ActionQueued(actionId, target, data, executeAfter);
    }

    function executeAction(bytes32 actionId) external onlyAdmin {
        QueuedAction storage action = queuedActions[actionId];
        if (action.target == address(0)) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();
        if (action.cancelled) revert ActionNotFound();
        if (block.timestamp < action.executeAfter) revert ActionNotReady();
        if (block.timestamp > action.executeAfter + ACTION_EXPIRY) revert ActionExpired();

        action.executed = true;

        (bool success, bytes memory returnData) = action.target.call(action.data);
        if (!success) {
            assembly {
                revert(add(32, returnData), mload(returnData))
            }
        }

        emit ActionExecuted(actionId);
    }

    function cancelAction(bytes32 actionId) external onlyGuardian {
        QueuedAction storage action = queuedActions[actionId];
        if (action.target == address(0)) revert ActionNotFound();
        if (action.executed) revert ActionAlreadyExecuted();

        action.cancelled = true;
        emit ActionCancelled(actionId);
    }

    /// @notice Check if caller has at least OPERATOR level access
    function isOperatorOrAbove(address account) external view returns (bool) {
        Role r = roles[account];
        return r == Role.OPERATOR || r == Role.ADMIN;
    }
}
