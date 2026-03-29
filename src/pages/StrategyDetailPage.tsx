import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAgentAnalyze,
  useAgentCreateVariant,
  useAgentOptimize,
  useBacktests,
  useRiskRules,
  useRunBacktest,
  useRunWalkforward,
  useStrategies,
  useWalkforwardResults,
} from "@/hooks/use-trading-data";
import { evaluateQualityGates } from "@/lib/quality-gates";
import { formatNumber, formatPercent } from "@/lib/utils";

function getLatestBacktest<T extends { created_at?: string }>(rows: T[]) {
  return [...rows].sort((left, right) => String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")))[0] ?? null;
}

export default function StrategyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const { data: riskRules = [] } = useRiskRules();
  const backtestMutation = useRunBacktest();
  const walkforwardMutation = useRunWalkforward();
  const analyzeMutation = useAgentAnalyze();
  const optimizeMutation = useAgentOptimize();
  const createVariantMutation = useAgentCreateVariant();

  const [startDate, setStartDate] = useState("2021-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.001);
  const [slippageRate, setSlippageRate] = useState(0.0005);
  const [windows, setWindows] = useState(4);
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<Record<string, any> | null>(null);
  const [createdVariant, setCreatedVariant] = useState<Record<string, any> | null>(null);
  const [validatingVariantId, setValidatingVariantId] = useState<string | null>(null);

  const strategy = strategies.find((item) => item.id === id);
  const strategyBacktests = backtests.filter((item) => item.strategy_id === id);
  const latestBacktest = getLatestBacktest(strategyBacktests);
  const wfRows = useMemo(() => walkforward.filter((item) => item.strategy_id === id), [id, walkforward]);
  const strategyRiskRule = useMemo(
    () => riskRules.find((rule) => rule.strategy_id === id) ?? riskRules.find((rule) => rule.is_global) ?? null,
    [id, riskRules],
  );
  const qualityGate = useMemo(() => evaluateQualityGates(latestBacktest, wfRows, strategyRiskRule), [latestBacktest, strategyRiskRule, wfRows]);

  if (!strategy) return <div>Strategie nicht gefunden.</div>;

  const runValidationForStrategy = async (strategyId: string) => {
    setValidatingVariantId(strategyId);
    try {
      await backtestMutation.mutateAsync({
        strategyId,
        startDate,
        endDate,
        initialCapital,
        feeRate,
        slippageRate,
      });
      await walkforwardMutation.mutateAsync({
        strategyId,
        startDate,
        endDate,
        initialCapital,
        feeRate,
        slippageRate,
        windows,
      });
      toast.success("Variante wurde mit Backtest und Walk-Forward validiert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Varianten-Validierung fehlgeschlagen.");
    } finally {
      setValidatingVariantId(null);
    }
  };

  const handleAnalyze = async () => {
    try {
      const result = await analyzeMutation.mutateAsync(strategy.id);
      setAnalysisResult(result);
      toast.success("Agent-Analyse aktualisiert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analyse fehlgeschlagen.");
    }
  };

  const handleOptimize = async () => {
    try {
      const result = await optimizeMutation.mutateAsync(strategy.id);
      setOptimizationResult(result);
      toast.success("Optimierungsvorschlag erzeugt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Optimierung fehlgeschlagen.");
    }
  };

  const handleCreateVariant = async (validateImmediately = false) => {
    try {
      const result = await createVariantMutation.mutateAsync(strategy.id);
      setOptimizationResult(result);
      setCreatedVariant(result.variant ?? null);
      toast.success(`Variante angelegt: ${result.variant?.name ?? "neue Variante"}`);
      if (validateImmediately && result.variant?.id) {
        await runValidationForStrategy(String(result.variant.id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Variantenerzeugung fehlgeschlagen.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>{strategy.name}</CardTitle>
                <Badge variant="secondary">{strategy.status}</Badge>
                {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                <Badge variant={qualityGate.passed ? "success" : "warning"}>{qualityGate.passed ? "Research-ready" : "Gate blockiert"}</Badge>
              </div>
              <p className="text-sm text-slate-500">{strategy.symbol} | {strategy.timeframe} | {strategy.asset_class}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void handleAnalyze()} disabled={analyzeMutation.isPending}>
                {analyzeMutation.isPending ? "Analysiere..." : "Agent analysieren"}
              </Button>
              <Button variant="outline" onClick={() => void handleOptimize()} disabled={optimizeMutation.isPending}>
                {optimizeMutation.isPending ? "Optimiere..." : "Optimierung ableiten"}
              </Button>
              <Button onClick={() => void handleCreateVariant(false)} disabled={createVariantMutation.isPending}>
                {createVariantMutation.isPending ? "Erzeuge Variante..." : "Variante erzeugen"}
              </Button>
              <Button variant="secondary" onClick={() => void handleCreateVariant(true)} disabled={createVariantMutation.isPending || backtestMutation.isPending || walkforwardMutation.isPending}>
                {createVariantMutation.isPending || validatingVariantId ? "Erzeuge und validiere..." : "Variante + Validierung"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{strategy.description ?? "Keine Beschreibung vorhanden."}</p>
        </CardContent>
      </Card>

      {createdVariant && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Zuletzt erzeugte Variante</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 text-sm">
              <p className="font-medium">{createdVariant.name}</p>
              <p className="text-slate-500">{createdVariant.symbol} | {createdVariant.timeframe} | Status {createdVariant.status}</p>
              <div className="flex flex-wrap gap-2">
                {(createdVariant.tags ?? []).slice(0, 6).map((tag: string) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate(`/strategies/${createdVariant.id}`)}>Zur Variante</Button>
              <Button onClick={() => void runValidationForStrategy(String(createdVariant.id))} disabled={validatingVariantId === createdVariant.id || backtestMutation.isPending || walkforwardMutation.isPending}>
                {validatingVariantId === createdVariant.id ? "Validiere..." : "Variante jetzt validieren"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Quality Gate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium">Status {qualityGate.passed ? "freigegeben" : "blockiert"}</p>
              <p className="mt-2 text-slate-500">
                Trades min {qualityGate.thresholds.minTrades} | Sharpe min {qualityGate.thresholds.minSharpe} | Profit Factor min {qualityGate.thresholds.minProfitFactor}
              </p>
              <p className="text-slate-500">
                Max DD {formatPercent(qualityGate.thresholds.maxDrawdown)} | Passrate min {formatPercent(qualityGate.thresholds.minPassRate)}
              </p>
            </div>
            {qualityGate.reasons.length === 0 ? (
              <p className="text-emerald-600">Die Strategie besteht aktuell alle Mindestanforderungen.</p>
            ) : (
              <div className="space-y-2">
                {qualityGate.reasons.map((reason) => (
                  <p key={reason} className="text-red-500">{reason}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Agent Feedback</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl bg-muted p-4">
              <p className="font-medium">Analyse</p>
              <p className="text-sm text-slate-500">
                Health {formatNumber(analysisResult?.scores?.healthScore)} | Readiness {formatNumber(analysisResult?.scores?.readinessScore)}
              </p>
              {Array.isArray(analysisResult?.strengths) && analysisResult.strengths.length > 0 ? analysisResult.strengths.map((item: string) => (
                <p key={item} className="text-sm text-emerald-600">{item}</p>
              )) : <p className="text-sm text-slate-500">Noch keine Analyse geladen.</p>}
              {Array.isArray(analysisResult?.risks) && analysisResult.risks.length > 0 && analysisResult.risks.map((item: string) => (
                <p key={item} className="text-sm text-red-500">{item}</p>
              ))}
            </div>

            <div className="space-y-3 rounded-xl bg-muted p-4">
              <p className="font-medium">Optimierungsplan</p>
              <p className="text-sm text-slate-500">{optimizationResult?.optimization?.objective ?? "Noch kein Optimierungsplan geladen."}</p>
              {optimizationResult?.optimization?.parameterPatch && (
                <div className="rounded-lg bg-background p-3 text-xs text-slate-600">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(optimizationResult.optimization.parameterPatch, null, 2)}</pre>
                </div>
              )}
              {Array.isArray(optimizationResult?.optimization?.rationale) && optimizationResult.optimization.rationale.map((item: string) => (
                <p key={item} className="text-sm text-slate-600">{item}</p>
              ))}
              {optimizationResult?.variant?.name && <p className="text-sm text-emerald-600">Neue Variante angelegt: {optimizationResult.variant.name}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Backtest</CardTitle>
          </CardHeader>
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
                  {backtestMutation.isPending ? "Backtest laeuft..." : "Echten Backtest starten"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">Return</p>
                <p className="text-xl font-semibold">{formatPercent(latestBacktest?.total_return)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Sharpe</p>
                <p className="text-xl font-semibold">{formatNumber(latestBacktest?.sharpe_ratio)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Max DD</p>
                <p className="text-xl font-semibold">{formatPercent(latestBacktest?.max_drawdown)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Win Rate</p>
                <p className="text-xl font-semibold">{formatPercent(latestBacktest?.win_rate)}</p>
              </div>
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
            {backtestMutation.error && <p className="text-sm text-red-500">{String(backtestMutation.error.message)}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Walk-Forward</CardTitle>
          </CardHeader>
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
                  {walkforwardMutation.isPending ? "Walk-Forward laeuft..." : "Walk-Forward validieren"}
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
              {wfRows.length === 0 && <p className="text-slate-500">Noch keine Walk-Forward-Ergebnisse vorhanden.</p>}
              {wfRows.map((row) => (
                <div key={row.id} className="rounded-xl bg-muted p-4">
                  <div className="flex items-center justify-between">
                    <span>Fenster {row.window_number}</span>
                    <Badge variant={row.passed ? "success" : "warning"}>{row.passed ? "Bestanden" : "Pruefen"}</Badge>
                  </div>
                  <p className="mt-2 text-slate-500">
                    IS Sharpe {formatNumber(row.in_sample_sharpe)} | OOS Sharpe {formatNumber(row.out_of_sample_sharpe)}
                  </p>
                </div>
              ))}
            </div>
            {walkforwardMutation.error && <p className="text-sm text-red-500">{String(walkforwardMutation.error.message)}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
