import type { Backtest, LiveOrder, LivePortfolio, PaperPortfolio, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

export function getLatestBacktest(backtests: Backtest[], strategyId: string) {
  return backtests.find((item) => item.strategy_id === strategyId) ?? null;
}

export function getWalkforwardRows(rows: WalkforwardResult[], strategyId: string) {
  return rows.filter((item) => item.strategy_id === strategyId);
}

export function getLatestDistinctBacktest(backtests: Backtest[], strategyId: string) {
  const seen = new Set<string>();
  return backtests
    .filter((item) => item.strategy_id === strategyId)
    .filter((item) => {
      const signature = [
        item.start_date,
        item.end_date,
        item.initial_capital,
        item.fee_rate ?? "",
        item.slippage_rate ?? "",
        item.total_return,
        item.sharpe_ratio,
        item.max_drawdown,
        item.total_trades,
      ].join("|");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })[0] ?? null;
}

export function getLatestWalkforwardRun(rows: WalkforwardResult[], strategyId: string) {
  const candidates = rows.filter((item) => item.strategy_id === strategyId);
  const groups = new Map<string, WalkforwardResult[]>();
  for (const row of candidates) {
    const key = row.run_group_id ?? `${row.strategy_id}-${row.created_at}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  const grouped = Array.from(groups.values())
    .map((groupRows) => [...groupRows].sort((left, right) => left.window_number - right.window_number))
    .sort((left, right) => String(right[0]?.created_at ?? "").localeCompare(String(left[0]?.created_at ?? "")));

  return grouped[0] ?? [];
}

export type ResearchStatus =
  | "no-runs"
  | "backtest-only"
  | "needs-improvement"
  | "candidate-ready"
  | "research-watch"
  | "stale";

export function getResearchSnapshot(backtests: Backtest[], walkforwardRows: WalkforwardResult[], strategyId: string) {
  const backtest = getLatestDistinctBacktest(backtests, strategyId);
  const walkforwardRun = getLatestWalkforwardRun(walkforwardRows, strategyId);
  const passRate =
    walkforwardRun.length === 0
      ? null
      : walkforwardRun.filter((row) => Boolean(row.passed)).length / walkforwardRun.length;
  const latestTimestamp = new Date(String(walkforwardRun[0]?.created_at ?? backtest?.created_at ?? ""));
  const now = new Date();
  const ageDays =
    Number.isNaN(latestTimestamp.getTime())
      ? null
      : Math.floor((now.getTime() - latestTimestamp.getTime()) / (1000 * 60 * 60 * 24));

  let status: ResearchStatus = "no-runs";
  let label = "Keine Runs";

  if (backtest && walkforwardRun.length === 0) {
    status = "backtest-only";
    label = "Nur Backtest";
  } else if (backtest && walkforwardRun.length > 0) {
    const sharpe = backtest.sharpe_ratio ?? 0;
    const totalReturn = backtest.total_return ?? 0;
    const drawdown = Math.abs(backtest.max_drawdown ?? 0);
    const trades = backtest.total_trades ?? 0;

    if ((ageDays ?? 0) > 14) {
      status = "stale";
      label = "Research stale";
    } else if (
      passRate !== null &&
      passRate >= 0.6 &&
      sharpe >= 0.75 &&
      totalReturn > 0 &&
      drawdown <= 20 &&
      trades >= 20
    ) {
      status = "candidate-ready";
      label = "Candidate-ready";
    } else if (
      passRate !== null &&
      passRate >= 0.4 &&
      sharpe >= 0.25 &&
      drawdown <= 25 &&
      trades >= 12
    ) {
      status = "research-watch";
      label = "Research watch";
    } else {
      status = "needs-improvement";
      label = "Needs improvement";
    }
  }

  return {
    backtest,
    walkforwardRun,
    passRate,
    ageDays,
    status,
    label,
  };
}

export function computeResearchScore(
  backtest: Backtest | null | undefined,
  walkforwardRun: WalkforwardResult[],
  passRate: number | null,
) {
  return (
    (passRate ?? 0) * 50 +
    (backtest?.sharpe_ratio ?? 0) * 20 +
    (backtest?.total_return ?? 0) * 0.4 -
    Math.abs(backtest?.max_drawdown ?? 0) * 0.8 +
    Math.min(backtest?.total_trades ?? 0, 40) * 0.5
  );
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
