import { useEffect, useState } from 'react';
import { startEngine, stopEngine, isRunning, type EngineMetrics } from '@/engine/orchestrator';
import { getSettings, updateSettings, subscribeToSettings, hydrateSettings } from '@/engine/settings';
import { useEngineMetrics, MetricsPanel } from '@/components/MetricsPanel';
import { OpportunityFeed } from '@/components/OpportunityFeed';
import { ExecutionFeed } from '@/components/ExecutionFeed';
import { LogFeed } from '@/components/LogFeed';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ExecutionDetail } from '@/components/ExecutionDetail';
import { WalletPanel } from '@/components/WalletPanel';
import { SetupWizard } from '@/components/SetupWizard';
import { MonitoringPanel } from '@/components/MonitoringPanel';
import { CHAINS, type ChainId } from '@/engine/constants';
import { runScanCycle } from '@/engine/scanner';
import {
  Play, Pause, Zap, ShieldCheck, Settings, FlaskConical,
  Globe, AlertTriangle, ArrowLeft, Activity, Radar, Eye, X,
} from 'lucide-react';

type AppView = 'setup' | 'dashboard';

type DashboardTab = 'overview' | 'monitoring' | 'wallet';

function ChainBadge({ chainId }: { chainId: ChainId }) {
  const chain = CHAINS[chainId];
  if (!chain) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-400 font-mono">
      <Globe className="w-3 h-3" />
      {chain.name}
    </span>
  );
}

function DryRunBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <FlaskConical className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-300">Dry Run Mode Active</p>
        <p className="text-[11px] text-amber-400/60 mt-0.5">
          Opportunities are scanned and logged but no transactions are submitted. All profit calculations are real. Disable in Settings to enable live execution.
        </p>
      </div>
    </div>
  );
}

