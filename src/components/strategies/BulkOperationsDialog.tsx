import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BulkOperationsDialog() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk-Operationen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-500">
        <p>Vorbereitet für Varianten-Erstellung, Bulk-Status-Updates und spätere Agent-Workflows.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Varianten erzeugen</Button>
          <Button variant="outline">Status aktualisieren</Button>
          <Button variant="outline">Tags ergänzen</Button>
        </div>
      </CardContent>
    </Card>
  );
}
