import {
  normalizeDrawingTool,
  type Candle,
  type DrawingObject,
  type DrawingPoint,
  type FibLevelLine,
  type FibTimeZoneLine,
  type FixedRangeVolumeProfileResult,
  type GannFanRay,
  type LinearRegressionResult,
  type MeasureResult,
  type PitchforkGeometry,
  type PositionMetrics,
  type ScreenPoint,
  type TrendAngleResult,
  type VolumeProfileBin,
} from '../types';

export const DEFAULT_FIB_RATIOS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618,
] as const;

export const DEFAULT_FIB_EXTENSION_RATIOS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618,
] as const;

export const FIB_TIME_SEQUENCE: readonly number[] = [
  0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89,
] as const;

const FIB_COLORS: Record<number, string> = {
  0: '#787B86',
  0.236: '#F23645',
  0.382: '#FF9800',
  0.5: '#089981',
  0.618: '#00BCD4',
  0.786: '#2962FF',
  1: '#787B86',
  1.272: '#9C27B0',
  1.618: '#AB47BC',
  2.618: '#E91E63',
};

const GANN_SPECS: ReadonlyArray<{ label: string; ratio: number; color: string }> = [
  { label: '1x8', ratio: 0.125, color: '#F23645' },
  { label: '1x4', ratio: 0.25, color: '#FF9800' },
  { label: '1x3', ratio: 1 / 3, color: '#FACC15' },
  { label: '1x2', ratio: 0.5, color: '#4CAF50' },
  { label: '1x1', ratio: 1, color: '#2962FF' },
  { label: '2x1', ratio: 2, color: '#00BCD4' },
  { label: '3x1', ratio: 3, color: '#7E57C2' },
  { label: '4x1', ratio: 4, color: '#E91E63' },
  { label: '8x1', ratio: 8, color: '#787B86' },
];

