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

export function buildIchimokuReportStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT Ichimoku Cloud Crossover Report Test",
    symbol: "BTCUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Aus dem Sephiroth Strategy Report uebernommene Teststrategie: aggressiver Ichimoku-Crossover mit Tenkan 7 und Kijun 22. Fuer Sephiroth aktuell als long-only Testseed angelegt, um den Report-Ansatz reproduzierbar im System zu validieren.",
    parameters: {
      entryModel: "ichimoku",
      tenkanPeriod: 7,
      kijunPeriod: 22,
      stopLossPercent: 2.2,
      takeProfitPercent: 5.5,
      trailingStopPercent: 1.8,
      minHoldBars: 2,
    },
    tags: ["report-import", "report-test", "ichimoku", "candidate-seed"],
  };
}

export function buildAtrBreakoutReportStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT ATR Breakout Report Test",
    symbol: "BTCUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Aus dem Sephiroth Strategy Report uebernommene Teststrategie: trendfolgender ATR-Breakout auf 1h. Dient als reproduzierbarer Systemseed fuer volatilitaetsbasierte Trendausbrueche.",
    parameters: {
      entryModel: "atr-breakout",
      atrPeriod: 14,
      breakoutLookback: 20,
      breakoutAtrMultiple: 0.35,
      exitEma: 34,
      stopLossPercent: 2.0,
      takeProfitPercent: 6.2,
      trailingStopPercent: 2.4,
      minHoldBars: 2,
    },
    tags: ["report-import", "report-test", "atr-breakout", "candidate-seed", "trend-following"],
  };
}

export function buildMeanReversionBbReportStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT Mean Reversion BB Report Test",
    symbol: "BTCUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Aus dem Sephiroth Strategy Report uebernommene Teststrategie: Bollinger-basierte Mean-Reversion. Sie wird bewusst als Testseed importiert, obwohl der Report den Ansatz im Trendmarkt kritisch bewertet.",
    parameters: {
      entryModel: "mean-reversion-bb",
      period: 20,
      multiplier: 2,
      exitBasis: "middle",
      stopLossPercent: 2.4,
      takeProfitPercent: 3.4,
      minHoldBars: 1,
    },
    tags: ["report-import", "report-test", "bollinger", "mean-reversion", "candidate-seed"],
  };
}

export function buildCciWilliamsReportStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT CCI Williams Report Test",
    symbol: "BTCUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Aus dem Sephiroth Strategy Report uebernommene Teststrategie: kombinierter CCI- und Williams-%R-Reversal-Ansatz fuer 1h. Importiert als reproduzierbarer Testseed fuer oscillator-basierte Reversals.",
    parameters: {
      entryModel: "cci-williams",
      cciPeriod: 20,
      williamsPeriod: 14,
      entryCci: -100,
      exitCci: 80,
      entryWilliams: -80,
      exitWilliams: -20,
      stopLossPercent: 2.1,
      takeProfitPercent: 4.1,
      minHoldBars: 1,
    },
    tags: ["report-import", "report-test", "cci", "williams", "candidate-seed", "oscillator"],
  };
}

export function buildStochRsiReportStrategySeed(): Partial<Strategy> {
  return {
    name: "BTCUSDT Stoch RSI Report Test",
    symbol: "BTCUSDT",
    timeframe: "1h",
    asset_class: "crypto",
    status: "draft",
    is_champion: false,
    description:
      "Aus dem Sephiroth Strategy Report uebernommene Teststrategie: Stochastic-RSI-Reversal auf 1h. Im Report kritisch gesehen, hier aber als systematischer Testseed uebernommen.",
    parameters: {
      entryModel: "stoch-rsi",
      rsiPeriod: 14,
      stochPeriod: 14,
      smoothK: 3,
      smoothD: 3,
      oversold: 20,
      overbought: 80,
      stopLossPercent: 2.0,
      takeProfitPercent: 3.8,
      minHoldBars: 1,
    },
    tags: ["report-import", "report-test", "stoch-rsi", "candidate-seed", "oscillator"],
  };
}

export function buildReportStrategySeeds() {
  return [
    buildIchimokuReportStrategySeed(),
    buildAtrBreakoutReportStrategySeed(),
    buildMeanReversionBbReportStrategySeed(),
    buildCciWilliamsReportStrategySeed(),
    buildStochRsiReportStrategySeed(),
  ];
}
