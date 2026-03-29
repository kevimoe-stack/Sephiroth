import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateQualityGates } from "../_shared/quality-gates.ts";

function isAgentVariant(strategy: Record<string, unknown>) {
  return Array.isArray(strategy.tags) && strategy.tags.includes("agent-variant");
}

function getParentStrategyId(strategy: Record<string, unknown>) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return null;
  const parentStrategyId = (parameters as Record<string, unknown>).parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : null;
}

function hasQueueTag(strategy: Record<string, unknown>, tag: string) {
  return Array.isArray(strategy.tags) && strategy.tags.includes(tag);
}

function hasRecentVariant(variants: Record<string, unknown>[], parentStrategyId: string, cooldownHours: number) {
  const now = Date.now();
  return variants.some((variant) => {
    if (getParentStrategyId(variant) !== parentStrategyId) return false;
    const createdAt = Date.parse(String(variant.created_at ?? ""));
    if (Number.isNaN(createdAt)) return false;
    return now - createdAt < cooldownHours * 60 * 60 * 1000;
  });
}

function buildResearchConfig(backtest: Record<string, unknown> | null) {
  return {
    startDate: String(backtest?.start_date ?? "2021-01-01"),
    endDate: String(backtest?.end_date ?? new Date().toISOString().slice(0, 10)),
    initialCapital: Number(backtest?.initial_capital ?? 10000),
    feeRate: 0.001,
    slippageRate: 0.0005,
    windows: 4,
  };
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
    const sequence = ["agent-optimizer", "agent-tournament", "agent-lifecycle", "agent-monitor", "agent-regime", "agent-meta-allocation"];
    const { data: jobRun, error: jobRunError } = await supabase
      .from("agent_job_runs")
      .insert({
        job_name: "agent-orchestrator",
        status: "running",
        steps_total: sequence.length,
        steps_completed: 0,
        summary: { sequence },
      })
      .select()
      .single();
    if (jobRunError || !jobRun) {
      throw jobRunError ?? new Error("Job run insert failed.");
    }

    const steps: Array<{ step_name: string; status: string; payload: Record<string, unknown> }> = [];

    const { data: strategies, error: strategyError } = await supabase.from("strategies").select("*").neq("status", "eliminated");
    if (strategyError) throw strategyError;
    const { data: backtests, error: backtestError } = await supabase.from("backtests").select("*").order("created_at", { ascending: false });
    if (backtestError) throw backtestError;
    const { data: walkforward, error: walkforwardError } = await supabase.from("walkforward_results").select("*");
    if (walkforwardError) throw walkforwardError;
    const { data: riskRules, error: riskRuleError } = await supabase.from("risk_rules").select("*").order("updated_at", { ascending: false });
    if (riskRuleError) throw riskRuleError;

    const allStrategies = strategies ?? [];
    const variants = allStrategies.filter(isAgentVariant);
    const parentStrategies = allStrategies.filter((strategy) => !isAgentVariant(strategy));
    const globalRiskRule = (riskRules ?? []).find((rule) => Boolean(rule.is_global)) ?? null;

    const optimizerCandidates = parentStrategies
      .map((strategy) => {
        const latestBacktest = (backtests ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const strategyWalkforward = (walkforward ?? []).filter((item) => item.strategy_id === strategy.id);
        const qualityGate = evaluateQualityGates({ backtest: latestBacktest, walkforward: strategyWalkforward, riskRule: globalRiskRule });
        return { strategy, latestBacktest, qualityGate };
      })
      .filter(({ strategy, latestBacktest, qualityGate }) => {
        if (!latestBacktest) return false;
        if (qualityGate.passed) return false;
        if (variants.some((variant) => getParentStrategyId(variant) === strategy.id && (hasQueueTag(variant, "candidate-ready") || hasQueueTag(variant, "validation-pending")))) {
          return false;
        }
        if (hasRecentVariant(variants, String(strategy.id), 6)) return false;
        return true;
      })
      .sort((left, right) => Number(left.latestBacktest?.sharpe_ratio ?? 0) - Number(right.latestBacktest?.sharpe_ratio ?? 0))
      .slice(0, 2);

    const optimizedParents: Array<Record<string, unknown>> = [];
    for (const candidate of optimizerCandidates) {
      const packResult = await supabase.functions.invoke("ai-agent", {
        body: { action: "create-variant-pack", strategyId: candidate.strategy.id },
      });
      if (packResult.error) throw packResult.error;
      const packVariants = Array.isArray(packResult.data?.variants) ? packResult.data.variants : [];
      const config = buildResearchConfig(candidate.latestBacktest);

      for (const variant of packVariants) {
        const backtestResult = await supabase.functions.invoke("run-backtest", {
          body: { strategyId: variant.id, ...config },
        });
        if (backtestResult.error) throw backtestResult.error;

        const walkforwardResult = await supabase.functions.invoke("run-walkforward", {
          body: { strategyId: variant.id, ...config },
        });
        if (walkforwardResult.error) throw walkforwardResult.error;
      }

      optimizedParents.push({
        strategy_id: candidate.strategy.id,
        strategy_name: candidate.strategy.name,
        variants_created: packVariants.length,
      });
    }

    steps.push({
      step_name: "agent-optimizer",
      status: "completed",
      payload: {
        optimizedParents,
        optimizedCount: optimizedParents.length,
      },
    });

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
          sequence,
          optimizedParents: optimizedParents.length,
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