/** Euclidean distance between two screen points */
export function distanceBetween(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest Euclidean distance from point `p` to finite segment `[a, b]` */
export function distanceToSegment(
  p: ScreenPoint,
  a: ScreenPoint,
  b: ScreenPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Shortest Euclidean distance from point `p` to ray starting at `origin` through `through` */
export function distanceToRay(
  p: ScreenPoint,
  origin: ScreenPoint,
  through: ScreenPoint,
): number {
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - origin.x, p.y - origin.y);
  const t = Math.max(0, ((p.x - origin.x) * dx + (p.y - origin.y) * dy) / lenSq);
  const projX = origin.x + t * dx;
  const projY = origin.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Shortest Euclidean distance from point `p` to infinite line passing through `a` and `b` */
export function distanceToInfiniteLine(
  p: ScreenPoint,
  a: ScreenPoint,
  b: ScreenPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/**
 * Extends a ray or infinite line defined by screen points `a` and `b`
 * so it reaches cleanly to the viewport edges `[0..width, 0..height]`.
 */
export function extendLineToBounds(
  a: ScreenPoint,
  b: ScreenPoint,
  width: number,
  height: number,
  mode: 'ray' | 'extended',
): [ScreenPoint, ScreenPoint] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [a, b];

  const diag = Math.hypot(width, height) * 2;
  const ux = dx / len;
  const uy = dy / len;

  const start: ScreenPoint =
    mode === 'extended'
      ? { x: a.x - ux * diag, y: a.y - uy * diag }
      : { ...a };
  const end: ScreenPoint = { x: a.x + ux * diag, y: a.y + uy * diag };
  return [start, end];
}

/** Linear projection of a trendline price at an arbitrary Unix timestamp */
export function projectTrendlinePrice(
  p1: DrawingPoint,
  p2: DrawingPoint,
  targetTime: number,
): number {
  const dt = p2.time - p1.time;
  if (dt === 0) return p2.price;
  const slope = (p2.price - p1.price) / dt;
  return p1.price + slope * (targetTime - p1.time);
}

/** Compute Fibonacci retracement / extension price levels between two swing points */
export function calculateFibonacciLevels(
  startPrice: number,
  endPrice: number,
  ratios: readonly number[] = DEFAULT_FIB_RATIOS,
): FibLevelLine[] {
  const diff = endPrice - startPrice;
  return ratios.map((ratio) => ({
    ratio,
    label: `${(ratio * 100).toFixed(1).replace(/\.0$/, '')}%`,
    price: endPrice - diff * ratio,
    color: FIB_COLORS[ratio] ?? '#2962FF',
  }));
}

/**
 * 3-point Trend-Based Fibonacci Extension (`p0 -> p1` impulse projected from `p2`).
 */
export function calculateFibExtension(
  p0Price: number,
  p1Price: number,
  p2Price: number,
  levels: readonly number[] = DEFAULT_FIB_EXTENSION_RATIOS,
): FibLevelLine[] {
  const impulse = p1Price - p0Price;
  return levels.map((ratio) => ({
    ratio,
    label: `${ratio}`,
    price: p2Price + impulse * ratio,
    color: FIB_COLORS[ratio] ?? '#2962FF',
  }));
}

/**
 * Fibonacci Time Zones: vertical bar indices following Fibonacci sequence offsets
 * `0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89` scaled by `|idx1 - idx0|`.
 */
export function calculateFibTimeZones(
  idx0: number,
  idx1: number,
  maxIdx: number,
): FibTimeZoneLine[] {
  const unit = Math.max(1, Math.round(Math.abs(idx1 - idx0)));
  const dir = idx1 >= idx0 ? 1 : -1;
  const result: FibTimeZoneLine[] = [];

  for (const fib of FIB_TIME_SEQUENCE) {
    const barIndex = Math.round(idx0 + dir * fib * unit);
    if (barIndex >= 0 && barIndex <= maxIdx) {
      result.push({ fibNumber: fib, barIndex });
    }
  }

  return result;
}

/**
 * Ordinary Least Squares Linear Regression Channel (`±stdDevMult * σ` + Pearson R)
 * over candle indices `[startIdx..endIdx]`.
 */
export function calculateLinearRegression(
  candles: readonly Candle[],
  startIdx: number,
  endIdx: number,
  stdDevMult = 2,
): LinearRegressionResult | null {
  if (candles.length < 2) return null;
  const lo = Math.max(0, Math.min(candles.length - 1, Math.round(Math.min(startIdx, endIdx))));
  const hi = Math.max(0, Math.min(candles.length - 1, Math.round(Math.max(startIdx, endIdx))));
  const n = hi - lo + 1;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = candles[lo + i].close;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }

  const denomX = n * sumXX - sumX * sumX;
  const slope = denomX !== 0 ? (n * sumXY - sumX * sumY) / denomX : 0;
  const intercept = (sumY - slope * sumX) / n;

  let sqErr = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    const err = candles[lo + i].close - pred;
    sqErr += err * err;
  }
  const stdDev = Math.sqrt(sqErr / n);

  const denomY = n * sumYY - sumY * sumY;
  const rDenom = Math.sqrt(Math.max(0, denomX * denomY));
  const pearsonR =
    rDenom > 1e-12
      ? Math.max(-1, Math.min(1, (n * sumXY - sumX * sumY) / rDenom))
      : 0;

  const midStartPrice = intercept;
  const midEndPrice = intercept + slope * (n - 1);
  const band = stdDev * stdDevMult;

  return {
    startIdx: lo,
    endIdx: hi,
    slope,
    intercept,
    stdDev,
    pearsonR,
    midStartPrice,
    midEndPrice,
    upperStartPrice: midStartPrice + band,
    upperEndPrice: midEndPrice + band,
    lowerStartPrice: midStartPrice - band,
    lowerEndPrice: midEndPrice - band,
  };
}

/**
 * Trend Angle in visual screen coordinates (`-90..+90` degrees, positive = upward slope).
 */
export function calculateTrendAngle(
  p1Screen: ScreenPoint,
  p2Screen: ScreenPoint,
): TrendAngleResult {
  const dx = p2Screen.x - p1Screen.x;
  const dy = p2Screen.y - p1Screen.y;
  const distancePx = Math.hypot(dx, dy);
  // Screen Y increases downward, so invert dy for visual bullish/bearish angle
  let angleDegrees = 0;
  if (distancePx > 1e-6) {
    const rawDeg = (Math.atan2(-dy, Math.abs(dx) < 1e-6 ? 0 : dx) * 180) / Math.PI;
    // Fold into [-90, 90] when dragging right-to-left
    if (rawDeg > 90) angleDegrees = rawDeg - 180;
    else if (rawDeg < -90) angleDegrees = rawDeg + 180;
    else angleDegrees = rawDeg;
  }
  return {
    angleDegrees: Math.round(angleDegrees * 100) / 100,
    distancePx: Math.round(distancePx * 100) / 100,
    dx,
    dy,
  };
}

