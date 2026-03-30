import type { Strategy } from "@/integrations/supabase/types";

export function buildPilotStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT Regime Trend Pullback Pilot",
    symbol: "BTCUSDT",
    timeframe: "4h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Pilotstrategie fuer Sephiroth: trendfolgender Pullback-Ansatz auf BTCUSDT 4h mit EMA-Regimefilter, RSI-Reset fuer Einstiege, ATR-basierter Volatilitaetskontrolle und engerem Risiko-Rahmen. Ziel ist nicht maximaler Trade-Output, sondern saubere Walk-Forward-Stabilitaet, kontrollierter Drawdown und bessere Eignung fuer Paper-, Dry-Run- und Testnet-Pfade.",
    parameters: {
      entryModel: "trend-pullback",
      fastEma: 50,
      slowEma: 200,
      trendFilterEma: 200,
      rsiPeriod: 14,
      pullbackRsi: 44,
      recoveryRsi: 52,
      atrPeriod: 14,
      atrFilter: 1.1,
      stopLossPercent: 1.8,
      takeProfitPercent: 4.8,
      trailingStopPercent: 1.6,
      minHoldBars: 2,
      confirmationBars: 2,
      regimeBias: "trend-only",
      volumeFilter: false,
    },
    tags: ["pilot", "candidate-seed", "trend-pullback", "regime-aware", "risk-first", "testnet-target"],
  };
}
