import type {
  Candle,
  IndicatorConfig,
  IndicatorPlot,
  IndicatorSeries,
  PivotLevels,
  PivotPointsResult,
  RatingLabel,
  SeriesPoint,
  SignalAction,
  TechnicalGroupSummary,
  TechnicalIndicatorSignal,
  TechnicalSummary,
} from '../types';

function extractCloses(input: readonly Candle[] | readonly number[]): number[] {
  if (input.length === 0) return [];
  if (typeof input[0] === 'number') {
    return input as number[];
  }
  return (input as readonly Candle[]).map((c) => c.close);
}

function toSeriesPoints(
  candles: readonly Candle[],
  values: readonly (number | null)[],
): SeriesPoint[] {
  const len = Math.min(candles.length, values.length);
  const out: SeriesPoint[] = new Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = { time: candles[i].time, value: values[i] };
  }
  return out;
}

/** Simple Moving Average (SMA) */
export function calculateSMA(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n < p) return result;

  let sum = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v !== null && Number.isFinite(v)) {
      sum += v;
      validCount++;
    }
    if (i >= p) {
      const old = values[i - p];
      if (old !== null && Number.isFinite(old)) {
        sum -= old;
        validCount--;
      }
    }
    if (i >= p - 1 && validCount === p) {
      result[i] = sum / p;
    }
  }

  return result;
}

/** Exponential Moving Average (EMA) — seeded with first valid SMA(period) */
export function calculateEMA(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n < p) return result;

  const alpha = 2 / (p + 1);
  let ema: number | null = null;

  // Find first window of `p` consecutive valid numbers to seed SMA
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (ema === null) {
      if (i >= p - 1) {
        let sum = 0;
        let ok = true;
        for (let j = i - p + 1; j <= i; j++) {
          const val = values[j];
          if (val === null || !Number.isFinite(val)) {
            ok = false;
            break;
          }
          sum += val;
        }
        if (ok) {
          ema = sum / p;
          result[i] = ema;
        }
      }
    } else if (v !== null && Number.isFinite(v)) {
      ema = alpha * v + (1 - alpha) * ema;
      result[i] = ema;
    } else {
      result[i] = null;
    }
  }

  return result;
}

/** Weighted Moving Average (WMA) */
export function calculateWMA(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n < p) return result;

  const weightSum = (p * (p + 1)) / 2;
  for (let i = p - 1; i < n; i++) {
    let weighted = 0;
    let ok = true;
    for (let j = 0; j < p; j++) {
      const val = values[i - p + 1 + j];
      if (val === null || !Number.isFinite(val)) {
        ok = false;
        break;
      }
      weighted += val * (j + 1);
    }
    if (ok) {
      result[i] = weighted / weightSum;
    }
  }

  return result;
}

/** Wilder's Moving Average (RMA) — used internally by RSI, ATR, ADX */
export function calculateRMA(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n < p) return result;

  const alpha = 1 / p;
  let rma: number | null = null;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (rma === null) {
      if (i >= p - 1) {
        let sum = 0;
        let ok = true;
        for (let j = i - p + 1; j <= i; j++) {
          const val = values[j];
          if (val === null || !Number.isFinite(val)) {
            ok = false;
            break;
          }
          sum += val;
        }
        if (ok) {
          rma = sum / p;
          result[i] = rma;
        }
      }
    } else if (v !== null && Number.isFinite(v)) {
      rma = alpha * v + (1 - alpha) * rma;
      result[i] = rma;
    }
  }

  return result;
}

/** Population Standard Deviation over rolling window (TradingView ta.stdev) */
export function calculateStdDev(
  values: readonly (number | null)[],
  period: number,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n < p) return result;

  const sma = calculateSMA(values, p);
  for (let i = p - 1; i < n; i++) {
    const mean = sma[i];
    if (mean === null) continue;
    let varianceSum = 0;
    let ok = true;
    for (let j = i - p + 1; j <= i; j++) {
      const val = values[j];
      if (val === null || !Number.isFinite(val)) {
        ok = false;
        break;
      }
      const diff = val - mean;
      varianceSum += diff * diff;
    }
    if (ok) {
      result[i] = Math.sqrt(varianceSum / p);
    }
  }

  return result;
}

export interface BollingerBandsResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

/** Bollinger Bands (SMA +/- mult * StdDev) */
export function calculateBollingerBands(
  input: readonly Candle[] | readonly number[],
  period = 20,
  multiplier = 2,
): BollingerBandsResult {
  const closes = extractCloses(input);
  const middle = calculateSMA(closes, period);
  const stdDev = calculateStdDev(closes, period);

  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = 0; i < closes.length; i++) {
    const m = middle[i];
    const sd = stdDev[i];
    if (m !== null && sd !== null) {
      upper[i] = m + multiplier * sd;
      lower[i] = m - multiplier * sd;
    }
  }

  return { upper, middle, lower };
}

/** Volume-Weighted Average Price (VWAP), resetting daily on intraday series */
export function calculateVWAP(candles: readonly Candle[]): (number | null)[] {
  const n = candles.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return result;

  const isIntraday = n >= 2 && candles[1].time - candles[0].time < 86400;
  let cumPV = 0;
  let cumVol = 0;
  let prevDay = -1;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const day = Math.floor(c.time / 86400);
    if (isIntraday && day !== prevDay) {
      cumPV = 0;
      cumVol = 0;
      prevDay = day;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = Math.max(0, c.volume);
    cumPV += typicalPrice * vol;
    cumVol += vol;
    result[i] = cumVol > 0 ? cumPV / cumVol : typicalPrice;
  }

  return result;
}

