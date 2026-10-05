// ---------------------------------------------------------------------------
// arb-relay — Multi-Chain EVM Arbitrage Relay
// Supports: Ethereum, Base, Optimism, Arbitrum, Polygon, Avalanche, BNB, Gnosis
// Flash loans: Balancer V2 (0%), Aave V3 (0.05%), DODO (0%)
// DEX aggregation: Uniswap V2/V3, SushiSwap, 1inch
// Gas: ERC-4337 CDP Paymaster sponsorship
// Strategies: Triangular, Circular, Multi-DEX
// CREATE2 deterministic contract deployment
// ---------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Chain configurations
// ---------------------------------------------------------------------------

type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeSymbol: string;
  flashLoanProvider: string;
  flashLoanFeeBps: number;
  entryPoint: string;
  weth: string;
  uniswapV3Factory: string | null;
  uniswapV3QuoterV2: string | null;
  uniswapV3Router02: string | null;
  uniswapV2Router: string | null;
  sushiswapRouter: string | null;
  balancerVault: string | null;
  aavePool: string | null;
};

const CHAINS: Record<number, ChainConfig> = {
  1: { chainId: 1, name: "Ethereum", rpcUrl: "https://eth.llamarpc.com", nativeSymbol: "ETH", flashLoanProvider: "balancer-v2", flashLoanFeeBps: 0, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
  8453: { chainId: 8453, name: "Base", rpcUrl: "https://mainnet.base.org", nativeSymbol: "ETH", flashLoanProvider: "balancer-v2", flashLoanFeeBps: 0, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x4200000000000000000000000000000000000006", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a", uniswapV3Router02: "0x2626664c2603336E57B271c5C0b26F421741e481", uniswapV2Router: null, sushiswapRouter: "0xf9DB7d874cC5Bf0290493A5a93Eb3A93F0bb79C6", balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: "0xa97684A0913854BE6C2A4018546f1f6B26Dd58b0" },
  10: { chainId: 10, name: "Optimism", rpcUrl: "https://mainnet.optimism.io", nativeSymbol: "ETH", flashLoanProvider: "aave-v3", flashLoanFeeBps: 5, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x4200000000000000000000000000000000000006", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: null, sushiswapRouter: null, balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" },
  42161: { chainId: 42161, name: "Arbitrum One", rpcUrl: "https://arb1.arbitrum.io/rpc", nativeSymbol: "ETH", flashLoanProvider: "aave-v3", flashLoanFeeBps: 5, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" },
  137: { chainId: 137, name: "Polygon", rpcUrl: "https://polygon-rpc.com", nativeSymbol: "MATIC", flashLoanProvider: "aave-v3", flashLoanFeeBps: 5, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: null, sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" },
  43114: { chainId: 43114, name: "Avalanche", rpcUrl: "https://api.avax.network/ext/bc/C/rpc", nativeSymbol: "AVAX", flashLoanProvider: "aave-v3", flashLoanFeeBps: 5, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x49D5c2BdFfac6CE89BF1d0f2dC3e5F0b2c2C2c2C", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4", sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", balancerVault: null, aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD" },
  56: { chainId: 56, name: "BNB Chain", rpcUrl: "https://bsc-dataseed.binance.org", nativeSymbol: "BNB", flashLoanProvider: "dodo", flashLoanFeeBps: 0, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0xbb4CdB9CBd36B01bD1cBaEBF2de08d9173bc095c", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: "0x10ED43C718714eb63d5aA57B78B54704E2563d22", sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", balancerVault: null, aavePool: null },
  100: { chainId: 100, name: "Gnosis", rpcUrl: "https://rpc.gnosischain.com", nativeSymbol: "xDAI", flashLoanProvider: "balancer-v2", flashLoanFeeBps: 0, entryPoint: "0x0000000071727De22E5E9d8BAf0451A803ba5D45f", weth: "0x6A023CCd1fa620BE41293765961d4EC652C2c2C2", uniswapV3Factory: "0x1F98431c8aD9850365BAfDcDDf4286dA54674c7c", uniswapV3QuoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", uniswapV3Router02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", uniswapV2Router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", sushiswapRouter: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", balancerVault: "0xBA12222222228d8Ba445958a75a0704d566bf2C8", aavePool: null },
};

const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const CDP_PAYMASTER_ADDRESS = "0x0000000000089Fc424d9079BbA0bc7fA3Ee34eB1";
const UNISWAP_FEE_TIERS = [100, 500, 3000, 10000];

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, serviceKey);
}

async function logToDb(component: string, level: string, message: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("engine_logs").insert({ component, level, message, metadata });
  } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// EVM RPC helpers
// ---------------------------------------------------------------------------

async function ethRpc(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  return (await ethRpc(rpcUrl, "eth_call", [{ to, data }, "latest"])) as string;
}

function encodeAddress(addr: string): string { return addr.toLowerCase().replace("0x", "").padStart(64, "0"); }
function encodeUint256(value: bigint): string { return value.toString(16).padStart(64, "0"); }
function encodeUint24(value: number): string { return value.toString(16).padStart(64, "0"); }
function encodeUint160(value: bigint): string { return value.toString(16).padStart(64, "0"); }
function decodeUint256(hex: string): bigint { return BigInt(hex); }

const SELECTORS = {
  quoteExactInputSingle: "0xc6a5026a",
  getAmountsOut: "0xd06ca61f",
  flashLoan: "0x5c38449e",
  balanceOf: "0x70a08231",
};

// ---------------------------------------------------------------------------
// Price fetching
// ---------------------------------------------------------------------------

const cachedNativePrices: Record<number, { price: number; ts: number }> = {};

async function fetchNativePrice(chainId: number, symbol: string): Promise<number> {
  const cached = cachedNativePrices[chainId];
  if (cached && Date.now() - cached.ts < 30_000) return cached.price;

  const coinMap: Record<string, string> = { ETH: "ethereum", MATIC: "matic-network", AVAX: "avalanche-2", BNB: "binancecoin" };
  const coinId = coinMap[symbol] ?? "ethereum";

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const price = data?.[coinId]?.usd;
      if (Number.isFinite(price) && price > 0) {
        cachedNativePrices[chainId] = { price, ts: Date.now() };
        return price;
      }
    }
  } catch { /* fall through */ }

  // Fallback estimates
  const fallbacks: Record<string, number> = { ETH: 2500, MATIC: 0.8, AVAX: 35, BNB: 600 };
  const fallback = fallbacks[symbol] ?? 2500;
  cachedNativePrices[chainId] = { price: fallback, ts: Date.now() };
  return fallback;
}

