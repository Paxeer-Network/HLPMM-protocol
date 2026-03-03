// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IMarketNFTV2.sol";
import "../interfaces/IHLPMMPoolV2.sol";
import "../interfaces/IFeeCollectorV2.sol";
import "../interfaces/IEventEmitterV2.sol";
import "../interfaces/IAdminController.sol";

/// @title MarketNFTV2 - ERC721 fee rights with consistent admin pattern
/// @notice Each market gets one NFT representing perpetual fee ownership.
///         V2 uses AdminController for all admin ops (no more inconsistent _deployer).
contract MarketNFTV2 is IMarketNFTV2, IERC721Metadata {
    error Unauthorized();
    error InvalidTokenId();
    error NotOwnerOrApproved();
    error TransferToZeroAddress();
    error MintToZeroAddress();
    error ApprovalToCurrentOwner();
    error ApproveCallerNotOwnerNorApproved();
    error TransferFromIncorrectOwner();
    error ERC721InvalidReceiver(address receiver);
    error ZeroAddress();

    string public constant name = "HLPMM Market Position V2";
    string public constant symbol = "HLPMM-POS-V2";

    IAdminController public immutable adminController;
    address public factory;
    address public feeCollector;
    address public eventEmitter;

    uint256 public totalMinted;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    mapping(uint256 => address) public nftToPool;
    mapping(uint256 => FeeStrategy) public feeStrategy;

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
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

    /// @notice Configure protocol addresses. Admin-controlled, can be updated.
    function setProtocolAddresses(
        address factory_,
        address feeCollector_,
        address eventEmitter_
    ) external onlyOperatorOrAbove {
        if (factory_ == address(0) || feeCollector_ == address(0) || eventEmitter_ == address(0)) {
            revert ZeroAddress();
        }
        factory = factory_;
        feeCollector = feeCollector_;
        eventEmitter = eventEmitter_;
    }

    function mint(
        address to,
        address pool,
        FeeStrategy initialStrategy
    ) external onlyFactory returns (uint256 tokenId) {
        if (to == address(0)) revert MintToZeroAddress();

        tokenId = ++totalMinted;

        _balances[to] += 1;
        _owners[tokenId] = to;
        nftToPool[tokenId] = pool;
        feeStrategy[tokenId] = initialStrategy;

        emit Transfer(address(0), to, tokenId);
        if (initialStrategy != FeeStrategy.CLAIM) {
            IEventEmitterV2(eventEmitter).emitFeeStrategyUpdated(
                tokenId, IEventEmitterV2.FeeStrategy(uint8(initialStrategy))
            );
            emit FeeStrategyUpdated(tokenId, initialStrategy);
        }
    }

    function setFeeStrategy(uint256 tokenId, FeeStrategy strategy) external {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotOwnerOrApproved();

        feeStrategy[tokenId] = strategy;

        IEventEmitterV2(eventEmitter).emitFeeStrategyUpdated(
            tokenId, IEventEmitterV2.FeeStrategy(uint8(strategy))
        );
        emit FeeStrategyUpdated(tokenId, strategy);
    }

    function claimFees(uint256 tokenId) external returns (uint256 amount) {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotOwnerOrApproved();

        address owner = ownerOf(tokenId);
        FeeStrategy strategy = feeStrategy[tokenId];

        amount = IFeeCollectorV2(feeCollector).distributeFees(
            tokenId, owner, IFeeCollectorV2.FeeStrategy(uint8(strategy))
        );

        emit FeesClaimed(tokenId, owner, amount);
    }

    // ─── ERC721 Standard ─────────────────────────────────────────────────

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) revert InvalidTokenId();
        return owner;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert InvalidTokenId();
        return "";
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        if (to == owner) revert ApprovalToCurrentOwner();
        if (msg.sender != owner && !_operatorApprovals[owner][msg.sender]) {
            revert ApproveCallerNotOwnerNorApproved();
        }
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert InvalidTokenId();
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotOwnerOrApproved();
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotOwnerOrApproved();
        _transfer(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f;   // ERC721Metadata
    }

    // ─── Internal ────────────────────────────────────────────────────────

    function _transfer(address from, address to, uint256 tokenId) internal {
        if (ownerOf(tokenId) != from) revert TransferFromIncorrectOwner();
        if (to == address(0)) revert TransferToZeroAddress();

        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner ||
                _tokenApprovals[tokenId] == spender ||
                _operatorApprovals[owner][spender]);
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) {
                    revert ERC721InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC721InvalidReceiver(to);
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }
}