/** Relative Strength Index (RSI) using Wilder's smoothing (matches TradingView ta.rsi) */
export function calculateRSI(
  input: readonly Candle[] | readonly number[],
  period = 14,
): (number | null)[] {
  const closes = extractCloses(input);
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(period));
  if (n <= p) return result;

  const gains: (number | null)[] = new Array(n).fill(null);
  const losses: (number | null)[] = new Array(n).fill(null);

  for (let i = 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    gains[i] = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? -diff : 0;
  }

  const avgGain = calculateRMA(gains, p);
  const avgLoss = calculateRMA(losses, p);

  for (let i = p; i < n; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (g === null || l === null) continue;
    if (l === 0 && g === 0) {
      result[i] = 50;
    } else if (l === 0) {
      result[i] = 100;
    } else {
      const rs = g / l;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

/** Moving Average Convergence Divergence (MACD) */
export function calculateMACD(
  input: readonly Candle[] | readonly number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const closes = extractCloses(input);
  const n = closes.length;
  const fastEma = calculateEMA(closes, fastPeriod);
  const slowEma = calculateEMA(closes, slowPeriod);

  const macd: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      macd[i] = (fastEma[i] as number) - (slowEma[i] as number);
    }
  }

  const signal = calculateEMA(macd, signalPeriod);
  const histogram: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macd[i] !== null && signal[i] !== null) {
      histogram[i] = (macd[i] as number) - (signal[i] as number);
    }
  }

  return { macd, signal, histogram };
}

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

/** Stochastic Oscillator (%K smoothed, %D) */
export function calculateStochastic(
  candles: readonly Candle[],
  kPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): StochasticResult {
  const n = candles.length;
  const rawK: (number | null)[] = new Array(n).fill(null);
  const p = Math.max(1, Math.floor(kPeriod));

  for (let i = p - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (candles[j].high > highest) highest = candles[j].high;
      if (candles[j].low < lowest) lowest = candles[j].low;
    }
    const range = highest - lowest;
    rawK[i] = range > 0 ? ((candles[i].close - lowest) / range) * 100 : 50;
  }

  const k = kSmooth > 1 ? calculateSMA(rawK, kSmooth) : rawK;
  const d = calculateSMA(k, dSmooth);
  return { k, d };
}

/** True Range */
export function calculateTrueRange(candles: readonly Candle[]): number[] {
  const n = candles.length;
  const tr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    if (i === 0) {
      tr[i] = c.high - c.low;
    } else {
      const prevClose = candles[i - 1].close;
      tr[i] = Math.max(
        c.high - c.low,
        Math.abs(c.high - prevClose),
        Math.abs(c.low - prevClose),
      );
    }
  }
  return tr;
}

/** Average True Range (ATR) using Wilder's smoothing */
export function calculateATR(
  candles: readonly Candle[],
  period = 14,
): (number | null)[] {
  const tr = calculateTrueRange(candles);
  return calculateRMA(tr, period);
}

export interface SuperTrendResult {
  supertrend: (number | null)[];
  /** 1 = bullish uptrend (support below price), -1 = bearish downtrend (resistance above price) */
  direction: (1 | -1 | null)[];
  upperBand: (number | null)[];
  lowerBand: (number | null)[];
}

/** SuperTrend indicator */
export function calculateSuperTrend(
  candles: readonly Candle[],
  atrPeriod = 10,
  factor = 3,
): SuperTrendResult {
  const n = candles.length;
  const atr = calculateATR(candles, atrPeriod);
  const supertrend: (number | null)[] = new Array(n).fill(null);
  const direction: (1 | -1 | null)[] = new Array(n).fill(null);
  const upperBand: (number | null)[] = new Array(n).fill(null);
  const lowerBand: (number | null)[] = new Array(n).fill(null);

  let prevFinalUpper = 0;
  let prevFinalLower = 0;
  let prevDir: 1 | -1 = 1;
  let initialized = false;

  for (let i = 0; i < n; i++) {
    const a = atr[i];
    if (a === null) continue;
    const c = candles[i];
    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + factor * a;
    const basicLower = hl2 - factor * a;

    if (!initialized) {
      prevFinalUpper = basicUpper;
      prevFinalLower = basicLower;
      prevDir = c.close >= hl2 ? 1 : -1;
      initialized = true;
    } else {
      const prevClose = candles[i - 1].close;
      const finalUpper =
        basicUpper < prevFinalUpper || prevClose > prevFinalUpper
          ? basicUpper
          : prevFinalUpper;
      const finalLower =
        basicLower > prevFinalLower || prevClose < prevFinalLower
          ? basicLower
          : prevFinalLower;

      let dir: 1 | -1 = prevDir;
      if (prevDir === -1 && c.close > prevFinalUpper) {
        dir = 1;
      } else if (prevDir === 1 && c.close < prevFinalLower) {
        dir = -1;
      }

      prevFinalUpper = finalUpper;
      prevFinalLower = finalLower;
      prevDir = dir;
    }

    upperBand[i] = prevFinalUpper;
    lowerBand[i] = prevFinalLower;
    direction[i] = prevDir;
    supertrend[i] = prevDir === 1 ? prevFinalLower : prevFinalUpper;
  }

  return { supertrend, direction, upperBand, lowerBand };
}

export interface IchimokuResult {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

function midpointHighLow(
  candles: readonly Candle[],
  index: number,
  period: number,
): number | null {
  if (index < period - 1) return null;
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = index - period + 1; j <= index; j++) {
    if (candles[j].high > hi) hi = candles[j].high;
    if (candles[j].low < lo) lo = candles[j].low;
  }
  return (hi + lo) / 2;
}

