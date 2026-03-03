// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IAdminController {
    enum Role { NONE, OPERATOR, ADMIN, GUARDIAN }

    event RoleGranted(address indexed account, Role role);
    event RoleRevoked(address indexed account);
    event TimelockUpdated(uint256 newDelay);
    event ActionQueued(bytes32 indexed actionId, address target, bytes data, uint256 executeAfter);
    event ActionExecuted(bytes32 indexed actionId);
    event ActionCancelled(bytes32 indexed actionId);

    function hasRole(address account, Role role) external view returns (bool);
    function grantRole(address account, Role role) external;
    function revokeRole(address account) external;
    function timelockDelay() external view returns (uint256);
    function setTimelockDelay(uint256 newDelay) external;
    function queueAction(address target, bytes calldata data) external returns (bytes32 actionId);
    function executeAction(bytes32 actionId) external;
    function cancelAction(bytes32 actionId) external;
}
