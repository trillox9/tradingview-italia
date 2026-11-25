import type {
  AlertRule,
  Candle,
  ChartType,
  DrawingObject,
  DrawingPoint,
  IndicatorSeries,
  LineStyle,
  PaperPosition,
  ScreenPoint,
  SymbolInfo,
  Timeframe,
} from '../../types';
import { formatPrice, formatVolume } from '../../data';
import {
  calculateFibonacciLevels,
  calculateMeasure,
  calculateParallelChannel,
  calculatePositionMetrics,
  extendLineToBounds,
} from '../../engine';
import type { ScaleMode, ThemeMode } from '../../store';

export const PRICE_AXIS_WIDTH = 58;
export const TIME_AXIS_HEIGHT = 28;
export const COMPARE_COLORS = ['#FF9800', '#AB47BC', '#00BCD4', '#E91E63', '#8BC34A'];

/** Dynamically size the right price axis so 6-8 decimal sub-cent coins never clip */
export function computePriceAxisWidth(
  precision: number,
  scaleMode: ScaleMode,
): number {
  if (scaleMode === 'percent') return 58;
  if (precision >= 7) return 84;
  if (precision >= 5) return 76;
  if (precision >= 4) return 66;
  return PRICE_AXIS_WIDTH;
}

export interface ViewportState {
  /** Number of bars visible horizontally */
  visibleBars: number;
  /** Rightmost bar index (can exceed candles.length - 1 for right whitespace padding) */
  rightIndex: number;
  /** Vertical zoom multiplier when manual scaling (!autoScale) */
  yZoom: number;
  /** Vertical pan shift in normalized range units when !autoScale */
  yOffset: number;
}

export interface PaneRect {
  top: number;
  height: number;
  bottom: number;
}

export interface SubPaneLayout {
  series: IndicatorSeries;
  rect: PaneRect;
  min: number;
  max: number;
}

export interface ChartLayoutMetrics {
  width: number;
  height: number;
  priceAxisWidth: number;
  plotWidth: number;
  mainRect: PaneRect;
  subPanes: SubPaneLayout[];
  timeAxisTop: number;
  leftIndex: number;
  rightIndex: number;
  barStepPx: number;
  scaleMode: ScaleMode;
  basePrice: number;
  mainMin: number;
  mainMax: number;
}

export interface CompareSeriesData {
  ticker: string;
  color: string;
  candles: Candle[];
  byTime: Map<number, number>;
}

export interface CrosshairState {
  x: number;
  y: number;
  barIndex: number;
  visible: boolean;
}

export interface RenderChartParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  theme: ThemeMode;
  symbol: SymbolInfo;
  timeframe: Timeframe;
  chartType: ChartType;
  candles: Candle[];
  rawCandles: Candle[];
  viewport: ViewportState;
  scaleMode: ScaleMode;
  autoScale: boolean;
  showVolume: boolean;
  showGrid: boolean;
  countdownText: string | null;
  overlaySeries: IndicatorSeries[];
  separateSeries: IndicatorSeries[];
  compareSeries: CompareSeriesData[];
  drawings: DrawingObject[];
  draftDrawing: DrawingObject | null;
  selectedDrawingId: string | null;
  hideDrawings: boolean;
  positions: PaperPosition[];
  alerts: AlertRule[];
  crosshair: CrosshairState;
}

export interface ChartPalette {
  bg: string;
  grid: string;
  axisBorder: string;
  axisText: string;
  watermark: string;
  up: string;
  down: string;
  volUp: string;
  volDown: string;
  line: string;
  areaTop: string;
  areaBottom: string;
  crosshair: string;
  pillBg: string;
  pillText: string;
  text: string;
  subShade: string;
}

export function getChartPalette(theme: ThemeMode): ChartPalette {
  if (theme === 'dark') {
    return {
      bg: '#000000',
      grid: 'rgba(255, 255, 255, 0.055)',
      axisBorder: '#2a2a2a',
      axisText: '#8c8c8c',
      watermark: 'rgba(255, 255, 255, 0.045)',
      up: '#089981',
      down: '#f23645',
      volUp: 'rgba(8, 153, 129, 0.36)',
      volDown: 'rgba(242, 54, 69, 0.36)',
      line: '#2962ff',
      areaTop: 'rgba(41, 98, 255, 0.30)',
      areaBottom: 'rgba(41, 98, 255, 0.01)',
      crosshair: '#707070',
      pillBg: '#303030',
      pillText: '#ffffff',
      text: '#b8b8b8',
      subShade: 'rgba(126, 87, 194, 0.08)',
    };
  }
  return {
    bg: '#ffffff',
    grid: '#f0f3fa',
    axisBorder: '#e2e5ec',
    axisText: '#707070',
    watermark: 'rgba(0, 0, 0, 0.04)',
    up: '#089981',
    down: '#f23645',
    volUp: 'rgba(8, 153, 129, 0.30)',
    volDown: 'rgba(242, 54, 69, 0.30)',
    line: '#2962ff',
    areaTop: 'rgba(41, 98, 255, 0.24)',
    areaBottom: 'rgba(41, 98, 255, 0.01)',
    crosshair: '#8c8c8c',
    pillBg: '#131313',
    pillText: '#ffffff',
    text: '#131313',
    subShade: 'rgba(126, 87, 194, 0.07)',
  };
}

function setDash(ctx: CanvasRenderingContext2D, style?: LineStyle) {
  if (style === 'dashed') ctx.setLineDash([5, 4]);
  else if (style === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);
}

/** Transform raw price into scaled numeric domain (regular, log, or percent) */
export function toScaledValue(
  price: number,
  mode: ScaleMode,
  basePrice: number,
): number {
  if (mode === 'percent') {
    const base = basePrice > 0 ? basePrice : 1;
    return ((price - base) / base) * 100;
  }
  if (mode === 'log') {
    return Math.log(Math.max(price, 1e-12));
  }
  return price;
}

export function fromScaledValue(
  scaled: number,
  mode: ScaleMode,
  basePrice: number,
): number {
  if (mode === 'percent') {
    const base = basePrice > 0 ? basePrice : 1;
    return base * (1 + scaled / 100);
  }
  if (mode === 'log') {
    return Math.exp(scaled);
  }
  return scaled;
}

