import { DEFAULT_CHAIN_ID, type ChainId, type DexPlatform, type ArbStrategy, ARB_STRATEGIES } from './constants';
import { supabase } from '@/lib/supabase';

export type WalletMode = 'system-generated' | 'manual-connect';

export type CDPPaymasterConfig = {
  enabled: boolean;
  apiKey: string;
  bundlerUrl: string;
  paymasterAddress: string;
  sponsorshipRatio: number;
};

export type EngineSettings = {
  activeChains: ChainId[];
  primaryChain: ChainId;
  walletMode: WalletMode;
  manualWalletAddress: string;
  executorAddress: string;
  cdpPaymaster: CDPPaymasterConfig;
  enabledDexes: DexPlatform[];
  enabledStrategies: ArbStrategy[];
  circularMinSpreadBps: number;
  scannerIntervalMs: number;
  flashLoanAnchorSize: number;
  maxSlippageBps: number;
  minProfitThresholdUsd: number;
  minSpreadBps: number;
  maxHopCount: number;
  maxGasPriceGwei: number;
  priorityGasPriceGwei: number;
  baseGasUnits: number;
  gasPerSwapUnits: number;
  settlementTimeoutMs: number;
  settlementPollIntervalMs: number;
  settlementMaxPolls: number;
  feeRatioCapPct: number;
  maxInstructionCount: number;
  autoExecute: boolean;
  maxConcurrentBundles: number;
};

const SETTINGS_KEY = 'arb-engine-settings-v2';
const SETTINGS_ROW_ID = 'default';

export const DEFAULT_SETTINGS: EngineSettings = {
  activeChains: [DEFAULT_CHAIN_ID],
  primaryChain: DEFAULT_CHAIN_ID,
  walletMode: 'system-generated',
  manualWalletAddress: '',
  executorAddress: '',
  cdpPaymaster: { enabled: false, apiKey: '', bundlerUrl: '', paymasterAddress: '', sponsorshipRatio: 100 },
  enabledDexes: ['uniswap-v3', 'uniswap-v2', 'sushiswap', '1inch'],
  enabledStrategies: [ARB_STRATEGIES.CIRCULAR, ARB_STRATEGIES.TRIANGULAR, ARB_STRATEGIES.MULTI_DEX],
  circularMinSpreadBps: 3,
  scannerIntervalMs: 12_000,
  flashLoanAnchorSize: 10_000,
  maxSlippageBps: 150,
  minProfitThresholdUsd: 0.05,
  minSpreadBps: 2,
  maxHopCount: 4,
  maxGasPriceGwei: 0.5,
  priorityGasPriceGwei: 0.01,
  baseGasUnits: 200_000,
  gasPerSwapUnits: 80_000,
  settlementTimeoutMs: 30_000,
  settlementPollIntervalMs: 2_000,
  settlementMaxPolls: 15,
  feeRatioCapPct: 30,
  maxInstructionCount: 12,
  autoExecute: false,
  maxConcurrentBundles: 3,
};

type SettingsListener = (settings: EngineSettings) => void;
let currentSettings: EngineSettings = loadLocalSettings();
let listeners: SettingsListener[] = [];
let hydrationPromise: Promise<void> | null = null;

function mergeSettings(parsed: Partial<EngineSettings>): EngineSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    cdpPaymaster: { ...DEFAULT_SETTINGS.cdpPaymaster, ...parsed.cdpPaymaster },
    activeChains: parsed.activeChains ?? DEFAULT_SETTINGS.activeChains,
    enabledDexes: parsed.enabledDexes ?? DEFAULT_SETTINGS.enabledDexes,
    enabledStrategies: parsed.enabledStrategies ?? DEFAULT_SETTINGS.enabledStrategies,
  };
}

function loadLocalSettings(): EngineSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? mergeSettings(JSON.parse(raw) as Partial<EngineSettings>) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveLocalSettings(settings: EngineSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The database remains the durable source when browser storage is unavailable.
  }
}

function durableSettings(settings: EngineSettings): EngineSettings {
  // Never place a paymaster secret in a public browser-readable table.
  return { ...settings, cdpPaymaster: { ...settings.cdpPaymaster, apiKey: '' } };
}

async function persistSettings(settings: EngineSettings): Promise<void> {
  const { error } = await supabase.from('engine_settings').upsert({
    id: SETTINGS_ROW_ID,
    settings: durableSettings(settings),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function hydrateSettings(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const { data, error } = await supabase
      .from('engine_settings')
      .select('settings')
      .eq('id', SETTINGS_ROW_ID)
      .maybeSingle();

    if (!error && data?.settings && typeof data.settings === 'object') {
      const remote = mergeSettings(data.settings as Partial<EngineSettings>);
      // Keep a locally entered secret while loading non-secret durable settings.
      remote.cdpPaymaster.apiKey = currentSettings.cdpPaymaster.apiKey;
      currentSettings = remote;
      saveLocalSettings(currentSettings);
      listeners.forEach((listener) => listener(getSettings()));
      return;
    }

    try {
      await persistSettings(currentSettings);
    } catch {
      // Local settings remain available during a database outage.
    }
  })().finally(() => {
    hydrationPromise = null;
  });
  return hydrationPromise;
}

export function getSettings(): EngineSettings {
  return { ...currentSettings, cdpPaymaster: { ...currentSettings.cdpPaymaster } };
}

export function updateSettings(partial: Partial<EngineSettings>): void {
  currentSettings = {
    ...currentSettings,
    ...partial,
    cdpPaymaster: { ...currentSettings.cdpPaymaster, ...partial.cdpPaymaster },
  };
  saveLocalSettings(currentSettings);
  void persistSettings(currentSettings).catch(() => undefined);
  listeners.forEach((listener) => listener(getSettings()));
}

export function resetSettings(): void {
  currentSettings = { ...DEFAULT_SETTINGS };
  saveLocalSettings(currentSettings);
  void persistSettings(currentSettings).catch(() => undefined);
  listeners.forEach((listener) => listener(getSettings()));
}

export function subscribeToSettings(callback: SettingsListener): () => void {
  if (listeners.includes(callback)) {
    return () => {
      listeners = listeners.filter((listener) => listener !== callback);
    };
  }

  listeners.push(callback);
  callback(getSettings());
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

