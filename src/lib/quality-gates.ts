import type { Backtest, RiskRule, WalkforwardResult } from "@/integrations/supabase/types";

export interface QualityGateEvaluation {
  passRate: number;
  passed: boolean;
  reasons: string[];
  thresholds: {
    minTrades: number;
    minSharpe: number;
    maxDrawdown: number;
    minProfitFactor: number;
    minPassRate: number;
    minReturn: number;
  };
}

export function evaluateQualityGates(
  backtest: Backtest | null,
  walkforwardRows: WalkforwardResult[],
  riskRule?: RiskRule | null,
): QualityGateEvaluation {
  const passRate =
    walkforwardRows.length === 0
      ? 0
      : walkforwardRows.filter((row) => Boolean(row.passed)).length / walkforwardRows.length;

  const thresholds = {
    minTrades: 25,
    minSharpe: 1,
    maxDrawdown: Math.min(18, Math.max(12, (riskRule?.max_daily_loss ?? 0.05) * 350)),
    minProfitFactor: 1.15,
    minPassRate: 0.55,
    minReturn: 0,
  };

  const reasons: string[] = [];
  if (!backtest) reasons.push("Kein Backtest");
  if ((backtest?.total_trades ?? 0) < thresholds.minTrades) reasons.push("Zu wenige Trades");
  if ((backtest?.sharpe_ratio ?? 0) < thresholds.minSharpe) reasons.push("Sharpe unter Mindestniveau");
  if (Math.abs(backtest?.max_drawdown ?? 100) > thresholds.maxDrawdown) reasons.push("Drawdown zu hoch");
  if ((backtest?.profit_factor ?? 0) < thresholds.minProfitFactor) reasons.push("Profit Factor zu schwach");
  if ((backtest?.total_return ?? -100) <= thresholds.minReturn) reasons.push("Return nicht positiv");
  if (passRate < thresholds.minPassRate) reasons.push("Walk-Forward zu instabil");

  return {
    passRate,
    passed: reasons.length === 0,
    reasons,
    thresholds,
  };
}
