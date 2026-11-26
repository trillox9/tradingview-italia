import {
  getDefaultChartSettings,
  normalizeChartType,
  type AlertRule,
  type Candle,
  type ChartDateFormat,
  type ChartSettings,
  type ChartTimezoneSetting,
  type ChartType,
  type CursorToolType,
  type DrawingObject,
  type DrawingPoint,
  type IndicatorSeries,
  type PaperOrder,
  type PaperPosition,
  type PriceScalePosition,
  type ScreenPoint,
  type SymbolInfo,
  type Timeframe,
} from '../../types';
import { formatPrice, formatVolume } from '../../data';
import type { HideMode, ScaleMode, ThemeMode } from '../../store';
import {
  applyLineDash,
  drawRoundedRectPath,
  renderAllDrawings,
} from './drawingRenderer';

export const PRICE_AXIS_WIDTH = 58;
export const TIME_AXIS_HEIGHT = 28;
export const COMPARE_COLORS = ['#FF9800', '#AB47BC', '#00BCD4', '#E91E63', '#8BC34A'];

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';

/** Dynamically size the price axis so 6-8 decimal coins or larger scale fonts never clip */
export function computePriceAxisWidth(
  precision: number,
  scaleMode: ScaleMode,
  fontSize = 11,
): number {
  const fontPad = Math.max(0, Math.round((fontSize - 11) * 4));
  if (scaleMode === 'percent') return 58 + fontPad;
  if (scaleMode === 'indexed100') return 64 + fontPad;
  if (precision >= 7) return 86 + fontPad;
  if (precision >= 5) return 76 + fontPad;
  if (precision >= 4) return 66 + fontPad;
  return PRICE_AXIS_WIDTH + fontPad;
}

