import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateQualityGates } from "../_shared/quality-gates.ts";

type StrategyRow = Record<string, unknown> & {
  id: string;
  name?: string;
  symbol?: string;
  timeframe?: string;
  asset_class?: string;
  description?: string | null;
  parameters?: Record<string, unknown> | null;
  tags?: string[] | null;
  status?: string;
  created_at?: string | null;
};

type OptimizationPlan = {
  objective: string;
  parameterPatch: Record<string, number | string | boolean>;
  rationale: string[];
  nextExperiment: string;
  variantLabel?: string;
};

type OperationalFeedback = {
  score: number | null;
  readiness: number | null;
  blockedOrders: number;
  errorOrders: number;
  executedOrders: number;
  paperTrades: number;
  paperPnl: number;
  reasons: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values));
}

function sanitizeParentTags(tags: string[]) {
  return tags.filter((tag) => ![
    "candidate-ready",
    "needs-improvement",
    "validation-pending",
    "preferred-for-tournament",
    "pack-winner",
    "retired-variant",
    "optimizer-paused",
  ].includes(tag));
}

function isFreshEnough(createdAt: unknown, maxHours: number) {
  const parsed = Date.parse(String(createdAt ?? ""));
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < maxHours * 60 * 60 * 1000;
}

function findReusableVariant(
  strategies: StrategyRow[],
  parentStrategyId: string,
  variantLabel: string,
  timeframe: string,
  maxHours = 72,
) {
  return strategies.find((strategy) => {
    const tags = Array.isArray(strategy.tags) ? strategy.tags : [];
    if (!tags.includes("agent-variant")) return false;
    if (strategy.status === "archived" || strategy.status === "eliminated") return false;
    if (!isFreshEnough(strategy.created_at, maxHours)) return false;
    const parameters = strategy.parameters;
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return false;
    return (
      String(parameters.parentStrategyId ?? "") === parentStrategyId &&
      String(parameters.variantLabel ?? "") === variantLabel &&
      String(strategy.timeframe ?? "") === timeframe
    );
  }) ?? null;
}

function computeOperationalFeedback(
  paperPortfolio: Record<string, unknown> | null,
  livePortfolio: Record<string, unknown> | null,
  liveOrders: Array<Record<string, unknown>>,
): OperationalFeedback {
  const blockedOrders = liveOrders.filter((order) => String(order.status ?? "") === "blocked").length;
  const errorOrders = liveOrders.filter((order) => Boolean(order.error_message)).length;
  const executedOrders = liveOrders.filter((order) => ["simulated", "dry-run", "filled"].includes(String(order.status ?? ""))).length;
  const paperTrades = Number(paperPortfolio?.total_trades ?? 0);
  const paperPnl = Number(paperPortfolio?.total_pnl ?? 0);
  const paperDrawdown = Math.abs(Number(paperPortfolio?.max_drawdown ?? 0));
  const paperWinRate = paperTrades > 0 ? Number(paperPortfolio?.winning_trades ?? 0) / paperTrades : 0;
  const blockedRatio = liveOrders.length > 0 ? blockedOrders / liveOrders.length : 0;
  const hasOperationalData = Boolean(paperPortfolio) || Boolean(livePortfolio) || liveOrders.length > 0;
  const score = hasOperationalData
    ? clampScore(
        50 +
          Math.min(executedOrders, 6) * 5 +
          Math.min(paperTrades, 30) * 0.6 +
          paperWinRate * 20 +
          Math.min(Math.max(paperPnl / 50, -20), 20) -
          blockedRatio * 28 -
          errorOrders * 8 -
          paperDrawdown * 1.1,
      )
    : null;
  const readiness = hasOperationalData
    ? clampScore(
        45 +
          Math.min(executedOrders, 8) * 4 +
          (Boolean(livePortfolio?.is_active) ? 10 : 0) +
          Math.min(paperTrades, 30) * 0.5 -
          blockedRatio * 30 -
          errorOrders * 10 -
          paperDrawdown,
      )
    : null;
  const reasons: string[] = [];
  if (blockedOrders > 0) reasons.push(`${blockedOrders} blockierte Execution-Checks`);
  if (errorOrders > 0) reasons.push(`${errorOrders} Execution-Checks mit Fehlermeldung`);
  if (paperTrades > 0) reasons.push(`Paper Trades ${paperTrades}`);
  if (paperPnl < 0) reasons.push("Paper-PnL negativ");
  if (paperDrawdown > 10) reasons.push("Paper Drawdown erhoeht");

  return { score, readiness, blockedOrders, errorOrders, executedOrders, paperTrades, paperPnl, reasons };
}

