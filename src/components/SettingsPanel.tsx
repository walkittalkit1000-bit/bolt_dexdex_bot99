import { useEffect, useState } from 'react';
import {
  getSettings,
  updateSettings,
  resetSettings,
  subscribeToSettings,
  DEFAULT_SETTINGS,
  type EngineSettings,
} from '@/engine/settings';
import {
  Settings,
  Sliders,
  RotateCcw,
  Zap,
  Shield,
  Clock,
  Layers,
  DollarSign,
  Gauge,
  Fuel,
  CheckCircle2,
  Power,
  Globe,
  Network,
} from 'lucide-react';
import { CHAINS, type ChainId } from '@/engine/constants';

type Props = {
  open: boolean;
  onClose: () => void;
};

type NumberField = {
  key: keyof EngineSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  icon: React.ReactNode;
  group: 'scanner' | 'risk' | 'execution' | 'limits';
};

const NUMBER_FIELDS: NumberField[] = [
  { key: 'scannerIntervalMs', label: 'Scanner Interval', description: 'Time between scan cycles', min: 1000, max: 30000, step: 500, unit: 'ms', icon: <Clock className="w-3.5 h-3.5" />, group: 'scanner' },
  { key: 'minProfitThresholdUsd', label: 'Min Profit Threshold', description: 'Minimum net profit after gas costs', min: 0.01, max: 50, step: 0.01, unit: 'USD', icon: <DollarSign className="w-3.5 h-3.5" />, group: 'risk' },
  { key: 'maxSlippageBps', label: 'Max Slippage', description: 'Maximum acceptable slippage', min: 5, max: 500, step: 5, unit: 'bps', icon: <Gauge className="w-3.5 h-3.5" />, group: 'risk' },
  { key: 'minSpreadBps', label: 'Min Spread BPS', description: 'Minimum gross spread in basis points', min: 1, max: 200, step: 1, unit: 'bps', icon: <Gauge className="w-3.5 h-3.5" />, group: 'risk' },
  { key: 'flashLoanAnchorSize', label: 'Flash Loan Size', description: 'Borrow size in USD (Balancer V2, 0% fee)', min: 500, max: 100000, step: 500, unit: 'USD', icon: <Layers className="w-3.5 h-3.5" />, group: 'execution' },
  { key: 'maxGasPriceGwei', label: 'Max Gas Price', description: 'Maximum gas price for transactions on Base L2', min: 0.1, max: 20, step: 0.1, unit: 'gwei', icon: <Fuel className="w-3.5 h-3.5" />, group: 'execution' },
  { key: 'priorityGasPriceGwei', label: 'Priority Gas Price', description: 'Priority fee for faster inclusion', min: 0.1, max: 10, step: 0.1, unit: 'gwei', icon: <Zap className="w-3.5 h-3.5" />, group: 'execution' },
  { key: 'baseGasUnits', label: 'Base Gas Units', description: 'Base gas allocation per transaction', min: 50000, max: 500000, step: 10000, unit: 'gas', icon: <Zap className="w-3.5 h-3.5" />, group: 'limits' },
  { key: 'gasPerSwapUnits', label: 'Gas Per Swap', description: 'Additional gas per swap in the route', min: 20000, max: 200000, step: 5000, unit: 'gas', icon: <Gauge className="w-3.5 h-3.5" />, group: 'limits' },
  { key: 'maxHopCount', label: 'Max Hops', description: 'Maximum route hops per arbitrage path', min: 2, max: 8, step: 1, icon: <Layers className="w-3.5 h-3.5" />, group: 'limits' },
  { key: 'settlementTimeoutMs', label: 'Settlement Timeout', description: 'Window to confirm transaction on Base L2', min: 5000, max: 120000, step: 5000, unit: 'ms', icon: <Clock className="w-3.5 h-3.5" />, group: 'limits' },
  { key: 'maxConcurrentBundles', label: 'Max Concurrent Bundles', description: 'Maximum simultaneous executions', min: 1, max: 10, step: 1, icon: <Layers className="w-3.5 h-3.5" />, group: 'limits' },
  { key: 'feeRatioCapPct', label: 'Gas Cost Ratio Cap', description: 'Max percentage of gross spread consumed by gas', min: 10, max: 90, step: 5, unit: '%', icon: <Shield className="w-3.5 h-3.5" />, group: 'risk' },
  { key: 'maxInstructionCount', label: 'Max Path Length', description: 'Maximum tokens in arbitrage path', min: 3, max: 20, step: 1, icon: <Layers className="w-3.5 h-3.5" />, group: 'limits' },
];

const GROUP_LABELS: Record<NumberField['group'], { label: string; icon: React.ReactNode }> = {
  scanner: { label: 'Scanner', icon: <Clock className="w-3.5 h-3.5" /> },
  risk: { label: 'Risk Management', icon: <Shield className="w-3.5 h-3.5" /> },
  execution: { label: 'Execution', icon: <Zap className="w-3.5 h-3.5" /> },
  limits: { label: 'Limits & Budgets', icon: <Sliders className="w-3.5 h-3.5" /> },
};

