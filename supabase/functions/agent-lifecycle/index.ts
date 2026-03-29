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
    const { data: latestTournament, error: tournamentError } = await supabase
      .from("agent_tournament_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (tournamentError || !latestTournament) {
      throw tournamentError ?? new Error("No tournament run found.");
    }

    const { data: tournamentEntries, error: entriesError } = await supabase
      .from("agent_tournament_entries")
      .select("*")
      .eq("tournament_run_id", latestTournament.id)
      .order("rank", { ascending: true });
    if (entriesError) throw entriesError;

    const qualified = (tournamentEntries ?? []).filter((entry) => entry.passed_kernel);
    const champion = qualified[0] ?? tournamentEntries?.[0] ?? null;
    const challenger = qualified[1] ?? tournamentEntries?.[1] ?? null;

    const { data: previousLifecycle } = await supabase
      .from("agent_lifecycle_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const previous = previousLifecycle?.[0] ?? null;

    const notes = [
      `qualified:${qualified.length}`,
      champion ? `champion:${champion.strategy_id}` : "champion:none",
      challenger ? `challenger:${challenger.strategy_id}` : "challenger:none",
    ];

    const { data: lifecycleRun, error: lifecycleError } = await supabase
      .from("agent_lifecycle_runs")
      .insert({
        tournament_run_id: latestTournament.id,
        champion_strategy_id: champion?.strategy_id ?? null,
        challenger_strategy_id: challenger?.strategy_id ?? null,
        reserve_allocation: 0.2,
        notes,
      })
      .select()
      .single();
    if (lifecycleError || !lifecycleRun) {
      throw lifecycleError ?? new Error("Lifecycle run insert failed.");
    }

    const events: Array<{
      strategy_id: string;
      event_type: string;
      severity: string;
      payload: Record<string, unknown>;
    }> = [];

    if (champion) {
      events.push({
        strategy_id: champion.strategy_id,
        event_type:
          previous?.champion_strategy_id === champion.strategy_id ? "champion-retained" : "champion-promoted",
        severity: "info",
        payload: {
          previousChampion: previous?.champion_strategy_id ?? null,
          fitness: champion.fitness_score,
        },
      });
    }

    if (challenger) {
      events.push({
        strategy_id: challenger.strategy_id,
        event_type:
          previous?.challenger_strategy_id === challenger.strategy_id ? "challenger-retained" : "challenger-promoted",
        severity: "info",
        payload: {
          fitness: challenger.fitness_score,
        },
      });
    }

    if (
      previous?.champion_strategy_id &&
      previous.champion_strategy_id !== champion?.strategy_id
    ) {
      events.push({
        strategy_id: previous.champion_strategy_id,
        event_type: "champion-retired",
        severity: "warning",
        payload: {
          newChampion: champion?.strategy_id ?? null,
        },
      });
    }

    for (const row of tournamentEntries ?? []) {
      if (!row.passed_kernel) {
        events.push({
          strategy_id: row.strategy_id,
          event_type: "risk-kernel-watch",
          severity: "warning",
          payload: {
            reasons: row.kernel_reasons ?? [],
            fitness: row.fitness_score,
          },
        });
      }
    }

    if (events.length > 0) {
      const eventRows = events.map((event) => ({
        lifecycle_run_id: lifecycleRun.id,
        ...event,
      }));
      const { error: eventInsertError } = await supabase.from("agent_lifecycle_events").insert(eventRows);
      if (eventInsertError) throw eventInsertError;
    }

    const allocations: Array<{
      strategy_id: string;
      allocation_percent: number;
      role: string;
      rationale: string;
    }> = [];

    if (champion) {
      allocations.push({
        strategy_id: champion.strategy_id,
        allocation_percent: 0.5,
        role: "champion",
        rationale: "Highest qualified fitness after risk-kernel gating.",
      });
    }

    const qualifiedChallengers = qualified.slice(1, 4);
    if (qualifiedChallengers.length > 0) {
      const challengerAllocation = 0.3 / qualifiedChallengers.length;
      for (const row of qualifiedChallengers) {
        allocations.push({
          strategy_id: row.strategy_id,
          allocation_percent: Number(challengerAllocation.toFixed(4)),
          role: "challenger",
          rationale: "Diversified allocation across qualified challengers.",
        });
      }
    }

    if (allocations.length > 0) {
      const allocationRows = allocations.map((allocation) => ({
        lifecycle_run_id: lifecycleRun.id,
        ...allocation,
      }));
      const { error: allocationError } = await supabase.from("agent_allocations").insert(allocationRows);
      if (allocationError) throw allocationError;
    }

    return Response.json(
      {
        ok: true,
        lifecycleRun,
        champion,
        challenger,
        events,
        allocations,
        reserveAllocation: 0.2,
      },
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown lifecycle error",
      },
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
