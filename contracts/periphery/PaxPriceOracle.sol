// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

interface INativeCoinDEX {
    function getSpotPrice(address stable) external view returns (uint256);
    function reservePAX() external view returns (uint256);
    function stablecoins(address) external view returns (bool isSupported, uint8 decimals, uint256 reserve);
}

interface IPaxPriceOracle {
    function getPaxPriceInUSD() external view returns (uint256);
    function getUSIDForPAX(uint256 paxAmount) external view returns (uint256);
    function getPAXForUSID(uint256 usidAmount) external view returns (uint256);
}

contract PaxPriceOracle is IPaxPriceOracle {
    error InvalidPrice();
    error OracleNotSet();

    uint256 public constant PRICE_DECIMALS = 18;
    
    address public immutable nativeCoinDEX;
    address public immutable stableAddress;
    address public immutable owner;
    
    uint256 public fallbackPrice = 1e18; // Default 1 PAX = 1 USD if DEX unavailable
    bool public useFallback = false;

    event FallbackPriceUpdated(uint256 newPrice);
    event FallbackModeToggled(bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _nativeCoinDEX, address _stableAddress) {
        nativeCoinDEX = _nativeCoinDEX;
        stableAddress = _stableAddress;
        owner = msg.sender;
    }

    function getPaxPriceInUSD() public view returns (uint256) {
        if (useFallback || nativeCoinDEX == address(0)) {
            return fallbackPrice;
        }

        try INativeCoinDEX(nativeCoinDEX).getSpotPrice(stableAddress) returns (uint256 price) {
            if (price == 0) return fallbackPrice;
            return price;
        } catch {
            return fallbackPrice;
        }
    }

    function getUSIDForPAX(uint256 paxAmount) external view returns (uint256) {
        uint256 price = getPaxPriceInUSD();
        // usidAmount = paxAmount * price / 1e18
        return (paxAmount * price) / 1e18;
    }

    function getPAXForUSID(uint256 usidAmount) external view returns (uint256) {
        uint256 price = getPaxPriceInUSD();
        if (price == 0) revert InvalidPrice();
        // paxAmount = usidAmount * 1e18 / price
        return (usidAmount * 1e18) / price;
    }

    function setFallbackPrice(uint256 _price) external onlyOwner {
        require(_price > 0, "Invalid price");
        fallbackPrice = _price;
        emit FallbackPriceUpdated(_price);
    }

    function toggleFallbackMode(bool _useFallback) external onlyOwner {
        useFallback = _useFallback;
        emit FallbackModeToggled(_useFallback);
    }
}