export function resolveEffectivePrecision(
  symbolPrecision: number,
  chartSettings?: ChartSettings,
): number {
  const pref = chartSettings?.symbol.precision ?? 'default';
  if (pref === 'default') return symbolPrecision;
  const parsed = parseInt(pref, 10);
  return Number.isFinite(parsed) ? parsed : symbolPrecision;
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
  /** Explicit scaled vertical min/max when manually zoomed or 2D-panned (!autoScale) */
  manualMin?: number | null;
  manualMax?: number | null;
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

export interface PlusButtonHitRect {
  x: number;
  y: number;
  radius: number;
  price: number;
}

export interface ZoomBoxOverlay {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ChartLayoutMetrics {
  width: number;
  height: number;
  priceAxisWidth: number;
  priceAxisLeft: number;
  priceScalePosition: PriceScalePosition;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  mainRect: PaneRect;
  subPanes: SubPaneLayout[];
  timeAxisTop: number;
  leftIndex: number;
  rightIndex: number;
  barStepPx: number;
  scaleMode: ScaleMode;
  invertScale: boolean;
  precision: number;
  basePrice: number;
  rawMainSpan: number;
  mainMin: number;
  mainMax: number;
  plusButtonRect: PlusButtonHitRect | null;
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
  invertScale?: boolean;
  lockPriceToBarRatio?: boolean;
  priceScalePosition?: PriceScalePosition;
  showVolume: boolean;
  showGrid: boolean;
  countdownText: string | null;
  overlaySeries: IndicatorSeries[];
  separateSeries: IndicatorSeries[];
  compareSeries: CompareSeriesData[];
  drawings: DrawingObject[];
  draftDrawing: DrawingObject | null;
  selectedDrawingId: string | null;
  eraserHoveredId?: string | null;
  hideDrawings: boolean;
  hideMode?: HideMode;
  positions: PaperPosition[];
  orders?: PaperOrder[];
  executions?: PaperOrder[];
  alerts: AlertRule[];
  crosshair: CrosshairState;
  syncedCrosshairTime?: number | null;
  subPaneHeightRatio?: number;
  subPaneSplitterHovered?: boolean;
  cursorMode?: CursorToolType;
  bidPrice?: number;
  askPrice?: number;
  zoomBox?: ZoomBoxOverlay | null;
  chartSettings?: ChartSettings;
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
      grid: 'rgba(255, 255, 255, 0.06)',
      axisBorder: '#2a2a2a',
      axisText: '#8c8c8c',
      watermark: 'rgba(255, 255, 255, 0.05)',
      up: '#089981',
      down: '#f23645',
      volUp: 'rgba(8, 153, 129, 0.36)',
      volDown: 'rgba(242, 54, 69, 0.36)',
      line: '#2962ff',
      areaTop: 'rgba(41, 98, 255, 0.28)',
      areaBottom: 'rgba(41, 98, 255, 0.02)',
      crosshair: '#8c8c8c',
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
    watermark: 'rgba(19, 23, 34, 0.05)',
    up: '#089981',
    down: '#f23645',
    volUp: 'rgba(8, 153, 129, 0.30)',
    volDown: 'rgba(242, 54, 69, 0.30)',
    line: '#2962ff',
    areaTop: 'rgba(41, 98, 255, 0.24)',
    areaBottom: 'rgba(41, 98, 255, 0.01)',
    crosshair: '#787b86',
    pillBg: '#131313',
    pillText: '#ffffff',
    text: '#131313',
    subShade: 'rgba(126, 87, 194, 0.07)',
  };
}

/** Hit-test helpers honoring Left OR Right price scale position */
export function isPointInPriceAxis(
  x: number,
  y: number,
  layout: ChartLayoutMetrics,
): boolean {
  return (
    x >= layout.priceAxisLeft &&
    x <= layout.priceAxisLeft + layout.priceAxisWidth &&
    y >= 0 &&
    y <= layout.timeAxisTop
  );
}

export function isPointInMainPriceAxis(
  x: number,
  y: number,
  layout: ChartLayoutMetrics,
): boolean {
  return isPointInPriceAxis(x, y, layout) && y <= layout.mainRect.bottom;
}

export function getSubPaneAtY(
  y: number,
  layout: ChartLayoutMetrics,
): SubPaneLayout | null {
  for (const sp of layout.subPanes) {
    if (y >= sp.rect.top && y <= sp.rect.bottom) {
      return sp;
    }
  }
  return null;
}

export function isNearSubPaneSplitter(
  x: number,
  y: number,
  layout: ChartLayoutMetrics,
): boolean {
  return (
    layout.subPanes.length > 0 &&
    Math.abs(y - layout.mainRect.bottom) <= 6 &&
    x >= layout.plotLeft &&
    x <= layout.plotRight
  );
}

export function isPointInTimeAxis(
  x: number,
  y: number,
  layout: ChartLayoutMetrics,
): boolean {
  return (
    y > layout.timeAxisTop &&
    x >= layout.plotLeft &&
    x <= layout.plotRight
  );
}

export function isPointInMainPlot(
  x: number,
  y: number,
  layout: ChartLayoutMetrics,
): boolean {
  return (
    x >= layout.plotLeft &&
    x <= layout.plotRight &&
    y >= layout.mainRect.top &&
    y <= layout.mainRect.bottom
  );
}

/** Transform raw price into scaled numeric domain (regular, log, percent, indexed100) */
export function toScaledValue(
  price: number,
  mode: ScaleMode,
  basePrice: number,
): number {
  if (mode === 'percent') {
    const base = basePrice > 0 ? basePrice : 1;
    return ((price - base) / base) * 100;
  }
  if (mode === 'indexed100') {
    const base = basePrice > 0 ? basePrice : 1;
    return (price / base) * 100;
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
  if (mode === 'indexed100') {
    const base = basePrice > 0 ? basePrice : 1;
    return base * (scaled / 100);
  }
  if (mode === 'log') {
    return Math.exp(scaled);
  }
  return scaled;
}

export function scaledToY(
  scaled: number,
  layout: ChartLayoutMetrics,
): number {
  const span = Math.max(1e-12, layout.mainMax - layout.mainMin);
  const ratio = (scaled - layout.mainMin) / span;
  return layout.invertScale
    ? layout.mainRect.top + ratio * layout.mainRect.height
    : layout.mainRect.bottom - ratio * layout.mainRect.height;
}

export function priceToY(
  price: number,
  layout: ChartLayoutMetrics,
): number {
  const s = toScaledValue(price, layout.scaleMode, layout.basePrice);
  return scaledToY(s, layout);
}

export function yToPrice(y: number, layout: ChartLayoutMetrics): number {
  const h = Math.max(1, layout.mainRect.height);
  const ratio = layout.invertScale
    ? (y - layout.mainRect.top) / h
    : (layout.mainRect.bottom - y) / h;
  const scaled = layout.mainMin + ratio * (layout.mainMax - layout.mainMin);
  return fromScaledValue(scaled, layout.scaleMode, layout.basePrice);
}

export function indexToX(index: number, layout: ChartLayoutMetrics): number {
  return layout.plotLeft + (index - layout.leftIndex + 0.5) * layout.barStepPx;
}

export function xToIndex(x: number, layout: ChartLayoutMetrics): number {
  return (
    layout.leftIndex +
    (x - layout.plotLeft) / Math.max(1e-6, layout.barStepPx) -
    0.5
  );
}

export function timeToIndex(time: number, candles: readonly Candle[]): number {
  if (candles.length === 0) return 0;
  if (candles.length === 1) return 0;
  const step = Math.max(
    1,
    candles[candles.length - 1].time - candles[candles.length - 2].time,
  );
  if (time <= candles[0].time) {
    return (time - candles[0].time) / step;
  }
  if (time >= candles[candles.length - 1].time) {
    return candles.length - 1 + (time - candles[candles.length - 1].time) / step;
  }
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
  const step = Math.max(
    1,
    candles[candles.length - 1].time - candles[candles.length - 2].time,
  );
  const clamped = Math.round(index);
  if (clamped < 0) return candles[0].time + clamped * step;
  if (clamped >= candles.length) {
    return (
      candles[candles.length - 1].time + (clamped - (candles.length - 1)) * step
    );
  }
  return candles[clamped].time;
}

export function computeChartLayout(params: {
  width: number;
  height: number;
  precision?: number;
  fallbackBasePrice?: number;
  candles: Candle[];
  viewport: ViewportState;
  scaleMode: ScaleMode;
  autoScale: boolean;
  invertScale?: boolean;
  lockPriceToBarRatio?: boolean;
  priceScalePosition?: PriceScalePosition;
  scalePriceChartOnly?: boolean;
  topMarginPct?: number;
  bottomMarginPct?: number;
  scaleFontSize?: number;
  subPaneHeightRatio?: number;
  overlaySeries: IndicatorSeries[];
  separateSeries: IndicatorSeries[];
  compareSeries: CompareSeriesData[];
}): ChartLayoutMetrics {
  const {
    width,
    height,
    precision = 2,
    fallbackBasePrice = 100,
    candles,
    viewport,
    autoScale,
    invertScale = false,
    lockPriceToBarRatio = false,
    priceScalePosition = 'right',
    scalePriceChartOnly = false,
    topMarginPct = 10,
    bottomMarginPct = 12,
    scaleFontSize = 11,
    subPaneHeightRatio,
    overlaySeries,
    separateSeries,
    compareSeries,
  } = params;

  const effectiveScale: ScaleMode =
    compareSeries.length > 0 && params.scaleMode !== 'indexed100'
      ? 'percent'
      : params.scaleMode;

  const priceAxisWidth = computePriceAxisWidth(
    precision,
    effectiveScale,
    scaleFontSize,
  );
  const plotWidth = Math.max(60, width - priceAxisWidth);
  const plotLeft = priceScalePosition === 'left' ? priceAxisWidth : 0;
  const plotRight = plotLeft + plotWidth;
  const priceAxisLeft = priceScalePosition === 'left' ? 0 : plotRight;

  const usableHeight = Math.max(100, height - TIME_AXIS_HEIGHT);
  const subCount = separateSeries.length;
  let singleSubH = 0;
  if (subCount > 0) {
    if (typeof subPaneHeightRatio === 'number' && Number.isFinite(subPaneHeightRatio)) {
      const clampedRatio = Math.max(0.12, Math.min(0.62, subPaneHeightRatio));
      const targetTotal = Math.min(usableHeight - 90, Math.floor(usableHeight * clampedRatio));
      singleSubH = Math.max(48, Math.floor(targetTotal / subCount));
    } else {
      const maxSubTotal = Math.floor(usableHeight * 0.46);
      singleSubH = Math.max(68, Math.min(126, Math.floor(maxSubTotal / subCount)));
    }
  }
  const totalSubH = singleSubH * subCount;
  const mainH = Math.max(80, usableHeight - totalSubH);

  const mainRect: PaneRect = {
    top: 0,
    height: mainH,
    bottom: mainH,
  };

  const visibleBars = Math.max(8, Math.min(600, viewport.visibleBars));
  const maxAllowedRight =
    candles.length > 0
      ? candles.length + Math.max(10, visibleBars * 0.85)
      : visibleBars;
  const rightIndex = Math.max(4, Math.min(maxAllowedRight, viewport.rightIndex));
  const leftIndex = rightIndex - visibleBars;
  const barStepPx = plotWidth / visibleBars;

  const startIdx = Math.max(0, Math.floor(leftIndex));
  const endIdx = Math.min(candles.length - 1, Math.ceil(rightIndex));
  const safeFallback =
    Number.isFinite(fallbackBasePrice) && fallbackBasePrice > 0
      ? fallbackBasePrice
      : 100;
  const basePrice = candles[startIdx]?.close ?? candles[0]?.close ?? safeFallback;

  // Compute min/max in scaled units across visible bars (+ overlays unless scalePriceChartOnly)
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

  if (!scalePriceChartOnly) {
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
  }

  if (
    compareSeries.length > 0 &&
    (effectiveScale === 'percent' || effectiveScale === 'indexed100')
  ) {
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
        const scaledComp =
          effectiveScale === 'indexed100'
            ? (v / Math.max(1e-12, compBase)) * 100
            : ((v - compBase) / Math.max(1e-12, compBase)) * 100;
        if (scaledComp < sMin) sMin = scaledComp;
        if (scaledComp > sMax) sMax = scaledComp;
      }
    }
  }

  if (!Number.isFinite(sMin) || !Number.isFinite(sMax)) {
    sMin = toScaledValue(safeFallback * 0.98, effectiveScale, basePrice);
    sMax = toScaledValue(safeFallback * 1.02, effectiveScale, basePrice);
  }
  if (Math.abs(sMax - sMin) < 1e-12) {
    const pad = Math.abs(sMax) > 0 ? Math.abs(sMax) * 0.02 : 1e-6;
    sMin -= pad;
    sMax += pad;
  }

  // Honor user canvas top/bottom margin %
  const topFrac = Math.max(0.02, Math.min(0.4, topMarginPct / 100));
  const botFrac = Math.max(0.02, Math.min(0.4, bottomMarginPct / 100));
  const rawSpan = sMax - sMin;
  let mainMin = sMin - rawSpan * botFrac;
  let mainMax = sMax + rawSpan * topFrac;
  const basePaddedSpan = Math.max(1e-12, mainMax - mainMin);

  if (lockPriceToBarRatio) {
    // Lock vertical span proportionally to visibleBars (reference 120 bars)
    const mid = (mainMin + mainMax) / 2 + viewport.yOffset * basePaddedSpan;
    const lockedHalf =
      (basePaddedSpan / 2) *
      (visibleBars / 120) /
      Math.max(0.15, Math.min(12, viewport.yZoom));
    mainMin = mid - lockedHalf;
    mainMax = mid + lockedHalf;
  } else if (!autoScale) {
    if (
      viewport.manualMin != null &&
      viewport.manualMax != null &&
      Number.isFinite(viewport.manualMin) &&
      Number.isFinite(viewport.manualMax) &&
      viewport.manualMax > viewport.manualMin
    ) {
      mainMin = viewport.manualMin;
      mainMax = viewport.manualMax;
    } else {
      const mid = (mainMin + mainMax) / 2 + viewport.yOffset * basePaddedSpan;
      const half =
        basePaddedSpan / 2 / Math.max(0.15, Math.min(12, viewport.yZoom));
      mainMin = mid - half;
      mainMax = mid + half;
    }
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
    priceAxisLeft,
    priceScalePosition,
    plotLeft,
    plotRight,
    plotWidth,
    mainRect,
    subPanes,
    timeAxisTop: usableHeight,
    leftIndex,
    rightIndex,
    barStepPx,
    scaleMode: effectiveScale,
    invertScale,
    precision,
    basePrice,
    rawMainSpan: basePaddedSpan,
    mainMin,
    mainMax,
    plusButtonRect: null,
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
  for (let v = first; v <= max + step * 0.001 && out.length < 32; v += step) {
    out.push(v);
  }
  return out;
}

const MONTHS_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

const tzFormatterCache = new Map<string, Intl.DateTimeFormat>();

const WEEKDAYS_IT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

function getTzParts(sec: number, tz: ChartTimezoneSetting) {
  let fmt = tzFormatterCache.get(tz);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      tzFormatterCache.set(tz, fmt);
    } catch {
      const d = new Date(sec * 1000);
      return {
        weekday: WEEKDAYS_IT[d.getDay()],
        yyyy: String(d.getFullYear()),
        yy: String(d.getFullYear()).slice(-2),
        mmNum: String(d.getMonth() + 1).padStart(2, '0'),
        mon: MONTHS_IT[d.getMonth()],
        dd: String(d.getDate()).padStart(2, '0'),
        hh: String(d.getHours()).padStart(2, '0'),
        min: String(d.getMinutes()).padStart(2, '0'),
      };
    }
  }
  const parts = fmt.formatToParts(new Date(sec * 1000));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const monthIdx = Math.max(0, Math.min(11, parseInt(map.month ?? '1', 10) - 1));
  const yyyy = map.year ?? '2026';
  const hh = map.hour === '24' ? '00' : (map.hour ?? '00');
  const enDay = (map.weekday ?? '').toLowerCase().slice(0, 3);
  const enDayMap: Record<string, string> = {
    sun: 'dom',
    mon: 'lun',
    tue: 'mar',
    wed: 'mer',
    thu: 'gio',
    fri: 'ven',
    sat: 'sab',
  };
  return {
    weekday: enDayMap[enDay] ?? WEEKDAYS_IT[new Date(sec * 1000).getDay()],
    yyyy,
    yy: yyyy.slice(-2),
    mmNum: map.month ?? '01',
    mon: MONTHS_IT[monthIdx],
    dd: map.day ?? '01',
    hh,
    min: map.minute ?? '00',
  };
}

