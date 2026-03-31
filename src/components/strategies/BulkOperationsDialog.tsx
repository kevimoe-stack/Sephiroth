import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useStrategies, useUpdateStrategy, useWalkforwardResults } from "@/hooks/use-trading-data";
import { getPilotComparison, getPilotRole } from "@/lib/analytics";

function isOlderThan(timestamp: string | null | undefined, hours: number) {
  const parsed = Date.parse(String(timestamp ?? ""));
  if (Number.isNaN(parsed)) return true;
  return Date.now() - parsed > hours * 60 * 60 * 1000;
}

function getParentStrategyId(strategy: { parameters?: Record<string, unknown> | null; id: string }) {
  const parameters = strategy.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return strategy.id;
  const parentStrategyId = parameters.parentStrategyId;
  return typeof parentStrategyId === "string" && parentStrategyId.length > 0 ? parentStrategyId : strategy.id;
}

function shouldArchive(
  strategy: { status: string; tags: string[] | null; created_at?: string | null; updated_at?: string | null; parameters?: Record<string, unknown> | null; id: string },
  parentPilotRole: string | null,
) {
  const tags = strategy.tags ?? [];
  if (strategy.status === "archived") return false;
  if (!tags.includes("agent-variant")) return false;
  if (tags.includes("execution-watchlist") || tags.includes("preferred-for-tournament") || tags.includes("candidate-ready") || tags.includes("validation-pending")) return false;
  const staleEnough = isOlderThan(strategy.updated_at ?? strategy.created_at, 18);
  if (!staleEnough) return false;
  if (parentPilotRole === "comparison") return true;
  return tags.includes("retired-variant") || tags.includes("needs-improvement");
}

export function BulkOperationsDialog() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const updateStrategy = useUpdateStrategy();
  const pilotComparison = getPilotComparison(strategies, backtests, walkforward);
  const archiveCandidates = strategies.filter((strategy) =>
    shouldArchive(strategy, getPilotRole(getParentStrategyId(strategy), pilotComparison)),
  );
  const comparisonArchiveCandidates = archiveCandidates.filter((strategy) =>
    getPilotRole(getParentStrategyId(strategy), pilotComparison) === "comparison",
  ).length;
  const focusArchiveCandidates = archiveCandidates.length - comparisonArchiveCandidates;

  const handleArchiveWeakVariants = async () => {
    if (archiveCandidates.length === 0) {
      toast.message("Keine schwachen Varianten zum Archivieren gefunden.");
      return;
    }

    try {
      for (const strategy of archiveCandidates) {
        const nextTags = Array.from(new Set([...(strategy.tags ?? []), "archived-variant"]));
        await updateStrategy.mutateAsync({
          id: strategy.id,
          status: "archived",
          tags: nextTags,
        });
      }
      toast.success(`${archiveCandidates.length} schwache Varianten archiviert.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archivieren fehlgeschlagen.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk-Operationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-500">
        <p>
          Aufraeumen statt Loeschen: schwache, nicht priorisierte Agent-Varianten koennen gesammelt ins Archiv wandern und
          verschwinden damit aus Listen, Queue und Turnier-Auswahl.
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span>{archiveCandidates.length} Archivkandidaten</span>
          <span>{focusArchiveCandidates} Fokusspur</span>
          <span>{comparisonArchiveCandidates} Vergleichsspur</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void handleArchiveWeakVariants()} disabled={updateStrategy.isPending}>
            {updateStrategy.isPending ? "Archiviere..." : `Schwache Varianten archivieren (${archiveCandidates.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
