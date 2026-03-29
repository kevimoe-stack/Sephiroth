import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaperPortfolios, usePaperTradeAction, useStrategies } from "@/hooks/use-trading-data";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function PaperTradingPage() {
  const { data: portfolios = [] } = usePaperPortfolios();
  const { data: strategies = [] } = useStrategies();
  const paperAction = usePaperTradeAction();
  const [strategyId, setStrategyId] = useState("");
  const active = portfolios.filter((portfolio) => portfolio.is_active);
  const inactive = portfolios.filter((portfolio) => !portfolio.is_active);
  const selectedStrategyId = strategyId || strategies[0]?.id || "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Paper Trading starten</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-500">
          <p>Strategien verfügbar: {strategies.length}</p>
          <div className="flex flex-wrap gap-3">
            <select
              className="min-w-[240px] rounded-xl border border-border bg-background px-3 py-2 text-foreground"
              value={selectedStrategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
              ))}
            </select>
            <Button onClick={() => paperAction.mutate({ action: "start", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || paperAction.isPending}>Start</Button>
            <Button variant="outline" onClick={() => paperAction.mutate({ action: "check", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || paperAction.isPending}>Signale prüfen</Button>
            <Button variant="destructive" onClick={() => paperAction.mutate({ action: "stop", strategyId: selectedStrategyId })} disabled={!selectedStrategyId || paperAction.isPending}>Stop</Button>
          </div>
          {paperAction.data?.signalType && (
            <div className="rounded-xl bg-muted p-4">
              <p className="font-medium text-foreground">Letztes Signal: {paperAction.data.signalType}</p>
              <p className="mt-1">Suggested Allocation: {(Number(paperAction.data.suggestedAllocation ?? 0) * 100).toFixed(2)}%</p>
            </div>
          )}
          {paperAction.error && <p className="text-red-500">{paperAction.error.message}</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Aktive Portfolios</TabsTrigger>
          <TabsTrigger value="inactive">Inaktive Portfolios</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4 grid gap-4 md:grid-cols-2">
          {active.map((portfolio) => (
            <Card key={portfolio.id}>
              <CardHeader><CardTitle>{strategies.find((item) => item.id === portfolio.strategy_id)?.name ?? portfolio.strategy_id}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-500">
                <p>Kapital: {formatCurrency(portfolio.current_capital)}</p>
                <p>PnL: {formatCurrency(portfolio.total_pnl)}</p>
                <p>Max DD: {formatPercent(portfolio.max_drawdown)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4 grid gap-4 md:grid-cols-2">
          {inactive.length === 0 ? <Card><CardContent className="pt-6 text-sm text-slate-500">Noch keine inaktiven Portfolios.</CardContent></Card> : null}
          {inactive.map((portfolio) => (
            <Card key={portfolio.id}>
              <CardHeader><CardTitle>{strategies.find((item) => item.id === portfolio.strategy_id)?.name ?? portfolio.strategy_id}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-500">
                <p>Kapital: {formatCurrency(portfolio.current_capital)}</p>
                <p>PnL: {formatCurrency(portfolio.total_pnl)}</p>
                <p>Max DD: {formatPercent(portfolio.max_drawdown)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