/**
 * Andrews' or Schiff Pitchfork geometry from 3 screen anchor points (`p0`, `p1`, `p2`).
 */
export function calculatePitchfork(
  p0: ScreenPoint,
  p1: ScreenPoint,
  p2: ScreenPoint,
  variant: 'andrews' | 'schiff' = 'andrews',
): PitchforkGeometry {
  const mid12: ScreenPoint = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };

  const medianOrigin: ScreenPoint =
    variant === 'schiff'
      ? { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
      : { ...p0 };

  const dirX = mid12.x - medianOrigin.x;
  const dirY = mid12.y - medianOrigin.y;

  // Ensure upper prong is visually higher (smaller screen Y)
  const upperOrigin = p1.y <= p2.y ? { ...p1 } : { ...p2 };
  const lowerOrigin = p1.y <= p2.y ? { ...p2 } : { ...p1 };

  return {
    variant,
    medianOrigin,
    medianThrough: mid12,
    upperOrigin,
    upperThrough: { x: upperOrigin.x + dirX, y: upperOrigin.y + dirY },
    lowerOrigin,
    lowerThrough: { x: lowerOrigin.x + dirX, y: lowerOrigin.y + dirY },
  };
}

/**
 * Classic Gann Fan rays (`1x8` through `8x1`) from origin `p0` calibrated by `1x1` handle `p1`.
 */
export function calculateGannFanRays(
  p0: ScreenPoint,
  p1: ScreenPoint,
): GannFanRay[] {
  const dx = Math.abs(p1.x - p0.x) < 1e-6 ? 100 : p1.x - p0.x;
  const dy = p1.y - p0.y;

  return GANN_SPECS.map((spec) => ({
    label: spec.label,
    ratio: spec.ratio,
    origin: { ...p0 },
    through: {
      x: p0.x + dx,
      y: p0.y + dy * spec.ratio,
    },
    color: spec.color,
  }));
}

/**
 * Fixed-Range Volume Profile (FRVP):
 * Horizontal volume histogram over `[startIdx..endIdx]` with buy/sell split,
 * Point of Control (`pocPrice`), and 70% Value Area (`valPrice`..`vahPrice`).
 */
