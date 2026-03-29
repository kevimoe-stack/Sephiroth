import type {
  AgentMetaAllocationRun,
  AgentMonitorAlert,
  AgentSchedulerRun,
  AgentTournamentRun,
  PaperPortfolio,
  Strategy,
} from "@/integrations/supabase/types";
import type { ReadinessReport } from "@/lib/readiness";

export interface DeploymentStage {
  key: string;
  label: string;
  status: "done" | "current" | "blocked";
  summary: string;
}

interface BuildDeploymentStagesInput {
  readiness: ReadinessReport;
  strategies: Strategy[];
  tournamentRuns: AgentTournamentRun[];
  paperPortfolios: PaperPortfolio[];
  schedulerRuns: AgentSchedulerRun[];
  metaRuns: AgentMetaAllocationRun[];
  criticalAlerts: AgentMonitorAlert[];
}

export function buildDeploymentStages(input: BuildDeploymentStagesInput): DeploymentStage[] {
  const hasStrategies = input.strategies.length > 0;
  const hasTournament = input.tournamentRuns.length > 0;
  const hasPaper = input.paperPortfolios.length > 0;
  const hasActivePaper = input.paperPortfolios.some((portfolio) => portfolio.is_active);
  const hasScheduler = input.schedulerRuns.length > 0;
  const hasMeta = input.metaRuns.length > 0;
  const noCriticalAlerts = input.criticalAlerts.length === 0;
  const strongReadiness = input.readiness.score >= 70;

  const paperReady = hasStrategies && hasTournament;
  const dryRunReady = paperReady && hasPaper && noCriticalAlerts && strongReadiness;
  const testnetReady = dryRunReady && hasScheduler && hasMeta;

  return [
    {
      key: "research",
      label: "Research Ready",
      status: hasStrategies ? "done" : "current",
      summary: hasStrategies
        ? "Strategien koennen erfasst und weiter validiert werden."
        : "Zuerst Strategien aufbauen und erste Research-Laeufe fahren.",
    },
    {
      key: "paper",
      label: "Paper Trading Ready",
      status: paperReady ? "done" : hasStrategies ? "current" : "blocked",
      summary: paperReady
        ? hasActivePaper
          ? "Paper Trading laeuft bereits mit aktiven Portfolios."
          : "Paper Trading kann jetzt kontrolliert gestartet werden."
        : "Es fehlen noch Tournament-/Validierungsdaten fuer einen belastbaren Paper-Start.",
    },
    {
      key: "dry-run",
      label: "Dry-Run Execution Ready",
      status: dryRunReady ? "done" : paperReady ? "current" : "blocked",
      summary: dryRunReady
        ? "Execution kann im abgesicherten Dry-Run kontrolliert geprueft werden."
        : "Vor Dry-Run muessen Paper Trading, Monitoring und Plattform-Readiness stimmen.",
    },
    {
      key: "testnet",
      label: "Testnet Ready",
      status: testnetReady ? "current" : dryRunReady ? "current" : "blocked",
      summary: testnetReady
        ? "Naechster reale Schritt: Exchange Testnet mit echten serverseitigen Secrets anbinden."
        : "Fuer Testnet fehlen noch Scheduler-/Meta-Allokation oder stabile Dry-Run-Signale.",
    },
    {
      key: "production",
      label: "Production Live",
      status: "blocked",
      summary:
        "Bewusst blockiert, bis Supabase-Deployment, Secrets, Testnet-Bestaetigung und Ops-Abnahme ausserhalb des Frontends erfolgt sind.",
    },
  ];
}

export function buildRunbookActions(readiness: ReadinessReport) {
  const baseActions = [
    "Frontend auf Vercel deployen und BrowserRouter-Routen pruefen.",
    "Supabase-Migrationen und Edge Functions in der Zielumgebung deployen.",
    "Paper Trading mit den qualifizierten Agenten mehrere Zyklen stabil laufen lassen.",
    "Dry-Run Execution nur ohne kritische Alerts und mit positiver Allokation pruefen.",
    "Erst danach Binance Testnet mit serverseitigen Secrets anbinden.",
  ];

  return [...readiness.nextActions, ...baseActions].slice(0, 7);
}