function formatAxisTime(
  sec: number,
  timeframe: Timeframe,
  full = false,
  dateFormat: ChartDateFormat = 'DD MMM',
  tz: ChartTimezoneSetting = 'Europe/Rome',
  showWeekday = true,
): string {
  const p = getTzParts(sec, tz);
  const dateStr =
    dateFormat === 'YYYY-MM-DD'
      ? `${p.yyyy}-${p.mmNum}-${p.dd}`
      : dateFormat === 'DD/MM/YYYY'
        ? `${p.dd}/${p.mmNum}/${p.yyyy}`
        : dateFormat === 'MM/DD/YYYY'
          ? `${p.mmNum}/${p.dd}/${p.yyyy}`
          : `${p.dd} ${p.mon} '${p.yy}`;

  if (full) {
    const prefix = showWeekday ? `${p.weekday} ` : '';
    if (timeframe === '1D' || timeframe === '1W' || timeframe === '1M') {
      return `${prefix}${dateStr}`;
    }
    return `${prefix}${dateStr} ${p.hh}:${p.min}`;
  }

  if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
    return `${p.hh}:${p.min}`;
  }
  if (timeframe === '1H' || timeframe === '4H') {
    return p.hh === '00' ? `${p.dd} ${p.mon}` : `${p.dd} ${p.hh}:${p.min}`;
  }
  if (timeframe === '1M') {
    return `${p.mon} '${p.yy}`;
  }
  if (dateFormat === 'YYYY-MM-DD') return `${p.mmNum}-${p.dd}`;
  if (dateFormat === 'DD/MM/YYYY') return `${p.dd}/${p.mmNum}`;
  if (dateFormat === 'MM/DD/YYYY') return `${p.mmNum}/${p.dd}`;
  return `${p.dd} ${p.mon}`;
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
  if (mode === 'indexed100') {
    return scaledVal.toFixed(2);
  }
  const actual = fromScaledValue(scaledVal, mode, basePrice);
  return formatPrice(actual, precision);
}

interface OccupiedInterval {
  top: number;
  bottom: number;
}

