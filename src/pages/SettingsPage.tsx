import { hasSupabaseEnv } from "@/integrations/supabase/client";
import { buildReadinessReport } from "@/lib/readiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAllocations,
  useJobRuns,
  useJobSteps,
  useLiveOrders,
  useMetaAllocationEntries,
  useMetaAllocationRuns,
  useMonitorAlerts,
  useMonitorRuns,
  useRebalanceActions,
  useRebalanceRuns,
  useRegimeRuns,
  useRunMetaAllocation,
  useRunOrchestrator,
  useRunRebalance,
  useRunRegime,
  useRunScheduler,
  useSchedulerConfigs,
  useSchedulerRuns,
  useStrategies,
  useTournamentRuns,
} from "@/hooks/use-trading-data";

export default function SettingsPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: tournamentRuns = [] } = useTournamentRuns();
  const { data: allocations = [] } = useAllocations();
  const { data: monitorRuns = [] } = useMonitorRuns();
  const { data: monitorAlerts = [] } = useMonitorAlerts();
  const { data: liveOrders = [] } = useLiveOrders();
  const { data: jobRuns = [] } = useJobRuns();
  const { data: jobSteps = [] } = useJobSteps();
  const { data: schedulerConfigs = [] } = useSchedulerConfigs();
  const { data: schedulerRuns = [] } = useSchedulerRuns();
  const { data: rebalanceRuns = [] } = useRebalanceRuns();
  const { data: rebalanceActions = [] } = useRebalanceActions();
  const { data: regimeRuns = [] } = useRegimeRuns();
  const { data: metaAllocationRuns = [] } = useMetaAllocationRuns();
  const { data: metaAllocationEntries = [] } = useMetaAllocationEntries();
  const runOrchestrator = useRunOrchestrator();
  const runScheduler = useRunScheduler();
  const runRebalance = useRunRebalance();
  const runRegime = useRunRegime();
  const runMetaAllocation = useRunMetaAllocation();
  const latestJobRun = jobRuns[0] ?? null;
  const latestSteps = latestJobRun ? jobSteps.filter((step) => step.job_run_id === latestJobRun.id) : [];
  const latestSchedulerRun = schedulerRuns[0] ?? null;
  const latestRebalanceRun = rebalanceRuns[0] ?? null;
  const latestRebalanceActions = latestRebalanceRun ? rebalanceActions.filter((action) => action.rebalance_run_id === latestRebalanceRun.id) : [];
  const latestRegimeRun = regimeRuns[0] ?? null;
  const latestMetaRun = metaAllocationRuns[0] ?? null;
  const latestMetaEntries = latestMetaRun ? metaAllocationEntries.filter((entry) => entry.meta_allocation_run_id === latestMetaRun.id) : [];
  const activeConfig = schedulerConfigs.find((config) => config.is_active) ?? null;
  const criticalAlerts = monitorAlerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved");
  const readiness = buildReadinessReport({
    hasSupabaseEnv,
    strategies,
    tournamentRuns,
    latestJobRun,
    latestSchedulerRun,
    latestMonitorRun: monitorRuns[0] ?? null,
    latestRegimeRun,
    latestMetaRun,
    allocations,
    criticalAlerts,
    activeConfig,
    liveOrders,
  });
  const readinessTone =
    readiness.status === "near-production"
      ? "text-emerald-600"
      : readiness.status === "progressing"
        ? "text-amber-600"
        : "text-rose-600";
  const gateTone = (status: "pass" | "warning" | "fail") =>
    status === "pass" ? "border-emerald-200 bg-emerald-50" : status === "warning" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50";

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card><CardHeader><CardTitle>Telegram Bot</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Benoetigt TELEGRAM_BOT_TOKEN.</CardContent></Card>
      <Card><CardHeader><CardTitle>Strategietypen</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Research-, Tournament-, Lifecycle-, Regime- und Meta-Allokationspfade sind jetzt gekoppelt.</CardContent></Card>
      <Card><CardHeader><CardTitle>Datenquellen</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Binance fuer Backtests und Regime-Snapshots, persistente Supabase-Layer fuer Agent-Zustaende.</CardContent></Card>
      <Card><CardHeader><CardTitle>Walk-Forward</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Out-of-sample-Pruefung bleibt Teil des Risk Kernel und der Drift-Kontrolle.</CardContent></Card>
      <Card><CardHeader><CardTitle>DB-Status</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">{hasSupabaseEnv ? "Supabase verbunden" : "Mock-Modus aktiv - Env Variablen fehlen."}</CardContent></Card>
      <Card><CardHeader><CardTitle>Agent Stack</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">Vorhanden: Tournament, Lifecycle, Allocation, Drift-Monitoring, Scheduler, Regime, Meta-Allokation. Noch offen: echter Cron und sichere Live-Execution.</CardContent></Card>

      <Card className="md:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Production Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-500">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Readiness Score</p>
              <p className={`mt-1 text-3xl font-semibold ${readinessTone}`}>{readiness.score}%</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Status</p>
              <p className={`mt-1 font-medium ${readinessTone}`}>{readiness.status}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Blocker</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">{readiness.blockerCount}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Warnings</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{readiness.warningCount}</p>
            </div>
          </div>
          <p>
            Diese Bewertung ist bewusst streng: Live-Faehigkeit zaehlt hier nur, wenn Datenpfad,
            Tournament, Risk Kernel, Monitoring und Dry-Run-Execution zusammenspielen.
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {readiness.gates.map((gate) => (
              <div key={gate.key} className={`rounded-xl border p-4 ${gateTone(gate.status)}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{gate.label}</p>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{gate.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{gate.detail}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="font-medium text-foreground">Naechste Schritte</p>
            <div className="mt-3 space-y-2">
              {readiness.nextActions.map((action) => (
                <p key={action}>{action}</p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 xl:col-span-3">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Agent Loop</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => runOrchestrator.mutate()} disabled={runOrchestrator.isPending || !hasSupabaseEnv}>
                {runOrchestrator.isPending ? "Loop laeuft..." : "Agent-Loop starten"}
              </Button>
              <Button variant="outline" onClick={() => runScheduler.mutate()} disabled={runScheduler.isPending || !hasSupabaseEnv}>
                {runScheduler.isPending ? "Scheduler laeuft..." : "Scheduler-Zyklus starten"}
              </Button>
              <Button variant="outline" onClick={() => runRegime.mutate()} disabled={runRegime.isPending || !hasSupabaseEnv}>
                {runRegime.isPending ? "Regime laeuft..." : "Regime aktualisieren"}
              </Button>
              <Button variant="outline" onClick={() => runMetaAllocation.mutate()} disabled={runMetaAllocation.isPending || !hasSupabaseEnv}>
                {runMetaAllocation.isPending ? "Meta laeuft..." : "Meta-Allokation erzeugen"}
              </Button>
              <Button variant="outline" onClick={() => runRebalance.mutate()} disabled={runRebalance.isPending || !hasSupabaseEnv}>
                {runRebalance.isPending ? "Rebalance laeuft..." : "Rebalance vorschlagen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-500">
          <p>Der Scheduler fuehrt den Orchestrator aus und kann bei Bedarf Rebalance triggern. Regime und Meta-Allokation koennen auch separat gerechnet werden, um Marktphasen schneller nachzuziehen.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Aktive Config</p><p className="mt-1">{activeConfig?.name ?? "Noch keine Config"}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Cadence</p><p className="mt-1">{activeConfig?.cadence_label ?? "manual"}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Auto Rebalance</p><p className="mt-1">{activeConfig?.auto_rebalance ? "aktiv" : "aus"}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Alert Threshold</p><p className="mt-1">{activeConfig?.severe_alert_threshold ?? 1}</p></div>
          </div>
          {latestJobRun ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Letzter Job</p><p className="mt-1">{latestJobRun.job_name}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Status</p><p className="mt-1">{latestJobRun.status}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Steps</p><p className="mt-1">{latestJobRun.steps_completed} / {latestJobRun.steps_total}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="font-medium text-foreground">Zeit</p><p className="mt-1">{new Date(latestJobRun.created_at).toLocaleString("de-DE")}</p></div>
            </div>
          ) : <p>Noch kein Agent-Job ausgefuehrt.</p>}
          {latestSteps.length > 0 && (
            <div className="space-y-3">
              {latestSteps.map((step) => (
                <div key={step.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">{step.step_name}</p>
                  <p className="mt-1">Status: {step.status}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Letzter Scheduler-Run</p>
              <p className="mt-1">{latestSchedulerRun ? new Date(latestSchedulerRun.created_at).toLocaleString("de-DE") : "Keiner"}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Letzter Regime-Run</p>
              <p className="mt-1">{latestRegimeRun ? `${latestRegimeRun.symbols_count} Symbole` : "Keiner"}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Letzte Meta-Allokation</p>
              <p className="mt-1">{latestMetaRun ? `Reserve ${(latestMetaRun.reserve_target * 100).toFixed(0)}%` : "Keine"}</p>
            </div>
          </div>
          {latestMetaEntries.length > 0 && (
            <div className="space-y-3">
              {latestMetaEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">{entry.role} · {entry.regime_label}</p>
                  <p className="mt-1">Von {entry.current_allocation} auf {entry.suggested_allocation}</p>
                  <p className="mt-1">{entry.rationale}</p>
                </div>
              ))}
            </div>
          )}
          {latestRebalanceActions.length > 0 && (
            <div className="space-y-3">
              {latestRebalanceActions.map((action) => (
                <div key={action.id} className="rounded-xl bg-muted p-4">
                  <p className="font-medium text-foreground">{action.action_type}</p>
                  <p className="mt-1">Von {action.current_allocation} auf {action.suggested_allocation}</p>
                  <p className="mt-1">{action.reason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
