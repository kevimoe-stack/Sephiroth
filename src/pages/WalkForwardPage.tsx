import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";

export default function WalkForwardPage() {
  const { data: results = [] } = useWalkforwardResults();
  const { data: strategies = [] } = useStrategies();
  const rows = results.map((item) => ({ ...item, strategy: strategies.find((strategy) => strategy.id === item.strategy_id)?.name ?? item.strategy_id }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>IS vs OOS Sharpe</CardTitle></CardHeader>
        <CardContent className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="window_number" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="in_sample_sharpe" fill="hsl(var(--chart-1))" />
              <Bar dataKey="out_of_sample_sharpe" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader><CardTitle>{row.strategy} · Fenster {row.window_number}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>IS: {row.in_sample_start} → {row.in_sample_end}</p>
              <p>OOS: {row.out_of_sample_start} → {row.out_of_sample_end}</p>
              <p>Effizienz: {row.efficiency_ratio?.toFixed(2) ?? "–"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
