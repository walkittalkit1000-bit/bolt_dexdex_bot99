import { getSettings } from './settings';
import type { SpreadResult } from './scanner';
import type { CompiledBundle } from './compiler';
import { logEngine } from './logger';

export type RiskAssessment = {
  approved: boolean;
  reasons: string[];
  riskScore: number;
};

// Multi-factor risk scoring for spreads detected by scanner
export function assessSpreadRisk(spread: SpreadResult): RiskAssessment {
  const s = getSettings();
  const reasons: string[] = [];
  let score = 0;

  // 1. Profit threshold check (hard blocker)
  if (spread.grossSpreadUsd < s.minProfitThresholdUsd) {
    reasons.push(`Gross spread $${spread.grossSpreadUsd.toFixed(4)} below threshold $${s.minProfitThresholdUsd}`);
    score += 50;
  }

  // 2. Slippage check (hard blocker if exceeded)
  if (spread.slippageBps > s.maxSlippageBps) {
    reasons.push(`Slippage ${spread.slippageBps.toFixed(1)}bps exceeds max ${s.maxSlippageBps}bps`);
    score += 40;
  } else if (spread.slippageBps > s.maxSlippageBps * 0.8) {
    // Warn if approaching limit
    reasons.push(`Slippage ${spread.slippageBps.toFixed(1)}bps is high (limit ${s.maxSlippageBps}bps)`);
    score += 15;
  }

  // 3. Hop count check
  if (spread.hopCount > s.maxHopCount) {
    reasons.push(`Hop count ${spread.hopCount} exceeds max ${s.maxHopCount}`);
    score += 35;
  } else if (spread.hopCount > s.maxHopCount * 0.75) {
    // Penalize routes approaching hop limit (more failures expected)
    reasons.push(`Hop count ${spread.hopCount} is high (limit ${s.maxHopCount})`);
    score += 10;
  }

  // 4. Gas estimate sanity check
  const maxBudgetGas = s.baseGasUnits + s.maxHopCount * s.gasPerSwapUnits + 200_000;
  if (spread.gasEstimate > maxBudgetGas) {
    reasons.push(`Gas estimate ${spread.gasEstimate} exceeds budget ${maxBudgetGas}`);
    score += 25;
  } else if (spread.gasEstimate > maxBudgetGas * 0.8) {
    reasons.push(`Gas estimate ${spread.gasEstimate} is high (budget ${maxBudgetGas})`);
    score += 8;
  }

  // 5. Strategy-specific risk
  if (spread.strategy === 'circular') {
    if (spread.slippageBps < s.circularMinSpreadBps) {
      reasons.push(`Circular arb requires minimum ${s.circularMinSpreadBps}bps but got ${spread.slippageBps.toFixed(1)}bps`);
      score += 30;
    }
  }

  // 6. Price validity check
  if (!Number.isFinite(spread.nativePriceUsd) || spread.nativePriceUsd <= 0) {
    reasons.push(`Invalid native price: ${spread.nativePriceUsd}`);
    score += 100; // Immediate rejection
  }

  // 7. Token path sanity
  if (!Array.isArray(spread.tokenPath) || spread.tokenPath.length < 2) {
    reasons.push('Invalid token path');
    score += 100;
  }

  // Approval threshold: score < 50 is acceptable
  const approved = score < 50;
  return { approved, reasons, riskScore: score };
}

// Multi-factor risk scoring for compiled bundles
export function assessBundleRisk(bundle: CompiledBundle): RiskAssessment {
  const s = getSettings();
  const reasons: string[] = [];
  let score = 0;

  // 1. Net profit check (critical)
  if (bundle.netProfitUsd < s.minProfitThresholdUsd) {
    reasons.push(`Net profit $${bundle.netProfitUsd.toFixed(4)} below threshold $${s.minProfitThresholdUsd}`);
    score += 60;
  }

  if (bundle.netProfitWei <= 0n) {
    reasons.push('Net profit wei is non-positive');
    score += 100; // Immediate rejection
  }

  // 2. Gross spread sanity
  if (bundle.grossSpreadUsd <= 0 || !Number.isFinite(bundle.grossSpreadUsd)) {
    reasons.push(`Invalid gross spread: $${bundle.grossSpreadUsd}`);
    score += 100;
  }

  // 3. Gas cost ratio (gas should not exceed >30% of profit by default)
  try {
    const gasCostUsd = Number(bundle.totalGasCostWei) / 1e18 * bundle.nativePriceUsd;
    const profitMargin = Math.max(0.01, bundle.grossSpreadUsd);
    const gasRatio = (gasCostUsd / profitMargin) * 100;

    if (gasRatio > s.feeRatioCapPct) {
      reasons.push(`Gas ratio ${gasRatio.toFixed(1)}% exceeds cap ${s.feeRatioCapPct}% — profit margin too thin`);
      score += 40;
    } else if (gasRatio > s.feeRatioCapPct * 0.8) {
      reasons.push(`Gas ratio ${gasRatio.toFixed(1)}% is high (cap ${s.feeRatioCapPct}%)`);
      score += 15;
    }
  } catch (err) {
    reasons.push(`Cannot calculate gas ratio: ${err instanceof Error ? err.message : 'unknown'}`);
    score += 20;
  }

  // 4. Flash loan fee check
  if (bundle.flashLoanFeeBps > 50) {
    reasons.push(`High flash loan fee ${bundle.flashLoanFeeBps}bps may not be profitable`);
    score += 15;
  }

  // 5. Token path length
  if (bundle.tokenPath.length > s.maxInstructionCount) {
    reasons.push(`Token path ${bundle.tokenPath.length} exceeds max ${s.maxInstructionCount}`);
    score += 30;
  }

  // 6. Gas price check
  if (bundle.gasPriceGwei > s.maxGasPriceGwei) {
    reasons.push(`Gas price ${bundle.gasPriceGwei}gwei exceeds max ${s.maxGasPriceGwei}gwei`);
    score += 35;
  } else if (bundle.gasPriceGwei > s.maxGasPriceGwei * 0.8) {
    reasons.push(`Gas price ${bundle.gasPriceGwei}gwei is high (max ${s.maxGasPriceGwei}gwei)`);
    score += 10;
  }

  // 7. Settlement address validation
  if (!bundle.settlementAddress || bundle.settlementAddress === '' || !/^0x[a-fA-F0-9]{40}$/.test(bundle.settlementAddress)) {
    reasons.push('Invalid settlement address');
    score += 50;
  }

  // 8. Price validity
  if (!Number.isFinite(bundle.nativePriceUsd) || bundle.nativePriceUsd <= 0) {
    reasons.push(`Invalid native price: ${bundle.nativePriceUsd}`);
    score += 100;
  }

  // Approval threshold: score < 50 is acceptable
  const approved = score < 50;
  return { approved, reasons, riskScore: score };
}

export async function logRiskDecision(
  component: 'scanner' | 'compiler',
  assessment: RiskAssessment,
  context: Record<string, unknown>,
): Promise<void> {
  if (!assessment.approved) {
    await logEngine('risk', 'warn', `Risk rejected (score ${assessment.riskScore}): ${assessment.reasons.join(' | ')}`, context);
  } else if (assessment.riskScore > 0) {
    await logEngine('risk', 'info', `Risk approved (score ${assessment.riskScore}): monitoring conditions`, context);
  }
}
