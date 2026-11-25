import {
  TIMEFRAME_SECONDS,
  type Candle,
  type SymbolInfo,
  type Timeframe,
} from '../types';
import { getSymbolByTicker } from './symbols';
import {
  getCachedRealCandles,
  getSnapshotCandles,
  isTestEnvironment,
} from './realMarketApi';

/** Fixed anchor timestamp (UTC) so default generated histories are 100% deterministic */
export const DEFAULT_ANCHOR_TIMESTAMP = Math.floor(
  Date.UTC(2026, 10, 25, 16, 0, 0) / 1000,
);

export interface GenerateCandlesOptions {
  /** Number of candles to produce (default: 320) */
  count?: number;
  /** Anchor end Unix timestamp in seconds (defaults to deterministic UTC anchor) */
  endTime?: number;
  /** Optional custom seed salt */
  seedOffset?: number;
}

/** FNV-1a 32-bit string hash for deterministic PRNG seeding */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic Mulberry32 PRNG returning floats in [0, 1) */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal variate from deterministic RNG */
function nextGaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Clamp extreme synthetic outliers to +/- 3.6 sigma for clean market realism
  return Math.max(-3.6, Math.min(3.6, z));
}

function roundToPrecision(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function alignTimestamp(ts: number, stepSec: number): number {
  return Math.floor(ts / stepSec) * stepSec;
}

/** Volatility scaling per bar relative to daily volatility */
function timeframeVolScale(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m':
      return 1 / Math.sqrt(390);
    case '5m':
      return 1 / Math.sqrt(78);
    case '15m':
      return 1 / Math.sqrt(26);
    case '1H':
      return 1 / Math.sqrt(6.5);
    case '4H':
      return 1 / Math.sqrt(1.625);
    case '1D':
      return 1;
    case '1W':
      return Math.sqrt(5);
    case '1M':
      return Math.sqrt(21);
  }
}

/** Volume scaling per bar relative to average daily volume */
function timeframeVolumeScale(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m':
      return 1 / 390;
    case '5m':
      return 1 / 78;
    case '15m':
      return 1 / 26;
    case '1H':
      return 1 / 6.5;
    case '4H':
      return 1 / 1.65;
    case '1D':
      return 1;
    case '1W':
      return 5;
    case '1M':
      return 21;
  }
}

interface RegimeSpec {
  driftMultiplier: number;
  volMultiplier: number;
  meanReversion: number;
}

const REGIMES: readonly RegimeSpec[] = [
  { driftMultiplier: 1.6, volMultiplier: 0.9, meanReversion: 0.01 }, // Steady uptrend
  { driftMultiplier: -0.9, volMultiplier: 1.1, meanReversion: 0.04 }, // Pullback
  { driftMultiplier: 0.15, volMultiplier: 0.72, meanReversion: 0.08 }, // Consolidation range
  { driftMultiplier: 2.3, volMultiplier: 1.45, meanReversion: 0.005 }, // Momentum breakout
  { driftMultiplier: -1.7, volMultiplier: 1.55, meanReversion: 0.015 }, // Selloff / volatility cluster
  { driftMultiplier: 0.55, volMultiplier: 0.85, meanReversion: 0.03 }, // Recovery grind
];

/**
 * Generates deterministic, realistic multi-timeframe OHLCV candles with
 * trend regimes, pullbacks, GARCH-style volatility clustering, realistic wicks,
 * volume surges on volatile bars, and anchor calibration to `symbol.basePrice`.
 */
