import { describe, expect, it } from 'vitest';
import type { Candle, DrawingObject, DrawingPoint, ScreenPoint } from '../src/types';
import {
  calculateFibonacciLevels,
  calculateMeasure,
  calculateParallelChannel,
  calculatePositionMetrics,
  distanceToInfiniteLine,
  distanceToRay,
  distanceToSegment,
  extendLineToBounds,
  hitTestDrawing,
  projectTrendlinePrice,
  snapPriceToCandle,
} from '../src/engine';

describe('Drawing Geometry & Hit Testing (drawingMath.ts)', () => {
  it('computes accurate distances to segment, ray, and infinite line', () => {
    const a: ScreenPoint = { x: 0, y: 0 };
    const b: ScreenPoint = { x: 100, y: 0 };

    expect(distanceToSegment({ x: 50, y: 10 }, a, b)).toBeCloseTo(10, 6);
    expect(distanceToSegment({ x: 130, y: 0 }, a, b)).toBeCloseTo(30, 6);
    expect(distanceToRay({ x: 130, y: 5 }, a, b)).toBeCloseTo(5, 6);
    expect(distanceToRay({ x: -20, y: 0 }, a, b)).toBeCloseTo(20, 6);
    expect(distanceToInfiniteLine({ x: -20, y: 7 }, a, b)).toBeCloseTo(7, 6);
  });

  it('extends rays and infinite lines beyond viewport bounds', () => {
    const [rStart, rEnd] = extendLineToBounds(
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      800,
      600,
      'ray',
    );
    expect(rStart).toEqual({ x: 100, y: 100 });
    expect(rEnd.x).toBeGreaterThan(800);

    const [eStart, eEnd] = extendLineToBounds(
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      800,
      600,
      'extended',
    );
    expect(eStart.x).toBeLessThan(0);
    expect(eEnd.x).toBeGreaterThan(800);
  });

  it('projects trendline price linearly over time', () => {
    const p1: DrawingPoint = { time: 1000, price: 100 };
    const p2: DrawingPoint = { time: 2000, price: 120 };
    expect(projectTrendlinePrice(p1, p2, 2500)).toBeCloseTo(130, 6);
    expect(projectTrendlinePrice(p1, p2, 1500)).toBeCloseTo(110, 6);
  });

  it('computes exact Fibonacci retracement levels', () => {
    const levels = calculateFibonacciLevels(100, 200);
    const byRatio = new Map(levels.map((l) => [l.ratio, l.price]));
    expect(byRatio.get(0)).toBeCloseTo(200, 6);
    expect(byRatio.get(0.382)).toBeCloseTo(161.8, 6);
    expect(byRatio.get(0.5)).toBeCloseTo(150, 6);
    expect(byRatio.get(0.618)).toBeCloseTo(138.2, 6);
    expect(byRatio.get(1)).toBeCloseTo(100, 6);
  });

  it('computes parallel channel edges and centerline', () => {
    const geom = calculateParallelChannel(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 100, y: 140 },
    );
    expect(geom.offsetStart).toEqual({ x: 0, y: 140 });
    expect(geom.offsetEnd).toEqual({ x: 200, y: 140 });
    expect(geom.midStart).toEqual({ x: 0, y: 120 });
    expect(geom.channelHeightPx).toBeCloseTo(40, 6);
  });

  it('computes Measure tool delta, percentage, bar count, and time span', () => {
    const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 100,
      high: 105,
      low: 95,
      close: 100,
      volume: 100,
    }));
    const m = calculateMeasure(
      { time: candles[2].time, price: 100 },
      { time: candles[10].time, price: 115 },
      candles,
    );
    expect(m.priceDelta).toBeCloseTo(15, 6);
    expect(m.percentDelta).toBeCloseTo(15, 6);
    expect(m.bars).toBe(8);
    expect(m.timeSpanSeconds).toBe(8 * 3600);
    expect(m.isPositive).toBe(true);
  });

  it('computes Long and Short Risk/Reward position metrics', () => {
    const longPos = calculatePositionMetrics('long', 100, 95, 115);
    expect(longPos.riskAmount).toBe(5);
    expect(longPos.rewardAmount).toBe(15);
    expect(longPos.riskRewardRatio).toBeCloseTo(3, 6);

    const shortPos = calculatePositionMetrics('short', 100, 104, 92);
    expect(shortPos.riskAmount).toBe(4);
    expect(shortPos.rewardAmount).toBe(8);
    expect(shortPos.riskRewardRatio).toBeCloseTo(2, 6);
  });

  it('snaps cursor prices to candle OHLC in strong and weak magnet modes', () => {
    const candle: Candle = {
      time: 1000,
      open: 100,
      high: 110,
      low: 92,
      close: 106,
      volume: 500,
    };
    expect(snapPriceToCandle(109.2, candle, 'strong')).toBe(110);
    expect(snapPriceToCandle(93.1, candle, 'strong')).toBe(92);
    // Weak magnet snaps when close, keeps raw price when far away
    expect(snapPriceToCandle(109.5, candle, 'weak', 2)).toBe(110);
    expect(snapPriceToCandle(125, candle, 'weak', 2)).toBe(125);
  });

  it('hit-tests handles and geometry across drawing types', () => {
    const toScreen = (p: DrawingPoint): ScreenPoint => ({ x: p.time, y: p.price });
    const trendline: DrawingObject = {
      id: 'd1',
      symbol: 'RACE',
      type: 'trendline',
      points: [
        { time: 10, price: 20 },
        { time: 110, price: 20 },
      ],
      style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
      locked: false,
      visible: true,
      createdAt: 1,
    };

    const handleHit = hitTestDrawing(trendline, { x: 11, y: 21 }, toScreen, 8);
    expect(handleHit.hit).toBe(true);
    expect(handleHit.handleIndex).toBe(0);

    const bodyHit = hitTestDrawing(trendline, { x: 60, y: 24 }, toScreen, 8);
    expect(bodyHit.hit).toBe(true);
    expect(bodyHit.handleIndex).toBeNull();

    const miss = hitTestDrawing(trendline, { x: 60, y: 50 }, toScreen, 8);
    expect(miss.hit).toBe(false);

    const hidden = hitTestDrawing(
      { ...trendline, visible: false },
      { x: 60, y: 20 },
      toScreen,
    );
    expect(hidden.hit).toBe(false);
  });
});
