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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: strategy, error: strategyError } = await supabase.from("strategies").select("*").eq("id", strategyId).single();
    if (strategyError || !strategy) throw strategyError ?? new Error("Strategy not found.");

    const { data: portfolios } = await supabase.from("live_portfolios").select("*").eq("strategy_id", strategyId).order("created_at", { ascending: false }).limit(1);
    const portfolio = portfolios?.[0] ?? null;
    const currentPrice = await fetchPrice(String(strategy.symbol));
    const executionMode = Deno.env.get("BINANCE_API_KEY") && Deno.env.get("BINANCE_API_SECRET") ? "configured-dry-run" : "simulation";

    if (action === "start") {
      if (portfolio?.is_active) {
        return Response.json({ ok: true, portfolio, executionMode, message: "Live portfolio already active." }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const initialCapital = Number(body.initialCapital ?? 1000);
      const { data, error } = await supabase.from("live_portfolios").insert({
        strategy_id: strategyId,
        exchange: "binance",
        api_key_name: executionMode === "configured-dry-run" ? "configured-dry-run" : "simulation",
        initial_capital: initialCapital,
        current_capital: initialCapital,
        is_active: true,
      }).select().single();
      if (error) throw error;
      return Response.json({ ok: true, portfolio: data, executionMode }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!portfolio) throw new Error("No live portfolio found. Start one first.");

    if (action === "check") {
      const { data: metaRuns } = await supabase.from("agent_meta_allocation_runs").select("*").order("created_at", { ascending: false }).limit(1);
      const metaRun = metaRuns?.[0] ?? null;
      const { data: metaEntries } = metaRun
        ? await supabase.from("agent_meta_allocation_entries").select("*").eq("meta_allocation_run_id", metaRun.id).eq("strategy_id", strategyId)
        : { data: [] };
      const metaEntry = metaEntries?.[0] ?? null;

      const { data: monitorRuns } = await supabase.from("agent_monitor_runs").select("*").order("created_at", { ascending: false }).limit(1);
      const monitorRun = monitorRuns?.[0] ?? null;
      const { data: alerts } = monitorRun
        ? await supabase.from("agent_monitor_alerts").select("*").eq("monitor_run_id", monitorRun.id).eq("strategy_id", strategyId)
        : { data: [] };
      const hasCriticalAlert = (alerts ?? []).some((alert) => alert.severity === "critical");

      const suggestedAllocation = Number(metaEntry?.suggested_allocation ?? 0.1);
      const shouldTrade = suggestedAllocation >= 0.08 && !hasCriticalAlert;
      const quantity = shouldTrade ? (Number(portfolio.current_capital) * Math.min(suggestedAllocation, 0.2)) / currentPrice : 0;
      const status = shouldTrade ? (executionMode === "simulation" ? "simulated" : "dry-run") : "blocked";
      const side = shouldTrade ? "buy" : "hold";

      const { data: order, error: orderError } = await supabase.from("live_orders").insert({
        portfolio_id: portfolio.id,
        strategy_id: strategyId,
        exchange_order_id: executionMode === "simulation" ? `sim-${crypto.randomUUID()}` : `dry-${crypto.randomUUID()}`,
        symbol: strategy.symbol,
        side,
        order_type: "market",
        quantity,
        price: currentPrice,
        filled_price: shouldTrade ? currentPrice : null,
        status,
        fees: shouldTrade ? Number((quantity * currentPrice * 0.001).toFixed(4)) : 0,
        error_message: shouldTrade ? null : hasCriticalAlert ? "Execution blocked by critical monitor alert." : "Allocation below trade threshold.",
      }).select().single();
      if (orderError) throw orderError;

      await supabase.from("live_portfolios").update({ last_signal_check: new Date().toISOString() }).eq("id", portfolio.id);
      return Response.json({ ok: true, order, executionMode, blocked: !shouldTrade }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stop") {
      const { data, error } = await supabase.from("live_portfolios").update({ is_active: false }).eq("id", portfolio.id).select().single();
      if (error) throw error;
      return Response.json({ ok: true, portfolio: data, executionMode }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unsupported action.");
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown execute-trade error" },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
