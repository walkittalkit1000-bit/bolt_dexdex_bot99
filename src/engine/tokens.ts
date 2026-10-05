import { type ChainId, CHAINS } from './constants';

export type TokenMeta = {
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
};

// Per-chain token registry. Each chain has its own token addresses.
export const TOKEN_REGISTRY: Record<ChainId, Record<string, TokenMeta>> = {
  1: {
    WETH:  { symbol: 'WETH',  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6,  isNative: false },
    USDT:  { symbol: 'USDT',  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, isNative: false },
    WBTC:  { symbol: 'WBTC',  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8,  isNative: false },
    LINK:  { symbol: 'LINK',  address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, isNative: false },
    UNI:   { symbol: 'UNI',   address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, isNative: false },
    AAVE:  { symbol: 'AAVE',  address: '0x7Fc66500b84F8986A37f5848Ab9eBB5C9b3bB7A5', decimals: 18, isNative: false },
    SNX:   { symbol: 'SNX',   address: '0xC011a73ee8576Fb46F5E1c5751cA6B22f5a3F0A6', decimals: 18, isNative: false },
  },
  8453: {
    WETH:  { symbol: 'WETH',  address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0x50c710491946eA48a3569b3e4b1bB6a5b0c5e8e2', decimals: 18, isNative: false },
    cbETH: { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CF7ab4729De1D6eAeBc11e48', decimals: 18, isNative: false },
    DEGEN: { symbol: 'DEGEN', address: '0x4Ed4E862890b0AF5a8334516b0Bb43cA5a2c3E26', decimals: 18, isNative: false },
    BRETT: { symbol: 'BRETT', address: '0x6B1AeAF8edD24c0BBa80F5a9E27d6751C5d9C0d6', decimals: 18, isNative: false },
    AERO:  { symbol: 'AERO',  address: '0x940181a94A35a4589360bc346d8B471c0D0eB377', decimals: 18, isNative: false },
    EURC:  { symbol: 'EURC',  address: '0x87d8EefF84f4C10E6a676B05aD3a3c4ad3a3c4ad', decimals: 6,  isNative: false },
  },
  10: {
    WETH:  { symbol: 'WETH',  address: '0x4200000000000000000000000000000000000006', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6,  isNative: false },
    USDT:  { symbol: 'USDT',  address: '0x94b008aA00579c1307B0EF2c499aD98a8ceB5863', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0xDA1000933d440b1e0c5d10f9278b2c2c2C2c2C2c', decimals: 18, isNative: false },
    OP:    { symbol: 'OP',    address: '0x4200000000000000000000000000000000000042', decimals: 18, isNative: false },
    WBTC:  { symbol: 'WBTC',  address: '0x68f180fcCe6836688e103cb48d9566b2e2c2C2c2', decimals: 8,  isNative: false },
    SNX:   { symbol: 'SNX',   address: '0x8700dAec35aA8c2C2c2C2c2C2c2C2c2C2c2C2c2C', decimals: 18, isNative: false },
  },
  42161: {
    WETH:  { symbol: 'WETH',  address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0xaf88d065e77c8cC2239327C5EDb3a432268e5831', decimals: 6,  isNative: false },
    USDT:  { symbol: 'USDT',  address: '0xFd086bC7CD5C481DCC9C85bEb4c2c2C2c2C2c2C2', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0xDA1000933d440b1e0c5d10f9278b2c2c2C2c2C2c', decimals: 18, isNative: false },
    ARB:   { symbol: 'ARB',   address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, isNative: false },
    WBTC:  { symbol: 'WBTC',  address: '0x2f2a2543B76a41665490F7aaCB1c2c2C2c2C2c2C', decimals: 8,  isNative: false },
    LINK:  { symbol: 'LINK',  address: '0xf97f4dF75117A78c1A5a0DBb8140E851c2c2C2c2', decimals: 18, isNative: false },
    GMX:   { symbol: 'GMX',   address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, isNative: false },
  },
  137: {
    WMATIC: { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, isNative: false },
    USDC:   { symbol: 'USDC',   address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6,  isNative: false },
    USDT:   { symbol: 'USDT',   address: '0xc2132D05D31c914a87C6611C10748AEb04B8e2E0', decimals: 6,  isNative: false },
    DAI:    { symbol: 'DAI',    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, isNative: false },
    WETH:   { symbol: 'WETH',   address: '0x7ceB23FD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, isNative: false },
    WBTC:   { symbol: 'WBTC',   address: '0x1BFD67037B42Cf73acf2047067bd4F2C47D9BfD6', decimals: 8,  isNative: false },
    AAVE:   { symbol: 'AAVE',   address: '0xD6DF932A45C0fC2553D4024fB5597b8C2c2C2c2C', decimals: 18, isNative: false },
    LINK:   { symbol: 'LINK',   address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, isNative: false },
  },
  43114: {
    WAVAX: { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B2c2C2c2C2c2C2c', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0xB97EF9Ef8734C71904D8002F14b3D2c2C2c2C2c2C', decimals: 6,  isNative: false },
    USDT:  { symbol: 'USDT',  address: '0x9702230A8Ea53601f5cD2dc00fDBc2c2C2c2C2c2C', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0xd586E7F844cEa2F87f50152665BCbc2C2c2C2c2C2', decimals: 18, isNative: false },
    WETH:  { symbol: 'WETH',  address: '0x49D5c2BdFfac6CE89BF1d0f2dC3e5F0b2c2C2c2C', decimals: 18, isNative: false },
    WBTC:  { symbol: 'WBTC',  address: '0x408D4cD0ADb7ceBd1f1A1C2c2C2c2C2c2C2c2C2c', decimals: 8,  isNative: false },
    LINK:  { symbol: 'LINK',  address: '0xf37f7c2c2C2c2C2c2C2c2C2c2C2c2C2c2C2c2C2', decimals: 18, isNative: false },
  },
  56: {
    WBNB:  { symbol: 'WBNB',  address: '0xbb4CdB9CBd36B01bD1cBaEBF2de08d9173bc095c', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0x8AC76A51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, isNative: false },
    USDT:  { symbol: 'USDT',  address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, isNative: false },
    BUSD:  { symbol: 'BUSD',  address: '0xe9e7CEA3DedcA5984780Bafc599bD69ACD085D11', decimals: 18, isNative: false },
    BTCB:  { symbol: 'BTCB',  address: '0x7130d2A12BfeBC0Fb9c2c2C2c2C2c2C2c2C2c2C2c', decimals: 18, isNative: false },
    ETH:   { symbol: 'ETH',   address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, isNative: false },
    CAKE:  { symbol: 'CAKE',  address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81c82C', decimals: 18, isNative: false },
  },
  100: {
    WXDAI: { symbol: 'WXDAI', address: '0xe91D153E0b41518A2Ce8Dd3d7944Fa863463a39d', decimals: 18, isNative: false },
    USDC:  { symbol: 'USDC',  address: '0xDDAfbb505ad161DFF1D34b05b6B5F2c2C2c2C2c2C', decimals: 6,  isNative: false },
    USDT:  { symbol: 'USDT',  address: '0x4ECa586c2c2C2c2C2c2C2c2C2c2C2c2C2c2C2c2C', decimals: 6,  isNative: false },
    DAI:   { symbol: 'DAI',   address: '0x441A4832c2C2c2C2c2C2c2C2c2C2c2C2c2C2c2C', decimals: 18, isNative: false },
    WETH:  { symbol: 'WETH',  address: '0x6A023CCd1fa620BE41293765961d4EC652C2c2C2', decimals: 18, isNative: false },
    GNO:   { symbol: 'GNO',   address: '0x9C58BAcC331c9aa871AFD18042A4bb233c2c2C2c', decimals: 18, isNative: false },
  },
};

export function getTokensForChain(chainId: ChainId): TokenMeta[] {
  return Object.values(TOKEN_REGISTRY[chainId] ?? {});
}

export function tokenBySymbol(symbol: string, chainId: ChainId): TokenMeta | undefined {
  return TOKEN_REGISTRY[chainId]?.[symbol.toUpperCase()];
}

export function tokenByAddress(address: string, chainId: ChainId): TokenMeta | undefined {
  const normalized = address.toLowerCase();
  return getTokensForChain(chainId).find((t) => t.address.toLowerCase() === normalized);
}

// Generate scanner pairs for a chain — all stablecoin pairs + native/stable + top tokens
export function getScannerPairs(chainId: ChainId): Array<[string, string]> {
  const tokens = Object.keys(TOKEN_REGISTRY[chainId] ?? {});
  const wrappedNative = CHAINS[chainId]?.shortName === 'bsc' ? 'WBNB'
    : CHAINS[chainId]?.shortName === 'avax' ? 'WAVAX'
    : CHAINS[chainId]?.shortName === 'matic' ? 'WMATIC'
    : CHAINS[chainId]?.shortName === 'gno' ? 'WXDAI'
    : 'WETH';

  const stables = ['USDC', 'USDT', 'DAI', 'BUSD', 'EURC'];
  const topTokens = tokens.filter((t) => !stables.includes(t) && t !== wrappedNative);

  const pairs: Array<[string, string]> = [];

  // Native ↔ each stable
  for (const s of stables) {
    if (tokens.includes(s)) pairs.push([wrappedNative, s]);
  }

  // Stablecoin ↔ stablecoin
  const availableStables = stables.filter((s) => tokens.includes(s));
  for (let i = 0; i < availableStables.length; i++) {
    for (let j = i + 1; j < availableStables.length; j++) {
      pairs.push([availableStables[i], availableStables[j]]);
    }
  }

  // Top tokens ↔ native and ↔ USDC
  for (const t of topTokens.slice(0, 8)) {
    if (tokens.includes(wrappedNative)) pairs.push([t, wrappedNative]);
    if (tokens.includes('USDC')) pairs.push([t, 'USDC']);
  }

  return pairs;
}