function scoreStrategy(
  backtest: Record<string, unknown> | null,
  walkforward: Array<Record<string, unknown>>,
  operational: OperationalFeedback,
) {
  const sharpe = Number(backtest?.sharpe_ratio ?? 0);
  const winRate = Number(backtest?.win_rate ?? 0);
  const maxDrawdown = Math.abs(Number(backtest?.max_drawdown ?? 0));
  const totalReturn = Number(backtest?.total_return ?? 0);
  const passedRatio = walkforward.length === 0 ? 0 : walkforward.filter((row) => Boolean(row.passed)).length / walkforward.length;
  const baseHealthScore = clampScore(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - maxDrawdown * 0.7 + passedRatio * 18);
  const baseReadinessScore = clampScore(25 + sharpe * 12 + passedRatio * 30 + (Number(backtest?.total_trades ?? 0) >= 20 ? 18 : 4) - maxDrawdown * 0.6);
  const healthScore = operational.score === null ? baseHealthScore : clampScore(baseHealthScore * 0.82 + operational.score * 0.18);
  const readinessScore = operational.readiness === null ? baseReadinessScore : clampScore(baseReadinessScore * 0.78 + operational.readiness * 0.22);
  return { healthScore, readinessScore, passedRatio, baseHealthScore, baseReadinessScore };
}

function buildStrengths(backtest: Record<string, unknown> | null, passedRatio: number, operational: OperationalFeedback) {
  const strengths: string[] = [];
  if (Number(backtest?.sharpe_ratio ?? 0) > 1.2) strengths.push("Risikobereinigte Performance ist ueberdurchschnittlich.");
  if (Number(backtest?.profit_factor ?? 0) > 1.4) strengths.push("Das Gewinn-Verlust-Verhaeltnis ist robust genug fuer weitere Validierung.");
  if (passedRatio >= 0.5) strengths.push("Walk-Forward besteht auf mehreren Fenstern und reduziert Overfitting-Risiko.");
  if ((operational.score ?? 0) >= 65) strengths.push("Operational Feedback aus Paper/Dry-Run ist stabil genug fuer weitere Iterationen.");
  return strengths;
}

function buildRisks(backtest: Record<string, unknown> | null, passedRatio: number, operational: OperationalFeedback) {
  const risks: string[] = [];
  if (Math.abs(Number(backtest?.max_drawdown ?? 0)) > 20) risks.push("Drawdown ist fuer kontrolliertes Deployment noch zu hoch.");
  if (Number(backtest?.total_trades ?? 0) < 15) risks.push("Zu wenige Trades machen die Statistik fragiler.");
  if (passedRatio < 0.4) risks.push("Out-of-sample Stabilitaet ist noch nicht ausreichend.");
  if (operational.blockedOrders > 0) risks.push("Execution-Checks werden bereits blockiert und sprechen gegen operative Robustheit.");
  if (operational.paperPnl < 0) risks.push("Paper-Trading zeigt aktuell keinen belastbaren operativen Vorteil.");
  return risks;
}

