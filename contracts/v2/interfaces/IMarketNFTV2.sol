// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface IMarketNFTV2 {
    enum FeeStrategy { CLAIM, BURN, AIRDROP, LP_REWARDS }

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event FeeStrategyUpdated(uint256 indexed tokenId, FeeStrategy strategy);
    event FeesClaimed(uint256 indexed tokenId, address indexed recipient, uint256 amount);

    function mint(address to, address pool, FeeStrategy initialStrategy) external returns (uint256 tokenId);
    function setFeeStrategy(uint256 tokenId, FeeStrategy strategy) external;
    function claimFees(uint256 tokenId) external returns (uint256 amount);

    function nftToPool(uint256 tokenId) external view returns (address);
    function feeStrategy(uint256 tokenId) external view returns (FeeStrategy);
    function totalMinted() external view returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator, address from, uint256 tokenId, bytes calldata data
    ) external returns (bytes4);
}

interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