export function calculateFixedRangeVolumeProfile(
  candles: readonly Candle[],
  startIdx: number,
  endIdx: number,
  binsCount = 24,
): FixedRangeVolumeProfileResult | null {
  if (candles.length === 0) return null;
  const lo = Math.max(0, Math.min(candles.length - 1, Math.round(Math.min(startIdx, endIdx))));
  const hi = Math.max(0, Math.min(candles.length - 1, Math.round(Math.max(startIdx, endIdx))));
  const numBins = Math.max(4, Math.min(120, Math.floor(binsCount)));

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (let i = lo; i <= hi; i++) {
    if (candles[i].low < minPrice) minPrice = candles[i].low;
    if (candles[i].high > maxPrice) maxPrice = candles[i].high;
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) return null;
  if (maxPrice <= minPrice) {
    maxPrice = minPrice + Math.max(minPrice * 0.001, 1e-6);
  }

  const step = (maxPrice - minPrice) / numBins;
  const buyVol = new Array<number>(numBins).fill(0);
  const sellVol = new Array<number>(numBins).fill(0);
  let totalVolume = 0;

  for (let i = lo; i <= hi; i++) {
    const c = candles[i];
    const vol = Math.max(0, c.volume);
    if (vol === 0) continue;
    totalVolume += vol;

    const range = c.high - c.low;
    const isBull = c.close >= c.open;
    // Distribute buy/sell proportion cleanly based on candle direction & close location
    const buyShare =
      range > 0
        ? Math.max(0.15, Math.min(0.85, (c.close - c.low) / range))
        : isBull
          ? 0.65
          : 0.35;

    const firstBin = Math.max(
      0,
      Math.min(numBins - 1, Math.floor((c.low - minPrice) / step)),
    );
    const lastBin = Math.max(
      0,
      Math.min(numBins - 1, Math.floor((c.high - minPrice) / step)),
    );
    const spanBins = lastBin - firstBin + 1;
    const volPerBin = vol / spanBins;

    for (let b = firstBin; b <= lastBin; b++) {
      buyVol[b] += volPerBin * buyShare;
      sellVol[b] += volPerBin * (1 - buyShare);
    }
  }

  let pocBinIndex = 0;
  let maxBinVol = 0;
  const binTotals = new Array<number>(numBins);
  for (let b = 0; b < numBins; b++) {
    const t = buyVol[b] + sellVol[b];
    binTotals[b] = t;
    if (t > maxBinVol) {
      maxBinVol = t;
      pocBinIndex = b;
    }
  }

  // Expand 70% Value Area outward from POC (classic Market Profile algorithm)
  const targetVA = totalVolume * 0.7;
  let vaLowIdx = pocBinIndex;
  let vaHighIdx = pocBinIndex;
  let accVol = binTotals[pocBinIndex];

  while (accVol < targetVA && (vaLowIdx > 0 || vaHighIdx < numBins - 1)) {
    const upVol = vaHighIdx + 1 < numBins ? binTotals[vaHighIdx + 1] : -1;
    const downVol = vaLowIdx - 1 >= 0 ? binTotals[vaLowIdx - 1] : -1;
    if (upVol >= downVol && vaHighIdx + 1 < numBins) {
      vaHighIdx += 1;
      accVol += binTotals[vaHighIdx];
    } else if (vaLowIdx - 1 >= 0) {
      vaLowIdx -= 1;
      accVol += binTotals[vaLowIdx];
    } else {
      break;
    }
  }

  const bins: VolumeProfileBin[] = new Array(numBins);
  for (let b = 0; b < numBins; b++) {
    const priceLow = minPrice + b * step;
    const priceHigh = priceLow + step;
    bins[b] = {
      priceLow,
      priceHigh,
      priceMid: (priceLow + priceHigh) / 2,
      totalVolume: binTotals[b],
      buyVolume: buyVol[b],
      sellVolume: sellVol[b],
      ratioToMax: maxBinVol > 0 ? binTotals[b] / maxBinVol : 0,
      inValueArea: b >= vaLowIdx && b <= vaHighIdx,
    };
  }

  return {
    startIdx: lo,
    endIdx: hi,
    minPrice,
    maxPrice,
    totalVolume,
    pocPrice: bins[pocBinIndex].priceMid,
    pocBinIndex,
    vahPrice: bins[vaHighIdx].priceHigh,
    valPrice: bins[vaLowIdx].priceLow,
    bins,
  };
}

export interface ParallelChannelGeometry {
  baseStart: ScreenPoint;
  baseEnd: ScreenPoint;
  offsetStart: ScreenPoint;
  offsetEnd: ScreenPoint;
  midStart: ScreenPoint;
  midEnd: ScreenPoint;
  channelHeightPx: number;
}

/**
 * Given 3 screen points (`p1`, `p2` defining the base edge and `p3` defining parallel offset),
 * returns the upper/lower parallel edges and centerline of the channel.
 */
export function calculateParallelChannel(
  p1: ScreenPoint,
  p2: ScreenPoint,
  p3: ScreenPoint,
): ParallelChannelGeometry {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  // Project p3 onto line p1->p2 to extract perpendicular offset vector
  let ox = 0;
  let oy = p3.y - p1.y;
  if (lenSq > 1e-6) {
    const t = ((p3.x - p1.x) * dx + (p3.y - p1.y) * dy) / lenSq;
    const footX = p1.x + t * dx;
    const footY = p1.y + t * dy;
    ox = p3.x - footX;
    oy = p3.y - footY;
  }

  const offsetStart = { x: p1.x + ox, y: p1.y + oy };
  const offsetEnd = { x: p2.x + ox, y: p2.y + oy };
  const midStart = { x: p1.x + ox / 2, y: p1.y + oy / 2 };
  const midEnd = { x: p2.x + ox / 2, y: p2.y + oy / 2 };

  return {
    baseStart: p1,
    baseEnd: p2,
    offsetStart,
    offsetEnd,
    midStart,
    midEnd,
    channelHeightPx: Math.hypot(ox, oy),
  };
}