export function priceToY(
  price: number,
  layout: ChartLayoutMetrics,
): number {
  const s = toScaledValue(price, layout.scaleMode, layout.basePrice);
  const span = Math.max(1e-12, layout.mainMax - layout.mainMin);
  const ratio = (s - layout.mainMin) / span;
  return layout.mainRect.bottom - ratio * layout.mainRect.height;
}

export function yToPrice(y: number, layout: ChartLayoutMetrics): number {
  const ratio = (layout.mainRect.bottom - y) / Math.max(1, layout.mainRect.height);
  const scaled = layout.mainMin + ratio * (layout.mainMax - layout.mainMin);
  return fromScaledValue(scaled, layout.scaleMode, layout.basePrice);
}

export function indexToX(index: number, layout: ChartLayoutMetrics): number {
  return (index - layout.leftIndex + 0.5) * layout.barStepPx;
}

export function xToIndex(x: number, layout: ChartLayoutMetrics): number {
  return layout.leftIndex + x / Math.max(1e-6, layout.barStepPx) - 0.5;
}

export function timeToIndex(time: number, candles: readonly Candle[]): number {
  if (candles.length === 0) return 0;
  if (candles.length === 1) return 0;
  const step = Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time);
  if (time <= candles[0].time) {
    return (time - candles[0].time) / step;
  }
  if (time >= candles[candles.length - 1].time) {
    return candles.length - 1 + (time - candles[candles.length - 1].time) / step;
  }
  // Binary search for exact / interpolated bar index
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].time;
    if (t === time) return mid;
    if (t < time) lo = mid + 1;
    else hi = mid - 1;
  }
  const prevIdx = Math.max(0, lo - 1);
  const nextIdx = Math.min(candles.length - 1, lo);
  const dt = candles[nextIdx].time - candles[prevIdx].time;
  if (dt <= 0) return prevIdx;
  return prevIdx + (time - candles[prevIdx].time) / dt;
}

export function indexToTime(index: number, candles: readonly Candle[]): number {
  if (candles.length === 0) return Math.floor(Date.now() / 1000);
  if (candles.length === 1) return candles[0].time;
  const step = Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time);
  const clamped = Math.round(index);
  if (clamped < 0) return candles[0].time + clamped * step;
  if (clamped >= candles.length) {
    return candles[candles.length - 1].time + (clamped - (candles.length - 1)) * step;
  }
  return candles[clamped].time;
}

export function computeChartLayout(params: {
  width: number;
  height: number;
  precision?: number;
  candles: Candle[];
  viewport: ViewportState;
  scaleMode: ScaleMode;
  autoScale: boolean;
  overlaySeries: IndicatorSeries[];
  separateSeries: IndicatorSeries[];
  compareSeries: CompareSeriesData[];
}): ChartLayoutMetrics {
  const {
    width,
    height,
    precision = 2,
    candles,
    viewport,
    autoScale,
    overlaySeries,
    separateSeries,
    compareSeries,
  } = params;

  const effectiveScale: ScaleMode =
    compareSeries.length > 0 ? 'percent' : params.scaleMode;

  const priceAxisWidth = computePriceAxisWidth(precision, effectiveScale);
  const plotWidth = Math.max(60, width - priceAxisWidth);
  const usableHeight = Math.max(100, height - TIME_AXIS_HEIGHT);
  const subCount = separateSeries.length;
  const maxSubTotal = Math.floor(usableHeight * 0.46);
  const singleSubH =
    subCount > 0
      ? Math.max(68, Math.min(126, Math.floor(maxSubTotal / subCount)))
      : 0;
  const totalSubH = singleSubH * subCount;
  const mainH = Math.max(80, usableHeight - totalSubH);

  const mainRect: PaneRect = {
    top: 0,
    height: mainH,
    bottom: mainH,
  };

  const visibleBars = Math.max(12, Math.min(400, viewport.visibleBars));
  // Guard against an off-screen rightIndex after async real-candle replacement
  const maxAllowedRight =
    candles.length > 0
      ? candles.length + Math.max(8, visibleBars * 0.75)
      : visibleBars;
  const rightIndex = Math.max(4, Math.min(maxAllowedRight, viewport.rightIndex));
  const leftIndex = rightIndex - visibleBars;
  const barStepPx = plotWidth / visibleBars;

  const startIdx = Math.max(0, Math.floor(leftIndex));
  const endIdx = Math.min(candles.length - 1, Math.ceil(rightIndex));
  const basePrice =
    candles[startIdx]?.close ?? candles[0]?.close ?? 1;

  // Compute min/max in scaled units across visible bars + overlay series + compare series
  let sMin = Infinity;
  let sMax = -Infinity;

  for (let i = startIdx; i <= endIdx; i++) {
    const c = candles[i];
    if (!c) continue;
    const lo = toScaledValue(c.low, effectiveScale, basePrice);
    const hi = toScaledValue(c.high, effectiveScale, basePrice);
    if (lo < sMin) sMin = lo;
    if (hi > sMax) sMax = hi;
  }

  for (const ind of overlaySeries) {
    for (const plot of ind.plots) {
      for (let i = startIdx; i <= endIdx; i++) {
        const pt = plot.data[i];
        if (!pt || pt.value == null || !Number.isFinite(pt.value)) continue;
        const v = toScaledValue(pt.value, effectiveScale, basePrice);
        if (v < sMin) sMin = v;
        if (v > sMax) sMax = v;
      }
    }
  }

  if (compareSeries.length > 0 && effectiveScale === 'percent') {
    for (const comp of compareSeries) {
      const firstT = candles[startIdx]?.time;
      const compBase =
        (firstT != null ? comp.byTime.get(firstT) : undefined) ??
        comp.candles[0]?.close ??
        1;
      for (let i = startIdx; i <= endIdx; i++) {
        const t = candles[i]?.time;
        if (t == null) continue;
        const v = comp.byTime.get(t);
        if (v == null || !Number.isFinite(v)) continue;
        const pct = ((v - compBase) / Math.max(1e-12, compBase)) * 100;
        if (pct < sMin) sMin = pct;
        if (pct > sMax) sMax = pct;
      }
    }
  }

  if (!Number.isFinite(sMin) || !Number.isFinite(sMax)) {
    sMin = 0;
    sMax = 100;
  }
  if (Math.abs(sMax - sMin) < 1e-12) {
    const pad = Math.abs(sMax) > 0 ? Math.abs(sMax) * 0.02 : 1e-6;
    sMin -= pad;
    sMax += pad;
  }

  // Padding: leave room at top for legend (12%) and bottom for volume (16%)
  const rawSpan = sMax - sMin;
  let mainMin = sMin - rawSpan * 0.16;
  let mainMax = sMax + rawSpan * 0.12;

  if (!autoScale) {
    const mid = (mainMin + mainMax) / 2 + viewport.yOffset * rawSpan;
    const half = ((mainMax - mainMin) / 2) / Math.max(0.2, Math.min(8, viewport.yZoom));
    mainMin = mid - half;
    mainMax = mid + half;
  }

  // Compute sub-pane rects and ranges
  const subPanes: SubPaneLayout[] = [];
  let cursorTop = mainH;
  for (const s of separateSeries) {
    const rect: PaneRect = {
      top: cursorTop,
      height: singleSubH,
      bottom: cursorTop + singleSubH,
    };
    cursorTop += singleSubH;

    let minV = s.priceRange?.min ?? Infinity;
    let maxV = s.priceRange?.max ?? -Infinity;
    if (!s.priceRange) {
      for (const plot of s.plots) {
        for (let i = startIdx; i <= endIdx; i++) {
          const val = plot.data[i]?.value;
          if (val == null || !Number.isFinite(val)) continue;
          if (val < minV) minV = val;
          if (val > maxV) maxV = val;
        }
      }
      if (s.hlines) {
        for (const hl of s.hlines) {
          if (hl.value < minV) minV = hl.value;
          if (hl.value > maxV) maxV = hl.value;
        }
      }
      if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
        minV = 0;
        maxV = 100;
      }
      if (Math.abs(maxV - minV) < 1e-12) {
        const p = Math.abs(maxV) > 0 ? Math.abs(maxV) * 0.05 : 1;
        minV -= p;
        maxV += p;
      }
      const pad = (maxV - minV) * 0.12;
      minV -= pad;
      maxV += pad;
    }

    subPanes.push({ series: s, rect, min: minV, max: maxV });
  }

  return {
    width,
    height,
    priceAxisWidth,
    plotWidth,
    mainRect,
    subPanes,
    timeAxisTop: usableHeight,
    leftIndex,
    rightIndex,
    barStepPx,
    scaleMode: effectiveScale,
    basePrice,
    mainMin,
    mainMax,
  };
}

