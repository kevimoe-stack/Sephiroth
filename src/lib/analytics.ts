import type { Backtest, LiveOrder, LivePortfolio, PaperPortfolio, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

export function getLatestBacktest(backtests: Backtest[], strategyId: string) {
  return backtests.find((item) => item.strategy_id === strategyId) ?? null;
}

export function getWalkforwardRows(rows: WalkforwardResult[], strategyId: string) {
  return rows.filter((item) => item.strategy_id === strategyId);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getLatestPaperPortfolio(portfolios: PaperPortfolio[], strategyId: string) {
  return portfolios.find((item) => item.strategy_id === strategyId) ?? null;
}

function getLatestLivePortfolio(portfolios: LivePortfolio[], strategyId: string) {
  return portfolios.find((item) => item.strategy_id === strategyId) ?? null;
}

function getRecentLiveOrders(orders: LiveOrder[], strategyId: string) {
  return orders.filter((item) => item.strategy_id === strategyId).slice(0, 12);
}

export function computeOperationalFeedback(
  strategy: Strategy,
  paperPortfolios: PaperPortfolio[] = [],
  livePortfolios: LivePortfolio[] = [],
  liveOrders: LiveOrder[] = [],
) {
  const paperPortfolio = getLatestPaperPortfolio(paperPortfolios, strategy.id);
  const livePortfolio = getLatestLivePortfolio(livePortfolios, strategy.id);
  const recentOrders = getRecentLiveOrders(liveOrders, strategy.id);
  const executedOrders = recentOrders.filter((order) => ["simulated", "dry-run", "filled"].includes(order.status));
  const blockedOrders = recentOrders.filter((order) => order.status === "blocked");
  const errorOrders = recentOrders.filter((order) => Boolean(order.error_message));
  const blockedRatio = recentOrders.length > 0 ? blockedOrders.length / recentOrders.length : 0;
  const paperTrades = paperPortfolio?.total_trades ?? 0;
  const paperWinRate = paperTrades > 0 ? (paperPortfolio?.winning_trades ?? 0) / paperTrades : 0;
  const paperDrawdown = Math.abs(paperPortfolio?.max_drawdown ?? 0);
  const paperPnl = paperPortfolio?.total_pnl ?? 0;
  const hasOperationalData = Boolean(paperPortfolio) || Boolean(livePortfolio) || recentOrders.length > 0;
  const operationalScore = hasOperationalData
    ? clampScore(
        50 +
          Math.min(executedOrders.length, 6) * 5 +
          Math.min(paperTrades, 30) * 0.6 +
          paperWinRate * 20 +
          Math.min(Math.max(paperPnl / 50, -20), 20) -
          blockedRatio * 28 -
          errorOrders.length * 8 -
          paperDrawdown * 1.1,
      )
    : null;
  const operationalReadiness = hasOperationalData
    ? clampScore(
        45 +
          Math.min(executedOrders.length, 8) * 4 +
          (livePortfolio?.is_active ? 10 : 0) +
          Math.min(paperTrades, 30) * 0.5 -
          blockedRatio * 30 -
          errorOrders.length * 10 -
          paperDrawdown,
      )
    : null;
  const operationalNotes: string[] = [];
  if (blockedOrders.length > 0) operationalNotes.push(`${blockedOrders.length} blockierte Execution-Checks`);
  if (errorOrders.length > 0) operationalNotes.push(`${errorOrders.length} Checks mit Fehlermeldung`);
  if ((paperPortfolio?.total_trades ?? 0) > 0) operationalNotes.push(`Paper Trades ${paperPortfolio?.total_trades ?? 0}`);
  if ((paperPortfolio?.max_drawdown ?? 0) !== null && Math.abs(paperPortfolio?.max_drawdown ?? 0) > 10) operationalNotes.push("Paper Drawdown erhoeht");

  return {
    paperPortfolio,
    livePortfolio,
    recentOrders,
    hasOperationalData,
    operationalScore,
    operationalReadiness,
    blockedOrdersCount: blockedOrders.length,
    executedOrdersCount: executedOrders.length,
    operationalNotes,
  };
}

export function computeHealth(
  strategy: Strategy,
  backtests: Backtest[],
  walkforward: WalkforwardResult[],
  paperPortfolios: PaperPortfolio[] = [],
  livePortfolios: LivePortfolio[] = [],
  liveOrders: LiveOrder[] = [],
) {
  const backtest = getLatestBacktest(backtests, strategy.id);
  const wfRows = getWalkforwardRows(walkforward, strategy.id);
  const passRate = wfRows.length === 0 ? 0 : wfRows.filter((row) => row.passed).length / wfRows.length;
  const sharpe = backtest?.sharpe_ratio ?? 0;
  const winRate = backtest?.win_rate ?? 0;
  const totalReturn = backtest?.total_return ?? 0;
  const drawdown = Math.abs(backtest?.max_drawdown ?? 0);
  const baseHealthScore = clampScore(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - drawdown * 0.7 + passRate * 18);
  const baseReadinessScore = clampScore(25 + sharpe * 12 + passRate * 30 + ((backtest?.total_trades ?? 0) >= 20 ? 18 : 4) - drawdown * 0.6);
  const operational = computeOperationalFeedback(strategy, paperPortfolios, livePortfolios, liveOrders);
  const healthScore = operational.operationalScore === null
    ? baseHealthScore
    : clampScore(baseHealthScore * 0.82 + operational.operationalScore * 0.18);
  const readinessScore = operational.operationalReadiness === null
    ? baseReadinessScore
    : clampScore(baseReadinessScore * 0.78 + operational.operationalReadiness * 0.22);
  return { backtest, wfRows, passRate, healthScore, readinessScore, baseHealthScore, baseReadinessScore, ...operational };
}
