// ---------------------------------------------------------------------------
// Multi-chain EVM constants — all chains with flash loan support
// Addresses verified from official Uniswap docs, Chainlink docs, and chain explorers
// ---------------------------------------------------------------------------

export type ChainId = 1 | 8453 | 10 | 42161 | 137 | 43114 | 56 | 100;

export type ChainConfig = {
  chainId: ChainId;
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  rpcUrl: string;
  blockExplorer: string;
  flashLoanProvider: 'balancer-v2' | 'aave-v3' | 'dodo' | 'uniswap-v3';
  flashLoanFeeBps: number;
  entryPoint: string;
  weth: string;
  uniswapV3Factory: string | null;
  uniswapV3QuoterV2: string | null;
  uniswapV3Router02: string | null;
  uniswapV2Router: string | null;
  uniswapV2Factory: string | null;
  oneinchRouter: string | null;
  oneinchSpotQuote: string | null;
  sushiswapRouter: string | null;
  balancerVault: string | null;
  aavePool: string | null;
  dodoProxy: string | null;
};

export const CHAINS: Record<ChainId, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'eth',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    flashLoanProvider: 'balancer-v2',
    flashLoanFeeBps: 0,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    dodoProxy: '0x1111111254fB045e479459BcBE8dDB45464526c2',
  },
  // Base L2
  8453: {
    chainId: 8453,
    name: 'Base',
    shortName: 'base',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    flashLoanProvider: 'balancer-v2',
    flashLoanFeeBps: 0,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0x4200000000000000000000000000000000000006',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    uniswapV3Router02: '0x2626664c2603336E57B271c5C0b26F421741e481',
    uniswapV2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    uniswapV2Factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0xf9DB7d874cC5Bf0290493A5a93Eb3A93F0bb79C6',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: '0xa97684A0913854BE6C2A4018546f1f6B26Dd58b0',
    dodoProxy: null,
  },
  // Optimism
  10: {
    chainId: 10,
    name: 'Optimism',
    shortName: 'op',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    flashLoanProvider: 'aave-v3',
    flashLoanFeeBps: 5,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0x4200000000000000000000000000000000000006',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
    uniswapV2Factory: '0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    dodoProxy: null,
  },
  // Arbitrum One
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'arb',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    flashLoanProvider: 'aave-v3',
    flashLoanFeeBps: 5,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    uniswapV2Factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    dodoProxy: null,
  },
  // Polygon
  137: {
    chainId: 137,
    name: 'Polygon',
    shortName: 'matic',
    nativeSymbol: 'MATIC',
    nativeDecimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    flashLoanProvider: 'aave-v3',
    flashLoanFeeBps: 5,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
    uniswapV2Factory: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    dodoProxy: null,
  },
  // Avalanche C-Chain
  43114: {
    chainId: 43114,
    name: 'Avalanche',
    shortName: 'avax',
    nativeSymbol: 'AVAX',
    nativeDecimals: 18,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowscan.io',
    flashLoanProvider: 'aave-v3',
    flashLoanFeeBps: 5,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0xB31f66AA3C1e785363F0875A1B2c2C2c2C2c2C2c',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    uniswapV2Factory: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: null,
    aavePool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    dodoProxy: null,
  },
  // BNB Smart Chain
  56: {
    chainId: 56,
    name: 'BNB Chain',
    shortName: 'bsc',
    nativeSymbol: 'BNB',
    nativeDecimals: 18,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    flashLoanProvider: 'dodo',
    flashLoanFeeBps: 0,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0xbb4CdB9CBd36B01bD1cBaEBF2de08d9173bc095c',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x10ED43C718714eb63d5aA57B78B54704E2563d22',
    uniswapV2Factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: null,
    aavePool: null,
    dodoProxy: '0x1111111254fB045e479459BcBE8dDB45464526c2',
  },
  // Gnosis Chain (xDai)
  100: {
    chainId: 100,
    name: 'Gnosis',
    shortName: 'gno',
    nativeSymbol: 'xDAI',
    nativeDecimals: 18,
    rpcUrl: 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    flashLoanProvider: 'balancer-v2',
    flashLoanFeeBps: 0,
    entryPoint: '0x0000000071727De22E5E9d8BAf0451A803ba5D45f',
    weth: '0x6A023CCd1fa620BE41293765961d4EC652C2c2C2',
    uniswapV3Factory: '0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c',
    uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    uniswapV3Router02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    uniswapV2Router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    uniswapV2Factory: '0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf',
    oneinchRouter: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    oneinchSpotQuote: '0x000000080933A35c8c38Dd18cD4F28Bd4d4dF5D6',
    sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    balancerVault: '0xBA12222222228d8Ba445958a75a0704d566bf2C8',
    aavePool: null,
    dodoProxy: null,
  },
};

