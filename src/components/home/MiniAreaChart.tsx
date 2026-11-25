import React, { useId, useMemo, useRef, useState } from 'react';
import type { Candle } from '../../types';
import { formatPercent, formatPrice } from '../../data';

export type MiniRangeKey = '1G' | '1M' | '3M' | '1A' | '5A' | 'Tutto';

export interface MiniAreaChartProps {
  candles: Candle[];
  livePrice?: number;
  precision?: number;
  currency?: string;
  rangeKey?: MiniRangeKey;
  chartStyle?: 'area' | 'candles';
  height?: number;
  isPositive?: boolean;
}

function formatAxisTime(tsSec: number, rangeKey: MiniRangeKey): string {
  const date = new Date(tsSec * 1000);
  if (rangeKey === '1G') {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    });
  }
  if (rangeKey === '1M' || rangeKey === '3M') {
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
    });
  }
  return date.toLocaleDateString('it-IT', {
    month: 'short',
    year: '2-digit',
  });
}

function formatTooltipTime(tsSec: number, rangeKey: MiniRangeKey): string {
  const date = new Date(tsSec * 1000);
  if (rangeKey === '1G') {
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const MiniAreaChart: React.FC<MiniAreaChartProps> = ({
  candles,
  livePrice,
  precision = 2,
  currency = '',
  rangeKey = '1G',
  chartStyle = 'area',
  height = 280,
  isPositive,
}) => {
  const gradId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const series = useMemo(() => {
    if (!candles.length) return [];
    const copy = candles.map((c) => ({ ...c }));
    if (livePrice !== undefined && Number.isFinite(livePrice)) {
      const last = copy[copy.length - 1];
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
    }
    return copy;
  }, [candles, livePrice]);

  const width = 760;
  const padLeft = 8;
  const padRight = precision >= 6 ? 104 : precision >= 4 ? 86 : 74;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const computed = useMemo(() => {
    if (series.length < 2) return null;
    const firstClose = series[0].close;
    const lastClose = series[series.length - 1].close;
    const positive = isPositive !== undefined ? isPositive : lastClose >= firstClose;

    const lows = series.map((c) => (chartStyle === 'candles' ? c.low : c.close));
    const highs = series.map((c) => (chartStyle === 'candles' ? c.high : c.close));
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const padVal = (rawMax - rawMin || rawMax * 0.01 || 1) * 0.08;
    const minP = rawMin - padVal;
    const maxP = rawMax + padVal;
    const span = maxP - minP || 1;

    const toX = (idx: number) => padLeft + (idx / (series.length - 1)) * plotW;
    const toY = (val: number) => padTop + plotH - ((val - minP) / span) * plotH;

    const points = series.map((c, idx) => ({
      idx,
      x: toX(idx),
      y: toY(c.close),
      yOpen: toY(c.open),
      yHigh: toY(c.high),
      yLow: toY(c.low),
      candle: c,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(
      padTop + plotH
    ).toFixed(1)} L${points[0].x.toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

    const yTicks = [0, 0.33, 0.66, 1].map((ratio) => {
      const val = maxP - ratio * span;
      return { y: padTop + ratio * plotH, value: val };
    });

    const xTickCount = 6;
    const xTicks = Array.from({ length: xTickCount }, (_, k) => {
      const idx = Math.round((k / (xTickCount - 1)) * (series.length - 1));
      return {
        x: toX(idx),
        label: formatAxisTime(series[idx].time, rangeKey),
      };
    });

    const lastPt = points[points.length - 1];
    return {
      positive,
      firstClose,
      lastClose,
      points,
      linePath,
      areaPath,
      yTicks,
      xTicks,
      lastPt,
    };
  }, [series, chartStyle, isPositive, plotW, plotH, rangeKey]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!computed || !containerRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padLeft, Math.min(padLeft + plotW, relX));
    const ratio = (clamped - padLeft) / plotW;
    const idx = Math.round(ratio * (computed.points.length - 1));
    setHoverIdx(Math.max(0, Math.min(computed.points.length - 1, idx)));
  };

  if (!computed) {
    return <div className="tv-skeleton" style={{ width: '100%', height }} />;
  }

  const strokeColor = computed.positive ? 'var(--tv-up-solid)' : 'var(--tv-down-solid)';
  const hovered = hoverIdx !== null ? computed.points[hoverIdx] : null;
  const hoverChangePct = hovered
    ? ((hovered.candle.close - computed.firstClose) / (computed.firstClose || 1)) * 100
    : 0;
  const candleWidth = Math.max(2, Math.min(9, (plotW / computed.points.length) * 0.65));

  return (
    <div ref={containerRef} className="tv-mini-chart-wrap">
      {hovered && (
        <div
          className="tv-mini-chart-tooltip tv-num"
          style={{
            left: `${Math.min(72, Math.max(2, (hovered.x / width) * 100))}%`,
          }}
        >
          <span style={{ fontWeight: 700, marginRight: 8 }}>
            {formatPrice(hovered.candle.close, precision)} {currency}
          </span>
          <span
            style={{
              color: hoverChangePct >= 0 ? '#22AB94' : '#F7525F',
              fontWeight: 600,
              marginRight: 8,
            }}
          >
            {formatPercent(hoverChangePct)}
          </span>
          <span style={{ opacity: 0.72 }}>
            {formatTooltipTime(hovered.candle.time, rangeKey)}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="tv-mini-chart-svg"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Grafico andamento prezzo"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + right price labels (suppress label if colliding with last-price pill) */}
        {computed.yTicks.map((tick, i) => {
          const collidesWithLastPill = Math.abs(tick.y - computed.lastPt.y) < 16;
          return (
            <g key={i}>
              <line
                x1={padLeft}
                x2={padLeft + plotW}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--tv-border-subtle)"
                strokeWidth="1"
              />
              {!collidesWithLastPill && (
                <text
                  x={padLeft + plotW + 8}
                  y={tick.y + 4}
                  fill="var(--tv-text-muted)"
                  fontSize="11"
                  className="tv-num"
                >
                  {formatPrice(tick.value, precision)}
                </text>
              )}
            </g>
          );
        })}

        {/* Bottom time axis labels */}
        {computed.xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === computed.xTicks.length - 1 ? 'end' : 'middle'}
            fill="var(--tv-text-muted)"
            fontSize="11"
            className="tv-num"
          >
            {tick.label}
          </text>
        ))}

        {/* Area or Candlestick series */}
        {chartStyle === 'area' ? (
          <>
            <path d={computed.areaPath} fill={`url(#${gradId})`} />
            <path
              d={computed.linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : (
          computed.points.map((pt) => {
            const up = pt.candle.close >= pt.candle.open;
            const col = up ? 'var(--tv-up-solid)' : 'var(--tv-down-solid)';
            const top = Math.min(pt.yOpen, pt.y);
            const h = Math.max(1.5, Math.abs(pt.y - pt.yOpen));
            return (
              <g key={pt.idx}>
                <line x1={pt.x} x2={pt.x} y1={pt.yHigh} y2={pt.yLow} stroke={col} strokeWidth="1.2" />
                <rect
                  x={pt.x - candleWidth / 2}
                  y={top}
                  width={candleWidth}
                  height={h}
                  rx="1"
                  fill={col}
                />
              </g>
            );
          })
        )}

        {/* Current price dashed line & right price pill */}
        <line
          x1={padLeft}
          x2={padLeft + plotW}
          y1={computed.lastPt.y}
          y2={computed.lastPt.y}
          stroke={strokeColor}
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.65"
        />
        <rect
          x={padLeft + plotW + 4}
          y={computed.lastPt.y - 10}
          width={padRight - 6}
          height={20}
          rx="4"
          fill={strokeColor}
        />
        <text
          x={padLeft + plotW + 9}
          y={computed.lastPt.y + 4}
          fill="#ffffff"
          fontSize="10.5"
          fontWeight="600"
          className="tv-num"
        >
          {formatPrice(computed.lastClose, precision)}
        </text>

        {/* Interactive hover crosshair */}
        {hovered && (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={padTop}
              y2={padTop + plotH}
              stroke="var(--tv-chart-crosshair)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={hovered.y}
              y2={hovered.y}
              stroke="var(--tv-chart-crosshair)"
              strokeWidth="1"
              strokeDasharray="3 3"
              strokeOpacity="0.5"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r="4.5"
              fill={strokeColor}
              stroke="var(--tv-bg-primary)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
