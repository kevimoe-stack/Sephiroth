import type {
  AgentAllocation,
  AgentJobRun,
  AgentMetaAllocationRun,
  AgentMonitorAlert,
  AgentMonitorRun,
  AgentRegimeRun,
  AgentSchedulerConfig,
  AgentSchedulerRun,
  AgentTournamentRun,
  LiveOrder,
  Strategy,
} from "@/integrations/supabase/types";

type GateStatus = "pass" | "warning" | "fail";

export interface ReadinessGate {
  key: string;
  label: string;
  status: GateStatus;
  detail: string;
  weight: number;
}

export interface ReadinessReport {
  score: number;
  status: "not-ready" | "progressing" | "near-production";
  blockerCount: number;
  warningCount: number;
  gates: ReadinessGate[];
  nextActions: string[];
}

export interface ExecutionEligibility {
  strategyId: string;
  eligible: boolean;
  readinessScore: number;
  allowedAllocation: number;
  blockedReasons: string[];
}

interface BuildReadinessInput {
  hasSupabaseEnv: boolean;
  strategies: Strategy[];
  tournamentRuns: AgentTournamentRun[];
  latestJobRun: AgentJobRun | null;
  latestSchedulerRun: AgentSchedulerRun | null;
  latestMonitorRun: AgentMonitorRun | null;
  latestRegimeRun: AgentRegimeRun | null;
  latestMetaRun: AgentMetaAllocationRun | null;
  allocations: AgentAllocation[];
  criticalAlerts: AgentMonitorAlert[];
  activeConfig: AgentSchedulerConfig | null;
  liveOrders: LiveOrder[];
}

function toScore(gates: ReadinessGate[]) {
  const totalWeight = gates.reduce((sum, gate) => sum + gate.weight, 0);
  const earnedWeight = gates.reduce((sum, gate) => {
    if (gate.status === "pass") return sum + gate.weight;
    if (gate.status === "warning") return sum + gate.weight * 0.5;
    return sum;
  }, 0);
  return totalWeight === 0 ? 0 : Math.round((earnedWeight / totalWeight) * 100);
}

