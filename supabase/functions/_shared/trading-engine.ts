interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

interface StrategyRow {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  description: string | null;
  parameters: Record<string, number> | null;
}

interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
}

interface Trade {
  direction: "long";
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  pnl_percent: number;
  fees: number;
  notes: string;
}

function inferStrategyKind(strategy: StrategyRow) {
  if (strategy.parameters?.entryModel === "trend-pullback") return "trend-pullback";
  const source = `${strategy.name} ${strategy.description ?? ""}`.toLowerCase();
  if (source.includes("pullback")) return "trend-pullback";
  if (source.includes("rsi")) return "rsi";
  if (source.includes("boll")) return "bollinger";
  if (source.includes("macd")) return "macd";
  return "ema";
}

function periodsPerYear(timeframe: string) {
  switch (timeframe) {
    case "1h":
      return 24 * 365;
    case "4h":
      return 6 * 365;
    case "1w":
      return 52;
    case "1d":
    default:
      return 365;
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
  );
}

function ema(values: number[], period: number) {
  const result = Array.from({ length: values.length }, () => Number.NaN);
  if (values.length < period) return result;
  const multiplier = 2 / (period + 1);
  let seed = 0;
  for (let index = 0; index < period; index += 1) {
    seed += values[index];
  }
  let previous = seed / period;
  result[period - 1] = previous;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result[index] = previous;
  }
  return result;
}

function sma(values: number[], period: number) {
  const result = Array.from({ length: values.length }, () => Number.NaN);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) result[index] = sum / period;
  }
  return result;
}

function stdDev(values: number[], period: number) {
  const result = Array.from({ length: values.length }, () => Number.NaN);
  for (let index = period - 1; index < values.length; index += 1) {
    const slice = values.slice(index - period + 1, index + 1);
    const mean = average(slice);
    result[index] = Math.sqrt(
      slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period,
    );
  }
  return result;
}

