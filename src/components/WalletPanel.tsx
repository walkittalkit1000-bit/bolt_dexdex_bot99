import { useCallback, useEffect, useState } from 'react';
import { Wallet, Copy, RefreshCw, ArrowUpRight, Check, AlertCircle, Loader2 } from 'lucide-react';

type WalletState = {
  status: 'loading' | 'not-created' | 'exists' | 'created' | 'error';
  publicKey: string | null;
  balanceWei: string | null;
  balanceEth: string | null;
  fundedAt: string | null;
  error: string | null;
};

const RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-relay`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function WalletPanel() {
  const [wallet, setWallet] = useState<WalletState>({
    status: 'loading',
    publicKey: null,
    balanceWei: null,
    balanceEth: null,
    fundedAt: null,
    error: null,
  });
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${RELAY_URL}?action=balance`, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      if (res.status === 404) {
        setWallet({ status: 'not-created', publicKey: null, balanceWei: null, balanceEth: null, fundedAt: null, error: null });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWallet({ status: 'error', publicKey: null, balanceWei: null, balanceEth: null, fundedAt: null, error: data?.error ?? 'Failed to load wallet' });
        return;
      }
      const data = await res.json();
      setWallet({
        status: 'exists',
        publicKey: data.publicKey,
        balanceWei: data.balanceWei,
        balanceEth: data.balanceEth,
        fundedAt: null,
        error: null,
      });
    } catch {
      setWallet({ status: 'error', publicKey: null, balanceWei: null, balanceEth: null, fundedAt: null, error: 'Network error' });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const generateWallet = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${RELAY_URL}?action=wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setWallet({ status: 'error', publicKey: null, balanceWei: null, balanceEth: null, fundedAt: null, error: data?.error ?? 'Failed to create wallet' });
        return;
      }
      setWallet({
        status: 'created',
        publicKey: data.publicKey,
        balanceWei: '0',
        balanceEth: '0',
        fundedAt: null,
        error: null,
      });
    } catch {
      setWallet({ status: 'error', publicKey: null, balanceWei: null, balanceEth: null, fundedAt: null, error: 'Network error' });
    } finally {
      setGenerating(false);
    }
  };

  const copyAddress = () => {
    if (!wallet.publicKey) return;
    navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!withdrawAddress || !wallet.publicKey) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await fetch(`${RELAY_URL}?action=withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ destinationAddress: withdrawAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawResult(`Error: ${data?.error ?? 'Withdrawal failed'}`);
      } else {
        setWithdrawResult(`Withdrawn ${data.amountEth} ETH — tx: ${data.txHash?.slice(0, 18)}…`);
        setWithdrawAddress('');
        fetchWallet();
      }
    } catch {
      setWithdrawResult('Network error during withdrawal');
    } finally {
      setWithdrawing(false);
    }
  };

  const balanceEth = wallet.balanceEth ?? null;
  const isFunded = wallet.balanceWei !== null && BigInt(wallet.balanceWei) > 0n;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
        <Wallet className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-200">System Wallet</h2>
        <span className="ml-auto text-xs text-slate-500">Base L2 · Paymaster-sponsored</span>
      </div>

      <div className="p-5 space-y-4">
        {wallet.status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        )}

        {wallet.status === 'not-created' && (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm text-slate-400">No system wallet exists yet. Generate one to enable execution.</p>
            <button
              onClick={generateWallet}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Generate Wallet
            </button>
          </div>
        )}

        {wallet.status === 'error' && (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm text-slate-400">{wallet.error}</p>
            <button
              onClick={fetchWallet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {(wallet.status === 'exists' || wallet.status === 'created') && wallet.publicKey && (
          <>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">Wallet Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                  {wallet.publicKey}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all"
                  title="Copy address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Balance</p>
                <p className={`text-lg font-semibold ${isFunded ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {balanceEth ?? '—'} <span className="text-xs font-normal text-slate-500">ETH</span>
                </p>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {isFunded ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400">Funded</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-400">Awaiting Funding</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {!isFunded && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-300/80">
                  Send a small amount of ETH (0.001-0.01) to the address above on the Base L2 network.
                  This funds the paymaster deposit which sponsors gas for all arbitrage executions.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={fetchWallet}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh Balance
              </button>
            </div>

            {isFunded && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs text-slate-500 font-medium">Withdraw Profits</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="Destination Ethereum address (0x…)"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAddress}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    {withdrawing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    Withdraw
                  </button>
                </div>
                {withdrawResult && (
                  <p className="text-xs text-slate-400">{withdrawResult}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