function niceTicks(min: number, max: number, approxCount: number): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [];
  const rawStep = span / Math.max(2, approxCount);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let nice = 1;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  const step = nice * mag;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 0.001 && out.length < 30; v += step) {
    out.push(v);
  }
  return out;
}

function formatAxisTime(sec: number, timeframe: Timeframe, full = false): string {
  const d = new Date(sec * 1000);
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  if (full) {
    if (timeframe === '1D' || timeframe === '1W' || timeframe === '1M') {
      return `${dd} ${mon} '${yy}`;
    }
    return `${dd} ${mon} '${yy} ${hh}:${mm}`;
  }

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    return `${hh}:${mm}`;
  }
  if (timeframe === '1H' || timeframe === '4H') {
    return d.getHours() === 0 ? `${dd} ${mon}` : `${dd} ${hh}:${mm}`;
  }
  if (timeframe === '1M') {
    return `${mon} '${yy}`;
  }
  return `${dd} ${mon}`;
}

function formatAxisPrice(
  scaledVal: number,
  mode: ScaleMode,
  basePrice: number,
  precision: number,
): string {
  if (mode === 'percent') {
    const sign = scaledVal > 0 ? '+' : '';
    return `${sign}${scaledVal.toFixed(1)}%`;
  }
  const actual = fromScaledValue(scaledVal, mode, basePrice);
  return formatPrice(actual, precision);
}

