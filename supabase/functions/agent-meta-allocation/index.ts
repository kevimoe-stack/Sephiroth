import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: latestLifecycle } = await supabase
      .from("agent_lifecycle_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const lifecycleRun = latestLifecycle?.[0] ?? null;
    if (!lifecycleRun) {
      throw new Error("No lifecycle run found.");
    }

    const { data: allocations, error: allocationError } = await supabase
      .from("agent_allocations")
      .select("*")
      .eq("lifecycle_run_id", lifecycleRun.id);
    if (allocationError) throw allocationError;

    const { data: latestMonitor } = await supabase
      .from("agent_monitor_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const monitorRun = latestMonitor?.[0] ?? null;

    const { data: latestRegime } = await supabase
      .from("agent_regime_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const regimeRun = latestRegime?.[0] ?? null;
    if (!regimeRun) {
      throw new Error("No regime run found.");
    }

    const { data: regimeSnapshots, error: regimeError } = await supabase
      .from("agent_regime_snapshots")
      .select("*")
      .eq("regime_run_id", regimeRun.id);
    if (regimeError) throw regimeError;

    const { data: alerts } = monitorRun
      ? await supabase.from("agent_monitor_alerts").select("*").eq("monitor_run_id", monitorRun.id)
      : { data: [] };

    const alertMap = new Map<string, number>();
    for (const alert of alerts ?? []) {
      alertMap.set(alert.strategy_id, (alertMap.get(alert.strategy_id) ?? 0) + (alert.severity === "critical" ? 2 : 1));
    }

    const entries = (allocations ?? []).map((allocation) => {
      const regime = (regimeSnapshots ?? []).find((item) => item.strategy_id === allocation.strategy_id);
      const alertPressure = alertMap.get(allocation.strategy_id) ?? 0;
      const currentAllocation = Number(allocation.allocation_percent ?? 0);
      let multiplier = 1;
      let confidenceScore = 70;

      if (regime?.regime_label === "trend-up") {
        multiplier += 0.15;
        confidenceScore += 10;
      } else if (regime?.regime_label === "range-bound") {
        multiplier -= 0.05;
      } else if (regime?.regime_label === "high-volatility" || regime?.regime_label === "trend-down") {
        multiplier -= 0.2;
        confidenceScore -= 10;
      }

      multiplier -= alertPressure * 0.15;
      confidenceScore -= alertPressure * 12;

      const suggestedAllocation = Number(Math.max(0, currentAllocation * multiplier).toFixed(4));
      return {
        strategy_id: allocation.strategy_id,
        current_allocation: currentAllocation,
        suggested_allocation: suggestedAllocation,
        role: allocation.role,
        regime_label: regime?.regime_label ?? "unknown",
        confidence_score: Math.max(0, Math.min(100, confidenceScore)),
        rationale:
          alertPressure > 0
            ? "Alert pressure reduces allocation despite current role."
            : regime?.regime_label === "trend-up"
              ? "Trend-supportive regime favors slightly higher allocation."
              : "Allocation kept conservative under current regime.",
      };
    });

    const reserveTarget =
      (alerts ?? []).some((alert) => alert.severity === "critical")
        ? 0.35
        : (alerts ?? []).length > 0
          ? 0.25
          : 0.2;

    const { data: metaRun, error: metaRunError } = await supabase
      .from("agent_meta_allocation_runs")
      .insert({
        regime_run_id: regimeRun.id,
        lifecycle_run_id: lifecycleRun.id,
        monitor_run_id: monitorRun?.id ?? null,
        status: "proposed",
        reserve_target: reserveTarget,
        summary: {
          entries: entries.length,
          reserveTarget,
        },
      })
      .select()
      .single();
    if (metaRunError || !metaRun) {
      throw metaRunError ?? new Error("Meta allocation run insert failed.");
    }

    if (entries.length > 0) {
      const rows = entries.map((entry) => ({
        meta_allocation_run_id: metaRun.id,
        ...entry,
      }));
      const { error: entryError } = await supabase.from("agent_meta_allocation_entries").insert(rows);
      if (entryError) throw entryError;
    }

    return Response.json(
      {
        ok: true,
        metaAllocationRun: metaRun,
        entries,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown meta allocation error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
