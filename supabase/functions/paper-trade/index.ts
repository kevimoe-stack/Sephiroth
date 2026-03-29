import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function fetchPrice(symbol: string) {
  const query = new URLSearchParams({ symbol });
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?${query.toString()}`);
  if (!response.ok) throw new Error(`Binance ticker failed with ${response.status}`);
  const payload = await response.json();
  return Number(payload.price);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const strategyId = String(body.strategyId ?? "");
    if (!action || !strategyId) throw new Error("action and strategyId are required.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: strategy, error: strategyError } = await supabase.from("strategies").select("*").eq("id", strategyId).single();
    if (strategyError || !strategy) throw strategyError ?? new Error("Strategy not found.");

    const { data: portfolios } = await supabase.from("paper_portfolio").select("*").eq("strategy_id", strategyId).order("created_at", { ascending: false }).limit(1);
    const portfolio = portfolios?.[0] ?? null;

    if (action === "start") {
      if (portfolio?.is_active) {
        return Response.json({ ok: true, portfolio, message: "Paper portfolio already active." }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const initialCapital = Number(body.initialCapital ?? 10000);
      const { data, error } = await supabase.from("paper_portfolio").insert({
        strategy_id: strategyId,
        initial_capital: initialCapital,
        current_capital: initialCapital,
        peak_capital: initialCapital,
        is_active: true,
      }).select().single();
      if (error) throw error;
      return Response.json({ ok: true, portfolio: data }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!portfolio) throw new Error("No paper portfolio found. Start one first.");
    const currentPrice = await fetchPrice(String(strategy.symbol));

    if (action === "check") {
      const { data: openPositions } = await supabase.from("paper_positions").select("*").eq("strategy_id", strategyId).eq("status", "open");
      const openPosition = openPositions?.[0] ?? null;

      const { data: monitorRuns } = await supabase.from("agent_monitor_runs").select("*").order("created_at", { ascending: false }).limit(1);
      const monitorRun = monitorRuns?.[0] ?? null;
      const { data: alerts } = monitorRun
        ? await supabase.from("agent_monitor_alerts").select("*").eq("monitor_run_id", monitorRun.id).eq("strategy_id", strategyId)
        : { data: [] };
      const hasRiskAlert = (alerts ?? []).some((alert) => alert.severity === "critical" || alert.alert_type === "drawdown-breach");

      const { data: metaRuns } = await supabase.from("agent_meta_allocation_runs").select("*").order("created_at", { ascending: false }).limit(1);
      const metaRun = metaRuns?.[0] ?? null;
      const { data: metaEntries } = metaRun
        ? await supabase.from("agent_meta_allocation_entries").select("*").eq("meta_allocation_run_id", metaRun.id).eq("strategy_id", strategyId)
        : { data: [] };
      const metaEntry = metaEntries?.[0] ?? null;
      const suggestedAllocation = Number(metaEntry?.suggested_allocation ?? 0.1);

      const signalType = openPosition ? (hasRiskAlert || suggestedAllocation < 0.05 ? "sell" : "none") : (suggestedAllocation >= 0.08 ? "buy" : "none");

      const { data: signal, error: signalError } = await supabase.from("paper_signals").insert({
        strategy_id: strategyId,
        symbol: strategy.symbol,
        signal_type: signalType,
        price: currentPrice,
        indicator_values: { suggestedAllocation, riskAlert: hasRiskAlert },
      }).select().single();
      if (signalError) throw signalError;

      if (signalType === "buy" && !openPosition) {
        const allocationCapital = portfolio.current_capital * Math.min(Math.max(suggestedAllocation, 0.05), 0.2);
        const quantity = allocationCapital / currentPrice;
        const { error: positionError } = await supabase.from("paper_positions").insert({
          strategy_id: strategyId,
          signal_id: signal.id,
          symbol: strategy.symbol,
          direction: "long",
          entry_price: currentPrice,
          quantity,
          status: "open",
          fees: allocationCapital * 0.001,
          slippage: allocationCapital * 0.0005,
        });
        if (positionError) throw positionError;
      }

      if (signalType === "sell" && openPosition) {
        const pnl = (currentPrice - Number(openPosition.entry_price)) * Number(openPosition.quantity);
        const pnlPercent = ((currentPrice / Number(openPosition.entry_price)) - 1) * 100;
        const { error: closeError } = await supabase.from("paper_positions").update({
          exit_price: currentPrice,
          exit_date: new Date().toISOString(),
          status: "closed",
          pnl,
          pnl_percent: pnlPercent,
        }).eq("id", openPosition.id);
        if (closeError) throw closeError;

        const nextCapital = Number(portfolio.current_capital) + pnl;
        const nextPeak = Math.max(Number(portfolio.peak_capital ?? portfolio.current_capital), nextCapital);
        const drawdown = nextPeak === 0 ? 0 : ((nextCapital - nextPeak) / nextPeak) * 100;
        const { error: portfolioError } = await supabase.from("paper_portfolio").update({
          current_capital: nextCapital,
          peak_capital: nextPeak,
          total_pnl: Number(portfolio.total_pnl) + pnl,
          total_trades: Number(portfolio.total_trades) + 1,
          winning_trades: Number(portfolio.winning_trades) + (pnl > 0 ? 1 : 0),
          losing_trades: Number(portfolio.losing_trades) + (pnl <= 0 ? 1 : 0),
          max_drawdown: drawdown,
        }).eq("id", portfolio.id);
        if (portfolioError) throw portfolioError;
      }

      return Response.json({ ok: true, signalType, signal, suggestedAllocation, riskAlert: hasRiskAlert }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stop") {
      await supabase.from("paper_positions").update({
        status: "closed",
        exit_date: new Date().toISOString(),
        exit_price: currentPrice,
      }).eq("strategy_id", strategyId).eq("status", "open");

      const { data, error } = await supabase.from("paper_portfolio").update({ is_active: false }).eq("id", portfolio.id).select().single();
      if (error) throw error;
      return Response.json({ ok: true, portfolio: data }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unsupported action.");
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown paper-trade error" },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
