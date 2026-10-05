import { useCallback, useEffect, useState } from 'react';
import { Rocket, Loader2, Check, AlertCircle, Copy, ArrowRight, TrendingUp, Wallet, Fuel } from 'lucide-react';

const RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-relay`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type BootstrapData = {
  phase: string;
  walletPublicKey: string | null;
  seedRequiredEth: number;
  seedReceivedEth: number;
  cumulativeProfitEth: number;
  cumulativeProfitUsd: number;
  totalExecutions: number;
  successfulExecutions: number;
  estimatedBreakevenExecutions: number;
  initializedAt: string | null;
  fundedAt: string | null;
  selfSustainingAt: string | null;
  paymasterActive: boolean;
};

type InitResponse = {
  status: string;
  message?: string;
  walletAddress?: string;
  seedRequiredEth?: number;
  breakdown?: Record<string, number>;
  bootstrap?: BootstrapData;
};

export function InitializeWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'idle' | 'initializing' | 'awaiting-fund' | 'checking' | 'ready' | 'error'>('idle');
  const [initData, setInitData] = useState<InitResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBootstrapStatus = useCallback(async () => {
    try {
      const res = await fetch(`${RELAY_URL}?action=bootstrap-status`, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.bootstrap as BootstrapData;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchBootstrapStatus().then((state) => {
      if (!state) return;
      setBootstrap(state);
      if (state.phase === 'not_started') {
        setStep('idle');
      } else if (state.phase === 'wallet_created' || state.phase === 'awaiting_funding') {
        setStep('awaiting-fund');
      } else if (state.phase === 'funded' || state.phase === 'self_sustaining') {
        setStep('ready');
      }
    });
  }, [fetchBootstrapStatus]);

  const initialize = async () => {
    setStep('initializing');
    setError(null);
    try {
      const res = await fetch(`${RELAY_URL}?action=initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json() as InitResponse;
      if (!res.ok) {
        setError(data.message ?? 'Initialization failed');
        setStep('error');
        return;
      }
      setInitData(data);
      if (data.status === 'already_initialized' && data.bootstrap) {
        setBootstrap(data.bootstrap);
        if (data.bootstrap.phase === 'funded' || data.bootstrap.phase === 'self_sustaining') {
          setStep('ready');
        } else {
          setStep('awaiting-fund');
        }
      } else {
        setStep('awaiting-fund');
        if (data.bootstrap) setBootstrap(data.bootstrap);
      }
    } catch {
      setError('Network error during initialization');
      setStep('error');
    }
  };

  const checkFunding = async () => {
    setStep('checking');
    try {
      const res = await fetch(`${RELAY_URL}?action=balance`, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      if (!res.ok) {
        setStep('awaiting-fund');
        return;
      }
      const data = await res.json();
      if (data.balanceWei && BigInt(data.balanceWei) > 0n) {
        const state = await fetchBootstrapStatus();
        if (state) setBootstrap(state);
        setStep('ready');
      } else {
        setStep('awaiting-fund');
      }
    } catch {
      setStep('awaiting-fund');
    }
  };

  const copyAddress = () => {
    const addr = initData?.walletAddress ?? bootstrap?.walletPublicKey;
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const walletAddress = initData?.walletAddress ?? bootstrap?.walletPublicKey;
  const seedEth = initData?.seedRequiredEth ?? bootstrap?.seedRequiredEth ?? 0;
  const breakdown = initData?.breakdown;

  const phaseLabels: Record<string, string> = {
    'not_started': 'Not Started',
    'wallet_created': 'Wallet Created',
    'awaiting_funding': 'Awaiting Funding',
    'funded': 'Funded — Engine Ready',
    'self_sustaining': 'Self-Sustaining',
  };

  if (step === 'ready' && bootstrap) {
    const isSelfSustaining = bootstrap.phase === 'self_sustaining';
    const progress = seedEth > 0
      ? Math.min(100, (bootstrap.cumulativeProfitEth / seedEth) * 100)
      : 100;

    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-emerald-500/20 bg-emerald-500/10">
          <Check className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-emerald-300">System {isSelfSustaining ? 'Self-Sustaining' : 'Funded & Ready'}</h2>
          <span className="ml-auto text-xs text-emerald-400/60">{phaseLabels[bootstrap.phase]}</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Balance</p>
              <p className="text-sm font-semibold text-slate-200">
                {bootstrap.seedReceivedEth.toFixed(6)} <span className="text-xs text-slate-500">ETH</span>
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Profit Earned</p>
              <p className="text-sm font-semibold text-emerald-400">
                ${bootstrap.cumulativeProfitUsd.toFixed(4)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Executions</p>
              <p className="text-sm font-semibold text-slate-200">
                {bootstrap.successfulExecutions}/{bootstrap.totalExecutions}
              </p>
            </div>
          </div>

          {!isSelfSustaining && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Seed Repayment Progress</span>
                <span className="text-slate-300">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {bootstrap.estimatedBreakevenExecutions > 0
                  ? `Estimated breakeven in ~${Math.max(0, bootstrap.estimatedBreakevenExecutions - bootstrap.successfulExecutions)} more successful executions`
                  : 'Breakeven reached'}
              </p>
            </div>
          )}

          {isSelfSustaining && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-emerald-300">
                System has repaid its seed capital through arbitrage profits. All future revenue is net positive.
              </p>
            </div>
          )}

          <button
            onClick={onComplete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
        <Rocket className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-200">System Initialization</h2>
        <span className="ml-auto text-xs text-slate-500">Base L2 · Zero-capital bootstrap</span>
      </div>

      <div className="p-5 space-y-5">
        {step === 'idle' && (
          <>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">1. Generate EVM Wallet</p>
                  <p className="text-xs text-slate-500 mt-0.5">An Ethereum-compatible keypair is created for Base L2. The private key is stored securely and never leaves the server.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                  <Fuel className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">2. Fund Paymaster Deposit</p>
                  <p className="text-xs text-slate-500 mt-0.5">Send a small amount of ETH to the wallet. This deposits into the verifying paymaster, which sponsors gas for all executions. The paymaster is repaid from flash loan profits.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">3. Zero-Fee Flash Loans Self-Sustain</p>
                  <p className="text-xs text-slate-500 mt-0.5">Balancer V2 provides 0% fee flash loans. Arbitrage profits repay the paymaster deposit. Once repaid, all future revenue is net positive — no additional funding needed.</p>
                </div>
              </div>
            </div>

            <button
              onClick={initialize}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
            >
              <Rocket className="w-4 h-4" />
              Initialize System
            </button>
          </>
        )}

        {step === 'initializing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-400">Generating EVM wallet on Base L2…</p>
          </div>
        )}

        {(step === 'awaiting-fund' || step === 'checking') && walletAddress && (
          <>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <p className="text-xs text-cyan-300 mb-2 font-medium">Send ETH to this address (Base L2 network):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                  {walletAddress}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Minimum seed required</span>
                <span className="text-slate-200 font-semibold">{seedEth.toFixed(6)} ETH</span>
              </div>
              {breakdown && (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Paymaster deposit</span>
                    <span>{breakdown.paymasterDeposit?.toFixed(6) ?? '0.001'} ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Gas per execution</span>
                    <span>{breakdown.gasPerExecution?.toFixed(6) ?? '0.00005'} ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Paymaster coverage</span>
                    <span>{breakdown.paymasterCoveragePct ?? 90}%</span>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-300/80">
                After sending ETH, click check below. The system verifies the funding and unlocks the arbitrage engine.
                The paymaster sponsors gas for every transaction — you only need this small initial deposit.
              </p>
            </div>

            <button
              onClick={checkFunding}
              disabled={step === 'checking'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {step === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {step === 'checking' ? 'Checking…' : 'Check Funding Status'}
            </button>
          </>
        )}

        {step === 'error' && (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm text-slate-400">{error}</p>
            <button
              onClick={initialize}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 transition-all"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
