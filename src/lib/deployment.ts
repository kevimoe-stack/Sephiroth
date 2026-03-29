import type {
  AgentMetaAllocationRun,
  AgentMonitorAlert,
  AgentSchedulerRun,
  AgentTournamentRun,
  LiveOrder,
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
  liveOrders?: LiveOrder[];
}

export interface TestnetChecklistItem {
  key: string;
  label: string;
  status: "ready" | "warning" | "blocked";
  detail: string;
}

export function buildDeploymentStages(input: BuildDeploymentStagesInput): DeploymentStage[] {
  const hasStrategies = input.strategies.length > 0;
  const hasTournament = input.tournamentRuns.length > 0;
  const hasPaper = input.paperPortfolios.length > 0;
  const hasActivePaper = input.paperPortfolios.some((portfolio) => portfolio.is_active);
  const hasScheduler = input.schedulerRuns.length > 0;
  const hasMeta = input.metaRuns.length > 0;
  const hasDryRunOrders = (input.liveOrders ?? []).length > 0;
  const noCriticalAlerts = input.criticalAlerts.length === 0;
  const strongReadiness = input.readiness.score >= 70;

  const paperReady = hasStrategies && hasTournament;
  const dryRunReady = paperReady && hasPaper && noCriticalAlerts && strongReadiness;
  const testnetReady = dryRunReady && hasScheduler && hasMeta && hasDryRunOrders;

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
        : "Fuer Testnet fehlen noch Scheduler-/Meta-Allokation oder belastbare Dry-Run-Execution.",
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

export function buildTestnetChecklist(input: BuildDeploymentStagesInput): TestnetChecklistItem[] {
  const hasStrategies = input.strategies.length > 0;
  const hasTournament = input.tournamentRuns.length > 0;
  const paperRuns = input.paperPortfolios.length;
  const profitablePaper = input.paperPortfolios.some((portfolio) => portfolio.total_trades >= 3 && portfolio.total_pnl >= 0);
  const hasScheduler = input.schedulerRuns.length > 0;
  const hasMeta = input.metaRuns.length > 0;
  const criticalAlerts = input.criticalAlerts.length;
  const liveOrders = input.liveOrders ?? [];
  const executedDryRun = liveOrders.filter((order) => ["simulated", "dry-run", "filled"].includes(order.status)).length;
  const blockedDryRun = liveOrders.filter((order) => order.status === "blocked").length;

  return [
    {
      key: "research-base",
      label: "Research Basis",
      status: hasStrategies && hasTournament ? "ready" : hasStrategies ? "warning" : "blocked",
      detail: hasStrategies && hasTournament
        ? "Strategien und Tournament-Basis sind vorhanden."
        : hasStrategies
          ? "Strategien existieren, aber Tournament/Champion-Schicht ist noch zu duenn."
          : "Ohne belastbare Strategien ist Testnet nicht sinnvoll.",
    },
    {
      key: "paper-proof",
      label: "Paper Proof",
      status: profitablePaper ? "ready" : paperRuns > 0 ? "warning" : "blocked",
      detail: profitablePaper
        ? "Mindestens ein Paper-Portfolio zeigt mehrere Trades ohne klaren Negativtrend."
        : paperRuns > 0
          ? "Paper-Historie ist da, aber noch nicht stabil genug fuer Testnet."
          : "Vor Testnet sollte zuerst echte Paper-Historie aufgebaut werden.",
    },
    {
      key: "dry-run",
      label: "Dry-Run Execution",
      status: executedDryRun > 0 && blockedDryRun === 0 ? "ready" : executedDryRun > 0 ? "warning" : "blocked",
      detail: executedDryRun > 0 && blockedDryRun === 0
        ? `${executedDryRun} Dry-Run-/Execution-Ereignisse ohne aktuelle Blocker.`
        : executedDryRun > 0
          ? `${executedDryRun} Dry-Run-Ereignisse, aber ${blockedDryRun} blockierte Checks muessen erst geklaert werden.`
          : "Noch keine belastbare Dry-Run-Execution vorhanden.",
    },
    {
      key: "ops-loop",
      label: "Ops Loop",
      status: hasScheduler && hasMeta ? "ready" : hasScheduler || hasMeta ? "warning" : "blocked",
      detail: hasScheduler && hasMeta
        ? "Scheduler und Meta-Allokation stehen fuer kontrollierte Testnet-Zyklen bereit."
        : hasScheduler || hasMeta
          ? "Nur Teile des operativen Loops sind vorhanden."
          : "Vor Testnet sollte der automatische Ops-Loop stehen.",
    },
    {
      key: "alerts",
      label: "Alert Hygiene",
      status: criticalAlerts === 0 ? "ready" : criticalAlerts <= 2 ? "warning" : "blocked",
      detail: criticalAlerts === 0
        ? "Keine kritischen Alerts blockieren den Uebergang."
        : `${criticalAlerts} kritische Alerts muessen vor Testnet bereinigt oder begruendet werden.`,
    },
    {
      key: "secrets",
      label: "Server Secrets",
      status: "warning",
      detail: "Binance Testnet Keys muessen spaeter nur serverseitig in Supabase Secrets gesetzt werden.",
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