export function buildReadinessReport(input: BuildReadinessInput): ReadinessReport {
  const gates: ReadinessGate[] = [
    {
      key: "supabase-env",
      label: "Supabase Runtime",
      status: input.hasSupabaseEnv ? "pass" : "fail",
      detail: input.hasSupabaseEnv
        ? "Frontend ist an Supabase angebunden."
        : "VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen noch.",
      weight: 18,
    },
    {
      key: "strategy-depth",
      label: "Strategie-Population",
      status: input.strategies.length >= 3 ? "pass" : input.strategies.length >= 1 ? "warning" : "fail",
      detail:
        input.strategies.length >= 3
          ? `${input.strategies.length} Strategien verfuegbar.`
          : input.strategies.length >= 1
            ? "Es gibt erste Strategien, aber noch keine belastbare Population fuer Champion/Challenger."
            : "Es sind noch keine Strategien vorhanden.",
      weight: 10,
    },
    {
      key: "tournament",
      label: "Tournament Pipeline",
      status: input.tournamentRuns.length > 0 ? "pass" : "fail",
      detail:
        input.tournamentRuns.length > 0
          ? "Mindestens ein Tournament-Snapshot wurde erzeugt."
          : "Es gibt noch keinen persistierten Tournament-Run.",
      weight: 10,
    },
    {
      key: "orchestrator",
      label: "Orchestrator Loop",
      status:
        input.latestJobRun?.status === "completed"
          ? "pass"
          : input.latestJobRun
            ? "warning"
            : "fail",
      detail:
        input.latestJobRun?.status === "completed"
          ? "Der letzte Agent-Loop wurde erfolgreich abgeschlossen."
          : input.latestJobRun
            ? `Der letzte Agent-Loop endete mit Status ${input.latestJobRun.status}.`
            : "Der Agent-Loop wurde noch nicht ausgefuehrt.",
      weight: 12,
    },
    {
      key: "scheduler",
      label: "Scheduler Readiness",
      status:
        input.activeConfig?.is_active && input.latestSchedulerRun
          ? "pass"
          : input.activeConfig?.is_active
            ? "warning"
            : "fail",
      detail:
        input.activeConfig?.is_active && input.latestSchedulerRun
          ? `Aktive Config ${input.activeConfig.name} mit letzter Ausfuehrung vorhanden.`
          : input.activeConfig?.is_active
            ? "Es gibt eine aktive Scheduler-Config, aber noch keinen Run."
            : "Noch keine aktive Scheduler-Konfiguration gefunden.",
      weight: 10,
    },
    {
      key: "monitoring",
      label: "Drift Monitoring",
      status:
        input.latestMonitorRun && input.criticalAlerts.length === 0
          ? "pass"
          : input.latestMonitorRun
            ? "warning"
            : "fail",
      detail:
        input.latestMonitorRun && input.criticalAlerts.length === 0
          ? "Monitoring laeuft ohne kritische Alerts."
          : input.latestMonitorRun
            ? `${input.criticalAlerts.length} kritische Alerts muessen vor Live-Freigabe geklaert werden.`
            : "Es gibt noch keinen Monitor-Run.",
      weight: 12,
    },
    {
      key: "regime-meta",
      label: "Regime und Meta-Allokation",
      status:
        input.latestRegimeRun && input.latestMetaRun
          ? "pass"
          : input.latestRegimeRun || input.latestMetaRun
            ? "warning"
            : "fail",
      detail:
        input.latestRegimeRun && input.latestMetaRun
          ? "Regime-Snapshots und Meta-Allokation sind vorhanden."
          : input.latestRegimeRun || input.latestMetaRun
            ? "Nur ein Teil der Marktphasen-/Allokationsschicht ist vorhanden."
            : "Regime- und Meta-Allokation wurden noch nicht erzeugt.",
      weight: 10,
    },
    {
      key: "allocation",
      label: "Kapitalallokation",
      status:
        input.allocations.length > 0
          ? "pass"
          : input.tournamentRuns.length > 0
            ? "warning"
            : "fail",
      detail:
        input.allocations.length > 0
          ? `${input.allocations.length} Agent-Allokationen liegen vor.`
          : input.tournamentRuns.length > 0
            ? "Tournament ist vorhanden, aber es fehlt noch eine gespeicherte Allocation."
            : "Ohne Tournament gibt es noch keine Kapitalallokation.",
      weight: 8,
    },
    {
      key: "execution",
      label: "Execution Dry Run",
      status:
        input.liveOrders.length > 0
          ? "pass"
          : input.hasSupabaseEnv
            ? "warning"
            : "fail",
      detail:
        input.liveOrders.length > 0
          ? `${input.liveOrders.length} Live-Order-Ereignisse wurden bereits protokolliert.`
          : input.hasSupabaseEnv
            ? "Die Dry-Run-Execution ist vorbereitet, aber noch nicht operativ getestet."
            : "Ohne Supabase-Setup kann die Execution-Schicht nicht getestet werden.",
      weight: 10,
    },
  ];

  const score = toScore(gates);
  const blockerCount = gates.filter((gate) => gate.status === "fail").length;
  const warningCount = gates.filter((gate) => gate.status === "warning").length;
  const status =
    score >= 80 && blockerCount === 0 ? "near-production" : score >= 50 ? "progressing" : "not-ready";

  const nextActions = gates
    .filter((gate) => gate.status !== "pass")
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 4)
    .map((gate) => {
      switch (gate.key) {
        case "supabase-env":
          return "Supabase-URL, Anon-Key und spaeter Service-Role/Exchange-Secrets sauber setzen.";
        case "orchestrator":
          return "Den Agent-Loop mindestens einmal erfolgreich Ende-zu-Ende ausfuehren.";
        case "scheduler":
          return "Scheduler-Config aktivieren und den ersten Cycle mit Logs validieren.";
        case "monitoring":
          return "Kritische Alerts vor jeder Live-Freigabe beseitigen oder demoten.";
        case "execution":
          return "Dry-Run-Execution und anschliessend Binance Testnet kontrolliert pruefen.";
        case "regime-meta":
          return "Regime-Snapshot und Meta-Allokation mit echten Daten neu rechnen.";
        case "allocation":
          return "Lifecycle erneut laufen lassen, damit eine frische Allokation gespeichert wird.";
        case "tournament":
          return "Mindestens einen Tournament-Snapshot persistieren und Champion/Challenger festlegen.";
        case "strategy-depth":
          return "Mehrere valide Strategien in die Population aufnehmen, damit der Wettbewerb robust wird.";
        default:
          return gate.detail;
      }
    });

  return {
    score,
    status,
    blockerCount,
    warningCount,
    gates,
    nextActions,
  };
}

export function buildExecutionEligibility(input: {
  strategy: Strategy;
  readinessScore: number;
  allowedAllocation: number;
  criticalAlerts: AgentMonitorAlert[];
  platformReadiness: ReadinessReport;
}) : ExecutionEligibility {
  const blockedReasons = [
    input.platformReadiness.score < 70 ? `Platform Readiness ${input.platformReadiness.score}% ist noch zu niedrig.` : null,
    input.criticalAlerts.length > 0 ? `${input.criticalAlerts.length} kritische Alerts blockieren Execution.` : null,
    input.readinessScore < 70 ? `${input.strategy.name} liegt nur bei Readiness ${input.readinessScore}.` : null,
    input.allowedAllocation <= 0 ? "Es ist aktuell keine positive Allokation fuer diese Strategie freigegeben." : null,
  ].filter(Boolean) as string[];

  return {
    strategyId: input.strategy.id,
    eligible: blockedReasons.length === 0,
    readinessScore: input.readinessScore,
    allowedAllocation: input.allowedAllocation,
    blockedReasons,
  };
}
