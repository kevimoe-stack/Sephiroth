import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktests, useStrategies } from "@/hooks/use-trading-data";
import { formatNumber, formatPercent } from "@/lib/utils";

export default function BacktestsPage() {
  const { data: backtests = [] } = useBacktests();
  const { data: strategies = [] } = useStrategies();
  const rows = useMemo(() => backtests.map((backtest) => ({ backtest, strategy: strategies.find((strategy) => strategy.id === backtest.strategy_id) })).filter((row) => row.strategy), [backtests, strategies]);

  return (
    <Card>
      <CardHeader><CardTitle>Alle Backtests</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategie</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Max DD</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ backtest, strategy }) => (
                <TableRow key={backtest.id}>
                  <TableCell>{strategy?.name}</TableCell>
                  <TableCell>{backtest.start_date} → {backtest.end_date}</TableCell>
                  <TableCell>{formatPercent(backtest.total_return)}</TableCell>
                  <TableCell>{formatNumber(backtest.sharpe_ratio)}</TableCell>
                  <TableCell>{formatPercent(backtest.max_drawdown)}</TableCell>
                  <TableCell>{formatPercent(backtest.win_rate)}</TableCell>
                  <TableCell><Badge variant="secondary">{backtest.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