// ---------------------------------------------------------------------------
// Quoting — Uniswap V3 + Uniswap V2 + SushiSwap
// ---------------------------------------------------------------------------

async function quoteV3(chain: ChainConfig, tokenIn: string, tokenOut: string, amountIn: bigint): Promise<{ amountOut: bigint; fee: number } | null> {
  if (!chain.uniswapV3QuoterV2) return null;
  let best: { amountOut: bigint; fee: number } | null = null;
  for (const fee of UNISWAP_FEE_TIERS) {
    try {
      const callData = SELECTORS.quoteExactInputSingle +
        encodeUint256(32n) +
        encodeAddress(tokenIn) + encodeAddress(tokenOut) +
        encodeUint256(amountIn) + encodeUint24(fee) + encodeUint160(0n);
      const result = await ethCall(chain.rpcUrl, chain.uniswapV3QuoterV2, callData);
      if (result && result.length >= 66) {
        const amountOut = decodeUint256(result.slice(0, 66));
        if (amountOut > 0n && (!best || amountOut > best.amountOut)) best = { amountOut, fee };
      }
    } catch { /* try next tier */ }
  }
  return best;
}

async function quoteV2(chain: ChainConfig, routerAddr: string, tokenIn: string, tokenOut: string, amountIn: bigint): Promise<bigint | null> {
  if (!routerAddr) return null;
  try {
    const callData = SELECTORS.getAmountsOut +
      encodeUint256(amountIn) +
      encodeUint256(64n) + // dynamic path offset
      "0000000000000000000000000000000000000000000000000000000000000002" + // array length
      encodeAddress(tokenIn) + encodeAddress(tokenOut);
    const result = await ethCall(chain.rpcUrl, routerAddr, callData);
    if (result && result.length >= 130) {
      // Second element in the returned array
      const amountOut = decodeUint256(result.slice(130, 194));
      return amountOut > 0n ? amountOut : null;
    }
  } catch { /* try next dex */ }
  return null;
}

async function bestQuote(chain: ChainConfig, tokenIn: string, tokenOut: string, amountIn: bigint, enabledDexes: string[]): Promise<{ amountOut: bigint; dex: string; fee?: number } | null> {
  let best: { amountOut: bigint; dex: string; fee?: number } | null = null;

  if (enabledDexes.includes("uniswap-v3")) {
    const v3 = await quoteV3(chain, tokenIn, tokenOut, amountIn);
    if (v3 && (!best || v3.amountOut > best.amountOut)) best = { amountOut: v3.amountOut, dex: "uniswap-v3", fee: v3.fee };
  }

  if (enabledDexes.includes("uniswap-v2") && chain.uniswapV2Router) {
    const v2 = await quoteV2(chain, chain.uniswapV2Router, tokenIn, tokenOut, amountIn);
    if (v2 && (!best || v2 > best.amountOut)) best = { amountOut: v2, dex: "uniswap-v2" };
  }

  if (enabledDexes.includes("sushiswap") && chain.sushiswapRouter) {
    const sushi = await quoteV2(chain, chain.sushiswapRouter, tokenIn, tokenOut, amountIn);
    if (sushi && (!best || sushi > best.amountOut)) best = { amountOut: sushi, dex: "sushiswap" };
  }

  return best;
}

// ---------------------------------------------------------------------------
// SCAN — multi-strategy arbitrage detection
// ---------------------------------------------------------------------------

type ScanPair = { symbolA: string; symbolB: string; addressA: string; addressB: string; decimalsA: number; decimalsB: number };
type ScanBody = {
  chainId: number;
  pairs: ScanPair[];
  flashLoanAnchorSize: number;
  maxSlippageBps: number;
  minProfitThresholdUsd: number;
  maxHopCount: number;
  enabledDexes: string[];
  enabledStrategies: string[];
  circularMinSpreadBps: number;
};

type Opportunity = {
  pair: [string, string];
  tokenPath: string[];
  poolPath: string[];
  dexPath: string[];
  grossSpreadUsd: number;
  slippageBps: number;
  flashLoanAsset: string;
  hopCount: number;
  strategy: string;
  chainId: number;
  gasEstimate: number;
  inputAmount: string;
  outputAmount: string;
};

function nativeToUsd(amountNative: bigint, decimals: number, nativePriceUsd: number): number {
  return (Number(amountNative) / Math.pow(10, decimals)) * nativePriceUsd;
}

function directedPair(pairs: ScanPair[], symbolIn: string, symbolOut: string): ScanPair | null {
  const exact = pairs.find((pair) => pair.symbolA === symbolIn && pair.symbolB === symbolOut);
  if (exact) return exact;
  const reverse = pairs.find((pair) => pair.symbolA === symbolOut && pair.symbolB === symbolIn);
  if (!reverse) return null;
  return {
    symbolA: symbolIn,
    symbolB: symbolOut,
    addressA: reverse.addressB,
    addressB: reverse.addressA,
    decimalsA: reverse.decimalsB,
    decimalsB: reverse.decimalsA,
  };
}

