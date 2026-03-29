import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

function buildOptimization(strategy: Record<string, unknown>) {
  const name = String(strategy.name ?? "").toLowerCase();
  if (name.includes("rsi")) {
    return {
      objective: "Mehr Stabilitaet zwischen In-Sample und OOS",
      parameterPatch: { rsiPeriod: 10, oversold: 27, exitLevel: 54 },
      rationale: [
        "Etwas reaktiveres RSI-Setup kann bei Mean-Reversion fruehere Entries liefern.",
        "Der Exit-Level wird leicht gesenkt, um Gewinne frueher zu sichern.",
      ],
      nextExperiment: "Teste 1h vs 4h und fuege Regime-Filter gegen starke Trendphasen hinzu.",
    };
  }
  if (name.includes("boll")) {
    return {
      objective: "Breakouts selektiver handeln",
      parameterPatch: { period: 20, multiplier: 2.5 },
      rationale: [
        "Ein breiteres Band filtert schwache Ausbrueche besser heraus.",
        "Das senkt meist Trade-Frequenz zugunsten hoeherer Signalqualitaet.",
      ],
      nextExperiment: "Kombiniere den Einstieg mit Volumen- oder ATR-Anstieg.",
    };
  }
  if (name.includes("macd")) {
    return {
      objective: "Trendfolge frueher aber kontrolliert aktivieren",
      parameterPatch: { fastPeriod: 8, slowPeriod: 21, signalPeriod: 5 },
      rationale: [
        "Schnellere MACD-Parameter beschleunigen die Reaktion auf Regimewechsel.",
        "Funktioniert am besten mit strengerem Drawdown-Monitoring.",
      ],
      nextExperiment: "Teste einen Hoeher-Timeframe-Filter zur Vermeidung von Chop-Phasen.",
    };
  }
  return {
    objective: "Trendfolge robuster machen",
    parameterPatch: { fast: 21, slow: 55 },
    rationale: [
      "Langsamere Trendfilter reduzieren Noise und Parameter-Sensitivitaet.",
      "Sie passen besser zu laengeren Backtests und Walk-Forward-Fenstern.",
    ],
    nextExperiment: "Vergleiche 4h und 1d inklusive realistisch hoeherer Slippage-Szenarien.",
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
    if (!strategyId) throw new Error("strategyId is required for analyze/optimize.");

    const { data: strategy, error: strategyError } = await supabase.from("strategies").select("*").eq("id", strategyId).single();
    if (strategyError || !strategy) throw strategyError ?? new Error("Strategy not found.");

    const { data: backtests } = await supabase.from("backtests").select("*").eq("strategy_id", strategy.id).order("created_at", { ascending: false }).limit(1);
    const { data: wf } = await supabase.from("walkforward_results").select("*").eq("strategy_id", strategy.id);
    const latestBacktest = backtests?.[0] ?? null;
    const walkforward = wf ?? [];
    const scoring = scoreStrategy(latestBacktest, walkforward);

    if (action === "optimize") {
      return Response.json(
        {
          ok: true,
          strategy: { id: strategy.id, name: strategy.name, symbol: strategy.symbol },
          optimization: buildOptimization(strategy),
          metrics: latestBacktest,
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
