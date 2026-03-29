import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/utils";
import { buildTournamentBoard } from "@/lib/tournament";
import type { Backtest, LiveOrder, LivePortfolio, PaperPortfolio, RiskRule, Strategy, WalkforwardResult } from "@/integrations/supabase/types";

export function StrategyRankingTable({
  strategies,
  backtests,
  walkforward = [],
  riskRules = [],
  paperPortfolios = [],
  livePortfolios = [],
  liveOrders = [],
}: {
  strategies: Strategy[];
  backtests: Backtest[];
  walkforward?: WalkforwardResult[];
  riskRules?: RiskRule[];
  paperPortfolios?: PaperPortfolio[];
  livePortfolios?: LivePortfolio[];
  liveOrders?: LiveOrder[];
}) {
  const navigate = useNavigate();
  const rows = useMemo(() => {
    return buildTournamentBoard(strategies, backtests, walkforward, riskRules, paperPortfolios, livePortfolios, liveOrders).rows;
  }, [backtests, riskRules, strategies, walkforward, paperPortfolios, livePortfolios, liveOrders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Tournament Ranking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategie</TableHead>
                <TableHead>Fitness</TableHead>
                <TableHead>Kernel</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Operational</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ strategy, backtest, fitnessScore, passedKernel, kernelReasons, healthScore, readinessScore }) => (
                <TableRow key={strategy.id} className="cursor-pointer" onClick={() => navigate(`/strategies/${strategy.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{strategy.name}</p>
                        <p className="text-xs text-slate-500">{strategy.symbol} | {strategy.timeframe}</p>
                      </div>
                      {strategy.is_champion && passedKernel && <Badge variant="success">Champion</Badge>}
                      {passedKernel && <Badge variant="secondary">Qualified</Badge>}
                      {!passedKernel && <Badge variant="warning">Watchlist</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{formatNumber(fitnessScore)}</TableCell>
                  <TableCell>
                    {passedKernel ? (
                      <Badge variant="success">Pass</Badge>
                    ) : (
                      <Badge variant="warning">{kernelReasons[0] ?? "Fail"}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatNumber(backtest?.sharpe_ratio)}</TableCell>
                  <TableCell>{formatNumber((healthScore + readinessScore) / 2)}</TableCell>
                  <TableCell>{formatPercent(backtest?.total_return)}</TableCell>
                  <TableCell>{formatPercent(backtest?.win_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