function buildOptimization(strategy: StrategyRow, gateReasons: string[], operational: OperationalFeedback): OptimizationPlan {
  const name = String(strategy.name ?? "").toLowerCase();
  const rationale = [...gateReasons, ...operational.reasons];
  const needsRiskTightening = gateReasons.includes("Drawdown zu hoch") || operational.blockedOrders > 0 || operational.paperPnl < 0;
  const needsStability = gateReasons.includes("Walk-Forward zu instabil") || operational.errorOrders > 0;

  if (name.includes("rsi")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = { rsiPeriod: 12, oversold: 24, overbought: 74, exitLevel: 52 };
    if (needsRiskTightening) parameterPatch.stopLossPercent = 1.8;
    if (needsStability) parameterPatch.trendFilterEma = 200;
    return {
      objective: "Mean-Reversion stabilisieren und Trendfilter ergaenzen",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "RSI-Einstiege werden selektiver gemacht, damit schwache Gegenbewegungen seltener getradet werden.",
        "Ein hoeherer Trendfilter reduziert Mean-Reversion-Trades gegen dominante Makrotrends.",
      ]),
      nextExperiment: "Teste dieselbe Variante auf 4h mit hoeherem Trendfilter und konservativerem Stop-Loss.",
      variantLabel: needsRiskTightening ? "risk-tight" : "balanced",
    };
  }

  if (name.includes("boll")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = { period: 22, multiplier: 2.6, atrFilter: 1.2 };
    if (needsRiskTightening) parameterPatch.stopLossPercent = 1.7;
    return {
      objective: "Breakouts selektiver handeln und Volatilitaet filtern",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "Breitere Baender und ein ATR-Filter senken die Zahl schwacher Fakeouts.",
        "Weniger Trades sind hier akzeptabel, wenn Profit Factor und OOS-Stabilitaet steigen.",
      ]),
      nextExperiment: "Pruefe 1h gegen 4h und kombiniere den Einstieg mit einem Volumenfilter.",
      variantLabel: needsRiskTightening ? "risk-tight" : "balanced",
    };
  }

  if (name.includes("macd")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = {
      fastPeriod: 12,
      slowPeriod: 35,
      signalPeriod: 9,
      confirmationEma: 200,
      confirmationBars: needsStability ? 3 : 2,
      minHistogramPercent: needsStability ? 0.04 : 0.025,
      minHoldBars: needsStability ? 4 : 3,
      exitOnTrendLoss: true,
    };
    if (gateReasons.includes("Profit Factor zu schwach")) parameterPatch.takeProfitPercent = 4.8;
    if (needsRiskTightening) parameterPatch.stopLossPercent = 2.0;
    return {
      objective: "Trendfolge entrauschen und Whipsaws reduzieren",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "Ein strengerer Regimefilter und Histogramm-Bestaetigung sollen Chop-Phasen reduzieren.",
        "Langsamere MACD-Parameter und Mindesthaltedauer helfen, impulsive Fehlsignale auszusortieren.",
      ]),
      nextExperiment: "Teste Multi-Timeframe-Bestaetigung mit 4h-Filter und 1h-Einstieg.",
      variantLabel: needsRiskTightening ? "risk-tight" : needsStability ? "stability" : "balanced",
    };
  }

  if (name.includes("pullback")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = {
      fastEma: 34,
      slowEma: 144,
      trendFilterEma: 200,
      rsiPeriod: 12,
      pullbackRsi: needsStability ? 40 : 42,
      recoveryRsi: needsStability ? 55 : 53,
      confirmationBars: needsStability ? 3 : 2,
      maxPullbackPercent: needsRiskTightening ? 2.2 : 2.8,
      minHoldBars: 3,
    };
    if (gateReasons.includes("Profit Factor zu schwach")) parameterPatch.takeProfitPercent = 5.6;
    if (needsRiskTightening) parameterPatch.stopLossPercent = 1.6;
    return {
      objective: "Pullback-Einstiege strenger filtern und Trendstruktur staerken",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "Kontrolliertere Pullbacks und mehr Trendbestaetigung sollen Drawdown und OOS-Noise senken.",
        "Der Fokus liegt auf weniger, aber saubereren Wiedereinstiegen im uebergeordneten Trend.",
      ]),
      nextExperiment: "Vergleiche denselben Pullback-Ansatz auf 4h mit engerem Pullback-Abstand und laengerer Haltedauer.",
      variantLabel: needsRiskTightening ? "risk-tight" : needsStability ? "stability" : "balanced",
    };
  }

  return {
    objective: "Trendfolge robuster machen und Risiko klarer begrenzen",
    parameterPatch: { fast: 21, slow: 55, confirmationEma: 100, stopLossPercent: 2.1 },
    rationale: dedupe([
      ...rationale,
      "Langsamere Trendfilter reduzieren Noise und Parameter-Sensitivitaet.",
      "Ein klarerer Risikorahmen hilft, Drawdowns frueher abzufangen.",
    ]),
    nextExperiment: "Vergleiche 4h und 1d inklusive hoeherer Slippage-Szenarien.",
    variantLabel: needsRiskTightening ? "risk-tight" : needsStability ? "stability" : "balanced",
  };
}

