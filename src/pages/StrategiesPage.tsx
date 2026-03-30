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
import { useCreateStrategy, useStrategies } from "@/hooks/use-trading-data";
import { buildPilotStrategySeeds } from "@/lib/strategy-presets";

export default function StrategiesPage() {
  const { data: strategies = [] } = useStrategies();
  const createStrategy = useCreateStrategy();
  const [query, setQuery] = useState("");
  const [showVariants, setShowVariants] = useState(false);
  const pilotNames = new Set(
    strategies.filter((strategy) => (strategy.tags ?? []).includes("pilot")).map((strategy) => strategy.name),
  );
  const missingPilotSeeds = buildPilotStrategySeeds().filter((seed) => !pilotNames.has(String(seed.name ?? "")));
  const filtered = useMemo(
    () =>
      strategies.filter((strategy) => {
        const matchesQuery = [strategy.name, strategy.symbol, ...(strategy.tags ?? [])].join(" ").toLowerCase().includes(query.toLowerCase());
        const isVariant = (strategy.tags ?? []).includes("agent-variant");
        return matchesQuery && (showVariants || !isVariant);
      }),
    [query, showVariants, strategies],
  );
  const summary = useMemo(
    () => ({
      total: strategies.length,
      pilots: strategies.filter((strategy) => (strategy.tags ?? []).includes("pilot")).length,
      champions: strategies.filter((strategy) => strategy.is_champion).length,
      variants: strategies.filter((strategy) => (strategy.tags ?? []).includes("agent-variant")).length,
    }),
    [strategies],
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
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-500">
                <p>{strategy.description}</p>
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
