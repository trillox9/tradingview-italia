import { describe, expect, it } from 'vitest';
import {
  CHART_TYPES_META,
  DRAWING_TOOL_GROUPS,
  DRAWING_TOOL_REGISTRY,
  normalizeChartType,
  normalizeDrawingTool,
  type Candle,
  type DrawingObject,
  type DrawingPoint,
  type ScreenPoint,
} from '../src/types';
import {
  calculateFibExtension,
  calculateFibTimeZones,
  calculateFibonacciLevels,
  calculateFixedRangeVolumeProfile,
  calculateGannFanRays,
  calculateLinearRegression,
  calculateMeasure,
  calculateParallelChannel,
  calculatePitchfork,
  calculatePositionMetrics,
  calculateTrendAngle,
  distanceToInfiniteLine,
  distanceToRay,
  distanceToSegment,
  extendLineToBounds,
  hitTestDrawing,
  projectTrendlinePrice,
  snapPriceToCandle,
} from '../src/engine';

describe('Supercharts Chart Types & 64-Tool Drawing Registry', () => {
  it('registers all 13 authentic TradingView chart types and normalizes legacy aliases', () => {
    expect(CHART_TYPES_META).toHaveLength(13);
    const ids = new Set(CHART_TYPES_META.map((m) => m.id));
    expect(ids.size).toBe(13);
    expect(normalizeChartType('hollow')).toBe('hollow_candles');
    expect(normalizeChartType('heikinAshi')).toBe('heikin_ashi');
    expect(normalizeChartType('volume_candles')).toBe('volume_candles');
  });

  it('registers all 64 authentic TradingView drawing tools across 8 groups and normalizes legacy aliases', () => {
    const allTools = Object.values(DRAWING_TOOL_REGISTRY);
    expect(allTools).toHaveLength(64);
    expect(DRAWING_TOOL_GROUPS).toHaveLength(8);

    const groupedTotal = DRAWING_TOOL_GROUPS.reduce(
      (sum, g) => sum + g.tools.length,
      0,
    );
    expect(groupedTotal).toBe(64);

    for (const tool of allTools) {
      expect(tool.labelIt.trim().length).toBeGreaterThan(1);
      expect(tool.defaultLineWidth).toBeGreaterThan(0);
    }

    expect(normalizeDrawingTool('cursor')).toBe('arrow_cursor');
    expect(normalizeDrawingTool('horizontalLine')).toBe('hline');
    expect(normalizeDrawingTool('verticalLine')).toBe('vline');
    expect(normalizeDrawingTool('extendedLine')).toBe('extended_line');
    expect(normalizeDrawingTool('parallelChannel')).toBe('channel');
    expect(normalizeDrawingTool('fibRetracement')).toBe('fib_retracement');
    expect(normalizeDrawingTool('longPosition')).toBe('long_position');
    expect(normalizeDrawingTool('shortPosition')).toBe('short_position');
    expect(normalizeDrawingTool('arrow')).toBe('arrow_line');
  });
});

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

  it('computes 3-point Trend-Based Fibonacci Extensions accurately', () => {
    // Impulse 100 -> 150 (+50), retraced to 120, projected upward
    const ext = calculateFibExtension(100, 150, 120);
    const byRatio = new Map(ext.map((l) => [l.ratio, l.price]));
    expect(byRatio.get(0)).toBeCloseTo(120, 6);
    expect(byRatio.get(0.618)).toBeCloseTo(150.9, 6);
    expect(byRatio.get(1)).toBeCloseTo(170, 6);
    expect(byRatio.get(1.618)).toBeCloseTo(200.9, 6);
    expect(byRatio.get(2.618)).toBeCloseTo(250.9, 6);
  });

  it('computes Fibonacci Time Zones with unit scaling and maxIdx clamping', () => {
    const zones = calculateFibTimeZones(10, 12, 50);
    // unit = 2 -> offsets 0, 2, 4, 6, 10, 16, 26, 42 (next is 10 + 42 = 52 > 50)
    expect(zones.map((z) => z.barIndex)).toEqual([10, 12, 14, 16, 20, 26, 36]);
    expect(zones[0].fibNumber).toBe(0);
    expect(zones[zones.length - 1].fibNumber).toBe(13);
  });

  it('computes OLS Linear Regression channel, Pearson R, and ±2σ bounds', () => {
    // Exact linear series y = 100 + 2*i -> slope=2, stdDev=0, R=+1
    const perfectCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 60,
      open: 100 + 2 * i,
      high: 101 + 2 * i,
      low: 99 + 2 * i,
      close: 100 + 2 * i,
      volume: 100,
    }));
    const reg = calculateLinearRegression(perfectCandles, 0, 9, 2);
    expect(reg).not.toBeNull();
    expect(reg!.slope).toBeCloseTo(2, 6);
    expect(reg!.intercept).toBeCloseTo(100, 6);
    expect(reg!.stdDev).toBeCloseTo(0, 6);
    expect(reg!.pearsonR).toBeCloseTo(1, 6);
    expect(reg!.midStartPrice).toBeCloseTo(100, 6);
    expect(reg!.midEndPrice).toBeCloseTo(118, 6);

    // Noisy alternating residual ±4 -> stdDev = 4, band = ±8 at stdDevMult=2
    const noisyCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 60,
      open: 50,
      high: 60,
      low: 40,
      close: 50 + (i % 2 === 0 ? 4 : -4),
      volume: 100,
    }));
    const noisyReg = calculateLinearRegression(noisyCandles, 9, 0, 2);
    expect(noisyReg).not.toBeNull();
    expect(noisyReg!.startIdx).toBe(0);
    expect(noisyReg!.endIdx).toBe(9);
    expect(noisyReg!.stdDev).toBeGreaterThan(3.5);
    expect(noisyReg!.upperStartPrice).toBeGreaterThan(noisyReg!.midStartPrice);
    expect(noisyReg!.lowerEndPrice).toBeLessThan(noisyReg!.midEndPrice);
  });

  it('computes visual Trend Angle in degrees for bullish, bearish, and horizontal vectors', () => {
    // Horizontal right: 0°
    expect(calculateTrendAngle({ x: 0, y: 100 }, { x: 100, y: 100 }).angleDegrees).toBeCloseTo(0, 4);
    // Bullish 45° (screen y decreases upward)
    const up45 = calculateTrendAngle({ x: 0, y: 100 }, { x: 100, y: 0 });
    expect(up45.angleDegrees).toBeCloseTo(45, 2);
    expect(up45.distancePx).toBeCloseTo(Math.SQRT2 * 100, 1);
    // Bearish -45° (screen y increases downward)
    expect(calculateTrendAngle({ x: 0, y: 100 }, { x: 100, y: 200 }).angleDegrees).toBeCloseTo(-45, 2);
    // Dragging right-to-left folds cleanly into [-90, 90]
    const rev = calculateTrendAngle({ x: 100, y: 0 }, { x: 0, y: 100 });
    expect(rev.angleDegrees).toBeCloseTo(45, 2);
  });

  it('computes Andrews and Schiff Pitchfork geometry with parallel prongs', () => {
    const p0: ScreenPoint = { x: 0, y: 100 };
    const p1: ScreenPoint = { x: 100, y: 40 };
    const p2: ScreenPoint = { x: 100, y: 140 };

    const andrews = calculatePitchfork(p0, p1, p2, 'andrews');
    expect(andrews.medianOrigin).toEqual(p0);
    expect(andrews.medianThrough).toEqual({ x: 100, y: 90 });
    expect(andrews.upperOrigin).toEqual(p1);
    expect(andrews.lowerOrigin).toEqual(p2);
    // Direction vector is (100, -10) for all 3 prongs
    expect(andrews.upperThrough).toEqual({ x: 200, y: 30 });
    expect(andrews.lowerThrough).toEqual({ x: 200, y: 130 });

    const schiff = calculatePitchfork(p0, p1, p2, 'schiff');
    expect(schiff.medianOrigin).toEqual({ x: 50, y: 70 });
    expect(schiff.medianThrough).toEqual({ x: 100, y: 90 });
    // Schiff direction vector is (50, +20)
    expect(schiff.upperThrough).toEqual({ x: 150, y: 60 });
    expect(schiff.lowerThrough).toEqual({ x: 150, y: 160 });
  });

  it('computes 9 Gann Fan rays (1x8 through 8x1) calibrated by the 1x1 ray', () => {
    const rays = calculateGannFanRays({ x: 10, y: 200 }, { x: 110, y: 100 });
    expect(rays).toHaveLength(9);
    const ray1x1 = rays.find((r) => r.label === '1x1');
    const ray2x1 = rays.find((r) => r.label === '2x1');
    const ray1x2 = rays.find((r) => r.label === '1x2');
    expect(ray1x1?.through).toEqual({ x: 110, y: 100 });
    expect(ray2x1?.through).toEqual({ x: 110, y: 0 });
    expect(ray1x2?.through).toEqual({ x: 110, y: 150 });
  });

  it('computes Fixed-Range Volume Profile with POC, 70% Value Area, and buy/sell split', () => {
    // Cluster heavy volume near price 110 (indices 3..6), light volume elsewhere
    const candles: Candle[] = [
      { time: 1, open: 100, high: 102, low: 98, close: 101, volume: 100 },
      { time: 2, open: 101, high: 105, low: 100, close: 104, volume: 150 },
      { time: 3, open: 108, high: 111, low: 108, close: 110, volume: 1200 },
      { time: 4, open: 109, high: 112, low: 109, close: 111, volume: 1500 },
      { time: 5, open: 110, high: 112, low: 109, close: 109.5, volume: 1400 },
      { time: 6, open: 115, high: 120, low: 114, close: 119, volume: 120 },
    ];

    const vp = calculateFixedRangeVolumeProfile(candles, 0, 5, 12);
    expect(vp).not.toBeNull();
    expect(vp!.bins).toHaveLength(12);
    expect(vp!.totalVolume).toBeCloseTo(4470, 4);
    // POC must land inside the high-volume cluster [108..112]
    expect(vp!.pocPrice).toBeGreaterThanOrEqual(108);
    expect(vp!.pocPrice).toBeLessThanOrEqual(112.5);
    // Value area bounds must wrap the POC and lie within [minPrice, maxPrice]
    expect(vp!.valPrice).toBeLessThanOrEqual(vp!.pocPrice);
    expect(vp!.vahPrice).toBeGreaterThanOrEqual(vp!.pocPrice);
    expect(vp!.valPrice).toBeGreaterThanOrEqual(vp!.minPrice - 1e-6);
    expect(vp!.vahPrice).toBeLessThanOrEqual(vp!.maxPrice + 1e-6);
    // Sum of buy + sell across all bins equals totalVolume
    const summed = vp!.bins.reduce((s, b) => s + b.buyVolume + b.sellVolume, 0);
    expect(summed).toBeCloseTo(vp!.totalVolume, 4);
    // At least 70% of volume is flagged inside Value Area
    const vaVol = vp!.bins
      .filter((b) => b.inValueArea)
      .reduce((s, b) => s + b.totalVolume, 0);
    expect(vaVol / vp!.totalVolume).toBeGreaterThanOrEqual(0.7);
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
    expect(snapPriceToCandle(109.5, candle, 'weak', 2)).toBe(110);
    expect(snapPriceToCandle(125, candle, 'weak', 2)).toBe(125);
  });

  it('hit-tests handles and geometry across canonical, pro, and legacy drawing types', () => {
    const toScreen = (p: DrawingPoint): ScreenPoint => ({ x: p.time, y: p.price });
    const baseStyle = { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' as const };

    const trendline: DrawingObject = {
      id: 'd1',
      symbol: 'RACE',
      type: 'trendline',
      points: [
        { time: 10, price: 20 },
        { time: 110, price: 20 },
      ],
      style: baseStyle,
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

    expect(hitTestDrawing(trendline, { x: 60, y: 50 }, toScreen, 8).hit).toBe(false);
    expect(hitTestDrawing({ ...trendline, visible: false }, { x: 60, y: 20 }, toScreen).hit).toBe(false);

    // Cross line hits both horizontal & vertical axes
    const crossLine: DrawingObject = {
      ...trendline,
      id: 'd-cross',
      type: 'cross_line',
      points: [{ time: 200, price: 150 }],
    };
    expect(hitTestDrawing(crossLine, { x: 450, y: 152 }, toScreen, 8).hit).toBe(true);
    expect(hitTestDrawing(crossLine, { x: 202, y: 400 }, toScreen, 8).hit).toBe(true);
    expect(hitTestDrawing(crossLine, { x: 350, y: 350 }, toScreen, 8).hit).toBe(false);

    // Pitchfork hits median and prong rays
    const pitchfork: DrawingObject = {
      ...trendline,
      id: 'd-pf',
      type: 'pitchfork',
      points: [
        { time: 0, price: 100 },
        { time: 100, price: 40 },
        { time: 100, price: 140 },
      ],
    };
    expect(hitTestDrawing(pitchfork, { x: 150, y: 35 }, toScreen, 8).hit).toBe(true);
    expect(hitTestDrawing(pitchfork, { x: 150, y: 260 }, toScreen, 8).hit).toBe(false);

    // XABCD pattern polyline hit test
    const xabcd: DrawingObject = {
      ...trendline,
      id: 'd-xabcd',
      type: 'xabcd_pattern',
      points: [
        { time: 0, price: 100 },
        { time: 40, price: 40 },
        { time: 80, price: 80 },
        { time: 120, price: 30 },
        { time: 160, price: 90 },
      ],
    };
    expect(hitTestDrawing(xabcd, { x: 60, y: 60 }, toScreen, 8).hit).toBe(true);
    expect(hitTestDrawing(xabcd, { x: 60, y: 180 }, toScreen, 8).hit).toBe(false);

    // Circle perimeter hit test
    const circle: DrawingObject = {
      ...trendline,
      id: 'd-circle',
      type: 'circle',
      points: [
        { time: 100, price: 100 },
        { time: 150, price: 100 },
      ],
    };
    expect(hitTestDrawing(circle, { x: 100, y: 150 }, toScreen, 8).hit).toBe(true);
    expect(hitTestDrawing(circle, { x: 250, y: 250 }, toScreen, 8).hit).toBe(false);

    // Legacy alias `horizontalLine` works seamlessly
    const legacyHLine: DrawingObject = {
      ...trendline,
      id: 'd-legacy-h',
      type: 'horizontalLine',
      points: [{ time: 50, price: 220 }],
    };
    expect(hitTestDrawing(legacyHLine, { x: 500, y: 222 }, toScreen, 8).hit).toBe(true);
  });
});