/** Measure tool calculations: price delta, percentage change, bar count, and elapsed time */
export function calculateMeasure(
  p1: DrawingPoint,
  p2: DrawingPoint,
  candles?: readonly Candle[],
): MeasureResult {
  const priceDelta = p2.price - p1.price;
  const percentDelta = p1.price !== 0 ? (priceDelta / p1.price) * 100 : 0;
  const timeSpanSeconds = Math.abs(p2.time - p1.time);

  let bars = 0;
  if (candles && candles.length >= 2) {
    const minT = Math.min(p1.time, p2.time);
    const maxT = Math.max(p1.time, p2.time);
    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time >= minT && firstIdx === -1) firstIdx = i;
      if (candles[i].time <= maxT) lastIdx = i;
    }
    if (firstIdx !== -1 && lastIdx >= firstIdx) {
      bars = lastIdx - firstIdx;
    } else {
      const step = Math.max(1, candles[1].time - candles[0].time);
      bars = Math.round(timeSpanSeconds / step);
    }
  }

  return {
    startPrice: p1.price,
    endPrice: p2.price,
    priceDelta,
    percentDelta,
    bars,
    timeSpanSeconds,
    isPositive: priceDelta >= 0,
  };
}

/** Long / Short Risk-Reward position drawing metrics */
export function calculatePositionMetrics(
  side: 'long' | 'short',
  entryPrice: number,
  stopPrice: number,
  targetPrice: number,
): PositionMetrics {
  const riskAmount =
    side === 'long'
      ? Math.max(0, entryPrice - stopPrice)
      : Math.max(0, stopPrice - entryPrice);
  const rewardAmount =
    side === 'long'
      ? Math.max(0, targetPrice - entryPrice)
      : Math.max(0, entryPrice - targetPrice);

  const riskPercent = entryPrice > 0 ? (riskAmount / entryPrice) * 100 : 0;
  const rewardPercent = entryPrice > 0 ? (rewardAmount / entryPrice) * 100 : 0;
  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  return {
    side,
    entryPrice,
    stopPrice,
    targetPrice,
    riskAmount,
    rewardAmount,
    riskPercent,
    rewardPercent,
    riskRewardRatio,
  };
}

/**
 * TradingView Magnet Mode: snaps cursor price to the nearest OHLC value of the candle.
 * - `'strong'`: always snaps to nearest O/H/L/C
 * - `'weak'`: snaps only when within `thresholdPrice` distance
 */
export function snapPriceToCandle(
  targetPrice: number,
  candle: Candle,
  mode: 'weak' | 'strong' = 'strong',
  thresholdPrice?: number,
): number {
  const candidates = [candle.open, candle.high, candle.low, candle.close];
  let nearest = candidates[0];
  let bestDist = Math.abs(targetPrice - nearest);

  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(targetPrice - candidates[i]);
    if (d < bestDist) {
      bestDist = d;
      nearest = candidates[i];
    }
  }

  if (mode === 'weak') {
    const limit = thresholdPrice ?? Math.max((candle.high - candle.low) * 0.4, 1e-6);
    if (bestDist > limit) return targetPrice;
  }

  return nearest;
}

export interface DrawingHitResult {
  hit: boolean;
  /** Index of control anchor point if user hovered/clicked directly on a handle */
  handleIndex: number | null;
  distance: number;
}

function hitTestBox(
  cursor: ScreenPoint,
  a: ScreenPoint,
  b: ScreenPoint,
  tolerancePx: number,
): DrawingHitResult {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inside =
    cursor.x >= minX - tolerancePx &&
    cursor.x <= maxX + tolerancePx &&
    cursor.y >= minY - tolerancePx &&
    cursor.y <= maxY + tolerancePx;
  const edgeDist = Math.min(
    distanceToSegment(cursor, { x: minX, y: minY }, { x: maxX, y: minY }),
    distanceToSegment(cursor, { x: maxX, y: minY }, { x: maxX, y: maxY }),
    distanceToSegment(cursor, { x: maxX, y: maxY }, { x: minX, y: maxY }),
    distanceToSegment(cursor, { x: minX, y: maxY }, { x: minX, y: minY }),
  );
  return {
    hit: inside || edgeDist <= tolerancePx,
    handleIndex: null,
    distance: inside ? 0 : edgeDist,
  };
}

function hitTestPolyline(
  cursor: ScreenPoint,
  pts: readonly ScreenPoint[],
  tolerancePx: number,
  closed = false,
): DrawingHitResult {
  let minDist = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = distanceToSegment(cursor, pts[i - 1], pts[i]);
    if (d < minDist) minDist = d;
  }
  if (closed && pts.length >= 3) {
    const dClose = distanceToSegment(cursor, pts[pts.length - 1], pts[0]);
    if (dClose < minDist) minDist = dClose;
  }
  return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
}

