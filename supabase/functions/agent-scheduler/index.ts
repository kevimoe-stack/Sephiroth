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
    const { data: configs } = await supabase
      .from("agent_scheduler_configs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const config = configs?.[0] ?? null;

    const orchestratorResult = await supabase.functions.invoke("agent-orchestrator");
    if (orchestratorResult.error) throw orchestratorResult.error;

    let rebalanceRunId: string | null = null;
    let rebalanceTriggered = false;
    let metaAllocationTriggered = false;

    if (config?.auto_rebalance) {
      const monitorResult = orchestratorResult.data?.steps?.find((step: { step_name?: string }) => step.step_name === "agent-monitor");
      const severeAlerts = Number(monitorResult?.payload?.monitorRun?.severe_alerts_count ?? 0);
      if (severeAlerts >= Number(config.severe_alert_threshold ?? 1)) {
        const rebalanceResult = await supabase.functions.invoke("agent-rebalance");
        if (rebalanceResult.error) throw rebalanceResult.error;
        rebalanceRunId = rebalanceResult.data?.rebalanceRun?.id ?? null;
        rebalanceTriggered = true;
      }
    }

    const metaAllocationResult = await supabase.functions.invoke("agent-meta-allocation");
    if (metaAllocationResult.error) throw metaAllocationResult.error;
    metaAllocationTriggered = true;

    const { data: schedulerRun, error: schedulerRunError } = await supabase
      .from("agent_scheduler_runs")
      .insert({
        config_id: config?.id ?? null,
        status: "completed",
        orchestrator_job_run_id: orchestratorResult.data?.jobRunId ?? null,
        rebalance_run_id: rebalanceRunId,
        summary: {
          autoRebalance: Boolean(config?.auto_rebalance),
          rebalanceTriggered,
          metaAllocationTriggered,
        },
      })
      .select()
      .single();
    if (schedulerRunError || !schedulerRun) {
      throw schedulerRunError ?? new Error("Scheduler run insert failed.");
    }

    return Response.json(
      {
        ok: true,
        schedulerRun,
        orchestrator: orchestratorResult.data,
        rebalanceTriggered,
        rebalanceRunId,
        metaAllocationTriggered,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scheduler error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
