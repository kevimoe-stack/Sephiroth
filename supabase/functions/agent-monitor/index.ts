import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface AlertRow {
  strategy_id: string;
  alert_type: string;
  severity: string;
  status: string;
  metric_value: number;
  threshold_value: number;
  message: string;
}

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

    const { data: allocations, error: allocationsError } = await supabase
      .from("agent_allocations")
      .select("*")
      .eq("lifecycle_run_id", lifecycleRun?.id ?? "");
    if (allocationsError && lifecycleRun) throw allocationsError;

    const strategyIds = (allocations ?? []).map((item) => item.strategy_id);
    const alerts: AlertRow[] = [];

    for (const strategyId of strategyIds) {
      const { data: backtests } = await supabase
        .from("backtests")
        .select("*")
        .eq("strategy_id", strategyId)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: walkforward } = await supabase
        .from("walkforward_results")
        .select("*")
        .eq("strategy_id", strategyId);

      const backtest = backtests?.[0] ?? null;
      const wfRows = walkforward ?? [];
      const passRate =
        wfRows.length === 0
          ? 0
          : wfRows.filter((row) => row.passed).length / wfRows.length;
      const sharpe = Number(backtest?.sharpe_ratio ?? 0);
      const drawdown = Math.abs(Number(backtest?.max_drawdown ?? 0));
      const totalTrades = Number(backtest?.total_trades ?? 0);

      if (sharpe < 0.8) {
        alerts.push({
          strategy_id: strategyId,
          alert_type: "sharpe-drift",
          severity: sharpe < 0.3 ? "critical" : "warning",
          status: "open",
          metric_value: sharpe,
          threshold_value: 0.8,
          message: "Sharpe liegt unter dem Mindestniveau für kontrolliertes Deployment.",
        });
      }

      if (drawdown > 18) {
        alerts.push({
          strategy_id: strategyId,
          alert_type: "drawdown-breach",
          severity: drawdown > 25 ? "critical" : "warning",
          status: "open",
          metric_value: drawdown,
          threshold_value: 18,
          message: "Drawdown überschreitet die empfohlene Obergrenze.",
        });
      }

      if (passRate < 0.4) {
        alerts.push({
          strategy_id: strategyId,
          alert_type: "walkforward-drift",
          severity: passRate < 0.2 ? "critical" : "warning",
          status: "open",
          metric_value: Number((passRate * 100).toFixed(2)),
          threshold_value: 40,
          message: "Walk-Forward-Stabilität ist zu schwach.",
        });
      }

      if (totalTrades < 15) {
        alerts.push({
          strategy_id: strategyId,
          alert_type: "sample-size-risk",
          severity: "warning",
          status: "open",
          metric_value: totalTrades,
          threshold_value: 15,
          message: "Zu wenige Trades für eine belastbare Live-Freigabe.",
        });
      }
    }

    const severeAlerts = alerts.filter((alert) => alert.severity === "critical");
    const { data: monitorRun, error: monitorRunError } = await supabase
      .from("agent_monitor_runs")
      .insert({
        lifecycle_run_id: lifecycleRun?.id ?? null,
        monitored_agents: strategyIds.length,
        alerts_count: alerts.length,
        severe_alerts_count: severeAlerts.length,
        summary: {
          status:
            severeAlerts.length > 0 ? "rebalance-required" : alerts.length > 0 ? "review-required" : "healthy",
          reserveBias: severeAlerts.length > 0 ? 0.35 : alerts.length > 0 ? 0.25 : 0.2,
        },
      })
      .select()
      .single();
    if (monitorRunError || !monitorRun) {
      throw monitorRunError ?? new Error("Monitor run insert failed.");
    }

    if (alerts.length > 0) {
      const alertRows = alerts.map((alert) => ({
        monitor_run_id: monitorRun.id,
        ...alert,
      }));
      const { error: alertsError } = await supabase.from("agent_monitor_alerts").insert(alertRows);
      if (alertsError) throw alertsError;
    }

    return Response.json(
      {
        ok: true,
        monitorRun,
        alerts,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown monitor error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
