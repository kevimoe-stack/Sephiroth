import type { Backtest, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";
import { computeHealth, getLatestBacktest, getWalkforwardRows } from "@/lib/analytics";
import { evaluateQualityGates } from "@/lib/quality-gates";

export interface TournamentRow {
  strategy: Strategy;
  backtest: Backtest | null;
  walkforwardRows: WalkforwardResult[];
  healthScore: number;
  readinessScore: number;
  passRate: number;
  capitalPreservationScore: number;
  riskManagementScore: number;
  fitnessScore: number;
  passedKernel: boolean;
  kernelReasons: string[];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getParentStrategyId(strategy: Strategy) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return null;
  const parentStrategyId = parameters.parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : null;
}

function isEligibleForTournament(strategy: Strategy) {
  const tags = strategy.tags ?? [];
  const isAgentVariant = tags.includes("agent-variant");
  return strategy.status !== "eliminated" && (!isAgentVariant || tags.includes("candidate-ready"));
}

function selectBestRows(rows: TournamentRow[]) {
  const directRows = rows.filter((row) => !(row.strategy.tags ?? []).includes("agent-variant"));
  const variantRows = rows.filter((row) => (row.strategy.tags ?? []).includes("agent-variant"));
  const bestVariantByParent = new Map<string, TournamentRow>();

  for (const row of variantRows) {
    const parentStrategyId = getParentStrategyId(row.strategy) ?? row.strategy.id;
    const existing = bestVariantByParent.get(parentStrategyId);
    if (!existing || row.fitnessScore > existing.fitnessScore) {
      bestVariantByParent.set(parentStrategyId, row);
    }
  }

  return [...directRows, ...bestVariantByParent.values()].sort((left, right) => right.fitnessScore - left.fitnessScore);
}

export function evaluateTournamentRow(
  strategy: Strategy,
  backtests: Backtest[],
  walkforward: WalkforwardResult[],
  riskRule?: RiskRule | null,
): TournamentRow {
  const backtest = getLatestBacktest(backtests, strategy.id);
  const walkforwardRows = getWalkforwardRows(walkforward, strategy.id);
  const { healthScore, readinessScore, passRate } = computeHealth(strategy, backtests, walkforward);
  const maxDrawdown = Math.abs(backtest?.max_drawdown ?? 100);
  const returnValue = backtest?.total_return ?? 0;
  const profitFactor = backtest?.profit_factor ?? 0;
  const winRate = backtest?.win_rate ?? 0;
  const gateEvaluation = evaluateQualityGates(backtest, walkforwardRows, riskRule);
  const capitalProtectionThreshold = gateEvaluation.thresholds.maxDrawdown;
  const kernelReasons = [...gateEvaluation.reasons];

  const capitalPreservationScore = clampScore(100 - maxDrawdown * 3.2 + passRate * 15);
  const riskManagementScore = clampScore(
    40 +
      (profitFactor * 12) +
      (winRate * 0.18) +
      passRate * 20 -
      Math.max(0, maxDrawdown - capitalProtectionThreshold) * 2,
  );

  const passedKernel = gateEvaluation.passed;
  const fitnessScore = passedKernel
    ? clampScore(
        capitalPreservationScore * 0.35 +
          riskManagementScore * 0.25 +
          healthScore * 0.2 +
          readinessScore * 0.1 +
          Math.min(returnValue, 100) * 0.1,
      )
    : clampScore(Math.min(capitalPreservationScore, riskManagementScore) * 0.5);

  return {
    strategy,
    backtest,
    walkforwardRows,
    healthScore,
    readinessScore,
    passRate,
    capitalPreservationScore,
    riskManagementScore,
    fitnessScore,
    passedKernel,
    kernelReasons,
  };
}

export function buildTournamentBoard(
  strategies: Strategy[],
  backtests: Backtest[],
  walkforward: WalkforwardResult[],
  riskRules: RiskRule[],
) {
  const globalRiskRule = riskRules.find((rule) => rule.is_global) ?? null;
  const eligibleRows = strategies
    .filter(isEligibleForTournament)
    .map((strategy) => evaluateTournamentRow(strategy, backtests, walkforward, globalRiskRule))
    .sort((left, right) => right.fitnessScore - left.fitnessScore);
  const rows = selectBestRows(eligibleRows);

  return {
    rows,
    champion: rows.find((row) => row.passedKernel) ?? null,
    challengers: rows.filter((row) => row.passedKernel).slice(1, 4),
    watchlist: rows.filter((row) => !row.passedKernel).slice(0, 4),
    globalRiskRule,
  };
}
