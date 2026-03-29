import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
    const { data: latestMonitor } = await supabase
      .from("agent_monitor_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const monitorRun = latestMonitor?.[0] ?? null;
    if (!monitorRun) {
      throw new Error("No monitor run found.");
    }

    const { data: alerts, error: alertsError } = await supabase
      .from("agent_monitor_alerts")
      .select("*")
      .eq("monitor_run_id", monitorRun.id);
    if (alertsError) throw alertsError;

    const { data: latestLifecycle } = await supabase
      .from("agent_lifecycle_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const lifecycleRun = latestLifecycle?.[0] ?? null;

    const { data: allocations, error: allocationsError } = await supabase
      .from("agent_allocations")
      .select("*")
      .eq("lifecycle_run_id", lifecycleRun?.id ?? "");
    if (allocationsError && lifecycleRun) throw allocationsError;

    const severeAlerts = (alerts ?? []).filter((alert) => alert.severity === "critical");
    const reserveTarget = severeAlerts.length > 0 ? 0.4 : (alerts?.length ?? 0) > 0 ? 0.3 : 0.2;
    const rationale = [
      `alerts:${alerts?.length ?? 0}`,
      `critical:${severeAlerts.length}`,
      `reserve-target:${reserveTarget}`,
    ];

    const { data: rebalanceRun, error: rebalanceError } = await supabase
      .from("agent_rebalance_runs")
      .insert({
        monitor_run_id: monitorRun.id,
        lifecycle_run_id: lifecycleRun?.id ?? null,
        status: severeAlerts.length > 0 ? "urgent-review" : (alerts?.length ?? 0) > 0 ? "review" : "stable",
        reserve_target: reserveTarget,
        rationale,
      })
      .select()
      .single();
    if (rebalanceError || !rebalanceRun) {
      throw rebalanceError ?? new Error("Rebalance run insert failed.");
    }

    const riskyStrategyIds = new Set((alerts ?? []).map((alert) => alert.strategy_id));
    const actions = (allocations ?? []).map((allocation) => {
      const currentAllocation = Number(allocation.allocation_percent ?? 0);
      const risky = riskyStrategyIds.has(allocation.strategy_id);
      const suggestedAllocation = risky
        ? Number((currentAllocation * 0.5).toFixed(4))
        : Number((currentAllocation * (1 - reserveTarget / 2)).toFixed(4));
      return {
        strategy_id: allocation.strategy_id,
        action_type: risky ? "decrease" : "trim",
        current_allocation: currentAllocation,
        suggested_allocation: suggestedAllocation,
        reason: risky
          ? "Strategy triggered monitor alerts and should be reduced."
          : "Healthy strategy trimmed to increase reserve buffer.",
      };
    });

    if (actions.length > 0) {
      const actionRows = actions.map((action) => ({
        rebalance_run_id: rebalanceRun.id,
        ...action,
      }));
      const { error: actionsError } = await supabase.from("agent_rebalance_actions").insert(actionRows);
      if (actionsError) throw actionsError;
    }

    return Response.json(
      {
        ok: true,
        rebalanceRun,
        actions,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown rebalance error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
