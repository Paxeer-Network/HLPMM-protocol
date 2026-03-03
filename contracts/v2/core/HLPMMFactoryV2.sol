// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IHLPMMFactoryV2.sol";
import "../interfaces/IMarketNFTV2.sol";
import "../interfaces/IFeeCollectorV2.sol";
import "../interfaces/IEventEmitterV2.sol";
import "../interfaces/IHLPMMTokenV2.sol";
import "../interfaces/IAdminController.sol";
import "../interfaces/IStablecoinRegistry.sol";
import "./HLPMMPoolV2.sol";
import "../tokens/HLPMMTokenV2.sol";

/// @title HLPMMFactoryV2 - Market genesis with virtual reserves, metadata, multi-stable
/// @notice Creates markets with virtual USD reserves (no real stablecoins minted).
///         Tokens support metadata. Uses AdminController for admin ops.
contract HLPMMFactoryV2 is IHLPMMFactoryV2 {
    error MarketAlreadyExists();
    error InvalidName();
    error InvalidSymbol();
    error Unauthorized();
    error ZeroAddress();

    uint256 public constant VIRTUAL_USD = 10_000 * 1e18;       // $10,000 virtual reserve
    uint256 public constant INITIAL_TOKENS = 1_000_000_000 * 1e18; // 1B tokens

    IAdminController public immutable adminController;
    address public immutable stablecoinRegistry;
    address public immutable eventEmitter;
    address public immutable marketNFT;
    address public immutable feeCollector;

    uint256 public marketCount;

    mapping(address => address) public tokenToPool;
    mapping(uint256 => address) public nftToPool;
    mapping(address => address) public poolToToken;
    mapping(address => uint256) public creatorNonce;

    address[] public allPools;

    constructor(
        address adminController_,
        address stablecoinRegistry_,
        address eventEmitter_,
        address marketNFT_,
        address feeCollector_
    ) {
        if (adminController_ == address(0) || stablecoinRegistry_ == address(0) ||
            eventEmitter_ == address(0) || marketNFT_ == address(0) ||
            feeCollector_ == address(0)) {
            revert ZeroAddress();
        }

        adminController = IAdminController(adminController_);
        stablecoinRegistry = stablecoinRegistry_;
        eventEmitter = eventEmitter_;
        marketNFT = marketNFT_;
        feeCollector = feeCollector_;
    }

    /// @notice Create a new market with virtual reserves
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param metadata Arbitrary metadata string (JSON, IPFS hash, etc.)
    /// @param initialStrategy Initial fee distribution strategy for the NFT holder
    /// @return pool The deployed pool address
    /// @return token The deployed token address
    /// @return nftId The minted NFT ID representing fee ownership
    function createMarket(
        string memory name,
        string memory symbol,
        string memory metadata,
        FeeStrategy initialStrategy
    ) external returns (address pool, address token, uint256 nftId) {
        if (bytes(name).length == 0) revert InvalidName();
        if (bytes(symbol).length == 0) revert InvalidSymbol();

        uint256 nonce = creatorNonce[msg.sender]++;

        bytes32 salt = keccak256(abi.encodePacked(name, symbol, msg.sender, nonce));

        // Deploy token via CREATE2
        token = address(new HLPMMTokenV2{salt: salt}());

        nftId = marketCount + 1;

        // Deploy pool (no stablecoin minting — virtual reserves only)
        pool = address(new HLPMMPoolV2(
            token,
            address(this),
            feeCollector,
            eventEmitter,
            marketNFT,
            stablecoinRegistry,
            nftId
        ));

        if (tokenToPool[token] != address(0)) revert MarketAlreadyExists();

        // Authorize pool and token as emitters BEFORE initialization
        // (token.initialize emits TokenTransfer, pool needs emitter access for swaps)
        IEventEmitterV2(eventEmitter).authorizeEmitter(pool);
        IEventEmitterV2(eventEmitter).authorizeEmitter(token);

        // Initialize token with metadata and event emitter
        IHLPMMTokenV2(token).initialize(name, symbol, metadata, pool, eventEmitter);

        // Initialize pool with virtual reserves (NO real stablecoins minted)
        HLPMMPoolV2(pool).initialize(VIRTUAL_USD, INITIAL_TOKENS);

        // Mint fee ownership NFT to creator
        IMarketNFTV2(marketNFT).mint(
            msg.sender, pool, IMarketNFTV2.FeeStrategy(uint8(initialStrategy))
        );

        // Register mappings
        tokenToPool[token] = pool;
        nftToPool[nftId] = pool;
        poolToToken[pool] = token;
        allPools.push(pool);
        marketCount++;

        // Emit market creation event
        IEventEmitterV2(eventEmitter).emitMarketCreated(
            pool, token, nftId, msg.sender,
            name, symbol, metadata,
            VIRTUAL_USD, INITIAL_TOKENS
        );

        emit MarketCreated(pool, token, nftId, msg.sender);
    }

    function getPool(address token_) external view returns (address) {
        return tokenToPool[token_];
    }

    function computeTokenAddress(
        string memory name,
        string memory symbol,
        address creator,
        uint256 nonce
    ) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(name, symbol, creator, nonce));

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(type(HLPMMTokenV2).creationCode)
            )
        );

        return address(uint160(uint256(hash)));
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    function getPoolCount() external view returns (uint256) {
        return allPools.length;
    }
}