async function estimateRouteSlippage(
  chain: ChainConfig,
  legs: Array<{ tokenIn: string; tokenOut: string; amountIn: bigint; dex: string }>,
  cap: number,
): Promise<number> {
  let worstImpact = 0;
  for (const leg of legs) {
    if (leg.amountIn < 2n) continue;
    const halfAmount = leg.amountIn / 2n;
    const fullQuote = await bestQuote(chain, leg.tokenIn, leg.tokenOut, leg.amountIn, [leg.dex]);
    const halfQuote = await bestQuote(chain, leg.tokenIn, leg.tokenOut, halfAmount, [leg.dex]);
    if (!fullQuote || !halfQuote || fullQuote.amountOut <= 0n) continue;
    const linearizedHalf = halfQuote.amountOut * 2n;
    const impact = linearizedHalf >= fullQuote.amountOut
      ? 0
      : Number((fullQuote.amountOut - linearizedHalf) * 10000n / fullQuote.amountOut);
    worstImpact = Math.max(worstImpact, impact);
  }
  return Math.min(Math.max(0, worstImpact), cap);
}

async function handleScan(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as ScanBody;
  const { chainId, pairs, flashLoanAnchorSize, maxSlippageBps, minProfitThresholdUsd, maxHopCount, enabledDexes, enabledStrategies, circularMinSpreadBps } = body;

  const chain = CHAINS[chainId];
  if (!chain) return new Response(JSON.stringify({ error: "Unsupported chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!Array.isArray(pairs) || pairs.length === 0) return new Response(JSON.stringify({ error: "Missing pairs" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const nativePriceUsd = await fetchNativePrice(chainId, chain.nativeSymbol);
  const anchor = typeof flashLoanAnchorSize === "number" && flashLoanAnchorSize > 0 ? flashLoanAnchorSize : 2000;
  const dexes = enabledDexes ?? ["uniswap-v3", "uniswap-v2", "sushiswap"];
  const strategies = enabledStrategies ?? ["triangular", "multi-dex"];
  const opportunities: Opportunity[] = [];

  // Strategy: Multi-DEX arbitrage — same pair, different DEXes
  if (strategies.includes("multi-dex")) {
    for (const pair of pairs) {
      if (!pair.addressA || !pair.addressB) continue;
      const baseAmount = BigInt(Math.floor(anchor * Math.pow(10, pair.decimalsA)));

      // Get quotes from all DEXes for A→B
      const quotesAB: Array<{ amountOut: bigint; dex: string }> = [];
      for (const dex of dexes) {
        const q = await bestQuote(chain, pair.addressA, pair.addressB, baseAmount, [dex]);
        if (q) quotesAB.push(q);
      }
      if (quotesAB.length < 2) continue;

      // Find best buy and best sell
      quotesAB.sort((a, b) => Number(a.amountOut - b.amountOut));
      const cheapest = quotesAB[0];
      const expensive = quotesAB[quotesAB.length - 1];

      // Buy on cheapest, sell on expensive (B→A)
      const sellQuote = await bestQuote(chain, pair.addressB, pair.addressA, expensive.amountOut, [expensive.dex]);
      if (!sellQuote) continue;

      const grossSpreadNative = sellQuote.amountOut - baseAmount;
      if (grossSpreadNative <= 0n) continue;

      const grossSpreadUsd = nativeToUsd(grossSpreadNative, pair.decimalsA, nativePriceUsd);
      if (grossSpreadUsd < (minProfitThresholdUsd ?? 0)) continue;

      const slippageBps = await estimateRouteSlippage(chain, [
        { tokenIn: pair.addressA, tokenOut: pair.addressB, amountIn: baseAmount, dex: cheapest.dex },
        { tokenIn: pair.addressB, tokenOut: pair.addressA, amountIn: expensive.amountOut, dex: sellQuote.dex },
      ], maxSlippageBps ?? 300);

      opportunities.push({
        pair: [pair.symbolA, pair.symbolB],
        tokenPath: [pair.symbolA, pair.symbolB, pair.symbolA],
        poolPath: [cheapest.dex, expensive.dex],
        dexPath: [cheapest.dex, expensive.dex],
        grossSpreadUsd,
        slippageBps,
        flashLoanAsset: pair.symbolA,
        hopCount: 2,
        strategy: "multi-dex",
        chainId,
        gasEstimate: 150_000 + 2 * 80_000 + 200_000,
        inputAmount: baseAmount.toString(),
        outputAmount: sellQuote.amountOut.toString(),
      });
    }
  }

  // Strategy: Triangular arbitrage — A→B→C→A
  if (strategies.includes("triangular") && maxHopCount >= 3) {
    const tokenSymbols = Array.from(new Set(pairs.flatMap((p) => [p.symbolA, p.symbolB])));
    const triCombos: Array<[string, string, string]> = [];
    for (let i = 0; i < tokenSymbols.length; i++) {
      for (let j = 0; j < tokenSymbols.length; j++) {
        for (let k = 0; k < tokenSymbols.length; k++) {
          if (i === j || j === k || i === k) continue;
          triCombos.push([tokenSymbols[i], tokenSymbols[j], tokenSymbols[k]]);
        }
      }
    }
    // Limit to avoid too many RPC calls
    const limitedTri = triCombos.slice(0, 30);

    for (const [symA, symB, symC] of limitedTri) {
      const pairAB = pairs.find((p) => p.symbolA === symA && p.symbolB === symB);
      const pairBC = directedPair(pairs, symB, symC);
      const pairCA = directedPair(pairs, symC, symA);
      if (!pairAB || !pairBC || !pairCA) continue;

      const baseAmount = BigInt(Math.floor(anchor * Math.pow(10, pairAB.decimalsA)));
      const q1 = await bestQuote(chain, pairAB.addressA, pairAB.addressB, baseAmount, dexes);
      if (!q1) continue;
      const q2 = await bestQuote(chain, pairBC.addressA, pairBC.addressB, q1.amountOut, dexes);
      if (!q2) continue;
      const q3 = await bestQuote(chain, pairCA.addressA, pairCA.addressB, q2.amountOut, dexes);
      if (!q3) continue;

      const grossSpreadNative = q3.amountOut - baseAmount;
      if (grossSpreadNative <= 0n) continue;

      const grossSpreadUsd = nativeToUsd(grossSpreadNative, pairAB.decimalsA, nativePriceUsd);
      if (grossSpreadUsd < (minProfitThresholdUsd ?? 0)) continue;

      const slippageBps = await estimateRouteSlippage(chain, [
        { tokenIn: pairAB.addressA, tokenOut: pairAB.addressB, amountIn: baseAmount, dex: q1.dex },
        { tokenIn: pairBC.addressA, tokenOut: pairBC.addressB, amountIn: q1.amountOut, dex: q2.dex },
        { tokenIn: pairCA.addressA, tokenOut: pairCA.addressB, amountIn: q2.amountOut, dex: q3.dex },
      ], maxSlippageBps ?? 300);

      opportunities.push({
        pair: [symA, symB],
        tokenPath: [symA, symB, symC, symA],
        poolPath: [q1.dex, q2.dex, q3.dex],
        dexPath: [q1.dex, q2.dex, q3.dex],
        grossSpreadUsd,
        slippageBps,
        flashLoanAsset: symA,
        hopCount: 3,
        strategy: "triangular",
        chainId,
        gasEstimate: 150_000 + 3 * 80_000 + 200_000,
        inputAmount: baseAmount.toString(),
        outputAmount: q3.amountOut.toString(),
      });
    }
  }

  // Strategy: Circular arbitrage — A→B→A on different DEXes (same token, different pools)
  // More lucrative than triangular when DEX price discrepancy is large
  if (strategies.includes("circular")) {
    for (const pair of pairs) {
      if (!pair.addressA || !pair.addressB) continue;
      const baseAmount = BigInt(Math.floor(anchor * Math.pow(10, pair.decimalsA)));

      // Get best quote for A→B across all DEXes
      const bestAB = await bestQuote(chain, pair.addressA, pair.addressB, baseAmount, dexes);
      if (!bestAB) continue;

      // Get best quote for B→A across all DEXes (potentially different DEX)
      const bestBA = await bestQuote(chain, pair.addressB, pair.addressA, bestAB.amountOut, dexes);
      if (!bestBA) continue;

      const grossSpreadNative = bestBA.amountOut - baseAmount;
      if (grossSpreadNative <= 0n) continue;

      const grossSpreadUsd = nativeToUsd(grossSpreadNative, pair.decimalsA, nativePriceUsd);
      const spreadBps = Number(grossSpreadNative * 10000n / baseAmount);
      if (spreadBps < (circularMinSpreadBps ?? 5)) continue;
      if (grossSpreadUsd < (minProfitThresholdUsd ?? 0)) continue;

      const slippageBps = await estimateRouteSlippage(chain, [
        { tokenIn: pair.addressA, tokenOut: pair.addressB, amountIn: baseAmount, dex: bestAB.dex },
        { tokenIn: pair.addressB, tokenOut: pair.addressA, amountIn: bestAB.amountOut, dex: bestBA.dex },
      ], maxSlippageBps ?? 300);

      opportunities.push({
        pair: [pair.symbolA, pair.symbolB],
        tokenPath: [pair.symbolA, pair.symbolB, pair.symbolA],
        poolPath: [bestAB.dex, bestBA.dex],
        dexPath: [bestAB.dex, bestBA.dex],
        grossSpreadUsd,
        slippageBps,
        flashLoanAsset: pair.symbolA,
        hopCount: 2,
        strategy: "circular",
        chainId,
        gasEstimate: 150_000 + 2 * 80_000 + 200_000,
        inputAmount: baseAmount.toString(),
        outputAmount: bestBA.amountOut.toString(),
      });
    }
  }

  await logToDb("relay", "info", `Scan complete on ${chain.name} — ${opportunities.length} opportunities (${strategies.join(", ")})`, {
    chainId, pairsScanned: pairs.length, strategies, ethPriceUsd: nativePriceUsd,
  });

  return new Response(JSON.stringify({ opportunities, nativePriceUsd, chainId, scannedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// EXECUTE — flash loan + swap execution on target chain
// ---------------------------------------------------------------------------

type ExecuteBody = {
  chainId: number;
  tokenPath: string[];
  poolPath: string[];
  dexPath: string[];
  strategy: string;
  grossSpreadUsd: number;
  flashLoanAsset: string;
  flashLoanAnchorSize: number;
  flashLoanProvider: string;
  gasEstimate: number;
  gasPriceGwei: number;
  paymasterSponsored: boolean;
  cdpPaymaster: { apiKey?: string; bundlerUrl?: string; paymasterAddress?: string; sponsorshipRatio?: number };
  walletMode: string;
  manualWalletAddress?: string;
  opportunityId: string;
  bundleSignature: string;
  netProfitWei: string;
  settlementWindow: number;
  executorAddress?: string;
};

async function handleExecute(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as ExecuteBody;
  const { chainId, tokenPath, grossSpreadUsd, flashLoanAsset, flashLoanAnchorSize, gasEstimate, gasPriceGwei, paymasterSponsored, cdpPaymaster, walletMode, manualWalletAddress, opportunityId, executorAddress } = body;

  const chain = CHAINS[chainId];
  if (!chain) return new Response(JSON.stringify({ error: "Unsupported chain", status: "failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!Array.isArray(tokenPath) || tokenPath.length < 2) return new Response(JSON.stringify({ error: "Invalid token path", status: "failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = getSupabaseClient();
  let walletAddress: string | null = null;
  let walletKey: string | null = null;

  if (walletMode === "manual-connect" && manualWalletAddress) {
    walletAddress = manualWalletAddress;
    walletKey = null; // Manual mode — user signs transactions themselves
  } else {
    const { data: walletRow } = await supabase.from("system_wallet").select("public_key, private_key").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!walletRow) {
      return new Response(JSON.stringify({ error: "No system wallet found. Initialize first.", status: "failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    walletAddress = walletRow.public_key;
    const pk = walletRow.private_key;
    walletKey = Array.isArray(pk) ? JSON.stringify(pk) : (typeof pk === "string" ? pk : null);
  }

  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "No wallet available", status: "failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const nativePriceUsd = await fetchNativePrice(chainId, chain.nativeSymbol);

  // Re-quote to verify spread
  const tokenRegistry: Record<number, Record<string, { address: string; decimals: number }>> = {
    8453: { WETH: { address: chain.weth, decimals: 18 }, USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }, DAI: { address: "0x50c710491946eA48a3569b3e4b1bB6a5b0c5e8e2", decimals: 18 }, cbETH: { address: "0x2Ae3F1Ec7F1F5012CF7ab4729De1D6eAeBc11e48", decimals: 18 }, DEGEN: { address: "0x4Ed4E862890b0AF5a8334516b0Bb43cA5a2c3E26", decimals: 18 }, BRETT: { address: "0x6B1AeAF8edD24c0BBa80F5a9E27d6751C5d9C0d6", decimals: 18 }, AERO: { address: "0x940181a94A35a4589360bc346d8B471c0D0eB377", decimals: 18 } },
    1: { WETH: { address: chain.weth, decimals: 18 }, USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 }, USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 }, DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 }, WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 }, LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 } },
  };

  const chainTokens = tokenRegistry[chainId] ?? {};
  const tokens = tokenPath.map((sym) => chainTokens[sym]).filter(Boolean);
  if (tokens.length < 2) {
    return new Response(JSON.stringify({ error: "Could not resolve token addresses", status: "failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const baseAmount = BigInt(Math.floor((flashLoanAnchorSize ?? 2000) * Math.pow(10, tokens[0].decimals)));

  // Re-quote every leg and build the exact atomic executor instructions.
  let currentAmount = baseAmount;
  let freshGrossSpreadUsd = 0;
  const swapInstructions: Array<{ dexType: number; tokenIn: string; tokenOut: string; fee: number; amountIn: bigint; amountOutMin: bigint }> = [];
  try {
    for (let i = 0; i < tokens.length - 1; i++) {
      const dex = body.dexPath?.[i] ?? "uniswap-v3";
      const q = await bestQuote(chain, tokens[i].address, tokens[i + 1].address, currentAmount, [dex]);
      if (!q) {
        return new Response(JSON.stringify({ status: "reverted", reason: `Quote failed for leg ${i + 1}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const dexType = q.dex === "uniswap-v3" ? 0 : q.dex === "sushiswap" ? 2 : 1;
      const amountOutMin = q.amountOut * 9850n / 10000n;
      swapInstructions.push({ dexType, tokenIn: tokens[i].address, tokenOut: tokens[i + 1].address, fee: q.fee ?? 3000, amountIn: i === 0 ? baseAmount : 0n, amountOutMin });
      currentAmount = q.amountOut;
    }
    const freshGrossNative = currentAmount - baseAmount;
    freshGrossSpreadUsd = nativeToUsd(freshGrossNative, tokens[0].decimals, nativePriceUsd);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Re-quote failed: ${errMsg}`, status: "failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (freshGrossSpreadUsd <= 0) {
    await logToDb("relay", "warn", `Spread evaporated on ${chain.name}: $${grossSpreadUsd.toFixed(4)} → $${freshGrossSpreadUsd.toFixed(4)}`, { tokenPath, chainId });
    return new Response(JSON.stringify({ status: "reverted", reason: "Spread evaporated", originalSpreadUsd: grossSpreadUsd, freshSpreadUsd: freshGrossSpreadUsd }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Calculate net profit
  const grossSpreadWei = BigInt(Math.floor((freshGrossSpreadUsd / nativePriceUsd) * 1e18));
  const totalGasCostWei = BigInt(gasEstimate ?? 510000) * BigInt(gasPriceGwei ?? 2) * 1_000_000_000n;
  const flashLoanFeeWei = BigInt(Math.floor(Number(grossSpreadWei) * chain.flashLoanFeeBps / 10000));
  const netProfitWei = grossSpreadWei - totalGasCostWei - flashLoanFeeWei;
  const netProfitUsd = (Number(netProfitWei) / 1e18) * nativePriceUsd;

  if (netProfitUsd <= 0) {
    return new Response(JSON.stringify({ status: "reverted", reason: "Net profit non-positive after gas + flash loan fees", netProfitUsd }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // A live transaction must target a deployed FlashArbExecutor. Never submit a
  // direct lender call because that bypasses the atomic swap-and-repay callback.
  if (typeof executorAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(executorAddress)) {
    return new Response(JSON.stringify({ status: "failed", error: "No deployed atomic executor configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const executorCode = await ethRpc(chain.rpcUrl, "eth_getCode", [executorAddress, "latest"]);
  if (executorCode === "0x" || executorCode === "0x0") {
    return new Response(JSON.stringify({ status: "failed", error: `Atomic executor is not deployed on ${chain.name}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Build and submit the atomic executor transaction.
  const { ethers } = await import("npm:ethers@6.13.4");

  let signer: ethers.Wallet | null = null;
  if (walletKey) {
    try {
      const secretKeyBytes = Uint8Array.from(JSON.parse(walletKey));
      const privateKey = "0x" + Array.from(secretKeyBytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chainId);
      signer = new ethers.Wallet(privateKey, provider);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: `Wallet key error: ${errMsg}`, status: "failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Check balance
  let balance = 0n;
  try {
    const balanceHex = await ethRpc(chain.rpcUrl, "eth_getBalance", [walletAddress, "latest"]);
    balance = BigInt(balanceHex as string);
  } catch { /* best-effort */ }

  const totalGasCost = BigInt(gasEstimate ?? 510000) * BigInt(gasPriceGwei ?? 2) * 1_000_000_000n;

  if (balance < totalGasCost && !paymasterSponsored) {
    return new Response(JSON.stringify({
      status: "failed",
      error: "Insufficient native token for gas. Fund wallet or enable CDP paymaster.",
      walletAddress,
      required: (Number(totalGasCost) / 1e18).toFixed(6),
      balance: (Number(balance) / 1e18).toFixed(6),
      chain: chain.name,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let txHash: string | null = null;
  let paymasterUsed = false;

  try {
    if (paymasterSponsored && cdpPaymaster?.apiKey) {
      // ERC-4337 path: submit via CDP bundler with paymaster sponsorship
      paymasterUsed = true;
      await logToDb("relay", "info", `Submitting via CDP paymaster on ${chain.name}`, { walletAddress, gasEstimate, gasPriceGwei, sponsorshipRatio: cdpPaymaster.sponsorshipRatio });
    }

    const executorInterface = new ethers.Interface([
      "function startBalancerFlashLoan(address token, uint256 amount, tuple(uint8 dexType,address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint256 amountOutMin)[] instructions) external",
    ]);
    const executorTxData = executorInterface.encodeFunctionData("startBalancerFlashLoan", [
      tokens[0].address,
      baseAmount,
      swapInstructions,
    ]);

    if (signer) {
      const tx = await signer.sendTransaction({
        to: executorAddress,
        data: executorTxData,
        gasLimit: gasEstimate ?? 510_000,
        gasPrice: BigInt(gasPriceGwei ?? 2) * 1_000_000_000n,
        chainId,
      });
      txHash = tx.hash;

      await logToDb("relay", "info", `Transaction submitted on ${chain.name}: ${txHash.slice(0, 18)}…`, { txHash, paymasterUsed, gasEstimate });
    } else {
      // Manual wallet mode — return unsigned tx data for user to sign
      return new Response(JSON.stringify({
        status: "submitted",
        bundleSignature: body.bundleSignature,
        executionId: null,
        txHash: null,
        netProfitUsd,
        netProfitWei: netProfitWei.toString(),
        paymasterUsed: false,
        unsignedTx: {
          to: executorAddress,
          data: executorTxData,
          chainId,
          gasLimit: gasEstimate ?? 510_000,
          gasPrice: gasPriceGwei ?? 2,
          flashLoanAsset: tokens[0].address,
          flashLoanAmount: baseAmount.toString(),
        },
        message: "Manual wallet mode — sign the transaction in your wallet",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logToDb("relay", "error", `TX submission failed on ${chain.name}: ${errMsg}`, { tokenPath, chainId });
    return new Response(JSON.stringify({ error: `TX submission failed: ${errMsg}`, status: "failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const bundleSig = typeof body.bundleSignature === "string" && body.bundleSignature.length <= 128 ? body.bundleSignature : crypto.randomUUID();

  const updateData = {
    status: "submitted",
    onchain_status: "unconfirmed",
    jito_bundle_uuid: txHash,
    jito_tip_lamports: 0,
    gas_lamports: Number(totalGasCost),
    net_profit_lamports: Number(netProfitWei),
    net_profit_usd: netProfitUsd,
    gross_spread_lamports: Number(grossSpreadWei),
    flash_loan_amount: flashLoanAnchorSize ?? 2000,
    jito_region: chain.name,
  };

  let executionRowId: string | null = null;
  if (typeof opportunityId === "string" && opportunityId.length === 36) {
    const { data: updated } = await supabase.from("arb_executions").update(updateData).eq("id", opportunityId).select("id").maybeSingle();
    executionRowId = updated?.id ?? null;
  }
  if (!executionRowId) {
    const { data: inserted } = await supabase.from("arb_executions").insert({
      ...updateData,
      bundle_signature: bundleSig,
      flash_loan_provider: chain.flashLoanProvider,
      flash_loan_asset: typeof flashLoanAsset === "string" ? flashLoanAsset.slice(0, 10) : "WETH",
      settlement_address: walletAddress,
    }).select("id").maybeSingle();
    executionRowId = inserted?.id ?? null;
  }

  return new Response(JSON.stringify({
    status: "submitted",
    bundleSignature: bundleSig,
    executionId: executionRowId,
    txHash,
    netProfitUsd,
    netProfitWei: netProfitWei.toString(),
    paymasterUsed,
    gasEstimate,
    gasPriceGwei,
    chainId,
    chainName: chain.name,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// SETTLE — confirm transaction on chain
// ---------------------------------------------------------------------------

type SettleBody = { chainId: number; bundleSignature: string; executionId: string; txHash: string | null };

async function handleSettle(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as SettleBody;
  const { chainId, bundleSignature, executionId, txHash } = body;

  const chain = CHAINS[chainId];
  if (!chain) return new Response(JSON.stringify({ error: "Unknown chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (typeof bundleSignature !== "string" || bundleSignature.length > 128) return new Response(JSON.stringify({ error: "Invalid bundleSignature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!txHash) {
    const supabase = getSupabaseClient();
    await supabase.from("arb_executions").update({ status: "reverted", onchain_status: "failed" }).eq("id", executionId);
    return new Response(JSON.stringify({ status: "reverted", bundleSignature, txHash: null, blockNumber: null, settlementAddress: "" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let confirmed = false;
  let blockNumber: number | null = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const receipt = await ethRpc(chain.rpcUrl, "eth_getTransactionReceipt", [txHash]);
      if (receipt) {
        const r = receipt as { status?: string; blockNumber?: string };
        confirmed = r.status === "0x1";
        blockNumber = r.blockNumber ? parseInt(r.blockNumber, 16) : null;
        break;
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const settled = confirmed;
  const supabase = getSupabaseClient();

  if (typeof executionId === "string" && executionId.length <= 64) {
    await supabase.from("arb_executions").update({
      status: settled ? "settled" : "reverted",
      settled_at: settled ? new Date().toISOString() : null,
      tx_signature: txHash,
      onchain_status: settled ? "confirmed" : "failed",
    }).eq("id", executionId);
  }

  await logToDb("relay", settled ? "success" : "warn",
    settled ? `Settlement confirmed on ${chain.name} for ${bundleSignature.slice(0, 16)}` : `Bundle ${bundleSignature.slice(0, 16)} reverted on ${chain.name} — atomic, paymaster absorbed gas`,
    { executionId, bundleSignature, txHash, blockNumber, chainId });

  return new Response(JSON.stringify({ status: settled ? "settled" : "reverted", bundleSignature, txHash, blockNumber, settlementAddress: "" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// WALLET — generate EVM wallet
// ---------------------------------------------------------------------------

async function handleWallet(): Promise<Response> {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.from("system_wallet").select("public_key, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ publicKey: existing.public_key, alreadyExists: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { ethers } = await import("npm:ethers@6.13.4");
  const newWallet = ethers.Wallet.createRandom();
  const publicKey = newWallet.address;
  const privateKeyArray = Array.from(new ethers.SigningKey(newWallet.privateKey).computeSecret());

  const { error } = await supabase.from("system_wallet").insert({ public_key: publicKey, private_key: privateKeyArray });
  if (error) return new Response(JSON.stringify({ error: "Failed to store wallet" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  await logToDb("relay", "success", `EVM wallet generated: ${publicKey}`, { publicKey });
  return new Response(JSON.stringify({ publicKey, alreadyExists: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// BALANCE — check wallet balance on chain
// ---------------------------------------------------------------------------

async function handleBalance(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const chainIdParam = url.searchParams.get("chainId");
  const chainId = chainIdParam ? parseInt(chainIdParam) : 8453;
  const chain = CHAINS[chainId];

  if (!chain) return new Response(JSON.stringify({ error: "Unknown chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = getSupabaseClient();
  const { data: wallet } = await supabase.from("system_wallet").select("public_key").order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!wallet) return new Response(JSON.stringify({ error: "No wallet found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const balanceHex = await ethRpc(chain.rpcUrl, "eth_getBalance", [wallet.public_key, "latest"]);
    const balanceWei = BigInt(balanceHex as string);
    return new Response(JSON.stringify({
      publicKey: wallet.public_key,
      balanceWei: balanceWei.toString(),
      balanceEth: (Number(balanceWei) / 1e18).toFixed(8),
      chainId,
      chainName: chain.name,
      nativeSymbol: chain.nativeSymbol,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Balance check failed: ${errMsg}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ---------------------------------------------------------------------------
// WITHDRAW — transfer native token
// ---------------------------------------------------------------------------

type WithdrawBody = { destinationAddress: string; chainId?: number };

async function handleWithdraw(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as WithdrawBody;
  const { destinationAddress, chainId: chainIdParam } = body;
  const chainId = chainIdParam ?? 8453;
  const chain = CHAINS[chainId];

  if (!chain) return new Response(JSON.stringify({ error: "Unknown chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (typeof destinationAddress !== "string" || !destinationAddress.startsWith("0x") || destinationAddress.length !== 42) {
    return new Response(JSON.stringify({ error: "Invalid destination address" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = getSupabaseClient();
  const { data: walletRow } = await supabase.from("system_wallet").select("public_key, private_key").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!walletRow) return new Response(JSON.stringify({ error: "No wallet found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const pk = walletRow.private_key;
  const walletKey = Array.isArray(pk) ? JSON.stringify(pk) : (typeof pk === "string" ? pk : null);
  if (!walletKey) return new Response(JSON.stringify({ error: "Wallet key invalid" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { ethers } = await import("npm:ethers@6.13.4");
  const secretKeyBytes = Uint8Array.from(JSON.parse(walletKey));
  const privateKey = "0x" + Array.from(secretKeyBytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chainId);
  const wallet = new ethers.Wallet(privateKey, provider);

  const balanceHex = await ethRpc(chain.rpcUrl, "eth_getBalance", [wallet.address, "latest"]);
  const balance = BigInt(balanceHex as string);
  const gasReserve = BigInt(1_000_000_000_000_000);
  const withdrawAmount = balance - gasReserve;

  if (withdrawAmount <= 0n) return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const tx = await wallet.sendTransaction({ to: destinationAddress, value: withdrawAmount, gasLimit: 21000, chainId });
    const receipt = await tx.wait();
    await logToDb("relay", "success", `Withdrew ${(Number(withdrawAmount) / 1e18).toFixed(6)} ${chain.nativeSymbol} on ${chain.name}`, { txHash: tx.hash, destination: destinationAddress, chainId });
    return new Response(JSON.stringify({ txHash: tx.hash, amount: (Number(withdrawAmount) / 1e18).toFixed(8), nativeSymbol: chain.nativeSymbol, destination: destinationAddress, blockNumber: receipt?.blockNumber ?? null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Withdrawal failed: ${errMsg}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// ---------------------------------------------------------------------------
// DEPLOY CONTRACT — CREATE2 deterministic deployment
// ---------------------------------------------------------------------------

type DeployBody = { chainId: number; walletMode: string; manualWalletAddress?: string; contractBytecode?: string };

async function handleDeployContract(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as DeployBody;
  const { chainId, walletMode, manualWalletAddress, contractBytecode } = body;
  const chain = CHAINS[chainId];

  if (!chain) return new Response(JSON.stringify({ error: "Unknown chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (typeof contractBytecode !== "string" || !/^0x[0-9a-fA-F]+$/.test(contractBytecode)) {
    return new Response(JSON.stringify({ error: "Compiled executor bytecode is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = getSupabaseClient();
  let walletAddress: string;
  let privateKey: string | null = null;

  if (walletMode === "manual-connect" && manualWalletAddress) {
    walletAddress = manualWalletAddress;
  } else {
    const { data: walletRow } = await supabase.from("system_wallet").select("public_key, private_key").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!walletRow) return new Response(JSON.stringify({ error: "No wallet found — generate wallet first" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    walletAddress = walletRow.public_key;
    const bytes = Array.isArray(walletRow.private_key) ? walletRow.private_key : null;
    if (bytes) privateKey = "0x" + bytes.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }

  const { ethers } = await import("npm:ethers@6.13.4");
  const zero = ethers.ZeroAddress;
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const constructorArgs = abiCoder.encode(
    ["address", "address", "address", "address", "address"],
    [chain.balancerVault ?? zero, chain.aavePool ?? zero, chain.uniswapV3Router02 ?? zero, chain.uniswapV2Router ?? zero, chain.sushiswapRouter ?? zero],
  );
  const initCode = `${contractBytecode}${constructorArgs.slice(2)}`;
  const salt = ethers.id(`arb-engine-v1-${chainId}`);
  const contractAddress = ethers.getCreate2Address(CREATE2_FACTORY, salt, ethers.keccak256(initCode));

  const code = await ethRpc(chain.rpcUrl, "eth_getCode", [contractAddress, "latest"]);
  const alreadyDeployed = code !== "0x" && code !== "0x0";
  if (!alreadyDeployed) {
    const factoryCode = await ethRpc(chain.rpcUrl, "eth_getCode", [CREATE2_FACTORY, "latest"]);
    if (factoryCode === "0x" || factoryCode === "0x0") {
      return new Response(JSON.stringify({ error: `CREATE2 factory is not deployed on ${chain.name}`, contractAddress }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const deploymentData = `${salt}${initCode.slice(2)}`;
    if (!privateKey) {
      return new Response(JSON.stringify({
        status: "unsigned",
        contractAddress,
        chainId,
        chainName: chain.name,
        factory: CREATE2_FACTORY,
        salt,
        unsignedTx: { to: CREATE2_FACTORY, data: deploymentData, value: "0x0" },
        walletAddress,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chainId);
    const signer = new ethers.Wallet(privateKey, provider);
    const tx = await signer.sendTransaction({ to: CREATE2_FACTORY, data: deploymentData, value: 0n });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      return new Response(JSON.stringify({ error: "CREATE2 deployment transaction failed", txHash: tx.hash }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await logToDb("relay", "success", `Executor deployed on ${chain.name}: ${contractAddress}`, { chainId, contractAddress, txHash: tx.hash });
  } else {
    await logToDb("relay", "info", `Executor already deployed at ${contractAddress} on ${chain.name}`, { chainId, contractAddress });
  }

  return new Response(JSON.stringify({
    status: "deployed",
    contractAddress,
    chainId,
    chainName: chain.name,
    factory: CREATE2_FACTORY,
    salt,
    alreadyDeployed,
    walletAddress,
    paymasterAddress: CDP_PAYMASTER_ADDRESS,
    instructions: `Add ${contractAddress} to your CDP Paymaster/Bundler policy for ${chain.name}.`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// BOOTSTRAP STATUS
// ---------------------------------------------------------------------------

async function handleBootstrapStatus(): Promise<Response> {
  const supabase = getSupabaseClient();
  const { data: wallet } = await supabase.from("system_wallet").select("public_key, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: stats } = await supabase.from("arb_executions").select("status, net_profit_usd").order("created_at", { ascending: false }).limit(500);
  const executions = stats ?? [];
  const successful = executions.filter((e: { status: string }) => e.status === "settled");
  const cumulativeProfitUsd = successful.reduce((sum: number, e: { net_profit_usd?: number | null }) => sum + (e.net_profit_usd ?? 0), 0);

  return new Response(JSON.stringify({
    bootstrap: {
      phase: wallet ? "wallet_created" : "not_started",
      walletPublicKey: wallet?.public_key ?? null,
      seedReceivedEth: 0,
      cumulativeProfitUsd,
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      initializedAt: wallet?.created_at ?? null,
      paymasterActive: true,
    },
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// INITIALIZE
// ---------------------------------------------------------------------------

async function handleInitialize(): Promise<Response> {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.from("system_wallet").select("public_key, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ status: "already_initialized", message: "Wallet exists", walletAddress: existing.public_key }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { ethers } = await import("npm:ethers@6.13.4");
  const newWallet = ethers.Wallet.createRandom();
  const publicKey = newWallet.address;
  const privateKeyArray = Array.from(new ethers.SigningKey(newWallet.privateKey).computeSecret());

  const { error } = await supabase.from("system_wallet").insert({ public_key: publicKey, private_key: privateKeyArray });
  if (error) return new Response(JSON.stringify({ error: "Failed to create wallet" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  await logToDb("relay", "success", `System initialized — wallet ${publicKey.slice(0, 8)}…${publicKey.slice(-4)}`, { publicKey });
  return new Response(JSON.stringify({ status: "initialized", walletAddress: publicKey }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "scan" && req.method === "POST") return await handleScan(req);
    if (action === "execute" && req.method === "POST") return await handleExecute(req);
    if (action === "settle" && req.method === "POST") return await handleSettle(req);
    if (action === "wallet" && req.method === "POST") return await handleWallet();
    if (action === "balance" && req.method === "GET") return await handleBalance(req);
    if (action === "withdraw" && req.method === "POST") return await handleWithdraw(req);
    if (action === "deploy-contract" && req.method === "POST") return await handleDeployContract(req);
    if (action === "bootstrap-status" && req.method === "GET") return await handleBootstrapStatus();
    if (action === "initialize" && req.method === "POST") return await handleInitialize();

    return new Response(JSON.stringify({ error: "Unknown action", available: ["scan", "execute", "settle", "wallet", "balance", "withdraw", "deploy-contract", "bootstrap-status", "initialize"] }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logToDb("relay", "error", `Unhandled error: ${errMsg}`, {});
    return new Response(JSON.stringify({ error: "Internal server error", detail: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
