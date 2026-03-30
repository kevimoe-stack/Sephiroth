import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBacktests, useStrategies } from "@/hooks/use-trading-data";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils";

export default function BacktestsPage() {
  const { data: backtests = [] } = useBacktests();
  const { data: strategies = [] } = useStrategies();
  const { rows, hiddenDuplicates } = useMemo(() => {
    const strategyMap = new Map(strategies.map((strategy) => [strategy.id, strategy]));
    const seen = new Set<string>();
    let duplicates = 0;

    const uniqueRows = backtests
      .map((backtest) => ({ backtest, strategy: strategyMap.get(backtest.strategy_id) }))
      .filter((row) => row.strategy)
      .filter((row) => {
        const signature = [
          row.backtest.strategy_id,
          row.backtest.start_date,
          row.backtest.end_date,
          row.backtest.total_return,
          row.backtest.sharpe_ratio,
          row.backtest.max_drawdown,
          row.backtest.win_rate,
          row.backtest.total_trades,
          row.backtest.status,
        ].join("|");

        if (seen.has(signature)) {
          duplicates += 1;
          return false;
        }
        seen.add(signature);
        return true;
      });

    return { rows: uniqueRows, hiddenDuplicates: duplicates };
  }, [backtests, strategies]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alle Backtests</CardTitle>
        <p className="text-sm text-slate-500">
          Standardmaessig werden identische Wiederholungsläufe zusammengefasst, damit echte Unterschiede besser sichtbar werden.
          {hiddenDuplicates > 0 ? ` ${hiddenDuplicates} Duplikate sind ausgeblendet.` : ""}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategie</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Max DD</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ backtest, strategy }) => (
                <TableRow key={backtest.id}>
                  <TableCell>{strategy?.name}</TableCell>
                  <TableCell>{formatDateTime(backtest.created_at)}</TableCell>
                  <TableCell>{backtest.start_date} ? {backtest.end_date}</TableCell>
                  <TableCell>{formatPercent(backtest.total_return)}</TableCell>
                  <TableCell>{formatNumber(backtest.sharpe_ratio)}</TableCell>
                  <TableCell>{formatPercent(backtest.max_drawdown)}</TableCell>
                  <TableCell>{formatNumber(backtest.total_trades, 0)}</TableCell>
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
