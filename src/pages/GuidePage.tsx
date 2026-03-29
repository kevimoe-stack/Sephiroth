import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMetaAllocationRuns,
  useMonitorAlerts,
  usePaperPortfolios,
  useSchedulerRuns,
  useStrategies,
  useTournamentRuns,
} from "@/hooks/use-trading-data";
import { hasSupabaseEnv } from "@/integrations/supabase/client";
import { buildDeploymentStages, buildRunbookActions } from "@/lib/deployment";
import { buildReadinessReport } from "@/lib/readiness";

export default function GuidePage() {
  const { data: strategies = [] } = useStrategies();
  const { data: tournamentRuns = [] } = useTournamentRuns();
  const { data: paperPortfolios = [] } = usePaperPortfolios();
  const { data: schedulerRuns = [] } = useSchedulerRuns();
  const { data: metaRuns = [] } = useMetaAllocationRuns();
  const { data: monitorAlerts = [] } = useMonitorAlerts();
  const criticalAlerts = monitorAlerts.filter((alert) => alert.severity === "critical" && alert.status !== "resolved");

  const readiness = buildReadinessReport({
    hasSupabaseEnv,
    strategies,
    tournamentRuns,
    latestJobRun: null,
    latestSchedulerRun: schedulerRuns[0] ?? null,
    latestMonitorRun: null,
    latestRegimeRun: null,
    latestMetaRun: metaRuns[0] ?? null,
    allocations: [],
    criticalAlerts,
    activeConfig: null,
    liveOrders: [],
  });

  const stages = buildDeploymentStages({
    readiness,
    strategies,
    tournamentRuns,
    paperPortfolios,
    schedulerRuns,
    metaRuns,
    criticalAlerts,
  });
  const runbook = buildRunbookActions(readiness);
  const tone = (status: "done" | "current" | "blocked") =>
    status === "done" ? "border-emerald-200 bg-emerald-50" : status === "current" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Roadmap Status</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-500">
            <p>Readiness Score {readiness.score}%</p>
            <p className="mt-2">Blocker {readiness.blockerCount} · Warnings {readiness.warningCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Aktueller Fokus</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-500">
            <p>{stages.find((stage) => stage.status === "current")?.label ?? "Research Ready"}</p>
            <p className="mt-2">Sephiroth bewegt sich kontrolliert von Research ueber Paper und Dry-Run in Richtung Testnet.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Wichtige Regel</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-500">
            <p>Production Live bleibt blockiert, bis Testnet, Secrets, Monitoring und Ops-Abnahme serverseitig bestaetigt sind.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Go-Live Phasen</CardTitle></CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          {stages.map((stage) => (
            <div key={stage.key} className={`rounded-xl border p-4 ${tone(stage.status)}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">{stage.label}</p>
                <span className="text-xs uppercase tracking-wide text-slate-500">{stage.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{stage.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Runbook</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            {runbook.map((step) => (
              <p key={step}>{step}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Checkliste vor Testnet</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            <p>{strategies.length > 0 ? "OK" : "Offen"} Strategien mit echter Research-Basis</p>
            <p>{tournamentRuns.length > 0 ? "OK" : "Offen"} Champion/Challenger-Tournament</p>
            <p>{paperPortfolios.length > 0 ? "OK" : "Offen"} Paper Trading Historie</p>
            <p>{criticalAlerts.length === 0 ? "OK" : "Offen"} Keine kritischen Monitor-Alerts</p>
            <p>{schedulerRuns.length > 0 ? "OK" : "Offen"} Scheduler-/Orchestrator-Zyklen</p>
            <p>{metaRuns.length > 0 ? "OK" : "Offen"} Meta-Allokation verfuegbar</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
