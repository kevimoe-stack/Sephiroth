import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface Candle {
  close: number;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ema(values: number[], period: number) {
  if (values.length < period) return Number.NaN;
  const multiplier = 2 / (period + 1);
  let previous = average(values.slice(0, period));
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
  }
  return previous;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  );
}

function classifyRegime(closes: number[]) {
  const returns = closes.slice(1).map((value, index) => value / closes[index] - 1);
  const shortEma = ema(closes, Math.min(12, closes.length));
  const longEma = ema(closes, Math.min(26, closes.length));
  const trendScore =
    Number.isFinite(shortEma) && Number.isFinite(longEma) && longEma !== 0
      ? ((shortEma - longEma) / longEma) * 100
      : 0;
  const volatilityScore = standardDeviation(returns) * 100 * Math.sqrt(returns.length || 1);
  const efficiencyScore =
    closes.length > 1
      ? Math.abs(closes[closes.length - 1] - closes[0]) /
        closes
          .slice(1)
          .reduce((sum, value, index) => sum + Math.abs(value - closes[index]), 0)
      : 0;

  let regimeLabel = "balanced";
  if (Math.abs(trendScore) > 2 && efficiencyScore > 0.28) {
    regimeLabel = trendScore > 0 ? "trend-up" : "trend-down";
  } else if (volatilityScore > 18) {
    regimeLabel = "high-volatility";
  } else if (efficiencyScore < 0.18) {
    regimeLabel = "range-bound";
  }

  return {
    regimeLabel,
    trendScore: Number(trendScore.toFixed(2)),
    volatilityScore: Number(volatilityScore.toFixed(2)),
    efficiencyScore: Number((efficiencyScore * 100).toFixed(2)),
  };
}

async function fetchRecentCloses(symbol: string, timeframe: string) {
  const query = new URLSearchParams({
    symbol,
    interval: timeframe,
    limit: "120",
  });
  const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Binance request failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected Binance payload.");
  }
  return payload.map((entry: Array<string | number>) => ({ close: Number(entry[4]) })) as Candle[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: strategies, error: strategiesError } = await supabase
      .from("strategies")
      .select("*")
      .neq("status", "eliminated");
    if (strategiesError) throw strategiesError;

    const snapshots = [];
    for (const strategy of strategies ?? []) {
      try {
        const candles = await fetchRecentCloses(String(strategy.symbol), String(strategy.timeframe ?? "4h"));
        const closes = candles.map((candle) => candle.close);
        const regime = classifyRegime(closes);
        snapshots.push({
          strategy_id: strategy.id,
          symbol: String(strategy.symbol),
          timeframe: String(strategy.timeframe ?? "4h"),
          regime_label: regime.regimeLabel,
          trend_score: regime.trendScore,
          volatility_score: regime.volatilityScore,
          efficiency_score: regime.efficiencyScore,
        });
      } catch {
        snapshots.push({
          strategy_id: strategy.id,
          symbol: String(strategy.symbol),
          timeframe: String(strategy.timeframe ?? "4h"),
          regime_label: "data-unavailable",
          trend_score: 0,
          volatility_score: 0,
          efficiency_score: 0,
        });
      }
    }

    const { data: regimeRun, error: runError } = await supabase
      .from("agent_regime_runs")
      .insert({
        status: "completed",
        symbols_count: snapshots.length,
        summary: {
          labels: snapshots.reduce<Record<string, number>>((acc, snapshot) => {
            acc[snapshot.regime_label] = (acc[snapshot.regime_label] ?? 0) + 1;
            return acc;
          }, {}),
        },
      })
      .select()
      .single();
    if (runError || !regimeRun) {
      throw runError ?? new Error("Regime run insert failed.");
    }

    if (snapshots.length > 0) {
      const rows = snapshots.map((snapshot) => ({
        regime_run_id: regimeRun.id,
        ...snapshot,
      }));
      const { error: snapshotError } = await supabase.from("agent_regime_snapshots").insert(rows);
      if (snapshotError) throw snapshotError;
    }

    return Response.json(
      {
        ok: true,
        regimeRun,
        snapshots,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown regime error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
