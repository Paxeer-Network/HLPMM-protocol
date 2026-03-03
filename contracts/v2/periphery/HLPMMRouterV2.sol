// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "../interfaces/IHLPMMRouterV2.sol";
import "../interfaces/IHLPMMFactoryV2.sol";
import "../interfaces/IHLPMMPoolV2.sol";
import "../interfaces/IStablecoinRegistry.sol";

interface IERC20Router {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title HLPMMRouterV2 - Smart multi-hop swap router
/// @notice Handles all swap routing:
///   - Stable → Token (single hop)
///   - Token → Stable (single hop)
///   - Token → Token (auto multi-hop via intermediate stable)
///   All stablecoins treated as fungible USD. User gets whatever stable the pool holds.
contract HLPMMRouterV2 is IHLPMMRouterV2 {
    error Expired();
    error InvalidPath();
    error PoolNotFound();
    error InsufficientOutput();
    error NotApprovedStablecoin();
    error ZeroAmount();

    address public immutable factory;
    address public immutable stablecoinRegistry;

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    constructor(address factory_, address stablecoinRegistry_) {
        factory = factory_;
        stablecoinRegistry = stablecoinRegistry_;
    }

    // ─── Stable → Token ──────────────────────────────────────────────────

    /// @notice Swap stablecoins for tokens
    /// @param amountIn Amount of stablecoins to swap
    /// @param amountOutMin Minimum tokens to receive
    /// @param stablecoin The specific stablecoin being sent (must be approved)
    /// @param tokenOut The market token to buy
    /// @param to Recipient address
    /// @param deadline Transaction deadline
    function swapExactStableForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address stablecoin,
        address tokenOut,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (!IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(stablecoin)) {
            revert NotApprovedStablecoin();
        }

        address pool = IHLPMMFactoryV2(factory).tokenToPool(tokenOut);
        if (pool == address(0)) revert PoolNotFound();

        // Transfer stablecoins from user to pool
        IERC20Router(stablecoin).transferFrom(msg.sender, pool, amountIn);

        // Execute swap
        (amountOut, ) = IHLPMMPoolV2(pool).swap(
            stablecoin, stablecoin, amountIn, amountOutMin, to
        );

        if (amountOut < amountOutMin) revert InsufficientOutput();
    }

    // ─── Token → Stable ──────────────────────────────────────────────────

    /// @notice Swap tokens for stablecoins (user gets whatever stable pool holds)
    /// @param amountIn Amount of tokens to sell
    /// @param amountOutMin Minimum stablecoin amount to receive
    /// @param tokenIn The market token to sell
    /// @param to Recipient address
    /// @param deadline Transaction deadline
    function swapExactTokensForStable(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut, address stablecoinOut) {
        if (amountIn == 0) revert ZeroAmount();

        address pool = IHLPMMFactoryV2(factory).tokenToPool(tokenIn);
        if (pool == address(0)) revert PoolNotFound();

        // Transfer tokens from user to pool
        IERC20Router(tokenIn).transferFrom(msg.sender, pool, amountIn);

        // Use first available stablecoin as the "preferred" output
        address[] memory stables = IStablecoinRegistry(stablecoinRegistry).getApprovedStablecoins();
        address preferredStable = stables[0];

        // Execute swap — pool will send whatever stablecoins it has
        (amountOut, stablecoinOut) = IHLPMMPoolV2(pool).swap(
            preferredStable, tokenIn, amountIn, amountOutMin, to
        );

        if (amountOut < amountOutMin) revert InsufficientOutput();
    }

    // ─── Token ↔ Token (smart multi-hop) ─────────────────────────────────

    /// @notice Swap any token for any other token via automatic USD intermediary
    /// @dev Handles: Token→Token (auto-hop), Stable→Token, Token→Stable
    /// @param amountIn Input amount
    /// @param amountOutMin Minimum output
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @param to Recipient
    /// @param deadline Transaction deadline
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address tokenOut,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();

        bool tokenInIsStable = IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(tokenIn);
        bool tokenOutIsStable = IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(tokenOut);

