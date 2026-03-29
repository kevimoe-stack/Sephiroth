import type { Backtest, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";
import { computeHealth, getLatestBacktest, getWalkforwardRows } from "@/lib/analytics";

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
  const totalTrades = backtest?.total_trades ?? 0;
  const sharpe = backtest?.sharpe_ratio ?? 0;
  const returnValue = backtest?.total_return ?? 0;
  const profitFactor = backtest?.profit_factor ?? 0;
  const winRate = backtest?.win_rate ?? 0;

  const capitalProtectionThreshold = Math.max(12, (riskRule?.max_daily_loss ?? 0.05) * 350);
  const kernelReasons: string[] = [];
  if (!backtest) kernelReasons.push("Kein Backtest");
  if (maxDrawdown > capitalProtectionThreshold) kernelReasons.push("Drawdown zu hoch");
  if (passRate < 0.4) kernelReasons.push("Walk-Forward zu instabil");
  if (totalTrades < 15) kernelReasons.push("Zu wenige Trades");
  if (sharpe < 0.8) kernelReasons.push("Sharpe unter Mindestniveau");

  const capitalPreservationScore = clampScore(100 - maxDrawdown * 3.2 + passRate * 15);
  const riskManagementScore = clampScore(
    40 +
      (profitFactor * 12) +
      (winRate * 0.18) +
      passRate * 20 -
      Math.max(0, maxDrawdown - capitalProtectionThreshold) * 2,
  );

  const passedKernel = kernelReasons.length === 0;
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
  const rows = strategies
    .filter((strategy) => strategy.status !== "eliminated")
    .map((strategy) => evaluateTournamentRow(strategy, backtests, walkforward, globalRiskRule))
    .sort((left, right) => right.fitnessScore - left.fitnessScore);

  return {
    rows,
    champion: rows.find((row) => row.passedKernel) ?? rows[0] ?? null,
    challengers: rows.filter((row) => row.passedKernel).slice(1, 4),
    watchlist: rows.filter((row) => !row.passedKernel).slice(0, 4),
    globalRiskRule,
  };
}
