import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateQualityGates } from "../_shared/quality-gates.ts";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getParentStrategyId(strategy: Record<string, unknown>) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return null;
  const parentStrategyId = (parameters as Record<string, unknown>).parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : null;
}

function isEligibleForTournament(strategy: Record<string, unknown>) {
  const tags = Array.isArray(strategy.tags) ? strategy.tags.filter((tag) => typeof tag === "string") : [];
  const isAgentVariant = tags.includes("agent-variant");
  return strategy.status !== "eliminated" && (!isAgentVariant || tags.includes("candidate-ready"));
}

function selectBestRows(rows: Array<Record<string, unknown>>) {
  const directRows = rows.filter((row) => !(Array.isArray(row.tags) ? row.tags : []).includes("agent-variant"));
  const variantRows = rows.filter((row) => (Array.isArray(row.tags) ? row.tags : []).includes("agent-variant"));
  const bestVariantByParent = new Map<string, Record<string, unknown>>();

  for (const row of variantRows) {
    const parentStrategyId = typeof row.parent_strategy_id === "string" && row.parent_strategy_id.length > 0 ? row.parent_strategy_id : String(row.strategy_id);
    const existing = bestVariantByParent.get(parentStrategyId);
    if (!existing || Number(row.fitness_score ?? 0) > Number(existing.fitness_score ?? 0)) {
      bestVariantByParent.set(parentStrategyId, row);
    }
  }

  return [...directRows, ...bestVariantByParent.values()].sort((left, right) => Number(right.fitness_score ?? 0) - Number(left.fitness_score ?? 0));
}

function evaluateRow(
  strategy: Record<string, unknown>,
  backtest: Record<string, unknown> | null,
  walkforward: Array<Record<string, unknown>>,
  riskRule: Record<string, unknown> | null,
) {
  const gateEvaluation = evaluateQualityGates({ backtest, walkforward, riskRule });
  const passRate = gateEvaluation.passRate;
  const sharpe = Number(backtest?.sharpe_ratio ?? 0);
  const winRate = Number(backtest?.win_rate ?? 0);
  const totalReturn = Number(backtest?.total_return ?? 0);
  const drawdown = Math.abs(Number(backtest?.max_drawdown ?? 100));
  const profitFactor = Number(backtest?.profit_factor ?? 0);
  const capitalProtectionThreshold = gateEvaluation.thresholds.maxDrawdown;
  const tags = Array.isArray(strategy.tags) ? strategy.tags.filter((tag) => typeof tag === "string") : [];

  const healthScore = clampScore(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - drawdown * 0.7 + passRate * 18);
  const readinessScore = clampScore(25 + sharpe * 12 + passRate * 30 + (Number(backtest?.total_trades ?? 0) >= 20 ? 18 : 4) - drawdown * 0.6);
  const capitalPreservationScore = clampScore(100 - drawdown * 3.2 + passRate * 15);
  const riskManagementScore = clampScore(40 + profitFactor * 12 + winRate * 0.18 + passRate * 20 - Math.max(0, drawdown - capitalProtectionThreshold) * 2);
  const kernelReasons = [...gateEvaluation.reasons];
  const passedKernel = gateEvaluation.passed;
  const fitnessScore = passedKernel
    ? clampScore(
        capitalPreservationScore * 0.35 +
          riskManagementScore * 0.25 +
          healthScore * 0.2 +
          readinessScore * 0.1 +
          Math.min(totalReturn, 100) * 0.1,
      )
    : clampScore(Math.min(capitalPreservationScore, riskManagementScore) * 0.5);

  return {
    strategy_id: String(strategy.id),
    parent_strategy_id: getParentStrategyId(strategy),
    strategy_name: String(strategy.name),
    tags,
    health_score: healthScore,
    readiness_score: readinessScore,
    capital_preservation_score: capitalPreservationScore,
    risk_management_score: riskManagementScore,
    fitness_score: fitnessScore,
    passed_kernel: passedKernel,
    kernel_reasons: kernelReasons,
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
    const { data: strategies, error: strategiesError } = await supabase.from("strategies").select("*").neq("status", "eliminated");
    if (strategiesError) throw strategiesError;

    const { data: backtests, error: backtestsError } = await supabase.from("backtests").select("*").order("created_at", { ascending: false });
    if (backtestsError) throw backtestsError;

    const { data: walkforward, error: walkforwardError } = await supabase.from("walkforward_results").select("*");
    if (walkforwardError) throw walkforwardError;

    const { data: riskRules, error: riskError } = await supabase.from("risk_rules").select("*").order("updated_at", { ascending: false });
    if (riskError) throw riskError;

    const eligibleStrategies = (strategies ?? []).filter(isEligibleForTournament);
    const globalRiskRule = (riskRules ?? []).find((rule) => Boolean(rule.is_global)) ?? null;
    const evaluatedRows = eligibleStrategies
      .map((strategy) => {
        const backtest = (backtests ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const wfRows = (walkforward ?? []).filter((item) => item.strategy_id === strategy.id);
        return evaluateRow(strategy, backtest, wfRows, globalRiskRule);
      })
      .sort((left, right) => Number(right.fitness_score ?? 0) - Number(left.fitness_score ?? 0));
    const rows = selectBestRows(evaluatedRows);

    const qualifiedRows = rows.filter((row) => Boolean(row.passed_kernel));
    const champion = qualifiedRows[0] ?? null;
    const challenger = qualifiedRows[1] ?? null;
    const runNotes = [
      `qualified:${qualifiedRows.length}`,
      `eligible:${eligibleStrategies.length}`,
      `selected:${rows.length}`,
      `kernel:${globalRiskRule ? "global-risk-rule" : "default-thresholds"}`,
      "queue:candidate-ready-only-for-agent-variants",
      "selection:best-candidate-per-parent",
    ];

    const { data: insertedRun, error: runError } = await supabase
      .from("agent_tournament_runs")
      .insert({
        champion_strategy_id: champion?.strategy_id ?? null,
        challenger_strategy_id: challenger?.strategy_id ?? null,
        total_candidates: rows.length,
        qualified_candidates: qualifiedRows.length,
        notes: runNotes,
      })
      .select()
      .single();
    if (runError || !insertedRun) throw runError ?? new Error("Tournament run insert failed.");

    if (rows.length > 0) {
      const entryRows = rows.map((row, index) => ({
        tournament_run_id: insertedRun.id,
        strategy_id: row.strategy_id,
        rank: index + 1,
        health_score: row.health_score,
        readiness_score: row.readiness_score,
        capital_preservation_score: row.capital_preservation_score,
        risk_management_score: row.risk_management_score,
        fitness_score: row.fitness_score,
        passed_kernel: row.passed_kernel,
        kernel_reasons: row.kernel_reasons,
      }));
      const { error: entriesError } = await supabase.from("agent_tournament_entries").insert(entryRows);
      if (entriesError) throw entriesError;
    }

    await supabase.from("strategies").update({ is_champion: false }).neq("id", "");
    if (champion?.strategy_id) {
      await supabase.from("strategies").update({ is_champion: true }).eq("id", champion.strategy_id);
    }

    return Response.json(
      {
        ok: true,
        run: insertedRun,
        champion,
        challenger,
        rows,
        eligibleCandidates: eligibleStrategies.length,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown tournament error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
