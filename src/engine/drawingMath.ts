import type {
  Candle,
  DrawingObject,
  DrawingPoint,
  FibLevelLine,
  MeasureResult,
  PositionMetrics,
  ScreenPoint,
} from '../types';

export const DEFAULT_FIB_RATIOS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618,
] as const;

const FIB_COLORS: Record<number, string> = {
  0: '#787B86',
  0.236: '#F23645',
  0.382: '#FF9800',
  0.5: '#089981',
  0.618: '#00BCD4',
  0.786: '#2962FF',
  1: '#787B86',
  1.618: '#AB47BC',
};

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

/**
 * Unified screen-space hit testing for every drawing object type.
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

  switch (drawing.type) {
    case 'trendline':
    case 'arrow':
    case 'measure': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToSegment(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'ray': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToRay(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'extendedLine': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const d = distanceToInfiniteLine(cursor, pts[0], pts[1]);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'horizontalLine': {
      const d = Math.abs(cursor.y - pts[0].y);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'verticalLine': {
      const d = Math.abs(cursor.x - pts[0].x);
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'parallelChannel': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y + 30 };
      const geom = calculateParallelChannel(pts[0], pts[1], p3);
      const d = Math.min(
        distanceToSegment(cursor, geom.baseStart, geom.baseEnd),
        distanceToSegment(cursor, geom.offsetStart, geom.offsetEnd),
        distanceToSegment(cursor, geom.midStart, geom.midEnd),
      );
      return { hit: d <= tolerancePx, handleIndex: null, distance: d };
    }

    case 'rectangle':
    case 'fibRetracement':
    case 'longPosition':
    case 'shortPosition': {
      if (pts.length < 2) return { hit: false, handleIndex: null, distance: Infinity };
      const minX = Math.min(pts[0].x, pts[1].x);
      const maxX = Math.max(pts[0].x, pts[1].x);
      const minY = Math.min(pts[0].y, pts[1].y);
      const maxY = Math.max(pts[0].y, pts[1].y);
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

    case 'brush': {
      let minDist = Infinity;
      for (let i = 1; i < pts.length; i++) {
        const d = distanceToSegment(cursor, pts[i - 1], pts[i]);
        if (d < minDist) minDist = d;
      }
      return { hit: minDist <= tolerancePx, handleIndex: null, distance: minDist };
    }

    case 'text':
    case 'callout': {
      const boxW = Math.max(80, (drawing.text?.length ?? 6) * 8);
      const boxH = 26;
      const inside =
        cursor.x >= pts[0].x - tolerancePx &&
        cursor.x <= pts[0].x + boxW + tolerancePx &&
        cursor.y >= pts[0].y - boxH &&
        cursor.y <= pts[0].y + tolerancePx;
      return {
        hit: inside,
        handleIndex: null,
        distance: inside ? 0 : distanceBetween(cursor, pts[0]),
      };
    }
  }
}
