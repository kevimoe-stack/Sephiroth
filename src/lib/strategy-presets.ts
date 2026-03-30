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
      "Pilotstrategie fuer Sephiroth: trendfolgender Pullback-Ansatz auf BTCUSDT 4h mit engerem EMA-Regimefilter, kontrolliertem RSI-Reset und konservativerem Risiko-Rahmen. Ziel ist nicht maximaler Trade-Output, sondern saubere Walk-Forward-Stabilitaet, kontrollierter Drawdown und bessere Eignung fuer Paper-, Dry-Run- und Testnet-Pfade.",
    parameters: {
      entryModel: "trend-pullback",
      fastEma: 34,
      slowEma: 144,
      trendFilterEma: 200,
      rsiPeriod: 12,
      pullbackRsi: 41,
      recoveryRsi: 54,
      atrPeriod: 14,
      atrFilter: 0.9,
      stopLossPercent: 1.6,
      takeProfitPercent: 5.8,
      trailingStopPercent: 2.2,
      minHoldBars: 3,
      confirmationBars: 3,
      maxPullbackPercent: 2.4,
      regimeBias: "trend-only",
      volumeFilter: false,
    },
    tags: ["pilot", "candidate-seed", "trend-pullback", "regime-aware", "risk-first", "testnet-target"],
  };
}

export function buildMacdPilotStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT MACD Regime Continuation Pilot",
    symbol: "BTCUSDT",
    timeframe: "4h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Zweiter Pilot fuer Sephiroth: MACD-basierte Trendfortsetzung auf BTCUSDT 4h mit Histogramm-Bestaetigung, engerem Trendfilter und selektiveren Long-Einstiegen. Diese Linie dient als Vergleich zu Pullback-Ansaetzen und soll pruefen, ob saubere Trendfortsetzung auf 4h robuster in Backtest und Walk-Forward ist.",
    parameters: {
      fastPeriod: 12,
      slowPeriod: 35,
      signalPeriod: 9,
      confirmationEma: 200,
      minHistogramPercent: 0.035,
      stopLossPercent: 2.2,
      takeProfitPercent: 6.4,
      trailingStopPercent: 2.5,
      confirmationBars: 3,
      minHoldBars: 4,
      exitOnTrendLoss: true,
      regimeBias: "trend-continuation",
    },
    tags: ["pilot", "candidate-seed", "macd", "trend-continuation", "regime-aware", "testnet-target"],
  };
}

export function buildPilotStrategySeeds() {
  return [buildPilotStrategySeed(), buildMacdPilotStrategySeed()];
}