export function generateCandles(
  symbol: SymbolInfo,
  timeframe: Timeframe,
  options: GenerateCandlesOptions = {},
): Candle[] {
  const count = Math.max(2, options.count ?? 320);
  const stepSec = TIMEFRAME_SECONDS[timeframe];
  const rawEnd = options.endTime ?? DEFAULT_ANCHOR_TIMESTAMP;
  const endTime = alignTimestamp(rawEnd, stepSec);

  const seed = hashString(
    `${symbol.id}|${timeframe}|${options.seedOffset ?? 0}`,
  );
  const rng = createSeededRng(seed);

  const barVolBase = symbol.volatility * timeframeVolScale(timeframe);
  const barDriftBase = (symbol.drift / 252) * Math.pow(timeframeVolScale(timeframe), 2);
  const barVolMean = Math.max(10, symbol.avgVolume * timeframeVolumeScale(timeframe));

  // First simulate an unanchored log-price path so we can smoothly calibrate the final bar to symbol.basePrice
  const rawOpens: number[] = new Array(count);
  const rawHighs: number[] = new Array(count);
  const rawLows: number[] = new Array(count);
  const rawCloses: number[] = new Array(count);
  const rawVolumes: number[] = new Array(count);

  let price = symbol.basePrice;
  let emaAnchor = symbol.basePrice;
  let garchVol = barVolBase;
  let regimeIdx = Math.floor(rng() * REGIMES.length);
  let regimeRemaining = 24 + Math.floor(rng() * 48);
  let prevReturn = 0;

  for (let i = 0; i < count; i++) {
    if (regimeRemaining <= 0) {
      // Transition to a new market regime
      regimeIdx = (regimeIdx + 1 + Math.floor(rng() * (REGIMES.length - 1))) % REGIMES.length;
      regimeRemaining = 22 + Math.floor(rng() * 54);
    }
    regimeRemaining--;

    const regime = REGIMES[regimeIdx];

    // GARCH(1,1)-inspired volatility clustering
    const shock = prevReturn * prevReturn;
    const targetVar = Math.pow(barVolBase * regime.volMultiplier, 2);
    const nextVar = 0.12 * targetVar + 0.72 * (garchVol * garchVol) + 0.16 * shock;
    garchVol = Math.max(
      barVolBase * 0.35,
      Math.min(barVolBase * 2.8, Math.sqrt(nextVar)),
    );

    // Subtle open gap (stronger on daily/weekly equities, almost zero on crypto/forex)
    const gapFactor =
      symbol.assetClass === 'crypto' || symbol.assetClass === 'forex'
        ? 0.05
        : timeframe === '1D' || timeframe === '1W'
          ? 0.25
          : 0.08;
    const openGap = i === 0 ? 0 : nextGaussian(rng) * garchVol * gapFactor;
    const open = Math.max(symbol.tickSize * 2, price * Math.exp(openGap));

    // Combine regime drift, mild momentum, and mean reversion toward EMA anchor
    const z = nextGaussian(rng);
    const meanRevPull = Math.log(emaAnchor / open) * regime.meanReversion;
    const momentum = prevReturn * 0.12;
    const barReturn =
      barDriftBase * regime.driftMultiplier +
      meanRevPull +
      momentum +
      z * garchVol;

    const close = Math.max(symbol.tickSize * 2, open * Math.exp(barReturn));

    // Realistic upper & lower wicks
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const upperWickRatio = Math.abs(nextGaussian(rng)) * garchVol * (0.42 + rng() * 0.35);
    const lowerWickRatio = Math.abs(nextGaussian(rng)) * garchVol * (0.42 + rng() * 0.35);

    const high = bodyTop * (1 + upperWickRatio);
    const low = Math.max(symbol.tickSize, bodyBottom * (1 - lowerWickRatio));

    // Volume correlates with |return| and volatility regime + intraday U-shape wave
    const absMoveNorm = Math.min(3.5, Math.abs(barReturn) / Math.max(barVolBase, 1e-6));
    const wave = 0.82 + 0.32 * Math.sin((i / 14) * Math.PI);
    const volNoise = 0.65 + rng() * 0.75;
    const volume = Math.max(
      1,
      Math.round(barVolMean * (0.6 + 0.55 * absMoveNorm) * wave * volNoise),
    );

    rawOpens[i] = open;
    rawHighs[i] = high;
    rawLows[i] = low;
    rawCloses[i] = close;
    rawVolumes[i] = volume;

    prevReturn = Math.log(close / open);
    price = close;
    emaAnchor = emaAnchor * 0.96 + close * 0.04;
  }

  // Scale all simulated prices so the final candle closes at symbol.basePrice
  // and on daily timeframe the second-to-last candle matches symbol.prevClose smoothly
  const finalRawClose = rawCloses[count - 1];
  const scale = finalRawClose > 0 ? symbol.basePrice / finalRawClose : 1;

  const candles: Candle[] = new Array(count);
  const startTime = endTime - (count - 1) * stepSec;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * stepSec;
    let open = roundToPrecision(rawOpens[i] * scale, symbol.precision);
    let close = roundToPrecision(rawCloses[i] * scale, symbol.precision);
    let high = roundToPrecision(rawHighs[i] * scale, symbol.precision);
    let low = roundToPrecision(rawLows[i] * scale, symbol.precision);

    // Pin the very last candle close to exact symbol.basePrice
    if (i === count - 1) {
      close = roundToPrecision(symbol.basePrice, symbol.precision);
    }
    if (timeframe === '1D' && i === count - 2 && symbol.prevClose > 0) {
      close = roundToPrecision(symbol.prevClose, symbol.precision);
    }

    // Enforce strict OHLC invariants after rounding
    const minOC = Math.min(open, close);
    const maxOC = Math.max(open, close);
    if (high < maxOC) high = maxOC;
    if (low > minOC) low = minOC;
    if (low <= 0) {
      low = Math.max(symbol.tickSize, roundToPrecision(minOC * 0.99, symbol.precision));
    }
    if (open <= 0) open = low;
    if (close <= 0) close = low;

    candles[i] = {
      time,
      open,
      high,
      low,
      close,
      volume: rawVolumes[i],
    };
  }

  // Ensure smooth continuity on the last candle open if daily prevClose was pinned
  if (timeframe === '1D' && count >= 2) {
    const prev = candles[count - 2];
    const last = candles[count - 1];
    const maxGap = Math.max(symbol.tickSize * 2, prev.close * symbol.volatility * 0.6);
    if (Math.abs(last.open - prev.close) > maxGap) {
      const clampedOpen = roundToPrecision(
        prev.close + Math.sign(last.open - prev.close) * maxGap * 0.35,
        symbol.precision,
      );
      last.open = clampedOpen;
      last.high = Math.max(last.high, last.open, last.close);
      last.low = Math.min(last.low, last.open, last.close);
    }
  }

  return candles;
}

