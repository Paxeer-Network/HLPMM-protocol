// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IHLPMMPoolV2.sol";
import "../interfaces/IFeeCollectorV2.sol";
import "../interfaces/IEventEmitterV2.sol";
import "../interfaces/IMarketNFTV2.sol";
import "../interfaces/IStablecoinRegistry.sol";
import "../libraries/PoolMathV2.sol";
import "../libraries/FeeCalculatorV2.sol";
import "../libraries/VolatilityOracle.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title HLPMMPoolV2 - AMM with virtual reserves, multi-stable, real dynamic fees
/// @notice Core trading engine for HLPMM V2.
///   - Virtual USD reserves create a price floor (never backed by real tokens)
///   - Any approved stablecoin accepted as USD (fungible at 1:1)
///   - Real volatility tracking via EMA oracle
///   - Real holder concentration measurement
///   - Fixed fee accounting (no circular reserve mutation)
contract HLPMMPoolV2 is IHLPMMPoolV2 {
    error Unauthorized();
    error InvalidToken();
    error InsufficientOutput();
    error InsufficientRealLiquidity();
    error ReentrancyGuard();
    error ZeroAmount();
    error NotApprovedStablecoin();
    error AlreadyInitialized();

    // ─── Immutables ──────────────────────────────────────────────────────
    address public immutable token;
    address public immutable factory;
    address public immutable feeCollector;
    address public immutable eventEmitter;
    address public immutable marketNFT;
    address public immutable stablecoinRegistry;
    uint256 public immutable nftId;
    uint32 public immutable createdAt;

    // ─── Reserve state ───────────────────────────────────────────────────
    uint256 public virtualReserveUSD;   // Virtual (unbacked) USD for price calculation
    uint256 public realReserveUSD;      // Sum of all real stablecoins held
    uint256 public reserveToken;        // Token balance in pool

    // ─── Volatility oracle ───────────────────────────────────────────────
    VolatilityOracle.State public volState;

    // ─── Top holder tracking ─────────────────────────────────────────────
    uint256 private constant MAX_TRACKED_HOLDERS = 10;
    address[10] private _topHolders;
    uint256 private _topHolderCount;

    // ─── Fee accumulation ────────────────────────────────────────────────
    uint256 public cumulativeFees;

    // ─── Reentrancy lock ─────────────────────────────────────────────────
    uint256 private _unlocked = 1;

    bool private _initialized;

    modifier lock() {
        if (_unlocked != 1) revert ReentrancyGuard();
        _unlocked = 2;
        _;
        _unlocked = 1;
    }

    modifier onlyMarketNFT() {
        if (msg.sender != marketNFT) revert Unauthorized();
        _;
    }

    constructor(
        address token_,
        address factory_,
        address feeCollector_,
        address eventEmitter_,
        address marketNFT_,
        address stablecoinRegistry_,
        uint256 nftId_
    ) {
        token = token_;
        factory = factory_;
        feeCollector = feeCollector_;
        eventEmitter = eventEmitter_;
        marketNFT = marketNFT_;
        stablecoinRegistry = stablecoinRegistry_;
        nftId = nftId_;
        createdAt = uint32(block.timestamp);
    }

    /// @notice Initialize pool with virtual USD reserves and token supply
    /// @param virtualUSD Virtual USD amount (e.g., 10_000e18)
    /// @param tokenAmount Token supply allocated to pool (e.g., 1_000_000_000e18)
    function initialize(uint256 virtualUSD, uint256 tokenAmount) external {
        if (msg.sender != factory) revert Unauthorized();
        if (_initialized) revert AlreadyInitialized();

        virtualReserveUSD = virtualUSD;
        realReserveUSD = 0;
        reserveToken = tokenAmount;

        uint256 effectiveUSD = virtualUSD;
        uint256 initialPrice = PoolMathV2.getSpotPrice(effectiveUSD, tokenAmount);
        VolatilityOracle.initialize(volState, initialPrice);

        _initialized = true;
        emit Sync(effectiveUSD, tokenAmount);
    }

    // ─── View functions ──────────────────────────────────────────────────

    function getEffectiveReserveUSD() public view returns (uint256) {
        return virtualReserveUSD + realReserveUSD;
    }

    function getReserves() external view returns (uint256 effectiveUSD, uint256 tokenReserve) {
        effectiveUSD = getEffectiveReserveUSD();
        tokenReserve = reserveToken;
    }

    function getSpotPrice() external view returns (uint256) {
        return PoolMathV2.getSpotPrice(getEffectiveReserveUSD(), reserveToken);
    }

    function getMarketCap() external view returns (uint256) {
        uint256 totalSupply = IERC20(token).totalSupply();
        return PoolMathV2.getMarketCap(getEffectiveReserveUSD(), reserveToken, totalSupply);
    }

    function getVolatility() external view returns (uint256) {
        return VolatilityOracle.getVolatility(volState);
    }

    function getStableBalance(address stablecoin) external view returns (uint256) {
        return IERC20(stablecoin).balanceOf(address(this));
    }

    function getTotalStableBalance() external view returns (uint256 total) {
        IStablecoinRegistry registry = IStablecoinRegistry(stablecoinRegistry);
        address[] memory stables = registry.getApprovedStablecoins();
        for (uint256 i = 0; i < stables.length; i++) {
            total += IERC20(stables[i]).balanceOf(address(this));
        }
    }

    // ─── Swap ────────────────────────────────────────────────────────────

    /// @notice Execute a swap
    /// @param stablecoinUsed The stablecoin being swapped in/out (must be approved)
    /// @param tokenIn The token being sold (either stablecoinUsed or this pool's token)
    /// @param amountIn Amount of tokenIn being swapped
    /// @param amountOutMin Minimum acceptable output
    /// @param to Recipient of output tokens
    /// @return amountOut Actual output amount
    /// @return tokenOut The output token address
    function swap(
        address stablecoinUsed,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external lock returns (uint256 amountOut, address tokenOut) {
        if (amountIn == 0) revert ZeroAmount();

        // Validate stablecoin
        if (!IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(stablecoinUsed)) {
            revert NotApprovedStablecoin();
        }

        bool isBuyingTokens = (tokenIn == stablecoinUsed);
        if (!isBuyingTokens && tokenIn != token) revert InvalidToken();

        uint256 effectiveUSD = getEffectiveReserveUSD();

        // Calculate dynamic fee
        uint32 poolAge = uint32(block.timestamp) - createdAt;
        uint256 volatility = VolatilityOracle.getVolatility(volState);
        uint256 concentration = _getTopHolderConcentration();

        (uint256 feeAmount, ) = FeeCalculatorV2.calculateFee(
            amountIn, poolAge, volatility, concentration
        );

        uint256 amountInAfterFee = amountIn - feeAmount;

        if (isBuyingTokens) {
            // Buying tokens with stablecoins: USD_in → Token_out
            amountOut = PoolMathV2.getAmountOut(amountInAfterFee, effectiveUSD, reserveToken);
            tokenOut = token;

            // Update reserves
            realReserveUSD += amountIn; // Full amount (including fee) goes to pool
            reserveToken -= amountOut;

            // Transfer fee to FeeCollector (in stablecoin)
            if (feeAmount > 0) {
                cumulativeFees += feeAmount;
                _safeTransfer(stablecoinUsed, feeCollector, feeAmount);
                IFeeCollectorV2(feeCollector).accumulateFee(nftId, stablecoinUsed, feeAmount);
                // Adjust: fee left pool, so real reserve only increased by amountInAfterFee
                realReserveUSD -= feeAmount;
            }

            // Send tokens to buyer
            _safeTransfer(token, to, amountOut);

            // Emit with stablecoin in, token out
            IEventEmitterV2(eventEmitter).emitSwap(
                address(this), msg.sender,
                stablecoinUsed, address(0),
                stablecoinUsed, token,
                amountIn, amountOut, feeAmount,
                getEffectiveReserveUSD(), reserveToken
            );
        } else {
            // Selling tokens for stablecoins: Token_in → USD_out
            amountOut = PoolMathV2.getAmountOut(amountInAfterFee, reserveToken, effectiveUSD);
            tokenOut = stablecoinUsed;

            // Fee handling: convert token fee to USD value using PRE-update reserves
            // so the valuation reflects the state at time of swap
            uint256 feeUsdValue = 0;
            if (feeAmount > 0) {
                feeUsdValue = PoolMathV2.getAmountOut(
                    feeAmount, reserveToken + amountIn, effectiveUSD
                );
            }

            // Check real liquidity floor — total outflow = user's output + fee transfer
            uint256 totalStableOutflow = amountOut + feeUsdValue;
            if (!PoolMathV2.isWithinRealLiquidity(totalStableOutflow, realReserveUSD)) {
                revert InsufficientRealLiquidity();
            }

            if (amountOut < amountOutMin) revert InsufficientOutput();

            // Update reserves
            reserveToken += amountIn; // Full amount (including fee portion in tokens)
            realReserveUSD -= totalStableOutflow; // Both user output and fee leave pool

            // Transfer fee in actual stablecoins to FeeCollector
            if (feeUsdValue > 0) {
                cumulativeFees += feeUsdValue;
                _sendStable(stablecoinUsed, feeCollector, feeUsdValue);
                IFeeCollectorV2(feeCollector).accumulateFee(nftId, stablecoinUsed, feeUsdValue);
            }

            // Send stablecoins to seller (pick from available balances)
            _sendStable(stablecoinUsed, to, amountOut);

            // Emit with token in, stablecoin out
            IEventEmitterV2(eventEmitter).emitSwap(
                address(this), msg.sender,
                address(0), stablecoinUsed,
                token, stablecoinUsed,
                amountIn, amountOut, feeAmount,
                getEffectiveReserveUSD(), reserveToken
            );
        }

        if (amountOut < amountOutMin) revert InsufficientOutput();

        // Update volatility oracle
        uint256 newPrice = PoolMathV2.getSpotPrice(getEffectiveReserveUSD(), reserveToken);
        uint256 newVol = VolatilityOracle.update(volState, newPrice);
        IEventEmitterV2(eventEmitter).emitVolatilityUpdated(address(this), newVol);

        // Update top holder tracking
        _updateTopHolders(to);

        emit Sync(getEffectiveReserveUSD(), reserveToken);
    }

    // ─── Fee claim ───────────────────────────────────────────────────────

    function claimFees(address /* recipient */) external onlyMarketNFT returns (uint256 amount) {
        amount = cumulativeFees;
        if (amount > 0) {
            cumulativeFees = 0;
        }
    }

    // ─── Sync ────────────────────────────────────────────────────────────

    function sync() external {
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        reserveToken = tokenBalance;

        // Recalculate real USD from actual stablecoin balances
        uint256 total = 0;
        address[] memory stables = IStablecoinRegistry(stablecoinRegistry).getApprovedStablecoins();
        for (uint256 i = 0; i < stables.length; i++) {
            total += IERC20(stables[i]).balanceOf(address(this));
        }
        realReserveUSD = total;

        emit Sync(getEffectiveReserveUSD(), reserveToken);
    }

    // ─── Real holder concentration ───────────────────────────────────────

    /// @notice Get top holder's share of circulating supply in basis points
    /// @dev Tracks top holders via _updateTopHolders called on every swap.
    ///      Returns the largest single holder's share of circulating supply.
    function _getTopHolderConcentration() internal view returns (uint256) {
        uint256 totalSupply = IERC20(token).totalSupply();
        if (totalSupply == 0) return 0;

        uint256 poolBalance = IERC20(token).balanceOf(address(this));
        uint256 circulatingSupply = totalSupply - poolBalance;
        if (circulatingSupply == 0) return 0;

        // Find the largest holder among tracked addresses
        uint256 maxBalance = 0;
        for (uint256 i = 0; i < _topHolderCount; i++) {
            uint256 bal = IERC20(token).balanceOf(_topHolders[i]);
            if (bal > maxBalance) {
                maxBalance = bal;
            }
        }

        return (maxBalance * 10_000) / circulatingSupply;
    }

    /// @notice Track swap participants for holder concentration
    /// @dev Maintains a rolling list of top N holders by balance.
    function _updateTopHolders(address account) internal {
        if (account == address(this) || account == address(0)) return;

        uint256 accountBalance = IERC20(token).balanceOf(account);

        // Check if already tracked
        for (uint256 i = 0; i < _topHolderCount; i++) {
            if (_topHolders[i] == account) return;
        }

        // If we have room, just add
        if (_topHolderCount < MAX_TRACKED_HOLDERS) {
            _topHolders[_topHolderCount] = account;
            _topHolderCount++;
            return;
        }

        // Otherwise, replace the smallest holder if this one is bigger
        uint256 minBalance = type(uint256).max;
        uint256 minIndex = 0;
        for (uint256 i = 0; i < MAX_TRACKED_HOLDERS; i++) {
            uint256 bal = IERC20(token).balanceOf(_topHolders[i]);
            if (bal < minBalance) {
                minBalance = bal;
                minIndex = i;
            }
        }

        if (accountBalance > minBalance) {
            _topHolders[minIndex] = account;
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────────

    function _safeTransfer(address tokenAddr, address to, uint256 amount) internal {
        (bool success, bytes memory data) = tokenAddr.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    /// @notice Send stablecoins to recipient from pool's holdings
    /// @dev Tries the requested stablecoin first, then falls back to any available
    function _sendStable(address preferredStable, address to, uint256 amount) internal {
        uint256 available = IERC20(preferredStable).balanceOf(address(this));
        if (available >= amount) {
            _safeTransfer(preferredStable, to, amount);
            return;
        }

        // Send what we can of the preferred, then fill from others
        uint256 remaining = amount;
        if (available > 0) {
            _safeTransfer(preferredStable, to, available);
            remaining -= available;
        }

        address[] memory stables = IStablecoinRegistry(stablecoinRegistry).getApprovedStablecoins();
        for (uint256 i = 0; i < stables.length && remaining > 0; i++) {
            if (stables[i] == preferredStable) continue;

            uint256 bal = IERC20(stables[i]).balanceOf(address(this));
            if (bal == 0) continue;

            uint256 toSend = bal >= remaining ? remaining : bal;
            _safeTransfer(stables[i], to, toSend);
            remaining -= toSend;
        }

        require(remaining == 0, "INSUFFICIENT_STABLE_BALANCE");
    }
}
