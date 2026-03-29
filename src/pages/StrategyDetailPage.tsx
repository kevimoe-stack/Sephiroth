import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBacktests, useRunBacktest, useRunWalkforward, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function StrategyDetailPage() {
  const { id } = useParams();
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const backtestMutation = useRunBacktest();
  const walkforwardMutation = useRunWalkforward();
  const strategy = strategies.find((item) => item.id === id);
  const strategyBacktests = backtests.filter((item) => item.strategy_id === id);
  const latestBacktest = strategyBacktests[0];
  const wfRows = useMemo(() => walkforward.filter((item) => item.strategy_id === id), [id, walkforward]);
  const [startDate, setStartDate] = useState("2021-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.001);
  const [slippageRate, setSlippageRate] = useState(0.0005);
  const [windows, setWindows] = useState(4);

  if (!strategy) return <div>Strategie nicht gefunden.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle>{strategy.name}</CardTitle>
                <Badge variant="secondary">{strategy.status}</Badge>
                {strategy.is_champion && <Badge variant="success">Champion</Badge>}
              </div>
              <p className="mt-2 text-sm text-slate-500">{strategy.symbol} · {strategy.timeframe} · {strategy.asset_class}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">Bearbeiten</Button>
              <Button variant="destructive">Löschen</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{strategy.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Backtest</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Start</p>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Ende</p>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Kapital</p>
                <Input type="number" value={initialCapital} onChange={(event) => setInitialCapital(Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Fee Rate</p>
                <Input type="number" step="0.0001" value={feeRate} onChange={(event) => setFeeRate(Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Slippage</p>
                <Input type="number" step="0.0001" value={slippageRate} onChange={(event) => setSlippageRate(Number(event.target.value))} />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={() =>
                    backtestMutation.mutate({
                      strategyId: strategy.id,
                      startDate,
                      endDate,
                      initialCapital,
                      feeRate,
                      slippageRate,
                    })
                  }
                  disabled={backtestMutation.isPending}
                >
                  {backtestMutation.isPending ? "Backtest läuft..." : "Echten Backtest starten"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div><p className="text-sm text-slate-500">Return</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.total_return)}</p></div>
              <div><p className="text-sm text-slate-500">Sharpe</p><p className="text-xl font-semibold">{formatNumber(latestBacktest?.sharpe_ratio)}</p></div>
              <div><p className="text-sm text-slate-500">Max DD</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.max_drawdown)}</p></div>
              <div><p className="text-sm text-slate-500">Win Rate</p><p className="text-xl font-semibold">{formatPercent(latestBacktest?.win_rate)}</p></div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latestBacktest?.equity_curve ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Walk-Forward</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Fenster</p>
                <Input type="number" min="2" max="8" value={windows} onChange={(event) => setWindows(Number(event.target.value))} />
              </div>
              <div className="flex items-end xl:col-span-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    walkforwardMutation.mutate({
                      strategyId: strategy.id,
                      startDate,
                      endDate,
                      initialCapital,
                      feeRate,
                      slippageRate,
                      windows,
                    })
                  }
                  disabled={walkforwardMutation.isPending}
                >
                  {walkforwardMutation.isPending ? "Walk-Forward läuft..." : "Walk-Forward validieren"}
                </Button>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wfRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="window_number" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="in_sample_sharpe" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="out_of_sample_sharpe" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 text-sm">
              {wfRows.map((row) => (
                <div key={row.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between">
                    <span>Fenster {row.window_number}</span>
                    <Badge variant={row.passed ? "success" : "warning"}>{row.passed ? "Bestanden" : "Prüfen"}</Badge>
                  </div>
                  <p className="mt-2 text-slate-500">IS Sharpe {formatNumber(row.in_sample_sharpe)} · OOS Sharpe {formatNumber(row.out_of_sample_sharpe)}</p>
                </div>
              ))}
            </div>
            {backtestMutation.error && <p className="text-sm text-red-500">{String(backtestMutation.error.message)}</p>}
            {walkforwardMutation.error && <p className="text-sm text-red-500">{String(walkforwardMutation.error.message)}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