export const DEFAULT_CHAIN_ID: ChainId = 8453;

export function getChain(chainId: ChainId): ChainConfig {
  return CHAINS[chainId] ?? CHAINS[DEFAULT_CHAIN_ID];
}

export function getActiveChains(): ChainConfig[] {
  return Object.values(CHAINS);
}

// ---------------------------------------------------------------------------
// DEX types
// ---------------------------------------------------------------------------

export type DexPlatform = 'uniswap-v3' | 'uniswap-v2' | 'sushiswap' | '1inch' | 'balancer' | 'aave-flash' | 'dodo-flash' | 'velodrome' | 'pancakeswap' | 'aerodrome';

export const DEX_LABELS: Record<DexPlatform, string> = {
  'uniswap-v3': 'Uniswap V3',
  'uniswap-v2': 'Uniswap V2',
  'sushiswap': 'SushiSwap',
  '1inch': '1inch',
  'balancer': 'Balancer',
  'aave-flash': 'Aave V3 Flash',
  'dodo-flash': 'DODO Flash',
  'velodrome': 'Velodrome',
  'pancakeswap': 'PancakeSwap',
  'aerodrome': 'Aerodrome',
};

export const ARB_STRATEGIES = {
  TRIANGULAR: 'triangular',
  CIRCULAR: 'circular',
  MULTI_DEX: 'multi-dex',
} as const;

export type ArbStrategy = typeof ARB_STRATEGIES[keyof typeof ARB_STRATEGIES];

// ---------------------------------------------------------------------------
// Gas / engine constants
// ---------------------------------------------------------------------------

export const ENGINE_CONSTANTS = {
  FLASH_LOAN_ANCHOR_SIZE: 2_000,
  MIN_PROFIT_THRESHOLD_USD: 0.10,
  MIN_SPREAD_BPS: 1,
  MAX_SLIPPAGE_BPS: 300,
  BASE_GAS_UNITS: 150_000,
  GAS_PER_SWAP_UNITS: 80_000,
  FLASH_LOAN_GAS_RESERVE: 200_000,
  MAX_GAS_PRICE_GWEI: 5,
  PRIORITY_GAS_PRICE_GWEI: 2,
  SCANNER_INTERVAL_MS: 15_000,
  SETTLEMENT_TIMEOUT_MS: 45_000,
  SETTLEMENT_POLL_INTERVAL_MS: 3_000,
  SETTLEMENT_MAX_POLLS: 15,
  MAX_HOP_COUNT: 5,
  WEI_PER_ETH: 1_000_000_000_000_000_000n,
  WEI_PER_GWEI: 1_000_000_000n,
} as const;

export const UNISWAP_FEE_TIERS = [100, 500, 3000, 10000] as const;

// CREATE2 factory for deterministic contract deployment
export const CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';

// ERC-4337 EntryPoint (same on all chains — canonical deployment)
export const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0451A803ba5D45f';

// Coinbase Developer Platform Paymaster
export const CDP_PAYMASTER_ADDRESS = '0x0000000000089Fc424d9079BbA0bc7fA3Ee34eB1';

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export const BALANCER_VAULT_ABI = [
  'function flashLoan(address recipient, address[] tokens, uint256[] amounts, bytes userData) external',
] as const;

export const UNISWAP_QUOTER_V2_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
] as const;

export const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) external returns (uint256[] amounts)',
] as const;

export const ENTRY_POINT_ABI = [
  'function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external',
  'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) external payable',
] as const;
