import { getSettings } from './settings';
import type { SpreadResult } from './scanner';
import type { CompiledBundle } from './compiler';
import { logEngine } from './logger';

export type RiskAssessment = {
  approved: boolean;
  reasons: string[];
  riskScore: number;
};

export function assessSpreadRisk(spread: SpreadResult): RiskAssessment {
  const s = getSettings();
  const reasons: string[] = [];
  let score = 0;

  if (spread.grossSpreadUsd < s.minProfitThresholdUsd) {
    reasons.push(`Gross spread ${spread.grossSpreadUsd.toFixed(4)} below ${s.minProfitThresholdUsd} minimum`);
    score += 40;
  }

  if (spread.slippageBps > s.maxSlippageBps) {
    reasons.push(`Slippage ${spread.slippageBps.toFixed(1)}bps exceeds ${s.maxSlippageBps}bps cap`);
    score += 30;
  }

  if (spread.hopCount > s.maxHopCount) {
    reasons.push(`Hop count ${spread.hopCount} exceeds max ${s.maxHopCount}`);
    score += 20;
  }

  if (spread.gasEstimate > s.baseGasUnits + s.maxHopCount * s.gasPerSwapUnits) {
    reasons.push(`Gas estimate ${spread.gasEstimate} exceeds budget`);
    score += 15;
  }

  // Circular arb requires higher minimum spread
  if (spread.strategy === 'circular' && spread.slippageBps < s.circularMinSpreadBps) {
    reasons.push(`Circular spread ${spread.slippageBps}bps below circular minimum ${s.circularMinSpreadBps}bps`);
    score += 10;
  }

  if (spread.slippageBps > 100 && spread.slippageBps < s.maxSlippageBps) {
    reasons.push(`Elevated slippage ${spread.slippageBps.toFixed(1)}bps — monitoring`);
    score += 5;
  }

  const approved = score < 50;
  return { approved, reasons, riskScore: score };
}

export function assessBundleRisk(bundle: CompiledBundle): RiskAssessment {
  const s = getSettings();
  const reasons: string[] = [];
  let score = 0;

  if (bundle.netProfitUsd < s.minProfitThresholdUsd) {
    reasons.push(`Net profit ${bundle.netProfitUsd.toFixed(4)} below threshold`);
    score += 50;
  }

  if (bundle.netProfitWei <= 0n) {
    reasons.push('Net wei non-positive');
    score += 100;
  }

  const gasCostUsd = Number(bundle.totalGasCostWei) / 1e18 * bundle.nativePriceUsd;
  const feeRatio = gasCostUsd / Math.max(0.01, bundle.grossSpreadUsd);
  if (feeRatio * 100 > s.feeRatioCapPct) {
    reasons.push(`Gas cost ratio ${(feeRatio * 100).toFixed(1)}% exceeds ${s.feeRatioCapPct}% cap`);
    score += 20;
  }

  if (bundle.tokenPath.length > s.maxInstructionCount) {
    reasons.push(`Token path length ${bundle.tokenPath.length} exceeds max ${s.maxInstructionCount}`);
    score += 10;
  }

  if (bundle.gasPriceGwei > s.maxGasPriceGwei) {
    reasons.push(`Gas price ${bundle.gasPriceGwei}gwei exceeds ${s.maxGasPriceGwei}gwei cap`);
    score += 15;
  }

  const approved = score < 50;
  return { approved, reasons, riskScore: score };
}

export async function logRiskDecision(
  component: 'scanner' | 'compiler',
  assessment: RiskAssessment,
  context: Record<string, unknown>,
): Promise<void> {
  await logEngine('risk', assessment.approved ? 'info' : 'warn', `Risk ${assessment.approved ? 'approved' : 'rejected'} (score ${assessment.riskScore})`, {
    reasons: assessment.reasons,
    ...context,
  });
}
