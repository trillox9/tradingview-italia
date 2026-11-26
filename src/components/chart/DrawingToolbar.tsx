import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DRAWING_TOOL_GROUPS,
  DRAWING_TOOL_REGISTRY,
  normalizeDrawingTool,
  type CanonicalDrawingToolType,
  type DrawingToolGroup,
  type DrawingToolType,
} from '../../types';
import {
  useActivePane,
  useDrawings,
  useTradingView,
  type HideMode,
  type MagnetMode,
} from '../../store';
import '../../styles/drawingTools.css';

export interface DrawingToolbarProps {
  canZoomOut?: boolean;
  onZoomOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type FlyoutKind =
  | { type: 'group'; group: DrawingToolGroup }
  | { type: 'magnet' }
  | { type: 'hide' }
  | { type: 'remove' };

interface FlyoutSection {
  title?: string;
  tools: CanonicalDrawingToolType[];
}

const GROUP_LAST_TOOL_STORAGE_KEY = 'tv_it_drawing_group_last_tool_v1';

const PRIMARY_DRAWING_GROUPS: readonly DrawingToolGroup[] = [
  'cursors',
  'trend_lines',
  'gann_fib',
  'patterns',
  'projection',
  'shapes',
  'annotations',
];

const GROUP_FLYOUT_SECTIONS: Record<
  Exclude<DrawingToolGroup, 'utilities'>,
  FlyoutSection[]
> = {
  cursors: [
    {
      title: 'Cursori',
      tools: ['crosshair', 'dot', 'arrow_cursor', 'eraser'],
    },
  ],
  trend_lines: [
    {
      title: 'Linee',
      tools: [
        'trendline',
        'ray',
        'info_line',
        'extended_line',
        'trend_angle',
        'hline',
        'hray',
        'vline',
        'cross_line',
      ],
    },
    {
      title: 'Canali',
      tools: ['channel', 'flat_channel', 'disjoint_channel', 'regression_trend'],
    },
    {
      title: 'Pitchfork',
      tools: ['pitchfork', 'schiff_pitchfork'],
    },
  ],
  gann_fib: [
    {
      title: 'Fibonacci',
      tools: [
        'fib_retracement',
        'fib_extension',
        'fib_channel',
        'fib_time_zone',
        'fib_speed_fan',
        'fib_circles',
      ],
    },
    {
      title: 'Gann',
      tools: ['gann_box', 'gann_fan'],
    },
  ],
  patterns: [
    {
      title: 'Pattern armonici e grafici',
      tools: ['xabcd_pattern', 'cypher_pattern', 'head_shoulders'],
    },
    {
      title: 'Onde e cicli',
      tools: ['elliott_impulse', 'elliott_correction', 'cyclic_lines', 'bars_pattern'],
    },
  ],
  projection: [
    {
      title: 'Proiezione',
      tools: ['long_position', 'short_position', 'forecast'],
    },
    {
      title: 'Misurazione e Volume',
      tools: [
        'price_range',
        'date_range',
        'date_price_range',
        'volume_profile_fixed',
      ],
    },
  ],
  shapes: [
    {
      title: 'Disegno libero e Frecce',
      tools: ['brush', 'highlighter', 'arrow_marker', 'arrow_line'],
    },
    {
      title: 'Forme geometriche',
      tools: [
        'rectangle',
        'rotated_rectangle',
        'path',
        'circle',
        'ellipse',
        'triangle',
        'curve',
        'arc',
      ],
    },
  ],
  annotations: [
    {
      title: 'Testo e Note',
      tools: [
        'text',
        'anchored_text',
        'note',
        'price_note',
        'callout',
        'price_label',
      ],
    },
    {
      title: 'Contrassegni',
      tools: ['flag_mark', 'arrow_up', 'arrow_down'],
    },
  ],
};

function getInitialGroupToolMap(): Record<
  Exclude<DrawingToolGroup, 'utilities'>,
  CanonicalDrawingToolType
> {
  const defaults: Record<
    Exclude<DrawingToolGroup, 'utilities'>,
    CanonicalDrawingToolType
  > = {
    cursors: 'crosshair',
    trend_lines: 'trendline',
    gann_fib: 'fib_retracement',
    patterns: 'xabcd_pattern',
    projection: 'long_position',
    shapes: 'brush',
    annotations: 'text',
  };

  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(GROUP_LAST_TOOL_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const grp of PRIMARY_DRAWING_GROUPS) {
      if (grp === 'utilities') continue;
      const candidate = parsed?.[grp];
      if (!candidate) continue;
      const norm = normalizeDrawingTool(candidate as DrawingToolType);
      if (DRAWING_TOOL_REGISTRY[norm]?.group === grp) {
        defaults[grp] = norm;
      }
    }
  } catch {
    // ignore storage failures
  }
  return defaults;
}

/**
 * Crisp 18x18 custom TradingView vector SVG icon for every single one of the
 * 64 canonical DrawingToolType entries (plus legacy aliases via normalizeDrawingTool).
 */