function buildVariantPlans(strategy: StrategyRow, optimization: OptimizationPlan, gateReasons: string[], operational: OperationalFeedback) {
  const tags = Array.isArray(strategy.tags) ? strategy.tags : [];
  const isPilot = tags.includes("pilot");
  const isTestnetTarget = tags.includes("testnet-target");
  const basePlan: OptimizationPlan = {
    ...optimization,
    variantLabel: optimization.variantLabel ?? "balanced",
  };

  const severeRiskStress =
    gateReasons.includes("Drawdown zu hoch") &&
    gateReasons.includes("Return nicht positiv") &&
    gateReasons.includes("Walk-Forward zu instabil");

  const riskTightPlan: OptimizationPlan = {
    objective: `${optimization.objective} mit engerem Risiko-Rahmen`,
    parameterPatch: {
      ...optimization.parameterPatch,
      stopLossPercent: Number(optimization.parameterPatch.stopLossPercent ?? 1.4),
      takeProfitPercent: Number(optimization.parameterPatch.takeProfitPercent ?? 2.4),
      timeframeOverride: severeRiskStress ? "4h" : undefined,
    },
    rationale: dedupe([
      ...optimization.rationale,
      "Diese Variante priorisiert Kapitalerhalt und begrenzt Ausreisser frueher.",
      ...(operational.blockedOrders > 0 ? ["Geblockte Execution-Checks sprechen fuer eine engere Risiko-Variante."] : []),
    ]),
    nextExperiment: "Pruefe, ob die tightere Risikosteuerung den Drawdown deutlich senkt, ohne die Passrate zu zerstoeren.",
    variantLabel: "risk-tight",
  };

  const stabilityPlan: OptimizationPlan = {
    objective: `${optimization.objective} mit Stabilitaets-Filter`,
    parameterPatch: {
      ...optimization.parameterPatch,
      trendFilterEma: Number(optimization.parameterPatch.trendFilterEma ?? 200),
      confirmationBars: 2,
      timeframeOverride: severeRiskStress ? "4h" : undefined,
    },
    rationale: dedupe([
      ...optimization.rationale,
      "Diese Variante fuegt mehr Bestaetigung hinzu, um Walk-Forward-Stabilitaet zu verbessern.",
      ...(gateReasons.includes("Walk-Forward zu instabil") ? ["Der Fokus liegt explizit auf OOS-Robustheit."] : []),
      ...(operational.errorOrders > 0 ? ["Fehlerhafte oder instabile Execution-Checks sprechen fuer mehr Signalkonfirmation."] : []),
    ]),
    nextExperiment: "Vergleiche gleiche Parameter auf 1h und 4h, um stabilere Regime zu finden.",
    variantLabel: "stability",
  };

  if (isPilot || isTestnetTarget) {
    const executionTargetPlan: OptimizationPlan = {
      objective: `${optimization.objective} mit Execution-Fokus`,
      parameterPatch: {
        ...optimization.parameterPatch,
        trendFilterEma: Number(optimization.parameterPatch.trendFilterEma ?? optimization.parameterPatch.confirmationEma ?? 200),
        confirmationBars: Math.max(Number(optimization.parameterPatch.confirmationBars ?? 2), 3),
        minHoldBars: Math.max(Number(optimization.parameterPatch.minHoldBars ?? 3), 4),
        stopLossPercent: Number(optimization.parameterPatch.stopLossPercent ?? 1.8),
        takeProfitPercent: Number(optimization.parameterPatch.takeProfitPercent ?? 4.8),
        timeframeOverride: "4h",
      },
      rationale: dedupe([
        ...optimization.rationale,
        "Pilot-Varianten werden bewusst auf stabilere, testnet-naehere Signale getrimmt statt breit zu streuen.",
        "Der Execution-Fokus priorisiert robustere Konfirmation und geringere operative Reibung.",
      ]),
      nextExperiment: "Pruefe zunaechst nur diese engere Pilot-Variante gegen die bestehende Fokuslinie, bevor weitere Packs erzeugt werden.",
      variantLabel: "execution-target",
    };

    return [riskTightPlan, executionTargetPlan];
  }

  return [basePlan, riskTightPlan, stabilityPlan];
}

