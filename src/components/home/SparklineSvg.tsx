import React, { useId, useMemo } from 'react';
import { createSeededRng } from '../../data';

export interface SparklineSvgProps {
  values: number[];
  isPositive?: boolean;
  width?: number;
  height?: number;
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
}

export const SparklineSvg: React.FC<SparklineSvgProps> = ({
  values,
  isPositive = true,
  width = 104,
  height = 34,
  showArea = true,
  strokeWidth = 1.75,
  className,
}) => {
  const gradId = useId();

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (!values || values.length < 2) {
      return { linePath: '', areaPath: '', lastPoint: null };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const padY = 3;
    const usableH = height - padY * 2;
    const stepX = width / (values.length - 1);

    const coords = values.map((v, idx) => {
      const x = idx * stepX;
      const y = padY + usableH - ((v - min) / span) * usableH;
      return { x, y };
    });

    const d = coords
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
    const area = `${d} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;

    return {
      linePath: d,
      areaPath: area,
      lastPoint: coords[coords.length - 1],
    };
  }, [values, width, height]);

  const strokeColor = isPositive ? 'var(--tv-up-solid)' : 'var(--tv-down-solid)';

  if (!linePath) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden="true"
        style={{ maxWidth: '100%', height: 'auto', flexShrink: 0 }}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{ maxWidth: '100%', height: 'auto', overflow: 'visible', flexShrink: 0 }}
    >
      {showArea && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
      )}
      {showArea && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2.2" fill={strokeColor} />
      )}
    </svg>
  );
};

export interface IdeaChartPreviewSvgProps {
  seed: number;
  direction?: 'LONG' | 'SHORT' | 'NEUTRALE';
  mode?: 'idea' | 'indicator';
  accentColor?: string;
}

/**
 * Deterministic miniature TradingView candlestick + overlay preview for
 * Community Ideas and Indicators cards.
 */
export const IdeaChartPreviewSvg: React.FC<IdeaChartPreviewSvgProps> = ({
  seed,
  direction = 'LONG',
  mode = 'idea',
  accentColor = '#2962FF',
}) => {
  const gradId = useId();

  const { bars, fastLine, slowLine, targetY } = useMemo(() => {
    const rng = createSeededRng(seed * 7919 + 17);
    const count = 28;
    const drift = direction === 'LONG' ? 0.28 : direction === 'SHORT' ? -0.26 : 0.03;
    const raw: Array<{ o: number; h: number; l: number; c: number }> = [];
    let price = 50;

    for (let i = 0; i < count; i++) {
      const move = (rng() - 0.48 + drift * 0.22) * 5.2;
      const o = price;
      const c = Math.max(12, Math.min(88, o + move));
      const h = Math.max(o, c) + rng() * 3.2;
      const l = Math.min(o, c) - rng() * 3.2;
      raw.push({ o, h, l, c });
      price = c;
    }

    const minP = Math.min(...raw.map((b) => b.l));
    const maxP = Math.max(...raw.map((b) => b.h));
    const span = maxP - minP || 1;
    const w = 320;
    const h = 148;
    const padX = 12;
    const padY = 14;
    const step = (w - padX * 2) / count;
    const toY = (v: number) => padY + (h - padY * 2) * (1 - (v - minP) / span);

    const mapped = raw.map((b, i) => ({
      x: padX + i * step + step * 0.5,
      yO: toY(b.o),
      yC: toY(b.c),
      yH: toY(b.h),
      yL: toY(b.l),
      up: b.c >= b.o,
    }));

    const computeEma = (period: number) => {
      const k = 2 / (period + 1);
      let ema = raw[0].c;
      return raw
        .map((b, i) => {
          ema = i === 0 ? b.c : b.c * k + ema * (1 - k);
          return `${i === 0 ? 'M' : 'L'}${mapped[i].x.toFixed(1)},${toY(ema).toFixed(1)}`;
        })
        .join(' ');
    };

    const last = mapped[mapped.length - 1];
    return {
      bars: mapped,
      fastLine: computeEma(5),
      slowLine: computeEma(11),
      targetY: last.yC,
    };
  }, [seed, direction]);

  return (
    <svg
      viewBox="0 0 320 148"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Subtle chart grid */}
      {[32, 68, 104, 134].map((y) => (
        <line
          key={y}
          x1="0"
          x2="320"
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      {[64, 128, 192, 256].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="0"
          y2="148"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      {/* Target projection band for ideas */}
      {mode === 'idea' && (
        <rect
          x="220"
          y={direction === 'SHORT' ? targetY : Math.max(10, targetY - 34)}
          width="88"
          height="32"
          rx="3"
          fill={direction === 'SHORT' ? 'rgba(242,54,69,0.16)' : 'rgba(8,153,129,0.16)'}
          stroke={direction === 'SHORT' ? 'rgba(242,54,69,0.45)' : 'rgba(8,153,129,0.45)'}
          strokeDasharray="3 2"
        />
      )}

      {/* Candlesticks */}
      {bars.map((b, i) => {
        const col = b.up ? '#089981' : '#F23645';
        const top = Math.min(b.yO, b.yC);
        const bodyH = Math.max(2, Math.abs(b.yC - b.yO));
        return (
          <g key={i}>
            <line x1={b.x} x2={b.x} y1={b.yH} y2={b.yL} stroke={col} strokeWidth="1.2" />
            <rect x={b.x - 3} y={top} width="6" height={bodyH} rx="1" fill={col} />
          </g>
        );
      })}

      {/* Overlay EMA / Indicator curves */}
      <path d={fastLine} fill="none" stroke={accentColor} strokeWidth="1.7" />
      <path
        d={slowLine}
        fill="none"
        stroke={mode === 'indicator' ? '#FF9800' : 'rgba(144,191,249,0.65)'}
        strokeWidth="1.4"
        strokeDasharray={mode === 'indicator' ? undefined : '4 3'}
      />

      {/* Horizontal reference level */}
      <line
        x1="0"
        x2="320"
        y1={targetY}
        y2={targetY}
        stroke={direction === 'SHORT' ? '#F23645' : '#089981'}
        strokeOpacity="0.6"
        strokeDasharray="3 3"
      />
    </svg>
  );
};
