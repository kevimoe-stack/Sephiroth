import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evaluateRow(
  strategy: Record<string, unknown>,
  backtest: Record<string, unknown> | null,
  walkforward: Array<Record<string, unknown>>,
  riskRule: Record<string, unknown> | null,
) {
  const passRate =
    walkforward.length === 0
      ? 0
      : walkforward.filter((row) => Boolean(row.passed)).length / walkforward.length;
  const sharpe = Number(backtest?.sharpe_ratio ?? 0);
  const winRate = Number(backtest?.win_rate ?? 0);
  const totalReturn = Number(backtest?.total_return ?? 0);
  const drawdown = Math.abs(Number(backtest?.max_drawdown ?? 100));
  const totalTrades = Number(backtest?.total_trades ?? 0);
  const profitFactor = Number(backtest?.profit_factor ?? 0);
  const capitalProtectionThreshold = Math.max(12, Number(riskRule?.max_daily_loss ?? 0.05) * 350);

  const healthScore = clampScore(45 + sharpe * 14 + winRate * 0.18 + totalReturn * 0.1 - drawdown * 0.7 + passRate * 18);
  const readinessScore = clampScore(25 + sharpe * 12 + passRate * 30 + (totalTrades >= 20 ? 18 : 4) - drawdown * 0.6);
  const capitalPreservationScore = clampScore(100 - drawdown * 3.2 + passRate * 15);
  const riskManagementScore = clampScore(40 + profitFactor * 12 + winRate * 0.18 + passRate * 20 - Math.max(0, drawdown - capitalProtectionThreshold) * 2);

  const kernelReasons: string[] = [];
  if (!backtest) kernelReasons.push("Kein Backtest");
  if (drawdown > capitalProtectionThreshold) kernelReasons.push("Drawdown zu hoch");
  if (passRate < 0.4) kernelReasons.push("Walk-Forward zu instabil");
  if (totalTrades < 15) kernelReasons.push("Zu wenige Trades");
  if (sharpe < 0.8) kernelReasons.push("Sharpe unter Mindestniveau");

  const passedKernel = kernelReasons.length === 0;
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
    strategy_name: String(strategy.name),
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
    const { data: strategies, error: strategiesError } = await supabase
      .from("strategies")
      .select("*")
      .neq("status", "eliminated");
    if (strategiesError) throw strategiesError;

    const { data: backtests, error: backtestsError } = await supabase
      .from("backtests")
      .select("*")
      .order("created_at", { ascending: false });
    if (backtestsError) throw backtestsError;

    const { data: walkforward, error: walkforwardError } = await supabase
      .from("walkforward_results")
      .select("*");
    if (walkforwardError) throw walkforwardError;

    const { data: riskRules, error: riskError } = await supabase
      .from("risk_rules")
      .select("*")
      .order("updated_at", { ascending: false });
    if (riskError) throw riskError;

    const globalRiskRule = (riskRules ?? []).find((rule) => Boolean(rule.is_global)) ?? null;
    const rows = (strategies ?? [])
      .map((strategy) => {
        const backtest = (backtests ?? []).find((item) => item.strategy_id === strategy.id) ?? null;
        const wfRows = (walkforward ?? []).filter((item) => item.strategy_id === strategy.id);
        return evaluateRow(strategy, backtest, wfRows, globalRiskRule);
      })
      .sort((left, right) => right.fitness_score - left.fitness_score);

    const champion = rows.find((row) => row.passed_kernel) ?? rows[0] ?? null;
    const challenger = rows.filter((row) => row.passed_kernel)[1] ?? rows[1] ?? null;
    const runNotes = [
      `qualified:${rows.filter((row) => row.passed_kernel).length}`,
      `kernel:${globalRiskRule ? "global-risk-rule" : "default-thresholds"}`,
    ];

    const { data: insertedRun, error: runError } = await supabase
      .from("agent_tournament_runs")
      .insert({
        champion_strategy_id: champion?.strategy_id ?? null,
        challenger_strategy_id: challenger?.strategy_id ?? null,
        total_candidates: rows.length,
        qualified_candidates: rows.filter((row) => row.passed_kernel).length,
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

    if (champion?.strategy_id) {
      await supabase.from("strategies").update({ is_champion: false }).neq("id", "");
      await supabase.from("strategies").update({ is_champion: true }).eq("id", champion.strategy_id);
    }

    return Response.json(
      {
        ok: true,
        run: insertedRun,
        champion,
        challenger,
        rows,
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