const candleCache = new Map<string, Candle[]>();

/** Cached OHLCV lookup by ticker + timeframe (prefers real cached/snapshot bars in browser, deterministic in tests) */
export function getCandlesForSymbol(
  ticker: string,
  timeframe: Timeframe,
  count = 320,
): Candle[] {
  const symbol = getSymbolByTicker(ticker);
  if (!symbol) return [];

  if (!isTestEnvironment()) {
    const real = getCachedRealCandles(symbol.ticker, timeframe);
    if (real && real.candles.length > 0) {
      return real.candles.slice(-count).map((c) => ({ ...c }));
    }
  }

  const key = `${symbol.id}|${timeframe}|${count}`;
  let series = candleCache.get(key);
  if (!series) {
    series = generateCandles(symbol, timeframe, { count });
    candleCache.set(key, series);
  }
  // Return shallow copy of candle objects so consumers cannot corrupt shared cache
  return series.map((c) => ({ ...c }));
}

/** Generate a compact sparkline array (uses real Yahoo snapshot closes in browser when loaded) */
export function generateSparkline(tickerOrSymbol: string | SymbolInfo, points = 32): number[] {
  const symbol =
    typeof tickerOrSymbol === 'string'
      ? getSymbolByTicker(tickerOrSymbol)
      : tickerOrSymbol;
  if (!symbol) return [];
  if (!isTestEnvironment()) {
    const snap = getSnapshotCandles(symbol.ticker, '1D');
    if (snap && snap.length >= 6) {
      return snap.slice(-points).map((c) => c.close);
    }
  }
  const candles = generateCandles(symbol, '1H', { count: Math.max(points, 12) });
  return candles.slice(-points).map((c) => c.close);
}

export function clearCandleCache(): void {
  candleCache.clear();
}
