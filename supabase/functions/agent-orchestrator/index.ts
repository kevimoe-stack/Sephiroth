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
    const { data: jobRun, error: jobRunError } = await supabase
      .from("agent_job_runs")
      .insert({
        job_name: "agent-orchestrator",
        status: "running",
        steps_total: 5,
        steps_completed: 0,
        summary: { sequence: ["agent-tournament", "agent-lifecycle", "agent-monitor", "agent-regime", "agent-meta-allocation"] },
      })
      .select()
      .single();
    if (jobRunError || !jobRun) {
      throw jobRunError ?? new Error("Job run insert failed.");
    }

    const steps: Array<{ step_name: string; status: string; payload: Record<string, unknown> }> = [];

    const tournamentResult = await supabase.functions.invoke("agent-tournament");
    if (tournamentResult.error) throw tournamentResult.error;
    steps.push({
      step_name: "agent-tournament",
      status: "completed",
      payload: tournamentResult.data ?? {},
    });

    const lifecycleResult = await supabase.functions.invoke("agent-lifecycle");
    if (lifecycleResult.error) throw lifecycleResult.error;
    steps.push({
      step_name: "agent-lifecycle",
      status: "completed",
      payload: lifecycleResult.data ?? {},
    });

    const monitorResult = await supabase.functions.invoke("agent-monitor");
    if (monitorResult.error) throw monitorResult.error;
    steps.push({
      step_name: "agent-monitor",
      status: "completed",
      payload: monitorResult.data ?? {},
    });

    const regimeResult = await supabase.functions.invoke("agent-regime");
    if (regimeResult.error) throw regimeResult.error;
    steps.push({
      step_name: "agent-regime",
      status: "completed",
      payload: regimeResult.data ?? {},
    });

    const metaAllocationResult = await supabase.functions.invoke("agent-meta-allocation");
    if (metaAllocationResult.error) throw metaAllocationResult.error;
    steps.push({
      step_name: "agent-meta-allocation",
      status: "completed",
      payload: metaAllocationResult.data ?? {},
    });

    const stepRows = steps.map((step) => ({
      job_run_id: jobRun.id,
      ...step,
    }));
    const { error: stepsError } = await supabase.from("agent_job_steps").insert(stepRows);
    if (stepsError) throw stepsError;

    const { error: finalizeError } = await supabase
      .from("agent_job_runs")
      .update({
        status: "completed",
        steps_completed: steps.length,
        summary: {
          sequence: ["agent-tournament", "agent-lifecycle", "agent-monitor", "agent-regime", "agent-meta-allocation"],
          alerts: monitorResult.data?.alerts?.length ?? 0,
          champion: lifecycleResult.data?.champion?.strategy_id ?? null,
          reserveTarget: metaAllocationResult.data?.metaAllocationRun?.reserve_target ?? null,
        },
      })
      .eq("id", jobRun.id);
    if (finalizeError) throw finalizeError;

    return Response.json(
      {
        ok: true,
        jobRunId: jobRun.id,
        steps,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown orchestrator error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