/** Ichimoku Kinko Hyo (9, 26, 52, 26) */
export function calculateIchimoku(
  candles: readonly Candle[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52,
  displacement = 26,
): IchimokuResult {
  const n = candles.length;
  const tenkan: (number | null)[] = new Array(n).fill(null);
  const kijun: (number | null)[] = new Array(n).fill(null);
  const senkouA: (number | null)[] = new Array(n).fill(null);
  const senkouB: (number | null)[] = new Array(n).fill(null);
  const chikou: (number | null)[] = new Array(n).fill(null);

  const rawSpanA: (number | null)[] = new Array(n).fill(null);
  const rawSpanB: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    tenkan[i] = midpointHighLow(candles, i, tenkanPeriod);
    kijun[i] = midpointHighLow(candles, i, kijunPeriod);
    if (tenkan[i] !== null && kijun[i] !== null) {
      rawSpanA[i] = ((tenkan[i] as number) + (kijun[i] as number)) / 2;
    }
    rawSpanB[i] = midpointHighLow(candles, i, senkouBPeriod);
  }

  // Shift Senkou A & B forward by `displacement`, and Chikou backward by `displacement`
  const shift = Math.max(0, Math.floor(displacement));
  for (let i = 0; i < n; i++) {
    if (i - shift >= 0) {
      senkouA[i] = rawSpanA[i - shift];
      senkouB[i] = rawSpanB[i - shift];
    }
    if (i + shift < n) {
      chikou[i] = candles[i + shift].close;
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

/** Heikin-Ashi candle transform */
export function toHeikinAshi(candles: readonly Candle[]): Candle[] {
  const n = candles.length;
  if (n === 0) return [];
  const result: Candle[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen =
      i === 0
        ? (c.open + c.close) / 2
        : (result[i - 1].open + result[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    result[i] = {
      time: c.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: c.volume,
    };
  }

  return result;
}

/** Pivot Points (Classic, Fibonacci, Camarilla, Woodie, DeMark) from prior bar or OHLC */
export function calculatePivotPoints(
  candles: readonly Candle[],
): PivotPointsResult {
  const ref =
    candles.length >= 2
      ? candles[candles.length - 2]
      : candles[candles.length - 1] ?? {
          time: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
        };

  const { high: h, low: l, close: c, open: o } = ref;
  const range = h - l;

  // Classic
  const classicP = (h + l + c) / 3;
  const classic: PivotLevels = {
    p: classicP,
    r1: 2 * classicP - l,
    r2: classicP + range,
    r3: h + 2 * (classicP - l),
    s1: 2 * classicP - h,
    s2: classicP - range,
    s3: l - 2 * (h - classicP),
  };

  // Fibonacci
  const fibonacci: PivotLevels = {
    p: classicP,
    r1: classicP + 0.382 * range,
    r2: classicP + 0.618 * range,
    r3: classicP + 1.0 * range,
    s1: classicP - 0.382 * range,
    s2: classicP - 0.618 * range,
    s3: classicP - 1.0 * range,
  };

  // Camarilla
  const camarilla: PivotLevels = {
    p: classicP,
    r1: c + (range * 1.1) / 12,
    r2: c + (range * 1.1) / 6,
    r3: c + (range * 1.1) / 4,
    s1: c - (range * 1.1) / 12,
    s2: c - (range * 1.1) / 6,
    s3: c - (range * 1.1) / 4,
  };

  // Woodie
  const woodieP = (h + l + 2 * c) / 4;
  const woodie: PivotLevels = {
    p: woodieP,
    r1: 2 * woodieP - l,
    r2: woodieP + range,
    r3: h + 2 * (woodieP - l),
    s1: 2 * woodieP - h,
    s2: woodieP - range,
    s3: l - 2 * (h - woodieP),
  };

  // DeMark
  let x: number;
  if (c < o) {
    x = h + 2 * l + c;
  } else if (c > o) {
    x = 2 * h + l + c;
  } else {
    x = h + l + 2 * c;
  }
  const demark = {
    p: x / 4,
    r1: x / 2 - l,
    s1: x / 2 - h,
  };

  return { classic, fibonacci, camarilla, woodie, demark };
}

/** Commodity Channel Index (CCI) */
export function calculateCCI(
  candles: readonly Candle[],
  period = 20,
): (number | null)[] {
  const n = candles.length;
  const typical = candles.map((c) => (c.high + c.low + c.close) / 3);
  const sma = calculateSMA(typical, period);
  const result: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const m = sma[i];
    if (m === null) continue;
    let mad = 0;
    for (let j = i - period + 1; j <= i; j++) {
      mad += Math.abs(typical[j] - m);
    }
    mad /= period;
    result[i] = mad > 0 ? (typical[i] - m) / (0.015 * mad) : 0;
  }

  return result;
}

/** Williams %R */
export function calculateWilliamsR(
  candles: readonly Candle[],
  period = 14,
): (number | null)[] {
  const n = candles.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    const range = hi - lo;
    result[i] = range > 0 ? ((hi - candles[i].close) / range) * -100 : -50;
  }
  return result;
}

/** Momentum (close - close[period]) */
export function calculateMomentum(
  values: readonly number[],
  period = 10,
): (number | null)[] {
  const n = values.length;
  const result: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    result[i] = values[i] - values[i - period];
  }
  return result;
}

/** Average Directional Index (ADX) + DI+ / DI- */
export function calculateADX(
  candles: readonly Candle[],
  period = 14,
): {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
} {
  const n = candles.length;
  const tr = calculateTrueRange(candles);
  const plusDM: (number | null)[] = new Array(n).fill(0);
  const minusDM: (number | null)[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const smoothTR = calculateRMA(tr, period);
  const smoothPlusDM = calculateRMA(plusDM, period);
  const smoothMinusDM = calculateRMA(minusDM, period);

  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  const dx: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const str = smoothTR[i];
    const pdm = smoothPlusDM[i];
    const mdm = smoothMinusDM[i];
    if (str !== null && str > 0 && pdm !== null && mdm !== null) {
      const pdi = (100 * pdm) / str;
      const mdi = (100 * mdm) / str;
      plusDI[i] = pdi;
      minusDI[i] = mdi;
      const denom = pdi + mdi;
      dx[i] = denom > 0 ? (100 * Math.abs(pdi - mdi)) / denom : 0;
    }
  }

  const adx = calculateRMA(dx, period);
  return { adx, plusDI, minusDI };
}

/** Ultimate Oscillator (7, 14, 28) */
export function calculateUltimateOscillator(
  candles: readonly Candle[],
): (number | null)[] {
  const n = candles.length;
  const result: (number | null)[] = new Array(n).fill(null);
  if (n < 29) return result;

  const bp: number[] = new Array(n).fill(0);
  const tr: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close;
    const trueLow = Math.min(candles[i].low, prevClose);
    const trueHigh = Math.max(candles[i].high, prevClose);
    bp[i] = candles[i].close - trueLow;
    tr[i] = trueHigh - trueLow;
  }

  const sumSlice = (arr: number[], end: number, len: number): number => {
    let s = 0;
    for (let j = end - len + 1; j <= end; j++) s += arr[j];
    return s;
  };

  for (let i = 28; i < n; i++) {
    const tr7 = sumSlice(tr, i, 7);
    const tr14 = sumSlice(tr, i, 14);
    const tr28 = sumSlice(tr, i, 28);
    if (tr7 === 0 || tr14 === 0 || tr28 === 0) {
      result[i] = 50;
      continue;
    }
    const avg7 = sumSlice(bp, i, 7) / tr7;
    const avg14 = sumSlice(bp, i, 14) / tr14;
    const avg28 = sumSlice(bp, i, 28) / tr28;
    result[i] = (100 * (4 * avg7 + 2 * avg14 + avg28)) / 7;
  }

  return result;
}

/** Map normalized score in [-1, 1] to Italian TradingView rating label */
export function scoreToRatingLabel(score: number): RatingLabel {
  if (score <= -0.5) return 'Forte vendita';
  if (score < -0.1) return 'Vendita';
  if (score <= 0.1) return 'Neutrale';
  if (score < 0.5) return 'Acquisto';
  return 'Forte acquisto';
}

function summarizeSignals(
  signals: TechnicalIndicatorSignal[],
): TechnicalGroupSummary {
  let buyCount = 0;
  let neutralCount = 0;
  let sellCount = 0;

  for (const s of signals) {
    if (s.action === 'buy') buyCount++;
    else if (s.action === 'sell') sellCount++;
    else neutralCount++;
  }

  const total = signals.length;
  const score = total > 0 ? (buyCount - sellCount) / total : 0;

  return {
    rating: scoreToRatingLabel(score),
    score: Math.round(score * 1000) / 1000,
    buyCount,
    neutralCount,
    sellCount,
    signals,
  };
}

function lastOf<T>(arr: readonly (T | null)[]): T | null {
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function prevOf<T>(arr: readonly (T | null)[]): T | null {
  return arr.length > 1 ? arr[arr.length - 2] : null;
}

/**
 * TradingView-style Technical Rating Summary:
 * - Oscillatori (RSI 14, Stocastico %K, CCI 20, ADX 14, Momentum 10, MACD, Williams %R, Ultimate Oscillator, Bull/Bear Power)
 * - Medie Mobili (EMA/SMA 10, 20, 30, 50, 100, 200, VWAP, Ichimoku Base Line)
 * - Sommario aggregato + Pivot Points
 */
export function calculateTechnicalSummary(
  candles: readonly Candle[],
): TechnicalSummary {
  const pivots = calculatePivotPoints(candles);

  if (candles.length < 2) {
    const emptyGroup = summarizeSignals([]);
    return {
      oscillators: emptyGroup,
      movingAverages: emptyGroup,
      summary: {
        rating: 'Neutrale',
        score: 0,
        buyCount: 0,
        neutralCount: 0,
        sellCount: 0,
      },
      pivots,
    };
  }

  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];

  // --- Oscillators ---
  const rsi = calculateRSI(candles, 14);
  const rsiVal = lastOf(rsi);
  const rsiPrev = prevOf(rsi);
  let rsiAction: SignalAction = 'neutral';
  if (rsiVal !== null) {
    if (rsiVal < 30 && (rsiPrev === null || rsiVal > rsiPrev)) rsiAction = 'buy';
    else if (rsiVal > 70 && (rsiPrev === null || rsiVal < rsiPrev)) rsiAction = 'sell';
    else if (rsiVal < 35) rsiAction = 'buy';
    else if (rsiVal > 65) rsiAction = 'sell';
  }

  const stoch = calculateStochastic(candles, 14, 3, 3);
  const stochK = lastOf(stoch.k);
  const stochD = lastOf(stoch.d);
  let stochAction: SignalAction = 'neutral';
  if (stochK !== null && stochD !== null) {
    if (stochK < 20 && stochK > stochD) stochAction = 'buy';
    else if (stochK > 80 && stochK < stochD) stochAction = 'sell';
  }

  const cci = calculateCCI(candles, 20);
  const cciVal = lastOf(cci);
  const cciPrev = prevOf(cci);
  let cciAction: SignalAction = 'neutral';
  if (cciVal !== null) {
    if (cciVal < -100 && (cciPrev === null || cciVal > cciPrev)) cciAction = 'buy';
    else if (cciVal > 100 && (cciPrev === null || cciVal < cciPrev)) cciAction = 'sell';
  }

  const adxRes = calculateADX(candles, 14);
  const adxVal = lastOf(adxRes.adx);
  const pdiVal = lastOf(adxRes.plusDI);
  const mdiVal = lastOf(adxRes.minusDI);
  let adxAction: SignalAction = 'neutral';
  if (adxVal !== null && pdiVal !== null && mdiVal !== null && adxVal > 20) {
    if (pdiVal > mdiVal) adxAction = 'buy';
    else if (mdiVal > pdiVal) adxAction = 'sell';
  }

  const mom = calculateMomentum(closes, 10);
  const momVal = lastOf(mom);
  let momAction: SignalAction = 'neutral';
  if (momVal !== null) {
    if (momVal > 0) momAction = 'buy';
    else if (momVal < 0) momAction = 'sell';
  }

  const macdRes = calculateMACD(candles, 12, 26, 9);
  const macdVal = lastOf(macdRes.macd);
  const macdSig = lastOf(macdRes.signal);
  let macdAction: SignalAction = 'neutral';
  if (macdVal !== null && macdSig !== null) {
    if (macdVal > macdSig) macdAction = 'buy';
    else if (macdVal < macdSig) macdAction = 'sell';
  }

  const willR = calculateWilliamsR(candles, 14);
  const willVal = lastOf(willR);
  let willAction: SignalAction = 'neutral';
  if (willVal !== null) {
    if (willVal < -80) willAction = 'buy';
    else if (willVal > -20) willAction = 'sell';
  }

  const uo = calculateUltimateOscillator(candles);
  const uoVal = lastOf(uo);
  let uoAction: SignalAction = 'neutral';
  if (uoVal !== null) {
    if (uoVal > 70) uoAction = 'buy';
    else if (uoVal < 30) uoAction = 'sell';
  }

  const ema13 = calculateEMA(closes, 13);
  const ema13Last = lastOf(ema13);
  const lastCandle = candles[candles.length - 1];
  const bbpVal =
    ema13Last !== null
      ? lastCandle.high - ema13Last + (lastCandle.low - ema13Last)
      : null;
  let bbpAction: SignalAction = 'neutral';
  if (bbpVal !== null && ema13Last !== null) {
    const ema13Prev = prevOf(ema13);
    if (ema13Prev !== null && ema13Last > ema13Prev && bbpVal > 0) bbpAction = 'buy';
    else if (ema13Prev !== null && ema13Last < ema13Prev && bbpVal < 0) bbpAction = 'sell';
  }

  const oscillatorSignals: TechnicalIndicatorSignal[] = [
    { name: 'Indice di forza relativa (14)', value: rsiVal, action: rsiAction },
    { name: 'Stocastico %K (14, 3, 3)', value: stochK, action: stochAction },
    { name: 'Commodity Channel Index (20)', value: cciVal, action: cciAction },
    { name: 'Average Directional Index (14)', value: adxVal, action: adxAction },
    { name: 'Momentum (10)', value: momVal, action: momAction },
    { name: 'Livello MACD (12, 26)', value: macdVal, action: macdAction },
    { name: 'Williams Percent Range (14)', value: willVal, action: willAction },
    { name: 'Bull Bear Power (13)', value: bbpVal, action: bbpAction },
    { name: 'Ultimate Oscillator (7, 14, 28)', value: uoVal, action: uoAction },
  ];

  // --- Moving Averages ---
  const maPeriods = [10, 20, 30, 50, 100, 200] as const;
  const maSignals: TechnicalIndicatorSignal[] = [];

  for (const period of maPeriods) {
    const emaVal = lastOf(calculateEMA(closes, period));
    const smaVal = lastOf(calculateSMA(closes, period));

    maSignals.push({
      name: `Media mobile esponenziale (${period})`,
      value: emaVal,
      action:
        emaVal === null
          ? 'neutral'
          : lastClose > emaVal
            ? 'buy'
            : lastClose < emaVal
              ? 'sell'
              : 'neutral',
    });

    maSignals.push({
      name: `Media mobile semplice (${period})`,
      value: smaVal,
      action:
        smaVal === null
          ? 'neutral'
          : lastClose > smaVal
            ? 'buy'
            : lastClose < smaVal
              ? 'sell'
              : 'neutral',
    });
  }

  const vwapVal = lastOf(calculateVWAP(candles));
  maSignals.push({
    name: 'VWAP (Prezzo medio ponderato per volume)',
    value: vwapVal,
    action:
      vwapVal === null
        ? 'neutral'
        : lastClose > vwapVal
          ? 'buy'
          : lastClose < vwapVal
            ? 'sell'
            : 'neutral',
  });

  const ichi = calculateIchimoku(candles);
  const kijunVal = lastOf(ichi.kijun);
  maSignals.push({
    name: 'Ichimoku Base Line (9, 26, 52, 26)',
    value: kijunVal,
    action:
      kijunVal === null
        ? 'neutral'
        : lastClose > kijunVal
          ? 'buy'
          : lastClose < kijunVal
            ? 'sell'
            : 'neutral',
  });

  const oscillators = summarizeSignals(oscillatorSignals);
  const movingAverages = summarizeSignals(maSignals);

  const totalBuy = oscillators.buyCount + movingAverages.buyCount;
  const totalNeutral = oscillators.neutralCount + movingAverages.neutralCount;
  const totalSell = oscillators.sellCount + movingAverages.sellCount;
  const summaryScore = (oscillators.score + movingAverages.score) / 2;

  return {
    oscillators,
    movingAverages,
    summary: {
      rating: scoreToRatingLabel(summaryScore),
      score: Math.round(summaryScore * 1000) / 1000,
      buyCount: totalBuy,
      neutralCount: totalNeutral,
      sellCount: totalSell,
    },
    pivots,
  };
}

/** Pre-configured Italian indicator templates for the Indicators modal */
export const DEFAULT_INDICATOR_PRESETS: IndicatorConfig[] = [
  {
    id: 'preset-sma-20',
    type: 'SMA',
    name: 'Media Mobile Semplice (SMA)',
    shortName: 'SMA',
    visible: true,
    pane: 'overlay',
    params: { period: 20 },
    styles: { main: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' } },
  },
  {
    id: 'preset-ema-50',
    type: 'EMA',
    name: 'Media Mobile Esponenziale (EMA)',
    shortName: 'EMA',
    visible: true,
    pane: 'overlay',
    params: { period: 50 },
    styles: { main: { color: '#FF9800', lineWidth: 2, lineStyle: 'solid' } },
  },
  {
    id: 'preset-wma-20',
    type: 'WMA',
    name: 'Media Mobile Ponderata (WMA)',
    shortName: 'WMA',
    visible: true,
    pane: 'overlay',
    params: { period: 20 },
    styles: { main: { color: '#AB47BC', lineWidth: 2, lineStyle: 'solid' } },
  },
  {
    id: 'preset-bb',
    type: 'BB',
    name: 'Bande di Bollinger (BB)',
    shortName: 'BB',
    visible: true,
    pane: 'overlay',
    params: { period: 20, multiplier: 2 },
    styles: {
      upper: { color: '#2196F3', lineWidth: 1, lineStyle: 'solid' },
      middle: { color: '#FF6D00', lineWidth: 1, lineStyle: 'solid' },
      lower: { color: '#2196F3', lineWidth: 1, lineStyle: 'solid' },
    },
  },
  {
    id: 'preset-vwap',
    type: 'VWAP',
    name: 'VWAP',
    shortName: 'VWAP',
    visible: true,
    pane: 'overlay',
    params: {},
    styles: { main: { color: '#26C6DA', lineWidth: 2, lineStyle: 'solid' } },
  },
  {
    id: 'preset-supertrend',
    type: 'SUPERTREND',
    name: 'SuperTrend',
    shortName: 'ST',
    visible: true,
    pane: 'overlay',
    params: { period: 10, factor: 3 },
    styles: {
      up: { color: '#089981', lineWidth: 2, lineStyle: 'solid' },
      down: { color: '#F23645', lineWidth: 2, lineStyle: 'solid' },
    },
  },
  {
    id: 'preset-ichimoku',
    type: 'ICHIMOKU',
    name: 'Ichimoku Cloud',
    shortName: 'Ichimoku',
    visible: true,
    pane: 'overlay',
    params: { tenkan: 9, kijun: 26, senkouB: 52, displacement: 26 },
    styles: {
      tenkan: { color: '#2962FF', lineWidth: 1 },
      kijun: { color: '#B71C1C', lineWidth: 1 },
      senkouA: { color: '#089981', lineWidth: 1 },
      senkouB: { color: '#F23645', lineWidth: 1 },
      chikou: { color: '#43A047', lineWidth: 1 },
    },
  },
  {
    id: 'preset-pivot',
    type: 'PIVOT',
    name: 'Punti Pivot Standard',
    shortName: 'Pivot',
    visible: true,
    pane: 'overlay',
    params: {},
    styles: {
      p: { color: '#FF9800', lineWidth: 1, lineStyle: 'dashed' },
      r: { color: '#F23645', lineWidth: 1, lineStyle: 'dotted' },
      s: { color: '#089981', lineWidth: 1, lineStyle: 'dotted' },
    },
  },
  {
    id: 'preset-rsi',
    type: 'RSI',
    name: 'Indice di Forza Relativa (RSI)',
    shortName: 'RSI',
    visible: true,
    pane: 'separate',
    params: { period: 14 },
    styles: { main: { color: '#7E57C2', lineWidth: 2 } },
  },
  {
    id: 'preset-macd',
    type: 'MACD',
    name: 'MACD (12, 26, 9)',
    shortName: 'MACD',
    visible: true,
    pane: 'separate',
    params: { fast: 12, slow: 26, signal: 9 },
    styles: {
      macd: { color: '#2962FF', lineWidth: 2 },
      signal: { color: '#FF6D00', lineWidth: 1.5 },
      histogram: { color: '#26A69A', lineWidth: 1 },
    },
  },
  {
    id: 'preset-stoch',
    type: 'STOCH',
    name: 'Stocastico (14, 3, 3)',
    shortName: 'Stoch',
    visible: true,
    pane: 'separate',
    params: { kPeriod: 14, kSmooth: 3, dSmooth: 3 },
    styles: {
      k: { color: '#2962FF', lineWidth: 1.5 },
      d: { color: '#FF6D00', lineWidth: 1.5 },
    },
  },
  {
    id: 'preset-atr',
    type: 'ATR',
    name: 'Average True Range (ATR)',
    shortName: 'ATR',
    visible: true,
    pane: 'separate',
    params: { period: 14 },
    styles: { main: { color: '#B71C1C', lineWidth: 2 } },
  },
  {
    id: 'preset-volume',
    type: 'VOLUME',
    name: 'Volume',
    shortName: 'Vol',
    visible: true,
    pane: 'separate',
    params: {},
    styles: { main: { color: '#26A69A', lineWidth: 1 } },
  },
];

function numParam(
  params: Record<string, number | string>,
  key: string,
  fallback: number,
): number {
  const raw = params[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Evaluates an `IndicatorConfig` against candles and produces a render-ready `IndicatorSeries`.
 */
export function computeIndicatorSeries(
  candles: readonly Candle[],
  config: IndicatorConfig,
): IndicatorSeries {
  const closes = candles.map((c) => c.close);

  switch (config.type) {
    case 'SMA': {
      const period = numParam(config.params, 'period', 20);
      const values = calculateSMA(closes, period);
      const style = config.styles.main ?? { color: '#2962FF', lineWidth: 2 };
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'SMA',
        title: `SMA ${period}`,
        pane: 'overlay',
        plots: [
          {
            key: 'main',
            label: `SMA (${period})`,
            kind: 'line',
            color: style.color,
            lineWidth: style.lineWidth ?? 2,
            lineStyle: style.lineStyle ?? 'solid',
            data: toSeriesPoints(candles, values),
          },
        ],
      };
    }

    case 'EMA': {
      const period = numParam(config.params, 'period', 50);
      const values = calculateEMA(closes, period);
      const style = config.styles.main ?? { color: '#FF9800', lineWidth: 2 };
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'EMA',
        title: `EMA ${period}`,
        pane: 'overlay',
        plots: [
          {
            key: 'main',
            label: `EMA (${period})`,
            kind: 'line',
            color: style.color,
            lineWidth: style.lineWidth ?? 2,
            lineStyle: style.lineStyle ?? 'solid',
            data: toSeriesPoints(candles, values),
          },
        ],
      };
    }

    case 'WMA': {
      const period = numParam(config.params, 'period', 20);
      const values = calculateWMA(closes, period);
      const style = config.styles.main ?? { color: '#AB47BC', lineWidth: 2 };
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'WMA',
        title: `WMA ${period}`,
        pane: 'overlay',
        plots: [
          {
            key: 'main',
            label: `WMA (${period})`,
            kind: 'line',
            color: style.color,
            lineWidth: style.lineWidth ?? 2,
            lineStyle: style.lineStyle ?? 'solid',
            data: toSeriesPoints(candles, values),
          },
        ],
      };
    }

    case 'BB': {
      const period = numParam(config.params, 'period', 20);
      const mult = numParam(config.params, 'multiplier', 2);
      const bb = calculateBollingerBands(candles, period, mult);
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'BB',
        title: `BB ${period} ${mult}`,
        pane: 'overlay',
        plots: [
          {
            key: 'upper',
            label: 'Banda Superiore',
            kind: 'line',
            color: config.styles.upper?.color ?? '#2196F3',
            lineWidth: config.styles.upper?.lineWidth ?? 1,
            data: toSeriesPoints(candles, bb.upper),
          },
          {
            key: 'middle',
            label: 'Base',
            kind: 'line',
            color: config.styles.middle?.color ?? '#FF6D00',
            lineWidth: config.styles.middle?.lineWidth ?? 1,
            data: toSeriesPoints(candles, bb.middle),
          },
          {
            key: 'lower',
            label: 'Banda Inferiore',
            kind: 'line',
            color: config.styles.lower?.color ?? '#2196F3',
            lineWidth: config.styles.lower?.lineWidth ?? 1,
            data: toSeriesPoints(candles, bb.lower),
          },
        ],
        bands: [
          {
            upperKey: 'upper',
            lowerKey: 'lower',
            fillColor: 'rgba(33, 150, 243, 0.08)',
          },
        ],
      };
    }

    case 'VWAP': {
      const values = calculateVWAP(candles);
      const style = config.styles.main ?? { color: '#26C6DA', lineWidth: 2 };
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'VWAP',
        title: 'VWAP',
        pane: 'overlay',
        plots: [
          {
            key: 'main',
            label: 'VWAP',
            kind: 'line',
            color: style.color,
            lineWidth: style.lineWidth ?? 2,
            data: toSeriesPoints(candles, values),
          },
        ],
      };
    }

    case 'SUPERTREND': {
      const period = numParam(config.params, 'period', 10);
      const factor = numParam(config.params, 'factor', 3);
      const st = calculateSuperTrend(candles, period, factor);
      const upVals = st.supertrend.map((v, i) => (st.direction[i] === 1 ? v : null));
      const downVals = st.supertrend.map((v, i) => (st.direction[i] === -1 ? v : null));
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'SUPERTREND',
        title: `SuperTrend ${period} ${factor}`,
        pane: 'overlay',
        plots: [
          {
            key: 'up',
            label: 'SuperTrend Rialzista',
            kind: 'line',
            color: config.styles.up?.color ?? '#089981',
            lineWidth: config.styles.up?.lineWidth ?? 2,
            data: toSeriesPoints(candles, upVals),
          },
          {
            key: 'down',
            label: 'SuperTrend Ribassista',
            kind: 'line',
            color: config.styles.down?.color ?? '#F23645',
            lineWidth: config.styles.down?.lineWidth ?? 2,
            data: toSeriesPoints(candles, downVals),
          },
        ],
      };
    }

    case 'ICHIMOKU': {
      const tenkan = numParam(config.params, 'tenkan', 9);
      const kijun = numParam(config.params, 'kijun', 26);
      const senkouB = numParam(config.params, 'senkouB', 52);
      const displacement = numParam(config.params, 'displacement', 26);
      const ichi = calculateIchimoku(candles, tenkan, kijun, senkouB, displacement);
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'ICHIMOKU',
        title: `Ichimoku (${tenkan}, ${kijun}, ${senkouB})`,
        pane: 'overlay',
        plots: [
          {
            key: 'tenkan',
            label: 'Conversion Line',
            kind: 'line',
            color: config.styles.tenkan?.color ?? '#2962FF',
            lineWidth: 1.5,
            data: toSeriesPoints(candles, ichi.tenkan),
          },
          {
            key: 'kijun',
            label: 'Base Line',
            kind: 'line',
            color: config.styles.kijun?.color ?? '#B71C1C',
            lineWidth: 1.5,
            data: toSeriesPoints(candles, ichi.kijun),
          },
          {
            key: 'senkouA',
            label: 'Leading Span A',
            kind: 'line',
            color: config.styles.senkouA?.color ?? '#089981',
            lineWidth: 1,
            data: toSeriesPoints(candles, ichi.senkouA),
          },
          {
            key: 'senkouB',
            label: 'Leading Span B',
            kind: 'line',
            color: config.styles.senkouB?.color ?? '#F23645',
            lineWidth: 1,
            data: toSeriesPoints(candles, ichi.senkouB),
          },
          {
            key: 'chikou',
            label: 'Lagging Span',
            kind: 'line',
            color: config.styles.chikou?.color ?? '#43A047',
            lineWidth: 1,
            data: toSeriesPoints(candles, ichi.chikou),
          },
        ],
        bands: [
          {
            upperKey: 'senkouA',
            lowerKey: 'senkouB',
            fillColor: 'rgba(8, 153, 129, 0.12)',
            bearishFillColor: 'rgba(242, 54, 69, 0.12)',
          },
        ],
      };
    }

    case 'PIVOT': {
      const pivots = calculatePivotPoints(candles).classic;
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'PIVOT',
        title: 'Punti Pivot (Classic)',
        pane: 'overlay',
        plots: [],
        hlines: [
          { value: pivots.r3, label: 'R3', color: '#F23645', lineStyle: 'dotted' },
          { value: pivots.r2, label: 'R2', color: '#F23645', lineStyle: 'dashed' },
          { value: pivots.r1, label: 'R1', color: '#F23645', lineStyle: 'dashed' },
          { value: pivots.p, label: 'P', color: '#FF9800', lineStyle: 'solid' },
          { value: pivots.s1, label: 'S1', color: '#089981', lineStyle: 'dashed' },
          { value: pivots.s2, label: 'S2', color: '#089981', lineStyle: 'dashed' },
          { value: pivots.s3, label: 'S3', color: '#089981', lineStyle: 'dotted' },
        ],
      };
    }

    case 'RSI': {
      const period = numParam(config.params, 'period', 14);
      const values = calculateRSI(candles, period);
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'RSI',
        title: `RSI ${period}`,
        pane: 'separate',
        priceRange: { min: 0, max: 100 },
        plots: [
          {
            key: 'main',
            label: `RSI (${period})`,
            kind: 'line',
            color: config.styles.main?.color ?? '#7E57C2',
            lineWidth: config.styles.main?.lineWidth ?? 2,
            data: toSeriesPoints(candles, values),
          },
        ],
        hlines: [
          { value: 70, label: '70', color: '#787B86', lineStyle: 'dashed' },
          { value: 50, label: '50', color: '#434651', lineStyle: 'dotted' },
          { value: 30, label: '30', color: '#787B86', lineStyle: 'dashed' },
        ],
      };
    }

    case 'MACD': {
      const fast = numParam(config.params, 'fast', 12);
      const slow = numParam(config.params, 'slow', 26);
      const signal = numParam(config.params, 'signal', 9);
      const macd = calculateMACD(candles, fast, slow, signal);
      const plots: IndicatorPlot[] = [
        {
          key: 'histogram',
          label: 'Istogramma',
          kind: 'histogram',
          color: '#26A69A',
          data: toSeriesPoints(candles, macd.histogram),
          colorByValue: {
            positive: '#26A69A',
            negative: '#EF5350',
            positiveFaded: '#B2DFDB',
            negativeFaded: '#FFCDD2',
          },
        },
        {
          key: 'macd',
          label: 'MACD',
          kind: 'line',
          color: config.styles.macd?.color ?? '#2962FF',
          lineWidth: 1.8,
          data: toSeriesPoints(candles, macd.macd),
        },
        {
          key: 'signal',
          label: 'Segnale',
          kind: 'line',
          color: config.styles.signal?.color ?? '#FF6D00',
          lineWidth: 1.5,
          data: toSeriesPoints(candles, macd.signal),
        },
      ];
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'MACD',
        title: `MACD ${fast} ${slow} ${signal}`,
        pane: 'separate',
        plots,
        hlines: [{ value: 0, color: '#434651', lineStyle: 'dashed' }],
      };
    }

    case 'STOCH': {
      const kPeriod = numParam(config.params, 'kPeriod', 14);
      const kSmooth = numParam(config.params, 'kSmooth', 3);
      const dSmooth = numParam(config.params, 'dSmooth', 3);
      const stoch = calculateStochastic(candles, kPeriod, kSmooth, dSmooth);
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'STOCH',
        title: `Stocastico ${kPeriod} ${kSmooth} ${dSmooth}`,
        pane: 'separate',
        priceRange: { min: 0, max: 100 },
        plots: [
          {
            key: 'k',
            label: '%K',
            kind: 'line',
            color: config.styles.k?.color ?? '#2962FF',
            lineWidth: 1.5,
            data: toSeriesPoints(candles, stoch.k),
          },
          {
            key: 'd',
            label: '%D',
            kind: 'line',
            color: config.styles.d?.color ?? '#FF6D00',
            lineWidth: 1.5,
            data: toSeriesPoints(candles, stoch.d),
          },
        ],
        hlines: [
          { value: 80, label: '80', color: '#787B86', lineStyle: 'dashed' },
          { value: 20, label: '20', color: '#787B86', lineStyle: 'dashed' },
        ],
      };
    }

    case 'ATR': {
      const period = numParam(config.params, 'period', 14);
      const values = calculateATR(candles, period);
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'ATR',
        title: `ATR ${period}`,
        pane: 'separate',
        plots: [
          {
            key: 'main',
            label: `ATR (${period})`,
            kind: 'line',
            color: config.styles.main?.color ?? '#B71C1C',
            lineWidth: 1.8,
            data: toSeriesPoints(candles, values),
          },
        ],
      };
    }

    case 'VOLUME': {
      const values = candles.map((c) => (c.close >= c.open ? c.volume : -c.volume));
      return {
        id: `series-${config.id}`,
        configId: config.id,
        type: 'VOLUME',
        title: 'Volume',
        pane: 'separate',
        plots: [
          {
            key: 'main',
            label: 'Volume',
            kind: 'histogram',
            color: '#26A69A',
            data: toSeriesPoints(candles, values),
            colorByValue: {
              positive: 'rgba(8, 153, 129, 0.55)',
              negative: 'rgba(242, 54, 69, 0.55)',
            },
          },
        ],
      };
    }
  }
}