function SettingRow({ field, value, onChange }: { field: NumberField; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{field.icon}</span>
          <span className="text-xs font-medium text-slate-300">{field.label}</span>
        </div>
        <span className="text-xs font-mono text-cyan-300">
          {value.toLocaleString()}{field.unit && <span className="text-slate-600 ml-0.5">{field.unit}</span>}
        </span>
      </div>
      <p className="text-[11px] text-slate-600 pl-5">{field.description}</p>
      <div className="flex items-center gap-2 pl-5">
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-cyan-500 rounded-full cursor-pointer"
        />
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || field.min)}
          className="w-20 px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
        />
      </div>
    </div>
  );
}

export function SettingsPanel({ open, onClose }: Props) {
  const [settings, setSettings] = useState<EngineSettings>(getSettings());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSettings((s) => setSettings(s));
    return unsub;
  }, []);

  const handleChange = (key: keyof EngineSettings, value: number | boolean) => {
    updateSettings({ [key]: value } as Partial<EngineSettings>);
    setHasChanges(true);
  };

  const handlePaymasterToggle = () => {
    updateSettings({ cdpPaymaster: { ...settings.cdpPaymaster, enabled: !settings.cdpPaymaster.enabled } });
    setHasChanges(true);
  };

  const groups: NumberField['group'][] = ['scanner', 'risk', 'execution', 'limits'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Engine Configuration</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={() => {
                  resetSettings();
                  setHasChanges(false);
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Esc
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Auto-execute toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.autoExecute ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
                <Power className={`w-4 h-4 ${settings.autoExecute ? 'text-emerald-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">Auto-Execute</p>
                <p className="text-[11px] text-slate-500">Automatically dispatch qualifying bundles</p>
              </div>
            </div>
            <button
              onClick={() => handleChange('autoExecute', !settings.autoExecute)}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.autoExecute ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.autoExecute ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Paymaster toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.cdpPaymaster.enabled ? 'bg-cyan-500/10' : 'bg-slate-800'}`}>
                <Fuel className={`w-4 h-4 ${settings.cdpPaymaster.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200">CDP Paymaster Gas Sponsorship</p>
                <p className="text-[11px] text-slate-500">ERC-4337 paymaster sponsors gas (repaid from profits)</p>
              </div>
            </div>
            <button
              onClick={handlePaymasterToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.cdpPaymaster.enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.cdpPaymaster.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Number field groups */}
          {groups.map((group) => (
            <div key={group} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{GROUP_LABELS[group].icon}</span>
                <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">{GROUP_LABELS[group].label}</h3>
              </div>
              <div className="space-y-4 pl-1">
                {NUMBER_FIELDS.filter((f) => f.group === group).map((field) => (
                  <SettingRow
                    key={field.key}
                    field={field}
                    value={settings[field.key] as number}
                    onChange={(v) => handleChange(field.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Chain selection & RPC configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-slate-500" />
              <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Chains & Private RPC</h3>
            </div>
            <div className="space-y-3 pl-1">
              {Object.values(CHAINS).map((chain) => {
                const isActive = settings.activeChains.includes(chain.chainId as ChainId);
                const rpcKey = chain.chainId;
                const rpcUrl = settings.privateRpcUrls?.[rpcKey] ?? '';
                return (
                  <div key={chain.chainId} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-300">{chain.name}</span>
                        <span className="text-[10px] text-slate-600">{chain.flashLoanProvider} · {chain.flashLoanFeeBps / 100}% fee</span>
                      </div>
                      <button
                        onClick={() => {
                          const newChains = isActive
                            ? settings.activeChains.filter((c) => c !== chain.chainId)
                            : [...settings.activeChains, chain.chainId as ChainId];
                          updateSettings({ activeChains: newChains.length > 0 ? newChains : settings.activeChains });
                          setHasChanges(true);
                        }}
                        className={`relative w-9 h-4.5 rounded-full transition-colors ${isActive ? 'bg-cyan-500' : 'bg-slate-700'}`}
                      >
                        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {isActive && (
                      <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => {
                          const newRpcs = { ...settings.privateRpcUrls, [rpcKey]: e.target.value };
                          updateSettings({ privateRpcUrls: newRpcs });
                          setHasChanges(true);
                        }}
                        placeholder={`Private RPC (default: ${chain.rpcUrl})`}
                        className="w-full px-2.5 py-1.5 rounded-md bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Defaults reference */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-[11px] text-slate-500">Default Values Reference</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-600">
              <span>Interval: {DEFAULT_SETTINGS.scannerIntervalMs}ms</span>
              <span>Threshold: ${DEFAULT_SETTINGS.minProfitThresholdUsd}</span>
              <span>Slippage: {DEFAULT_SETTINGS.maxSlippageBps}bps</span>
              <span>Gas Price: {DEFAULT_SETTINGS.priorityGasPriceGwei} gwei</span>
              <span>Base Gas: {DEFAULT_SETTINGS.baseGasUnits}</span>
              <span>Hops: {DEFAULT_SETTINGS.maxHopCount}</span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 px-5 py-3 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
