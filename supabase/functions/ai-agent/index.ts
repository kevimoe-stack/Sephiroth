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
};

type OptimizationPlan = {
  objective: string;
  parameterPatch: Record<string, number | string | boolean>;
  rationale: string[];
  nextExperiment: string;
  variantLabel?: string;
};

function scoreStrategy(backtest: Record<string, unknown> | null, walkforward: Array<Record<string, unknown>>) {
  const sharpe = Number(backtest?.sharpe_ratio ?? 0);
  const winRate = Number(backtest?.win_rate ?? 0);
  const maxDrawdown = Math.abs(Number(backtest?.max_drawdown ?? 0));
  const totalReturn = Number(backtest?.total_return ?? 0);
  const passedRatio = walkforward.length === 0 ? 0 : walkforward.filter((row) => Boolean(row.passed)).length / walkforward.length;
  const healthScore = Math.max(0, Math.min(100, Math.round(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - maxDrawdown * 0.7 + passedRatio * 18)));
  const readinessScore = Math.max(0, Math.min(100, Math.round(25 + sharpe * 12 + passedRatio * 30 + (Number(backtest?.total_trades ?? 0) >= 20 ? 18 : 4) - maxDrawdown * 0.6)));
  return { healthScore, readinessScore, passedRatio };
}

function buildStrengths(backtest: Record<string, unknown> | null, passedRatio: number) {
  const strengths: string[] = [];
  if (Number(backtest?.sharpe_ratio ?? 0) > 1.2) strengths.push("Risikobereinigte Performance ist ueberdurchschnittlich.");
  if (Number(backtest?.profit_factor ?? 0) > 1.4) strengths.push("Das Gewinn-Verlust-Verhaeltnis ist robust genug fuer weitere Validierung.");
  if (passedRatio >= 0.5) strengths.push("Walk-Forward besteht auf mehreren Fenstern und reduziert Overfitting-Risiko.");
  return strengths;
}

function buildRisks(backtest: Record<string, unknown> | null, passedRatio: number) {
  const risks: string[] = [];
  if (Math.abs(Number(backtest?.max_drawdown ?? 0)) > 20) risks.push("Drawdown ist fuer kontrolliertes Deployment noch zu hoch.");
  if (Number(backtest?.total_trades ?? 0) < 15) risks.push("Zu wenige Trades machen die Statistik fragiler.");
  if (passedRatio < 0.4) risks.push("Out-of-sample Stabilitaet ist noch nicht ausreichend.");
  return risks;
}

function dedupe<T>(values: T[]) {
  return Array.from(new Set(values));
}

function buildOptimization(strategy: StrategyRow, gateReasons: string[]): OptimizationPlan {
  const name = String(strategy.name ?? "").toLowerCase();
  const rationale = [...gateReasons];

  if (name.includes("rsi")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = { rsiPeriod: 12, oversold: 24, overbought: 74, exitLevel: 52 };
    if (gateReasons.includes("Drawdown zu hoch")) parameterPatch.stopLossPercent = 1.8;
    if (gateReasons.includes("Walk-Forward zu instabil")) parameterPatch.trendFilterEma = 200;
    return {
      objective: "Mean-Reversion stabilisieren und Trendfilter ergaenzen",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "RSI-Einstiege werden selektiver gemacht, damit schwache Gegenbewegungen seltener getradet werden.",
        "Ein hoeherer Trendfilter reduziert Mean-Reversion-Trades gegen dominante Makrotrends.",
      ]),
      nextExperiment: "Teste dieselbe Variante auf 4h mit hoeherem Trendfilter und konservativerem Stop-Loss.",
      variantLabel: "balanced",
    };
  }

  if (name.includes("boll")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = { period: 22, multiplier: 2.6, atrFilter: 1.2 };
    return {
      objective: "Breakouts selektiver handeln und Volatilitaet filtern",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "Breitere Baender und ein ATR-Filter senken die Zahl schwacher Fakeouts.",
        "Weniger Trades sind hier akzeptabel, wenn Profit Factor und OOS-Stabilitaet steigen.",
      ]),
      nextExperiment: "Pruefe 1h gegen 4h und kombiniere den Einstieg mit einem Volumenfilter.",
      variantLabel: "balanced",
    };
  }

  if (name.includes("macd")) {
    const parameterPatch: OptimizationPlan["parameterPatch"] = { fastPeriod: 10, slowPeriod: 24, signalPeriod: 6, confirmationEma: 100 };
    if (gateReasons.includes("Profit Factor zu schwach")) parameterPatch.takeProfitPercent = 3.2;
    return {
      objective: "Trendfolge entrauschen und Whipsaws reduzieren",
      parameterPatch,
      rationale: dedupe([
        ...rationale,
        "Ein zusaetzlicher Trendfilter kann Chop-Phasen reduzieren und den Profit Factor stabilisieren.",
        "Leicht langsamere MACD-Parameter helfen, impulsive Fehlsignale auszusortieren.",
      ]),
      nextExperiment: "Teste Multi-Timeframe-Bestaetigung mit 4h-Filter und 1h-Einstieg.",
      variantLabel: "balanced",
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
    variantLabel: "balanced",
  };
}