function formatDurationIT(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  const days = Math.round(seconds / 86400);
  return `${days}g`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function renderChart(params: RenderChartParams): ChartLayoutMetrics {
  const {
    ctx,
    width,
    height,
    theme,
    symbol,
    timeframe,
    chartType,
    candles,
    rawCandles,
    viewport,
    scaleMode,
    autoScale,
    showVolume,
    showGrid,
    countdownText,
    overlaySeries,
    separateSeries,
    compareSeries,
    drawings,
    draftDrawing,
    selectedDrawingId,
    hideDrawings,
    positions,
    alerts,
    crosshair,
  } = params;

  const pal = getChartPalette(theme);
  const layout = computeChartLayout({
    width,
    height,
    precision: symbol.precision,
    candles,
    viewport,
    scaleMode,
    autoScale,
    overlaySeries,
    separateSeries,
    compareSeries,
  });

  // Clear entire canvas
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  const startIdx = Math.max(0, Math.floor(layout.leftIndex) - 1);
  const endIdx = Math.min(candles.length - 1, Math.ceil(layout.rightIndex) + 1);

  // ======================== 1. MAIN PANE GRID & WATERMARK ========================
  const mainTicks = niceTicks(
    layout.mainMin,
    layout.mainMax,
    Math.max(4, Math.floor(layout.mainRect.height / 58)),
  );

  // Vertical time tick stride (~100px spacing)
  const xStepBars = Math.max(1, Math.round(105 / Math.max(1, layout.barStepPx)));
  const xTickIndices: number[] = [];
  const firstTick = Math.max(0, Math.ceil(layout.leftIndex / xStepBars) * xStepBars);
  for (let i = firstTick; i <= Math.min(candles.length - 1, Math.ceil(layout.rightIndex)); i += xStepBars) {
    xTickIndices.push(i);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, layout.mainRect.top, layout.plotWidth, layout.mainRect.height);
  ctx.clip();

  if (showGrid) {
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const tv of mainTicks) {
      const y =
        Math.round(
          layout.mainRect.bottom -
            ((tv - layout.mainMin) / Math.max(1e-12, layout.mainMax - layout.mainMin)) *
              layout.mainRect.height,
        ) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(layout.plotWidth, y);
      ctx.stroke();
    }
    for (const idx of xTickIndices) {
      const x = Math.round(indexToX(idx, layout)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, layout.mainRect.top);
      ctx.lineTo(x, layout.mainRect.bottom);
      ctx.stroke();
    }
  }

  // Subtle Watermark
  ctx.save();
  ctx.fillStyle = pal.watermark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.min(54, Math.max(24, Math.floor(layout.plotWidth / 15)))}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif`;
  ctx.fillText(
    `${symbol.ticker} · ${timeframe}`,
    layout.plotWidth / 2,
    layout.mainRect.top + layout.mainRect.height * 0.5,
  );
  ctx.restore();

  // ======================== 2. VOLUME HISTOGRAM (LOWER 18%) ========================
  if (showVolume && candles.length > 0) {
    let maxVol = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      if (candles[i] && candles[i].volume > maxVol) maxVol = candles[i].volume;
    }
    if (maxVol > 0) {
      const volAreaH = layout.mainRect.height * 0.18;
      const barW = Math.max(1, Math.min(18, layout.barStepPx * 0.68));
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = indexToX(i, layout);
        const h = (c.volume / maxVol) * volAreaH;
        ctx.fillStyle = c.close >= c.open ? pal.volUp : pal.volDown;
        ctx.fillRect(x - barW / 2, layout.mainRect.bottom - h, barW, h);
      }
    }
  }

  // ======================== 3. OVERLAY INDICATOR BANDS & HLINES ========================
  for (const ind of overlaySeries) {
    // Shaded bands (Bollinger / Ichimoku Kumo)
    if (ind.bands) {
      for (const band of ind.bands) {
        const upper = ind.plots.find((p) => p.key === band.upperKey);
        const lower = ind.plots.find((p) => p.key === band.lowerKey);
        if (!upper || !lower) continue;

        for (let i = Math.max(startIdx, 1); i <= endIdx; i++) {
          const u0 = upper.data[i - 1]?.value;
          const u1 = upper.data[i]?.value;
          const l0 = lower.data[i - 1]?.value;
          const l1 = lower.data[i]?.value;
          if (u0 == null || u1 == null || l0 == null || l1 == null) continue;
          const x0 = indexToX(i - 1, layout);
          const x1 = indexToX(i, layout);
          const isBear = band.bearishFillColor && u1 < l1;
          ctx.fillStyle = isBear ? band.bearishFillColor! : band.fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, priceToY(u0, layout));
          ctx.lineTo(x1, priceToY(u1, layout));
          ctx.lineTo(x1, priceToY(l1, layout));
          ctx.lineTo(x0, priceToY(l0, layout));
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Horizontal levels (Pivot Points / Pine hlines)
    if (ind.hlines) {
      for (const hl of ind.hlines) {
        const y = Math.round(priceToY(hl.value, layout)) + 0.5;
        if (y < layout.mainRect.top - 10 || y > layout.mainRect.bottom + 10) continue;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        setDash(ctx, hl.lineStyle ?? 'dashed');
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(layout.plotWidth, y);
        ctx.stroke();
        if (hl.label) {
          ctx.fillStyle = hl.color;
          ctx.font = '600 10px -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(hl.label, layout.plotWidth - 6, y - 2);
        }
        ctx.restore();
      }
    }
  }

  // ======================== 4. PRICE SERIES (ALL 7 CHART TYPES) ========================
  if (candles.length > 0) {
    const bodyW = Math.max(1.5, Math.min(22, layout.barStepPx * 0.72));

    if (chartType === 'candles' || chartType === 'hollow' || chartType === 'heikinAshi') {
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = indexToX(i, layout);
        const yO = priceToY(c.open, layout);
        const yC = priceToY(c.close, layout);
        const yH = priceToY(c.high, layout);
        const yL = priceToY(c.low, layout);
        const isUp = c.close >= c.open;
        const color = isUp ? pal.up : pal.down;

        const wickX = Math.round(x) + 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(wickX, yH);
        ctx.lineTo(wickX, yL);
        ctx.stroke();

        const top = Math.min(yO, yC);
        const h = Math.max(1, Math.abs(yC - yO));
        const bx = x - bodyW / 2;
        if (chartType === 'hollow' && isUp) {
          ctx.fillStyle = pal.bg;
          ctx.fillRect(bx, top, bodyW, h);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(bx + 0.5, top + 0.5, Math.max(1, bodyW - 1), Math.max(1, h - 1));
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(bx, top, bodyW, h);
        }
      }
    } else if (chartType === 'bars') {
      const tickW = Math.max(2, bodyW * 0.5);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([]);
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = Math.round(indexToX(i, layout)) + 0.5;
        const yO = priceToY(c.open, layout);
        const yC = priceToY(c.close, layout);
        const yH = priceToY(c.high, layout);
        const yL = priceToY(c.low, layout);
        ctx.strokeStyle = c.close >= c.open ? pal.up : pal.down;
        ctx.beginPath();
        ctx.moveTo(x, yH);
        ctx.lineTo(x, yL);
        ctx.moveTo(x - tickW, yO);
        ctx.lineTo(x, yO);
        ctx.moveTo(x, yC);
        ctx.lineTo(x + tickW, yC);
        ctx.stroke();
      }
    } else if (chartType === 'line' || chartType === 'area') {
      const pts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        pts.push({ x: indexToX(i, layout), y: priceToY(c.close, layout) });
      }
      if (pts.length >= 2) {
        if (chartType === 'area') {
          const grad = ctx.createLinearGradient(0, layout.mainRect.top, 0, layout.mainRect.bottom);
          grad.addColorStop(0, pal.areaTop);
          grad.addColorStop(1, pal.areaBottom);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, layout.mainRect.bottom);
          for (const p of pts) ctx.lineTo(p.x, p.y);
          ctx.lineTo(pts[pts.length - 1].x, layout.mainRect.bottom);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = pal.line;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }
    } else if (chartType === 'baseline') {
      const pts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        pts.push({ x: indexToX(i, layout), y: priceToY(c.close, layout) });
      }
      if (pts.length >= 2) {
        const baseY = layout.mainRect.top + layout.mainRect.height * 0.5;
        // Dashed baseline reference
        ctx.save();
        ctx.strokeStyle = pal.axisText;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(layout.plotWidth, baseY);
        ctx.stroke();
        ctx.restore();

        // Top green half
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, layout.mainRect.top, layout.plotWidth, baseY - layout.mainRect.top);
        ctx.clip();
        const upGrad = ctx.createLinearGradient(0, layout.mainRect.top, 0, baseY);
        upGrad.addColorStop(0, 'rgba(8, 153, 129, 0.30)');
        upGrad.addColorStop(1, 'rgba(8, 153, 129, 0.02)');
        ctx.fillStyle = upGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pal.up;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
        ctx.restore();

        // Bottom red half
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, baseY, layout.plotWidth, layout.mainRect.bottom - baseY);
        ctx.clip();
        const downGrad = ctx.createLinearGradient(0, baseY, 0, layout.mainRect.bottom);
        downGrad.addColorStop(0, 'rgba(242, 54, 69, 0.02)');
        downGrad.addColorStop(1, 'rgba(242, 54, 69, 0.30)');
        ctx.fillStyle = downGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pal.down;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ======================== 5. OVERLAY INDICATOR PLOTS ========================
  for (const ind of overlaySeries) {
    for (const plot of ind.plots) {
      ctx.save();
      ctx.strokeStyle = plot.color;
      ctx.fillStyle = plot.color;
      ctx.lineWidth = plot.lineWidth ?? 1.6;
      setDash(ctx, plot.lineStyle);

      if (plot.kind === 'dots') {
        for (let i = startIdx; i <= endIdx; i++) {
          const val = plot.data[i]?.value;
          if (val == null || !Number.isFinite(val)) continue;
          ctx.beginPath();
          ctx.arc(indexToX(i, layout), priceToY(val, layout), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        let drawing = false;
        ctx.beginPath();
        for (let i = startIdx; i <= endIdx; i++) {
          const val = plot.data[i]?.value;
          if (val == null || !Number.isFinite(val)) {
            drawing = false;
            continue;
          }
          const x = indexToX(i, layout);
          const y = priceToY(val, layout);
          if (!drawing) {
            ctx.moveTo(x, y);
            drawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ======================== 6. COMPARISON SYMBOL CURVES ========================
  if (compareSeries.length > 0 && layout.scaleMode === 'percent') {
    const firstT = candles[Math.max(0, startIdx)]?.time;
    for (const comp of compareSeries) {
      const compBase =
        (firstT != null ? comp.byTime.get(firstT) : undefined) ??
        comp.candles[0]?.close ??
        1;
      ctx.save();
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([]);
      let started = false;
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const t = candles[i]?.time;
        if (t == null) continue;
        const val = comp.byTime.get(t);
        if (val == null || !Number.isFinite(val)) continue;
        const pct = ((val - compBase) / Math.max(1e-9, compBase)) * 100;
        const y =
          layout.mainRect.bottom -
          ((pct - layout.mainMin) / Math.max(1e-9, layout.mainMax - layout.mainMin)) *
            layout.mainRect.height;
        const x = indexToX(i, layout);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ======================== 7. PAPER POSITIONS & ACTIVE ALERTS ========================
  for (const pos of positions) {
    if (pos.symbol !== symbol.ticker) continue;
    const entryY = Math.round(priceToY(pos.avgEntryPrice, layout)) + 0.5;
    const posColor = pos.unrealizedPnl >= 0 ? '#089981' : '#f23645';
    ctx.save();
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, entryY);
    ctx.lineTo(layout.plotWidth, entryY);
    ctx.stroke();

    const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
    const tag = `${pos.side === 'long' ? 'LONG' : 'SHORT'} ${pos.quantity} · ${pnlSign}${formatPrice(pos.unrealizedPnl, 2)} €`;
    ctx.font = '600 11px -apple-system, sans-serif';
    const tw = ctx.measureText(tag).width + 14;
    const tx = Math.max(10, layout.plotWidth - tw - 12);
    ctx.fillStyle = posColor;
    drawRoundedRect(ctx, tx, entryY - 10, tw, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, tx + 7, entryY);

    if (pos.takeProfit) {
      const tpY = Math.round(priceToY(pos.takeProfit, layout)) + 0.5;
      ctx.strokeStyle = '#089981';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, tpY);
      ctx.lineTo(layout.plotWidth, tpY);
      ctx.stroke();
    }
    if (pos.stopLoss) {
      const slY = Math.round(priceToY(pos.stopLoss, layout)) + 0.5;
      ctx.strokeStyle = '#f23645';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, slY);
      ctx.lineTo(layout.plotWidth, slY);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const al of alerts) {
    if (al.symbol !== symbol.ticker || al.status !== 'active' || al.target !== 'price') continue;
    const ay = Math.round(priceToY(al.value, layout)) + 0.5;
    if (ay < layout.mainRect.top - 10 || ay > layout.mainRect.bottom + 10) continue;
    ctx.save();
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, ay);
    ctx.lineTo(layout.plotWidth, ay);
    ctx.stroke();

    const lbl = `Avviso ${formatPrice(al.value, symbol.precision)}`;
    ctx.font = '600 10.5px -apple-system, sans-serif';
    const tw = ctx.measureText(lbl).width + 14;
    const ax = Math.max(10, layout.plotWidth - tw - 12);
    ctx.fillStyle = '#ff9800';
    drawRoundedRect(ctx, ax, ay - 9, tw, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl, ax + 7, ay);
    ctx.restore();
  }

  // ======================== 8. INTERACTIVE DRAWINGS LAYER ========================
  const toScreen = (pt: DrawingPoint): ScreenPoint => ({
    x: indexToX(timeToIndex(pt.time, rawCandles), layout),
    y: priceToY(pt.price, layout),
  });

  if (!hideDrawings) {
    const allDrawings = draftDrawing ? [...drawings, draftDrawing] : drawings;
    for (const d of allDrawings) {
      if (!d.visible || d.points.length === 0) continue;
      const isSelected = d.id === selectedDrawingId;
      renderSingleDrawing(
        ctx,
        d,
        toScreen,
        layout,
        rawCandles,
        symbol.precision,
        isSelected,
      );
    }
  }

  // ======================== 9. LIVE LAST-PRICE DOTTED LINE ========================
  const lastCandle = rawCandles[rawCandles.length - 1];
  if (lastCandle) {
    const lastY = Math.round(priceToY(lastCandle.close, layout)) + 0.5;
    const lastColor = lastCandle.close >= lastCandle.open ? pal.up : pal.down;
    ctx.save();
    ctx.strokeStyle = lastColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(0, lastY);
    ctx.lineTo(layout.plotWidth, lastY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // End Main Pane clip

  // ======================== 10. SUB-PANES (RSI / MACD / STOCH / ATR / PINE) ========================
  for (const sp of layout.subPanes) {
    const { series, rect, min, max } = sp;
    const valToSubY = (v: number) =>
      rect.bottom - ((v - min) / Math.max(1e-9, max - min)) * rect.height;

    // Top border divider
    ctx.strokeStyle = pal.axisBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(rect.top) + 0.5);
    ctx.lineTo(width, Math.round(rect.top) + 0.5);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, rect.top, layout.plotWidth, rect.height);
    ctx.clip();

    // Shaded RSI/Stoch channel if 2+ reference hlines (e.g. 30-70 or 20-80)
    if (series.hlines && series.hlines.length >= 2) {
      const vals = series.hlines.map((h) => h.value).sort((a, b) => a - b);
      const lowVal = vals[0];
      const highVal = vals[vals.length - 1];
      if (highVal > lowVal) {
        const yTop = valToSubY(highVal);
        const yBot = valToSubY(lowVal);
        ctx.fillStyle = pal.subShade;
        ctx.fillRect(0, yTop, layout.plotWidth, yBot - yTop);
      }
    }

    // Sub-pane horizontal reference lines
    if (series.hlines) {
      for (const hl of series.hlines) {
        const hy = Math.round(valToSubY(hl.value)) + 0.5;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        setDash(ctx, hl.lineStyle ?? 'dashed');
        ctx.beginPath();
        ctx.moveTo(0, hy);
        ctx.lineTo(layout.plotWidth, hy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Sub-pane plots
    const zeroY = valToSubY(0);
    for (const plot of series.plots) {
      if (plot.kind === 'histogram') {
        const barW = Math.max(1.5, Math.min(14, layout.barStepPx * 0.65));
        for (let i = startIdx; i <= endIdx; i++) {
          const val = plot.data[i]?.value;
          if (val == null || !Number.isFinite(val)) continue;
          const prevVal = plot.data[i - 1]?.value ?? 0;
          const x = indexToX(i, layout);
          const y = valToSubY(val);
          let fill = plot.color;
          if (plot.colorByValue) {
            if (val >= 0) {
              fill =
                val >= prevVal
                  ? plot.colorByValue.positive
                  : (plot.colorByValue.positiveFaded ?? plot.colorByValue.positive);
            } else {
              fill =
                val <= prevVal
                  ? plot.colorByValue.negative
                  : (plot.colorByValue.negativeFaded ?? plot.colorByValue.negative);
            }
          }
          ctx.fillStyle = fill;
          const topY = Math.min(y, zeroY);
          const h = Math.max(1, Math.abs(zeroY - y));
          ctx.fillRect(x - barW / 2, topY, barW, h);
        }
      } else {
        ctx.save();
        ctx.strokeStyle = plot.color;
        ctx.lineWidth = plot.lineWidth ?? 1.6;
        setDash(ctx, plot.lineStyle);
        let started = false;
        ctx.beginPath();
        for (let i = startIdx; i <= endIdx; i++) {
          const val = plot.data[i]?.value;
          if (val == null || !Number.isFinite(val)) {
            started = false;
            continue;
          }
          const x = indexToX(i, layout);
          const y = valToSubY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Sub-pane Legend Title + Live Value
    const refIdx =
      crosshair.visible && crosshair.barIndex >= 0 && crosshair.barIndex < rawCandles.length
        ? crosshair.barIndex
        : rawCandles.length - 1;
    let legendX = 10;
    const legendY = rect.top + 13;
    ctx.font = '600 11px -apple-system, sans-serif';
    ctx.fillStyle = pal.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(series.title, legendX, legendY);
    legendX += ctx.measureText(series.title).width + 8;

    for (const plot of series.plots) {
      const v = plot.data[refIdx]?.value;
      if (v == null || !Number.isFinite(v)) continue;
      const valStr =
        series.type === 'VOLUME' ? formatVolume(Math.abs(v)) : v.toFixed(2);
      ctx.fillStyle = plot.color;
      ctx.fillText(valStr, legendX, legendY);
      legendX += ctx.measureText(valStr).width + 8;
    }

    ctx.restore(); // end sub-pane clip

    // Sub-pane Right Axis labels
    const subTicks = niceTicks(min, max, 3);
    ctx.fillStyle = pal.axisText;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const stv of subTicks) {
      const sy = valToSubY(stv);
      if (sy < rect.top + 10 || sy > rect.bottom - 10) continue;
      ctx.fillText(
        Math.abs(stv) >= 1000 ? formatVolume(stv) : stv.toFixed(1),
        layout.plotWidth + 6,
        sy,
      );
    }
  }

  // ======================== 11. RIGHT PRICE AXIS & TIME AXIS CHROME ========================
  ctx.strokeStyle = pal.axisBorder;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  // Vertical price axis border
  ctx.beginPath();
  ctx.moveTo(Math.round(layout.plotWidth) + 0.5, 0);
  ctx.lineTo(Math.round(layout.plotWidth) + 0.5, height);
  ctx.stroke();

  // Horizontal time axis border
  ctx.beginPath();
  ctx.moveTo(0, Math.round(layout.timeAxisTop) + 0.5);
  ctx.lineTo(width, Math.round(layout.timeAxisTop) + 0.5);
  ctx.stroke();

  // Main price axis labels
  ctx.fillStyle = pal.axisText;
  ctx.font = symbol.precision >= 6
    ? '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif'
    : '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const tv of mainTicks) {
    const y =
      layout.mainRect.bottom -
      ((tv - layout.mainMin) / Math.max(1e-12, layout.mainMax - layout.mainMin)) *
        layout.mainRect.height;
    if (y < 12 || y > layout.mainRect.bottom - 10) continue;
    ctx.fillText(
      formatAxisPrice(tv, layout.scaleMode, layout.basePrice, symbol.precision),
      layout.plotWidth + 5,
      y,
    );
  }

  // Live Last-Price Badge + Optional Countdown on Price Axis
  if (lastCandle) {
    const lastY = Math.max(
      14,
      Math.min(layout.mainRect.bottom - 14, priceToY(lastCandle.close, layout)),
    );
    const lastColor = lastCandle.close >= lastCandle.open ? pal.up : pal.down;
    const badgeH = countdownText ? 30 : 20;
    const badgeY = lastY - (countdownText ? 11 : 10);
    ctx.fillStyle = lastColor;
    ctx.fillRect(layout.plotWidth + 1, badgeY, layout.priceAxisWidth - 1, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = symbol.precision >= 6
      ? '600 10px -apple-system, sans-serif'
      : '600 11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const priceText =
      layout.scaleMode === 'percent'
        ? formatAxisPrice(
            toScaledValue(lastCandle.close, 'percent', layout.basePrice),
            'percent',
            layout.basePrice,
            symbol.precision,
          )
        : formatPrice(lastCandle.close, symbol.precision);
    ctx.fillText(priceText, layout.plotWidth + 5, badgeY + 9);
    if (countdownText) {
      ctx.font = '500 9.5px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(countdownText, layout.plotWidth + 5, badgeY + 22);
    }
  }

  // Time Axis Labels
  ctx.fillStyle = pal.axisText;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const idx of xTickIndices) {
    const c = candles[idx];
    if (!c) continue;
    const x = indexToX(idx, layout);
    if (x < 28 || x > layout.plotWidth - 28) continue;
    ctx.fillText(
      formatAxisTime(c.time, timeframe, false),
      x,
      layout.timeAxisTop + TIME_AXIS_HEIGHT / 2,
    );
  }

  // ======================== 12. INTERACTIVE CROSSHAIR & AXIS PILLS ========================
  if (
    crosshair.visible &&
    crosshair.x >= 0 &&
    crosshair.x <= layout.plotWidth &&
    crosshair.y >= 0 &&
    crosshair.y <= layout.timeAxisTop
  ) {
    const snapX =
      crosshair.barIndex >= 0 && crosshair.barIndex < candles.length
        ? Math.round(indexToX(crosshair.barIndex, layout)) + 0.5
        : Math.round(crosshair.x) + 0.5;
    const cy = Math.round(crosshair.y) + 0.5;

    ctx.save();
    ctx.strokeStyle = pal.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    // Vertical line across main + all sub-panes
    ctx.beginPath();
    ctx.moveTo(snapX, 0);
    ctx.lineTo(snapX, layout.timeAxisTop);
    ctx.stroke();

    // Horizontal line across plot
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(layout.plotWidth, cy);
    ctx.stroke();
    ctx.restore();

    // Right-axis Crosshair Price/Oscillator Pill
    let yLabel = '';
    if (cy <= layout.mainRect.bottom) {
      const pVal = yToPrice(cy, layout);
      yLabel =
        layout.scaleMode === 'percent'
          ? formatAxisPrice(
              toScaledValue(pVal, 'percent', layout.basePrice),
              'percent',
              layout.basePrice,
              symbol.precision,
            )
          : formatPrice(pVal, symbol.precision);
    } else {
      const hitSub = layout.subPanes.find(
        (sp) => cy >= sp.rect.top && cy <= sp.rect.bottom,
      );
      if (hitSub) {
        const ratio =
          (hitSub.rect.bottom - cy) / Math.max(1, hitSub.rect.height);
        const val = hitSub.min + ratio * (hitSub.max - hitSub.min);
        yLabel = Math.abs(val) >= 1000 ? formatVolume(val) : val.toFixed(2);
      }
    }

    if (yLabel) {
      ctx.fillStyle = pal.pillBg;
      ctx.fillRect(layout.plotWidth + 1, cy - 10, layout.priceAxisWidth - 1, 20);
      ctx.fillStyle = pal.pillText;
      ctx.font = symbol.precision >= 6
        ? '600 10px -apple-system, sans-serif'
        : '600 11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(yLabel, layout.plotWidth + 5, cy);
    }

    // Bottom Time-Axis Date Pill
    const hoveredTime = indexToTime(crosshair.barIndex, rawCandles);
    const timeStr = formatAxisTime(hoveredTime, timeframe, true);
    ctx.font = '600 11px -apple-system, sans-serif';
    const tw = ctx.measureText(timeStr).width + 16;
    const pillX = Math.max(2, Math.min(layout.plotWidth - tw - 2, snapX - tw / 2));
    ctx.fillStyle = pal.pillBg;
    drawRoundedRect(ctx, pillX, layout.timeAxisTop + 3, tw, TIME_AXIS_HEIGHT - 6, 3);
    ctx.fill();
    ctx.fillStyle = pal.pillText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, pillX + tw / 2, layout.timeAxisTop + TIME_AXIS_HEIGHT / 2);
  }

  return layout;
}

function renderSingleDrawing(
  ctx: CanvasRenderingContext2D,
  d: DrawingObject,
  toScreen: (pt: DrawingPoint) => ScreenPoint,
  layout: ChartLayoutMetrics,
  candles: readonly Candle[],
  precision: number,
  isSelected: boolean,
) {
  const pts = d.points.map(toScreen);
  ctx.save();
  ctx.strokeStyle = d.style.color;
  ctx.fillStyle = d.style.color;
  ctx.lineWidth = d.style.lineWidth || 2;
  setDash(ctx, d.style.lineStyle);

  switch (d.type) {
    case 'trendline':
    case 'arrow': {
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      }
      break;
    }

    case 'ray':
    case 'extendedLine': {
      if (pts.length >= 2) {
        const [s, e] = extendLineToBounds(
          pts[0],
          pts[1],
          layout.plotWidth,
          layout.mainRect.height,
          d.type === 'ray' ? 'ray' : 'extended',
        );
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }
      break;
    }

    case 'horizontalLine': {
      const y = Math.round(pts[0].y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(layout.plotWidth, y);
      ctx.stroke();
      // Right price tag
      const lbl = formatPrice(d.points[0].price, precision);
      ctx.font = '600 10.5px -apple-system, sans-serif';
      const tw = ctx.measureText(lbl).width + 10;
      ctx.fillStyle = d.style.color;
      drawRoundedRect(ctx, layout.plotWidth - tw - 4, y - 9, tw, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, layout.plotWidth - tw + 1, y);
      break;
    }

    case 'verticalLine': {
      const x = Math.round(pts[0].x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, layout.mainRect.top);
      ctx.lineTo(x, layout.mainRect.bottom);
      ctx.stroke();
      break;
    }

    case 'parallelChannel': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 40 };
        const ch = calculateParallelChannel(pts[0], pts[1], p3);
        ctx.fillStyle = 'rgba(41, 98, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(ch.baseStart.x, ch.baseStart.y);
        ctx.lineTo(ch.baseEnd.x, ch.baseEnd.y);
        ctx.lineTo(ch.offsetEnd.x, ch.offsetEnd.y);
        ctx.lineTo(ch.offsetStart.x, ch.offsetStart.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(ch.baseStart.x, ch.baseStart.y);
        ctx.lineTo(ch.baseEnd.x, ch.baseEnd.y);
        ctx.moveTo(ch.offsetStart.x, ch.offsetStart.y);
        ctx.lineTo(ch.offsetEnd.x, ch.offsetEnd.y);
        ctx.stroke();

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ch.midStart.x, ch.midStart.y);
        ctx.lineTo(ch.midEnd.x, ch.midEnd.y);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'fibRetracement': {
      if (pts.length >= 2) {
        const minX = Math.min(pts[0].x, pts[1].x);
        const maxX = Math.max(pts[0].x, pts[1].x);
        const spanW = Math.max(60, maxX - minX);
        const levels = calculateFibonacciLevels(
          d.points[0].price,
          d.points[1].price,
          d.fibLevels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
        );

        // Diagonal guide line
        ctx.save();
        ctx.strokeStyle = 'rgba(140, 140, 140, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < levels.length; i++) {
          const lv = levels[i];
          const y = priceToY(lv.price, layout);
          if (i > 0) {
            const prevY = priceToY(levels[i - 1].price, layout);
            ctx.fillStyle = `${lv.color}18`;
            ctx.fillRect(minX, Math.min(prevY, y), spanW, Math.abs(y - prevY));
          }
          ctx.strokeStyle = lv.color;
          ctx.lineWidth = 1.25;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(minX + spanW, y);
          ctx.stroke();

          ctx.fillStyle = lv.color;
          ctx.font = '600 10.5px -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            `${lv.ratio} (${formatPrice(lv.price, precision)})`,
            minX + 4,
            y - 2,
          );
        }
      }
      break;
    }

    case 'rectangle': {
      if (pts.length >= 2) {
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);
        ctx.fillStyle = d.style.fillColor ?? `${d.style.color}24`;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      break;
    }

    case 'ellipse': {
      if (pts.length >= 2) {
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        const rx = Math.max(1, Math.abs(pts[1].x - pts[0].x) / 2);
        const ry = Math.max(1, Math.abs(pts[1].y - pts[0].y) / 2);
        ctx.fillStyle = d.style.fillColor ?? `${d.style.color}24`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'brush': {
      if (pts.length >= 2) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      break;
    }

    case 'text':
    case 'callout': {
      const txt = d.text || 'Nota';
      ctx.font = `600 ${d.style.fontSize ?? 13}px -apple-system, sans-serif`;
      const tw = ctx.measureText(txt).width + 14;
      const th = 24;
      ctx.fillStyle = 'rgba(19, 19, 19, 0.88)';
      drawRoundedRect(ctx, pts[0].x, pts[0].y - th, tw, th, 4);
      ctx.fill();
      ctx.strokeStyle = d.style.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = d.style.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, pts[0].x + 7, pts[0].y - th / 2);
      break;
    }

    case 'measure': {
      if (pts.length >= 2) {
        const m = calculateMeasure(d.points[0], d.points[1], candles);
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);
        const col = m.isPositive ? '#2962ff' : '#f23645';

        ctx.fillStyle = m.isPositive
          ? 'rgba(41, 98, 255, 0.18)'
          : 'rgba(242, 54, 69, 0.18)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rx, ry, rw, rh);

        const sign = m.priceDelta >= 0 ? '+' : '';
        const line1 = `${sign}${formatPrice(m.priceDelta, precision)} (${sign}${m.percentDelta.toFixed(2)}%)`;
        const line2 = `${m.bars} barre · ${formatDurationIT(m.timeSpanSeconds)}`;
        ctx.font = '600 11px -apple-system, sans-serif';
        const bw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 18;
        const bh = 36;
        const bx = Math.max(6, Math.min(layout.plotWidth - bw - 6, rx + rw / 2 - bw / 2));
        const by = m.isPositive ? Math.max(6, ry - bh - 6) : Math.min(layout.mainRect.bottom - bh - 6, ry + rh + 6);
        ctx.fillStyle = col;
        drawRoundedRect(ctx, bx, by, bw, bh, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line1, bx + bw / 2, by + 12);
        ctx.font = '500 10.5px -apple-system, sans-serif';
        ctx.fillText(line2, bx + bw / 2, by + 26);
      }
      break;
    }

    case 'longPosition':
    case 'shortPosition': {
      if (pts.length >= 2) {
        const side = d.type === 'longPosition' ? 'long' : 'short';
        const entry = d.points[0].price;
        const rawTarget = d.targetPrice ?? d.points[1].price;
        const diff = Math.abs(rawTarget - entry) || entry * 0.015;
        const target =
          side === 'long'
            ? Math.max(entry + diff * 0.25, rawTarget)
            : Math.min(entry - diff * 0.25, rawTarget);
        const stop =
          d.stopPrice ??
          (side === 'long' ? entry - diff * 0.5 : entry + diff * 0.5);

        const metrics = calculatePositionMetrics(side, entry, stop, target);
        const x0 = Math.min(pts[0].x, pts[1].x);
        const boxW = Math.max(85, Math.abs(pts[1].x - pts[0].x));
        const yEntry = priceToY(entry, layout);
        const yTarget = priceToY(target, layout);
        const yStop = priceToY(stop, layout);

        // Target zone (green)
        ctx.fillStyle = 'rgba(8, 153, 129, 0.22)';
        ctx.fillRect(x0, Math.min(yEntry, yTarget), boxW, Math.abs(yTarget - yEntry));
        ctx.strokeStyle = '#089981';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, Math.min(yEntry, yTarget), boxW, Math.abs(yTarget - yEntry));

        // Stop zone (red)
        ctx.fillStyle = 'rgba(242, 54, 69, 0.22)';
        ctx.fillRect(x0, Math.min(yEntry, yStop), boxW, Math.abs(yStop - yEntry));
        ctx.strokeStyle = '#f23645';
        ctx.strokeRect(x0, Math.min(yEntry, yStop), boxW, Math.abs(yStop - yEntry));

        // Entry midline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, yEntry);
        ctx.lineTo(x0 + boxW, yEntry);
        ctx.stroke();

        // R/R Badge
        const rrText = `${side === 'long' ? 'LONG' : 'SHORT'} · R/R ${metrics.riskRewardRatio.toFixed(2)} (+${metrics.rewardPercent.toFixed(1)}% / -${metrics.riskPercent.toFixed(1)}%)`;
        ctx.font = '600 10.5px -apple-system, sans-serif';
        const tw = ctx.measureText(rrText).width + 14;
        ctx.fillStyle = '#131313';
        drawRoundedRect(ctx, x0 + 4, yEntry - 10, tw, 20, 4);
        ctx.fill();
        ctx.strokeStyle = '#464646';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(rrText, x0 + 11, yEntry);
      }
      break;
    }
  }

  // Selected control handles
  if (isSelected) {
    ctx.setLineDash([]);
    for (const pt of pts) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}