        if (tokenInIsStable && !tokenOutIsStable) {
            // Stable → Token
            address pool = IHLPMMFactoryV2(factory).tokenToPool(tokenOut);
            if (pool == address(0)) revert PoolNotFound();

            IERC20Router(tokenIn).transferFrom(msg.sender, pool, amountIn);
            (amountOut, ) = IHLPMMPoolV2(pool).swap(
                tokenIn, tokenIn, amountIn, amountOutMin, to
            );
        } else if (!tokenInIsStable && tokenOutIsStable) {
            // Token → Stable
            address pool = IHLPMMFactoryV2(factory).tokenToPool(tokenIn);
            if (pool == address(0)) revert PoolNotFound();

            IERC20Router(tokenIn).transferFrom(msg.sender, pool, amountIn);
            (amountOut, ) = IHLPMMPoolV2(pool).swap(
                tokenOutIsStable ? tokenOut : _getPreferredStable(),
                tokenIn, amountIn, 0, to // min check at end
            );
        } else if (!tokenInIsStable && !tokenOutIsStable) {
            // Token → Token (multi-hop: TokenA → Stable → TokenB)
            // Pull tokens from user to router first, then _multiHopSwap uses transfer
            IERC20Router(tokenIn).transferFrom(msg.sender, address(this), amountIn);
            amountOut = _multiHopSwap(tokenIn, tokenOut, amountIn, to);
        } else {
            // Stable → Stable: just transfer (they're all 1:1 at protocol level)
            IERC20Router(tokenIn).transferFrom(msg.sender, to, amountIn);
            amountOut = amountIn;
        }

        if (amountOut < amountOutMin) revert InsufficientOutput();
    }

    /// @notice Multi-hop swap with explicit path
    /// @param amountIn Input amount
    /// @param amountOutMin Minimum final output
    /// @param path Array of token addresses defining the swap route
    /// @param to Recipient
    /// @param deadline Transaction deadline
    function swapExactTokensForTokensMultiHop(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        if (path.length < 2) revert InvalidPath();
        if (amountIn == 0) revert ZeroAmount();

        // Pull initial tokens from user to router
        IERC20Router(path[0]).transferFrom(msg.sender, address(this), amountIn);

        amountOut = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address currentIn = path[i];
            address currentOut = path[i + 1];
            bool isLast = (i == path.length - 2);
            address recipient = isLast ? to : address(this);

            bool inIsStable = IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(currentIn);
            bool outIsStable = IStablecoinRegistry(stablecoinRegistry).isApprovedStablecoin(currentOut);

            if (inIsStable && !outIsStable) {
                // Stable → Token
                address pool = IHLPMMFactoryV2(factory).tokenToPool(currentOut);
                if (pool == address(0)) revert PoolNotFound();

                _safeTransfer(currentIn, pool, amountOut);
                (amountOut, ) = IHLPMMPoolV2(pool).swap(
                    currentIn, currentIn, amountOut, 0, recipient
                );
            } else if (!inIsStable && outIsStable) {
                // Token → Stable
                address pool = IHLPMMFactoryV2(factory).tokenToPool(currentIn);
                if (pool == address(0)) revert PoolNotFound();

                _safeTransfer(currentIn, pool, amountOut);
                (amountOut, ) = IHLPMMPoolV2(pool).swap(
                    currentOut, currentIn, amountOut, 0, recipient
                );
            } else if (!inIsStable && !outIsStable) {
                // Token → Token (auto-insert stable intermediate)
                amountOut = _multiHopSwap(currentIn, currentOut, amountOut, recipient);
            } else {
                // Stable → Stable (1:1)
                if (recipient != address(this)) {
                    _safeTransfer(currentIn, recipient, amountOut);
                }
            }
        }

        if (amountOut < amountOutMin) revert InsufficientOutput();
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @notice Execute TokenA → Stable → TokenB multi-hop
    function _multiHopSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address to
    ) internal returns (uint256 amountOut) {
        address poolIn = IHLPMMFactoryV2(factory).tokenToPool(tokenIn);
        address poolOut = IHLPMMFactoryV2(factory).tokenToPool(tokenOut);
        if (poolIn == address(0) || poolOut == address(0)) revert PoolNotFound();

        address preferredStable = _getPreferredStable();

        // Leg 1: TokenA → Stable (router receives stable)
        _safeTransfer(tokenIn, poolIn, amountIn);
        (uint256 stableAmount, address stableReceived) = IHLPMMPoolV2(poolIn).swap(
            preferredStable, tokenIn, amountIn, 0, address(this)
        );

        // Leg 2: Stable → TokenB (send to final recipient)
        _safeTransfer(stableReceived, poolOut, stableAmount);
        (amountOut, ) = IHLPMMPoolV2(poolOut).swap(
            stableReceived, stableReceived, stableAmount, 0, to
        );
    }

    function _getPreferredStable() internal view returns (address) {
        address[] memory stables = IStablecoinRegistry(stablecoinRegistry).getApprovedStablecoins();
        return stables[0];
    }

    function _safeTransfer(address tokenAddr, address to, uint256 amount) internal {
        (bool success, bytes memory data) = tokenAddr.call(
            abi.encodeWithSelector(IERC20Router.transfer.selector, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
}
