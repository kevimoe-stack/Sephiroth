import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import type { WalkforwardResult } from "@/integrations/supabase/types";
import { getPilotComparison, getPilotRole, getResearchSnapshot } from "@/lib/analytics";
import { formatDateTime, formatNumber } from "@/lib/utils";

function groupRuns(rows: WalkforwardResult[]) {
  const groups = new Map<string, WalkforwardResult[]>();
  for (const row of rows) {
    const key = row.run_group_id ?? `${row.strategy_id}-${row.created_at}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, runRows]) => {
      const sorted = [...runRows].sort((left, right) => left.window_number - right.window_number);
      return {
        id: key,
        strategy_id: sorted[0]?.strategy_id ?? "",
        created_at: sorted[0]?.created_at ?? "",
        run_start_date: sorted[0]?.run_start_date ?? sorted[0]?.in_sample_start ?? "",
        run_end_date: sorted[0]?.run_end_date ?? sorted[sorted.length - 1]?.out_of_sample_end ?? "",
        windows_requested: sorted[0]?.windows_requested ?? sorted.length,
        fee_rate: sorted[0]?.fee_rate ?? null,
        slippage_rate: sorted[0]?.slippage_rate ?? null,
        avg_efficiency:
          sorted.length === 0
            ? 0
            : sorted.reduce((sum, row) => sum + Number(row.efficiency_ratio ?? 0), 0) / sorted.length,
        passed_ratio:
          sorted.length === 0
            ? 0
            : sorted.filter((row) => Boolean(row.passed)).length / sorted.length,
      };
    })
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export default function WalkForwardPage() {
  const { data: results = [] } = useWalkforwardResults();
  const { data: strategies = [] } = useStrategies();
  const pilotComparison = getPilotComparison(strategies, [], results);
  const rows = groupRuns(results).map((run) => {
    const strategy = strategies.find((item) => item.id === run.strategy_id) ?? null;
    return {
      ...run,
      strategy: strategy?.name ?? run.strategy_id,
      strategyRow: strategy,
    };
  });
  const visibleRows = rows.filter((row) => {
    if (!row.strategyRow) return false;
    const snapshot = getResearchSnapshot([], results, row.strategy_id);
    const pilotRole = getPilotRole(row.strategy_id, pilotComparison);
    return (
      pilotRole === "focus" ||
      row.strategyRow.is_champion ||
      (row.strategyRow.tags ?? []).includes("pilot") ||
      snapshot.status === "candidate-ready" ||
      snapshot.status === "research-watch" ||
      row.id === (snapshot.walkforwardRun[0]?.run_group_id ?? `${row.strategy_id}-${snapshot.walkforwardRun[0]?.created_at ?? ""}`)
    );
  });
  const hiddenSecondaryRuns = Math.max(rows.length - visibleRows.length, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Walk-Forward Runs</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{visibleRows.length} aktiv sichtbar</span>
            {hiddenSecondaryRuns > 0 && <span>{hiddenSecondaryRuns} sekundaere Runs ausgeblendet</span>}
          </div>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="strategy" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avg_efficiency" fill="hsl(var(--chart-1))" />
              <Bar dataKey="passed_ratio" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map((row) => (
          <Card key={row.id}>
            <CardHeader>
              <CardTitle>{row.strategy}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>Run: {formatDateTime(row.created_at)}</p>
              <p>Zeitraum: {row.run_start_date} → {row.run_end_date}</p>
              <p>Fenster: {row.windows_requested}</p>
              <p>Passrate: {formatNumber(row.passed_ratio * 100, 0)}%</p>
              <p>Ø Effizienz: {formatNumber(row.avg_efficiency)}</p>
              {(row.fee_rate ?? null) !== null && <p>Fee: {formatNumber(row.fee_rate, 4)}</p>}
              {(row.slippage_rate ?? null) !== null && <p>Slippage: {formatNumber(row.slippage_rate, 4)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
