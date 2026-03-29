export interface QualityGateInput {
  backtest: Record<string, unknown> | null;
  walkforward: Array<Record<string, unknown>>;
  riskRule: Record<string, unknown> | null;
}

export function evaluateQualityGates(input: QualityGateInput) {
  const passRate =
    input.walkforward.length === 0
      ? 0
      : input.walkforward.filter((row) => Boolean(row.passed)).length / input.walkforward.length;

  const thresholds = {
    minTrades: 25,
    minSharpe: 1,
    maxDrawdown: Math.min(18, Math.max(12, Number(input.riskRule?.max_daily_loss ?? 0.05) * 350)),
    minProfitFactor: 1.15,
    minPassRate: 0.55,
    minReturn: 0,
  };

  const reasons: string[] = [];
  if (!input.backtest) reasons.push("Kein Backtest");
  if (Number(input.backtest?.total_trades ?? 0) < thresholds.minTrades) reasons.push("Zu wenige Trades");
  if (Number(input.backtest?.sharpe_ratio ?? 0) < thresholds.minSharpe) reasons.push("Sharpe unter Mindestniveau");
  if (Math.abs(Number(input.backtest?.max_drawdown ?? 100)) > thresholds.maxDrawdown) reasons.push("Drawdown zu hoch");
  if (Number(input.backtest?.profit_factor ?? 0) < thresholds.minProfitFactor) reasons.push("Profit Factor zu schwach");
  if (Number(input.backtest?.total_return ?? -100) <= thresholds.minReturn) reasons.push("Return nicht positiv");
  if (passRate < thresholds.minPassRate) reasons.push("Walk-Forward zu instabil");

  return {
    passRate,
    passed: reasons.length === 0,
    reasons,
    thresholds,
  };
}