export function DrawingToolIcon({
  tool,
  size = 18,
}: {
  tool: DrawingToolType;
  size?: number;
}) {
  const canonical = normalizeDrawingTool(tool);
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (canonical) {
    // ---- Group 1: Cursors ----
    case 'crosshair':
      return (
        <svg {...p}>
          <path d="M9 2v4.5M9 11.5V16M2 9h4.5M11.5 9H16" strokeDasharray="2 1.5" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'dot':
      return (
        <svg {...p}>
          <path d="M9 2.5v3M9 12.5v3M2.5 9h3M12.5 9h3" strokeDasharray="1.6 1.8" />
          <circle cx="9" cy="9" r="2.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'arrow_cursor':
      return (
        <svg {...p}>
          <path d="M4.5 2.8v11.6l3.2-3.1 2.2 4.3 1.7-.8-2.2-4.3h4.3L4.5 2.8z" />
        </svg>
      );
    case 'eraser':
      return (
        <svg {...p}>
          <path d="M3.5 11.5l6.2-6.2a1.6 1.6 0 0 1 2.3 0l2.7 2.7a1.6 1.6 0 0 1 0 2.3l-4.6 4.6H5.5l-2-2a1 1 0 0 1 0-1.4z" />
          <path d="M7.5 7.5l4.2 4.2M9.5 15h5.5" />
        </svg>
      );

    // ---- Group 2: Trend Lines & Channels ----
    case 'trendline':
      return (
        <svg {...p}>
          <line x1="4.2" y1="13.8" x2="13.8" y2="4.2" />
          <circle cx="3.5" cy="14.5" r="1.7" fill="var(--dt-bg, #000)" />
          <circle cx="14.5" cy="3.5" r="1.7" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'ray':
      return (
        <svg {...p}>
          <line x1="4.2" y1="13.8" x2="15.5" y2="2.5" />
          <path d="M11.8 2.5h3.7v3.7" />
          <circle cx="3.5" cy="14.5" r="1.7" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'info_line':
      return (
        <svg {...p}>
          <line x1="3.8" y1="13.5" x2="11.2" y2="6.1" />
          <circle cx="3.2" cy="14.1" r="1.5" fill="var(--dt-bg, #000)" />
          <rect x="9.5" y="2.5" width="6.5" height="4.5" rx="1" />
          <path d="M11.2 4.8h3.1" strokeWidth="1.2" />
        </svg>
      );
    case 'extended_line':
      return (
        <svg {...p}>
          <line x1="2" y1="16" x2="16" y2="2" />
          <circle cx="6.2" cy="11.8" r="1.6" fill="var(--dt-bg, #000)" />
          <circle cx="11.8" cy="6.2" r="1.6" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'trend_angle':
      return (
        <svg {...p}>
          <line x1="3.5" y1="14" x2="15.5" y2="14" strokeDasharray="2 1.5" />
          <line x1="3.5" y1="14" x2="14" y2="4" />
          <path d="M9.5 14a6 6 0 0 0-1.9-4.3" />
          <circle cx="3.5" cy="14" r="1.5" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'hline':
      return (
        <svg {...p}>
          <line x1="2" y1="9" x2="16" y2="9" />
          <circle cx="9" cy="9" r="1.8" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'hray':
      return (
        <svg {...p}>
          <line x1="4.8" y1="9" x2="16" y2="9" />
          <circle cx="3.5" cy="9" r="1.7" fill="var(--dt-bg, #000)" />
          <path d="M13 6.5L15.8 9 13 11.5" />
        </svg>
      );
    case 'vline':
      return (
        <svg {...p}>
          <line x1="9" y1="2" x2="9" y2="16" />
          <circle cx="9" cy="9" r="1.8" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'cross_line':
      return (
        <svg {...p}>
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="9" y1="2" x2="9" y2="16" />
          <circle cx="9" cy="9" r="1.7" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'channel':
      return (
        <svg {...p}>
          <line x1="2.8" y1="11.5" x2="12.5" y2="2.8" />
          <line x1="5.5" y1="15.2" x2="15.2" y2="6.5" />
          <line x1="4.2" y1="13.4" x2="13.8" y2="4.6" strokeDasharray="2 1.8" strokeWidth="1" />
          <circle cx="4.5" cy="10" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'flat_channel':
      return (
        <svg {...p}>
          <line x1="2.5" y1="5" x2="15.5" y2="5" />
          <line x1="2.5" y1="14.5" x2="15.5" y2="9.5" />
          <circle cx="4.5" cy="5" r="1.3" fill="var(--dt-bg, #000)" />
          <circle cx="13.5" cy="10.3" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'disjoint_channel':
      return (
        <svg {...p}>
          <line x1="2.5" y1="8.5" x2="15.5" y2="3.5" />
          <line x1="2.5" y1="12" x2="15.5" y2="15" />
          <circle cx="5" cy="7.5" r="1.3" fill="var(--dt-bg, #000)" />
          <circle cx="13" cy="14.4" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'regression_trend':
      return (
        <svg {...p}>
          <line x1="2.5" y1="13" x2="15.5" y2="5" />
          <line x1="2.5" y1="9.5" x2="15.5" y2="1.5" strokeDasharray="2 1.5" strokeWidth="1.1" />
          <line x1="2.5" y1="16.5" x2="15.5" y2="8.5" strokeDasharray="2 1.5" strokeWidth="1.1" />
        </svg>
      );

    // ---- Group 3: Gann & Fibonacci ----
    case 'fib_retracement':
      return (
        <svg {...p}>
          <line x1="2.5" y1="4" x2="15.5" y2="4" />
          <line x1="2.5" y1="7.5" x2="15.5" y2="7.5" />
          <line x1="2.5" y1="11" x2="15.5" y2="11" />
          <line x1="2.5" y1="14.5" x2="15.5" y2="14.5" />
          <circle cx="5" cy="4" r="1.4" fill="var(--dt-bg, #000)" />
          <circle cx="13" cy="14.5" r="1.4" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'fib_extension':
      return (
        <svg {...p}>
          <polyline points="2.5,14 6.5,5.5 9.5,10" />
          <line x1="8" y1="4" x2="16" y2="4" />
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="13" x2="16" y2="13" />
        </svg>
      );
    case 'fib_channel':
      return (
        <svg {...p}>
          <line x1="2.5" y1="10" x2="12" y2="2.5" />
          <line x1="4" y1="13" x2="14" y2="5" />
          <line x1="6" y1="16" x2="16" y2="8" />
        </svg>
      );
    case 'fib_time_zone':
      return (
        <svg {...p}>
          <line x1="3" y1="3" x2="3" y2="15" />
          <line x1="5.5" y1="3" x2="5.5" y2="15" />
          <line x1="9" y1="3" x2="9" y2="15" />
          <line x1="14.5" y1="3" x2="14.5" y2="15" />
          <circle cx="3" cy="11" r="1.2" fill="var(--dt-bg, #000)" />
          <circle cx="5.5" cy="7" r="1.2" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'fib_speed_fan':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="12" height="12" strokeDasharray="2 2" strokeWidth="1.1" />
          <line x1="3" y1="15" x2="15" y2="3" />
          <line x1="3" y1="15" x2="15" y2="7.5" />
          <line x1="3" y1="15" x2="11" y2="3" />
        </svg>
      );
    case 'fib_circles':
      return (
        <svg {...p}>
          <circle cx="9" cy="9" r="2.2" />
          <circle cx="9" cy="9" r="4.5" />
          <circle cx="9" cy="9" r="6.8" strokeDasharray="2 1.6" />
        </svg>
      );
    case 'gann_box':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="12" height="12" />
          <line x1="3" y1="3" x2="15" y2="15" />
          <line x1="15" y1="3" x2="3" y2="15" />
          <line x1="9" y1="3" x2="9" y2="15" strokeWidth="1" />
          <line x1="3" y1="9" x2="15" y2="9" strokeWidth="1" />
        </svg>
      );
    case 'gann_fan':
      return (
        <svg {...p}>
          <line x1="3" y1="15" x2="7.5" y2="3" />
          <line x1="3" y1="15" x2="12" y2="3" />
          <line x1="3" y1="15" x2="15" y2="6.5" />
          <line x1="3" y1="15" x2="15" y2="11" />
          <circle cx="3" cy="15" r="1.6" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'pitchfork':
      return (
        <svg {...p}>
          <line x1="3" y1="15" x2="14.5" y2="3.5" />
          <polyline points="6.5,5 12,12.5" strokeWidth="1.2" />
          <line x1="6.5" y1="5" x2="13.5" y2="2" />
          <line x1="12" y1="12.5" x2="16" y2="8.5" />
          <circle cx="3" cy="15" r="1.4" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'schiff_pitchfork':
      return (
        <svg {...p}>
          <line x1="4.5" y1="12.5" x2="15" y2="3" />
          <line x1="3" y1="15.5" x2="6.5" y2="5.5" strokeDasharray="1.8 1.5" />
          <line x1="6.5" y1="5.5" x2="13" y2="2" />
          <line x1="12" y1="13" x2="16" y2="9" />
          <circle cx="3" cy="15.5" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );

    // ---- Group 4: Patterns ----
    case 'xabcd_pattern':
      return (
        <svg {...p}>
          <polyline points="2.5,13.5 5.5,4.5 9,10.5 12.5,5 15.5,13" />
          <line x1="2.5" y1="13.5" x2="9" y2="10.5" strokeDasharray="1.8 1.4" strokeWidth="1" />
          <circle cx="5.5" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12.5" cy="5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'cypher_pattern':
      return (
        <svg {...p}>
          <polyline points="2.5,14 5.5,7 8.5,11.5 12.5,3 15.5,12.5" />
          <line x1="2.5" y1="14" x2="12.5" y2="3" strokeDasharray="1.8 1.4" strokeWidth="1" />
          <circle cx="12.5" cy="3" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'head_shoulders':
      return (
        <svg {...p}>
          <polyline points="2,13.5 4.5,8.5 6.5,12 9,4 11.5,12 13.5,8.5 16,13.5" />
          <line x1="2" y1="13" x2="16" y2="13" strokeDasharray="2 1.5" strokeWidth="1.1" />
        </svg>
      );
    case 'elliott_impulse':
      return (
        <svg {...p}>
          <polyline points="2,14.5 5,8 7.2,11.5 11.2,3.5 13,7.5 16,2.5" />
          <circle cx="11.2" cy="3.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'elliott_correction':
      return (
        <svg {...p}>
          <polyline points="2.5,5 7,13.5 11.5,7.5 15.5,14.5" />
          <circle cx="7" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'cyclic_lines':
      return (
        <svg {...p}>
          <line x1="3.5" y1="3" x2="3.5" y2="15" />
          <line x1="7.2" y1="3" x2="7.2" y2="15" />
          <line x1="10.9" y1="3" x2="10.9" y2="15" />
          <line x1="14.6" y1="3" x2="14.6" y2="15" />
          <line x1="2" y1="11" x2="16" y2="11" strokeDasharray="1.8 1.5" strokeWidth="1" />
        </svg>
      );
    case 'bars_pattern':
      return (
        <svg {...p}>
          <path d="M4.5 5v8M4.5 7H3M4.5 11H6" />
          <path d="M9 3.5v9M9 6H7.5M9 10h1.5" />
          <path d="M13.5 6v8.5M13.5 8H12M13.5 12H15" />
        </svg>
      );

    // ---- Group 5: Projection & Measurement ----
    case 'long_position':
      return (
        <svg {...p}>
          <rect x="3" y="3.5" width="12" height="5" fill="#089981" fillOpacity="0.26" stroke="#089981" />
          <rect x="3" y="9.5" width="12" height="5" fill="#f23645" fillOpacity="0.26" stroke="#f23645" />
          <line x1="2.5" y1="9" x2="15.5" y2="9" />
        </svg>
      );
    case 'short_position':
      return (
        <svg {...p}>
          <rect x="3" y="3.5" width="12" height="5" fill="#f23645" fillOpacity="0.26" stroke="#f23645" />
          <rect x="3" y="9.5" width="12" height="5" fill="#089981" fillOpacity="0.26" stroke="#089981" />
          <line x1="2.5" y1="9" x2="15.5" y2="9" />
        </svg>
      );
    case 'forecast':
      return (
        <svg {...p}>
          <line x1="3" y1="13" x2="12.5" y2="5.5" strokeDasharray="2 1.5" />
          <path d="M12.5 5.5l2.5-1.5" />
          <circle cx="14.2" cy="4.2" r="1.7" />
          <circle cx="3" cy="13" r="1.4" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'price_range':
      return (
        <svg {...p}>
          <line x1="3.5" y1="3.5" x2="14.5" y2="3.5" />
          <line x1="3.5" y1="14.5" x2="14.5" y2="14.5" />
          <line x1="9" y1="4.5" x2="9" y2="13.5" />
          <path d="M6.8 6.5L9 4.2l2.2 2.3M6.8 11.5L9 13.8l2.2-2.3" />
        </svg>
      );
    case 'date_range':
      return (
        <svg {...p}>
          <line x1="3.5" y1="3.5" x2="3.5" y2="14.5" />
          <line x1="14.5" y1="3.5" x2="14.5" y2="14.5" />
          <line x1="4.5" y1="9" x2="13.5" y2="9" />
          <path d="M6.5 6.8L4.2 9l2.3 2.2M11.5 6.8L13.8 9l-2.3 2.2" />
        </svg>
      );
    case 'date_price_range':
      return (
        <svg {...p}>
          <rect x="3" y="3.5" width="12" height="11" rx="1" />
          <line x1="9" y1="5" x2="9" y2="13" strokeWidth="1.2" />
          <line x1="5" y1="9" x2="13" y2="9" strokeWidth="1.2" />
        </svg>
      );
    case 'volume_profile_fixed':
      return (
        <svg {...p}>
          <line x1="3.5" y1="2.5" x2="3.5" y2="15.5" />
          <rect x="4.5" y="3.5" width="5" height="2" fill="currentColor" stroke="none" />
          <rect x="4.5" y="6.5" width="9" height="2" fill="currentColor" stroke="none" />
          <rect x="4.5" y="9.5" width="11" height="2" fill="#f23645" stroke="none" />
          <rect x="4.5" y="12.5" width="6.5" height="2" fill="currentColor" stroke="none" />
        </svg>
      );

    // ---- Group 6: Geometric Shapes ----
    case 'brush':
      return (
        <svg {...p}>
          <path d="M13.5 2.8l1.7 1.7-6.5 6.5-2.4.7.7-2.4 6.5-6.5z" />
          <path d="M6.2 11.7c-1.8.2-3 1.3-3.2 2.8 1.5.2 2.9-.5 3.6-1.8" />
        </svg>
      );
    case 'highlighter':
      return (
        <svg {...p}>
          <path d="M11.8 2.8l3.4 3.4-6.4 6.4H5.4V9.2l6.4-6.4z" />
          <line x1="3" y1="15" x2="15" y2="15" strokeWidth="2.4" strokeOpacity="0.55" />
        </svg>
      );
    case 'arrow_marker':
      return (
        <svg {...p}>
          <path d="M3.5 14.5l7.2-7.2-2-2 6.3-1.8-1.8 6.3-2-2-7.2 7.2z" fill="currentColor" fillOpacity="0.22" />
        </svg>
      );
    case 'arrow_line':
      return (
        <svg {...p}>
          <line x1="3.2" y1="14.8" x2="14.2" y2="3.8" />
          <path d="M9.8 3.5h4.7v4.7" />
        </svg>
      );
    case 'rectangle':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="11" height="9" rx="0.8" />
          <circle cx="3.5" cy="4.5" r="1.3" fill="var(--dt-bg, #000)" />
          <circle cx="14.5" cy="13.5" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'rotated_rectangle':
      return (
        <svg {...p}>
          <polygon points="3,10.5 8.5,3.5 15,7.5 9.5,14.5" />
          <circle cx="3" cy="10.5" r="1.2" fill="var(--dt-bg, #000)" />
          <circle cx="15" cy="7.5" r="1.2" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'path':
      return (
        <svg {...p}>
          <polyline points="2.5,13 6.5,6.5 11,11.5 15,4.5" />
          <path d="M12.2 4.3h2.9v2.9" />
          <circle cx="2.5" cy="13" r="1.2" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...p}>
          <circle cx="9" cy="9" r="5.8" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg {...p}>
          <ellipse cx="9" cy="9" rx="6.5" ry="4.2" />
          <circle cx="2.5" cy="9" r="1.2" fill="var(--dt-bg, #000)" />
          <circle cx="15.5" cy="9" r="1.2" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'triangle':
      return (
        <svg {...p}>
          <polygon points="9,3.5 15,14 3,14" />
          <circle cx="9" cy="3.5" r="1.2" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'curve':
      return (
        <svg {...p}>
          <path d="M2.5 13.5Q9 2.5 15.5 13.5" />
          <circle cx="9" cy="7.8" r="1.3" fill="var(--dt-bg, #000)" />
        </svg>
      );
    case 'arc':
      return (
        <svg {...p}>
          <path d="M3 13A7 7 0 0 1 15 13" />
          <line x1="3" y1="13" x2="15" y2="13" strokeDasharray="2 1.8" strokeWidth="1" />
        </svg>
      );

    // ---- Group 7: Annotations ----
    case 'text':
      return (
        <svg {...p}>
          <path d="M4.2 4.2h9.6M9 4.2v10M6.8 14.2h4.4" strokeWidth="1.6" />
        </svg>
      );
    case 'anchored_text':
      return (
        <svg {...p}>
          <path d="M4.5 3.5h9M9 3.5v6.8" strokeWidth="1.5" />
          <circle cx="9" cy="13.5" r="1.8" />
          <path d="M6 15h6" strokeWidth="1.1" />
        </svg>
      );
    case 'note':
      return (
        <svg {...p}>
          <path d="M4 3h10v8.5L11.5 14H4V3z" />
          <path d="M11 14v-3h3" />
          <path d="M6.5 6.5h5M6.5 9.2h3.5" strokeWidth="1.2" />
        </svg>
      );
    case 'price_note':
      return (
        <svg {...p}>
          <rect x="6" y="3" width="9" height="7" rx="1.2" />
          <path d="M8 6.5h5" strokeWidth="1.2" />
          <line x1="6" y1="10" x2="3.5" y2="14.5" />
          <circle cx="3.5" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'callout':
      return (
        <svg {...p}>
          <path d="M3 4h12v7.5H7.8L4.2 14.5v-3H3V4z" />
          <path d="M6 7.5h6" strokeWidth="1.2" />
        </svg>
      );
    case 'price_label':
      return (
        <svg {...p}>
          <path d="M6.5 4.5H15v9H6.5L2.8 9l3.7-4.5z" />
          <circle cx="6.8" cy="9" r="1.2" fill="currentColor" stroke="none" />
          <path d="M9.5 9h3.5" strokeWidth="1.2" />
        </svg>
      );
    case 'flag_mark':
      return (
        <svg {...p}>
          <line x1="4.5" y1="3" x2="4.5" y2="15.5" />
          <path d="M4.5 3.5h9l-2 3 2 3h-9" fill="currentColor" fillOpacity="0.25" />
        </svg>
      );
    case 'arrow_up':
      return (
        <svg {...p}>
          <path d="M9 3.2L4.2 8.5h3.2V15h3.2V8.5h3.2L9 3.2z" fill="#089981" fillOpacity="0.28" stroke="#089981" />
        </svg>
      );
    case 'arrow_down':
      return (
        <svg {...p}>
          <path d="M9 14.8l4.8-5.3h-3.2V3H7.4v6.5H4.2L9 14.8z" fill="#f23645" fillOpacity="0.28" stroke="#f23645" />
        </svg>
      );

    // ---- Standalone Utilities ----
    case 'measure':
      return (
        <svg {...p}>
          <path d="M2.8 11.8L11.8 2.8l3.4 3.4-9 9-3.4-3.4z" />
          <path d="M6.2 8.4l1.3 1.3M8.5 6.1l1.3 1.3M10.8 3.8l1.3 1.3" strokeWidth="1.2" />
        </svg>
      );
    case 'zoom_box':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="4.8" />
          <line x1="11.6" y1="11.6" x2="15.5" y2="15.5" />
          <path d="M8 6v4M6 8h4" strokeWidth="1.3" />
        </svg>
      );
  }
}

function ZoomOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="4.8" />
      <line x1="11.6" y1="11.6" x2="15.5" y2="15.5" />
      <path d="M6 8h4" strokeWidth="1.3" />
    </svg>
  );
}

function MagnetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3.5v5.8a4 4 0 0 0 8 0V3.5" />
      <path d="M5 3.5h2.6v5.8a1.4 1.4 0 0 0 2.8 0V3.5H13" />
      <line x1="5" y1="6" x2="7.5" y2="6" />
      <line x1="10.5" y1="6" x2="13" y2="6" />
    </svg>
  );
}

function StayDrawingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.6 3l3.4 3.4-7.8 7.8-3.8.4.4-3.8L11.6 3z" />
      <circle cx="13.2" cy="13.2" r="2.2" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8.2" width="10" height="7" rx="1.5" />
      {locked ? (
        <path d="M6.2 8.2V5.8a2.8 2.8 0 0 1 5.6 0v2.4" />
      ) : (
        <path d="M6.2 8.2V5.5a2.8 2.8 0 0 1 5.4-1" />
      )}
      <circle cx="9" cy="11.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9s2.7-4.5 7-4.5S16 9 16 9s-2.7 4.5-7 4.5S2 9 2 9z" />
      <circle cx="9" cy="9" r="2" />
      {hidden && <line x1="3" y1="15" x2="15" y2="3" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5h11M6.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5" />
      <path d="M5 5l.8 9.5a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9L13 5" />
      <path d="M7.8 8v4.5M10.2 8v4.5" strokeWidth="1.2" />
    </svg>
  );
}

function StarIcon({ filled, size = 15 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="9,2.2 11.1,6.5 15.8,7.2 12.4,10.5 13.2,15.2 9,13 4.8,15.2 5.6,10.5 2.2,7.2 6.9,6.5" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg width="7" height="10" viewBox="0 0 7 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2,2 5,5 2,8" />
    </svg>
  );
}

const REA_GROUP_TITLE_OVERRIDES: Partial<Record<DrawingToolGroup, string>> = {
  trend_lines: 'Strumenti analisi trend',
  projection: 'Strumenti di misurazione e previsione',
  annotations: 'Strumenti di annotazione',
};

const REA_TOOL_LABEL_OVERRIDES: Partial<Record<CanonicalDrawingToolType, string>> = {
  ray: 'Raggio',
  hray: 'Raggio orizzontale',
  cross_line: 'Linea trasversale',
  arrow_line: 'Linea con freccia',
};

function getDisplayGroupTitle(
  group: DrawingToolGroup,
  fallback: string,
): string {
  return REA_GROUP_TITLE_OVERRIDES[group] ?? fallback;
}

function getDisplayToolLabel(tool: CanonicalDrawingToolType): string {
  return REA_TOOL_LABEL_OVERRIDES[tool] ?? DRAWING_TOOL_REGISTRY[tool].labelIt;
}

const HIDE_MODE_OPTIONS: ReadonlyArray<{ mode: HideMode; label: string }> = [
  { mode: 'none', label: 'Mostra tutto' },
  { mode: 'drawings', label: 'Nascondi disegni' },
  { mode: 'indicators', label: 'Nascondi indicatori' },
  { mode: 'all', label: 'Nascondi tutto' },
];

const MAGNET_OPTIONS: ReadonlyArray<{ mode: MagnetMode; label: string; hint?: string }> = [
  { mode: 'off', label: 'Disattiva' },
  { mode: 'weak', label: 'Magnete debole', hint: 'OHLC vicino' },
  { mode: 'strong', label: 'Magnete forte', hint: 'OHLC forzato' },
];

export const LONG_PRESS_VALUES_STORAGE_KEY = 'tv_it_long_press_values_v1';

export function readLongPressValuesEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LONG_PRESS_VALUES_STORAGE_KEY);
    if (raw === '0' || raw === 'false') return false;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function DrawingToolbar({
  canZoomOut = false,
  onZoomOut,
  mobileOpen,
  onCloseMobile,
}: DrawingToolbarProps) {
  const { pineAppliedToChart } = useTradingView();
  const { activePane } = useActivePane();
  const {
    drawings,
    activeTool,
    setActiveTool,
    favoriteTools,
    toggleFavoriteTool,
    showFavoritesBar,
    toggleFavoritesBar,
    magnetMode,
    setMagnetMode,
    stayInDrawingMode,
    setStayInDrawingMode,
    lockDrawings,
    setLockDrawings,
    hideMode,
    setHideMode,
    clearDrawings,
    clearIndicators,
    clearAllObjects,
  } = useDrawings();

  const [groupToolMap, setGroupToolMap] = useState(getInitialGroupToolMap);
  const [longPressValuesEnabled, setLongPressValuesEnabled] = useState<boolean>(
    readLongPressValuesEnabled,
  );
  const [flyout, setFlyout] = useState<FlyoutKind | null>(null);
  const [flyoutCoords, setFlyoutCoords] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 48,
    left: 58,
    maxHeight: 520,
  });

  const anchorRectRef = useRef<DOMRect | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const canonicalActiveTool = useMemo(
    () => normalizeDrawingTool(activeTool),
    [activeTool],
  );

  // Sync group last-selected icon whenever activeTool changes externally (shortcuts/favorites)
  useEffect(() => {
    const meta = DRAWING_TOOL_REGISTRY[canonicalActiveTool];
    if (!meta || meta.group === 'utilities') return;
    const grp = meta.group as Exclude<DrawingToolGroup, 'utilities'>;
    setGroupToolMap((prev) => {
      if (prev[grp] === canonicalActiveTool) return prev;
      const next = { ...prev, [grp]: canonicalActiveTool };
      try {
        window.localStorage.setItem(GROUP_LAST_TOOL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [canonicalActiveTool]);

  const computeInitialCoords = useCallback((anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    anchorRectRef.current = rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= 900;
    const left = isMobile ? 58 : Math.min(vw - 260, rect.right + 6);
    const minTop = isMobile ? 46 : 8;
    const maxHeight = isMobile ? Math.max(160, vh - 64) : Math.max(180, vh - 16);
    const top = Math.max(minTop, Math.min(vh - 220, rect.top));
    return {
      top,
      left: Math.max(8, left),
      maxHeight,
    };
  }, []);

  const openFlyout = useCallback(
    (next: FlyoutKind, anchorEl: HTMLElement | null) => {
      if (!anchorEl) return;
      setFlyout((prev) => {
        const same =
          prev &&
          prev.type === next.type &&
          (prev.type !== 'group' ||
            (next.type === 'group' && prev.group === next.group));
        if (same) return null;
        setFlyoutCoords(computeInitialCoords(anchorEl));
        return next;
      });
    },
    [computeInitialCoords],
  );

  const closeMobileIfNeeded = useCallback(() => {
    if (
      mobileOpen ||
      (typeof window !== 'undefined' && window.innerWidth <= 900)
    ) {
      onCloseMobile?.();
    }
  }, [mobileOpen, onCloseMobile]);

  const dismissAll = useCallback(() => {
    setFlyout(null);
    closeMobileIfNeeded();
  }, [closeMobileIfNeeded]);

  // Clamp flyout cleanly inside viewport after measuring actual rendered dimensions
  useLayoutEffect(() => {
    if (!flyout || !flyoutRef.current || !anchorRectRef.current) return;
    const clamp = () => {
      if (!flyoutRef.current || !anchorRectRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw <= 900;
      const anchor = anchorRectRef.current;
      const rect = flyoutRef.current.getBoundingClientRect();

      let left = isMobile ? 58 : anchor.right + 6;
      if (left + rect.width > vw - 8) {
        left = Math.max(isMobile ? 58 : 8, vw - rect.width - 8);
      }
      left = Math.max(8, left);

      const minTop = isMobile ? 46 : 8;
      const bottomPad = isMobile ? 14 : 8;
      let top = Math.max(minTop, anchor.top);
      if (top + rect.height > vh - bottomPad) {
        top = Math.max(minTop, vh - rect.height - bottomPad);
      }

      const maxHeight = isMobile ? Math.max(160, vh - 64) : Math.max(160, vh - 16);

      setFlyoutCoords((prev) =>
        Math.abs(prev.top - top) < 1 &&
        Math.abs(prev.left - left) < 1 &&
        Math.abs(prev.maxHeight - maxHeight) < 1
          ? prev
          : { top, left, maxHeight },
      );
    };

    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [flyout]);

  // Close flyout on outside pointerdown or Escape (ignoring pencil toggle & mobile backdrop)
  useEffect(() => {
    if (!flyout) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (
        flyoutRef.current?.contains(t) ||
        railRef.current?.contains(t) ||
        backdropRef.current?.contains(t)
      ) {
        return;
      }
      if (t instanceof Element && t.closest('[data-drawing-toggle="true"]')) {
        return;
      }
      setFlyout(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlyout(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [flyout]);

  const selectTool = useCallback(
    (tool: CanonicalDrawingToolType, closeMobileRail = true) => {
      const meta = DRAWING_TOOL_REGISTRY[tool];
      if (meta && meta.group !== 'utilities') {
        const grp = meta.group as Exclude<DrawingToolGroup, 'utilities'>;
        setGroupToolMap((prev) => {
          const next = { ...prev, [grp]: tool };
          try {
            window.localStorage.setItem(GROUP_LAST_TOOL_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore storage errors
          }
          return next;
        });
      }
      setActiveTool(tool);
      setFlyout(null);
      if (closeMobileRail) {
        closeMobileIfNeeded();
      }
    },
    [closeMobileIfNeeded, setActiveTool],
  );

  const hasIndicators = activePane.indicators.length > 0 || pineAppliedToChart;
  const hasAnyObjects = drawings.length > 0 || hasIndicators;

  const isFlyoutOpenForGroup = (grp: DrawingToolGroup) =>
    flyout?.type === 'group' && flyout.group === grp;

  const activeGroupDef =
    flyout?.type === 'group'
      ? DRAWING_TOOL_GROUPS.find((g) => g.id === flyout.group)
      : null;

  const railClassName = [
    'sc-left-bar',
    mobileOpen === false ? 'sc-left-bar--mobile-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {mobileOpen && (
        <div
          ref={backdropRef}
          className="sc-dt-mobile-backdrop"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissAll();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismissAll();
          }}
        />
      )}

      <aside
        ref={railRef}
        className={railClassName}
        role="toolbar"
        aria-orientation="vertical"
        aria-label="Strumenti di disegno"
      >
        {/* ---- 7 Primary TradingView Tool Groups (single-click opens flyout) ---- */}
        {PRIMARY_DRAWING_GROUPS.map((grp) => {
          if (grp === 'utilities') return null;
          const groupDef = DRAWING_TOOL_GROUPS.find((g) => g.id === grp);
          const currentTool = groupToolMap[grp];
          const meta = DRAWING_TOOL_REGISTRY[currentTool];
          const isActive = canonicalActiveTool === currentTool || DRAWING_TOOL_REGISTRY[canonicalActiveTool]?.group === grp;
          const flyOpen = isFlyoutOpenForGroup(grp);
          const groupLabel = getDisplayGroupTitle(grp, groupDef?.labelIt ?? grp);
          const toolLabel = getDisplayToolLabel(currentTool);
          const tooltip = meta.shortcut
            ? `${groupLabel} · ${toolLabel} (${meta.shortcut})`
            : `${groupLabel} · ${toolLabel}`;

          return (
            <div
              key={grp}
              className={`sc-dt-slot ${isActive ? 'sc-dt-slot--active' : ''}`}
            >
              <button
                type="button"
                className={`sc-dt-btn sc-dt-btn--group ${isActive ? 'sc-dt-btn--active' : ''}`}
                title={tooltip}
                aria-label={`${groupLabel}: ${toolLabel}`}
                aria-pressed={isActive}
                aria-expanded={flyOpen}
                aria-haspopup="menu"
                onClick={(e) => {
                  e.stopPropagation();
                  openFlyout({ type: 'group', group: grp }, e.currentTarget.parentElement);
                }}
              >
                <DrawingToolIcon tool={currentTool} size={18} />
                <span
                  className={`sc-dt-caret-indicator ${flyOpen ? 'sc-dt-caret-indicator--open' : ''}`}
                  aria-hidden="true"
                >
                  <CaretIcon />
                </span>
              </button>
            </div>
          );
        })}

        <div className="sc-dt-sep" />

        {/* ---- Standalone Lower Section ---- */}
        {/* Misura */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className={`sc-dt-btn ${canonicalActiveTool === 'measure' ? 'sc-dt-btn--active' : ''}`}
            title="Misura (Shift+Click)"
            aria-label="Misura"
            aria-pressed={canonicalActiveTool === 'measure'}
            onClick={() => selectTool('measure', true)}
          >
            <DrawingToolIcon tool="measure" size={18} />
          </button>
        </div>

        {/* Zoom avanti */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className={`sc-dt-btn ${canonicalActiveTool === 'zoom_box' ? 'sc-dt-btn--active' : ''}`}
            title="Zoom avanti"
            aria-label="Zoom avanti"
            aria-pressed={canonicalActiveTool === 'zoom_box'}
            onClick={() => selectTool('zoom_box', true)}
          >
            <DrawingToolIcon tool="zoom_box" size={18} />
          </button>
        </div>

        {/* Conditional Zoom indietro */}
        {canZoomOut && (
          <div className="sc-dt-slot">
            <button
              type="button"
              className="sc-dt-btn"
              title="Zoom indietro"
              aria-label="Zoom indietro"
              onClick={() => {
                setFlyout(null);
                onZoomOut?.();
                closeMobileIfNeeded();
              }}
            >
              <ZoomOutIcon />
            </button>
          </div>
        )}

        <div className="sc-dt-sep" />

        {/* Calamita (single click toggles flyout) */}
        <div className={`sc-dt-slot ${magnetMode !== 'off' ? 'sc-dt-slot--active' : ''}`}>
          <button
            type="button"
            className={`sc-dt-btn sc-dt-btn--group ${magnetMode !== 'off' ? 'sc-dt-btn--active' : ''}`}
            title={
              magnetMode === 'off'
                ? 'Calamita: Disattiva (Ctrl)'
                : magnetMode === 'weak'
                  ? 'Calamita debole (OHLC · Ctrl)'
                  : 'Calamita forte (OHLC · Ctrl)'
            }
            aria-label="Modalità calamita"
            aria-pressed={magnetMode !== 'off'}
            aria-expanded={flyout?.type === 'magnet'}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              openFlyout({ type: 'magnet' }, e.currentTarget.parentElement);
            }}
          >
            <MagnetIcon />
            {magnetMode !== 'off' && (
              <span
                className={`sc-dt-badge ${
                  magnetMode === 'strong' ? 'sc-dt-badge--strong' : ''
                }`}
              >
                {magnetMode === 'weak' ? 'D' : 'F'}
              </span>
            )}
            <span
              className={`sc-dt-caret-indicator ${flyout?.type === 'magnet' ? 'sc-dt-caret-indicator--open' : ''}`}
              aria-hidden="true"
            >
              <CaretIcon />
            </span>
          </button>
        </div>

        {/* Rimani in modalità disegno */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className={`sc-dt-btn ${stayInDrawingMode ? 'sc-dt-btn--active' : ''}`}
            title="Rimani in modalità disegno"
            aria-label="Rimani in modalità disegno"
            aria-pressed={stayInDrawingMode}
            onClick={() => {
              setFlyout(null);
              setStayInDrawingMode(!stayInDrawingMode);
            }}
          >
            <StayDrawingIcon />
          </button>
        </div>

        {/* Blocca tutti gli strumenti di disegno */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className={`sc-dt-btn ${lockDrawings ? 'sc-dt-btn--active' : ''}`}
            title={
              lockDrawings
                ? 'Sblocca tutti gli strumenti di disegno'
                : 'Blocca tutti gli strumenti di disegno'
            }
            aria-label="Blocca tutti gli strumenti di disegno"
            aria-pressed={lockDrawings}
            onClick={() => {
              setFlyout(null);
              setLockDrawings(!lockDrawings);
            }}
          >
            <LockIcon locked={lockDrawings} />
          </button>
        </div>

        {/* Nascondi (single click toggles flyout) */}
        <div className={`sc-dt-slot ${hideMode !== 'none' ? 'sc-dt-slot--active' : ''}`}>
          <button
            type="button"
            className={`sc-dt-btn sc-dt-btn--group ${hideMode !== 'none' ? 'sc-dt-btn--active' : ''}`}
            title={
              hideMode === 'none'
                ? 'Nascondi disegni (Ctrl+Alt+H)'
                : `${HIDE_MODE_OPTIONS.find((o) => o.mode === hideMode)?.label ?? 'Mostra tutto'} (Ctrl+Alt+H)`
            }
            aria-label="Opzioni Nascondi"
            aria-pressed={hideMode !== 'none'}
            aria-expanded={flyout?.type === 'hide'}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              openFlyout({ type: 'hide' }, e.currentTarget.parentElement);
            }}
          >
            <EyeIcon hidden={hideMode !== 'none'} />
            <span
              className={`sc-dt-caret-indicator ${flyout?.type === 'hide' ? 'sc-dt-caret-indicator--open' : ''}`}
              aria-hidden="true"
            >
              <CaretIcon />
            </span>
          </button>
        </div>

        {/* Rimuovi (single click toggles flyout) */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className="sc-dt-btn sc-dt-btn--group sc-dt-btn--danger"
            title={
              drawings.length > 0
                ? `Rimuovi oggetti (${drawings.length} disegni)`
                : 'Rimuovi oggetti'
            }
            aria-label="Rimuovi disegni e indicatori"
            aria-expanded={flyout?.type === 'remove'}
            aria-haspopup="menu"
            disabled={!hasAnyObjects}
            onClick={(e) => {
              e.stopPropagation();
              openFlyout({ type: 'remove' }, e.currentTarget.parentElement);
            }}
          >
            <TrashIcon />
            <span
              className={`sc-dt-caret-indicator ${flyout?.type === 'remove' ? 'sc-dt-caret-indicator--open' : ''}`}
              aria-hidden="true"
            >
              <CaretIcon />
            </span>
          </button>
        </div>

        <div className="sc-dt-spacer" />
        <div className="sc-dt-sep" />

        {/* Bottom Favorites Bar Toggle Star */}
        <div className="sc-dt-slot">
          <button
            type="button"
            className={`sc-dt-btn ${
              showFavoritesBar ? 'sc-dt-btn--active sc-dt-btn--star-active' : ''
            }`}
            title={
              showFavoritesBar
                ? 'Nascondi barra strumenti preferiti'
                : 'Mostra barra strumenti preferiti'
            }
            aria-label="Mostra barra strumenti di disegno preferiti"
            aria-pressed={showFavoritesBar}
            onClick={() => {
              setFlyout(null);
              toggleFavoritesBar();
            }}
          >
            <StarIcon filled={showFavoritesBar} size={17} />
          </button>
        </div>
      </aside>

      {/* ======================== CLAMPED FLYOUT PORTAL ======================== */}
      {flyout && (
        <div
          ref={flyoutRef}
          className={`sc-dt-flyout ${
            flyout.type !== 'group' ? 'sc-dt-flyout--compact' : ''
          }`}
          role="menu"
          aria-label={
            flyout.type === 'group'
              ? getDisplayGroupTitle(flyout.group, activeGroupDef?.labelIt ?? 'Strumenti')
              : flyout.type === 'magnet'
                ? 'Calamita'
                : flyout.type === 'hide'
                  ? 'Nascondi'
                  : 'Rimuovi'
          }
          style={{
            top: flyoutCoords.top,
            left: flyoutCoords.left,
            maxHeight: flyoutCoords.maxHeight,
          }}
        >
          {flyout.type === 'group' && flyout.group !== 'utilities' && (
            <>
              <div className="sc-dt-flyout-header">
                <span>
                  {getDisplayGroupTitle(flyout.group, activeGroupDef?.labelIt ?? '')}
                </span>
              </div>
              {GROUP_FLYOUT_SECTIONS[flyout.group].map((sec, sIdx) => (
                <div key={sec.title ?? sIdx}>
                  {sec.title && (
                    <div className="sc-dt-flyout-section">{sec.title}</div>
                  )}
                  {sec.tools.map((toolId) => {
                    const meta = DRAWING_TOOL_REGISTRY[toolId];
                    const itemLabel = getDisplayToolLabel(toolId);
                    const isToolActive = canonicalActiveTool === toolId;
                    const isFav = favoriteTools.includes(toolId);
                    return (
                      <div
                        key={toolId}
                        className={`sc-dt-flyout-row ${
                          isToolActive ? 'sc-dt-flyout-row--active' : ''
                        }`}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="sc-dt-flyout-main"
                          onClick={() => selectTool(toolId, true)}
                        >
                          <span className="sc-dt-flyout-left">
                            <DrawingToolIcon tool={toolId} size={17} />
                            <span className="sc-dt-flyout-label">
                              {itemLabel}
                            </span>
                          </span>
                          {meta.shortcut && (
                            <span className="sc-dt-flyout-kbd">
                              {meta.shortcut}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`sc-dt-star-btn ${
                            isFav ? 'sc-dt-star-btn--active' : ''
                          }`}
                          title={
                            isFav
                              ? 'Rimuovi dai preferiti'
                              : 'Aggiungi ai preferiti'
                          }
                          aria-label={
                            isFav
                              ? `Rimuovi ${itemLabel} dai preferiti`
                              : `Aggiungi ${itemLabel} ai preferiti`
                          }
                          aria-pressed={isFav}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteTool(toolId);
                          }}
                        >
                          <StarIcon filled={isFav} size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {flyout.group === 'cursors' && (
                <>
                  <div className="sc-dt-flyout-sep" />
                  <label
                    className="sc-dt-flyout-row"
                    style={{
                      padding: '6px 8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={longPressValuesEnabled}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setLongPressValuesEnabled(next);
                        try {
                          window.localStorage.setItem(
                            LONG_PRESS_VALUES_STORAGE_KEY,
                            next ? '1' : '0',
                          );
                        } catch {
                          // ignore
                        }
                        window.dispatchEvent(
                          new CustomEvent('tv-long-press-values-change', {
                            detail: { enabled: next },
                          }),
                        );
                      }}
                    />
                    <span>Valori visualizzati al tocco prolungato</span>
                  </label>
                </>
              )}
            </>
          )}

          {flyout.type === 'magnet' && (
            <>
              <div className="sc-dt-flyout-header">
                <span>Calamita</span>
              </div>
              {MAGNET_OPTIONS.map((opt) => {
                const active = magnetMode === opt.mode;
                return (
                  <div
                    key={opt.mode}
                    className={`sc-dt-flyout-row ${
                      active ? 'sc-dt-flyout-row--active' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className="sc-dt-flyout-main"
                      onClick={() => {
                        setMagnetMode(opt.mode);
                        dismissAll();
                      }}
                    >
                      <span className="sc-dt-flyout-left">
                        <MagnetIcon />
                        <span className="sc-dt-flyout-label">{opt.label}</span>
                      </span>
                      {opt.hint && (
                        <span className="sc-dt-flyout-kbd">{opt.hint}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {flyout.type === 'hide' && (
            <>
              <div className="sc-dt-flyout-header">
                <span>Nascondi</span>
              </div>
              {HIDE_MODE_OPTIONS.map((opt) => {
                const active = hideMode === opt.mode;
                return (
                  <div
                    key={opt.mode}
                    className={`sc-dt-flyout-row ${
                      active ? 'sc-dt-flyout-row--active' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className="sc-dt-flyout-main"
                      onClick={() => {
                        setHideMode(opt.mode);
                        dismissAll();
                      }}
                    >
                      <span className="sc-dt-flyout-left">
                        <EyeIcon hidden={opt.mode !== 'none'} />
                        <span className="sc-dt-flyout-label">{opt.label}</span>
                      </span>
                      {active && <span className="sc-dt-flyout-kbd">✓</span>}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {flyout.type === 'remove' && (
            <>
              <div className="sc-dt-flyout-header">
                <span>Rimuovi</span>
              </div>
              <div className="sc-dt-flyout-row">
                <button
                  type="button"
                  role="menuitem"
                  className="sc-dt-flyout-main"
                  disabled={drawings.length === 0}
                  onClick={() => {
                    clearDrawings();
                    dismissAll();
                  }}
                >
                  <span className="sc-dt-flyout-left">
                    <TrashIcon />
                    <span className="sc-dt-flyout-label">
                      Rimuovi disegni ({drawings.length})
                    </span>
                  </span>
                </button>
              </div>
              <div className="sc-dt-flyout-row">
                <button
                  type="button"
                  role="menuitem"
                  className="sc-dt-flyout-main"
                  disabled={!hasIndicators}
                  onClick={() => {
                    clearIndicators();
                    dismissAll();
                  }}
                >
                  <span className="sc-dt-flyout-left">
                    <TrashIcon />
                    <span className="sc-dt-flyout-label">
                      Rimuovi indicatori
                    </span>
                  </span>
                </button>
              </div>
              <div className="sc-dt-flyout-sep" />
              <div className="sc-dt-flyout-row">
                <button
                  type="button"
                  role="menuitem"
                  className="sc-dt-flyout-main"
                  disabled={!hasAnyObjects}
                  onClick={() => {
                    clearAllObjects();
                    dismissAll();
                  }}
                >
                  <span className="sc-dt-flyout-left">
                    <TrashIcon />
                    <span className="sc-dt-flyout-label">
                      Rimuovi disegni e indicatori
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default DrawingToolbar;
