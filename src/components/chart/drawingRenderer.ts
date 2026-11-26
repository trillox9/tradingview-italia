import {
  normalizeDrawingTool,
  type Candle,
  type DrawingObject,
  type DrawingPoint,
  type LineStyle,
  type PriceScalePosition,
  type ScreenPoint,
} from '../../types';
import { formatPrice } from '../../data';
import {
  DEFAULT_FIB_EXTENSION_RATIOS,
  DEFAULT_FIB_RATIOS,
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
  distanceBetween,
  extendLineToBounds,
} from '../../engine';
import type { ThemeMode } from '../../store';

export interface DrawingRenderContext {
  ctx: CanvasRenderingContext2D;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  mainTop: number;
  mainBottom: number;
  mainHeight: number;
  candles: readonly Candle[];
  precision: number;
  theme: ThemeMode;
  priceScalePosition: PriceScalePosition;
  toScreen: (pt: DrawingPoint) => ScreenPoint;
  priceToY: (price: number) => number;
  indexToX: (index: number) => number;
  timeToIndex: (time: number) => number;
}

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';

export function applyLineDash(
  ctx: CanvasRenderingContext2D,
  style?: LineStyle,
) {
  if (style === 'dashed') ctx.setLineDash([6, 4]);
  else if (style === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);
}

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function colorWithAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const trimmed = color.trim();
  if (trimmed.startsWith('rgba(')) {
    const parts = trimmed
      .slice(5, -1)
      .split(',')
      .map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
    }
  }
  if (trimmed.startsWith('rgb(')) {
    const parts = trimmed
      .slice(4, -1)
      .split(',')
      .map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
    }
  }
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  return trimmed;
}

function resolveFill(d: DrawingObject, defaultAlpha = 0.16): string {
  if (d.style.fillColor) {
    if (typeof d.style.fillOpacity === 'number') {
      return colorWithAlpha(d.style.fillColor, d.style.fillOpacity);
    }
    return d.style.fillColor;
  }
  return colorWithAlpha(
    d.style.color,
    typeof d.style.fillOpacity === 'number' ? d.style.fillOpacity : defaultAlpha,
  );
}

function formatDurationIT(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  const days = Math.round(seconds / 86400);
  return `${days}g`;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: ScreenPoint,
  to: ScreenPoint,
  headLen: number,
  color: string,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLen * Math.cos(angle - Math.PI / 6),
    to.y - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - headLen * Math.cos(angle + Math.PI / 6),
    to.y - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  fg = '#ffffff',
  fontSize = 10.5,
  align: 'left' | 'center' | 'right' = 'left',
  borderColor?: string,
) {
  ctx.save();
  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  const padX = 7;
  const tw = ctx.measureText(text).width + padX * 2;
  const th = fontSize + 8;
  const rx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const ry = y - th / 2;
  ctx.fillStyle = bg;
  drawRoundedRectPath(ctx, rx, ry, tw, th, 4);
  ctx.fill();
  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rx + padX, y);
  ctx.restore();
}

function drawVertexBadge(
  ctx: CanvasRenderingContext2D,
  pt: ScreenPoint,
  label: string,
  color: string,
  above: boolean,
) {
  const offsetY = above ? -14 : 14;
  ctx.save();
  ctx.font = `700 10px ${FONT_FAMILY}`;
  const tw = Math.max(18, ctx.measureText(label).width + 10);
  const th = 16;
  ctx.fillStyle = color;
  drawRoundedRectPath(ctx, pt.x - tw / 2, pt.y + offsetY - th / 2, tw, th, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pt.x, pt.y + offsetY);
  ctx.restore();
}