function buildVariantPlans(strategy: StrategyRow, optimization: OptimizationPlan, gateReasons: string[]) {
  const basePlan: OptimizationPlan = {
    ...optimization,
    variantLabel: optimization.variantLabel ?? "balanced",
  };

  const riskTightPlan: OptimizationPlan = {
    objective: `${optimization.objective} mit engerem Risiko-Rahmen`,
    parameterPatch: {
      ...optimization.parameterPatch,
      stopLossPercent: Number(optimization.parameterPatch.stopLossPercent ?? 1.4),
      takeProfitPercent: Number(optimization.parameterPatch.takeProfitPercent ?? 2.4),
    },
    rationale: dedupe([
      ...optimization.rationale,
      "Diese Variante priorisiert Kapitalerhalt und begrenzt Ausreisser frueher.",
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
    },
    rationale: dedupe([
      ...optimization.rationale,
      "Diese Variante fuegt mehr Bestaetigung hinzu, um Walk-Forward-Stabilitaet zu verbessern.",
      ...gateReasons.includes("Walk-Forward zu instabil") ? ["Der Fokus liegt explizit auf OOS-Robustheit."] : [],
    ]),
    nextExperiment: "Vergleiche gleiche Parameter auf 1h und 4h, um stabilere Regime zu finden.",
    variantLabel: "stability",
  };

  return [basePlan, riskTightPlan, stabilityPlan];
}

function buildVariantPayload(strategy: StrategyRow, optimization: OptimizationPlan, gateReasons: string[], index = 0) {
  const variantStamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const currentParameters = typeof strategy.parameters === "object" && strategy.parameters ? strategy.parameters : {};
  const tags = Array.isArray(strategy.tags) ? strategy.tags : [];
  const mergedTags = dedupe([
    ...tags,
    "agent-variant",
    "auto-optimized",
    `variant:${optimization.variantLabel ?? "balanced"}`,
    ...gateReasons.map((reason) => `gate:${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
  ]);

  return {
    name: `${String(strategy.name ?? "Strategie")} | Variant ${variantStamp}-${index + 1}`,
    symbol: String(strategy.symbol ?? "BTCUSDT"),
    timeframe: String(strategy.timeframe ?? "4h"),
    asset_class: String(strategy.asset_class ?? "crypto"),
    status: "draft",
    is_champion: false,
    description: [
      `Agent-Variante fuer: ${String(strategy.name ?? "Strategie")}`,
      `Ziel: ${optimization.objective}`,
      optimization.variantLabel ? `Variantentyp: ${optimization.variantLabel}` : null,
      gateReasons.length > 0 ? `Gate-Fails: ${gateReasons.join(", ")}` : null,
      `Naechster Test: ${optimization.nextExperiment}`,
    ].filter(Boolean).join("\n\n"),
    parameters: {
      ...currentParameters,
      ...optimization.parameterPatch,
      parentStrategyId: strategy.id,
      optimizationObjective: optimization.objective,
      optimizationGeneratedAt: new Date().toISOString(),
      variantLabel: optimization.variantLabel ?? "balanced",
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
          const scoring = scoreStrategy(backtests?.[0] ?? null, wf ?? []);
          return {
            strategy_id: strategy.id,
            strategy_name: strategy.name,
            symbol: strategy.symbol,
            health_score: scoring.healthScore,
            readiness_score: scoring.readinessScore,
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

    const { data: backtests } = await supabase.from("backtests").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(1);
    const { data: wf } = await supabase.from("walkforward_results").select("*").eq("strategy_id", strategy.id);
    const { data: riskRules } = await supabase.from("risk_rules").select("*").or(`strategy_id.eq.${strategy.id},is_global.eq.true`).order("updated_at", { ascending: false });
    const latestBacktest = backtests?.[0] ?? null;
    const walkforward = wf ?? [];
    const scoring = scoreStrategy(latestBacktest, walkforward);
    const qualityGate = evaluateQualityGates({
      backtest: latestBacktest,
      walkforward,
      riskRule: (riskRules ?? []).find((rule) => rule.strategy_id === strategy.id) ?? (riskRules ?? []).find((rule) => rule.is_global) ?? null,
    });
    const optimization = buildOptimization(strategy as StrategyRow, qualityGate.reasons);

    if (action === "optimize") {
      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          metrics: latestBacktest,
          qualityGate,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create-variant") {
      const payload = buildVariantPayload(strategy as StrategyRow, optimization, qualityGate.reasons);
      const { data: variant, error: variantError } = await supabase.from("strategies").insert(payload).select("*").single();
      if (variantError || !variant) throw variantError ?? new Error("Variant creation failed.");

      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          qualityGate,
          variant,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "create-variant-pack") {
      const plans = buildVariantPlans(strategy as StrategyRow, optimization, qualityGate.reasons);
      const payloads = plans.map((plan, index) => buildVariantPayload(strategy as StrategyRow, plan, qualityGate.reasons, index));
      const { data: variants, error: variantsError } = await supabase.from("strategies").insert(payloads).select("*");
      if (variantsError || !variants) throw variantsError ?? new Error("Variant pack creation failed.");

      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization,
          qualityGate,
          variants,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return Response.json(
      {
        ok: true,
        strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol, timeframe: strategy.timeframe },
        scores: scoring,
        strengths: buildStrengths(latestBacktest, scoring.passedRatio),
        risks: buildRisks(latestBacktest, scoring.passedRatio),
        recommendations: [
          "Lass nach jeder Parameteranpassung einen neuen Walk-Forward-Lauf mit identischem Zeitraum laufen.",
          "Teste mindestens ein hoeheres Slippage-Szenario fuer realistischere Robustheit.",
          "Setze fuer Live-Freigabe Mindestgrenzen fuer Sharpe, Drawdown und Walk-Forward-Passrate.",
        ],
        metrics: latestBacktest,
        qualityGate,
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
