import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentAnalyze, useAgentBulkAnalyze, useAgentOptimize, useBacktests, useLiveOrders, useLivePortfolios, usePaperPortfolios, useRiskRules, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { computeHealth, getPilotComparison, getPilotRole } from "@/lib/analytics";
import { evaluateQualityGates } from "@/lib/quality-gates";
import { formatNumber } from "@/lib/utils";

function getParentStrategyId(strategy: { parameters?: Record<string, unknown> | null; id: string }) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return strategy.id;
  const parentStrategyId = parameters.parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : strategy.id;
}

export default function AgentPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: wf = [] } = useWalkforwardResults();
  const { data: paperPortfolios = [] } = usePaperPortfolios();
  const { data: livePortfolios = [] } = useLivePortfolios();
  const { data: liveOrders = [] } = useLiveOrders();
  const { data: riskRules = [] } = useRiskRules();
  const analyzeMutation = useAgentAnalyze();
  const optimizeMutation = useAgentOptimize();
  const bulkMutation = useAgentBulkAnalyze();
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [showComparisonQueue, setShowComparisonQueue] = useState(false);

  const healthRows = useMemo(
    () =>
      strategies
        .map((strategy) => ({ strategy, ...computeHealth(strategy, backtests, wf, paperPortfolios, livePortfolios, liveOrders) }))
        .sort((left, right) => right.healthScore - left.healthScore),
    [strategies, backtests, wf, paperPortfolios, livePortfolios, liveOrders],
  );

  const portfolioRows = bulkMutation.data?.ranking ?? healthRows.map((row) => ({
    strategy_id: row.strategy.id,
    strategy_name: row.strategy.name,
    health_score: row.healthScore,
    readiness_score: row.readinessScore,
    latest_sharpe: row.backtest?.sharpe_ratio ?? 0,
  }));

  const pilotComparison = useMemo(
    () => getPilotComparison(strategies, backtests, wf),
    [strategies, backtests, wf],
  );

  const selectedStrategy = strategies.find((strategy) => strategy.id === selectedStrategyId) ?? pilotComparison.leader?.strategy ?? healthRows[0]?.strategy ?? null;

  const candidateRows = useMemo(() => {
    const rows = strategies
      .filter((strategy) => (strategy.tags ?? []).includes("agent-variant") || (strategy.tags ?? []).includes("candidate-ready") || (strategy.tags ?? []).includes("needs-improvement"))
      .map((strategy) => {
        const latestBacktest = backtests.find((backtest) => backtest.strategy_id === strategy.id) ?? null;
        const strategyWalkforward = wf.filter((row) => row.strategy_id === strategy.id);
        const riskRule = riskRules.find((rule) => rule.strategy_id === strategy.id) ?? riskRules.find((rule) => rule.is_global) ?? null;
        const health = computeHealth(strategy, backtests, wf, paperPortfolios, livePortfolios, liveOrders);
        const gate = evaluateQualityGates(latestBacktest, strategyWalkforward, riskRule);
        const queueStatus = (strategy.tags ?? []).includes("retired-variant")
          ? "retired"
          : !latestBacktest
            ? "awaiting-validation"
            : strategyWalkforward.length === 0
              ? "validation-pending"
              : (strategy.tags ?? []).includes("candidate-ready")
                ? "candidate-ready"
                : "needs-improvement";
        return {
          strategy,
          gate,
          health,
          queueStatus,
          latestBacktest,
          parentStrategyId: getParentStrategyId(strategy),
          executionWatchlist: (strategy.tags ?? []).includes("execution-watchlist"),
        };
      });

    const bestByParent = new Map<string, string>();
    rows
      .filter((row) => row.queueStatus === "candidate-ready")
      .sort((left, right) => Number(right.latestBacktest?.sharpe_ratio ?? 0) - Number(left.latestBacktest?.sharpe_ratio ?? 0))
      .forEach((row) => {
        if (!bestByParent.has(row.parentStrategyId)) {
          bestByParent.set(row.parentStrategyId, row.strategy.id);
        }
      });

    return rows
      .map((row) => ({
        ...row,
        preferredForTournament: bestByParent.get(row.parentStrategyId) === row.strategy.id,
        parentPilotRole: getPilotRole(row.parentStrategyId, pilotComparison),
      }))
      .sort((left, right) => {
        const leftScore =
          (left.executionWatchlist ? 5 : left.preferredForTournament ? 4 : left.queueStatus === "candidate-ready" ? 3 : left.queueStatus === "validation-pending" ? 2 : left.queueStatus === "awaiting-validation" ? 1 : 0) +
          (left.parentPilotRole === "focus" ? 1 : left.parentPilotRole === "comparison" ? -2 : 0);
        const rightScore =
          (right.executionWatchlist ? 5 : right.preferredForTournament ? 4 : right.queueStatus === "candidate-ready" ? 3 : right.queueStatus === "validation-pending" ? 2 : right.queueStatus === "awaiting-validation" ? 1 : 0) +
          (right.parentPilotRole === "focus" ? 1 : right.parentPilotRole === "comparison" ? -2 : 0);
        if (rightScore !== leftScore) return rightScore - leftScore;
        if ((right.latestBacktest?.sharpe_ratio ?? -999) !== (left.latestBacktest?.sharpe_ratio ?? -999)) {
          return Number(right.latestBacktest?.sharpe_ratio ?? -999) - Number(left.latestBacktest?.sharpe_ratio ?? -999);
        }
        return rightScore - leftScore;
      });
  }, [strategies, backtests, wf, riskRules, paperPortfolios, livePortfolios, liveOrders, pilotComparison]);

  const visibleCandidateRows = useMemo(
    () => candidateRows.filter((row) => showComparisonQueue || row.parentPilotRole !== "comparison"),
    [candidateRows, showComparisonQueue],
  );

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="portfolio">Portfolio Analysis</TabsTrigger>
        <TabsTrigger value="queue">Candidate Queue</TabsTrigger>
        <TabsTrigger value="analyze">Analyze</TabsTrigger>
        <TabsTrigger value="optimize">Optimize</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {healthRows.map(({ strategy, healthScore, readinessScore, passRate, operationalScore, operationalReadiness }) => (
          <Card key={strategy.id}>
            <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>Health Score: <span className="font-semibold text-foreground">{formatNumber(healthScore)}</span></p>
              <p>Readiness: <span className="font-semibold text-foreground">{formatNumber(readinessScore)}</span></p>
              <p>Operational Score: <span className="font-semibold text-foreground">{operationalScore === null ? "-" : formatNumber(operationalScore)}</span></p>
              <p>Operational Readiness: <span className="font-semibold text-foreground">{operationalReadiness === null ? "-" : formatNumber(operationalReadiness)}</span></p>
              <p>WF Pass Rate: <span className="font-semibold text-foreground">{formatNumber(passRate * 100)}</span>%</p>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
      <TabsContent value="portfolio">
        <Card>
          <CardHeader><CardTitle>Portfolio Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? "Analysiere..." : "Bulk-Analyse starten"}
              </Button>
              <Button variant="outline" onClick={() => bulkMutation.reset()}>Ansicht leeren</Button>
            </div>
            <div className="space-y-3 text-sm text-slate-500">
              {portfolioRows.map((row: any) => (
                <div key={row.strategy_id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{row.strategy_name}</span>
                    <span>Health {formatNumber(row.health_score)}</span>
                  </div>
                  <p className="mt-2">Readiness {formatNumber(row.readiness_score)} | Sharpe {formatNumber(row.latest_sharpe)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="queue">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Candidate Queue</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{visibleCandidateRows.length} sichtbar</span>
              <span>{candidateRows.filter((row) => row.parentPilotRole === "focus").length} Fokusspur</span>
              <span>{candidateRows.filter((row) => row.parentPilotRole === "comparison").length} Vergleichsspur</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowComparisonQueue((current) => !current)}
              >
                {showComparisonQueue ? "Vergleichslinie ausblenden" : "Vergleichslinie anzeigen"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500">
            {visibleCandidateRows.length === 0 && <p>Noch keine Agent-Varianten in der Queue.</p>}
            {visibleCandidateRows.map(({ strategy, gate, health, queueStatus, latestBacktest, preferredForTournament, executionWatchlist, parentPilotRole }) => (
              <div key={strategy.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{strategy.name}</p>
                    <p>{strategy.symbol} | {strategy.timeframe}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={queueStatus === "candidate-ready" ? "text-emerald-600" : queueStatus === "validation-pending" || queueStatus === "awaiting-validation" ? "text-amber-600" : queueStatus === "retired" ? "text-slate-500" : "text-red-500"}>
                      {queueStatus}
                    </span>
                    {parentPilotRole === "focus" && <span className="text-indigo-600">pilot-focus-variant</span>}
                    {parentPilotRole === "comparison" && <span className="text-slate-500">comparison-variant</span>}
                    {executionWatchlist && <span className="text-sky-600">execution-watchlist</span>}
                    {preferredForTournament && <span className="text-emerald-600">preferred-for-tournament</span>}
                  </div>
                </div>
                <p className="mt-2">
                  Sharpe {formatNumber(latestBacktest?.sharpe_ratio)} | Trades {formatNumber(latestBacktest?.total_trades ?? 0, 0)} | Operational {health.operationalScore === null ? "-" : formatNumber(health.operationalScore)}
                </p>
                {health.operationalNotes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {health.operationalNotes.map((note) => <p key={note}>{note}</p>)}
                  </div>
                )}
                {parentPilotRole === "comparison" && (
                  <div className="mt-2 space-y-1">
                    <p>Diese Variante stammt aus der Vergleichslinie und bleibt nur als schlanke Referenzspur in der Queue.</p>
                  </div>
                )}
                {queueStatus === "retired" ? (
                  <div className="mt-2 space-y-1">
                    <p>Diese Variante wurde nach wiederholtem Scheitern aus der automatischen Optimizer-Schleife genommen.</p>
                  </div>
                ) : queueStatus === "awaiting-validation" ? (
                  <div className="mt-2 space-y-1">
                    <p>Backtest steht noch aus. Diese Variante wartet noch auf den ersten Validierungslauf.</p>
                  </div>
                ) : queueStatus === "validation-pending" ? (
                  <div className="mt-2 space-y-1">
                    <p>Backtest ist vorhanden, aber der Walk-Forward-Lauf ist noch nicht vollstaendig abgeschlossen.</p>
                  </div>
                ) : gate.reasons.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {gate.reasons.map((reason) => <p key={reason} className="text-red-500">{reason}</p>)}
                  </div>
                ) : (
                  <p className="mt-2 text-emerald-600">Variante besteht aktuell das Quality Gate und kann ins naechste Tournament.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="analyze">
        <Card>
          <CardHeader><CardTitle>Einzelanalyse</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input placeholder="Strategie-ID" value={selectedStrategyId} onChange={(event) => setSelectedStrategyId(event.target.value)} />
              <Button onClick={() => selectedStrategy && analyzeMutation.mutate(selectedStrategy.id)} disabled={analyzeMutation.isPending || !selectedStrategy}>
                {analyzeMutation.isPending ? "Analysiere..." : "Analyse ausfuehren"}
              </Button>
            </div>
            {selectedStrategy && <p className="text-sm text-slate-500">Gewaehlte Strategie: <span className="font-medium text-foreground">{selectedStrategy.name}</span></p>}
            {analyzeMutation.data?.ok && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-muted p-4 text-sm text-slate-500">
                  <p className="font-medium text-foreground">Scores</p>
                  <p className="mt-2">Health {formatNumber(analyzeMutation.data.scores.healthScore)}</p>
                  <p>Readiness {formatNumber(analyzeMutation.data.scores.readinessScore)}</p>
                </div>
                <div className="rounded-xl bg-muted p-4 text-sm text-slate-500">
                  <p className="font-medium text-foreground">Empfehlungen</p>
                  {(analyzeMutation.data.recommendations ?? []).map((item: string) => (
                    <p key={item} className="mt-2">{item}</p>
                  ))}
                </div>
                <div className="rounded-xl bg-muted p-4 text-sm text-slate-500">
                  <p className="font-medium text-foreground">Staerken</p>
                  {(analyzeMutation.data.strengths ?? []).map((item: string) => (
                    <p key={item} className="mt-2">{item}</p>
                  ))}
                </div>
                <div className="rounded-xl bg-muted p-4 text-sm text-slate-500">
                  <p className="font-medium text-foreground">Risiken</p>
                  {(analyzeMutation.data.risks ?? []).map((item: string) => (
                    <p key={item} className="mt-2">{item}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="optimize">
        <Card>
          <CardHeader><CardTitle>Parameter-Optimierung</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={() => selectedStrategy && optimizeMutation.mutate(selectedStrategy.id)} disabled={optimizeMutation.isPending || !selectedStrategy}>
                {optimizeMutation.isPending ? "Optimiere..." : "Optimieren"}
              </Button>
              <Button variant="outline" onClick={() => optimizeMutation.reset()}>Vorschlag leeren</Button>
            </div>
            {optimizeMutation.data?.optimization && (
              <div className="space-y-3 rounded-xl bg-muted p-4 text-sm text-slate-500">
                <p><span className="font-medium text-foreground">Objective:</span> {optimizeMutation.data.optimization.objective}</p>
                <p><span className="font-medium text-foreground">Patch:</span> {JSON.stringify(optimizeMutation.data.optimization.parameterPatch)}</p>
                {(optimizeMutation.data.optimization.rationale ?? []).map((item: string) => (
                  <p key={item}>{item}</p>
                ))}
                <p><span className="font-medium text-foreground">Next Experiment:</span> {optimizeMutation.data.optimization.nextExperiment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
