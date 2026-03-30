import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateQualityGates } from "../_shared/quality-gates.ts";
import { runWalkForwardEngine } from "../_shared/trading-engine.ts";

function removeQueueTags(tags: string[]) {
  return tags.filter((tag) => !["candidate-ready", "needs-improvement", "validation-pending", "preferred-for-tournament", "pack-winner", "retired-variant", "execution-watchlist"].includes(tag));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function getParentStrategyId(strategy: Record<string, unknown>) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return null;
  const parentStrategyId = (parameters as Record<string, unknown>).parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : null;
}

function compareCandidates(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftSharpe = Number(left.sharpe_ratio ?? 0);
  const rightSharpe = Number(right.sharpe_ratio ?? 0);
  if (rightSharpe !== leftSharpe) return rightSharpe - leftSharpe;
  const leftReturn = Number(left.total_return ?? 0);
  const rightReturn = Number(right.total_return ?? 0);
  if (rightReturn !== leftReturn) return rightReturn - leftReturn;
  const leftTrades = Number(left.total_trades ?? 0);
  const rightTrades = Number(right.total_trades ?? 0);
  return rightTrades - leftTrades;
}

function isRecent(createdAt: string | null | undefined, windowHours: number) {
  const parsed = Date.parse(String(createdAt ?? ""));
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed < windowHours * 60 * 60 * 1000;
}