function rsi(values: number[], period: number) {
  const result = Array.from({ length: values.length }, () => Number.NaN);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function macd(values: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const line = values.map((_, index) =>
    Number.isNaN(fast[index]) || Number.isNaN(slow[index]) ? Number.NaN : fast[index] - slow[index],
  );
  const signal = ema(line.map((value) => (Number.isNaN(value) ? 0 : value)), signalPeriod);
  return { line, signal };
}

function bollinger(values: number[], period: number, multiplier: number) {
  const middle = sma(values, period);
  const deviationValues = stdDev(values, period);
  return {
    middle,
    upper: middle.map((basis, index) =>
      Number.isNaN(basis) || Number.isNaN(deviationValues[index]) ? Number.NaN : basis + deviationValues[index] * multiplier,
    ),
    lower: middle.map((basis, index) =>
      Number.isNaN(basis) || Number.isNaN(deviationValues[index]) ? Number.NaN : basis - deviationValues[index] * multiplier,
    ),
  };
}

function createSignals(strategy: StrategyRow, candles: Candle[]) {
  const params = strategy.parameters ?? {};
  const closes = candles.map((candle) => candle.close);
  const signals = Array.from({ length: candles.length }, () => 0);

  switch (inferStrategyKind(strategy)) {
    case "rsi": {
      const values = rsi(closes, Number(params.rsiPeriod ?? 14));
      const oversold = Number(params.oversold ?? 30);
      const exitLevel = Number(params.exitLevel ?? 55);
      for (let index = 1; index < candles.length; index += 1) {
        if (values[index - 1] >= oversold && values[index] < oversold) signals[index] = 1;
        if (values[index] >= exitLevel) signals[index] = -1;
      }
      return signals;
    }
    case "bollinger": {
      const period = Number(params.period ?? 20);
      const multiplier = Number(params.multiplier ?? 2);
      const bands = bollinger(closes, period, multiplier);
      for (let index = 1; index < candles.length; index += 1) {
        if (
          Number.isFinite(bands.upper[index]) &&
          closes[index - 1] <= bands.upper[index - 1] &&
          closes[index] > bands.upper[index]
        ) {
          signals[index] = 1;
        }
        if (Number.isFinite(bands.middle[index]) && closes[index] < bands.middle[index]) {
          signals[index] = -1;
        }
      }
      return signals;
    }
    case "macd": {
      const values = macd(
        closes,
        Number(params.fastPeriod ?? 12),
        Number(params.slowPeriod ?? 26),
        Number(params.signalPeriod ?? 9),
      );
      for (let index = 1; index < candles.length; index += 1) {
        if (
          Number.isFinite(values.line[index - 1]) &&
          Number.isFinite(values.signal[index - 1]) &&
          values.line[index - 1] <= values.signal[index - 1] &&
          values.line[index] > values.signal[index] &&
          values.line[index] > 0
        ) {
          signals[index] = 1;
        }
        if (
          Number.isFinite(values.line[index - 1]) &&
          Number.isFinite(values.signal[index - 1]) &&
          values.line[index - 1] >= values.signal[index - 1] &&
          values.line[index] < values.signal[index]
        ) {
          signals[index] = -1;
        }
      }
      return signals;
    }
    case "trend-pullback": {
      const fastPeriod = Number(params.fastEma ?? params.fast ?? 50);
      const slowPeriod = Number(params.slowEma ?? params.slow ?? 200);
      const trendPeriod = Number(params.trendFilterEma ?? 200);
      const rsiPeriodValue = Number(params.rsiPeriod ?? 14);
      const pullbackRsi = Number(params.pullbackRsi ?? 44);
      const recoveryRsi = Number(params.recoveryRsi ?? 52);
      const exitRsi = Number(params.exitRsi ?? 68);
      const fast = ema(closes, fastPeriod);
      const slow = ema(closes, slowPeriod);
      const trend = ema(closes, trendPeriod);
      const rsiValues = rsi(closes, rsiPeriodValue);

      for (let index = 1; index < candles.length; index += 1) {
        const trendUp =
          Number.isFinite(fast[index]) &&
          Number.isFinite(slow[index]) &&
          Number.isFinite(trend[index]) &&
          closes[index] > trend[index] &&
          fast[index] > slow[index];
        const recoveringPullback =
          Number.isFinite(rsiValues[index - 1]) &&
          Number.isFinite(rsiValues[index]) &&
          rsiValues[index - 1] <= pullbackRsi &&
          rsiValues[index] >= recoveryRsi;
        if (trendUp && recoveringPullback) {
          signals[index] = 1;
        }

        const trendBroken =
          Number.isFinite(fast[index]) &&
          Number.isFinite(trend[index]) &&
          (closes[index] < fast[index] || closes[index] < trend[index]);
        const momentumExhausted = Number.isFinite(rsiValues[index]) && rsiValues[index] >= exitRsi;
        if (trendBroken || momentumExhausted) {
          signals[index] = -1;
        }
      }
      return signals;
    }
    case "ema":
    default: {
      const fast = ema(closes, Number(params.fast ?? params.fastPeriod ?? 12));
      const slow = ema(closes, Number(params.slow ?? params.slowPeriod ?? 26));
      for (let index = 1; index < candles.length; index += 1) {
        if (
          Number.isFinite(fast[index - 1]) &&
          Number.isFinite(slow[index - 1]) &&
          fast[index - 1] <= slow[index - 1] &&
          fast[index] > slow[index]
        ) {
          signals[index] = 1;
        }
        if (
          Number.isFinite(fast[index - 1]) &&
          Number.isFinite(slow[index - 1]) &&
          fast[index - 1] >= slow[index - 1] &&
          fast[index] < slow[index]
        ) {
          signals[index] = -1;
        }
      }
      return signals;
    }
  }
}

async function fetchCandles(symbol: string, timeframe: string, startDate: string, endDate: string) {
  const startTime = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTime = new Date(`${endDate}T23:59:59Z`).getTime();
  const candles: Candle[] = [];
  let cursor = startTime;

  while (cursor < endTime) {
    const query = new URLSearchParams({
      symbol,
      interval: timeframe,
      startTime: String(cursor),
      endTime: String(endTime),
      limit: "1000",
    });
    const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Binance request failed with ${response.status}`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) break;
    const batch = payload.map((entry: Array<string | number>) => ({
      openTime: Number(entry[0]),
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
      volume: Number(entry[5]),
      closeTime: Number(entry[6]),
    }));
    candles.push(...batch);
    cursor = batch[batch.length - 1].closeTime + 1;
    if (batch.length < 1000) break;
  }

  if (candles.length === 0) {
    throw new Error("No candle data returned for selected range.");
  }

  return candles;
}

export async function runBacktestEngine(strategy: StrategyRow, config: BacktestConfig) {
  const candles = await fetchCandles(strategy.symbol, strategy.timeframe, config.startDate, config.endDate);
  const signals = createSignals(strategy, candles);
  const trades: Trade[] = [];
  const equityCurve: { date: string; value: number }[] = [];
  const monthlyReturns = new Map<string, number>();

  let cash = config.initialCapital;
  let quantity = 0;
  let entryPrice = 0;
  let entryCapital = 0;
  let entryIndex = -1;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const signal = signals[index];
    const markPrice = candle.close;

    if (signal === 1 && quantity === 0) {
      const executionPrice = markPrice * (1 + config.slippageRate);
      const fee = cash * config.feeRate;
      const tradableCash = cash - fee;
      quantity = tradableCash / executionPrice;
      entryPrice = executionPrice;
      entryCapital = tradableCash;
      entryIndex = index;
      cash = 0;
    } else if (signal === -1 && quantity > 0) {
      const executionPrice = markPrice * (1 - config.slippageRate);
      const grossValue = quantity * executionPrice;
      const fee = grossValue * config.feeRate;
      cash = grossValue - fee;
      trades.push({
        direction: "long",
        entry_date: new Date(candles[entryIndex].openTime).toISOString(),
        exit_date: new Date(candle.closeTime).toISOString(),
        entry_price: entryPrice,
        exit_price: executionPrice,
        quantity,
        pnl: cash - entryCapital,
        pnl_percent: ((executionPrice / entryPrice) - 1) * 100,
        fees: fee,
        notes: `bars-held:${index - entryIndex}`,
      });
      quantity = 0;
      entryPrice = 0;
      entryCapital = 0;
      entryIndex = -1;
    }

    const equity = quantity > 0 ? quantity * markPrice : cash;
    const date = new Date(candle.closeTime).toISOString().slice(0, 10);
    equityCurve.push({ date, value: Number(equity.toFixed(2)) });
    const monthKey = date.slice(0, 7);
    const monthStart = monthlyReturns.get(monthKey);
    if (monthStart === undefined) monthlyReturns.set(monthKey, equity);
    else monthlyReturns.set(monthKey, monthStart);
  }

  if (quantity > 0) {
    const last = candles[candles.length - 1];
    const grossValue = quantity * last.close;
    const fee = grossValue * config.feeRate;
    cash = grossValue - fee;
    trades.push({
      direction: "long",
      entry_date: new Date(candles[entryIndex].openTime).toISOString(),
      exit_date: new Date(last.closeTime).toISOString(),
      entry_price: entryPrice,
      exit_price: last.close,
      quantity,
      pnl: cash - entryCapital,
      pnl_percent: ((last.close / entryPrice) - 1) * 100,
      fees: fee,
      notes: `bars-held:${candles.length - 1 - entryIndex}`,
    });
  }

  const finalCapital = cash || equityCurve[equityCurve.length - 1]?.value || config.initialCapital;
  const totalReturn = ((finalCapital / config.initialCapital) - 1) * 100;
  const years = Math.max(candles.length / periodsPerYear(strategy.timeframe), 1 / periodsPerYear(strategy.timeframe));
  const cagr = (Math.pow(finalCapital / config.initialCapital, 1 / years) - 1) * 100;
  const returns = equityCurve
    .slice(1)
    .map((point, index) => point.value / equityCurve[index].value - 1)
    .filter((value) => Number.isFinite(value));
  const downside = returns.filter((value) => value < 0);
  const sharpe =
    returns.length > 1 && deviation(returns) > 0
      ? (average(returns) / deviation(returns)) * Math.sqrt(periodsPerYear(strategy.timeframe))
      : 0;
  const sortino =
    downside.length > 1 && deviation(downside) > 0
      ? (average(returns) / deviation(downside)) * Math.sqrt(periodsPerYear(strategy.timeframe))
      : 0;

  let peak = equityCurve[0]?.value ?? config.initialCapital;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.value);
    maxDrawdown = Math.min(maxDrawdown, ((point.value - peak) / peak) * 100);
  }

  const winningTrades = trades.filter((trade) => trade.pnl > 0);
  const losingTrades = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
  const avgBarsHeld =
    trades.length === 0
      ? 0
      : average(
          trades.map((trade) => {
            const notesValue = trade.notes.replace("bars-held:", "");
            return Number(notesValue);
          }),
        );

  const monthlyReturnsObject = Object.fromEntries(
    Array.from(monthlyReturns.keys()).map((key) => {
      const points = equityCurve.filter((point) => point.date.startsWith(key));
      if (points.length < 2) return [key, 0];
      return [key, Number((((points[points.length - 1].value / points[0].value) - 1) * 100).toFixed(2))];
    }),
  );

  return {
    metrics: {
      start_date: config.startDate,
      end_date: config.endDate,
      initial_capital: config.initialCapital,
      final_capital: Number(finalCapital.toFixed(2)),
      total_return: Number(totalReturn.toFixed(2)),
      cagr: Number(cagr.toFixed(2)),
      sharpe_ratio: Number(sharpe.toFixed(2)),
      sortino_ratio: Number(sortino.toFixed(2)),
      max_drawdown: Number(maxDrawdown.toFixed(2)),
      win_rate: trades.length === 0 ? 0 : Number(((winningTrades.length / trades.length) * 100).toFixed(2)),
      profit_factor: grossLoss === 0 ? Number(grossProfit.toFixed(2)) : Number((grossProfit / grossLoss).toFixed(2)),
      total_trades: trades.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      avg_trade_duration: `${avgBarsHeld.toFixed(1)} bars`,
      equity_curve: equityCurve,
      monthly_returns: monthlyReturnsObject,
    },
    candles,
    trades,
  };
}

export async function runWalkForwardEngine(
  strategy: StrategyRow,
  config: BacktestConfig & { windows?: number },
) {
  const candles = await fetchCandles(strategy.symbol, strategy.timeframe, config.startDate, config.endDate);
  const windowCount = Math.max(2, Math.min(config.windows ?? 4, 8));
  const sliceLength = Math.floor(candles.length / windowCount);
  const results = [];

  for (let index = 0; index < windowCount - 1; index += 1) {
    const inSample = candles.slice(index * sliceLength, index * sliceLength + sliceLength);
    const outOfSample = candles.slice(index * sliceLength + sliceLength, index * sliceLength + sliceLength * 2);
    if (inSample.length < 50 || outOfSample.length < 25) continue;

    const candidates =
      inferStrategyKind(strategy) === "trend-pullback"
        ? [
            { fastEma: 34, slowEma: 144, trendFilterEma: 144, rsiPeriod: 12, pullbackRsi: 46, recoveryRsi: 54, exitRsi: 66 },
            { fastEma: 50, slowEma: 200, trendFilterEma: 200, rsiPeriod: 14, pullbackRsi: 44, recoveryRsi: 52, exitRsi: 68 },
            { fastEma: 55, slowEma: 233, trendFilterEma: 200, rsiPeriod: 14, pullbackRsi: 42, recoveryRsi: 50, exitRsi: 64 },
          ]
        : inferStrategyKind(strategy) === "ema"
        ? [{ fast: 8, slow: 21 }, { fast: 12, slow: 26 }, { fast: 21, slow: 55 }]
        : inferStrategyKind(strategy) === "rsi"
          ? [{ rsiPeriod: 10, oversold: 25, exitLevel: 52 }, { rsiPeriod: 14, oversold: 30, exitLevel: 55 }, { rsiPeriod: 21, oversold: 35, exitLevel: 58 }]
          : inferStrategyKind(strategy) === "bollinger"
            ? [{ period: 20, multiplier: 2 }, { period: 30, multiplier: 2 }, { period: 20, multiplier: 2.5 }]
            : [{ fastPeriod: 8, slowPeriod: 21, signalPeriod: 5 }, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, { fastPeriod: 16, slowPeriod: 34, signalPeriod: 9 }];

    let bestCandidate = strategy.parameters ?? {};
    let bestInSample;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const candidate of candidates) {
      const result = await runBacktestEngine(
        { ...strategy, parameters: { ...(strategy.parameters ?? {}), ...candidate } },
        {
          startDate: new Date(inSample[0].openTime).toISOString().slice(0, 10),
          endDate: new Date(inSample[inSample.length - 1].closeTime).toISOString().slice(0, 10),
          initialCapital: config.initialCapital,
          feeRate: config.feeRate,
          slippageRate: config.slippageRate,
        },
      );
      const score =
        result.metrics.sharpe_ratio -
        Math.abs(result.metrics.max_drawdown) * 0.1 +
        result.metrics.total_return * 0.03;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { ...(strategy.parameters ?? {}), ...candidate };
        bestInSample = result.metrics;
      }
    }

    if (!bestInSample) continue;

    const outResult = await runBacktestEngine(
      { ...strategy, parameters: bestCandidate },
      {
        startDate: new Date(outOfSample[0].openTime).toISOString().slice(0, 10),
        endDate: new Date(outOfSample[outOfSample.length - 1].closeTime).toISOString().slice(0, 10),
        initialCapital: config.initialCapital,
        feeRate: config.feeRate,
        slippageRate: config.slippageRate,
      },
    );

    const efficiencyRatio =
      bestInSample.sharpe_ratio === 0 ? 0 : Number((outResult.metrics.sharpe_ratio / bestInSample.sharpe_ratio).toFixed(2));

    results.push({
      window_number: index + 1,
      in_sample_start: new Date(inSample[0].openTime).toISOString().slice(0, 10),
      in_sample_end: new Date(inSample[inSample.length - 1].closeTime).toISOString().slice(0, 10),
      out_of_sample_start: new Date(outOfSample[0].openTime).toISOString().slice(0, 10),
      out_of_sample_end: new Date(outOfSample[outOfSample.length - 1].closeTime).toISOString().slice(0, 10),
      in_sample_sharpe: bestInSample.sharpe_ratio,
      in_sample_return: bestInSample.total_return,
      in_sample_max_dd: bestInSample.max_drawdown,
      out_of_sample_sharpe: outResult.metrics.sharpe_ratio,
      out_of_sample_return: outResult.metrics.total_return,
      out_of_sample_max_dd: outResult.metrics.max_drawdown,
      efficiency_ratio: efficiencyRatio,
      optimized_params: bestCandidate,
      passed:
        efficiencyRatio > 0.45 &&
        outResult.metrics.sharpe_ratio > 0 &&
        outResult.metrics.total_return > 0 &&
        Math.abs(outResult.metrics.max_drawdown) <= 20 &&
        outResult.metrics.total_trades >= 3,
    });
  }

  return results;
}
