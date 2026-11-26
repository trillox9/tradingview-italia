import type { ViewportState } from '../components/chart/chartRenderer';

export const MIN_BAR_SPACING_PX = 1.4;
export const MAX_BAR_SPACING_PX = 96;
export const DEFAULT_BAR_SPACING_PX = 7.5;
export const MIN_VISIBLE_BARS = 8;
export const MAX_VISIBLE_BARS = 600;

/**
 * Computes default visible bar count proportional to plotWidth so candles stay
 * crisp and readable across both Desktop (1440px) and Mobile (390px) viewports,
 * matching TradingView's barSpacing-driven layout (~6-8px per bar).
 */
export function defaultVisibleBarsForWidth(
  plotWidth: number,
  barSpacingPx = DEFAULT_BAR_SPACING_PX,
): number {
  const safeW = Math.max(120, plotWidth);
  return clampVisibleBars(safeW / Math.max(MIN_BAR_SPACING_PX, barSpacingPx), safeW);
}

export function clampVisibleBars(visibleBars: number, plotWidth: number): number {
  const safeW = Math.max(120, plotWidth);
  const minFromSpacing = Math.max(MIN_VISIBLE_BARS, safeW / MAX_BAR_SPACING_PX);
  const maxFromSpacing = Math.min(MAX_VISIBLE_BARS, safeW / MIN_BAR_SPACING_PX);
  return Math.max(minFromSpacing, Math.min(maxFromSpacing, visibleBars));
}

export function computeMaxRightBound(candleCount: number, visibleBars: number): number {
  return Math.max(visibleBars, candleCount + visibleBars * 0.85);
}

export function clampRightIndex(
  rightIndex: number,
  candleCount: number,
  visibleBars: number,
): number {
  return Math.max(6, Math.min(computeMaxRightBound(candleCount, visibleBars), rightIndex));
}

/**
 * TradingView Wheel Zoom (Empirically verified on live it.tradingview.com/chart/):
 * - Plain wheel (`anchorCursor = false`): keeps the RIGHT EDGE (`rightIndex`) pinned!
 * - `Ctrl + Wheel` (`anchorCursor = true`): pins the exact bar under cursor X (`anchorRatio`)!
 * - `deltaY < 0` zooms IN (larger barSpacing, fewer visibleBars);
 * - `deltaY > 0` zooms OUT (smaller barSpacing, more visibleBars).
 */
export function applyWheelZoom(params: {
  viewport: ViewportState;
  deltaY: number;
  plotWidth: number;
  candleCount: number;
  anchorCursor: boolean;
  anchorRatio: number;
}): ViewportState {
  const { viewport, deltaY, plotWidth, candleCount, anchorCursor, anchorRatio } = params;
  // Empirically ~10% spacing step per standard 120px mouse wheel notch
  const clampedDy = Math.max(-180, Math.min(180, deltaY));
  const factor = Math.exp(clampedDy * 0.00085);
  const nextBars = clampVisibleBars(viewport.visibleBars * factor, plotWidth);

  if (!anchorCursor) {
    // Default TradingView behavior: right edge (latest bar + right margin) remains anchored
    return {
      ...viewport,
      visibleBars: nextBars,
      rightIndex: clampRightIndex(viewport.rightIndex, candleCount, nextBars),
    };
  }

  // Ctrl + Wheel: keep the exact bar under cursor X anchored to the same screen pixel
  const ratio = Math.max(0, Math.min(1, anchorRatio));
  const anchorIndex = viewport.rightIndex - viewport.visibleBars * (1 - ratio);
  const nextRight = anchorIndex + nextBars * (1 - ratio);
  return {
    ...viewport,
    visibleBars: nextBars,
    rightIndex: clampRightIndex(nextRight, candleCount, nextBars),
  };
}

/**
 * TradingView `Shift + Wheel` Horizontal Scroll (Empirically verified):
 * - `deltaY > 0` (scroll down) shifts chart LEFT into history (rightIndex decreases).
 * - `deltaY < 0` (scroll up) shifts chart RIGHT toward newer bars (rightIndex increases).
 */
export function applyShiftWheelPan(params: {
  viewport: ViewportState;
  deltaY: number;
  candleCount: number;
}): ViewportState {
  const { viewport, deltaY, candleCount } = params;
  const clampedDy = Math.max(-240, Math.min(240, deltaY));
  const shiftBars = (clampedDy / 120) * Math.max(2, viewport.visibleBars * 0.08);
  return {
    ...viewport,
    rightIndex: clampRightIndex(viewport.rightIndex - shiftBars, candleCount, viewport.visibleBars),
  };
}

/**
 * TradingView Time-Axis Horizontal Drag (Empirically verified on live it.tradingview.com/chart/):
 * - Dragging RIGHT (`dx > 0`) compresses toward the anchored right edge -> DECREASES barSpacing (ZOOMS OUT, more visibleBars).
 * - Dragging LEFT (`dx < 0`) pulls away from the right edge -> INCREASES barSpacing (ZOOMS IN, fewer visibleBars).
 * - Right edge (`rightIndex`) stays anchored throughout!
 */
export function applyTimeAxisDragZoom(params: {
  startViewport: ViewportState;
  dx: number;
  plotWidth: number;
  candleCount: number;
}): ViewportState {
  const { startViewport, dx, plotWidth, candleCount } = params;
  const factor = Math.exp(dx * 0.0038);
  const nextBars = clampVisibleBars(startViewport.visibleBars * factor, plotWidth);
  return {
    ...startViewport,
    visibleBars: nextBars,
    rightIndex: clampRightIndex(startViewport.rightIndex, candleCount, nextBars),
  };
}

/**
 * TradingView Price-Axis Vertical Drag:
 * - Dragging DOWN (`dy > 0`) compresses price scale (increases span).
 * - Dragging UP (`dy < 0`) expands price scale (decreases span).
 */
export function applyPriceAxisDragZoom(params: {
  viewport: ViewportState;
  dy: number;
  startMin: number;
  startMax: number;
  rawSpan: number;
}): ViewportState {
  const { viewport, dy, startMin, startMax, rawSpan } = params;
  const baseSpan = Math.max(1e-12, startMax - startMin);
  const nextSpan = Math.max(
    rawSpan / 20,
    Math.min(rawSpan * 20, baseSpan * Math.exp(dy * 0.0055)),
  );
  const mid = (startMin + startMax) / 2;
  return {
    ...viewport,
    yZoom: Math.max(0.15, Math.min(12, rawSpan / nextSpan)),
    manualMin: mid - nextSpan / 2,
    manualMax: mid + nextSpan / 2,
  };
}
