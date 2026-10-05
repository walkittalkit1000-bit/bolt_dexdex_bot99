import { useState } from 'react';
import { Fuel, Loader2, Check, AlertCircle, ExternalLink, Copy, KeyRound, Link2, ShieldCheck } from 'lucide-react';
import { getSettings, updateSettings, type CDPPaymasterConfig, type WalletMode } from '@/engine/settings';
import { CHAINS, CDP_PAYMASTER_ADDRESS } from '@/engine/constants';
import executorArtifact from '@/engine/FlashArbExecutor.json';

const RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arb-relay`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type Props = {
  onComplete: () => void;
};

type Step = 'wallet-mode' | 'wallet-generate' | 'wallet-connect' | 'paymaster' | 'paymaster-config' | 'deploy' | 'complete';

export function SetupWizard({ onComplete }: Props) {
  const settings = getSettings();
  const [step, setStep] = useState<Step>('wallet-mode');
  const [walletMode, setWalletMode] = useState<WalletMode>(settings.walletMode);
  const [manualAddress, setManualAddress] = useState(settings.manualWalletAddress);
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [paymaster, setPaymaster] = useState<CDPPaymasterConfig>(settings.cdpPaymaster);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateWallet = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${RELAY_URL}?action=wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ chainId: settings.primaryChain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to generate wallet');
        return;
      }
      setGeneratedAddress(data.publicKey);
      updateSettings({ walletMode: 'system-generated' });
      setStep('paymaster');
    } catch {
      setError('Network error during wallet generation');
    } finally {
      setGenerating(false);
    }
  };

  const connectManualWallet = () => {
    if (!manualAddress || !manualAddress.startsWith('0x') || manualAddress.length !== 42) {
      setError('Enter a valid EVM address (0x…)');
      return;
    }
    updateSettings({ walletMode: 'manual-connect', manualWalletAddress: manualAddress });
    setStep('paymaster');
  };

  const savePaymaster = () => {
    updateSettings({
      cdpPaymaster: {
        ...paymaster,
        paymasterAddress: paymaster.paymasterAddress || CDP_PAYMASTER_ADDRESS,
      },
    });
    setStep('deploy');
  };

  const deployContract = async () => {
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch(`${RELAY_URL}?action=deploy-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          chainId: settings.primaryChain,
          walletMode,
          manualWalletAddress: manualAddress,
          contractBytecode: executorArtifact.bytecode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Deployment failed');
        return;
      }
      setContractAddress(data.contractAddress);
      updateSettings({ executorAddress: data.contractAddress });
      setStep('complete');
    } catch {
      setError('Network error during contract deployment');
    } finally {
      setDeploying(false);
    }
  };

  const activeChain = CHAINS[settings.primaryChain];
  const walletAddress = walletMode === 'manual-connect' ? manualAddress : generatedAddress;

  // Step: Wallet mode selection
  if (step === 'wallet-mode') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Step 1: Wallet Setup</h2>
          <span className="ml-auto text-xs text-slate-500">{activeChain?.name}</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Choose how the signing wallet is managed. The wallet signs all arbitrage transactions and controls profits.</p>

          <button
            onClick={() => { setWalletMode('system-generated'); setStep('wallet-generate'); }}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-900/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 shrink-0">
              <KeyRound className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">System-Generated Wallet</p>
              <p className="text-xs text-slate-500 mt-0.5">A new EVM keypair is generated and stored securely. You control it via withdrawal functions.</p>
            </div>
          </button>

          <button
            onClick={() => { setWalletMode('manual-connect'); setStep('wallet-connect'); }}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-900/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <Link2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">Connect Existing Wallet</p>
              <p className="text-xs text-slate-500 mt-0.5">Use an existing EVM wallet address. You retain full control of the private keys.</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Step: Generate wallet
  if (step === 'wallet-generate') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <KeyRound className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Generate Signing Wallet</h2>
        </div>
        <div className="p-5 space-y-4">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-400">Generating EVM keypair on {activeChain?.name}…</p>
            </div>
          ) : generatedAddress ? (
            <>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-300">Wallet generated successfully</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500 font-medium">Wallet Address</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                    {generatedAddress}
                  </code>
                  <button onClick={() => copy(generatedAddress)} className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setStep('paymaster')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all">
                Continue to Paymaster Setup
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">A new EVM keypair will be generated for {activeChain?.name}. The private key is stored securely on the server and never exposed to the browser. You retain control through the withdrawal function.</p>
              <button onClick={generateWallet} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all">
                <KeyRound className="w-4 h-4" />
                Generate Wallet
              </button>
            </>
          )}
          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
        </div>
      </div>
    );
  }

  // Step: Connect existing wallet
  if (step === 'wallet-connect') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <Link2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Connect Your Wallet</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Enter your EVM wallet address. This wallet will sign arbitrage transactions on {activeChain?.name}. Your private keys remain in your wallet — we only use the public address for execution routing.</p>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Wallet Address</label>
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => { setManualAddress(e.target.value); setError(null); }}
              placeholder="0x…"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          <button onClick={connectManualWallet} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all">
            <Link2 className="w-4 h-4" />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Step: Paymaster intro
  if (step === 'paymaster') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <Fuel className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Step 2: CDP Paymaster Setup</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            The Coinbase Developer Platform (CDP) Paymaster sponsors gas fees for your transactions using ERC-4337 Account Abstraction.
            You deposit a small amount of ETH into the paymaster, and it pays gas for every arbitrage execution.
            The deposit is repaid from flash loan profits — maintaining zero user-side capital.
          </p>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-2">
            <p className="text-xs text-amber-300 font-medium">How it works:</p>
            <ol className="text-xs text-amber-300/70 space-y-1 list-decimal list-inside">
              <li>You deposit ETH into the CDP Paymaster contract</li>
              <li>The paymaster sponsors gas for every flash loan execution</li>
              <li>Profits from arbitrage repay the paymaster deposit</li>
              <li>Once repaid, all future revenue is net positive</li>
            </ol>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Paymaster Address (CDP canonical)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                {CDP_PAYMASTER_ADDRESS}
              </code>
              <button onClick={() => copy(CDP_PAYMASTER_ADDRESS)} className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          <button onClick={() => setStep('paymaster-config')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all">
            Configure Paymaster
          </button>
          <button onClick={() => { updateSettings({ cdpPaymaster: { ...paymaster, enabled: false } }); setStep('deploy'); }} className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Skip paymaster (self-fund gas instead)
          </button>
        </div>
      </div>
    );
  }

  // Step: Paymaster config
  if (step === 'paymaster-config') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <Fuel className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Configure CDP Paymaster</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">CDP API Key</label>
            <input
              type="password"
              value={paymaster.apiKey}
              onChange={(e) => setPaymaster({ ...paymaster, apiKey: e.target.value })}
              placeholder="Your Coinbase Developer Platform API key"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
            <p className="text-[11px] text-slate-600">Get your API key from the Coinbase Developer Platform dashboard.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Bundler URL (optional)</label>
            <input
              type="text"
              value={paymaster.bundlerUrl}
              onChange={(e) => setPaymaster({ ...paymaster, bundlerUrl: e.target.value })}
              placeholder="https://api.developer.coinbase.com/rpc/…"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Gas Sponsorship Ratio: {paymaster.sponsorshipRatio}%</label>
            <input
              type="range"
              min="0" max="100" step="10"
              value={paymaster.sponsorshipRatio}
              onChange={(e) => setPaymaster({ ...paymaster, sponsorshipRatio: parseInt(e.target.value) })}
              className="w-full h-1.5 accent-amber-500 rounded-full cursor-pointer"
            />
            <p className="text-[11px] text-slate-600">100% = paymaster covers all gas. Lower ratios split gas cost between paymaster and wallet.</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Paymaster contract</span>
              <code className="text-slate-400 font-mono">{CDP_PAYMASTER_ADDRESS.slice(0, 10)}…</code>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

          <button onClick={savePaymaster} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all">
            <Check className="w-4 h-4" />
            Save Paymaster Configuration
          </button>
        </div>
      </div>
    );
  }

  // Step: Deploy contract via CREATE2
  if (step === 'deploy') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Step 3: Deploy Flash Arb Contract</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Deploy the FlashArbExecutor contract via CREATE2 factory for deterministic address generation.
            The contract is deployed at the same address on every chain, making paymaster setup simple.
          </p>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Wallet</span>
              <code className="text-slate-400 font-mono">{(walletAddress ?? '').slice(0, 10)}…</code>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Chain</span>
              <span className="text-slate-300">{activeChain?.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Flash loan provider</span>
              <span className="text-slate-300">{activeChain?.flashLoanProvider} ({activeChain?.flashLoanFeeBps / 100}% fee)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Paymaster</span>
              <span className="text-slate-300">{paymaster.enabled !== false ? 'CDP Paymaster' : 'Self-funded'}</span>
            </div>
          </div>

          {contractAddress && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-300 font-medium">Contract deployed successfully!</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono truncate">
                  {contractAddress}
                </code>
                <button onClick={() => copy(contractAddress)} className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
              <p className="text-[11px] text-emerald-300/60">Add this address to your CDP Paymaster/Bundler dashboard for initial gas funding.</p>
            </div>
          )}

          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

          {deploying ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-400">Deploying via CREATE2 factory on {activeChain?.name}…</p>
            </div>
          ) : contractAddress ? (
            <button onClick={() => setStep('complete')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all">
              Continue to Dashboard
            </button>
          ) : (
            <button onClick={deployContract} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all">
              <ShieldCheck className="w-4 h-4" />
              Deploy Contract
            </button>
          )}
        </div>
      </div>
    );
  }

  // Step: Complete
  if (step === 'complete') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-emerald-500/20 bg-emerald-500/10">
          <Check className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-emerald-300">Setup Complete</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Wallet</p>
              <p className="text-xs font-mono text-slate-300">{(walletAddress ?? '').slice(0, 8)}…{(walletAddress ?? '').slice(-4)}</p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Contract</p>
              <p className="text-xs font-mono text-slate-300">{(contractAddress ?? '').slice(0, 8)}…{(contractAddress ?? '').slice(-4)}</p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Chain</p>
              <p className="text-xs font-semibold text-slate-200">{activeChain?.name}</p>
            </div>
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Paymaster</p>
              <p className="text-xs font-semibold text-slate-200">{paymaster.enabled !== false ? 'CDP Active' : 'Self-funded'}</p>
            </div>
          </div>

          {contractAddress && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-300 mb-1 font-medium">Next step: Fund the paymaster</p>
              <p className="text-xs text-amber-300/70">
                Add the contract address to your CDP Paymaster/Bundler dashboard and deposit a small amount of ETH for initial gas sponsorship.
                The deposit will be repaid from arbitrage profits.
              </p>
              <a
                href="https://docs.cdp.coinbase.com/account-abstraction/docs/paymaster"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-400 mt-2 hover:underline"
              >
                CDP Paymaster Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <button onClick={onComplete} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all">
            Enter Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