function qualifiesForExecutionWatchlist(backtest: Record<string, unknown> | null, passRate: number, gatePassed = true) {
  if (!gatePassed || !backtest) return false;
  const sharpe = Number(backtest.sharpe_ratio ?? 0);
  const drawdown = Math.abs(Number(backtest.max_drawdown ?? 100));
  const totalReturn = Number(backtest.total_return ?? 0);
  const totalTrades = Number(backtest.total_trades ?? 0);
  const profitFactor = Number(backtest.profit_factor ?? 0);
  return sharpe >= 1.05 && drawdown <= 12 && totalReturn > 0 && totalTrades >= 25 && profitFactor >= 1.2 && passRate >= 0.6;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const strategyId = String(body.strategyId ?? "");
    if (!strategyId) {
      throw new Error("strategyId is required.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: strategy, error: strategyError } = await supabase
      .from("strategies")
      .select("*")
      .eq("id", strategyId)
      .single();

    if (strategyError || !strategy) {
      throw strategyError ?? new Error("Strategy not found.");
    }

    const startDate = String(body.startDate ?? "2021-01-01");
    const endDate = String(body.endDate ?? new Date().toISOString().slice(0, 10));
    const initialCapital = Number(body.initialCapital ?? 10000);
    const feeRate = Number(body.feeRate ?? 0.001);
    const slippageRate = Number(body.slippageRate ?? 0.0005);
    const windows = Number(body.windows ?? 4);
    const strategySnapshot = strategy.parameters ?? {};

    const { data: existingRows, error: existingRowsError } = await supabase
      .from("walkforward_results")
      .select("*")
      .eq("strategy_id", strategy.id)
      .eq("run_start_date", startDate)
      .eq("run_end_date", endDate)
      .eq("initial_capital", initialCapital)
      .eq("fee_rate", feeRate)
      .eq("slippage_rate", slippageRate)
      .eq("windows_requested", windows)
      .order("created_at", { ascending: false });
    if (existingRowsError) throw existingRowsError;

    const compatibleRows = (existingRows ?? []).filter((row) =>
      stableStringify(row.strategy_params_snapshot ?? {}) === stableStringify(strategySnapshot)
    );
    const groups = new Map<string, typeof compatibleRows>();
    for (const row of compatibleRows) {
      const key = row.run_group_id ?? `${row.created_at}-${row.window_number}`;
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    }
    const cachedRun = Array.from(groups.values())
      .map((rows) => [...rows].sort((left, right) => Number(left.window_number ?? 0) - Number(right.window_number ?? 0)))
      .find((rows) => rows.length >= windows);

    if (cachedRun) {
      const { data: backtests, error: backtestError } = await supabase
        .from("backtests")
        .select("*")
        .eq("strategy_id", strategy.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (backtestError) throw backtestError;

      const { data: riskRules, error: riskError } = await supabase
        .from("risk_rules")
        .select("*")
        .or(`strategy_id.eq.${strategy.id},is_global.eq.true`)
        .order("updated_at", { ascending: false });
      if (riskError) throw riskError;

      const selectedRiskRule = (riskRules ?? []).find((rule) => rule.strategy_id === strategy.id) ?? (riskRules ?? []).find((rule) => rule.is_global) ?? null;
      const qualityGate = evaluateQualityGates({
        backtest: backtests?.[0] ?? null,
        walkforward: cachedRun,
        riskRule: selectedRiskRule,
      });

      return Response.json(
        {
          ok: true,
          windows: cachedRun.length,
          results: cachedRun,
          qualityGate,
          queueStatus: qualityGate.passed ? "candidate-ready" : "needs-improvement",
          preferredVariantId: null,
          cached: true,
        },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const runGroupId = crypto.randomUUID();

    const results = await runWalkForwardEngine(strategy, {
      startDate,
      endDate,
      initialCapital,
      feeRate,
      slippageRate,
      windows,
    });

    if (results.length === 0) {
      throw new Error("Walk-forward produced no valid windows.");
    }

    const rows = results.map((row) => ({
      strategy_id: strategy.id,
      run_group_id: runGroupId,
      run_start_date: startDate,
      run_end_date: endDate,
      initial_capital: initialCapital,
      fee_rate: feeRate,
      slippage_rate: slippageRate,
      windows_requested: windows,
      strategy_params_snapshot: strategySnapshot,
      ...row,
    }));
    const { data, error } = await supabase.from("walkforward_results").insert(rows).select();
    if (error) {
      throw error;
    }

    const { data: backtests, error: backtestError } = await supabase
      .from("backtests")
      .select("*")
      .eq("strategy_id", strategy.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (backtestError) throw backtestError;

    const { data: riskRules, error: riskError } = await supabase
      .from("risk_rules")
      .select("*")
      .or(`strategy_id.eq.${strategy.id},is_global.eq.true`)
      .order("updated_at", { ascending: false });
    if (riskError) throw riskError;

    const selectedRiskRule = (riskRules ?? []).find((rule) => rule.strategy_id === strategy.id) ?? (riskRules ?? []).find((rule) => rule.is_global) ?? null;
    const qualityGate = evaluateQualityGates({
      backtest: backtests?.[0] ?? null,
      walkforward: data ?? [],
      riskRule: selectedRiskRule,
    });

    const existingTags = Array.isArray(strategy.tags) ? strategy.tags.filter((tag) => typeof tag === "string") : [];
    const refreshedTags = removeQueueTags(existingTags);
    const queueTag = qualityGate.passed ? "candidate-ready" : "needs-improvement";
    let nextTags = Array.from(new Set([...refreshedTags, queueTag]));
    const executionWatchlist = qualifiesForExecutionWatchlist(backtests?.[0] ?? null, qualityGate.passRate, qualityGate.passed);
    if (executionWatchlist) {
      nextTags = Array.from(new Set([...nextTags, "execution-watchlist"]));
    }

    const parentStrategyId = getParentStrategyId(strategy);
    let preferredVariantId: string | null = null;

    if (parentStrategyId) {
      const { data: siblingStrategies, error: siblingError } = await supabase
        .from("strategies")
        .select("*")
        .contains("tags", ["agent-variant"]);
      if (siblingError) throw siblingError;

      const variantsForParent = (siblingStrategies ?? []).filter((item) => getParentStrategyId(item) === parentStrategyId);
      const recentFailedVariants = variantsForParent.filter((item) => {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return tags.includes("needs-improvement") && isRecent(String(item.updated_at ?? item.created_at ?? ""), 24);
      });
      const readyVariants = variantsForParent.filter((item) => Array.isArray(item.tags) && item.tags.includes("candidate-ready"));

      if (readyVariants.length > 0) {
        const { data: siblingBacktests, error: siblingBacktestsError } = await supabase
          .from("backtests")
          .select("*")
          .in("strategy_id", readyVariants.map((item) => item.id))
          .order("created_at", { ascending: false });
        if (siblingBacktestsError) throw siblingBacktestsError;

        const latestByVariant = readyVariants.map((variant) => ({
          variant,
          backtest: (siblingBacktests ?? []).find((item) => item.strategy_id === variant.id) ?? null,
        }));

        latestByVariant.sort((left, right) => compareCandidates(left.backtest ?? {}, right.backtest ?? {}));
        preferredVariantId = latestByVariant[0]?.variant.id ?? null;

        for (const variant of variantsForParent) {
          const variantTags = Array.isArray(variant.tags) ? variant.tags.filter((tag) => typeof tag === "string") : [];
          const cleaned = removeQueueTags(variantTags).concat(
            variantTags.includes("candidate-ready") ? ["candidate-ready"] : variantTags.includes("needs-improvement") ? ["needs-improvement"] : [],
          );
          const variantNextTags = Array.from(new Set([
            ...cleaned,
            ...(variant.id === preferredVariantId ? ["preferred-for-tournament", "pack-winner"] : []),
            ...(qualifiesForExecutionWatchlist((siblingBacktests ?? []).find((item) => item.strategy_id === variant.id) ?? null, 0.6, variantTags.includes("candidate-ready")) ? ["execution-watchlist"] : []),
          ]));
          const { error: siblingUpdateError } = await supabase.from("strategies").update({ tags: variantNextTags }).eq("id", variant.id);
          if (siblingUpdateError) throw siblingUpdateError;
        }
      }

      if (!qualityGate.passed && recentFailedVariants.length >= 3) {
        nextTags = Array.from(new Set([...removeQueueTags(existingTags), "needs-improvement", "retired-variant"]));
        const { data: parentStrategy } = await supabase.from("strategies").select("*").eq("id", parentStrategyId).single();
        const parentTags = Array.isArray(parentStrategy?.tags) ? parentStrategy.tags.filter((tag) => typeof tag === "string") : [];
        if (!parentTags.includes("optimizer-paused")) {
          const { error: parentUpdateError } = await supabase
            .from("strategies")
            .update({ tags: Array.from(new Set([...parentTags, "optimizer-paused"])) })
            .eq("id", parentStrategyId);
          if (parentUpdateError) throw parentUpdateError;
        }
      }
    }

    if (preferredVariantId === strategy.id) {
      nextTags = Array.from(new Set([
        ...removeQueueTags(existingTags),
        queueTag,
        "preferred-for-tournament",
        "pack-winner",
        ...(executionWatchlist ? ["execution-watchlist"] : []),
      ]));
    }

    const { error: updateError } = await supabase
      .from("strategies")
      .update({
        tags: nextTags,
        status: qualityGate.passed && existingTags.includes("agent-variant") ? "active" : strategy.status,
      })
      .eq("id", strategy.id);
    if (updateError) throw updateError;

    return Response.json(
      {
        ok: true,
        windows: data?.length ?? 0,
        results: data ?? [],
        qualityGate,
        queueStatus: queueTag,
        preferredVariantId,
        cached: false,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown walk-forward error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
