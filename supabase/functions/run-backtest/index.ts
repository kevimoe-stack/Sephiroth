import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { runBacktestEngine } from "../_shared/trading-engine.ts";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
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

    const result = await runBacktestEngine(strategy, {
      startDate,
      endDate,
      initialCapital,
      feeRate,
      slippageRate,
    });

    const { data: insertedBacktest, error: backtestError } = await supabase
      .from("backtests")
      .insert({
        strategy_id: strategy.id,
        start_date: startDate,
        end_date: endDate,
        initial_capital: initialCapital,
        final_capital: result.metrics.final_capital,
        total_return: result.metrics.total_return,
        cagr: result.metrics.cagr,
        sharpe_ratio: result.metrics.sharpe_ratio,
        max_drawdown: result.metrics.max_drawdown,
        win_rate: result.metrics.win_rate,
        profit_factor: result.metrics.profit_factor,
        total_trades: result.metrics.total_trades,
        winning_trades: result.metrics.winning_trades,
        losing_trades: result.metrics.losing_trades,
        avg_trade_duration: result.metrics.avg_trade_duration,
        equity_curve: result.metrics.equity_curve,
        monthly_returns: result.metrics.monthly_returns,
        status: "completed",
      })
      .select()
      .single();

    if (backtestError || !insertedBacktest) {
      throw backtestError ?? new Error("Backtest insert failed.");
    }

    if (result.trades.length > 0) {
      const tradeRows = result.trades.map((trade) => ({
        backtest_id: insertedBacktest.id,
        ...trade,
      }));
      const { error: tradesError } = await supabase.from("backtest_trades").insert(tradeRows);
      if (tradesError) {
        throw tradesError;
      }
    }

    return Response.json(
      {
        ok: true,
        backtest: insertedBacktest,
        tradesInserted: result.trades.length,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown backtest error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
