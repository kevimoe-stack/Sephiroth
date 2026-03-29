import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BulkOperationsDialog } from "@/components/strategies/BulkOperationsDialog";
import { CreateStrategyDialog } from "@/components/strategies/CreateStrategyDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStrategies } from "@/hooks/use-trading-data";

export default function StrategiesPage() {
  const { data: strategies = [] } = useStrategies();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => strategies.filter((strategy) => [strategy.name, strategy.symbol, ...(strategy.tags ?? [])].join(" ").toLowerCase().includes(query.toLowerCase())),
    [query, strategies],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Strategien durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <CreateStrategyDialog />
        </div>
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
                  {strategy.is_champion && <Badge variant="success">Champion</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-500">
                <p>{strategy.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{strategy.status}</Badge>
                  {(strategy.tags ?? []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
