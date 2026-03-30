import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategies, useUpdateStrategy } from "@/hooks/use-trading-data";

function shouldArchive(strategy: { status: string; tags: string[] | null }) {
  const tags = strategy.tags ?? [];
  if (strategy.status === "archived") return false;
  if (!tags.includes("agent-variant")) return false;
  if (tags.includes("execution-watchlist") || tags.includes("preferred-for-tournament")) return false;
  return tags.includes("retired-variant") || tags.includes("needs-improvement");
}

export function BulkOperationsDialog() {
  const { data: strategies = [] } = useStrategies();
  const updateStrategy = useUpdateStrategy();
  const archiveCandidates = strategies.filter(shouldArchive);

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
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void handleArchiveWeakVariants()} disabled={updateStrategy.isPending}>
            {updateStrategy.isPending ? "Archiviere..." : `Schwache Varianten archivieren (${archiveCandidates.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
