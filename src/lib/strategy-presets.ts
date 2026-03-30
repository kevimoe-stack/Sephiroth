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

export function buildMacdPilotStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT MACD Regime Continuation Pilot",
    symbol: "BTCUSDT",
    timeframe: "4h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Zweiter Pilot fuer Sephiroth: MACD-basierte Trendfortsetzung auf BTCUSDT 4h mit schnellerer Reaktion als der Pullback-Seed, aber weiterhin mit Fokus auf regimekonforme Long-Trades. Diese Linie dient als Vergleich zu Pullback-Ansätzen und soll pruefen, ob saubere Trendfortsetzung auf 4h robuster in Backtest und Walk-Forward ist.",
    parameters: {
      fastPeriod: 8,
      slowPeriod: 21,
      signalPeriod: 5,
      confirmationEma: 100,
      stopLossPercent: 2.0,
      takeProfitPercent: 5.2,
      trailingStopPercent: 1.8,
      confirmationBars: 2,
      regimeBias: "trend-continuation",
    },
    tags: ["pilot", "candidate-seed", "macd", "trend-continuation", "regime-aware", "testnet-target"],
  };
}

export function buildPilotStrategySeeds() {
  return [buildPilotStrategySeed(), buildMacdPilotStrategySeed()];
}
