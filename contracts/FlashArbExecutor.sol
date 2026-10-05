// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FlashArbExecutor
 * @notice CREATE2-deployable flash loan recipient that executes multi-hop
 *         arbitrage swaps and repays the loan atomically. Designed for
 *         Balancer V2 (0% fee) and Aave V3 flash loans.
 *
 * Deployment:
 *   Factory: 0x4e59b44847b379578588920cA78FbF26c0B4956C (CREATE2)
 *   Salt:    arb-engine-v1-<chainId>
 *   The deterministic address can be precomputed and used for paymaster setup.
 *
 * Security:
 *   - Only the owner (system signing wallet) can withdraw profits
 *   - Flash loan callback verifies msg.sender is the authorized Vault/Pool
 *   - All swaps use exactInput with amountOutMinimum for slippage protection
 *   - No arbitrary call forwarding — only whitelisted DEX routers
 */

interface IFlashLoanRecipient {
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IUniswapV3Router {
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);

    function exactInput(ExactInputParams calldata params)
        external payable returns (uint256 amountOut);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

struct SwapInstruction {
    uint8 dexType;      // 0 = Uniswap V3 single, 1 = Uniswap V2, 2 = SushiSwap
    address tokenIn;
    address tokenOut;
    uint24 fee;         // V3 fee tier, ignored for V2
    uint256 amountIn;   // 0 means use full balance of tokenIn
    uint256 amountOutMin;
}

contract FlashArbExecutor is IFlashLoanRecipient {
    address public owner;
    address public balancerVault;
    address public aavePool;

    // Whitelisted DEX routers
    address public uniswapV3Router;
    address public uniswapV2Router;
    address public sushiswapRouter;

    // Authorized flash loan senders
    mapping(address => bool) public authorizedFlashSender;

    event FlashArbExecuted(
        address indexed flashToken,
        uint256 flashAmount,
        uint256 profit,
        address indexed beneficiary
    );
    event FlashArbReverted(string reason);
    event RouterUpdated(string dex, address router);
    event OwnershipTransferred(address indexed previous, address indexed current);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        address _balancerVault,
        address _aavePool,
        address _uniswapV3Router,
        address _uniswapV2Router,
        address _sushiswapRouter
    ) {
        owner = msg.sender;
        balancerVault = _balancerVault;
        aavePool = _aavePool;
        uniswapV3Router = _uniswapV3Router;
        uniswapV2Router = _uniswapV2Router;
        sushiswapRouter = _sushiswapRouter;

        if (_balancerVault != address(0)) authorizedFlashSender[_balancerVault] = true;
        if (_aavePool != address(0)) authorizedFlashSender[_aavePool] = true;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDRESS");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRouter(string calldata dex, address router) external onlyOwner {
        if (keccak256(abi.encodePacked(dex)) == keccak256("uniswap-v3")) uniswapV3Router = router;
        else if (keccak256(abi.encodePacked(dex)) == keccak256("uniswap-v2")) uniswapV2Router = router;
        else if (keccak256(abi.encodePacked(dex)) == keccak256("sushiswap")) sushiswapRouter = router;
        emit RouterUpdated(dex, router);
    }

    function authorizeFlashSender(address sender, bool authorized) external onlyOwner {
        authorizedFlashSender[sender] = authorized;
    }

    // -----------------------------------------------------------------------
    // Flash loan initiation
    // -----------------------------------------------------------------------

    /**
     * @notice Initiate a Balancer V2 flash loan (0% fee)
     * @param token  Token to borrow
     * @param amount Amount to borrow
     * @param instructions Encoded swap instructions
     */
    function startBalancerFlashLoan(
        address token,
        uint256 amount,
        bytes calldata instructions
    ) external onlyOwner {
        require(balancerVault != address(0), "NO_BALANCER");
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        // Call Vault.flashLoan(recipient=this, tokens, amounts, userData=instructions)
        (bool success, ) = balancerVault.call(
            abi.encodeWithSignature(
                "flashLoan(address,address[],uint256[],bytes)",
                address(this),
                tokens,
                amounts,
                instructions
            )
        );
        require(success, "FLASH_LOAN_FAILED");
    }

