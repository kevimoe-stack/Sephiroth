import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BulkOperationsDialog } from "@/components/strategies/BulkOperationsDialog";
import { CreateStrategyDialog } from "@/components/strategies/CreateStrategyDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBacktests, useCreateStrategy, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { getResearchSnapshot } from "@/lib/analytics";
import { buildPilotStrategySeeds } from "@/lib/strategy-presets";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils";

export default function StrategiesPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const createStrategy = useCreateStrategy();
  const [query, setQuery] = useState("");
  const [showVariants, setShowVariants] = useState(false);
  const pilotNames = new Set(
    strategies.filter((strategy) => (strategy.tags ?? []).includes("pilot")).map((strategy) => strategy.name),
  );
  const missingPilotSeeds = buildPilotStrategySeeds().filter((seed) => !pilotNames.has(String(seed.name ?? "")));
  const filtered = useMemo(
    () =>
      strategies
        .filter((strategy) => {
          const matchesQuery = [strategy.name, strategy.symbol, ...(strategy.tags ?? [])].join(" ").toLowerCase().includes(query.toLowerCase());
          const isVariant = (strategy.tags ?? []).includes("agent-variant");
          return matchesQuery && (showVariants || !isVariant);
        })
        .sort((left, right) => {
          const leftSnapshot = getResearchSnapshot(backtests, walkforward, left.id);
          const rightSnapshot = getResearchSnapshot(backtests, walkforward, right.id);
          const priority = {
            "candidate-ready": 5,
            "research-watch": 4,
            "backtest-only": 3,
            stale: 2,
            "needs-improvement": 1,
            "no-runs": 0,
          } as const;
          const leftScore = priority[leftSnapshot.status] + (left.is_champion ? 3 : 0) + ((left.tags ?? []).includes("pilot") ? 1 : 0);
          const rightScore = priority[rightSnapshot.status] + (right.is_champion ? 3 : 0) + ((right.tags ?? []).includes("pilot") ? 1 : 0);
          return rightScore - leftScore || left.name.localeCompare(right.name);
        }),
    [backtests, query, showVariants, strategies, walkforward],
  );
  const summary = useMemo(
    () => {
      const snapshots = strategies.map((strategy) => getResearchSnapshot(backtests, walkforward, strategy.id));
      return {
        total: strategies.length,
        pilots: strategies.filter((strategy) => (strategy.tags ?? []).includes("pilot")).length,
        champions: strategies.filter((strategy) => strategy.is_champion).length,
        variants: strategies.filter((strategy) => (strategy.tags ?? []).includes("agent-variant")).length,
        candidateReady: snapshots.filter((snapshot) => snapshot.status === "candidate-ready").length,
        researchWatch: snapshots.filter((snapshot) => snapshot.status === "research-watch").length,
        stale: snapshots.filter((snapshot) => snapshot.status === "stale").length,
      };
    },
    [backtests, strategies, walkforward],
  );

  const handleCreatePilot = async () => {
    if (missingPilotSeeds.length === 0) {
      toast.message("Pilotstrategien existieren bereits in der Liste.");
      return;
    }
    try {
      for (const seed of missingPilotSeeds) {
        await createStrategy.mutateAsync(seed);
      }
      toast.success(`${missingPilotSeeds.length} Pilotstrategie(n) angelegt.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pilotstrategien konnten nicht angelegt werden.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Strategien durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setShowVariants((current) => !current)}>
            {showVariants ? "Varianten ausblenden" : "Varianten einblenden"}
          </Button>
          <Button variant="secondary" onClick={() => void handleCreatePilot()} disabled={createStrategy.isPending || missingPilotSeeds.length === 0}>
            {createStrategy.isPending ? "Lege Pilot an..." : missingPilotSeeds.length === 0 ? "Pilot-Pack vorhanden" : `Pilot-Pack anlegen (${missingPilotSeeds.length})`}
          </Button>
          <CreateStrategyDialog />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Strategien</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pilot Seeds</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.pilots}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Champions</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.champions}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Agent-Varianten</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.variants}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Candidate-ready</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.candidateReady}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Research Watch</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.researchWatch}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Research Stale</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-semibold">{summary.stale}</p></CardContent>
        </Card>
      </div>

      <BulkOperationsDialog />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((strategy) => (
          <Link key={strategy.id} to={`/strategies/${strategy.id}`}>
            <Card className={strategy.is_champion ? "border-success/40 ring-1 ring-success/30" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{strategy.name}</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">{strategy.symbol} | {strategy.timeframe}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                    {(strategy.tags ?? []).includes("pilot") && <Badge variant="secondary">Pilot</Badge>}
                    {(() => {
                      const snapshot = getResearchSnapshot(backtests, walkforward, strategy.id);
                      const variantMap: Record<string, "outline" | "secondary" | "destructive" | "success"> = {
                        "candidate-ready": "success",
                        "research-watch": "secondary",
                        "backtest-only": "outline",
                        stale: "outline",
                        "needs-improvement": "destructive",
                        "no-runs": "outline",
                      };
                      return <Badge variant={variantMap[snapshot.status]}>{snapshot.label}</Badge>;
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-500">
                <p>{strategy.description}</p>
                {(() => {
                  const snapshot = getResearchSnapshot(backtests, walkforward, strategy.id);
                  const { backtest, walkforwardRun, passRate } = snapshot;

                  if (!backtest && walkforwardRun.length === 0) return null;

                  return (
                    <div className="space-y-3 rounded-xl bg-muted/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>Letzter Research-Stand</span>
                        <span>{formatDateTime(walkforwardRun[0]?.created_at ?? backtest?.created_at)}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Research Snapshot</p>
                          <p>Return {formatPercent(backtest?.total_return)}</p>
                          <p>Sharpe {formatNumber(backtest?.sharpe_ratio)}</p>
                          <p>Max DD {formatPercent(backtest?.max_drawdown)}</p>
                          <p>Trades {formatNumber(backtest?.total_trades, 0)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Walk-Forward</p>
                          <p>Fenster {walkforwardRun.length > 0 ? walkforwardRun.length : "-"}</p>
                          <p>Passrate {passRate === null ? "-" : `${formatNumber(passRate * 100, 0)}%`}</p>
                          <p>Fee / Slip {backtest ? `${formatNumber(backtest.fee_rate, 4)} / ${formatNumber(backtest.slippage_rate, 4)}` : "-"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{strategy.status}</Badge>
                  {(strategy.tags ?? []).slice(0, 8).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
