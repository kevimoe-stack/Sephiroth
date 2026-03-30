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

function hasExecutionWatchlistVariant(variants: Record<string, unknown>[], parentStrategyId: string) {
  return variants.some((variant) => getParentStrategyId(variant) === parentStrategyId && hasQueueTag(variant, "execution-watchlist"));
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computePassRate(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return 0;
  return rows.filter((row) => Boolean(row.passed)).length / rows.length;
}

function computeResearchScore(
  backtest: Record<string, unknown> | null,
  walkforwardRows: Array<Record<string, unknown>>,
) {
  return (
    computePassRate(walkforwardRows) * 50 +
    Number(backtest?.sharpe_ratio ?? 0) * 20 +
    Number(backtest?.total_return ?? 0) * 0.4 -
    Math.abs(Number(backtest?.max_drawdown ?? 0)) * 0.8 +
    Math.min(Number(backtest?.total_trades ?? 0), 40) * 0.5
  );
}

function getPilotRole(
  strategy: Record<string, unknown>,
  pilotLeaderId: string | null,
  pilotSecondaryId: string | null,
) {
  const tags = Array.isArray(strategy.tags) ? strategy.tags : [];
  if (!tags.includes("pilot")) return null;
  if (String(strategy.id) === pilotLeaderId) return "focus";
  if (String(strategy.id) === pilotSecondaryId) return "comparison";
  return "pilot";
}

function computeOperationalFeedback(
  paperPortfolio: Record<string, unknown> | null,
  livePortfolio: Record<string, unknown> | null,
  liveOrders: Array<Record<string, unknown>>,
) {
  const blockedOrders = liveOrders.filter((order) => String(order.status ?? "") === "blocked").length;
  const errorOrders = liveOrders.filter((order) => Boolean(order.error_message)).length;
  const executedOrders = liveOrders.filter((order) => ["simulated", "dry-run", "filled"].includes(String(order.status ?? ""))).length;
  const paperTrades = Number(paperPortfolio?.total_trades ?? 0);
  const paperPnl = Number(paperPortfolio?.total_pnl ?? 0);
  const paperDrawdown = Math.abs(Number(paperPortfolio?.max_drawdown ?? 0));
  const paperWinRate = paperTrades > 0 ? Number(paperPortfolio?.winning_trades ?? 0) / paperTrades : 0;
  const blockedRatio = liveOrders.length > 0 ? blockedOrders / liveOrders.length : 0;
  const hasOperationalData = Boolean(paperPortfolio) || Boolean(livePortfolio) || liveOrders.length > 0;
  const score = hasOperationalData
    ? clampScore(
        50 +
          Math.min(executedOrders, 6) * 5 +
          Math.min(paperTrades, 30) * 0.6 +
          paperWinRate * 20 +
          Math.min(Math.max(paperPnl / 50, -20), 20) -
          blockedRatio * 28 -
          errorOrders * 8 -
          paperDrawdown * 1.1,
      )
    : null;

  return {
    score,
    blockedOrders,
    errorOrders,
    executedOrders,
    paperTrades,
    paperPnl,
    paperDrawdown,
    reasons: [
      ...(blockedOrders > 0 ? [`${blockedOrders} blockierte Execution-Checks`] : []),
      ...(errorOrders > 0 ? [`${errorOrders} Execution-Checks mit Fehlermeldung`] : []),
      ...(paperPnl < 0 ? ["Paper-PnL negativ"] : []),
      ...(paperDrawdown > 10 ? ["Paper Drawdown erhoeht"] : []),
    ],
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
    const { data: paperPortfolios, error: paperError } = await supabase.from("paper_portfolio").select("*").order("updated_at", { ascending: false });
    if (paperError) throw paperError;
    const { data: livePortfolios, error: liveError } = await supabase.from("live_portfolios").select("*").order("updated_at", { ascending: false });
    if (liveError) throw liveError;
    const { data: liveOrders, error: liveOrdersError } = await supabase.from("live_orders").select("*").order("created_at", { ascending: false });
    if (liveOrdersError) throw liveOrdersError;

    const allStrategies = strategies ?? [];
    const variants = allStrategies.filter(isAgentVariant);
    const parentStrategies = allStrategies.filter((strategy) => !isAgentVariant(strategy));
    const globalRiskRule = (riskRules ?? []).find((rule) => Boolean(rule.is_global)) ?? null;
    const pilotRanking = parentStrategies
      .filter((strategy) => Array.isArray(strategy.tags) && strategy.tags.includes("pilot"))
      .map((strategy) => {
        const latestBacktest = (backtests ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const strategyWalkforward = (walkforward ?? []).filter((item) => item.strategy_id === strategy.id);
        return {
          id: String(strategy.id),
          score: computeResearchScore(latestBacktest, strategyWalkforward),
        };
      })
      .sort((left, right) => right.score - left.score);
    const pilotLeaderId = pilotRanking[0]?.id ?? null;
    const pilotSecondaryId = pilotRanking[1]?.id ?? null;

    const optimizerCandidates = parentStrategies
      .map((strategy) => {
        const latestBacktest = (backtests ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const strategyWalkforward = (walkforward ?? []).filter((item) => item.strategy_id === strategy.id);
        const qualityGate = evaluateQualityGates({ backtest: latestBacktest, walkforward: strategyWalkforward, riskRule: globalRiskRule });
        const paperPortfolio = (paperPortfolios ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const livePortfolio = (livePortfolios ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const strategyOrders = (liveOrders ?? []).filter((item) => item.strategy_id === strategy.id).slice(0, 12);
        const operational = computeOperationalFeedback(paperPortfolio, livePortfolio, strategyOrders);
        const sharpe = Number(latestBacktest?.sharpe_ratio ?? 0);
        const totalReturn = Number(latestBacktest?.total_return ?? 0);
        const drawdown = Math.abs(Number(latestBacktest?.max_drawdown ?? 0));
        const readinessGap = Math.max(0, 70 - clampScore(25 + sharpe * 12 + qualityGate.passRate * 30 + (Number(latestBacktest?.total_trades ?? 0) >= 20 ? 18 : 4) - drawdown * 0.6));
        const pilotRole = getPilotRole(strategy, pilotLeaderId, pilotSecondaryId);
        const candidateScore =
          sharpe * -12 +
          drawdown * 2 +
          Math.max(0, -totalReturn) * 0.4 +
          readinessGap * 1.4 +
          (operational.score === null ? 0 : (100 - operational.score) * 0.45) +
          operational.blockedOrders * 6 +
          operational.errorOrders * 8 +
          (pilotRole === "focus" ? 12 : 0) +
          (pilotRole === "comparison" ? -8 : 0);
        return { strategy, latestBacktest, qualityGate, operational, candidateScore, pilotRole };
      })
      .filter(({ strategy, latestBacktest, qualityGate }) => {
        if (!latestBacktest) return false;
        if (qualityGate.passed) return false;
        if (Array.isArray(strategy.tags) && strategy.tags.includes("optimizer-paused")) return false;
        if (getPilotRole(strategy, pilotLeaderId, pilotSecondaryId) === "comparison") return false;
        if (hasExecutionWatchlistVariant(variants, String(strategy.id))) return false;
        if (variants.some((variant) => getParentStrategyId(variant) === strategy.id && (hasQueueTag(variant, "candidate-ready") || hasQueueTag(variant, "validation-pending")))) {
          return false;
        }
        if (hasRecentVariant(variants, String(strategy.id), 6)) return false;
        return true;
      })
      .sort((left, right) => right.candidateScore - left.candidateScore)
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
        optimization_priority: candidate.candidateScore,
        pilot_role: candidate.pilotRole,
        operational_score: candidate.operational.score,
        operational_reasons: candidate.operational.reasons,
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
