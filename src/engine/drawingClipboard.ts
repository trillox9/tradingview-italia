import type { DrawingObject } from '../types';

let copiedDrawing: DrawingObject | null = null;

export function setCopiedDrawing(drawing: DrawingObject | null): void {
  copiedDrawing = drawing
    ? {
        ...drawing,
        points: drawing.points.map((p) => ({ ...p })),
        style: { ...drawing.style },
        fibLevels: drawing.fibLevels ? [...drawing.fibLevels] : undefined,
        visibleTimeframes: drawing.visibleTimeframes
          ? [...drawing.visibleTimeframes]
          : undefined,
      }
    : null;
}

export function getCopiedDrawing(): DrawingObject | null {
  return copiedDrawing;
}

export function createPastedDrawing(
  source: DrawingObject,
  symbolTicker: string,
  timeframe: DrawingObject['timeframe'],
  priceOffset = 0,
  timeOffsetSec = 0,
): DrawingObject {
  return {
    ...source,
    id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: symbolTicker,
    timeframe,
    locked: false,
    visible: true,
    createdAt: Date.now(),
    points: source.points.map((p) => ({
      time: p.time + timeOffsetSec,
      price: p.price + priceOffset,
    })),
    style: { ...source.style },
    fibLevels: source.fibLevels ? [...source.fibLevels] : undefined,
    visibleTimeframes: source.visibleTimeframes
      ? [...source.visibleTimeframes]
      : undefined,
  };
}
