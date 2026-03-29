import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentAnalyze, useAgentBulkAnalyze, useAgentOptimize, useBacktests, useRiskRules, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { computeHealth } from "@/lib/analytics";
import { evaluateQualityGates } from "@/lib/quality-gates";
import { formatNumber } from "@/lib/utils";

export default function AgentPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: wf = [] } = useWalkforwardResults();
  const { data: riskRules = [] } = useRiskRules();
  const analyzeMutation = useAgentAnalyze();
  const optimizeMutation = useAgentOptimize();
  const bulkMutation = useAgentBulkAnalyze();
  const [selectedStrategyId, setSelectedStrategyId] = useState("");

  const healthRows = useMemo(
    () =>
      strategies
        .map((strategy) => ({ strategy, ...computeHealth(strategy, backtests, wf) }))
        .sort((left, right) => right.healthScore - left.healthScore),
    [strategies, backtests, wf],
  );

  const selectedStrategy = strategies.find((strategy) => strategy.id === selectedStrategyId) ?? healthRows[0]?.strategy ?? null;
  const portfolioRows = bulkMutation.data?.ranking ?? healthRows.map((row) => ({
    strategy_id: row.strategy.id,
    strategy_name: row.strategy.name,
    health_score: row.healthScore,
    readiness_score: row.readinessScore,
    latest_sharpe: row.backtest?.sharpe_ratio ?? 0,
  }));

  const candidateRows = useMemo(() => {
    return strategies
      .filter((strategy) => (strategy.tags ?? []).includes("agent-variant") || (strategy.tags ?? []).includes("candidate-ready") || (strategy.tags ?? []).includes("needs-improvement"))
      .map((strategy) => {
        const latestBacktest = backtests.find((backtest) => backtest.strategy_id === strategy.id) ?? null;
        const strategyWalkforward = wf.filter((row) => row.strategy_id === strategy.id);
        const riskRule = riskRules.find((rule) => rule.strategy_id === strategy.id) ?? riskRules.find((rule) => rule.is_global) ?? null;
        const gate = evaluateQualityGates(latestBacktest, strategyWalkforward, riskRule);
        const queueStatus = (strategy.tags ?? []).includes("candidate-ready")
          ? "candidate-ready"
          : (strategy.tags ?? []).includes("validation-pending")
            ? "validation-pending"
            : "needs-improvement";
        return {
          strategy,
          gate,
          queueStatus,
          latestBacktest,
        };
      })
      .sort((left, right) => {
        const leftScore = left.queueStatus === "candidate-ready" ? 2 : left.queueStatus === "validation-pending" ? 1 : 0;
        const rightScore = right.queueStatus === "candidate-ready" ? 2 : right.queueStatus === "validation-pending" ? 1 : 0;
        return rightScore - leftScore;
      });
  }, [strategies, backtests, wf, riskRules]);

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
        {healthRows.map(({ strategy, healthScore, readinessScore, passRate }) => (
          <Card key={strategy.id}>
            <CardHeader><CardTitle>{strategy.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-500">
              <p>Health Score: <span className="font-semibold text-foreground">{formatNumber(healthScore)}</span></p>
              <p>Readiness: <span className="font-semibold text-foreground">{formatNumber(readinessScore)}</span></p>
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
          <CardHeader><CardTitle>Candidate Queue</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500">
            {candidateRows.length === 0 && <p>Noch keine Agent-Varianten in der Queue.</p>}
            {candidateRows.map(({ strategy, gate, queueStatus, latestBacktest }) => (
              <div key={strategy.id} className="rounded-xl bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{strategy.name}</p>
                    <p>{strategy.symbol} | {strategy.timeframe}</p>
                  </div>
                  <span className={queueStatus === "candidate-ready" ? "text-emerald-600" : queueStatus === "validation-pending" ? "text-amber-600" : "text-red-500"}>
                    {queueStatus}
                  </span>
                </div>
                <p className="mt-2">Sharpe {formatNumber(latestBacktest?.sharpe_ratio)} | Trades {formatNumber(latestBacktest?.total_trades ?? 0, 0)}</p>
                {gate.reasons.length > 0 ? (
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
