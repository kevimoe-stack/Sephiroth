import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StrategyRankingTable } from "@/components/dashboard/StrategyRankingTable";
import { useBacktests, useLifecycleEvents, useLifecycleRuns, useLiveOrders, useLivePortfolios, useMonitorAlerts, useMonitorRuns, usePaperPortfolios, useRiskRules, useRunLifecycle, useRunMonitor, useRunTournament, useStrategies, useTournamentEntries, useTournamentRuns, useWalkforwardResults } from "@/hooks/use-trading-data";
import { buildTournamentBoard } from "@/lib/tournament";
import { formatNumber } from "@/lib/utils";

export default function ChampionPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const { data: paperPortfolios = [] } = usePaperPortfolios();
  const { data: livePortfolios = [] } = useLivePortfolios();
  const { data: liveOrders = [] } = useLiveOrders();
  const { data: riskRules = [] } = useRiskRules();
  const { data: tournamentRuns = [] } = useTournamentRuns();
  const { data: tournamentEntries = [] } = useTournamentEntries();
  const { data: lifecycleRuns = [] } = useLifecycleRuns();
  const { data: lifecycleEvents = [] } = useLifecycleEvents();
  const { data: monitorRuns = [] } = useMonitorRuns();
  const { data: monitorAlerts = [] } = useMonitorAlerts();
  const runTournament = useRunTournament();
  const runLifecycle = useRunLifecycle();
  const runMonitor = useRunMonitor();
  const tournament = buildTournamentBoard(strategies, backtests, walkforward, riskRules, paperPortfolios, livePortfolios, liveOrders);
  const champion = tournament.champion;
  const challenger = tournament.challengers[0] ?? tournament.rows[1] ?? null;
  const championBacktest = champion?.backtest;
  const challengerBacktest = challenger?.backtest;
  const latestRun = tournamentRuns[0] ?? null;
  const latestEntries = latestRun ? tournamentEntries.filter((entry) => entry.tournament_run_id === latestRun.id).slice(0, 5) : [];
  const latestLifecycle = lifecycleRuns[0] ?? null;
  const latestEvents = latestLifecycle ? lifecycleEvents.filter((event) => event.lifecycle_run_id === latestLifecycle.id).slice(0, 6) : [];
  const latestMonitorRun = monitorRuns[0] ?? null;
  const latestAlerts = latestMonitorRun ? monitorAlerts.filter((alert) => alert.monitor_run_id === latestMonitorRun.id).slice(0, 6) : [];
  const data = [
    { metric: "Sharpe", champion: championBacktest?.sharpe_ratio ?? 0, challenger: challengerBacktest?.sharpe_ratio ?? 0 },
    { metric: "Win Rate", champion: championBacktest?.win_rate ?? 0, challenger: challengerBacktest?.win_rate ?? 0 },
    { metric: "Profit Factor", champion: championBacktest?.profit_factor ?? 0, challenger: challengerBacktest?.profit_factor ?? 0 },
    { metric: "CAGR", champion: championBacktest?.cagr ?? 0, challenger: challengerBacktest?.cagr ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Champion vs Challenger</CardTitle>
            <div className="flex gap-3">
              <Button onClick={() => runTournament.mutate()} disabled={runTournament.isPending}>
                {runTournament.isPending ? "Tournament laeuft..." : "Tournament Snapshot ausfuehren"}
              </Button>
              <Button variant="outline" onClick={() => runLifecycle.mutate()} disabled={runLifecycle.isPending}>
                {runLifecycle.isPending ? "Lifecycle laeuft..." : "Lifecycle anwenden"}
              </Button>
              <Button variant="outline" onClick={() => runMonitor.mutate()} disabled={runMonitor.isPending}>
                {runMonitor.isPending ? "Monitoring laeuft..." : "Drift pruefen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <Radar dataKey="champion" fill="hsl(var(--chart-1))" fillOpacity={0.35} stroke="hsl(var(--chart-1))" />
              <Radar dataKey="challenger" fill="hsl(var(--chart-2))" fillOpacity={0.2} stroke="hsl(var(--chart-2))" />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader><CardTitle>Champion</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            <p className="font-medium text-foreground">{champion?.strategy.name ?? "-"}</p>
            <p>Fitness {formatNumber(champion?.fitnessScore)}</p>
            <p>Capital Preservation {formatNumber(champion?.capitalPreservationScore)}</p>
            <p>Risk Management {formatNumber(champion?.riskManagementScore)}</p>
            <Badge variant={champion?.passedKernel ? "success" : "warning"}>{champion?.passedKernel ? "Kernel Pass" : "Kernel Fail"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Challengers</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {tournament.challengers.map((row) => (
              <div key={row.strategy.id} className="rounded-xl bg-muted p-4">
                <p className="font-medium text-foreground">{row.strategy.name}</p>
                <p className="mt-1">Fitness {formatNumber(row.fitnessScore)} | Kernel Pass</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Letzter Tournament Run</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestRun ? (
              <>
                <p>Qualified {latestRun.qualified_candidates} / {latestRun.total_candidates}</p>
                <p>Kernel {latestRun.kernel_name}</p>
                <p>{new Date(latestRun.created_at).toLocaleString("de-DE")}</p>
              </>
            ) : <p>Noch kein persistenter Tournament-Run.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Letzter Lifecycle Run</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestLifecycle ? (
              <>
                <p>Champion {latestLifecycle.champion_strategy_id ?? "-"}</p>
                <p>Challenger {latestLifecycle.challenger_strategy_id ?? "-"}</p>
                <p>Reserve {formatNumber((latestLifecycle.reserve_allocation ?? 0) * 100)}%</p>
              </>
            ) : <p>Noch kein Lifecycle-Run.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Letzter Monitor Run</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestMonitorRun ? (
              <>
                <p>Alerts {latestMonitorRun.alerts_count}</p>
                <p>Critical {latestMonitorRun.severe_alerts_count}</p>
                <p>{new Date(latestMonitorRun.created_at).toLocaleString("de-DE")}</p>
              </>
            ) : <p>Noch kein Monitor-Run.</p>}
          </CardContent>
        </Card>
      </div>
      {latestEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Snapshot History Top 5</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestEntries.map((entry) => {
              const strategy = strategies.find((item) => item.id === entry.strategy_id);
              return (
                <div key={entry.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">#{entry.rank} {strategy?.name ?? entry.strategy_id}</p>
                    <Badge variant={entry.passed_kernel ? "success" : "warning"}>{entry.passed_kernel ? "Qualified" : "Watchlist"}</Badge>
                  </div>
                  <p className="mt-2">Fitness {formatNumber(entry.fitness_score)} | Capital Preservation {formatNumber(entry.capital_preservation_score)} | Risk {formatNumber(entry.risk_management_score)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      {latestEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lifecycle Events</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestEvents.map((event) => {
              const strategy = strategies.find((item) => item.id === event.strategy_id);
              return (
                <div key={event.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">{event.event_type}</p>
                    <Badge variant={event.severity === "warning" ? "warning" : "secondary"}>{event.severity}</Badge>
                  </div>
                  <p className="mt-2">{strategy?.name ?? event.strategy_id}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      {latestAlerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Drift Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            {latestAlerts.map((alert) => {
              const strategy = strategies.find((item) => item.id === alert.strategy_id);
              return (
                <div key={alert.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">{alert.alert_type}</p>
                    <Badge variant={alert.severity === "critical" ? "destructive" : "warning"}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-2">{strategy?.name ?? alert.strategy_id}</p>
                  <p className="mt-1">{alert.message}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <StrategyRankingTable
        strategies={strategies}
        backtests={backtests}
        walkforward={walkforward}
        riskRules={riskRules}
        paperPortfolios={paperPortfolios}
        livePortfolios={livePortfolios}
        liveOrders={liveOrders}
      />
    </div>
  );
}