function App() {
  const metrics = useEngineMetrics();
  const [running, setRunning] = useState(isRunning());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('setup');
  const [settings, setSettings] = useState(getSettings());
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [manualScanning, setManualScanning] = useState(false);

  useEffect(() => {
    setRunning(isRunning());
  }, [metrics?.status]);

  useEffect(() => {
    const unsub = subscribeToSettings(setSettings);
    void hydrateSettings();
    return unsub;
  }, []);

  const toggleEngine = async () => {
    if (running) {
      await stopEngine();
      setRunning(false);
    } else {
      await startEngine();
      setRunning(true);
    }
  };

  const toggleDryRun = () => {
    updateSettings({ autoExecute: !settings.autoExecute });
  };

  const manualScan = async () => {
    setManualScanning(true);
    try {
      await runScanCycle();
    } finally {
      setManualScanning(false);
    }
  };

  const isDryRun = !settings.autoExecute;
  const primaryChain = settings.primaryChain;
  const activeChains = settings.activeChains;

  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/30 blur-xl rounded-full" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-white" fill="white" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">EVM Arbitrage Engine</h1>
              <p className="text-[11px] text-slate-500">Multi-chain · Balancer V2 · Uniswap V3 · CDP Paymaster</p>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-1">Initial Setup</h2>
            <p className="text-sm text-slate-500">Configure your wallet, paymaster, and deploy the flash loan contract. This takes about 2 minutes.</p>
          </div>
          <SetupWizard onComplete={() => setView('dashboard')} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/30 blur-xl rounded-full" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" fill="white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">EVM Arbitrage Engine</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500">Balancer V2 · Uniswap V3 · CDP Paymaster</p>
                {activeChains.map((c) => (
                  <ChainBadge key={c} chainId={c} />
                ))}
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Tab navigation */}
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'overview' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'monitoring' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Monitoring
              </button>
              <button
                onClick={() => setActiveTab('wallet')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'wallet' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Wallet
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">{CHAINS[primaryChain]?.name ?? 'Multi-chain'} Relay</span>
            </div>

            {/* Dry run toggle */}
            <button
              onClick={toggleDryRun}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isDryRun
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'text-slate-400 border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'
              }`}
              title={isDryRun ? 'Dry Run ON — click to enable live execution' : 'Click to enable Dry Run (scan only, no execution)'}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isDryRun ? 'Dry Run' : 'Live'}</span>
            </button>

            {/* Manual scan button */}
            <button
              onClick={manualScan}
              disabled={manualScanning || running}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
              title="Run a single scan cycle now"
            >
              <Radar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{manualScanning ? 'Scanning…' : 'Scan Now'}</span>
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm text-slate-300 border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={toggleEngine}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                running
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              {running ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Start</>}
            </button>
          </div>
        </div>

        {/* Mobile tab navigation */}
        <div className="md:hidden border-t border-slate-800 px-6 py-2 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${activeTab === 'overview' ? 'bg-slate-800 text-slate-200' : 'text-slate-500'}`}
          >
            <Activity className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${activeTab === 'monitoring' ? 'bg-slate-800 text-slate-200' : 'text-slate-500'}`}
          >
            <Eye className="w-3.5 h-3.5" /> Monitor
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${activeTab === 'wallet' ? 'bg-slate-800 text-slate-200' : 'text-slate-500'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Wallet
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
        {/* Back to setup button */}
        <button
          onClick={() => setView('setup')}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Setup
        </button>

        {isDryRun && <DryRunBanner />}

        {metrics && <MetricsPanel metrics={metrics as EngineMetrics} />}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-1">
                <WalletPanel />
              </div>

              <div className="xl:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-slate-200">Scan Activity</h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    {activeChains.map((c) => CHAINS[c]?.shortName).join(' + ')} · {settings.enabledStrategies?.join(', ')}
                  </span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] text-slate-500">Flash Loan</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">${settings.flashLoanAnchorSize?.toLocaleString() ?? '2,000'}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">Balancer V2 · 0% fee</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] text-slate-500">Min Profit</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">${settings.minProfitThresholdUsd?.toFixed(2) ?? '0.10'}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">after gas + fees</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] text-slate-500">DEXes</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">{settings.enabledDexes?.length ?? 4}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{(settings.enabledDexes ?? ['uniswap-v3', 'uniswap-v2', 'sushiswap', '1inch']).slice(0, 2).join(', ')}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <p className="text-[11px] text-slate-500">Strategies</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">{settings.enabledStrategies?.length ?? 3}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">circ · tri · multi-dex</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden h-[420px]">
                <OpportunityFeed />
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden h-[420px]">
                <ExecutionFeed onSelect={setSelectedExecutionId} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden h-[360px]">
              <LogFeed />
            </div>
          </>
        )}

        {/* Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <MonitoringPanel />
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <WalletPanel />
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-slate-200">Chain Configuration</h2>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {activeChains.map((c) => {
                  const chain = CHAINS[c];
                  if (!chain) return null;
                  return (
                    <div key={c} className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">{chain.name}</span>
                        <ChainBadge chainId={c} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Flash Loan:</span>{' '}
                          <span className="text-slate-300">{chain.flashLoanProvider} ({chain.flashLoanFeeBps / 100}%)</span>
                        </div>
                        <div>
                          <span className="text-slate-500">DEXes:</span>{' '}
                          <span className="text-slate-300">V3, V2, Sushi</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800/60 text-slate-300 border border-slate-700 hover:bg-slate-700/60 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Configure Chains & RPC in Settings
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="pt-2 pb-8 text-center text-xs text-slate-600">
          Balancer V2 zero-fee flash loans · Uniswap V3/V2 + SushiSwap + 1inch · ERC-4337 CDP paymaster · Multi-chain EVM
        </footer>
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {selectedExecutionId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedExecutionId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="pointer-events-auto max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-end mb-2">
                <button onClick={() => setSelectedExecutionId(null)} className="p-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ExecutionDetail executionId={selectedExecutionId} onClose={() => setSelectedExecutionId(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
