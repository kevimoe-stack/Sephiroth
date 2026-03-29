import type { Backtest, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

export function getLatestBacktest(backtests: Backtest[], strategyId: string) {
  return backtests.find((item) => item.strategy_id === strategyId) ?? null;
}

export function getWalkforwardRows(rows: WalkforwardResult[], strategyId: string) {
  return rows.filter((item) => item.strategy_id === strategyId);
}

export function computeHealth(strategy: Strategy, backtests: Backtest[], walkforward: WalkforwardResult[]) {
  const backtest = getLatestBacktest(backtests, strategy.id);
  const wfRows = getWalkforwardRows(walkforward, strategy.id);
  const passRate = wfRows.length === 0 ? 0 : wfRows.filter((row) => row.passed).length / wfRows.length;
  const sharpe = backtest?.sharpe_ratio ?? 0;
  const winRate = backtest?.win_rate ?? 0;
  const totalReturn = backtest?.total_return ?? 0;
  const drawdown = Math.abs(backtest?.max_drawdown ?? 0);
  const healthScore = Math.max(0, Math.min(100, Math.round(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - drawdown * 0.7 + passRate * 18)));
  const readinessScore = Math.max(0, Math.min(100, Math.round(25 + sharpe * 12 + passRate * 30 + ((backtest?.total_trades ?? 0) >= 20 ? 18 : 4) - drawdown * 0.6)));
  return { backtest, wfRows, passRate, healthScore, readinessScore };
}
