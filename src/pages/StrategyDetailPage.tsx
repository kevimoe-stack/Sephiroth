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
  useAgentCreateVariantPack,
  useBacktestTrades,
  useAgentOptimize,
  useBacktests,
  useRiskRules,
  useRunBacktest,
  useRunWalkforward,
  useStrategies,
  useWalkforwardResults,
} from "@/hooks/use-trading-data";
import { evaluateQualityGates } from "@/lib/quality-gates";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/utils";

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
  const createVariantPackMutation = useAgentCreateVariantPack();

  const [startDate, setStartDate] = useState("2021-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.001);
  const [slippageRate, setSlippageRate] = useState(0.0005);
  const [windows, setWindows] = useState(4);
  const [analysisResult, setAnalysisResult] = useState<Record<string, any> | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<Record<string, any> | null>(null);
  const [createdVariant, setCreatedVariant] = useState<Record<string, any> | null>(null);
  const [createdVariants, setCreatedVariants] = useState<Record<string, any>[]>([]);
  const [validatingVariantId, setValidatingVariantId] = useState<string | null>(null);
  const [packValidationRunning, setPackValidationRunning] = useState(false);

  const strategy = strategies.find((item) => item.id === id);
  const strategyBacktests = backtests.filter((item) => item.strategy_id === id);
  const latestBacktest = getLatestBacktest(strategyBacktests);
  const { data: latestBacktestTrades = [] } = useBacktestTrades(latestBacktest?.id);
  const wfRows = useMemo(() => walkforward.filter((item) => item.strategy_id === id), [id, walkforward]);
  const strategyRiskRule = useMemo(
    () => riskRules.find((rule) => rule.strategy_id === id) ?? riskRules.find((rule) => rule.is_global) ?? null,
    [id, riskRules],
  );
  const qualityGate = useMemo(() => evaluateQualityGates(latestBacktest, wfRows, strategyRiskRule), [latestBacktest, strategyRiskRule, wfRows]);
  const isPilotStrategy = (strategy?.tags ?? []).includes("pilot");
  const displayedBacktestMatchesInputs = useMemo(() => {
    if (!latestBacktest) return false;
    return (
      latestBacktest.start_date === startDate &&
      latestBacktest.end_date === endDate &&
      Number(latestBacktest.initial_capital) === Number(initialCapital)
    );
  }, [endDate, initialCapital, latestBacktest, startDate]);

  if (!strategy) return <div>Strategie nicht gefunden.</div>;

  const runPilotBaseline = async () => {
    setStartDate("2019-01-01");
    setEndDate(new Date().toISOString().slice(0, 10));
    setInitialCapital(10000);
    setFeeRate(0.001);
    setSlippageRate(0.0005);
    setWindows(6);

    try {
      await backtestMutation.mutateAsync({
        strategyId: strategy.id,
        startDate: "2019-01-01",
        endDate: new Date().toISOString().slice(0, 10),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
      });
      await walkforwardMutation.mutateAsync({
        strategyId: strategy.id,
        startDate: "2019-01-01",
        endDate: new Date().toISOString().slice(0, 10),
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        windows: 6,
      });
      toast.success("Pilot-Basisvalidierung abgeschlossen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pilot-Basisvalidierung fehlgeschlagen.");
    }
  };

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

  const runValidationForPack = async (variants: Record<string, any>[]) => {
    setPackValidationRunning(true);
    try {
      for (const variant of variants) {
        if (!variant?.id) continue;
        await runValidationForStrategy(String(variant.id));
      }
      toast.success("Varianten-Pack wurde vollstaendig validiert.");
    } finally {
      setPackValidationRunning(false);
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
      setCreatedVariants(result.variant ? [result.variant] : []);
      toast.success(`Variante angelegt: ${result.variant?.name ?? "neue Variante"}`);
      if (validateImmediately && result.variant?.id) {
        await runValidationForStrategy(String(result.variant.id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Variantenerzeugung fehlgeschlagen.");
    }
  };

  const handleCreateVariantPack = async (validateImmediately = false) => {
    try {
      const result = await createVariantPackMutation.mutateAsync(strategy.id);
      const variants = Array.isArray(result.variants) ? result.variants : [];
      setOptimizationResult(result);
      setCreatedVariant(variants[0] ?? null);
      setCreatedVariants(variants);
      toast.success(`${variants.length} Varianten angelegt.`);
      if (validateImmediately && variants.length > 0) {
        await runValidationForPack(variants);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Varianten-Pack fehlgeschlagen.");
    }
  };

  const busy = createVariantMutation.isPending || createVariantPackMutation.isPending || backtestMutation.isPending || walkforwardMutation.isPending || packValidationRunning;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>{strategy.name}</CardTitle>
                <Badge variant="secondary">{strategy.status}</Badge>
                {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                {isPilotStrategy && <Badge variant="secondary">Pilot</Badge>}
                <Badge variant={qualityGate.passed ? "success" : "warning"}>{qualityGate.passed ? "Research-ready" : "Gate blockiert"}</Badge>
                {(strategy.tags ?? []).includes("optimizer-paused") && <Badge variant="warning">Optimizer pausiert</Badge>}
              </div>
              <p className="text-sm text-slate-500">{strategy.symbol} | {strategy.timeframe} | {strategy.asset_class}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:flex 2xl:flex-wrap">
              <Button variant="outline" onClick={() => void handleAnalyze()} disabled={analyzeMutation.isPending || busy}>
                {analyzeMutation.isPending ? "Analysiere..." : "Agent analysieren"}
              </Button>
              {isPilotStrategy && (
                <Button variant="secondary" onClick={() => void runPilotBaseline()} disabled={busy}>
                  {backtestMutation.isPending || walkforwardMutation.isPending ? "Pilot wird validiert..." : "Pilot-Basisvalidierung"}
                </Button>
              )}
              <Button variant="outline" onClick={() => void handleOptimize()} disabled={optimizeMutation.isPending || busy}>
                {optimizeMutation.isPending ? "Optimiere..." : "Optimierung ableiten"}
              </Button>
              <Button onClick={() => void handleCreateVariant(false)} disabled={busy}>
                {createVariantMutation.isPending ? "Erzeuge Variante..." : "Variante erzeugen"}
              </Button>
              <Button variant="secondary" onClick={() => void handleCreateVariant(true)} disabled={busy}>
                {createVariantMutation.isPending || validatingVariantId ? "Erzeuge und validiere..." : "Variante + Validierung"}
              </Button>
              <Button variant="outline" onClick={() => void handleCreateVariantPack(false)} disabled={busy}>
                {createVariantPackMutation.isPending ? "Erzeuge Pack..." : "Varianten-Pack"}
              </Button>
              <Button variant="secondary" onClick={() => void handleCreateVariantPack(true)} disabled={busy}>
                {createVariantPackMutation.isPending || packValidationRunning ? "Pack wird validiert..." : "Pack + Validierung"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{strategy.description ?? "Keine Beschreibung vorhanden."}</p>
          {(strategy.tags ?? []).includes("optimizer-paused") && (
            <p className="mt-3 text-sm text-amber-600">
              Der automatische Optimizer ist fuer diese Elternstrategie aktuell pausiert, weil mehrere Varianten zuletzt wiederholt gescheitert sind. Manuelle Experimente sind weiter moeglich.
            </p>
          )}
        </CardContent>
      </Card>

      {createdVariants.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Zuletzt erzeugte Varianten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {createdVariants.map((variant) => (
              <div key={variant.id} className="flex flex-col gap-4 rounded-xl bg-muted p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{variant.name}</p>
                  <p className="text-slate-500">{variant.symbol} | {variant.timeframe} | Status {variant.status}</p>
                  <div className="flex flex-wrap gap-2">
                    {(variant.tags ?? []).slice(0, 6).map((tag: string) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                  <Button variant="outline" onClick={() => navigate(`/strategies/${variant.id}`)}>Zur Variante</Button>
                  <Button onClick={() => void runValidationForStrategy(String(variant.id))} disabled={validatingVariantId === variant.id || busy}>
                    {validatingVariantId === variant.id ? "Validiere..." : "Jetzt validieren"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Quality Gate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {isPilotStrategy && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-slate-600">
                Diese Pilotstrategie ist als sauberer Referenzkandidat gedacht: 4h, laengerer Testzeitraum und mehr Walk-Forward-Fenster statt aggressiver 1h-Optimierung.
              </div>
            )}
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
              {Array.isArray(optimizationResult?.variants) && optimizationResult.variants.length > 0 && (
                <p className="text-sm text-emerald-600">Varianten-Pack angelegt: {optimizationResult.variants.length} Kandidaten</p>
              )}
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
                  disabled={busy}
                >
                  {backtestMutation.isPending ? "Backtest laeuft..." : "Echten Backtest starten"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Return</p>
                <p className="mt-1 text-2xl font-semibold">{formatPercent(latestBacktest?.total_return)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Sharpe</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(latestBacktest?.sharpe_ratio)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Max DD</p>
                <p className="mt-1 text-2xl font-semibold">{formatPercent(latestBacktest?.max_drawdown)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Win Rate</p>
                <p className="mt-1 text-2xl font-semibold">{formatPercent(latestBacktest?.win_rate)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Trades</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(latestBacktest?.total_trades, 0)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Gewinner</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(latestBacktest?.winning_trades, 0)}</p>
              </div>
              <div className="min-h-24 rounded-xl bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Verlierer</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(latestBacktest?.losing_trades, 0)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="min-h-24 rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Angezeigter Run</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(latestBacktest?.created_at)}</p>
              </div>
              <div className="min-h-24 rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Final Capital</p>
                <p className="mt-1 text-sm font-medium">{formatCurrency(latestBacktest?.final_capital)}</p>
              </div>
              <div className="min-h-24 rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Profit Factor</p>
                <p className="mt-1 text-sm font-medium">{formatNumber(latestBacktest?.profit_factor)}</p>
              </div>
              <div className="min-h-24 rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ø Haltedauer</p>
                <p className="mt-1 text-sm font-medium">{latestBacktest?.avg_trade_duration ?? "-"}</p>
              </div>
            </div>

            {!displayedBacktestMatchesInputs && latestBacktest && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Angezeigt wird aktuell der letzte gespeicherte Backtest vom {formatDateTime(latestBacktest.created_at)}.
                Er gehoert zu {latestBacktest.start_date} bis {latestBacktest.end_date} bei Kapital {formatCurrency(latestBacktest.initial_capital)} und passt damit nicht vollstaendig zu den aktuell eingestellten Eingaben oben.
              </div>
            )}

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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Letzte Trades des angezeigten Backtests</p>
                <p className="text-xs text-slate-500">
                  {latestBacktestTrades.length > 0 ? `${latestBacktestTrades.length} gespeicherte Trades` : "Keine Trades gespeichert"}
                </p>
              </div>
              {latestBacktestTrades.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Entry</th>
                        <th className="px-3 py-2 font-medium">Exit</th>
                        <th className="px-3 py-2 font-medium">Entry Price</th>
                        <th className="px-3 py-2 font-medium">Exit Price</th>
                        <th className="px-3 py-2 font-medium">PnL</th>
                        <th className="px-3 py-2 font-medium">PnL %</th>
                        <th className="px-3 py-2 font-medium">Notiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestBacktestTrades.slice(0, 12).map((trade) => (
                        <tr key={trade.id} className="border-t border-border/60">
                          <td className="px-3 py-2 align-top">{formatDateTime(trade.entry_date)}</td>
                          <td className="px-3 py-2 align-top">{formatDateTime(trade.exit_date)}</td>
                          <td className="px-3 py-2 align-top">{formatNumber(trade.entry_price)}</td>
                          <td className="px-3 py-2 align-top">{formatNumber(trade.exit_price)}</td>
                          <td className="px-3 py-2 align-top">{formatCurrency(trade.pnl)}</td>
                          <td className="px-3 py-2 align-top">{formatPercent(trade.pnl_percent)}</td>
                          <td className="max-w-[220px] px-3 py-2 align-top break-words text-slate-500">{trade.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl bg-muted p-4 text-sm text-slate-500">
                  Fuer diesen Lauf sind noch keine einzelnen Trades sichtbar. Wenn die Kennzahlen unplausibel wirken, laesst sich damit der naechste Backtest deutlich besser prüfen.
                </div>
              )}
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
                  disabled={busy}
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