    /**
     * @notice Initiate an Aave V3 flash loan (0.05% fee)
     */
    function startAaveFlashLoan(
        address token,
        uint256 amount,
        bytes calldata instructions
    ) external onlyOwner {
        require(aavePool != address(0), "NO_AAVE");
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        // Aave V3: pool.flashLoanSimple(receiver, asset, amount, params, referralCode)
        (bool success, ) = aavePool.call(
            abi.encodeWithSignature(
                "flashLoanSimple(address,address,uint256,bytes,uint16)",
                address(this),
                token,
                amount,
                instructions,
                0
            )
        );
        require(success, "FLASH_LOAN_FAILED");
    }

    // -----------------------------------------------------------------------
    // Balancer V2 callback
    // -----------------------------------------------------------------------

    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override {
        require(authorizedFlashSender[msg.sender], "UNAUTHORIZED_SENDER");
        require(tokens.length == 1 && amounts.length == 1, "SINGLE_TOKEN_ONLY");

        address flashToken = tokens[0];
        uint256 flashAmount = amounts[0];
        uint256 fee = feeAmounts[0];

        // Execute swap instructions
        SwapInstruction[] memory instructions = abi.decode(userData, (SwapInstruction[]));
        _executeSwaps(instructions);

        // Check profit
        uint256 endBalance = IERC20(flashToken).balanceOf(address(this));
        uint256 owed = flashAmount + fee;

        if (endBalance < owed) {
            emit FlashArbReverted("INSUFFICIENT_RETURN");
            revert("INSUFFICIENT_RETURN");
        }

        // Repay flash loan
        IERC20(flashToken).transfer(msg.sender, owed);

        uint256 profit = endBalance - owed;
        if (profit > 0) {
            IERC20(flashToken).transfer(owner, profit);
        }

        emit FlashArbExecuted(flashToken, flashAmount, profit, owner);
    }

    // -----------------------------------------------------------------------
    // Aave V3 callback
    // -----------------------------------------------------------------------

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address /* initiator */,
        bytes calldata params
    ) external returns (bool) {
        require(authorizedFlashSender[msg.sender], "UNAUTHORIZED_SENDER");

        SwapInstruction[] memory instructions = abi.decode(params, (SwapInstruction[]));
        _executeSwaps(instructions);

        uint256 endBalance = IERC20(asset).balanceOf(address(this));
        uint256 owed = amount + premium;

        if (endBalance < owed) {
            revert("INSUFFICIENT_RETURN");
        }

        // Approve repayment
        IERC20(asset).approve(msg.sender, owed);

        uint256 profit = endBalance - owed;
        if (profit > 0) {
            IERC20(asset).transfer(owner, profit);
        }

        emit FlashArbExecuted(asset, amount, profit, owner);
        return true;
    }

    // -----------------------------------------------------------------------
    // Swap execution
    // -----------------------------------------------------------------------

    function _executeSwaps(SwapInstruction[] memory instructions) internal {
        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction memory inst = instructions[i];

            uint256 amountIn = inst.amountIn;
            if (amountIn == 0) {
                amountIn = IERC20(inst.tokenIn).balanceOf(address(this));
            }

            if (inst.dexType == 0) {
                // Uniswap V3 exactInputSingle
                _swapV3Single(inst.tokenIn, inst.tokenOut, inst.fee, amountIn, inst.amountOutMin);
            } else if (inst.dexType == 1) {
                // Uniswap V2
                _swapV2(uniswapV2Router, inst.tokenIn, inst.tokenOut, amountIn, inst.amountOutMin);
            } else if (inst.dexType == 2) {
                // SushiSwap
                _swapV2(sushiswapRouter, inst.tokenIn, inst.tokenOut, amountIn, inst.amountOutMin);
            }
        }
    }

    function _swapV3Single(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal {
        IERC20(tokenIn).approve(uniswapV3Router, amountIn);

        ExactInputSingleParams memory params = ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });

        IUniswapV3Router(uniswapV3Router).exactInputSingle(params);
    }

    function _swapV2(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal {
        IERC20(tokenIn).approve(router, amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IUniswapV2Router(router).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );
    }

    // -----------------------------------------------------------------------
    // Rescue / withdraw (owner only)
    // -----------------------------------------------------------------------

    function rescueToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) IERC20(token).transfer(owner, balance);
    }

    function rescueETH() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "ETH_TRANSFER_FAILED");
    }

    receive() external payable {}
}
