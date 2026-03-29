import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { runWalkForwardEngine } from "../_shared/trading-engine.ts";

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

    await supabase.from("walkforward_results").delete().eq("strategy_id", strategy.id);
    const rows = results.map((row) => ({
      strategy_id: strategy.id,
      ...row,
    }));
    const { data, error } = await supabase.from("walkforward_results").insert(rows).select();
    if (error) {
      throw error;
    }

    return Response.json(
      {
        ok: true,
        windows: data?.length ?? 0,
        results: data ?? [],
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
