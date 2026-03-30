import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/integrations/supabase/client";
import {
  useAllocations,
  useBacktests,
  useExecuteTradeAction,
  useLifecycleEvents,
  useLifecycleRuns,
  usePaperPortfolios,
  useLiveOrders,
  useLivePortfolios,
  useMetaAllocationEntries,
  useMetaAllocationRuns,
  useMonitorAlerts,
  useMonitorRuns,
  useRegimeSnapshots,
  useRegimeRuns,
  useRiskRules,
  useStrategies,
  useTournamentRuns,
  useWalkforwardResults,
} from "@/hooks/use-trading-data";
import { computeHealth, computeStrategyPriority, getPilotComparison, getPilotRole } from "@/lib/analytics";
import { buildTestnetChecklist } from "@/lib/deployment";
import { buildExecutionEligibility, buildReadinessReport } from "@/lib/readiness";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function ExecutionPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: wf = [] } = useWalkforwardResults();
  const { data: riskRules = [] } = useRiskRules();
  const { data: paperPortfolios = [] } = usePaperPortfolios();
  const { data: live = [] } = useLivePortfolios();
  const { data: liveOrders = [] } = useLiveOrders();
  const { data: tournamentRuns = [] } = useTournamentRuns();
  const { data: lifecycleRuns = [] } = useLifecycleRuns();
  const { data: lifecycleEvents = [] } = useLifecycleEvents();
  const { data: allocations = [] } = useAllocations();
  const { data: monitorRuns = [] } = useMonitorRuns();
  const { data: monitorAlerts = [] } = useMonitorAlerts();
  const { data: regimeRuns = [] } = useRegimeRuns();
  const { data: regimeSnapshots = [] } = useRegimeSnapshots();
  const { data: metaAllocationRuns = [] } = useMetaAllocationRuns();
  const { data: metaAllocationEntries = [] } = useMetaAllocationEntries();
  const executeTrade = useExecuteTradeAction();
  const [strategyId, setStrategyId] = useState("");

  const readinessRows = strategies.map((strategy) => ({
    strategy,
    ...computeHealth(strategy, backtests, wf, paperPortfolios, live, liveOrders),
  }));
  const activeLive = live.filter((item) => item.is_active);
  const latestLifecycle = lifecycleRuns[0] ?? null;
  const latestEvents = latestLifecycle ? lifecycleEvents.filter((event) => event.lifecycle_run_id === latestLifecycle.id) : [];
  const latestAllocations = latestLifecycle ? allocations.filter((allocation) => allocation.lifecycle_run_id === latestLifecycle.id) : [];
  const latestMonitorRun = monitorRuns[0] ?? null;
  const latestAlerts = latestMonitorRun ? monitorAlerts.filter((alert) => alert.monitor_run_id === latestMonitorRun.id) : [];
  const latestRegimeRun = regimeRuns[0] ?? null;
  const latestRegimeSnapshots = latestRegimeRun ? regimeSnapshots.filter((snapshot) => snapshot.regime_run_id === latestRegimeRun.id) : [];
  const latestMetaRun = metaAllocationRuns[0] ?? null;
  const latestMetaEntries = latestMetaRun ? metaAllocationEntries.filter((entry) => entry.meta_allocation_run_id === latestMetaRun.id) : [];
  const criticalAlerts = monitorAlerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved");
  const executionReadiness = buildReadinessReport({
    hasSupabaseEnv,
    strategies,
    tournamentRuns,
    latestJobRun: null,
    latestSchedulerRun: null,
    latestMonitorRun,
    latestRegimeRun,
    latestMetaRun,
    allocations,
    criticalAlerts,
    activeConfig: null,
    liveOrders,
  });
  const pilotComparison = getPilotComparison(strategies, backtests, wf);
  const executionCandidates = readinessRows.map((row) => {
    const metaAllocation = latestMetaEntries.find((entry) => entry.strategy_id === row.strategy.id);
    const lifecycleAllocation = latestAllocations.find((entry) => entry.strategy_id === row.strategy.id);
    const allowedAllocation = metaAllocation?.suggested_allocation ?? lifecycleAllocation?.allocation_percent ?? 0;
    return {
      ...row,
      strategyPriority: computeStrategyPriority(row.strategy, backtests, wf, pilotComparison).priorityScore,
      eligibility: buildExecutionEligibility({
        strategy: row.strategy,
        readinessScore: row.readinessScore,
        allowedAllocation,
        criticalAlerts,
        platformReadiness: executionReadiness,
      }),
    };
  }).sort((left, right) => {
    if (right.strategyPriority !== left.strategyPriority) return right.strategyPriority - left.strategyPriority;
    if (right.readinessScore !== left.readinessScore) return right.readinessScore - left.readinessScore;
    return left.strategy.name.localeCompare(right.strategy.name);
  });
  const eligibleCandidates = executionCandidates.filter((row) => row.eligibility.eligible);
  const blockedCandidates = executionCandidates.filter((row) => !row.eligibility.eligible);
  const preferredCandidate =
    eligibleCandidates.find((row) => getPilotRole(row.strategy.id, pilotComparison) !== "comparison")
    ?? eligibleCandidates[0]
    ?? executionCandidates.find((row) => getPilotRole(row.strategy.id, pilotComparison) === "focus")
    ?? executionCandidates.find((row) => getPilotRole(row.strategy.id, pilotComparison) !== "comparison")
    ?? executionCandidates[0]
    ?? null;
  const selectedStrategyId = strategyId || preferredCandidate?.strategy.id || "";
  const selectedCandidate = executionCandidates.find((row) => row.strategy.id === selectedStrategyId) ?? null;
  const selectedReadiness = selectedCandidate ?? null;
  const suggestedEligibleCandidate = selectedCandidate?.eligibility.eligible
    ? selectedCandidate
    : eligibleCandidates.find((row) => getPilotRole(row.strategy.id, pilotComparison) !== "comparison")
      ?? eligibleCandidates[0]
      ?? null;
  const pilotLeader = pilotComparison.leader;
  const allowedAllocation = selectedCandidate?.eligibility.allowedAllocation ?? 0;
  const testnetChecklist = buildTestnetChecklist({
    readiness: executionReadiness,
    strategies,
    tournamentRuns,
    paperPortfolios,
    schedulerRuns: [],
    metaRuns: metaAllocationRuns,
    criticalAlerts,
    liveOrders,
  });
  const liveBlockedReasons = [
    !hasSupabaseEnv ? "Supabase ist noch nicht angebunden." : null,
    !selectedCandidate ? "Es ist noch keine Strategie ausgewaehlt." : null,
    ...(selectedCandidate?.eligibility.blockedReasons ?? []),
  ].filter(Boolean) as string[];
  const liveExecutionBlocked = liveBlockedReasons.length > 0;

  return (
    <Tabs defaultValue="pipeline" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="risk">Risk</TabsTrigger>
        <TabsTrigger value="live">Live Trading</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
      </TabsList>
      <TabsContent value="pipeline" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {readinessRows.map(({ strategy, backtest, wfRows, readinessScore, operationalScore, operationalReadiness, blockedOrdersCount }) => (
          <Card key={strategy.id}>
            <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>Readiness Score: <span className="font-semibold text-foreground">{formatNumber(readinessScore)}</span></p>
              <p>Operational Score: <span className="font-semibold text-foreground">{operationalScore === null ? "-" : formatNumber(operationalScore)}</span></p>
              <p>Operational Readiness: <span className="font-semibold text-foreground">{operationalReadiness === null ? "-" : formatNumber(operationalReadiness)}</span></p>
              <p>Backtest: {backtest ? "vorhanden" : "offen"}</p>
              <p>Walk-Forward: {wfRows.length > 0 ? "vorhanden" : "offen"}</p>
              <p>Geblockte Checks: {blockedOrdersCount}</p>
              <p>Live-Freigabe: {readinessScore >= 70 ? "beobachten fuer deployment" : "noch nicht freigeben"}</p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="risk">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Globale Risk Rules</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-500">
              {riskRules.map((rule) => (
                <div key={rule.id} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <p>Positionsgroesse: {formatPercent(rule.max_position_size * 100)}</p>
                  <p>Stop Loss: {formatPercent(rule.stop_loss_percent * 100)}</p>
                  <p>Take Profit: {formatPercent(rule.take_profit_percent * 100)}</p>
                  <p>Daily Loss: {formatPercent(rule.max_daily_loss * 100)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Marktregime</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-500">
              {latestRegimeSnapshots.length > 0 ? latestRegimeSnapshots.slice(0, 6).map((snapshot) => {
                const strategy = strategies.find((item) => item.id === snapshot.strategy_id);
                return (
                  <div key={snapshot.id} className="rounded-xl bg-muted p-4">
                    <p className="font-medium text-foreground">{strategy?.name ?? snapshot.symbol}</p>
                    <p className="mt-1">{snapshot.regime_label} · Trend {formatNumber(snapshot.trend_score)} · Vol {formatNumber(snapshot.volatility_score)}</p>
                  </div>
                );
              }) : <p>Noch keine Regime-Snapshots vorhanden.</p>}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="live">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Live Trading</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-500">
              <p>Aktive Live-Portfolios: {activeLive.length}</p>
              <p>Execution ist absichtlich production-nah aber sicher: Simulation oder Dry-Run, bis echte Secrets und Testnet-/Live-Freigabe vorhanden sind.</p>
              <div className="rounded-xl bg-muted p-4">
                <p className="font-medium text-foreground">Execution Gate</p>
                <p className="mt-1">
                  Platform Readiness {executionReadiness.score}% · Kritische Alerts {criticalAlerts.length} · Strategie-Readiness {selectedReadiness ? formatNumber(selectedReadiness.readinessScore) : "n/a"}
                </p>
                <p className="mt-1">Freigegebene Allokation {formatNumber(allowedAllocation * 100)}%</p>
                <p className="mt-1">
                  Kandidaten {eligibleCandidates.length} testnet-ready · {blockedCandidates.length} blocked
                </p>
                {selectedCandidate && (
                  <p className="mt-1">
                    Eligibility {selectedCandidate.eligibility.eligible ? "testnet-ready" : "blocked"}
                  </p>
                )}
                {liveExecutionBlocked ? (
                  <div className="mt-3 space-y-2 text-rose-600">
                    {liveBlockedReasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                    {!selectedCandidate?.eligibility.eligible && suggestedEligibleCandidate && (
                      <p className="pt-1 text-amber-700">
                        Beste aktuell freigegebene Alternative: {suggestedEligibleCandidate.strategy.name}
                      </p>
                    )}
                    {!suggestedEligibleCandidate && pilotComparison.secondary && selectedCandidate && getPilotRole(selectedCandidate.strategy.id, pilotComparison) === "comparison" && (
                      <p className="pt-1 text-slate-600">
                        Diese Linie bleibt als Vergleich aktiv, wird aber aktuell nicht als bevorzugter Execution-Pfad behandelt.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-emerald-600">Die aktuelle UI-Freigabe erlaubt einen kontrollierten Dry-Run fuer diese Strategie.</p>
                )}
                {!suggestedEligibleCandidate && pilotLeader && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-slate-700">
                    <p className="font-medium">Pilot-Empfehlung fuer die naechste Research-Runde</p>
                    <p className="mt-1">{pilotLeader.strategy.name}</p>
                    <p className="mt-1 text-sm">
                      Score {formatNumber(pilotLeader.score)} · Status {pilotLeader.snapshot.label} · Passrate{" "}
                      {pilotLeader.snapshot.passRate === null ? "-" : `${formatNumber(pilotLeader.snapshot.passRate * 100, 0)}%`}
                    </p>
                    {pilotComparison.secondary && (
                      <p className="mt-1 text-xs text-slate-600">
                        Vergleichslinie aktuell: {pilotComparison.secondary.strategy.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <select className="min-w-[240px] rounded-xl border border-border bg-background px-3 py-2 text-foreground" value={selectedStrategyId} onChange={(event) => setStrategyId(event.target.value)}>
                  {executionCandidates.map((row) => (
                    <option key={row.strategy.id} value={row.strategy.id}>
                      {row.strategy.name}
                      {(() => {
                        const pilotRole = getPilotRole(row.strategy.id, pilotComparison);
                        if (pilotRole === "focus") return " | pilot-focus";
                        if (pilotRole === "comparison") return " | comparison";
                        return "";
                      })()}
                      {row.eligibility.eligible ? " | testnet-ready" : " | blocked"}
                    </option>
                  ))}
                </select>
                <Button onClick={() => executeTrade.mutate({ action: "start", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || executeTrade.isPending || liveExecutionBlocked}>Start</Button>
                <Button variant="outline" onClick={() => executeTrade.mutate({ action: "status", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || executeTrade.isPending}>Status</Button>
                <Button variant="outline" onClick={() => executeTrade.mutate({ action: "check", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || executeTrade.isPending || liveExecutionBlocked}>Check</Button>
                <Button variant="destructive" onClick={() => executeTrade.mutate({ action: "stop", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || executeTrade.isPending}>Stop</Button>
              </div>
              {executeTrade.data?.diagnostics && (
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Execution Diagnostics</p>
                  <p className="mt-1">Mode {executeTrade.data.diagnostics.mode}</p>
                  <p className="mt-1">
                    API Key {executeTrade.data.diagnostics.hasApiKey ? "vorhanden" : "fehlt"} · API Secret {executeTrade.data.diagnostics.hasApiSecret ? "vorhanden" : "fehlt"} · Testnet {executeTrade.data.diagnostics.testnetEnabled ? "aktiv" : "aus"}
                  </p>
                  {executeTrade.data.diagnostics.blockers?.length > 0 && (
                    <div className="mt-2 space-y-1 text-amber-600">
                      {executeTrade.data.diagnostics.blockers.map((reason: string) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {executeTrade.data?.order && (
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Letzter Execution Check</p>
                  <p className="mt-1">Status {executeTrade.data.order.status} · Side {executeTrade.data.order.side}</p>
                  <p className="mt-1">Mode {executeTrade.data.executionMode}</p>
                </div>
              )}
              {!executeTrade.data?.order && (
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Execution Modus</p>
                  <p className="mt-1">Aktuell vorbereiteter Pfad: Simulation oder Dry-Run. Mit Binance Testnet Secrets schaltet der Modus spaeter auf <span className="font-medium text-foreground">testnet-dry-run</span>.</p>
                </div>
              )}
              {activeLive.map((portfolio) => (
                <div key={portfolio.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Portfolio {portfolio.id}</p>
                  <p className="mt-2">PnL {formatNumber(portfolio.total_pnl)} · Trades {portfolio.total_trades}</p>
                </div>
              ))}
              {liveOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">{order.symbol} · {order.side}</p>
                  <p className="mt-1">{order.status} · Qty {formatNumber(order.quantity, 4)} · Price {formatNumber(order.price)}</p>
                  {order.error_message && <p className="mt-1">{order.error_message}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Kapitalallokation</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-500">
              {latestMetaEntries.length > 0 ? latestMetaEntries.map((entry) => {
                const strategy = strategies.find((item) => item.id === entry.strategy_id);
                return (
                  <div key={entry.id} className="rounded-xl bg-muted p-4">
                    <p className="font-medium text-foreground">{strategy?.name ?? entry.strategy_id}</p>
                    <p className="mt-1">{entry.role} · Regime {entry.regime_label}</p>
                    <p className="mt-1">Von {formatNumber((entry.current_allocation ?? 0) * 100)}% auf {formatNumber((entry.suggested_allocation ?? 0) * 100)}%</p>
                    <p className="mt-1">Confidence {formatNumber(entry.confidence_score)}</p>
                    <p className="mt-1">{entry.rationale}</p>
                  </div>
                );
              }) : latestAllocations.length > 0 ? latestAllocations.map((allocation) => {
                const strategy = strategies.find((item) => item.id === allocation.strategy_id);
                return (
                  <div key={allocation.id} className="rounded-xl bg-muted p-4">
                    <p className="font-medium text-foreground">{strategy?.name ?? allocation.strategy_id}</p>
                    <p className="mt-1">{allocation.role} · {formatNumber(allocation.allocation_percent * 100)}%</p>
                    <p className="mt-1">{allocation.rationale}</p>
                  </div>
                );
              }) : <p>Noch keine Allokation vorhanden.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Testnet Gate</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-500">
              {testnetChecklist.map((item) => (
                <div key={item.key} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <span className={item.status === "ready" ? "text-emerald-600" : item.status === "warning" ? "text-amber-600" : "text-slate-500"}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="monitoring">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Monitoring</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-500">
              {readinessRows.map(({ strategy, backtest, passRate }) => (
                <div key={strategy.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">{strategy.name}</p>
                  <p className="mt-2">Sharpe {formatNumber(backtest?.sharpe_ratio)} · Drawdown {formatNumber(backtest?.max_drawdown)} · WF Pass Rate {formatNumber(passRate * 100)}%</p>
                  <p className="mt-1">Alert-Regel empfohlen: stoppe neue Deployments unter Sharpe 0.8, Drawdown &lt; -18% oder Pass Rate &lt; 40%.</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Drift, Lifecycle und Meta</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-500">
              {latestMonitorRun && (
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Letzter Monitor Run</p>
                  <p className="mt-1">Alerts {latestMonitorRun.alerts_count} · Critical {latestMonitorRun.severe_alerts_count}</p>
                </div>
              )}
              {latestMetaRun && (
                <div className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">Letzte Meta-Allokation</p>
                  <p className="mt-1">Reserve Target {formatNumber((latestMetaRun.reserve_target ?? 0) * 100)}%</p>
                </div>
              )}
              {latestAlerts.map((alert) => {
                const strategy = strategies.find((item) => item.id === alert.strategy_id);
                return (
                  <div key={alert.id} className="rounded-xl bg-muted p-4">
                    <p className="font-medium text-foreground">{alert.alert_type}</p>
                    <p className="mt-1">{strategy?.name ?? alert.strategy_id}</p>
                    <p className="mt-1">{alert.message}</p>
                  </div>
                );
              })}
              {latestEvents.map((event) => {
                const strategy = strategies.find((item) => item.id === event.strategy_id);
                return (
                  <div key={event.id} className="rounded-xl bg-muted p-4">
                    <p className="font-medium text-foreground">{event.event_type}</p>
                    <p className="mt-1">{strategy?.name ?? event.strategy_id}</p>
                    <p className="mt-1">Severity {event.severity}</p>
                  </div>
                );
              })}
              {!latestMonitorRun && latestEvents.length === 0 && <p>Noch keine Monitor- oder Lifecycle-Daten vorhanden.</p>}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
