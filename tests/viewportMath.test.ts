import { describe, expect, it } from 'vitest';
import {
  applyPriceAxisDragZoom,
  applyShiftWheelPan,
  applyTimeAxisDragZoom,
  applyWheelZoom,
  defaultVisibleBarsForWidth,
} from '../src/engine';
import type { ViewportState } from '../src/components/chart/chartRenderer';

const BASE_VP: ViewportState = {
  visibleBars: 120,
  rightIndex: 190,
  yZoom: 1,
  yOffset: 0,
  manualMin: null,
  manualMax: null,
};

describe('TradingView 1:1 Viewport & Zoom Math (viewportMath.ts)', () => {
  it('plain wheel zooms while keeping the RIGHT EDGE (rightIndex) strictly pinned', () => {
    const zoomedIn = applyWheelZoom({
      viewport: BASE_VP,
      deltaY: -120,
      plotWidth: 1000,
      candleCount: 180,
      anchorCursor: false,
      anchorRatio: 0.25,
    });
    expect(zoomedIn.visibleBars).toBeLessThan(BASE_VP.visibleBars);
    expect(zoomedIn.rightIndex).toBeCloseTo(BASE_VP.rightIndex, 6);

    const zoomedOut = applyWheelZoom({
      viewport: BASE_VP,
      deltaY: 120,
      plotWidth: 1000,
      candleCount: 180,
      anchorCursor: false,
      anchorRatio: 0.25,
    });
    expect(zoomedOut.visibleBars).toBeGreaterThan(BASE_VP.visibleBars);
    expect(zoomedOut.rightIndex).toBeCloseTo(BASE_VP.rightIndex, 6);
  });

  it('Ctrl+wheel zooms while keeping the exact bar under cursor X pinned to the same pixel', () => {
    const anchorRatio = 0.35;
    const barUnderCursorBefore =
      BASE_VP.rightIndex - BASE_VP.visibleBars * (1 - anchorRatio);

    const zoomed = applyWheelZoom({
      viewport: BASE_VP,
      deltaY: -240,
      plotWidth: 1000,
      candleCount: 180,
      anchorCursor: true,
      anchorRatio,
    });
    const barUnderCursorAfter =
      zoomed.rightIndex - zoomed.visibleBars * (1 - anchorRatio);

    expect(zoomed.visibleBars).toBeLessThan(BASE_VP.visibleBars);
    expect(barUnderCursorAfter).toBeCloseTo(barUnderCursorBefore, 6);
    expect(zoomed.rightIndex).not.toBeCloseTo(BASE_VP.rightIndex, 2);
  });

  it('Shift+wheel scrolls horizontally without altering bar spacing', () => {
    const scrollHistory = applyShiftWheelPan({
      viewport: BASE_VP,
      deltaY: 120,
      candleCount: 180,
    });
    expect(scrollHistory.visibleBars).toBe(BASE_VP.visibleBars);
    expect(scrollHistory.rightIndex).toBeLessThan(BASE_VP.rightIndex);

    const scrollFuture = applyShiftWheelPan({
      viewport: BASE_VP,
      deltaY: -120,
      candleCount: 180,
    });
    expect(scrollFuture.visibleBars).toBe(BASE_VP.visibleBars);
    expect(scrollFuture.rightIndex).toBeGreaterThan(BASE_VP.rightIndex);
  });

  it('Time-axis drag RIGHT zooms OUT (more visible bars) and LEFT zooms IN, keeping rightIndex anchored', () => {
    const dragRight = applyTimeAxisDragZoom({
      startViewport: BASE_VP,
      dx: 120,
      plotWidth: 1000,
      candleCount: 180,
    });
    expect(dragRight.visibleBars).toBeGreaterThan(BASE_VP.visibleBars);
    expect(dragRight.rightIndex).toBeCloseTo(BASE_VP.rightIndex, 6);

    const dragLeft = applyTimeAxisDragZoom({
      startViewport: BASE_VP,
      dx: -120,
      plotWidth: 1000,
      candleCount: 180,
    });
    expect(dragLeft.visibleBars).toBeLessThan(BASE_VP.visibleBars);
    expect(dragLeft.rightIndex).toBeCloseTo(BASE_VP.rightIndex, 6);
  });

  it('Price-axis drag DOWN expands price span (compresses candles) and UP shrinks span', () => {
    const dragDown = applyPriceAxisDragZoom({
      viewport: BASE_VP,
      dy: 100,
      startMin: 90,
      startMax: 110,
      rawSpan: 20,
    });
    expect((dragDown.manualMax ?? 0) - (dragDown.manualMin ?? 0)).toBeGreaterThan(20);

    const dragUp = applyPriceAxisDragZoom({
      viewport: BASE_VP,
      dy: -100,
      startMin: 90,
      startMax: 110,
      rawSpan: 20,
    });
    expect((dragUp.manualMax ?? 0) - (dragUp.manualMin ?? 0)).toBeLessThan(20);
  });

  it('scales default visible bars proportionally between Desktop and Mobile widths', () => {
    const desktopBars = defaultVisibleBarsForWidth(1320);
    const mobileBars = defaultVisibleBarsForWidth(332);
    expect(desktopBars).toBeGreaterThan(120);
    expect(mobileBars).toBeGreaterThanOrEqual(35);
    expect(mobileBars).toBeLessThan(65);
  });
});
