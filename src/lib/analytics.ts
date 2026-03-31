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

export function getPilotComparison(strategies: Strategy[], backtests: Backtest[], walkforwardRows: WalkforwardResult[]) {
  const pilots = strategies
    .filter((strategy) => (strategy.tags ?? []).includes("pilot"))
    .map((strategy) => {
      const snapshot = getResearchSnapshot(backtests, walkforwardRows, strategy.id);
      const score = computeResearchScore(snapshot.backtest, snapshot.walkforwardRun, snapshot.passRate);
      return {
        strategy,
        snapshot,
        score,
        isLeadingCandidate: false,
        isSecondaryCandidate: false,
      };
    })
    .sort((left, right) => right.score - left.score);

  if (pilots[0]) pilots[0].isLeadingCandidate = true;
  if (pilots[1]) pilots[1].isSecondaryCandidate = true;

  return {
    pilots,
    leader: pilots[0] ?? null,
    secondary: pilots[1] ?? null,
  };
}

export function getPilotRole(
  strategyId: string,
  pilotComparison?: ReturnType<typeof getPilotComparison> | null,
) {
  if (!pilotComparison) return null;
  if (pilotComparison.leader?.strategy.id === strategyId) return "focus";
  if (pilotComparison.secondary?.strategy.id === strategyId) return "comparison";
  return null;
}

export function computeStrategyPriority(
  strategy: Strategy,
  backtests: Backtest[],
  walkforwardRows: WalkforwardResult[],
  pilotComparison?: ReturnType<typeof getPilotComparison> | null,
) {
  const snapshot = getResearchSnapshot(backtests, walkforwardRows, strategy.id);
  const researchPriority = {
    "candidate-ready": 5,
    "research-watch": 4,
    "backtest-only": 3,
    stale: 2,
    "needs-improvement": 1,
    "no-runs": 0,
  } as const;

  let score = researchPriority[snapshot.status];
  if (strategy.is_champion) score += 3;
  if ((strategy.tags ?? []).includes("pilot")) score += 1;

  const pilotRole = getPilotRole(strategy.id, pilotComparison);
  if (pilotRole === "focus") score += 2;
  if (pilotRole === "comparison") score -= 1;

  return {
    snapshot,
    priorityScore: score,
  };
}

export type ValidationStageState = "done" | "active" | "blocked";

export interface ValidationStage {
  key: string;
  label: string;
  state: ValidationStageState;
  detail: string;
}

export interface ValidationRecommendation {
  title: string;
  detail: string;
  priority: "high" | "medium";
}

export function getValidationPipeline(
  strategy: Strategy,
  backtest: Backtest | null,
  walkforwardRun: WalkforwardResult[],
  qualityGatePassed: boolean,
) {
  const tags = strategy.tags ?? [];
  const candidateReady = tags.includes("candidate-ready");
  const executionWatchlist = tags.includes("execution-watchlist");
  const preferredForTournament = tags.includes("preferred-for-tournament");
  const retiredVariant = tags.includes("retired-variant");

  const stages: ValidationStage[] = [
    {
      key: "backtest",
      label: "Backtest",
      state: backtest ? "done" : "active",
      detail: backtest
        ? `${backtest.total_trades ?? 0} Trades, Sharpe ${backtest.sharpe_ratio ?? 0}`
        : "Erster echter Backtest fehlt noch.",
    },
    {
      key: "walkforward",
      label: "Walk-Forward",
      state: walkforwardRun.length > 0 ? "done" : backtest ? "active" : "blocked",
      detail:
        walkforwardRun.length > 0
          ? `${walkforwardRun.filter((row) => Boolean(row.passed)).length}/${walkforwardRun.length} Fenster bestanden`
          : backtest
            ? "Backtest vorhanden, Walk-Forward noch offen."
            : "Backtest zuerst abschliessen.",
    },
    {
      key: "quality-gate",
      label: "Quality Gate",
      state: qualityGatePassed ? "done" : walkforwardRun.length > 0 ? "active" : "blocked",
      detail: qualityGatePassed
        ? "Alle Mindestanforderungen aktuell erfuellt."
        : walkforwardRun.length > 0
          ? "Runs vorhanden, aber Gate noch nicht bestanden."
          : "Ohne Walk-Forward noch nicht beurteilbar.",
    },
    {
      key: "candidate",
      label: "Candidate Queue",
      state: candidateReady || executionWatchlist ? "done" : qualityGatePassed ? "active" : "blocked",
      detail: executionWatchlist
        ? "Execution-Watchlist erreicht."
        : candidateReady
          ? preferredForTournament
            ? "Candidate-ready und fuer Tournament bevorzugt."
            : "Candidate-ready."
          : retiredVariant
            ? "Variante wurde aus der automatischen Schleife genommen."
            : qualityGatePassed
              ? "Gate bestanden, wartet aber noch auf stärkere Queue-Einordnung."
              : "Vorher muss das Quality Gate bestehen.",
    },
    {
      key: "testnet",
      label: "Testnet-Pfad",
      state: executionWatchlist ? "done" : candidateReady ? "active" : "blocked",
      detail: executionWatchlist
        ? "Naechster sinnvoller Kandidat fuer Execution/Testnet-Checks."
        : candidateReady
          ? "Research-seitig nah dran, braucht aber noch mehr operative Sicherheit."
          : "Noch nicht bereit fuer den Testnet-Pfad.",
    },
  ];

  return {
    stages,
    doneCount: stages.filter((stage) => stage.state === "done").length,
    totalCount: stages.length,
  };
}