/**
 * Unified screen-space hit testing for EVERY ONE of the 55+ TradingView drawing tool geometries
 * (plus legacy camelCase tool aliases).
 */
export function hitTestDrawing(
  drawing: DrawingObject,
  cursor: ScreenPoint,
  toScreen: (point: DrawingPoint) => ScreenPoint,
  tolerancePx = 8,
): DrawingHitResult {
  if (!drawing.visible || drawing.points.length === 0) {
    return { hit: false, handleIndex: null, distance: Infinity };
  }

  const pts = drawing.points.map(toScreen);

  // Check control handles first (for dragging individual anchors)
  for (let i = 0; i < pts.length; i++) {
    const d = distanceBetween(cursor, pts[i]);
    if (d <= tolerancePx + 2) {
      return { hit: true, handleIndex: i, distance: d };
    }
  }

  const canonical = normalizeDrawingTool(drawing.type);

  switch (canonical) {
    // 2-point finite line segments
    case 'trendline':
    case 'info_line':
    case 'trend_angle':
    case 'arrow_line':
    case 'arrow_marker':
    case 'measure':
    case 'forecast': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToSegment(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'ray': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToRay(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'extended_line': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToInfiniteLine(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'hline': {
      const d = Math.abs(cursor.y - pts[0].y);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'hray': {
      const d =
        cursor.x >= pts[0].x - tolerancePx
          ? Math.abs(cursor.y - pts[0].y)
          : distanceBetween(cursor, pts[0]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'vline': {
      const d = Math.abs(cursor.x - pts[0].x);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'cross_line': {
      const d = Math.min(Math.abs(cursor.x - pts[0].x), Math.abs(cursor.y - pts[0].y));
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'channel':
    case 'flat_channel':
    case 'disjoint_channel':
    case 'fib_channel':
    case 'rotated_rectangle': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y + 30 };
      const geom = calculateParallelChannel(pts[0], pts[1], p3);
      const d = Math.min(
        distanceToSegment(cursor, geom.baseStart, geom.baseEnd),
        distanceToSegment(cursor, geom.offsetStart, geom.offsetEnd),
        distanceToSegment(cursor, geom.midStart, geom.midEnd),
        distanceToSegment(cursor, geom.baseStart, geom.offsetStart),
        distanceToSegment(cursor, geom.baseEnd, geom.offsetEnd),
      );
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'pitchfork':
    case 'schiff_pitchfork': {
      if (pts.length < 3) {
        return hitTestPolyline(cursor, pts, tolerancePx);
      }
      const pf = calculatePitchfork(
        pts[0],
        pts[1],
        pts[2],
        canonical === 'schiff_pitchfork' ? 'schiff' : 'andrews',
      );
      const d = Math.min(
        distanceToRay(cursor, pf.medianOrigin, pf.medianThrough),
        distanceToRay(cursor, pf.upperOrigin, pf.upperThrough),
        distanceToRay(cursor, pf.lowerOrigin, pf.lowerThrough),
        distanceToSegment(cursor, pts[1], pts[2]),
      );
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'gann_fan':
    case 'fib_speed_fan': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const rays = calculateGannFanRays(pts[0], pts[1]);
      let minDist = distanceToRay(cursor, pts[0], pts[1]);
      for (const ray of rays) {
        const d = distanceToRay(cursor, ray.origin, ray.through);
        if (d < minDist) minDist = d;
      }
      return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
    }

    case 'fib_time_zone':
    case 'cyclic_lines': {
      if (pts.length < 2) {
        const d = Math.abs(cursor.x - pts[0].x);
        return { hit: d <= tolerancePx, handleIndex: null, distance: d };
      }
      const step = Math.max(8, Math.abs(pts[1].x - pts[0].x));
      const dir = pts[1].x >= pts[0].x ? 1 : -1;
      const mults =
        canonical === 'fib_time_zone'
          ? [0, 1, 2, 3, 5, 8, 13, 21]
          : [0, 1, 2, 3, 4, 5, 6, 7, 8];
      let minDist = Infinity;
      for (const m of mults) {
        const x = pts[0].x + dir * m * step;
        const d = Math.abs(cursor.x - x);
        if (d < minDist) minDist = d;
      }
      return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
    }

    case 'fib_circles':
    case 'circle': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const r = distanceBetween(pts[0], pts[1]);
      const dCenter = distanceBetween(cursor, pts[0]);
      if (canonical === 'circle') {
        const inside = dCenter <= r + tolerancePx;
        return {
          hit: inside,
          handleIndex: null,
          distance: inside ? Math.abs(dCenter - r) : dCenter - r,
        };
      }
      // Concentric Fibonacci circle rings
      let minDist = Infinity;
      for (const ratio of [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618]) {
        const ringDist = Math.abs(dCenter - r * ratio);
        if (ringDist < minDist) minDist = ringDist;
      }
      return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
    }

    case 'ellipse': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const rx = Math.max(1, Math.abs(pts[1].x - pts[0].x) / 2);
      const ry = Math.max(1, Math.abs(pts[1].y - pts[0].y) / 2);
      const norm =
        Math.pow((cursor.x - cx) / (rx + tolerancePx), 2) +
        Math.pow((cursor.y - cy) / (ry + tolerancePx), 2);
      return { hit: norm <= 1, handleIndex: null, distance: norm <= 1 ? 0 : norm };
    }

    case 'triangle': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      return hitTestPolyline(cursor, pts, tolerancePx, pts.length >= 3);
    }

    case 'curve':
    case 'arc': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      if (pts.length === 2) {
        const d = distanceToSegment(cursor, pts[0], pts[1]);
        return { hit: d <= tolerancePx, handleIndex: null, distance: d };
      }
      // Sample quadratic Bezier curve passing near control handle pts[2]
      const [p0, p2, ctrl] = [pts[0], pts[1], pts[2]];
      let minDist = Infinity;
      let prev = p0;
      const steps = 20;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const mt = 1 - t;
        const curr: ScreenPoint = {
          x: mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p2.x,
          y: mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p2.y,
        };
        const d = distanceToSegment(cursor, prev, curr);
        if (d < minDist) minDist = d;
        prev = curr;
      }
      return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
    }

    case 'rectangle':
    case 'fib_retracement':
    case 'fib_extension':
    case 'gann_box':
    case 'regression_trend':
    case 'long_position':
    case 'short_position':
    case 'price_range':
    case 'date_range':
    case 'date_price_range':
    case 'volume_profile_fixed':
    case 'bars_pattern':
    case 'zoom_box': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      // For 3-point fib_extension, compute bounding box across all points
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      return hitTestBox(cursor, { x: minX, y: minY }, { x: maxX, y: maxY }, tolerancePx);
    }

    case 'brush':
    case 'highlighter':
    case 'path':
    case 'xabcd_pattern':
    case 'cypher_pattern':
    case 'head_shoulders':
    case 'elliott_impulse':
    case 'elliott_correction': {
      const tol = canonical === 'highlighter' ? tolerancePx + 6 : tolerancePx;
      return hitTestPolyline(cursor, pts, tol);
    }

    case 'text':
    case 'anchored_text':
    case 'price_label':
    case 'flag_mark':
    case 'arrow_up':
    case 'arrow_down': {
      const boxW =
        canonical === 'flag_mark' || canonical === 'arrow_up' || canonical === 'arrow_down'
          ? 28
          : Math.max(84, (drawing.text?.length ?? 6) * 8);
      const boxH = 28;
      const inside =
        cursor.x >= pts[0].x - tolerancePx - 6 &&
        cursor.x <= pts[0].x + boxW + tolerancePx &&
        cursor.y >= pts[0].y - boxH &&
        cursor.y <= pts[0].y + tolerancePx + 6;
      return {
        hit: inside,
        handleIndex: null,
        distance: inside ? 0 : distanceBetween(cursor, pts[0]),
      };
    }

    case 'note':
    case 'price_note':
    case 'callout': {
      if (pts.length >= 2) {
        const lineDist = distanceToSegment(cursor, pts[0], pts[1]);
        const anchor = pts[1];
        const boxW = Math.max(96, (drawing.text?.length ?? 8) * 8);
        const insideBox =
          cursor.x >= anchor.x - tolerancePx &&
          cursor.x <= anchor.x + boxW + tolerancePx &&
          cursor.y >= anchor.y - 32 &&
          cursor.y <= anchor.y + tolerancePx;
        return {
          hit: insideBox || lineDist <= tolerancePx,
          handleIndex: null,
          distance: insideBox ? 0 : lineDist,
        };
      }
      const d = distanceBetween(cursor, pts[0]);
      return { hit: d <= tolerancePx + 14, handleIndex: null, distance: d };
    }

    default: {
      const d = distanceBetween(cursor, pts[0]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }
  }
}
