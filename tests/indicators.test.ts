import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/types';
import { getCandlesForSymbol } from '../src/data';
import {
  DEFAULT_INDICATOR_PRESETS,
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateIchimoku,
  calculateMACD,
  calculatePivotPoints,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateSuperTrend,
  calculateTechnicalSummary,
  calculateVWAP,
  calculateWMA,
  computeIndicatorSeries,
  scoreToRatingLabel,
  toHeikinAshi,
} from '../src/engine';

function makeLinearCandles(
  count: number,
  startPrice: number,
  step: number,
  stepSec = 86400,
): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const open = startPrice + i * step;
    const close = open + step * 0.8;
    const high = Math.max(open, close) + Math.abs(step) * 0.5 + 0.5;
    const low = Math.max(0.1, Math.min(open, close) - Math.abs(step) * 0.5 - 0.5);
    candles.push({
      time: 1700000000 + i * stepSec,
      open,
      high,
      low,
      close,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

describe('Moving Averages (SMA, EMA, WMA)', () => {
  it('calculates exact SMA values', () => {
    const vals = [10, 20, 30, 40, 50];
    const sma3 = calculateSMA(vals, 3);
    expect(sma3).toEqual([null, null, 20, 30, 40]);
  });

  it('calculates exact EMA seeded with initial SMA', () => {
    const vals = [10, 20, 30, 40, 50];
    const ema3 = calculateEMA(vals, 3);
    expect(ema3[0]).toBeNull();
    expect(ema3[1]).toBeNull();
    expect(ema3[2]).toBeCloseTo(20, 6); // SMA(10,20,30)
    // alpha = 2/(3+1) = 0.5 -> 0.5*40 + 0.5*20 = 30
    expect(ema3[3]).toBeCloseTo(30, 6);
    // 0.5*50 + 0.5*30 = 40
    expect(ema3[4]).toBeCloseTo(40, 6);
  });

  it('calculates exact WMA values', () => {
    const vals = [10, 20, 30, 40];
    const wma3 = calculateWMA(vals, 3);
    expect(wma3[0]).toBeNull();
    expect(wma3[1]).toBeNull();
    // (10*1 + 20*2 + 30*3) / 6 = 140 / 6
    expect(wma3[2]).toBeCloseTo(140 / 6, 6);
    // (20*1 + 30*2 + 40*3) / 6 = 200 / 6
    expect(wma3[3]).toBeCloseTo(200 / 6, 6);
  });
});

describe('Bollinger Bands & VWAP', () => {
  it('computes symmetric upper/middle/lower bands around SMA', () => {
    const candles = getCandlesForSymbol('FTSEMIB', '1D', 100);
    const bb = calculateBollingerBands(candles, 20, 2);
    expect(bb.middle[18]).toBeNull();
    expect(bb.middle[19]).not.toBeNull();

    for (let i = 19; i < candles.length; i++) {
      expect(bb.upper[i]!).toBeGreaterThanOrEqual(bb.middle[i]!);
      expect(bb.lower[i]!).toBeLessThanOrEqual(bb.middle[i]!);
      const upperDiff = bb.upper[i]! - bb.middle[i]!;
      const lowerDiff = bb.middle[i]! - bb.lower[i]!;
      expect(upperDiff).toBeCloseTo(lowerDiff, 6);
    }
  });

  it('computes cumulative VWAP and resets across UTC day boundary on intraday data', () => {
    const day1 = Date.UTC(2026, 0, 10, 10, 0, 0) / 1000;
    const day2 = Date.UTC(2026, 0, 11, 10, 0, 0) / 1000;
    const intraday: Candle[] = [
      { time: day1, open: 100, high: 102, low: 98, close: 100, volume: 100 }, // tp = 100
      { time: day1 + 300, open: 100, high: 112, low: 108, close: 110, volume: 300 }, // tp = 110 -> (100*100 + 110*300)/400 = 107.5
      { time: day2, open: 120, high: 123, low: 117, close: 120, volume: 50 }, // reset! tp = 120
    ];
    const vwap = calculateVWAP(intraday);
    expect(vwap[0]).toBeCloseTo(100, 6);
    expect(vwap[1]).toBeCloseTo(107.5, 6);
    expect(vwap[2]).toBeCloseTo(120, 6);
  });
});

describe('Oscillators & Volatility (RSI, MACD, Stochastic, ATR)', () => {
  it('computes RSI bounded in [0, 100] with extreme values on monotonic trends', () => {
    const up = makeLinearCandles(50, 100, 2);
    const down = makeLinearCandles(50, 300, -2);
    const rsiUp = calculateRSI(up, 14);
    const rsiDown = calculateRSI(down, 14);

    expect(rsiUp[13]).toBeNull();
    expect(rsiUp[49]!).toBeCloseTo(100, 3);
    expect(rsiDown[49]!).toBeCloseTo(0, 3);

    const realCandles = getCandlesForSymbol('BTCUSDT', '1D', 120);
    const realRsi = calculateRSI(realCandles, 14);
    for (const v of realRsi) {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('computes MACD where histogram equals macd - signal', () => {
    const candles = getCandlesForSymbol('RACE', '1D', 120);
    const { macd, signal, histogram } = calculateMACD(candles, 12, 26, 9);
    expect(macd[24]).toBeNull();
    expect(macd[25]).not.toBeNull();
    expect(signal[33]).not.toBeNull();

    for (let i = 0; i < candles.length; i++) {
      if (macd[i] !== null && signal[i] !== null) {
        expect(histogram[i]!).toBeCloseTo(macd[i]! - signal[i]!, 8);
      }
    }
  });

  it('computes Stochastic %K and %D within [0, 100]', () => {
    const candles = getCandlesForSymbol('AAPL', '1D', 100);
    const { k, d } = calculateStochastic(candles, 14, 3, 3);
    const validK = k.filter((v): v is number => v !== null);
    const validD = d.filter((v): v is number => v !== null);
    expect(validK.length).toBeGreaterThan(50);
    expect(validD.length).toBeGreaterThan(50);
    for (const v of [...validK, ...validD]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('computes exact ATR on constant true range series', () => {
    const flat: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 86400,
      open: 100,
      high: 105,
      low: 95,
      close: 100,
      volume: 1000,
    }));
    const atr = calculateATR(flat, 14);
    expect(atr[12]).toBeNull();
    expect(atr[13]).toBeCloseTo(10, 6);
    expect(atr[29]).toBeCloseTo(10, 6);
  });
});

describe('Trend & Structure Indicators (SuperTrend, Ichimoku, Heikin-Ashi, Pivots)', () => {
  it('flips SuperTrend direction cleanly across uptrend and sharp reversal', () => {
    const up = makeLinearCandles(40, 100, 3);
    const down = makeLinearCandles(40, 220, -4).map((c, idx) => ({
      ...c,
      time: up[up.length - 1].time + (idx + 1) * 86400,
    }));
    const combined = [...up, ...down];
    const st = calculateSuperTrend(combined, 10, 2);

    expect(st.direction[35]).toBe(1);
    expect(st.direction[combined.length - 1]).toBe(-1);
    expect(st.supertrend[35]!).toBeLessThan(combined[35].close);
    expect(st.supertrend[combined.length - 1]!).toBeGreaterThan(
      combined[combined.length - 1].close,
    );
  });

  it('computes Ichimoku lines with proper warmup and displacement', () => {
    const candles = getCandlesForSymbol('SPX', '1D', 150);
    const ichi = calculateIchimoku(candles, 9, 26, 52, 26);

    expect(ichi.tenkan[8]).not.toBeNull();
    expect(ichi.kijun[25]).not.toBeNull();
    expect(ichi.senkouA[51]).not.toBeNull();
    expect(ichi.senkouB[77]).not.toBeNull();
    expect(ichi.chikou[0]).toBe(candles[26].close);
    expect(ichi.chikou[candles.length - 1]).toBeNull();
  });

  it('transforms candles into exact Heikin-Ashi bars', () => {
    const raw: Candle[] = [
      { time: 1, open: 100, high: 110, low: 95, close: 105, volume: 500 },
      { time: 2, open: 106, high: 115, low: 102, close: 112, volume: 600 },
    ];
    const ha = toHeikinAshi(raw);
    expect(ha).toHaveLength(2);
    // Bar 0: haClose = (100+110+95+105)/4 = 102.5, haOpen = (100+105)/2 = 102.5
    expect(ha[0].close).toBeCloseTo(102.5, 6);
    expect(ha[0].open).toBeCloseTo(102.5, 6);
    expect(ha[0].high).toBe(110);
    expect(ha[0].low).toBe(95);

    // Bar 1: haClose = (106+115+102+112)/4 = 108.75, haOpen = (102.5+102.5)/2 = 102.5
    expect(ha[1].close).toBeCloseTo(108.75, 6);
    expect(ha[1].open).toBeCloseTo(102.5, 6);
    expect(ha[1].high).toBe(115);
    expect(ha[1].low).toBe(102);
  });

  it('calculates ordered Classic, Fibonacci, Camarilla, Woodie, and DeMark pivot points', () => {
    const sample: Candle[] = [
      { time: 1, open: 100, high: 120, low: 90, close: 110, volume: 1000 },
      { time: 2, open: 110, high: 115, low: 105, close: 112, volume: 900 },
    ];
    const pivots = calculatePivotPoints(sample);
    // Uses prior bar (H=120, L=90, C=110) -> P = 320/3 = 106.6667
    expect(pivots.classic.p).toBeCloseTo(320 / 3, 5);
    expect(pivots.classic.r3).toBeGreaterThan(pivots.classic.r2);
    expect(pivots.classic.r2).toBeGreaterThan(pivots.classic.r1);
    expect(pivots.classic.r1).toBeGreaterThan(pivots.classic.p);
    expect(pivots.classic.p).toBeGreaterThan(pivots.classic.s1);
    expect(pivots.classic.s1).toBeGreaterThan(pivots.classic.s2);
    expect(pivots.classic.s2).toBeGreaterThan(pivots.classic.s3);

    expect(pivots.fibonacci.r1).toBeCloseTo(pivots.classic.p + 0.382 * 30, 5);
    expect(pivots.camarilla.r3).toBeGreaterThan(pivots.camarilla.r2);
    expect(pivots.demark.r1).toBeGreaterThan(pivots.demark.s1);
  });
});

describe('Technical Summary Gauge & Indicator Series Builder', () => {
  it('maps scores to all 5 Italian rating labels cleanly', () => {
    expect(scoreToRatingLabel(-0.75)).toBe('Forte vendita');
    expect(scoreToRatingLabel(-0.25)).toBe('Vendita');
    expect(scoreToRatingLabel(0)).toBe('Neutrale');
    expect(scoreToRatingLabel(0.3)).toBe('Acquisto');
    expect(scoreToRatingLabel(0.75)).toBe('Forte acquisto');
  });

  it('produces bullish summary on strong uptrend and bearish summary on strong downtrend with exact counts', () => {
    const uptrend = makeLinearCandles(250, 50, 1.2);
    const downtrend = makeLinearCandles(250, 500, -1.2);

    const bull = calculateTechnicalSummary(uptrend);
    expect(['Acquisto', 'Forte acquisto']).toContain(bull.movingAverages.rating);
    expect(['Acquisto', 'Forte acquisto']).toContain(bull.summary.rating);
    expect(
      bull.oscillators.buyCount +
        bull.oscillators.neutralCount +
        bull.oscillators.sellCount,
    ).toBe(bull.oscillators.signals.length);
    expect(
      bull.movingAverages.buyCount +
        bull.movingAverages.neutralCount +
        bull.movingAverages.sellCount,
    ).toBe(bull.movingAverages.signals.length);
    expect(bull.summary.buyCount).toBe(
      bull.oscillators.buyCount + bull.movingAverages.buyCount,
    );

    const bear = calculateTechnicalSummary(downtrend);
    expect(['Vendita', 'Forte vendita']).toContain(bear.movingAverages.rating);
    expect(['Vendita', 'Forte vendita']).toContain(bear.summary.rating);
  });

  it('computes render-ready IndicatorSeries for every default preset', () => {
    const candles = getCandlesForSymbol('NVDA', '1D', 200);
    for (const preset of DEFAULT_INDICATOR_PRESETS) {
      const series = computeIndicatorSeries(candles, preset);
      expect(series.configId).toBe(preset.id);
      expect(series.type).toBe(preset.type);
      if (preset.type === 'PIVOT') {
        expect(series.hlines?.length).toBe(7);
      } else {
        expect(series.plots.length).toBeGreaterThan(0);
        expect(series.plots[0].data).toHaveLength(candles.length);
      }
    }
  });
});