function resolveNonOverlappingY(
  desiredY: number,
  badgeHeight: number,
  minY: number,
  maxY: number,
  occupied: OccupiedInterval[],
  enabled: boolean,
): number {
  const half = badgeHeight / 2;
  let y = Math.max(minY + half, Math.min(maxY - half, desiredY));
  if (!enabled) {
    occupied.push({ top: y - half, bottom: y + half });
    return y;
  }

  const collides = (cy: number) =>
    occupied.some(
      (iv) => cy + half + 1 > iv.top && cy - half - 1 < iv.bottom,
    );

  if (collides(y)) {
    const step = badgeHeight + 2;
    for (let k = 1; k <= 8; k++) {
      const up = y - k * step;
      if (up >= minY + half && !collides(up)) {
        y = up;
        break;
      }
      const down = y + k * step;
      if (down <= maxY - half && !collides(down)) {
        y = down;
        break;
      }
    }
  }
  occupied.push({ top: y - half, bottom: y + half });
  return y;
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
    invertScale: invertProp,
    lockPriceToBarRatio: lockProp,
    priceScalePosition: posProp,
    showVolume,
    showGrid,
    countdownText,
    overlaySeries,
    separateSeries,
    compareSeries,
    drawings,
    draftDrawing,
    selectedDrawingId,
    eraserHoveredId = null,
    hideDrawings,
    hideMode = 'none',
    positions,
    orders = [],
    executions = [],
    alerts,
    crosshair,
    syncedCrosshairTime = null,
    subPaneHeightRatio,
    subPaneSplitterHovered = false,
    cursorMode = 'crosshair',
    bidPrice,
    askPrice,
    zoomBox = null,
  } = params;

  const settings = params.chartSettings ?? getDefaultChartSettings(theme);
  const symCfg = settings.symbol;
  const scalesCfg = settings.scales;
  const canvasCfg = settings.canvas;
  const tradingCfg = settings.trading;
  const alertsCfg = settings.alerts;

  const pal = getChartPalette(theme);
  const effectivePrecision = resolveEffectivePrecision(symbol.precision, settings);
  const invertScale = invertProp ?? scalesCfg.invertScale;
  const lockPriceToBarRatio = lockProp ?? scalesCfg.lockPriceToBarRatio;
  const priceScalePosition = posProp ?? scalesCfg.position;
  const canonicalType = normalizeChartType(chartType);

  const hideIndicators = hideMode === 'indicators' || hideMode === 'all';
  const hidePositions = hideMode === 'positions' || hideMode === 'all';
  const hideAllDrawings =
    hideDrawings || hideMode === 'drawings' || hideMode === 'all';

  const visibleOverlays = hideIndicators ? [] : overlaySeries;
  const visibleSeparates = hideIndicators ? [] : separateSeries;

  const layout = computeChartLayout({
    width,
    height,
    precision: effectivePrecision,
    fallbackBasePrice: symbol.basePrice,
    candles,
    viewport,
    scaleMode,
    autoScale,
    invertScale,
    lockPriceToBarRatio,
    priceScalePosition,
    scalePriceChartOnly: scalesCfg.scalePriceChartOnly,
    topMarginPct: canvasCfg.topMarginPct,
    bottomMarginPct: Math.max(canvasCfg.bottomMarginPct, showVolume ? 12 : 4),
    scaleFontSize: canvasCfg.scaleFontSize,
    subPaneHeightRatio,
    overlaySeries: visibleOverlays,
    separateSeries: visibleSeparates,
    compareSeries,
  });

  // ======================== 0. CANVAS BACKGROUND ========================
  if (canvasCfg.bgType === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, canvasCfg.bgColor);
    grad.addColorStop(1, canvasCfg.bgGradientEnd);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = canvasCfg.bgColor || pal.bg;
  }
  ctx.fillRect(0, 0, width, height);

  const startIdx = Math.max(0, Math.floor(layout.leftIndex) - 1);
  const endIdx = Math.min(candles.length - 1, Math.ceil(layout.rightIndex) + 1);

  // ======================== 1. MAIN PANE GRID & WATERMARK ========================
  const mainTicks = niceTicks(
    layout.mainMin,
    layout.mainMax,
    Math.max(4, Math.floor(layout.mainRect.height / 58)),
  );

  const xStepBars = Math.max(1, Math.round(105 / Math.max(1, layout.barStepPx)));
  const xTickIndices: number[] = [];
  const firstTick = Math.ceil(layout.leftIndex / xStepBars) * xStepBars;
  const maxTickIdx = Math.ceil(layout.rightIndex);
  for (let i = firstTick; i <= maxTickIdx; i += xStepBars) {
    if (i < 0 && candles.length === 0) continue;
    xTickIndices.push(i);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    layout.plotLeft,
    layout.mainRect.top,
    layout.plotWidth,
    layout.mainRect.height,
  );
  ctx.clip();

  const drawHorzGrid =
    showGrid && (canvasCfg.gridMode === 'both' || canvasCfg.gridMode === 'horz');
  const drawVertGrid =
    showGrid && (canvasCfg.gridMode === 'both' || canvasCfg.gridMode === 'vert');

  if (drawHorzGrid) {
    ctx.strokeStyle = canvasCfg.horzGridColor || pal.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const tv of mainTicks) {
      const y = Math.round(scaledToY(tv, layout)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(layout.plotLeft, y);
      ctx.lineTo(layout.plotRight, y);
      ctx.stroke();
    }
  }

  if (drawVertGrid) {
    ctx.strokeStyle = canvasCfg.vertGridColor || pal.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const idx of xTickIndices) {
      const x = Math.round(indexToX(idx, layout)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, layout.mainRect.top);
      ctx.lineTo(x, layout.mainRect.bottom);
      ctx.stroke();
    }
  }

  // Watermark
  if (canvasCfg.showWatermark) {
    ctx.save();
    ctx.fillStyle = canvasCfg.watermarkColor || pal.watermark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const wmFontSize = Math.min(54, Math.max(22, Math.floor(layout.plotWidth / 15)));
    ctx.font = `700 ${wmFontSize}px ${FONT_FAMILY}`;
    const wmText = canvasCfg.watermarkText.trim() || `${symbol.ticker} · ${timeframe}`;
    ctx.fillText(
      wmText,
      layout.plotLeft + layout.plotWidth / 2,
      layout.mainRect.top + layout.mainRect.height * 0.5,
    );
    ctx.restore();
  }

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
        const prevClose = candles[i - 1]?.close ?? c.open;
        const isUp = symCfg.colorBarsBasedOnPrevClose
          ? c.close >= prevClose
          : c.close >= c.open;
        ctx.fillStyle = isUp ? pal.volUp : pal.volDown;
        ctx.fillRect(x - barW / 2, layout.mainRect.bottom - h, barW, h);
      }
    }
  }

  // ======================== 3. OVERLAY INDICATOR BANDS & HLINES ========================
  for (const ind of visibleOverlays) {
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

    if (ind.hlines) {
      for (const hl of ind.hlines) {
        const y = Math.round(priceToY(hl.value, layout)) + 0.5;
        if (y < layout.mainRect.top - 10 || y > layout.mainRect.bottom + 10) continue;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        applyLineDash(ctx, hl.lineStyle ?? 'dashed');
        ctx.beginPath();
        ctx.moveTo(layout.plotLeft, y);
        ctx.lineTo(layout.plotRight, y);
        ctx.stroke();
        if (hl.label) {
          ctx.fillStyle = hl.color;
          ctx.font = `600 10px ${FONT_FAMILY}`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(hl.label, layout.plotRight - 6, y - 2);
        }
        ctx.restore();
      }
    }
  }

  // ======================== 4. PRICE SERIES (ALL 13 CHART STYLES) ========================
  const upBody = symCfg.candleUpColor || pal.up;
  const downBody = symCfg.candleDownColor || pal.down;
  const upBorder = symCfg.candleBorderUpColor || upBody;
  const downBorder = symCfg.candleBorderDownColor || downBody;
  const upWick = symCfg.candleWickUpColor || upBody;
  const downWick = symCfg.candleWickDownColor || downBody;
  const seriesLineColor = symCfg.lineColor || pal.line;
  const seriesLineW = Math.max(1, symCfg.lineWidth || 2);

  if (candles.length > 0) {
    const bodyW = Math.max(1.5, Math.min(22, layout.barStepPx * 0.72));

    if (
      canonicalType === 'candles' ||
      canonicalType === 'hollow_candles' ||
      canonicalType === 'volume_candles' ||
      canonicalType === 'heikin_ashi'
    ) {
      let maxVisVol = 0;
      if (canonicalType === 'volume_candles') {
        for (let i = startIdx; i <= endIdx; i++) {
          if (candles[i] && candles[i].volume > maxVisVol) maxVisVol = candles[i].volume;
        }
      }

      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const prevC = candles[i - 1];
        const x = indexToX(i, layout);
        const yO = priceToY(c.open, layout);
        const yC = priceToY(c.close, layout);
        const yH = priceToY(c.high, layout);
        const yL = priceToY(c.low, layout);

        const isUpOpenClose = c.close >= c.open;
        const isUpPrevClose = prevC ? c.close >= prevC.close : isUpOpenClose;
        const colorIsUp =
          canonicalType === 'hollow_candles'
            ? isUpPrevClose
            : symCfg.colorBarsBasedOnPrevClose
              ? isUpPrevClose
              : isUpOpenClose;

        const w =
          canonicalType === 'volume_candles' && maxVisVol > 0
            ? Math.max(
                2,
                Math.min(
                  layout.barStepPx * 0.94,
                  bodyW * (0.28 + 0.96 * Math.sqrt(c.volume / maxVisVol)),
                ),
              )
            : bodyW;

        if (symCfg.showWicks) {
          const wickX = Math.round(x) + 0.5;
          ctx.strokeStyle = colorIsUp ? upWick : downWick;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(wickX, yH);
          ctx.lineTo(wickX, yL);
          ctx.stroke();
        }

        const top = Math.min(yO, yC);
        const h = Math.max(1, Math.abs(yC - yO));
        const bx = x - w / 2;

        if (canonicalType === 'hollow_candles' && isUpOpenClose) {
          ctx.fillStyle = canvasCfg.bgColor || pal.bg;
          ctx.fillRect(bx, top, w, h);
          ctx.strokeStyle = colorIsUp ? upBorder : downBorder;
          ctx.lineWidth = 1.3;
          ctx.strokeRect(
            bx + 0.5,
            top + 0.5,
            Math.max(1, w - 1),
            Math.max(1, h - 1),
          );
        } else {
          ctx.fillStyle = colorIsUp ? upBody : downBody;
          ctx.fillRect(bx, top, w, h);
          if (symCfg.showBorders && w >= 3) {
            ctx.strokeStyle = colorIsUp ? upBorder : downBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(
              bx + 0.5,
              top + 0.5,
              Math.max(1, w - 1),
              Math.max(1, h - 1),
            );
          }
        }
      }
    } else if (canonicalType === 'bars') {
      const tickW = Math.max(2, bodyW * 0.5);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([]);
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const prevC = candles[i - 1];
        const x = Math.round(indexToX(i, layout)) + 0.5;
        const yO = priceToY(c.open, layout);
        const yC = priceToY(c.close, layout);
        const yH = priceToY(c.high, layout);
        const yL = priceToY(c.low, layout);
        const isUp = symCfg.colorBarsBasedOnPrevClose
          ? c.close >= (prevC?.close ?? c.open)
          : c.close >= c.open;
        ctx.strokeStyle = isUp ? upBody : downBody;
        ctx.beginPath();
        ctx.moveTo(x, yH);
        ctx.lineTo(x, yL);
        ctx.moveTo(x - tickW, yO);
        ctx.lineTo(x, yO);
        ctx.moveTo(x, yC);
        ctx.lineTo(x + tickW, yC);
        ctx.stroke();
      }
    } else if (
      canonicalType === 'line' ||
      canonicalType === 'line_markers' ||
      canonicalType === 'area'
    ) {
      const pts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        pts.push({ x: indexToX(i, layout), y: priceToY(c.close, layout) });
      }
      if (pts.length >= 2) {
        if (canonicalType === 'area') {
          const grad = ctx.createLinearGradient(
            0,
            layout.mainRect.top,
            0,
            layout.mainRect.bottom,
          );
          grad.addColorStop(0, symCfg.areaTopColor || pal.areaTop);
          grad.addColorStop(1, symCfg.areaBottomColor || pal.areaBottom);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, layout.mainRect.bottom);
          for (const p of pts) ctx.lineTo(p.x, p.y);
          ctx.lineTo(pts[pts.length - 1].x, layout.mainRect.bottom);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = seriesLineColor;
        ctx.lineWidth = seriesLineW;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();

        if (canonicalType === 'line_markers') {
          const r = Math.max(2.4, Math.min(4.5, seriesLineW + 1.2));
          for (const p of pts) {
            ctx.fillStyle = canvasCfg.bgColor || pal.bg;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = seriesLineColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (canonicalType === 'step_line') {
      const pts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        pts.push({ x: indexToX(i, layout), y: priceToY(c.close, layout) });
      }
      if (pts.length >= 2) {
        ctx.strokeStyle = seriesLineColor;
        ctx.lineWidth = seriesLineW;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) {
          // Horizontal to next bar's X, then vertical step to next bar's Y
          ctx.lineTo(pts[k].x, pts[k - 1].y);
          ctx.lineTo(pts[k].x, pts[k].y);
        }
        ctx.stroke();
      }
    } else if (canonicalType === 'hlc_area') {
      const highPts: ScreenPoint[] = [];
      const closePts: ScreenPoint[] = [];
      const lowPts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = indexToX(i, layout);
        highPts.push({ x, y: priceToY(c.high, layout) });
        closePts.push({ x, y: priceToY(c.close, layout) });
        lowPts.push({ x, y: priceToY(c.low, layout) });
      }
      if (closePts.length >= 2) {
        // High-to-Close green translucent band
        ctx.fillStyle = 'rgba(8, 153, 129, 0.24)';
        ctx.beginPath();
        ctx.moveTo(highPts[0].x, highPts[0].y);
        for (let k = 1; k < highPts.length; k++) ctx.lineTo(highPts[k].x, highPts[k].y);
        for (let k = closePts.length - 1; k >= 0; k--) ctx.lineTo(closePts[k].x, closePts[k].y);
        ctx.closePath();
        ctx.fill();

        // Close-to-Low red translucent band
        ctx.fillStyle = 'rgba(242, 54, 69, 0.24)';
        ctx.beginPath();
        ctx.moveTo(closePts[0].x, closePts[0].y);
        for (let k = 1; k < closePts.length; k++) ctx.lineTo(closePts[k].x, closePts[k].y);
        for (let k = lowPts.length - 1; k >= 0; k--) ctx.lineTo(lowPts[k].x, lowPts[k].y);
        ctx.closePath();
        ctx.fill();

        // High & Low outline strokes
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = upBody;
        ctx.beginPath();
        ctx.moveTo(highPts[0].x, highPts[0].y);
        for (let k = 1; k < highPts.length; k++) ctx.lineTo(highPts[k].x, highPts[k].y);
        ctx.stroke();

        ctx.strokeStyle = downBody;
        ctx.beginPath();
        ctx.moveTo(lowPts[0].x, lowPts[0].y);
        for (let k = 1; k < lowPts.length; k++) ctx.lineTo(lowPts[k].x, lowPts[k].y);
        ctx.stroke();

        // Prominent Close line
        ctx.strokeStyle = seriesLineColor;
        ctx.lineWidth = seriesLineW;
        ctx.beginPath();
        ctx.moveTo(closePts[0].x, closePts[0].y);
        for (let k = 1; k < closePts.length; k++) ctx.lineTo(closePts[k].x, closePts[k].y);
        ctx.stroke();
      }
    } else if (canonicalType === 'baseline') {
      const pts: ScreenPoint[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        pts.push({ x: indexToX(i, layout), y: priceToY(c.close, layout) });
      }
      if (pts.length >= 2) {
        const baseY = layout.mainRect.top + layout.mainRect.height * 0.5;
        ctx.save();
        ctx.strokeStyle = canvasCfg.scaleTextColor || pal.axisText;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(layout.plotLeft, baseY);
        ctx.lineTo(layout.plotRight, baseY);
        ctx.stroke();
        ctx.restore();

        // Top half (green)
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          layout.plotLeft,
          layout.mainRect.top,
          layout.plotWidth,
          baseY - layout.mainRect.top,
        );
        ctx.clip();
        const upGrad = ctx.createLinearGradient(0, layout.mainRect.top, 0, baseY);
        upGrad.addColorStop(0, symCfg.baselineTopColor || 'rgba(8, 153, 129, 0.28)');
        upGrad.addColorStop(1, 'rgba(8, 153, 129, 0.02)');
        ctx.fillStyle = upGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = upBody;
        ctx.lineWidth = seriesLineW;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
        ctx.restore();

        // Bottom half (red)
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          layout.plotLeft,
          baseY,
          layout.plotWidth,
          layout.mainRect.bottom - baseY,
        );
        ctx.clip();
        const downGrad = ctx.createLinearGradient(0, baseY, 0, layout.mainRect.bottom);
        downGrad.addColorStop(0, 'rgba(242, 54, 69, 0.02)');
        downGrad.addColorStop(1, symCfg.baselineBottomColor || 'rgba(242, 54, 69, 0.28)');
        ctx.fillStyle = downGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, baseY);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1].x, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = downBody;
        ctx.lineWidth = seriesLineW;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
        ctx.restore();
      }
    } else if (canonicalType === 'columns') {
      const colW = Math.max(1.5, Math.min(18, layout.barStepPx * 0.68));
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const prevC = candles[i - 1];
        const x = indexToX(i, layout);
        const yC = priceToY(c.close, layout);
        const isUp = symCfg.colorBarsBasedOnPrevClose
          ? c.close >= (prevC?.close ?? c.open)
          : c.close >= c.open;
        ctx.fillStyle = isUp ? upBody : downBody;
        ctx.fillRect(
          x - colW / 2,
          yC,
          colW,
          Math.max(1, layout.mainRect.bottom - yC),
        );
      }
    } else if (canonicalType === 'high_low') {
      const barW = Math.max(2, Math.min(16, layout.barStepPx * 0.56));
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = indexToX(i, layout);
        const yH = priceToY(c.high, layout);
        const yL = priceToY(c.low, layout);
        const top = Math.min(yH, yL);
        const h = Math.max(2, Math.abs(yL - yH));
        ctx.fillStyle = 'rgba(41, 98, 255, 0.28)';
        ctx.fillRect(x - barW / 2, top, barW, h);
        ctx.strokeStyle = seriesLineColor;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        ctx.strokeRect(x - barW / 2 + 0.5, top + 0.5, Math.max(1, barW - 1), Math.max(1, h - 1));
      }
    }
  }

  // ======================== 5. OVERLAY INDICATOR PLOTS ========================
  for (const ind of visibleOverlays) {
    for (const plot of ind.plots) {
      ctx.save();
      ctx.strokeStyle = plot.color;
      ctx.fillStyle = plot.color;
      ctx.lineWidth = plot.lineWidth ?? 1.6;
      applyLineDash(ctx, plot.lineStyle);

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
  if (
    compareSeries.length > 0 &&
    (layout.scaleMode === 'percent' || layout.scaleMode === 'indexed100')
  ) {
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
        const scaledComp =
          layout.scaleMode === 'indexed100'
            ? (val / Math.max(1e-12, compBase)) * 100
            : ((val - compBase) / Math.max(1e-12, compBase)) * 100;
        const y = scaledToY(scaledComp, layout);
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

  // ======================== 6b. VISIBLE HIGH / LOW PRICE FLAGS ========================
  let visibleMaxPrice = -Infinity;
  let visibleMaxIdx = -1;
  let visibleMinPrice = Infinity;
  let visibleMinIdx = -1;
  if (scalesCfg.showHighLowLabels && candles.length > 0) {
    for (let i = Math.max(0, startIdx); i <= Math.min(candles.length - 1, endIdx); i++) {
      const c = candles[i];
      if (!c) continue;
      if (c.high > visibleMaxPrice) {
        visibleMaxPrice = c.high;
        visibleMaxIdx = i;
      }
      if (c.low < visibleMinPrice) {
        visibleMinPrice = c.low;
        visibleMinIdx = i;
      }
    }
    const drawHLFlag = (barIdx: number, price: number, prefix: string, color: string) => {
      const x = indexToX(barIdx, layout);
      const y = Math.round(priceToY(price, layout)) + 0.5;
      const stubToRight = x < layout.plotLeft + layout.plotWidth * 0.7;
      const stubEndX = stubToRight ? x + 28 : x - 28;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(stubEndX, y);
      ctx.stroke();
      ctx.font = `600 10px ${FONT_FAMILY}`;
      ctx.fillStyle = color;
      ctx.textAlign = stubToRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${prefix} ${formatPrice(price, effectivePrecision)}`,
        stubEndX + (stubToRight ? 4 : -4),
        y,
      );
      ctx.restore();
    };
    if (visibleMaxIdx >= 0) drawHLFlag(visibleMaxIdx, visibleMaxPrice, 'Max', upBody);
    if (visibleMinIdx >= 0) drawHLFlag(visibleMinIdx, visibleMinPrice, 'Min', downBody);
  }

  // ======================== 7. PAPER POSITIONS, ORDERS, EXECUTIONS & ALERTS ========================
  if (!hidePositions && tradingCfg.showPositions) {
    const lineStartX = tradingCfg.extendLinesLeft
      ? layout.plotLeft
      : layout.plotLeft + layout.plotWidth * 0.55;
    for (const pos of positions) {
      if (pos.symbol !== symbol.ticker) continue;
      const entryY = Math.round(priceToY(pos.avgEntryPrice, layout)) + 0.5;
      const posColor = pos.unrealizedPnl >= 0 ? '#089981' : '#f23645';
      ctx.save();
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(lineStartX, entryY);
      ctx.lineTo(layout.plotRight, entryY);
      ctx.stroke();

      const pnlSign = pos.unrealizedPnl >= 0 ? '+' : '';
      const tag = `${pos.side === 'long' ? 'LONG' : 'SHORT'} ${pos.quantity} · ${pnlSign}${formatPrice(pos.unrealizedPnl, 2)} €`;
      ctx.font = `600 11px ${FONT_FAMILY}`;
      const tw = ctx.measureText(tag).width + 14;
      const tx = Math.max(layout.plotLeft + 10, layout.plotRight - tw - 12);
      ctx.fillStyle = posColor;
      drawRoundedRectPath(ctx, tx, entryY - 10, tw, 20, 4);
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
        ctx.moveTo(lineStartX, tpY);
        ctx.lineTo(layout.plotRight, tpY);
        ctx.stroke();
      }
      if (pos.stopLoss) {
        const slY = Math.round(priceToY(pos.stopLoss, layout)) + 0.5;
        ctx.strokeStyle = '#f23645';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(lineStartX, slY);
        ctx.lineTo(layout.plotRight, slY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Pending Limit/Stop Orders
  if (!hidePositions && tradingCfg.showOrders && orders.length > 0) {
    const lineStartX = tradingCfg.extendLinesLeft
      ? layout.plotLeft
      : layout.plotLeft + layout.plotWidth * 0.55;
    for (const ord of orders) {
      if (ord.symbol !== symbol.ticker || ord.status !== 'open') continue;
      const targetPrice = ord.limitPrice ?? ord.stopPrice;
      if (targetPrice == null) continue;
      const oy = Math.round(priceToY(targetPrice, layout)) + 0.5;
      const col = ord.side === 'buy' ? '#2962ff' : '#f23645';
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lineStartX, oy);
      ctx.lineTo(layout.plotRight, oy);
      ctx.stroke();

      const lbl = `${ord.type.toUpperCase()} ${ord.side === 'buy' ? 'BUY' : 'SELL'} ${ord.quantity} @ ${formatPrice(targetPrice, effectivePrecision)}`;
      ctx.font = `600 10px ${FONT_FAMILY}`;
      const tw = ctx.measureText(lbl).width + 12;
      const ox = Math.max(layout.plotLeft + 10, layout.plotRight - tw - 12);
      ctx.fillStyle = col;
      drawRoundedRectPath(ctx, ox, oy - 9, tw, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, ox + 6, oy);
      ctx.restore();
    }
  }

  // Filled Execution Markers
  if (!hidePositions && tradingCfg.showExecutions && executions.length > 0) {
    for (const ex of executions) {
      if (ex.symbol !== symbol.ticker || ex.status !== 'filled' || !ex.filledPrice) continue;
      const sec = Math.floor((ex.filledAt ?? ex.createdAt) / 1000);
      const idx = timeToIndex(sec, rawCandles);
      const x = indexToX(idx, layout);
      if (x < layout.plotLeft - 10 || x > layout.plotRight + 10) continue;
      const y = priceToY(ex.filledPrice, layout);
      const isBuy = ex.side === 'buy';
      ctx.save();
      ctx.fillStyle = isBuy ? '#2962ff' : '#f23645';
      ctx.beginPath();
      if (isBuy) {
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x - 5, y + 11);
        ctx.lineTo(x + 5, y + 11);
      } else {
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x - 5, y - 11);
        ctx.lineTo(x + 5, y - 11);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Price Alerts Lines
  if (alertsCfg.showAlertLines && hideMode !== 'all') {
    const alertCol = alertsCfg.alertLineColor || '#ff9800';
    for (const al of alerts) {
      if (al.symbol !== symbol.ticker || al.target !== 'price') continue;
      if (alertsCfg.onlyActiveAlerts && al.status !== 'active') continue;
      if (!alertsCfg.onlyActiveAlerts && al.status === 'expired') continue;
      const ay = Math.round(priceToY(al.value, layout)) + 0.5;
      if (ay < layout.mainRect.top - 10 || ay > layout.mainRect.bottom + 10) continue;
      ctx.save();
      ctx.strokeStyle = alertCol;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(layout.plotLeft, ay);
      ctx.lineTo(layout.plotRight, ay);
      ctx.stroke();

      const lbl = `Avviso ${formatPrice(al.value, effectivePrecision)}`;
      ctx.font = `600 10.5px ${FONT_FAMILY}`;
      const tw = ctx.measureText(lbl).width + 14;
      const ax = Math.max(layout.plotLeft + 10, layout.plotRight - tw - 12);
      ctx.fillStyle = alertCol;
      drawRoundedRectPath(ctx, ax, ay - 9, tw, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, ax + 7, ay);
      ctx.restore();
    }
  }

  // ======================== 8. INTERACTIVE DRAWINGS LAYER (ALL 64 TOOLS) ========================
  const toScreen = (pt: DrawingPoint): ScreenPoint => ({
    x: indexToX(timeToIndex(pt.time, rawCandles), layout),
    y: priceToY(pt.price, layout),
  });

  if (!hideAllDrawings) {
    renderAllDrawings(
      {
        ctx,
        plotLeft: layout.plotLeft,
        plotRight: layout.plotRight,
        plotWidth: layout.plotWidth,
        mainTop: layout.mainRect.top,
        mainBottom: layout.mainRect.bottom,
        mainHeight: layout.mainRect.height,
        candles: rawCandles,
        precision: effectivePrecision,
        theme,
        priceScalePosition: layout.priceScalePosition,
        toScreen,
        priceToY: (p) => priceToY(p, layout),
        indexToX: (idx) => indexToX(idx, layout),
        timeToIndex: (t) => timeToIndex(t, rawCandles),
      },
      drawings,
      draftDrawing,
      selectedDrawingId,
      eraserHoveredId,
      timeframe,
    );
  }

  // ======================== 9. LIVE LAST-PRICE & BID/ASK LINES ========================
  const lastCandle = rawCandles[rawCandles.length - 1];
  if (lastCandle && symCfg.showLastPriceLine) {
    const lastY = Math.round(priceToY(lastCandle.close, layout)) + 0.5;
    const lastColor = lastCandle.close >= lastCandle.open ? upBody : downBody;
    ctx.save();
    ctx.strokeStyle = lastColor;
    ctx.lineWidth = 1;
    applyLineDash(ctx, symCfg.lastPriceLineStyle);
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, lastY);
    ctx.lineTo(layout.plotRight, lastY);
    ctx.stroke();
    ctx.restore();
  }

  // Visible High / Low Price Lines (Linee prezzo max e min)
  let visHigh = -Infinity;
  let visLow = Infinity;
  if (scalesCfg.showHighLowLabels || scalesCfg.showHighLowLines) {
    for (let i = Math.max(0, startIdx); i <= Math.min(rawCandles.length - 1, endIdx); i++) {
      const c = rawCandles[i];
      if (!c) continue;
      if (c.high > visHigh) visHigh = c.high;
      if (c.low < visLow) visLow = c.low;
    }
  }

  if (scalesCfg.showHighLowLines && Number.isFinite(visHigh) && Number.isFinite(visLow)) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    const yHi = Math.round(priceToY(visHigh, layout)) + 0.5;
    const yLo = Math.round(priceToY(visLow, layout)) + 0.5;
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.72)';
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, yHi);
    ctx.lineTo(layout.plotRight, yHi);
    ctx.moveTo(layout.plotLeft, yLo);
    ctx.lineTo(layout.plotRight, yLo);
    ctx.stroke();
    ctx.restore();
  }

  if (scalesCfg.showBidAskLines && bidPrice != null && askPrice != null) {
    const yBid = Math.round(priceToY(bidPrice, layout)) + 0.5;
    const yAsk = Math.round(priceToY(askPrice, layout)) + 0.5;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = '#f23645';
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, yBid);
    ctx.lineTo(layout.plotRight, yBid);
    ctx.stroke();
    ctx.strokeStyle = '#2962ff';
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, yAsk);
    ctx.lineTo(layout.plotRight, yAsk);
    ctx.stroke();
    ctx.restore();
  }

  // ======================== 9b. ZOOM-IN SELECTION BOX ========================
  if (zoomBox) {
    const zx = Math.min(zoomBox.x1, zoomBox.x2);
    const zy = Math.min(zoomBox.y1, zoomBox.y2);
    const zw = Math.abs(zoomBox.x2 - zoomBox.x1);
    const zh = Math.abs(zoomBox.y2 - zoomBox.y1);
    ctx.save();
    ctx.fillStyle = 'rgba(41, 98, 255, 0.16)';
    ctx.fillRect(zx, zy, zw, zh);
    ctx.strokeStyle = '#2962FF';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(zx + 0.5, zy + 0.5, zw, zh);
    ctx.restore();
  }

  ctx.restore(); // End Main Pane clip

  // ======================== 10. SUB-PANES (RSI / MACD / STOCH / ATR / PINE) ========================
  const scaleFontPx = Math.max(9, Math.min(14, canvasCfg.scaleFontSize || 11));
  const axisTextColor = canvasCfg.scaleTextColor || pal.axisText;

  for (let spIdx = 0; spIdx < layout.subPanes.length; spIdx++) {
    const sp = layout.subPanes[spIdx];
    const { series, rect, min, max } = sp;
    const valToSubY = (v: number) =>
      rect.bottom - ((v - min) / Math.max(1e-9, max - min)) * rect.height;

    const isPrimarySplitter = spIdx === 0 && subPaneSplitterHovered;
    ctx.strokeStyle = isPrimarySplitter ? '#2962ff' : pal.axisBorder;
    ctx.lineWidth = isPrimarySplitter ? 2 : 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(rect.top) + 0.5);
    ctx.lineTo(width, Math.round(rect.top) + 0.5);
    ctx.stroke();

    if (isPrimarySplitter) {
      const gx = layout.plotLeft + layout.plotWidth / 2;
      ctx.fillStyle = '#2962ff';
      drawRoundedRectPath(ctx, gx - 20, Math.round(rect.top) - 2, 40, 4, 2);
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.plotLeft, rect.top, layout.plotWidth, rect.height);
    ctx.clip();

    if (series.hlines && series.hlines.length >= 2) {
      const vals = series.hlines.map((h) => h.value).sort((a, b) => a - b);
      const lowVal = vals[0];
      const highVal = vals[vals.length - 1];
      if (highVal > lowVal) {
        const yTop = valToSubY(highVal);
        const yBot = valToSubY(lowVal);
        ctx.fillStyle = pal.subShade;
        ctx.fillRect(layout.plotLeft, yTop, layout.plotWidth, yBot - yTop);
      }
    }

    if (series.hlines) {
      for (const hl of series.hlines) {
        const hy = Math.round(valToSubY(hl.value)) + 0.5;
        ctx.save();
        ctx.strokeStyle = hl.color;
        ctx.lineWidth = 1;
        applyLineDash(ctx, hl.lineStyle ?? 'dashed');
        ctx.beginPath();
        ctx.moveTo(layout.plotLeft, hy);
        ctx.lineTo(layout.plotRight, hy);
        ctx.stroke();
        ctx.restore();
      }
    }

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
        applyLineDash(ctx, plot.lineStyle);
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

    // Sub-pane Legend Title + Live Value (supports local hover AND multi-chart synced crosshair)
    const refIdx =
      crosshair.visible && rawCandles.length > 0
        ? Math.max(0, Math.min(rawCandles.length - 1, crosshair.barIndex))
        : syncedCrosshairTime != null && rawCandles.length > 0
          ? Math.max(
              0,
              Math.min(
                rawCandles.length - 1,
                Math.round(timeToIndex(syncedCrosshairTime, rawCandles)),
              ),
            )
          : rawCandles.length - 1;
    let legendX = layout.plotLeft + 10;
    const legendY = rect.top + 13;
    ctx.font = `600 11px ${FONT_FAMILY}`;
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

    // Sub-pane Price Axis labels (left or right)
    const subTicks = niceTicks(min, max, 3);
    ctx.fillStyle = axisTextColor;
    ctx.font = `${scaleFontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = priceScalePosition === 'left' ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    const subLabelX =
      priceScalePosition === 'left'
        ? layout.priceAxisWidth - 6
        : layout.priceAxisLeft + 6;
    for (const stv of subTicks) {
      const sy = valToSubY(stv);
      if (sy < rect.top + 10 || sy > rect.bottom - 10) continue;
      ctx.fillText(
        Math.abs(stv) >= 1000 ? formatVolume(stv) : stv.toFixed(1),
        subLabelX,
        sy,
      );
    }
  }

  // ======================== 11. PRICE AXIS (LEFT OR RIGHT) & TIME AXIS CHROME ========================
  ctx.strokeStyle = pal.axisBorder;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const axisBorderX =
    priceScalePosition === 'left'
      ? Math.round(layout.plotLeft) + 0.5
      : Math.round(layout.plotRight) + 0.5;
  ctx.beginPath();
  ctx.moveTo(axisBorderX, 0);
  ctx.lineTo(axisBorderX, height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, Math.round(layout.timeAxisTop) + 0.5);
  ctx.lineTo(width, Math.round(layout.timeAxisTop) + 0.5);
  ctx.stroke();

  // Optional currency / unit badge at top of price axis
  if (scalesCfg.showCurrencyUnit && symbol.currency) {
    const unitLabel =
      layout.scaleMode === 'percent'
        ? '%'
        : layout.scaleMode === 'indexed100'
          ? '100'
          : symbol.currency;
    ctx.fillStyle = pal.axisBorder;
    drawRoundedRectPath(
      ctx,
      layout.priceAxisLeft + 6,
      4,
      layout.priceAxisWidth - 12,
      16,
      3,
    );
    ctx.fill();
    ctx.fillStyle = axisTextColor;
    ctx.font = `600 9.5px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unitLabel, layout.priceAxisLeft + layout.priceAxisWidth / 2, 12);
  }

  // Main price axis tick labels (skip fake placeholder ticks when candles are empty while loading)
  const hasCandles = candles.length > 0;
  const tickFontPx = effectivePrecision >= 6 ? Math.min(10, scaleFontPx) : scaleFontPx;
  ctx.fillStyle = axisTextColor;
  ctx.font = `${tickFontPx}px ${FONT_FAMILY}`;
  ctx.textAlign = priceScalePosition === 'left' ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  const tickTextX =
    priceScalePosition === 'left'
      ? layout.priceAxisWidth - 5
      : layout.priceAxisLeft + 5;
  const topLabelClearance = scalesCfg.showCurrencyUnit ? 26 : 12;

  if (hasCandles) {
    for (const tv of mainTicks) {
      const y = scaledToY(tv, layout);
      if (y < topLabelClearance || y > layout.mainRect.bottom - 10) continue;
      ctx.fillText(
        formatAxisPrice(tv, layout.scaleMode, layout.basePrice, effectivePrecision),
        tickTextX,
        y,
      );
    }
  }

  // Helper to draw a price-axis badge pill cleanly on either Left or Right axis
  const occupiedPills: OccupiedInterval[] = [];
  const drawAxisBadge = (
    desiredY: number,
    bg: string,
    mainText: string,
    subText?: string | null,
    namePrefix?: string | null,
  ) => {
    const badgeH = subText ? 30 : 20;
    const cy = resolveNonOverlappingY(
      desiredY,
      badgeH,
      topLabelClearance,
      layout.mainRect.bottom - 4,
      occupiedPills,
      scalesCfg.noOverlappingLabels,
    );
    const badgeY = cy - badgeH / 2;
    const bx =
      priceScalePosition === 'left' ? 0 : layout.priceAxisLeft + 1;
    const bw = layout.priceAxisWidth - 1;

    ctx.fillStyle = bg;
    ctx.fillRect(bx, badgeY, bw, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${tickFontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = priceScalePosition === 'left' ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, tickTextX, subText ? badgeY + 9 : cy);
    if (subText) {
      ctx.font = `500 9.5px ${FONT_FAMILY}`;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(subText, tickTextX, badgeY + 22);
    }

    if (namePrefix) {
      ctx.font = `700 10px ${FONT_FAMILY}`;
      const nw = ctx.measureText(namePrefix).width + 10;
      const nx =
        priceScalePosition === 'left'
          ? layout.plotLeft + 2
          : layout.plotRight - nw - 2;
      ctx.fillStyle = bg;
      drawRoundedRectPath(ctx, nx, cy - 9, nw, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(namePrefix, nx + nw / 2, cy);
    }
  };

  // Live Last-Price Badge (+ optional Countdown + optional Symbol Name tag)
  if (lastCandle && scalesCfg.showSymbolLastValueLabel) {
    const lastY = priceToY(lastCandle.close, layout);
    const lastColor = lastCandle.close >= lastCandle.open ? upBody : downBody;
    const priceText =
      layout.scaleMode === 'percent' || layout.scaleMode === 'indexed100'
        ? formatAxisPrice(
            toScaledValue(lastCandle.close, layout.scaleMode, layout.basePrice),
            layout.scaleMode,
            layout.basePrice,
            effectivePrecision,
          )
        : formatPrice(lastCandle.close, effectivePrecision);
    drawAxisBadge(
      lastY,
      lastColor,
      priceText,
      scalesCfg.showCountdown ? countdownText : null,
      scalesCfg.showSymbolNameLabel ? symbol.ticker : null,
    );
  }

  // Visible High / Low Price Axis Badges (Etichette prezzo max e min)
  if (scalesCfg.showHighLowLabels && Number.isFinite(visHigh) && Number.isFinite(visLow)) {
    drawAxisBadge(
      priceToY(visHigh, layout),
      '#2962ff',
      formatPrice(visHigh, effectivePrecision),
      null,
      'Max',
    );
    drawAxisBadge(
      priceToY(visLow, layout),
      '#2962ff',
      formatPrice(visLow, effectivePrecision),
      null,
      'Min',
    );
  }

  // Bid / Ask Axis Badges
  if (scalesCfg.showBidAskLabels && bidPrice != null && askPrice != null) {
    drawAxisBadge(
      priceToY(askPrice, layout),
      '#2962ff',
      formatPrice(askPrice, effectivePrecision),
      null,
      'Ask',
    );
    drawAxisBadge(
      priceToY(bidPrice, layout),
      '#f23645',
      formatPrice(bidPrice, effectivePrecision),
      null,
      'Bid',
    );
  }

  // Overlay Indicator Last-Value Axis Badges
  if (scalesCfg.showIndicatorValueLabels && rawCandles.length > 0) {
    const lastIdx = rawCandles.length - 1;
    for (const ind of visibleOverlays) {
      for (const plot of ind.plots.slice(0, 2)) {
        const val = plot.data[lastIdx]?.value;
        if (val == null || !Number.isFinite(val)) continue;
        const py = priceToY(val, layout);
        if (py < layout.mainRect.top || py > layout.mainRect.bottom) continue;
        const valText =
          layout.scaleMode === 'percent' || layout.scaleMode === 'indexed100'
            ? formatAxisPrice(
                toScaledValue(val, layout.scaleMode, layout.basePrice),
                layout.scaleMode,
                layout.basePrice,
                effectivePrecision,
              )
            : formatPrice(val, effectivePrecision);
        drawAxisBadge(
          py,
          plot.color,
          valText,
          null,
          scalesCfg.showIndicatorNameLabels ? ind.title.slice(0, 12) : null,
        );
      }
    }
  }

  // Time Axis Labels (renders historical AND virtual future whitespace dates just like TradingView!)
  if (hasCandles) {
    ctx.fillStyle = axisTextColor;
    ctx.font = `${scaleFontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const idx of xTickIndices) {
      const x = indexToX(idx, layout);
      if (x < layout.plotLeft + 28 || x > layout.plotRight - 28) continue;
      const tickTime = indexToTime(idx, rawCandles);
      ctx.fillText(
        formatAxisTime(tickTime, timeframe, false, scalesCfg.dateFormat, symCfg.timezone),
        x,
        layout.timeAxisTop + TIME_AXIS_HEIGHT / 2,
      );
    }
  }

  // ======================== 11b. ACTIVE DRAFT / SELECTED DRAWING BLUE AXIS BANDS & PILLS (1:1 TradingView) ========================
  const activeAxisDrawing = !hideAllDrawings
    ? (draftDrawing ??
      (selectedDrawingId
        ? drawings.find((d) => d.id === selectedDrawingId && d.visible) ?? null
        : null))
    : null;

  if (hasCandles && activeAxisDrawing && activeAxisDrawing.points.length > 0) {
    const anchorPts = activeAxisDrawing.points.map((pt) => ({
      time: pt.time,
      price: pt.price,
      x: indexToX(timeToIndex(pt.time, rawCandles), layout),
      y: priceToY(pt.price, layout),
    }));

    const ys = anchorPts
      .map((p) => p.y)
      .filter((y) => Number.isFinite(y));
    const xs = anchorPts
      .map((p) => p.x)
      .filter((x) => Number.isFinite(x));

    const bx = priceScalePosition === 'left' ? 0 : layout.priceAxisLeft + 1;
    const bw = layout.priceAxisWidth - 1;

    // Translucent blue span highlight band on Price Axis & Time Axis when >= 2 points span a range
    if (ys.length >= 2) {
      const minY = Math.max(layout.mainRect.top, Math.min(...ys));
      const maxY = Math.min(layout.mainRect.bottom, Math.max(...ys));
      if (maxY - minY > 1) {
        ctx.fillStyle = 'rgba(41, 98, 255, 0.20)';
        ctx.fillRect(bx, minY, bw, maxY - minY);
      }
    }
    if (xs.length >= 2) {
      const minX = Math.max(layout.plotLeft, Math.min(...xs));
      const maxX = Math.min(layout.plotRight, Math.max(...xs));
      if (maxX - minX > 1) {
        ctx.fillStyle = 'rgba(41, 98, 255, 0.20)';
        ctx.fillRect(minX, layout.timeAxisTop + 1, maxX - minX, TIME_AXIS_HEIGHT - 2);
      }
    }

    // Solid #2962ff Price & Date pills for distinct anchor points (always visible immediately on Click 1 / Tap 1!)
    const drawnPriceYs: number[] = [];
    const drawnTimeXs: number[] = [];
    for (const pt of anchorPts) {
      if (
        pt.y >= layout.mainRect.top &&
        pt.y <= layout.mainRect.bottom &&
        !drawnPriceYs.some((prevY) => Math.abs(prevY - pt.y) < 4)
      ) {
        drawnPriceYs.push(pt.y);
        const pLabel =
          layout.scaleMode === 'percent' || layout.scaleMode === 'indexed100'
            ? formatAxisPrice(
                toScaledValue(pt.price, layout.scaleMode, layout.basePrice),
                layout.scaleMode,
                layout.basePrice,
                effectivePrecision,
              )
            : formatPrice(pt.price, effectivePrecision);
        ctx.fillStyle = '#2962ff';
        ctx.fillRect(bx, pt.y - 10, bw, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 ${tickFontPx}px ${FONT_FAMILY}`;
        ctx.textAlign = priceScalePosition === 'left' ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(pLabel, tickTextX, pt.y);
      }

      if (
        pt.x >= layout.plotLeft &&
        pt.x <= layout.plotRight &&
        !drawnTimeXs.some((prevX) => Math.abs(prevX - pt.x) < 12)
      ) {
        drawnTimeXs.push(pt.x);
        const tLabel = formatAxisTime(
          pt.time,
          timeframe,
          true,
          scalesCfg.dateFormat,
          symCfg.timezone,
          scalesCfg.showWeekdayOnTimeScaleLabels !== false,
        );
        ctx.font = `600 11px ${FONT_FAMILY}`;
        const tw = ctx.measureText(tLabel).width + 16;
        const pillX = Math.max(
          layout.plotLeft + 2,
          Math.min(layout.plotRight - tw - 2, pt.x - tw / 2),
        );
        ctx.fillStyle = '#2962ff';
        drawRoundedRectPath(
          ctx,
          pillX,
          layout.timeAxisTop + 3,
          tw,
          TIME_AXIS_HEIGHT - 6,
          3,
        );
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          tLabel,
          pillX + tw / 2,
          layout.timeAxisTop + TIME_AXIS_HEIGHT / 2,
        );
      }
    }
  }

  // ======================== 12. INTERACTIVE CROSSHAIR, AXIS PILLS & `+` BUTTON ========================
  if (
    hasCandles &&
    crosshair.visible &&
    crosshair.x >= layout.plotLeft &&
    crosshair.x <= layout.plotRight &&
    crosshair.y >= 0 &&
    crosshair.y <= layout.timeAxisTop
  ) {
    // Unclamped bar-slot snap (snaps cleanly to virtual future bar slots right of the latest candle!)
    const snapX = Number.isFinite(crosshair.barIndex)
      ? Math.round(indexToX(crosshair.barIndex, layout)) + 0.5
      : Math.round(crosshair.x) + 0.5;
    const cy = Math.round(crosshair.y) + 0.5;

    if (cursorMode === 'crosshair') {
      ctx.save();
      ctx.strokeStyle = canvasCfg.crosshairColor || pal.crosshair;
      ctx.lineWidth = Math.max(0.75, canvasCfg.crosshairWidth || 1);
      applyLineDash(ctx, canvasCfg.crosshairStyle);
      ctx.beginPath();
      ctx.moveTo(snapX, 0);
      ctx.lineTo(snapX, layout.timeAxisTop);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(layout.plotLeft, cy);
      ctx.lineTo(layout.plotRight, cy);
      ctx.stroke();
      ctx.restore();
    } else if (cursorMode === 'dot') {
      ctx.save();
      ctx.fillStyle = canvasCfg.crosshairColor || pal.crosshair;
      ctx.beginPath();
      ctx.arc(snapX, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (cursorMode === 'crosshair' || cursorMode === 'dot') {
      // Price Axis Crosshair Pill
      let yLabel = '';
      if (cy <= layout.mainRect.bottom) {
        const pVal = yToPrice(cy, layout);
        yLabel =
          layout.scaleMode === 'percent' || layout.scaleMode === 'indexed100'
            ? formatAxisPrice(
                toScaledValue(pVal, layout.scaleMode, layout.basePrice),
                layout.scaleMode,
                layout.basePrice,
                effectivePrecision,
              )
            : formatPrice(pVal, effectivePrecision);
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
        const bx =
          priceScalePosition === 'left' ? 0 : layout.priceAxisLeft + 1;
        ctx.fillStyle = pal.pillBg;
        ctx.fillRect(bx, cy - 10, layout.priceAxisWidth - 1, 20);
        ctx.fillStyle = pal.pillText;
        ctx.font = `600 ${tickFontPx}px ${FONT_FAMILY}`;
        ctx.textAlign = priceScalePosition === 'left' ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(yLabel, tickTextX, cy);
      }

      // Bottom Time-Axis Date Pill
      const hoveredTime = indexToTime(crosshair.barIndex, rawCandles);
      const timeStr = formatAxisTime(
        hoveredTime,
        timeframe,
        true,
        scalesCfg.dateFormat,
        symCfg.timezone,
        scalesCfg.showWeekdayOnTimeScaleLabels !== false,
      );
      ctx.font = `600 11px ${FONT_FAMILY}`;
      const tw = ctx.measureText(timeStr).width + 16;
      const pillX = Math.max(
        layout.plotLeft + 2,
        Math.min(layout.plotRight - tw - 2, snapX - tw / 2),
      );
      ctx.fillStyle = pal.pillBg;
      drawRoundedRectPath(
        ctx,
        pillX,
        layout.timeAxisTop + 3,
        tw,
        TIME_AXIS_HEIGHT - 6,
        3,
      );
      ctx.fill();
      ctx.fillStyle = pal.pillText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        timeStr,
        pillX + tw / 2,
        layout.timeAxisTop + TIME_AXIS_HEIGHT / 2,
      );
    }

    // Iconic TradingView Price Axis Floating `+` Button
    if (
      scalesCfg.showPlusButton &&
      cy >= layout.mainRect.top + 12 &&
      cy <= layout.mainRect.bottom - 12
    ) {
      const plusX =
        priceScalePosition === 'left'
          ? layout.plotLeft + 11
          : layout.plotRight - 11;
      const plusY = Math.max(
        layout.mainRect.top + 14,
        Math.min(layout.mainRect.bottom - 14, cy),
      );
      const r = 9;
      ctx.save();
      ctx.fillStyle = pal.pillBg;
      ctx.strokeStyle = pal.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(plusX, plusY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(plusX - 4, plusY);
      ctx.lineTo(plusX + 4, plusY);
      ctx.moveTo(plusX, plusY - 4);
      ctx.lineTo(plusX, plusY + 4);
      ctx.stroke();
      ctx.restore();

      layout.plusButtonRect = {
        x: plusX,
        y: plusY,
        radius: 12,
        price: yToPrice(plusY, layout),
      };
    }
  } else if (hasCandles && syncedCrosshairTime != null) {
    // Synchronized vertical crosshair from a sibling pane in Multi-Chart layouts
    const syncIdx = Math.round(timeToIndex(syncedCrosshairTime, rawCandles));
    const syncX = Math.round(indexToX(syncIdx, layout)) + 0.5;
    if (syncX >= layout.plotLeft && syncX <= layout.plotRight) {
      ctx.save();
      ctx.strokeStyle = canvasCfg.crosshairColor || pal.crosshair;
      ctx.lineWidth = Math.max(0.75, canvasCfg.crosshairWidth || 1);
      applyLineDash(ctx, canvasCfg.crosshairStyle);
      ctx.beginPath();
      ctx.moveTo(syncX, 0);
      ctx.lineTo(syncX, layout.timeAxisTop);
      ctx.stroke();
      ctx.restore();

      const syncTime = indexToTime(syncIdx, rawCandles);
      const timeStr = formatAxisTime(
        syncTime,
        timeframe,
        true,
        scalesCfg.dateFormat,
        symCfg.timezone,
        scalesCfg.showWeekdayOnTimeScaleLabels !== false,
      );
      ctx.font = `600 11px ${FONT_FAMILY}`;
      const tw = ctx.measureText(timeStr).width + 16;
      const pillX = Math.max(
        layout.plotLeft + 2,
        Math.min(layout.plotRight - tw - 2, syncX - tw / 2),
      );
      ctx.fillStyle = pal.pillBg;
      drawRoundedRectPath(
        ctx,
        pillX,
        layout.timeAxisTop + 3,
        tw,
        TIME_AXIS_HEIGHT - 6,
        3,
      );
      ctx.fill();
      ctx.fillStyle = pal.pillText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        timeStr,
        pillX + tw / 2,
        layout.timeAxisTop + TIME_AXIS_HEIGHT / 2,
      );
    }
  }

  return layout;
}