export function getValidationRecommendation(
  strategy: Strategy,
  backtest: Backtest | null,
  walkforwardRun: WalkforwardResult[],
  qualityGatePassed: boolean,
) : ValidationRecommendation {
  const tags = strategy.tags ?? [];
  const candidateReady = tags.includes("candidate-ready");
  const executionWatchlist = tags.includes("execution-watchlist");
  const totalTrades = backtest?.total_trades ?? 0;
  const sharpe = backtest?.sharpe_ratio ?? 0;
  const drawdown = Math.abs(backtest?.max_drawdown ?? 0);
  const profitFactor = backtest?.profit_factor ?? 0;
  const passRate =
    walkforwardRun.length === 0
      ? 0
      : walkforwardRun.filter((row) => Boolean(row.passed)).length / walkforwardRun.length;

  if (!backtest) {
    return {
      title: "Ersten echten Backtest ausführen",
      detail: "Ohne frischen Backtest können wir weder das Quality Gate noch den Testnet-Pfad seriös bewerten.",
      priority: "high",
    };
  }

  if (walkforwardRun.length === 0) {
    return {
      title: "Walk-Forward vervollständigen",
      detail: "Der Backtest ist vorhanden, aber ohne Walk-Forward fehlt noch die wichtigste Stabilitätsprüfung für candidate-ready.",
      priority: "high",
    };
  }

  if (!qualityGatePassed) {
    if (drawdown > 18) {
      return {
        title: "Drawdown zuerst reduzieren",
        detail: "Die aktuelle Linie scheitert vor allem am Risikoprofil. Nächste Varianten sollten engeren Stop, stärkeren Trendfilter oder weniger aggressive Entries nutzen.",
        priority: "high",
      };
    }
    if (sharpe < 1 || profitFactor < 1.15) {
      return {
        title: "Signalqualität steigern",
        detail: "Sharpe und Profit Factor liegen noch zu niedrig. Die Fokuslinie braucht selektivere Entries und sauberere Exit-Regeln, bevor sie candidate-ready werden kann.",
        priority: "high",
      };
    }
    if (passRate < 0.55) {
      return {
        title: "Walk-Forward-Stabilität verbessern",
        detail: "Die Strategie produziert einzelne brauchbare Phasen, ist aber über die OOS-Fenster noch zu unstet. Wir sollten eher Regimefilter und defensivere Varianten testen.",
        priority: "high",
      };
    }
    if (totalTrades < 25) {
      return {
        title: "Ausreichende Tradebasis aufbauen",
        detail: "Die Linie braucht mehr valide Trades, damit die Research-Aussage belastbar wird. Dabei dürfen Sharpe und Drawdown nicht weiter leiden.",
        priority: "medium",
      };
    }
  }

  if (!candidateReady) {
    return {
      title: "Candidate-ready absichern",
      detail: "Das Gate ist näher dran, aber die Queue-Einordnung fehlt noch. Ein frischer Backtest-/Walk-Forward-Lauf mit denselben Eingaben sollte jetzt sauber übernommen werden.",
      priority: "medium",
    };
  }

  if (!executionWatchlist) {
    return {
      title: "Richtung Execution-Watchlist drücken",
      detail: "Die Research-Basis ist da. Jetzt brauchen wir etwas stärkere operative Robustheit, damit die Linie den Testnet-Pfad glaubwürdig erreicht.",
      priority: "medium",
    };
  }

  return {
    title: "Für Testnet-Dry-Run priorisieren",
    detail: "Diese Linie ist aktuell der beste Kandidat für den nächsten kontrollierten Execution-Check im Testnet-Dry-Run.",
    priority: "medium",
  };
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