function buildVariantPayload(strategy: StrategyRow, optimization: OptimizationPlan, gateReasons: string[], operational: OperationalFeedback, index = 0) {
  const variantStamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const currentParameters = typeof strategy.parameters === "object" && strategy.parameters ? strategy.parameters : {};
  const tags = Array.isArray(strategy.tags) ? sanitizeParentTags(strategy.tags) : [];
  const mergedTags = dedupe([
    ...tags,
    "agent-variant",
    "auto-optimized",
    `variant:${optimization.variantLabel ?? "balanced"}`,
    ...gateReasons.map((reason) => `gate:${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
    ...operational.reasons.slice(0, 3).map((reason) => `ops:${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
  ]);

  const timeframeOverride = typeof optimization.parameterPatch.timeframeOverride === "string" ? optimization.parameterPatch.timeframeOverride : null;
  const parameterPatch = { ...optimization.parameterPatch };
  delete parameterPatch.timeframeOverride;

  return {
    name: `${String(strategy.name ?? "Strategie")} | Variant ${variantStamp}-${index + 1}`,
    symbol: String(strategy.symbol ?? "BTCUSDT"),
    timeframe: timeframeOverride ?? String(strategy.timeframe ?? "4h"),
    asset_class: String(strategy.asset_class ?? "crypto"),
    status: "draft",
    is_champion: false,
    description: [
      `Agent-Variante fuer: ${String(strategy.name ?? "Strategie")}`,
      `Ziel: ${optimization.objective}`,
      optimization.variantLabel ? `Variantentyp: ${optimization.variantLabel}` : null,
      gateReasons.length > 0 ? `Gate-Fails: ${gateReasons.join(", ")}` : null,
      operational.reasons.length > 0 ? `Operational Feedback: ${operational.reasons.join(", ")}` : null,
      `Naechster Test: ${optimization.nextExperiment}`,
    ].filter(Boolean).join("\n\n"),
    parameters: {
      ...currentParameters,
      ...parameterPatch,
      parentStrategyId: strategy.id,
      optimizationObjective: optimization.objective,
      optimizationGeneratedAt: new Date().toISOString(),
      variantLabel: optimization.variantLabel ?? "balanced",
      operationalFocus: operational.reasons,
    },
    tags: mergedTags,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action ?? "analyze");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "bulk-analyze") {
      const { data: strategies, error: strategiesError } = await supabase.from("strategies").select("*").neq("status", "eliminated");
      if (strategiesError) throw strategiesError;
      const rows = await Promise.all(
        (strategies ?? []).map(async (strategy) => {
          const { data: backtests } = await supabase.from("backtests").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(1);
          const { data: wf } = await supabase.from("walkforward_results").select("*").eq("strategy_id", strategy.id);
          const { data: paperPortfolios } = await supabase.from("paper_portfolio").select("*").eq("strategy_id", strategy.id).order("updated_at", { ascending: false }).limit(1);
          const { data: livePortfolios } = await supabase.from("live_portfolios").select("*").eq("strategy_id", strategy.id).order("updated_at", { ascending: false }).limit(1);
          const { data: liveOrders } = await supabase.from("live_orders").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(12);
          const operational = computeOperationalFeedback(paperPortfolios?.[0] ?? null, livePortfolios?.[0] ?? null, liveOrders ?? []);
          const scoring = scoreStrategy(backtests?.[0] ?? null, wf ?? [], operational);
          return {
            strategy_id: strategy.id,
            strategy_name: strategy.name,
            symbol: strategy.symbol,
            health_score: scoring.healthScore,
            readiness_score: scoring.readinessScore,
            operational_score: operational.score,
            blocked_checks: operational.blockedOrders,
            latest_sharpe: Number(backtests?.[0]?.sharpe_ratio ?? 0),
            passed_ratio: scoring.passedRatio,
          };
        }),
      );
      rows.sort((left, right) => right.health_score - left.health_score);
      return Response.json({ ok: true, ranking: rows }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const strategyId = String(body.strategyId ?? "");
    if (!strategyId) throw new Error("strategyId is required for analyze/optimize/create-variant/create-variant-pack.");

    const { data: strategy, error: strategyError } = await supabase.from("strategies").select("*").eq("id", strategyId).single();
    if (strategyError || !strategy) throw strategyError ?? new Error("Strategy not found.");
    const { data: allStrategies } = await supabase.from("strategies").select("*").neq("status", "eliminated");

    const { data: backtests } = await supabase.from("backtests").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(1);
    const { data: wf } = await supabase.from("walkforward_results").select("*").eq("strategy_id", strategy.id);
    const { data: riskRules } = await supabase.from("risk_rules").select("*").or(`strategy_id.eq.${strategy.id},is_global.eq.true`).order("updated_at", { ascending: false });
    const { data: paperPortfolios } = await supabase.from("paper_portfolio").select("*").eq("strategy_id", strategy.id).order("updated_at", { ascending: false }).limit(1);
    const { data: livePortfolios } = await supabase.from("live_portfolios").select("*").eq("strategy_id", strategy.id).order("updated_at", { ascending: false }).limit(1);
    const { data: liveOrders } = await supabase.from("live_orders").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(12);
    const latestBacktest = backtests?.[0] ?? null;
    const walkforward = wf ?? [];
    const operational = computeOperationalFeedback(paperPortfolios?.[0] ?? null, livePortfolios?.[0] ?? null, liveOrders ?? []);
    const scoring = scoreStrategy(latestBacktest, walkforward, operational);
    const qualityGate = evaluateQualityGates({
      backtest: latestBacktest,
      walkforward,
      riskRule: (riskRules ?? []).find((rule) => rule.strategy_id === strategy.id) ?? (riskRules ?? []).find((rule) => rule.is_global) ?? null,
    });
    const optimization = buildOptimization(strategy as StrategyRow, qualityGate.reasons, operational);

    if (action === "optimize") {
      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          metrics: latestBacktest,
          qualityGate,
          operational,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create-variant") {
      const payload = buildVariantPayload(strategy as StrategyRow, optimization, qualityGate.reasons, operational);
      const reusableVariant = findReusableVariant(
        (allStrategies ?? []) as StrategyRow[],
        strategy.id,
        String(payload.parameters?.variantLabel ?? "balanced"),
        String(payload.timeframe ?? strategy.timeframe ?? "4h"),
      );
      if (reusableVariant) {
        return Response.json(
          {
            ok: true,
            strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
            optimization,
            qualityGate,
            operational,
            variant: reusableVariant,
            reused: true,
          },
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: variant, error: variantError } = await supabase.from("strategies").insert(payload).select("*").single();
      if (variantError || !variant) throw variantError ?? new Error("Variant creation failed.");

      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          qualityGate,
          operational,
          variant,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create-variant-pack") {
      const plans = buildVariantPlans(strategy as StrategyRow, optimization, qualityGate.reasons, operational);
      const payloads = plans.map((plan, index) => buildVariantPayload(strategy as StrategyRow, plan, qualityGate.reasons, operational, index));
      const reusableVariants = payloads
        .map((payload) =>
          findReusableVariant(
            (allStrategies ?? []) as StrategyRow[],
            strategy.id,
            String(payload.parameters?.variantLabel ?? "balanced"),
            String(payload.timeframe ?? strategy.timeframe ?? "4h"),
          ),
        )
        .filter(Boolean) as StrategyRow[];
      const reusableLabels = new Set(
        reusableVariants.map((variant) => String((variant.parameters as Record<string, unknown> | null)?.variantLabel ?? "")),
      );
      const newPayloads = payloads.filter((payload) => !reusableLabels.has(String(payload.parameters?.variantLabel ?? "")));

      let insertedVariants: StrategyRow[] = [];
      if (newPayloads.length > 0) {
        const { data: variants, error: variantsError } = await supabase.from("strategies").insert(newPayloads).select("*");
        if (variantsError || !variants) throw variantsError ?? new Error("Variant pack creation failed.");
        insertedVariants = variants as StrategyRow[];
      }

      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          qualityGate,
          operational,
          variants: [...reusableVariants, ...insertedVariants],
          reused: reusableVariants.length,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return Response.json(
      {
        ok: true,
        strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol, timeframe: strategy.timeframe },
        scores: scoring,
        strengths: buildStrengths(latestBacktest, scoring.passedRatio, operational),
        risks: buildRisks(latestBacktest, scoring.passedRatio, operational),
        recommendations: dedupe([
          "Lass nach jeder Parameteranpassung einen neuen Walk-Forward-Lauf mit identischem Zeitraum laufen.",
          "Teste mindestens ein hoeheres Slippage-Szenario fuer realistischere Robustheit.",
          "Setze fuer Live-Freigabe Mindestgrenzen fuer Sharpe, Drawdown und Walk-Forward-Passrate.",
          ...(operational.blockedOrders > 0 ? ["Behebe zuerst blockierte Dry-Run-Signale, bevor neue Varianten aggressiver werden."] : []),
          ...(operational.paperPnl < 0 ? ["Paper-Trading spricht fuer defensivere Varianten mit engerem Risiko-Rahmen."] : []),
        ]),
        metrics: latestBacktest,
        qualityGate,
        operational,
        optimization,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown ai-agent error" },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