function getExtendedEndpoints(
  p0: ScreenPoint,
  p1: ScreenPoint,
  rc: DrawingRenderContext,
  extendLeft?: boolean,
  extendRight?: boolean,
): [ScreenPoint, ScreenPoint] {
  if (extendLeft && extendRight) {
    return extendLineToBounds(p0, p1, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'extended');
  }
  if (extendRight) {
    return extendLineToBounds(p0, p1, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');
  }
  if (extendLeft) {
    const [e1, e0] = extendLineToBounds(p1, p0, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');
    return [e0, e1];
  }
  return [p0, p1];
}

function buildFontString(d: DrawingObject, defaultSize = 13): string {
  const size = d.style.fontSize ?? defaultSize;
  const weight = d.style.fontBold ? '700' : '600';
  const italic = d.style.fontItalic ? 'italic ' : '';
  return `${italic}${weight} ${size}px ${FONT_FAMILY}`;
}

function renderSingleDrawing(
  rc: DrawingRenderContext,
  d: DrawingObject,
  isSelected: boolean,
  isEraserHovered: boolean,
) {
  const { ctx } = rc;
  const pts = d.points.map(rc.toScreen);
  if (pts.length === 0) return;

  const canonical = normalizeDrawingTool(d.type);
  const strokeColor = isEraserHovered ? '#F23645' : d.style.color;
  const lineW = (d.style.lineWidth || 1.8) + (isEraserHovered ? 1 : 0);

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = lineW;
  applyLineDash(ctx, d.style.lineStyle);

  switch (canonical) {
    // ==================== GROUP 2: TREND LINES (13) ====================
    case 'trendline': {
      if (pts.length >= 2) {
        const [s, e] = getExtendedEndpoints(
          pts[0],
          pts[1],
          rc,
          d.extendLeft,
          d.extendRight,
        );
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        if (d.text) {
          const mx = (pts[0].x + pts[1].x) / 2;
          const my = (pts[0].y + pts[1].y) / 2 - 12;
          drawPill(ctx, mx, my, d.text, 'rgba(19, 19, 19, 0.85)', strokeColor, 11, 'center');
        }
      }
      break;
    }

    case 'ray':
    case 'extended_line': {
      if (pts.length >= 2) {
        const [s, e] = extendLineToBounds(
          pts[0],
          pts[1],
          rc.plotWidth + rc.plotLeft,
          rc.mainHeight,
          canonical === 'ray' ? 'ray' : 'extended',
        );
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }
      break;
    }

    case 'info_line': {
      if (pts.length >= 2) {
        const [s, e] = getExtendedEndpoints(pts[0], pts[1], rc, d.extendLeft, d.extendRight);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        const m = calculateMeasure(d.points[0], d.points[1], rc.candles);
        const ang = calculateTrendAngle(pts[0], pts[1]);
        const sign = m.priceDelta >= 0 ? '+' : '';
        const l1 = `${sign}${formatPrice(m.priceDelta, rc.precision)} (${sign}${m.percentDelta.toFixed(2)}%)`;
        const l2 = `${m.bars} barre · ${formatDurationIT(m.timeSpanSeconds)} · ${ang.angleDegrees.toFixed(1)}°`;
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = Math.min(pts[0].y, pts[1].y) - 24;

        ctx.save();
        ctx.setLineDash([]);
        ctx.font = `600 10.5px ${FONT_FAMILY}`;
        const bw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 16;
        const bh = 34;
        const bx = Math.max(rc.plotLeft + 6, Math.min(rc.plotRight - bw - 6, mx - bw / 2));
        const by = Math.max(rc.mainTop + 6, Math.min(rc.mainBottom - bh - 6, my - bh / 2));
        ctx.fillStyle = rc.theme === 'dark' ? 'rgba(19, 19, 19, 0.92)' : 'rgba(255, 255, 255, 0.95)';
        drawRoundedRectPath(ctx, bx, by, bw, bh, 5);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = rc.theme === 'dark' ? '#ffffff' : '#131313';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(l1, bx + bw / 2, by + 11);
        ctx.fillStyle = '#8C8C8C';
        ctx.font = `500 10px ${FONT_FAMILY}`;
        ctx.fillText(l2, bx + bw / 2, by + 24);
        ctx.restore();
      }
      break;
    }

    case 'trend_angle': {
      if (pts.length >= 2) {
        const [s, e] = getExtendedEndpoints(pts[0], pts[1], rc, d.extendLeft, d.extendRight);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        // Horizontal reference ray + protractor arc
        const radius = Math.min(46, Math.max(22, distanceBetween(pts[0], pts[1]) * 0.45));
        const dirX = pts[1].x >= pts[0].x ? 1 : -1;
        const radAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        const refAngle = dirX >= 0 ? 0 : Math.PI;
        const ang = calculateTrendAngle(pts[0], pts[1]);

        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.7);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[0].x + dirX * (radius + 14), pts[0].y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        const anticlockwise = dirX >= 0 ? radAngle < 0 : radAngle > 0;
        ctx.arc(pts[0].x, pts[0].y, radius, refAngle, radAngle, anticlockwise);
        ctx.stroke();

        const degText = `${ang.angleDegrees >= 0 ? '+' : ''}${ang.angleDegrees.toFixed(1)}°`;
        drawPill(
          ctx,
          pts[0].x + dirX * (radius + 26),
          pts[0].y + (pts[1].y < pts[0].y ? -10 : 10),
          degText,
          strokeColor,
          '#ffffff',
          10,
          'center',
        );
        ctx.restore();
      }
      break;
    }

    case 'hline': {
      const y = Math.round(pts[0].y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(rc.plotLeft, y);
      ctx.lineTo(rc.plotRight, y);
      ctx.stroke();
      const isLeftScale = rc.priceScalePosition === 'left';
      if (d.showPriceLabels !== false) {
        const lbl = formatPrice(d.points[0].price, rc.precision);
        drawPill(
          ctx,
          isLeftScale ? rc.plotLeft + 4 : rc.plotRight - 4,
          y,
          lbl,
          strokeColor,
          '#ffffff',
          10.5,
          isLeftScale ? 'left' : 'right',
        );
      }
      if (d.text) {
        drawPill(
          ctx,
          isLeftScale ? rc.plotRight - 10 : rc.plotLeft + 10,
          y - 12,
          d.text,
          'rgba(19, 19, 19, 0.85)',
          strokeColor,
          11,
          isLeftScale ? 'right' : 'left',
        );
      }
      break;
    }

    case 'hray': {
      const y = Math.round(pts[0].y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, y);
      ctx.lineTo(rc.plotRight, y);
      ctx.stroke();
      if (d.showPriceLabels !== false) {
        const isLeftScale = rc.priceScalePosition === 'left';
        const lbl = formatPrice(d.points[0].price, rc.precision);
        drawPill(
          ctx,
          isLeftScale ? rc.plotLeft + 4 : rc.plotRight - 4,
          y,
          lbl,
          strokeColor,
          '#ffffff',
          10.5,
          isLeftScale ? 'left' : 'right',
        );
      }
      break;
    }

    case 'vline': {
      const x = Math.round(pts[0].x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, rc.mainTop);
      ctx.lineTo(x, rc.mainBottom);
      ctx.stroke();
      if (d.text) {
        drawPill(ctx, x, rc.mainTop + 16, d.text, strokeColor, '#ffffff', 10.5, 'center');
      }
      break;
    }

    case 'cross_line': {
      const x = Math.round(pts[0].x) + 0.5;
      const y = Math.round(pts[0].y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(rc.plotLeft, y);
      ctx.lineTo(rc.plotRight, y);
      ctx.moveTo(x, rc.mainTop);
      ctx.lineTo(x, rc.mainBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (d.showPriceLabels !== false) {
        const isLeftScale = rc.priceScalePosition === 'left';
        drawPill(
          ctx,
          isLeftScale ? rc.plotLeft + 4 : rc.plotRight - 4,
          y,
          formatPrice(d.points[0].price, rc.precision),
          strokeColor,
          '#ffffff',
          10.5,
          isLeftScale ? 'left' : 'right',
        );
      }
      break;
    }

    case 'channel': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 44 };
        const ch = calculateParallelChannel(pts[0], pts[1], p3);
        const [bS, bE] = getExtendedEndpoints(ch.baseStart, ch.baseEnd, rc, d.extendLeft, d.extendRight);
        const [oS, oE] = getExtendedEndpoints(ch.offsetStart, ch.offsetEnd, rc, d.extendLeft, d.extendRight);
        const [mS, mE] = getExtendedEndpoints(ch.midStart, ch.midEnd, rc, d.extendLeft, d.extendRight);

        ctx.fillStyle = resolveFill(d, 0.14);
        ctx.beginPath();
        ctx.moveTo(bS.x, bS.y);
        ctx.lineTo(bE.x, bE.y);
        ctx.lineTo(oE.x, oE.y);
        ctx.lineTo(oS.x, oS.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(bS.x, bS.y);
        ctx.lineTo(bE.x, bE.y);
        ctx.moveTo(oS.x, oS.y);
        ctx.lineTo(oE.x, oE.y);
        ctx.stroke();

        if (d.showMiddleLine !== false) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mS.x, mS.y);
          ctx.lineTo(mE.x, mE.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case 'flat_channel': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 44 };
        const flatStart = { x: pts[0].x, y: p3.y };
        const flatEnd = { x: pts[1].x, y: p3.y };
        const midStart = { x: pts[0].x, y: (pts[0].y + p3.y) / 2 };
        const midEnd = { x: pts[1].x, y: (pts[1].y + p3.y) / 2 };

        ctx.fillStyle = resolveFill(d, 0.14);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(flatEnd.x, flatEnd.y);
        ctx.lineTo(flatStart.x, flatStart.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.moveTo(flatStart.x, flatStart.y);
        ctx.lineTo(flatEnd.x, flatEnd.y);
        ctx.stroke();

        if (d.showMiddleLine !== false) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midStart.x, midStart.y);
          ctx.lineTo(midEnd.x, midEnd.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case 'disjoint_channel': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 44 };
        // Opposite edge has inverted dy slope from base
        const baseDy = pts[1].y - pts[0].y;
        const oppStart = { x: pts[0].x, y: p3.y };
        const oppEnd = { x: pts[1].x, y: p3.y - baseDy };
        const midStart = { x: pts[0].x, y: (pts[0].y + oppStart.y) / 2 };
        const midEnd = { x: pts[1].x, y: (pts[1].y + oppEnd.y) / 2 };

        ctx.fillStyle = resolveFill(d, 0.14);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(oppEnd.x, oppEnd.y);
        ctx.lineTo(oppStart.x, oppStart.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.moveTo(oppStart.x, oppStart.y);
        ctx.lineTo(oppEnd.x, oppEnd.y);
        ctx.stroke();

        if (d.showMiddleLine !== false) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midStart.x, midStart.y);
          ctx.lineTo(midEnd.x, midEnd.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case 'regression_trend': {
      if (pts.length >= 2) {
        const idx0 = rc.timeToIndex(d.points[0].time);
        const idx1 = rc.timeToIndex(d.points[1].time);
        const reg = calculateLinearRegression(rc.candles, idx0, idx1, 2);
        if (reg) {
          const x0 = rc.indexToX(reg.startIdx);
          const x1 = rc.indexToX(reg.endIdx);
          const u0 = { x: x0, y: rc.priceToY(reg.upperStartPrice) };
          const u1 = { x: x1, y: rc.priceToY(reg.upperEndPrice) };
          const m0 = { x: x0, y: rc.priceToY(reg.midStartPrice) };
          const m1 = { x: x1, y: rc.priceToY(reg.midEndPrice) };
          const l0 = { x: x0, y: rc.priceToY(reg.lowerStartPrice) };
          const l1 = { x: x1, y: rc.priceToY(reg.lowerEndPrice) };

          // Upper half fill (red tint) & lower half fill (blue tint)
          ctx.fillStyle = 'rgba(242, 54, 69, 0.11)';
          ctx.beginPath();
          ctx.moveTo(u0.x, u0.y);
          ctx.lineTo(u1.x, u1.y);
          ctx.lineTo(m1.x, m1.y);
          ctx.lineTo(m0.x, m0.y);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = resolveFill(d, 0.13);
          ctx.beginPath();
          ctx.moveTo(m0.x, m0.y);
          ctx.lineTo(m1.x, m1.y);
          ctx.lineTo(l1.x, l1.y);
          ctx.lineTo(l0.x, l0.y);
          ctx.closePath();
          ctx.fill();

          // Upper & lower ±2σ borders
          const [eu0, eu1] = getExtendedEndpoints(u0, u1, rc, d.extendLeft, d.extendRight);
          const [el0, el1] = getExtendedEndpoints(l0, l1, rc, d.extendLeft, d.extendRight);
          const [em0, em1] = getExtendedEndpoints(m0, m1, rc, d.extendLeft, d.extendRight);

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineW;
          ctx.beginPath();
          ctx.moveTo(eu0.x, eu0.y);
          ctx.lineTo(eu1.x, eu1.y);
          ctx.moveTo(el0.x, el0.y);
          ctx.lineTo(el1.x, el1.y);
          ctx.stroke();

          // Dashed midline
          ctx.save();
          ctx.strokeStyle = '#F23645';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(em0.x, em0.y);
          ctx.lineTo(em1.x, em1.y);
          ctx.stroke();
          ctx.restore();

          if (d.showStats !== false) {
            drawPill(
              ctx,
              x0 + 6,
              l0.y + 14,
              `R = ${reg.pearsonR.toFixed(2)}`,
              'rgba(19, 19, 19, 0.86)',
              '#90BFF9',
              10,
              'left',
              strokeColor,
            );
          }
        }
      }
      break;
    }

    // ==================== GROUP 3: GANN & FIBONACCI (10) ====================
    case 'fib_retracement': {
      if (pts.length >= 2) {
        const minX = d.extendLeft ? rc.plotLeft : Math.min(pts[0].x, pts[1].x);
        const maxX = d.extendRight
          ? rc.plotRight
          : Math.max(Math.max(pts[0].x, pts[1].x), Math.min(pts[0].x, pts[1].x) + 64);
        const pStart = d.inverted ? d.points[1].price : d.points[0].price;
        const pEnd = d.inverted ? d.points[0].price : d.points[1].price;
        const levels = calculateFibonacciLevels(
          pStart,
          pEnd,
          d.fibLevels && d.fibLevels.length > 0 ? d.fibLevels : DEFAULT_FIB_RATIOS,
        );

        // Diagonal guide line
        ctx.save();
        ctx.strokeStyle = 'rgba(140, 140, 140, 0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < levels.length; i++) {
          const lv = levels[i];
          const y = rc.priceToY(lv.price);
          if (i > 0) {
            const prevY = rc.priceToY(levels[i - 1].price);
            ctx.fillStyle = colorWithAlpha(lv.color, d.style.fillOpacity ?? 0.09);
            ctx.fillRect(minX, Math.min(prevY, y), maxX - minX, Math.abs(y - prevY));
          }
          ctx.strokeStyle = isEraserHovered ? '#F23645' : lv.color;
          ctx.lineWidth = 1.25;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();

          if (d.showPriceLabels !== false) {
            ctx.fillStyle = isEraserHovered ? '#F23645' : lv.color;
            ctx.font = `600 10.5px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const labelStr =
              d.showPercentLabels === false
                ? `${lv.ratio}`
                : `${lv.ratio} (${formatPrice(lv.price, rc.precision)})`;
            ctx.fillText(labelStr, minX + 4, y - 2);
          }
        }
      }
      break;
    }

    case 'fib_extension': {
      if (pts.length >= 2) {
        // Dashed A->B->C impulse lines
        ctx.save();
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        if (pts[2]) ctx.lineTo(pts[2].x, pts[2].y);
        ctx.stroke();
        ctx.restore();

        const p2 = d.points[2] ?? d.points[1];
        const s2 = pts[2] ?? pts[1];
        const minX = d.extendLeft ? rc.plotLeft : s2.x;
        const maxX = d.extendRight ? rc.plotRight : Math.min(rc.plotRight, s2.x + 180);
        const levels = calculateFibExtension(
          d.points[0].price,
          d.points[1].price,
          p2.price,
          d.fibLevels && d.fibLevels.length > 0 ? d.fibLevels : DEFAULT_FIB_EXTENSION_RATIOS,
        );

        for (let i = 0; i < levels.length; i++) {
          const lv = levels[i];
          const y = rc.priceToY(lv.price);
          if (i > 0) {
            const prevY = rc.priceToY(levels[i - 1].price);
            ctx.fillStyle = colorWithAlpha(lv.color, 0.08);
            ctx.fillRect(minX, Math.min(prevY, y), maxX - minX, Math.abs(y - prevY));
          }
          ctx.strokeStyle = isEraserHovered ? '#F23645' : lv.color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();

          ctx.fillStyle = isEraserHovered ? '#F23645' : lv.color;
          ctx.font = `600 10.5px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${lv.ratio} (${formatPrice(lv.price, rc.precision)})`, minX + 4, y - 2);
        }
      }
      break;
    }

    case 'fib_channel': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 50 };
        const ch = calculateParallelChannel(pts[0], pts[1], p3);
        const ox = ch.offsetStart.x - ch.baseStart.x;
        const oy = ch.offsetStart.y - ch.baseStart.y;
        const ratios =
          d.fibLevels && d.fibLevels.length > 0
            ? d.fibLevels
            : [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
        const palette = ['#787B86', '#F23645', '#FF9800', '#089981', '#00BCD4', '#2962FF', '#787B86', '#AB47BC'];

        let prevA: ScreenPoint | null = null;
        let prevB: ScreenPoint | null = null;
        ratios.forEach((r, idx) => {
          const col = isEraserHovered ? '#F23645' : palette[idx % palette.length];
          const a = { x: ch.baseStart.x + ox * r, y: ch.baseStart.y + oy * r };
          const b = { x: ch.baseEnd.x + ox * r, y: ch.baseEnd.y + oy * r };
          const [ea, eb] = getExtendedEndpoints(a, b, rc, d.extendLeft, d.extendRight);

          if (prevA && prevB) {
            ctx.fillStyle = colorWithAlpha(col, 0.08);
            ctx.beginPath();
            ctx.moveTo(prevA.x, prevA.y);
            ctx.lineTo(prevB.x, prevB.y);
            ctx.lineTo(eb.x, eb.y);
            ctx.lineTo(ea.x, ea.y);
            ctx.closePath();
            ctx.fill();
          }

          ctx.strokeStyle = col;
          ctx.lineWidth = r === 0 || r === 1 ? 1.5 : 1.1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(ea.x, ea.y);
          ctx.lineTo(eb.x, eb.y);
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.font = `600 10px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(r), a.x + 4, a.y - 2);
          prevA = ea;
          prevB = eb;
        });
      }
      break;
    }

    case 'fib_time_zone': {
      if (pts.length >= 2) {
        const idx0 = rc.timeToIndex(d.points[0].time);
        const idx1 = rc.timeToIndex(d.points[1].time);
        const maxIdx = Math.max(rc.candles.length + 120, Math.ceil(Math.max(idx0, idx1)) + 120);
        const zones = calculateFibTimeZones(idx0, idx1, maxIdx);

        // Anchor trendline guide
        ctx.save();
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        ctx.restore();

        for (const z of zones) {
          const x = Math.round(rc.indexToX(z.barIndex)) + 0.5;
          if (x < rc.plotLeft - 2 || x > rc.plotRight + 2) continue;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.2;
          applyLineDash(ctx, d.style.lineStyle);
          ctx.beginPath();
          ctx.moveTo(x, rc.mainTop);
          ctx.lineTo(x, rc.mainBottom);
          ctx.stroke();
          drawPill(ctx, x, rc.mainBottom - 14, String(z.fibNumber), strokeColor, '#ffffff', 9.5, 'center');
        }
      }
      break;
    }

    case 'fib_speed_fan': {
      if (pts.length >= 2) {
        const x0 = pts[0].x;
        const y0 = pts[0].y;
        const dx = pts[1].x - x0;
        const dy = pts[1].y - y0;
        const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const colors = ['#F23645', '#FF9800', '#089981', '#00BCD4', '#2962FF', '#787B86'];

        // Bounding dashed box
        ctx.save();
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.35);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(x0, pts[1].x), Math.min(y0, pts[1].y), Math.abs(dx), Math.abs(dy));
        ctx.restore();

        ratios.forEach((r, idx) => {
          const col = isEraserHovered ? '#F23645' : colors[idx % colors.length];
          const targets: ScreenPoint[] = [
            { x: x0 + dx, y: y0 + dy * r },
            { x: x0 + dx * r, y: y0 + dy },
          ];
          for (const tgt of targets) {
            const [s, e] = extendLineToBounds(pts[0], tgt, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.15;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
          }
          ctx.fillStyle = col;
          ctx.font = `600 9.5px ${FONT_FAMILY}`;
          ctx.fillText(String(r), x0 + dx + 4, y0 + dy * r);
        });
      }
      break;
    }

    case 'fib_circles': {
      if (pts.length >= 2) {
        const radius = Math.max(6, distanceBetween(pts[0], pts[1]));
        const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
        const colors = ['#F23645', '#FF9800', '#089981', '#00BCD4', '#2962FF', '#AB47BC', '#E91E63'];

        // Center radius guide
        ctx.save();
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.5);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        ctx.restore();

        ratios.forEach((r, idx) => {
          const col = isEraserHovered ? '#F23645' : colors[idx % colors.length];
          const rad = radius * r;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, rad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = col;
          ctx.font = `600 9.5px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(r), pts[0].x + rad + 3, pts[0].y);
        });
      }
      break;
    }

    case 'gann_box': {
      if (pts.length >= 2) {
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);
        const ratios = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];

        ctx.fillStyle = resolveFill(d, 0.08);
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(rx, ry, rw, rh);

        // Internal Gann grid + diagonals
        ctx.save();
        ctx.lineWidth = 1;
        for (const r of ratios) {
          if (r === 0 || r === 1) continue;
          const gx = rx + rw * r;
          const gy = ry + rh * r;
          ctx.strokeStyle = colorWithAlpha(strokeColor, r === 0.5 ? 0.85 : 0.45);
          ctx.setLineDash(r === 0.5 ? [] : [3, 3]);
          ctx.beginPath();
          ctx.moveTo(gx, ry);
          ctx.lineTo(gx, ry + rh);
          ctx.moveTo(rx, gy);
          ctx.lineTo(rx + rw, gy);
          ctx.stroke();

          ctx.fillStyle = strokeColor;
          ctx.font = `600 9.5px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText(String(r), rx + 3, gy - 2);
        }
        // Main diagonals
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.6);
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.moveTo(rx, ry + rh);
        ctx.lineTo(rx + rw, ry);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'gann_fan': {
      if (pts.length >= 2) {
        const rays = calculateGannFanRays(pts[0], pts[1]);
        for (const ray of rays) {
          const [s, e] = extendLineToBounds(
            ray.origin,
            ray.through,
            rc.plotWidth + rc.plotLeft,
            rc.mainHeight,
            'ray',
          );
          const col = isEraserHovered ? '#F23645' : ray.color;
          ctx.strokeStyle = col;
          ctx.lineWidth = ray.label === '1x1' ? 1.8 : 1.15;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();

          // Label placed comfortably along ray
          const lx = ray.origin.x + (ray.through.x - ray.origin.x) * 1.1;
          const ly = ray.origin.y + (ray.through.y - ray.origin.y) * 1.1;
          if (lx > rc.plotLeft + 8 && lx < rc.plotRight - 24 && ly > rc.mainTop + 8 && ly < rc.mainBottom - 8) {
            ctx.fillStyle = col;
            ctx.font = `700 9.5px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(ray.label, lx + 3, ly);
          }
        }
      }
      break;
    }

    case 'pitchfork':
    case 'schiff_pitchfork': {
      if (pts.length >= 2) {
        if (pts.length === 2) {
          // Draft line p0->p1
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
          ctx.stroke();
        } else {
          const pf = calculatePitchfork(
            pts[0],
            pts[1],
            pts[2],
            canonical === 'schiff_pitchfork' ? 'schiff' : 'andrews',
          );
          const [mS, mE] = extendLineToBounds(pf.medianOrigin, pf.medianThrough, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');
          const [uS, uE] = extendLineToBounds(pf.upperOrigin, pf.upperThrough, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');
          const [lS, lE] = extendLineToBounds(pf.lowerOrigin, pf.lowerThrough, rc.plotWidth + rc.plotLeft, rc.mainHeight, 'ray');

          // Channel shading between upper/median and median/lower
          ctx.fillStyle = colorWithAlpha(strokeColor, 0.1);
          ctx.beginPath();
          ctx.moveTo(uS.x, uS.y);
          ctx.lineTo(uE.x, uE.y);
          ctx.lineTo(lE.x, lE.y);
          ctx.lineTo(lS.x, lS.y);
          ctx.closePath();
          ctx.fill();

          // Handle connecting p1 <-> p2
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[1].x, pts[1].y);
          ctx.lineTo(pts[2].x, pts[2].y);
          ctx.stroke();
          ctx.restore();

          // Median + upper + lower prongs
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineW;
          ctx.beginPath();
          ctx.moveTo(uS.x, uS.y);
          ctx.lineTo(uE.x, uE.y);
          ctx.moveTo(lS.x, lS.y);
          ctx.lineTo(lE.x, lE.y);
          ctx.stroke();

          ctx.save();
          ctx.strokeStyle = isEraserHovered ? '#F23645' : '#F23645';
          ctx.lineWidth = lineW;
          ctx.beginPath();
          ctx.moveTo(mS.x, mS.y);
          ctx.lineTo(mE.x, mE.y);
          ctx.stroke();
          ctx.restore();

          // 0.5 inner warning lines
          ctx.save();
          ctx.strokeStyle = colorWithAlpha(strokeColor, 0.5);
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          const midUpS = { x: (uS.x + pf.medianThrough.x) / 2, y: (uS.y + pf.medianThrough.y) / 2 };
          const midUpT = { x: midUpS.x + (uE.x - uS.x), y: midUpS.y + (uE.y - uS.y) };
          const midLoS = { x: (lS.x + pf.medianThrough.x) / 2, y: (lS.y + pf.medianThrough.y) / 2 };
          const midLoT = { x: midLoS.x + (lE.x - lS.x), y: midLoS.y + (lE.y - lS.y) };
          ctx.beginPath();
          ctx.moveTo(midUpS.x, midUpS.y);
          ctx.lineTo(midUpT.x, midUpT.y);
          ctx.moveTo(midLoS.x, midLoS.y);
          ctx.lineTo(midLoT.x, midLoT.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    // ==================== GROUP 4: PATTERNS (7) ====================
    case 'xabcd_pattern':
    case 'cypher_pattern': {
      const labels = ['X', 'A', 'B', 'C', 'D'];
      // Shaded harmonic triangles
      ctx.fillStyle = resolveFill(d, 0.16);
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
      }
      if (pts.length >= 5) {
        ctx.beginPath();
        ctx.moveTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.closePath();
        ctx.fill();
      }

      // Main zigzag polyline
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Dashed harmonic ratio diagonals + ratio tags
      const drawRatioDiag = (i0: number, i1: number, ref0: number, ref1: number) => {
        if (!pts[i0] || !pts[i1] || !d.points[ref0] || !d.points[ref1]) return;
        const denom = Math.abs(d.points[ref1].price - d.points[ref0].price);
        const num = Math.abs(d.points[i1].price - d.points[i0 === 0 ? 1 : i0].price);
        const ratio = denom > 1e-9 ? num / denom : 0;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.7);
        ctx.beginPath();
        ctx.moveTo(pts[i0].x, pts[i0].y);
        ctx.lineTo(pts[i1].x, pts[i1].y);
        ctx.stroke();
        ctx.restore();
        const mx = (pts[i0].x + pts[i1].x) / 2;
        const my = (pts[i0].y + pts[i1].y) / 2;
        drawPill(ctx, mx, my, ratio.toFixed(3), 'rgba(19,19,19,0.82)', strokeColor, 9.5, 'center');
      };

      if (pts.length >= 3) drawRatioDiag(0, 2, 0, 1);
      if (pts.length >= 4) drawRatioDiag(1, 3, 1, 2);
      if (pts.length >= 5) {
        drawRatioDiag(2, 4, 2, 3);
        drawRatioDiag(0, 4, 0, 1);
      }

      // Vertex badges
      for (let i = 0; i < pts.length && i < labels.length; i++) {
        const prevY = pts[i - 1]?.y ?? pts[i + 1]?.y ?? pts[i].y + 1;
        const above = pts[i].y <= prevY;
        drawVertexBadge(ctx, pts[i], labels[i], strokeColor, above);
      }
      break;
    }

    case 'head_shoulders': {
      const hsLabels = ['Base SX', 'Spalla SX', 'Collo 1', 'Testa', 'Collo 2', 'Spalla DX'];
      ctx.fillStyle = resolveFill(d, 0.14);
      // Shade left shoulder, head, right shoulder lobes
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
      }
      if (pts.length >= 5) {
        ctx.beginPath();
        ctx.moveTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.closePath();
        ctx.fill();
      }
      if (pts.length >= 6) {
        ctx.beginPath();
        ctx.moveTo(pts[4].x, pts[4].y);
        ctx.lineTo(pts[5].x, pts[5].y);
        ctx.lineTo(pts[5].x + (pts[4].x - pts[2].x) * 0.4, pts[4].y);
        ctx.closePath();
        ctx.fill();
      }

      // Main silhouette
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Extended Neckline (Collo 1 -> Collo 2)
      if (pts.length >= 5) {
        const [nS, nE] = extendLineToBounds(pts[2], pts[4], rc.plotWidth + rc.plotLeft, rc.mainHeight, 'extended');
        ctx.save();
        ctx.strokeStyle = '#FF9800';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(nS.x, nS.y);
        ctx.lineTo(nE.x, nE.y);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < pts.length && i < hsLabels.length; i++) {
        const above = i === 1 || i === 3 || i === 5;
        drawVertexBadge(ctx, pts[i], hsLabels[i], strokeColor, above);
      }
      break;
    }

    case 'elliott_impulse':
    case 'elliott_correction': {
      const waveLabels =
        canonical === 'elliott_impulse'
          ? ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)']
          : ['(0)', '(A)', '(B)', '(C)'];
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      for (let i = 0; i < pts.length && i < waveLabels.length; i++) {
        const refY = pts[i - 1]?.y ?? pts[i + 1]?.y ?? pts[i].y + 1;
        drawVertexBadge(ctx, pts[i], waveLabels[i], strokeColor, pts[i].y <= refY);
      }
      break;
    }

    case 'cyclic_lines': {
      if (pts.length >= 2) {
        const stepX = Math.max(12, Math.abs(pts[1].x - pts[0].x));
        const originX = Math.min(pts[0].x, pts[1].x);
        const startN = Math.floor((rc.plotLeft - originX) / stepX);
        const endN = Math.ceil((rc.plotRight - originX) / stepX);
        let count = 0;
        for (let n = startN; n <= endN && count < 80; n++, count++) {
          const x = Math.round(originX + n * stepX) + 0.5;
          if (x < rc.plotLeft || x > rc.plotRight) continue;
          ctx.beginPath();
          ctx.moveTo(x, rc.mainTop);
          ctx.lineTo(x, rc.mainBottom);
          ctx.stroke();
        }
      }
      break;
    }

    case 'bars_pattern': {
      if (pts.length >= 2) {
        const idx0 = Math.max(0, Math.min(rc.candles.length - 1, Math.round(rc.timeToIndex(d.points[0].time))));
        const idx1 = Math.max(0, Math.min(rc.candles.length - 1, Math.round(rc.timeToIndex(d.points[1].time))));
        const lo = Math.min(idx0, idx1);
        const hi = Math.max(idx0, idx1);
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);

        // Source selection frame
        ctx.save();
        ctx.fillStyle = resolveFill(d, 0.1);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.restore();

        // Echo ghost candles immediately to the right of hi
        const sliceLen = hi - lo + 1;
        if (sliceLen >= 2 && rc.candles[lo] && rc.candles[hi]) {
          const baseClose = rc.candles[lo].close;
          const anchorClose = rc.candles[hi].close;
          const ratioScale = baseClose > 0 ? anchorClose / baseClose : 1;
          const stepPx = Math.max(3, rw / Math.max(1, sliceLen - 1));
          const ghostBarW = Math.max(2, Math.min(10, stepPx * 0.62));
          ctx.save();
          ctx.globalAlpha = 0.65;
          for (let k = 0; k < sliceLen; k++) {
            const c = rc.candles[lo + k];
            if (!c) continue;
            const gx = rc.indexToX(hi + 1 + k);
            if (gx > rc.plotRight + 20) break;
            const yO = rc.priceToY(c.open * ratioScale);
            const yC = rc.priceToY(c.close * ratioScale);
            const yH = rc.priceToY(c.high * ratioScale);
            const yL = rc.priceToY(c.low * ratioScale);
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = c.close >= c.open ? colorWithAlpha(strokeColor, 0.5) : strokeColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(gx, yH);
            ctx.lineTo(gx, yL);
            ctx.stroke();
            ctx.fillRect(gx - ghostBarW / 2, Math.min(yO, yC), ghostBarW, Math.max(1.5, Math.abs(yC - yO)));
          }
          ctx.restore();
        }
      }
      break;
    }

    // ==================== GROUP 5: PROJECTION & MEASUREMENT (7) ====================
    case 'long_position':
    case 'short_position': {
      if (pts.length >= 2) {
        const side = canonical === 'long_position' ? 'long' : 'short';
        const entry = d.points[0].price;
        const rawTarget = d.targetPrice ?? d.points[1].price;
        const diff = Math.abs(rawTarget - entry) || Math.max(entry * 0.015, 1e-6);
        const target =
          side === 'long'
            ? Math.max(entry + diff * 0.25, rawTarget)
            : Math.min(entry - diff * 0.25, rawTarget);
        const stop =
          d.stopPrice ??
          (side === 'long' ? entry - diff * 0.5 : entry + diff * 0.5);

        const metrics = calculatePositionMetrics(side, entry, stop, target);
        const x0 = Math.min(pts[0].x, pts[1].x);
        const boxW = Math.max(96, Math.abs(pts[1].x - pts[0].x));
        const yEntry = rc.priceToY(entry);
        const yTarget = rc.priceToY(target);
        const yStop = rc.priceToY(stop);

        // Target zone (green)
        ctx.fillStyle = 'rgba(8, 153, 129, 0.22)';
        ctx.fillRect(x0, Math.min(yEntry, yTarget), boxW, Math.abs(yTarget - yEntry));
        ctx.strokeStyle = isEraserHovered ? '#F23645' : '#089981';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([]);
        ctx.strokeRect(x0, Math.min(yEntry, yTarget), boxW, Math.abs(yTarget - yEntry));

        // Stop zone (red)
        ctx.fillStyle = 'rgba(242, 54, 69, 0.22)';
        ctx.fillRect(x0, Math.min(yEntry, yStop), boxW, Math.abs(yStop - yEntry));
        ctx.strokeStyle = '#F23645';
        ctx.strokeRect(x0, Math.min(yEntry, yStop), boxW, Math.abs(yStop - yEntry));

        // Entry midline
        ctx.strokeStyle = rc.theme === 'dark' ? '#FFFFFF' : '#131313';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x0, yEntry);
        ctx.lineTo(x0 + boxW, yEntry);
        ctx.stroke();

        // Target / Stop tags
        drawPill(
          ctx,
          x0 + boxW / 2,
          yTarget + (yTarget < yEntry ? -10 : 10),
          `Target: ${formatPrice(target, rc.precision)} (+${metrics.rewardPercent.toFixed(2)}%)`,
          '#089981',
          '#ffffff',
          10,
          'center',
        );
        drawPill(
          ctx,
          x0 + boxW / 2,
          yStop + (yStop > yEntry ? 10 : -10),
          `Stop: ${formatPrice(stop, rc.precision)} (-${metrics.riskPercent.toFixed(2)}%)`,
          '#F23645',
          '#ffffff',
          10,
          'center',
        );

        const acctSuffix =
          d.accountSize && d.riskPercent
            ? ` · Rischio €${((d.accountSize * d.riskPercent) / 100).toFixed(0)}`
            : '';
        const rrText = `${side === 'long' ? 'LONG' : 'SHORT'} · R/R ${metrics.riskRewardRatio.toFixed(2)}${acctSuffix}`;
        drawPill(
          ctx,
          x0 + 6,
          yEntry,
          rrText,
          '#131313',
          '#ffffff',
          10.5,
          'left',
          '#464646',
        );
      }
      break;
    }

    case 'forecast': {
      if (pts.length >= 2) {
        const m = calculateMeasure(d.points[0], d.points[1], rc.candles);
        const col = isEraserHovered ? '#F23645' : m.isPositive ? '#089981' : '#F23645';
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);

        ctx.fillStyle = colorWithAlpha(col, 0.14);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        drawArrowHead(ctx, pts[0], pts[1], 10, col);

        const sign = m.percentDelta >= 0 ? '+' : '';
        drawPill(
          ctx,
          pts[1].x,
          pts[1].y - 14,
          `Previsione: ${formatPrice(d.points[1].price, rc.precision)} (${sign}${m.percentDelta.toFixed(2)}%)`,
          col,
          '#ffffff',
          10,
          'center',
        );
      }
      break;
    }

    case 'price_range': {
      if (pts.length >= 2) {
        const m = calculateMeasure(d.points[0], d.points[1], rc.candles);
        const col = isEraserHovered ? '#F23645' : m.isPositive ? '#2962FF' : '#F23645';
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.max(24, Math.abs(pts[1].x - pts[0].x));
        const rh = Math.abs(pts[1].y - pts[0].y);
        ctx.fillStyle = colorWithAlpha(col, 0.16);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        // Horizontal top/bottom caps + vertical arrow
        const cx = rx + rw / 2;
        ctx.beginPath();
        ctx.moveTo(rx, pts[0].y);
        ctx.lineTo(rx + rw, pts[0].y);
        ctx.moveTo(rx, pts[1].y);
        ctx.lineTo(rx + rw, pts[1].y);
        ctx.moveTo(cx, pts[0].y);
        ctx.lineTo(cx, pts[1].y);
        ctx.stroke();
        drawArrowHead(ctx, { x: cx, y: pts[0].y }, { x: cx, y: pts[1].y }, 8, col);
        const sign = m.priceDelta >= 0 ? '+' : '';
        drawPill(
          ctx,
          cx,
          m.isPositive ? ry - 12 : ry + rh + 12,
          `${sign}${formatPrice(m.priceDelta, rc.precision)} (${sign}${m.percentDelta.toFixed(2)}%)`,
          col,
          '#ffffff',
          10.5,
          'center',
        );
      }
      break;
    }

    case 'date_range': {
      if (pts.length >= 2) {
        const m = calculateMeasure(d.points[0], d.points[1], rc.candles);
        const col = strokeColor;
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.max(24, Math.abs(pts[1].y - pts[0].y));
        ctx.fillStyle = colorWithAlpha(col, 0.16);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        const cy = ry + rh / 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, ry);
        ctx.lineTo(pts[0].x, ry + rh);
        ctx.moveTo(pts[1].x, ry);
        ctx.lineTo(pts[1].x, ry + rh);
        ctx.moveTo(pts[0].x, cy);
        ctx.lineTo(pts[1].x, cy);
        ctx.stroke();
        drawArrowHead(ctx, { x: pts[0].x, y: cy }, { x: pts[1].x, y: cy }, 8, col);
        drawPill(
          ctx,
          rx + rw / 2,
          ry + rh + 14,
          `${m.bars} barre · ${formatDurationIT(m.timeSpanSeconds)}`,
          col,
          '#ffffff',
          10.5,
          'center',
        );
      }
      break;
    }

    case 'date_price_range':
    case 'measure': {
      if (pts.length >= 2) {
        const m = calculateMeasure(d.points[0], d.points[1], rc.candles);
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);
        const col = isEraserHovered ? '#F23645' : m.isPositive ? '#2962FF' : '#F23645';

        ctx.fillStyle = colorWithAlpha(col, 0.18);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([]);
        ctx.strokeRect(rx, ry, rw, rh);

        // Internal H + V arrows
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, cy);
        ctx.lineTo(pts[1].x, cy);
        ctx.moveTo(cx, pts[0].y);
        ctx.lineTo(cx, pts[1].y);
        ctx.stroke();
        if (rw > 18) drawArrowHead(ctx, { x: pts[0].x, y: cy }, { x: pts[1].x, y: cy }, 7, col);
        if (rh > 18) drawArrowHead(ctx, { x: cx, y: pts[0].y }, { x: cx, y: pts[1].y }, 7, col);

        const sign = m.priceDelta >= 0 ? '+' : '';
        const line1 = `${sign}${formatPrice(m.priceDelta, rc.precision)} (${sign}${m.percentDelta.toFixed(2)}%)`;
        const line2 = `${m.bars} barre · ${formatDurationIT(m.timeSpanSeconds)}`;
        ctx.font = `600 11px ${FONT_FAMILY}`;
        const bw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 18;
        const bh = 36;
        const bx = Math.max(rc.plotLeft + 6, Math.min(rc.plotRight - bw - 6, rx + rw / 2 - bw / 2));
        const by = m.isPositive
          ? Math.max(rc.mainTop + 6, ry - bh - 6)
          : Math.min(rc.mainBottom - bh - 6, ry + rh + 6);
        ctx.fillStyle = col;
        drawRoundedRectPath(ctx, bx, by, bw, bh, 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line1, bx + bw / 2, by + 12);
        ctx.font = `500 10.5px ${FONT_FAMILY}`;
        ctx.fillText(line2, bx + bw / 2, by + 26);
      }
      break;
    }

    case 'volume_profile_fixed': {
      if (pts.length >= 2) {
        const idx0 = rc.timeToIndex(d.points[0].time);
        const idx1 = rc.timeToIndex(d.points[1].time);
        const vp = calculateFixedRangeVolumeProfile(rc.candles, idx0, idx1, 24);
        const leftX = Math.min(pts[0].x, pts[1].x);
        const rightX = Math.max(pts[0].x, pts[1].x);
        const spanW = Math.max(24, rightX - leftX);
        const maxBarW = Math.max(22, spanW * 0.65);

        // Vertical range boundaries
        ctx.save();
        ctx.strokeStyle = colorWithAlpha(strokeColor, 0.55);
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, rc.mainTop);
        ctx.lineTo(leftX, rc.mainBottom);
        ctx.moveTo(rightX, rc.mainTop);
        ctx.lineTo(rightX, rc.mainBottom);
        ctx.stroke();
        ctx.restore();

        if (vp) {
          const yVah = rc.priceToY(vp.vahPrice);
          const yVal = rc.priceToY(vp.valPrice);
          const yPoc = rc.priceToY(vp.pocPrice);

          // 70% Value Area background band
          ctx.fillStyle = 'rgba(41, 98, 255, 0.08)';
          ctx.fillRect(leftX, Math.min(yVah, yVal), spanW, Math.abs(yVal - yVah));

          // Horizontal buy / sell split histogram bars
          for (const bin of vp.bins) {
            if (bin.totalVolume <= 0) continue;
            const yTop = rc.priceToY(bin.priceHigh);
            const yBot = rc.priceToY(bin.priceLow);
            const top = Math.min(yTop, yBot);
            const h = Math.max(1.5, Math.abs(yBot - yTop) - 1);
            const totalW = bin.ratioToMax * maxBarW;
            const buyRatio = bin.buyVolume / bin.totalVolume;
            const buyW = totalW * buyRatio;
            const sellW = totalW - buyW;
            const alpha = bin.inValueArea ? 0.72 : 0.28;

            ctx.fillStyle = isEraserHovered
              ? `rgba(242, 54, 69, ${alpha})`
              : `rgba(41, 98, 255, ${alpha})`;
            ctx.fillRect(leftX, top, buyW, h);
            ctx.fillStyle = `rgba(255, 193, 7, ${alpha})`;
            ctx.fillRect(leftX + buyW, top, sellW, h);
          }

          // VAH / VAL thin lines
          ctx.save();
          ctx.strokeStyle = 'rgba(144, 191, 249, 0.65)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(leftX, yVah);
          ctx.lineTo(rightX, yVah);
          ctx.moveTo(leftX, yVal);
          ctx.lineTo(rightX, yVal);
          ctx.stroke();
          ctx.restore();

          // Bright Red POC (Point of Control) line + badge
          ctx.save();
          ctx.strokeStyle = '#F23645';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(leftX, yPoc);
          ctx.lineTo(d.extendRight ? rc.plotRight : rightX, yPoc);
          ctx.stroke();
          ctx.restore();

          drawPill(
            ctx,
            rightX - 4,
            yPoc,
            `POC ${formatPrice(vp.pocPrice, rc.precision)}`,
            '#F23645',
            '#ffffff',
            9.5,
            'right',
          );
        }
      }
      break;
    }

    // ==================== GROUP 6: GEOMETRIC SHAPES (12) ====================
    case 'brush': {
      if (pts.length >= 2) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      break;
    }

    case 'highlighter': {
      if (pts.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(12, d.style.lineWidth || 14);
        ctx.strokeStyle = isEraserHovered
          ? 'rgba(242, 54, 69, 0.5)'
          : colorWithAlpha(d.style.color, 0.36);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'arrow_marker':
    case 'arrow_line': {
      if (pts.length >= 2) {
        const isMarker = canonical === 'arrow_marker';
        ctx.lineWidth = isMarker ? Math.max(3.5, lineW + 1.5) : lineW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        drawArrowHead(ctx, pts[0], pts[1], isMarker ? 14 : 11, strokeColor);
      }
      break;
    }

    case 'rectangle': {
      if (pts.length >= 2) {
        const rx = Math.min(pts[0].x, pts[1].x);
        const ry = Math.min(pts[0].y, pts[1].y);
        const rw = Math.abs(pts[1].x - pts[0].x);
        const rh = Math.abs(pts[1].y - pts[0].y);
        ctx.fillStyle = resolveFill(d, 0.16);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        if (d.text) {
          ctx.fillStyle = d.style.textColor ?? strokeColor;
          ctx.font = buildFontString(d, 12);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(d.text, rx + rw / 2, ry + rh / 2);
        }
      }
      break;
    }

    case 'rotated_rectangle': {
      if (pts.length >= 2) {
        const p3 = pts[2] ?? { x: pts[0].x, y: pts[0].y - 36 };
        const ch = calculateParallelChannel(pts[0], pts[1], p3);
        ctx.fillStyle = resolveFill(d, 0.16);
        ctx.beginPath();
        ctx.moveTo(ch.baseStart.x, ch.baseStart.y);
        ctx.lineTo(ch.baseEnd.x, ch.baseEnd.y);
        ctx.lineTo(ch.offsetEnd.x, ch.offsetEnd.y);
        ctx.lineTo(ch.offsetStart.x, ch.offsetStart.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'path': {
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        drawArrowHead(ctx, pts[pts.length - 2], pts[pts.length - 1], 10, strokeColor);
      }
      break;
    }

    case 'circle': {
      if (pts.length >= 2) {
        const radius = Math.max(2, distanceBetween(pts[0], pts[1]));
        ctx.fillStyle = resolveFill(d, 0.16);
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'ellipse': {
      if (pts.length >= 2) {
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        const rx = Math.max(2, Math.abs(pts[1].x - pts[0].x) / 2);
        const ry = Math.max(2, Math.abs(pts[1].y - pts[0].y) / 2);
        ctx.fillStyle = resolveFill(d, 0.16);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'triangle': {
      if (pts.length >= 2) {
        ctx.fillStyle = resolveFill(d, 0.16);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        if (pts[2]) {
          ctx.lineTo(pts[2].x, pts[2].y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
      }
      break;
    }

    case 'curve': {
      if (pts.length >= 2) {
        const ctrl =
          pts[2] ?? {
            x: (pts[0].x + pts[1].x) / 2,
            y: Math.min(pts[0].y, pts[1].y) - 36,
          };
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, pts[1].x, pts[1].y);
        ctx.stroke();

        if (isSelected) {
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = colorWithAlpha(strokeColor, 0.5);
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(ctrl.x, ctrl.y);
          ctx.lineTo(pts[1].x, pts[1].y);
          ctx.stroke();
          ctx.restore();
        }
      }
      break;
    }

    case 'arc': {
      if (pts.length >= 2) {
        const bulge =
          pts[2] ?? {
            x: (pts[0].x + pts[1].x) / 2,
            y: Math.min(pts[0].y, pts[1].y) - 42,
          };
        // Quadratic control point passing through `bulge` at t=0.5: C = 2*B - 0.5*(P0+P1)
        const cx = 2 * bulge.x - 0.5 * (pts[0].x + pts[1].x);
        const cy = 2 * bulge.y - 0.5 * (pts[0].y + pts[1].y);
        ctx.fillStyle = resolveFill(d, 0.14);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.quadraticCurveTo(cx, cy, pts[1].x, pts[1].y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.quadraticCurveTo(cx, cy, pts[1].x, pts[1].y);
        ctx.stroke();
      }
      break;
    }

    // ==================== GROUP 7: ANNOTATIONS (9) ====================
    case 'text':
    case 'anchored_text': {
      const txt = d.text || (canonical === 'anchored_text' ? 'Testo ancorato' : 'Testo');
      const fontSize = d.style.fontSize ?? 13;
      ctx.font = buildFontString(d, fontSize);
      const tw = ctx.measureText(txt).width + 16;
      const th = fontSize + 12;
      const bx = pts[0].x;
      const by = pts[0].y - th / 2;
      ctx.fillStyle =
        d.style.backgroundColor ??
        (rc.theme === 'dark' ? 'rgba(19, 19, 19, 0.88)' : 'rgba(255, 255, 255, 0.92)');
      drawRoundedRectPath(ctx, bx, by, tw, th, 4);
      ctx.fill();
      ctx.strokeStyle = d.style.borderColor ?? strokeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();

      if (canonical === 'anchored_text') {
        ctx.fillStyle = '#2962FF';
        ctx.beginPath();
        ctx.arc(bx, pts[0].y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = d.style.textColor ?? strokeColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 8, pts[0].y);
      break;
    }

    case 'note':
    case 'price_note': {
      const anchor = pts[0];
      const boxPt = pts[1] ?? { x: anchor.x + 56, y: anchor.y - 36 };
      const priceStr = formatPrice(d.points[0].price, rc.precision);
      const label =
        canonical === 'price_note'
          ? d.text
            ? `${priceStr} · ${d.text}`
            : priceStr
          : d.text || 'Nota';

      // Leader line & pin dot
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(boxPt.x, boxPt.y);
      ctx.stroke();

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
      ctx.fill();

      drawPill(
        ctx,
        boxPt.x,
        boxPt.y,
        label,
        d.style.backgroundColor ?? strokeColor,
        d.style.textColor ?? '#ffffff',
        d.style.fontSize ?? 11.5,
        'center',
      );
      break;
    }

    case 'callout': {
      const anchor = pts[0];
      const bubble = pts[1] ?? { x: anchor.x + 48, y: anchor.y - 42 };
      const txt = d.text || 'Fumetto';
      const fontSize = d.style.fontSize ?? 12;
      ctx.font = buildFontString(d, fontSize);
      const tw = Math.max(60, ctx.measureText(txt).width + 18);
      const th = fontSize + 14;
      const bx = bubble.x - tw / 2;
      const by = bubble.y - th / 2;

      // Tail triangle from bubble center to anchor
      const bg =
        d.style.backgroundColor ??
        (rc.theme === 'dark' ? 'rgba(19, 32, 66, 0.94)' : 'rgba(227, 239, 253, 0.96)');
      ctx.fillStyle = bg;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(bubble.x - 7, bubble.y);
      ctx.lineTo(bubble.x + 7, bubble.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      drawRoundedRectPath(ctx, bx, by, tw, th, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = d.style.textColor ?? (rc.theme === 'dark' ? '#FFFFFF' : '#131313');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, bubble.x, bubble.y);
      break;
    }

    case 'price_label': {
      const p = pts[0];
      const txt = formatPrice(d.points[0].price, rc.precision);
      ctx.font = `700 11px ${FONT_FAMILY}`;
      const tw = ctx.measureText(txt).width + 14;
      const th = 22;
      const tipW = 8;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tipW, p.y - th / 2);
      ctx.lineTo(p.x + tipW + tw, p.y - th / 2);
      ctx.lineTo(p.x + tipW + tw, p.y + th / 2);
      ctx.lineTo(p.x + tipW, p.y + th / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, p.x + tipW + 7, p.y);
      break;
    }

    case 'flag_mark': {
      const p = pts[0];
      const poleH = 26;
      const flagW = 18;
      const flagH = 12;
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - poleH);
      ctx.stroke();

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - poleH);
      ctx.lineTo(p.x + flagW, p.y - poleH + flagH / 2);
      ctx.lineTo(p.x, p.y - poleH + flagH);
      ctx.closePath();
      ctx.fill();

      if (d.text) {
        drawPill(ctx, p.x + flagW + 4, p.y - poleH + flagH / 2, d.text, strokeColor, '#ffffff', 10, 'left');
      }
      break;
    }

    case 'arrow_up':
    case 'arrow_down': {
      const p = pts[0];
      const isUp = canonical === 'arrow_up';
      const dir = isUp ? 1 : -1;
      ctx.setLineDash([]);
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 8, p.y + dir * 11);
      ctx.lineTo(p.x - 3, p.y + dir * 11);
      ctx.lineTo(p.x - 3, p.y + dir * 22);
      ctx.lineTo(p.x + 3, p.y + dir * 22);
      ctx.lineTo(p.x + 3, p.y + dir * 11);
      ctx.lineTo(p.x + 8, p.y + dir * 11);
      ctx.closePath();
      ctx.fill();

      if (d.text) {
        drawPill(ctx, p.x, p.y + dir * 32, d.text, strokeColor, '#ffffff', 10, 'center');
      }
      break;
    }

    default: {
      // Safe fallback polyline
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      break;
    }
  }

  // Control anchor handles when selected (or hovered in eraser mode)
  if (isSelected || isEraserHovered) {
    ctx.setLineDash([]);
    const handleColor = isEraserHovered ? '#F23645' : '#2962FF';
    for (const pt of pts) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function renderAllDrawings(
  rc: DrawingRenderContext,
  drawings: readonly DrawingObject[],
  draftDrawing: DrawingObject | null,
  selectedDrawingId: string | null,
  eraserHoveredId: string | null,
  timeframe?: string,
) {
  // Sort by zIndex ascending while preserving array order for equal zIndex
  const ordered = drawings
    .map((d, idx) => ({ d, idx }))
    .sort((a, b) => (a.d.zIndex ?? 0) - (b.d.zIndex ?? 0) || a.idx - b.idx)
    .map((item) => item.d);

  const list = draftDrawing ? [...ordered, draftDrawing] : ordered;

  for (const d of list) {
    if (!d.visible || d.points.length === 0) continue;
    if (
      timeframe &&
      d.visibleTimeframes &&
      d.visibleTimeframes.length > 0 &&
      !d.visibleTimeframes.includes(timeframe as never)
    ) {
      continue;
    }
    const isSelected = d.id === selectedDrawingId;
    const isEraserHovered = d.id === eraserHoveredId;
    renderSingleDrawing(rc, d, isSelected, isEraserHovered);
  }
}
