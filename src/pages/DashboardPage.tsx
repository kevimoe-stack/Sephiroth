import { Activity, Crown, Percent, Sigma } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StrategyRankingTable } from "@/components/dashboard/StrategyRankingTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBacktests, useLiveOrders, useLivePortfolios, usePaperPortfolios, useRiskRules, useStrategies, useWalkforwardResults } from "@/hooks/use-trading-data";
import { buildTournamentBoard } from "@/lib/tournament";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function DashboardPage() {
  const { data: strategies = [] } = useStrategies();
  const { data: backtests = [] } = useBacktests();
  const { data: walkforward = [] } = useWalkforwardResults();
  const { data: paperPortfolios = [] } = usePaperPortfolios();
  const { data: livePortfolios = [] } = useLivePortfolios();
  const { data: liveOrders = [] } = useLiveOrders();
  const { data: riskRules = [] } = useRiskRules();
  const tournament = buildTournamentBoard(strategies, backtests, walkforward, riskRules, paperPortfolios, livePortfolios, liveOrders);
  const champion = tournament.champion?.strategy ?? strategies.find((strategy) => strategy.is_champion);
  const championBacktest = tournament.champion?.backtest ?? backtests.find((backtest) => backtest.strategy_id === champion?.id);
  const bestSharpe = Math.max(...backtests.map((backtest) => backtest.sharpe_ratio ?? 0), 0);
  const avgDrawdown = backtests.length ? backtests.reduce((sum, item) => sum + (item.max_drawdown ?? 0), 0) / backtests.length : 0;
  const assetCounts = strategies.reduce<Record<string, number>>((acc, strategy) => {
    acc[strategy.asset_class] = (acc[strategy.asset_class] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Strategien" value={String(strategies.length)} subtitle="Aktive und Draft-Strategien" icon={Sigma} />
        <KpiCard title="Bester Sharpe" value={formatNumber(bestSharpe)} subtitle="Ueber alle Backtests" icon={Activity} />
        <KpiCard title="Avg Max Drawdown" value={formatPercent(avgDrawdown)} subtitle="Gefiltert ohne eliminierte Strategien" icon={Percent} />
        <KpiCard title="Champion" value={champion?.name ?? "-"} subtitle={champion ? `Fitness ${formatNumber(tournament.champion?.fitnessScore ?? 0)}` : "Noch nicht gesetzt"} icon={Crown} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Champion Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={championBacktest?.equity_curve ?? []}>
                <defs>
                  <linearGradient id="equity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#equity)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Kernel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="font-medium">Qualified Agents</p>
              <p className="mt-1 text-sm text-slate-500">{tournament.rows.filter((row) => row.passedKernel).length} von {tournament.rows.length}</p>
            </div>
            <div className="rounded-xl bg-muted px-4 py-3">
              <p className="font-medium">Global Max Daily Loss</p>
              <p className="mt-1 text-sm text-slate-500">{formatPercent((tournament.globalRiskRule?.max_daily_loss ?? 0.05) * 100)}</p>
            </div>
            {Object.entries(assetCounts).map(([assetClass, count]) => (
              <div key={assetClass} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                <span className="capitalize">{assetClass}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <StrategyRankingTable
        strategies={strategies}
        backtests={backtests}
        walkforward={walkforward}
        riskRules={riskRules}
        paperPortfolios={paperPortfolios}
        livePortfolios={livePortfolios}
        liveOrders={liveOrders}
      />
    </div>
  );
}
