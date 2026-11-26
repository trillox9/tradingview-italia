import {
  DRAWING_TOOL_REGISTRY,
  TIMEFRAMES,
  getDefaultChartSettings,
  mergeChartSettings,
  normalizeDrawingTool,
  type Candle,
  type CanonicalDrawingToolType,
  type ChartSettings,
  type ChartSettingsPatch,
  type ChartType,
  type DataSourceKind,
  type DrawingObject,
  type DrawingToolType,
  type IndicatorConfig,
  type IndicatorSeries,
  type PineExecutionResult,
  type PriceScalePosition,
  type SymbolInfo,
  type Timeframe,
  type WatchlistGroup,
} from '../types';
import {
  DEFAULT_WATCHLISTS,
  SYMBOLS,
  getCachedRealCandles,
  getCandlesForSymbol,
  getSymbolById,
  getSymbolByTicker,
  isTestEnvironment,
} from '../data';
import {
  DEFAULT_INDICATOR_PRESETS,
  PINE_TEMPLATES,
  computeIndicatorSeries,
  type StorageLike,
} from '../engine';
import type {
  ChartPaneState,
  DrawingSymbolHistory,
  HideMode,
  LayoutMode,
  MagnetMode,
  ModalState,
  RangePreset,
  ReplayState,
  SavedChartLayout,
  ScaleMode,
  ThemeMode,
} from './types';

export const STORE_STORAGE_KEYS = {
  theme: 'tv_it_theme_v1',
  chartSettings: 'tv_it_chart_settings_v1',
  drawings: 'tv_it_drawings_v1',
  favoriteTools: 'tv_it_favorite_tools_v1',
  showFavoritesBar: 'tv_it_show_favorites_bar_v1',
  watchlists: 'tv_it_watchlists_v1',
  activeWatchlist: 'tv_it_active_watchlist_v1',
  panes: 'tv_it_panes_v1',
  layoutMode: 'tv_it_layout_v1',
  activePaneIndex: 'tv_it_active_pane_v1',
  workspacePrefs: 'tv_it_workspace_prefs_v1',
  savedLayouts: 'tv_it_saved_layouts_v1',
} as const;

export const DEFAULT_FAVORITE_TOOLS: CanonicalDrawingToolType[] = [
  'trendline',
  'hline',
  'fib_retracement',
  'channel',
  'long_position',
  'rectangle',
  'text',
  'measure',
];

export const LAYOUT_PANE_COUNTS: Record<LayoutMode, number> = {
  '1': 1,
  '2h': 2,
  '2v': 2,
  '4': 4,
};

export const INITIAL_MODAL_STATE: ModalState = {
  symbolSearch: false,
  indicators: false,
  compare: false,
  alert: false,
  settings: false,
  shortcuts: false,
  snapshot: false,
};

export const INITIAL_REPLAY_STATE: ReplayState = {
  active: false,
  barIndex: 0,
  playing: false,
  speedMs: 800,
};

export const MAX_DRAWING_HISTORY = 50;

export const DEFAULT_LAYOUT_ID = 'layout-default';
export const DEFAULT_LAYOUT_NAME = 'Senza titolo';

const VALID_LAYOUT_MODES = new Set<LayoutMode>(['1', '2h', '2v', '4']);
const VALID_SCALE_MODES = new Set<ScaleMode>([
  'regular',
  'log',
  'percent',
  'indexed100',
]);
const VALID_RANGE_PRESETS = new Set<RangePreset>([
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  '5Y',
  'ALL',
]);
const VALID_MAGNET_MODES = new Set<MagnetMode>(['off', 'weak', 'strong']);
const VALID_HIDE_MODES = new Set<HideMode>([
  'none',
  'drawings',
  'indicators',
  'positions',
  'all',
]);
const VALID_TIMEFRAMES = new Set<Timeframe>(TIMEFRAMES);

export function normalizeSymbolTicker(symbolOrId?: string): string {
  if (!symbolOrId) return 'FTSEMIB';
  const resolved = getSymbolById(symbolOrId) ?? getSymbolByTicker(symbolOrId);
  return resolved ? resolved.ticker : 'FTSEMIB';
}

export function resolveSymbolInfo(symbolOrId?: string): SymbolInfo {
  const ticker = normalizeSymbolTicker(symbolOrId);
  return getSymbolByTicker(ticker) ?? SYMBOLS[0];
}

export interface InitialPaneSeriesState {
  candles: Candle[];
  dataSource: DataSourceKind;
  isLoading: boolean;
}

/**
 * Resolves the synchronous initial candle series for a pane without ever flashing
 * synthetic simulated candles for live market instruments in browser mode:
 * - Under Vitest (`testEnv = true`): synchronous deterministic simulated candles (`isLoading: false`).
 * - In Browser (`testEnv = false`):
 *   - Returns cached real Binance/Yahoo/snapshot candles immediately (`isLoading: false`).
 *   - Otherwise returns `candles: []` with `isLoading: true` so the canvas displays a clean
 *     loading spinner until real data resolves (zero fake-chart flash!).
 */
export function resolveInitialPaneSeriesState(
  symbolId: string,
  timeframe: Timeframe,
  testEnv = isTestEnvironment(),
): InitialPaneSeriesState {
  const symInfo = resolveSymbolInfo(symbolId);

  if (testEnv) {
    return {
      candles: getCandlesForSymbol(symInfo.ticker, timeframe, 320),
      dataSource: 'simulated',
      isLoading: false,
    };
  }

  const cached = getCachedRealCandles(symInfo.ticker, timeframe);
  if (cached && cached.candles.length > 0) {
    return {
      candles: cached.candles,
      dataSource: cached.source,
      isLoading: false,
    };
  }

  if (symInfo.binanceSymbol || symInfo.yahooSymbol) {
    return {
      candles: [],
      dataSource: 'simulated',
      isLoading: true,
    };
  }

  return {
    candles: getCandlesForSymbol(symInfo.ticker, timeframe, 320),
    dataSource: 'simulated',
    isLoading: false,
  };
}

function cloneIndicatorPreset(
  type: IndicatorConfig['type'],
  suffix: string,
): IndicatorConfig {
  const preset =
    DEFAULT_INDICATOR_PRESETS.find((p) => p.type === type) ??
    DEFAULT_INDICATOR_PRESETS[0];
  return {
    ...preset,
    id: `${preset.id}-${suffix}`,
    params: { ...preset.params },
    styles: Object.fromEntries(
      Object.entries(preset.styles).map(([k, v]) => [k, { ...v }]),
    ),
  };
}

export function cloneIndicatorConfig(ind: IndicatorConfig): IndicatorConfig {
  return {
    ...ind,
    params: { ...ind.params },
    styles: Object.fromEntries(
      Object.entries(ind.styles).map(([k, v]) => [k, { ...v }]),
    ),
    visibleTimeframes: ind.visibleTimeframes
      ? [...ind.visibleTimeframes]
      : undefined,
  };
}

export function cloneChartPane(pane: ChartPaneState): ChartPaneState {
  return {
    ...pane,
    indicators: pane.indicators.map(cloneIndicatorConfig),
    compareSymbols: [...pane.compareSymbols],
  };
}

export function cloneDrawingsMap(
  map: Record<string, DrawingObject[]>,
): Record<string, DrawingObject[]> {
  const out: Record<string, DrawingObject[]> = {};
  for (const [k, list] of Object.entries(map)) {
    const sym = normalizeSymbolTicker(k);
    const cloned = list.map((d) => ({
      ...d,
      symbol: sym,
      points: d.points.map((pt) => ({ ...pt })),
      style: { ...d.style },
      fibLevels: d.fibLevels ? [...d.fibLevels] : undefined,
      visibleTimeframes: d.visibleTimeframes
        ? [...d.visibleTimeframes]
        : undefined,
    }));
    if (out[sym]) {
      const existingIds = new Set(out[sym].map((item) => item.id));
      for (const item of cloned) {
        if (!existingIds.has(item.id)) {
          out[sym].push(item);
          existingIds.add(item.id);
        }
      }
    } else {
      out[sym] = cloned;
    }
  }
  return out;
}

export function createDefaultPane(
  id: string,
  symbolId: string,
  timeframe: ChartPaneState['timeframe'] = '1D',
  withDefaultIndicators = false,
): ChartPaneState {
  return {
    id,
    symbolId: normalizeSymbolTicker(symbolId),
    timeframe,
    chartType: 'candles',
    indicators: withDefaultIndicators
      ? [cloneIndicatorPreset('SMA', `${id}-sma`)]
      : [],
    compareSymbols: [],
    scaleMode: 'regular',
    autoScale: true,
    invertScale: false,
    lockPriceToBarRatio: false,
    priceScalePosition: 'right',
    showVolume: true,
    showGrid: true,
    showBuySellButtons: true,
    countdownVisible: true,
    rangePreset: '6M',
  };
}

export function createDefaultPanes(initialSymbol = 'FTSEMIB'): ChartPaneState[] {
  const primary = normalizeSymbolTicker(initialSymbol);
  return [
    createDefaultPane('pane-1', primary, '1D', true),
    createDefaultPane(
      'pane-2',
      primary === 'RACE' ? 'FTSEMIB' : 'RACE',
      '1D',
      false,
    ),
    createDefaultPane(
      'pane-3',
      primary === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT',
      '1H',
      false,
    ),
    createDefaultPane('pane-4', primary === 'SPX' ? 'NVDA' : 'SPX', '1D', false),
  ];
}

/**
 * Aligns a pane's mirrored scale & canvas display fields with persisted `ChartSettings`
 * so reloading never produces a UI-vs-Canvas desync.
 */
export function syncPaneWithChartSettings(
  pane: ChartPaneState,
  settings: ChartSettings,
): ChartPaneState {
  return {
    ...pane,
    scaleMode: settings.scales.mode,
    invertScale: settings.scales.invertScale,
    lockPriceToBarRatio: settings.scales.lockPriceToBarRatio,
    priceScalePosition: settings.scales.position,
    countdownVisible: settings.scales.showCountdown,
    showGrid: settings.canvas.gridMode !== 'none',
    showBuySellButtons: settings.statusLine.showBuySellButtons,
  };
}

function sanitizeIndicatorConfig(raw: unknown): IndicatorConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<IndicatorConfig>;
  if (
    typeof obj.id !== 'string' ||
    !obj.id ||
    typeof obj.type !== 'string' ||
    typeof obj.name !== 'string'
  ) {
    return null;
  }
  const styles: Record<string, IndicatorConfig['styles'][string]> = {};
  if (obj.styles && typeof obj.styles === 'object') {
    for (const [k, spec] of Object.entries(obj.styles)) {
      if (spec && typeof spec === 'object' && typeof spec.color === 'string') {
        styles[k] = {
          color: spec.color,
          lineWidth:
            typeof spec.lineWidth === 'number' && Number.isFinite(spec.lineWidth)
              ? spec.lineWidth
              : undefined,
          lineStyle:
            spec.lineStyle === 'solid' ||
            spec.lineStyle === 'dashed' ||
            spec.lineStyle === 'dotted'
              ? spec.lineStyle
              : undefined,
          opacity:
            typeof spec.opacity === 'number' && Number.isFinite(spec.opacity)
              ? spec.opacity
              : undefined,
        };
      }
    }
  }
  const params: Record<string, number | string> = {};
  if (obj.params && typeof obj.params === 'object') {
    for (const [k, v] of Object.entries(obj.params)) {
      if (typeof v === 'number' || typeof v === 'string') {
        params[k] = v;
      }
    }
  }
  const visibleTimeframes = Array.isArray(obj.visibleTimeframes)
    ? obj.visibleTimeframes.filter((tf): tf is Timeframe =>
        VALID_TIMEFRAMES.has(tf as Timeframe),
      )
    : undefined;

  return {
    id: obj.id,
    type: obj.type,
    name: obj.name,
    shortName: typeof obj.shortName === 'string' ? obj.shortName : undefined,
    visible: typeof obj.visible === 'boolean' ? obj.visible : true,
    pane: obj.pane === 'separate' ? 'separate' : 'overlay',
    params,
    styles,
    lineStyle:
      obj.lineStyle === 'solid' ||
      obj.lineStyle === 'dashed' ||
      obj.lineStyle === 'dotted'
        ? obj.lineStyle
        : undefined,
    visibleTimeframes,
  };
}

export function sanitizePane(
  raw: unknown,
  fallback: ChartPaneState,
): ChartPaneState {
  if (!raw || typeof raw !== 'object') return cloneChartPane(fallback);
  const obj = raw as Partial<ChartPaneState>;

  const indicators = Array.isArray(obj.indicators)
    ? obj.indicators
        .map(sanitizeIndicatorConfig)
        .filter((x): x is IndicatorConfig => x !== null)
    : fallback.indicators.map(cloneIndicatorConfig);

  const compareSymbols = Array.isArray(obj.compareSymbols)
    ? Array.from(
        new Set(
          obj.compareSymbols
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map(normalizeSymbolTicker),
        ),
      )
    : [];

  const timeframe =
    typeof obj.timeframe === 'string' && VALID_TIMEFRAMES.has(obj.timeframe as Timeframe)
      ? (obj.timeframe as Timeframe)
      : fallback.timeframe;

  const scaleMode =
    typeof obj.scaleMode === 'string' && VALID_SCALE_MODES.has(obj.scaleMode as ScaleMode)
      ? (obj.scaleMode as ScaleMode)
      : fallback.scaleMode;

  const rangePreset =
    typeof obj.rangePreset === 'string' &&
    VALID_RANGE_PRESETS.has(obj.rangePreset as RangePreset)
      ? (obj.rangePreset as RangePreset)
      : fallback.rangePreset;

  const priceScalePosition: PriceScalePosition =
    obj.priceScalePosition === 'left' || obj.priceScalePosition === 'right'
      ? obj.priceScalePosition
      : fallback.priceScalePosition;

  const symbolId =
    typeof obj.symbolId === 'string' && obj.symbolId.trim().length > 0
      ? normalizeSymbolTicker(obj.symbolId)
      : fallback.symbolId;

  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : fallback.id,
    symbolId,
    timeframe,
    chartType:
      typeof obj.chartType === 'string' && obj.chartType
        ? (obj.chartType as ChartType)
        : fallback.chartType,
    indicators,
    compareSymbols: compareSymbols.filter((s) => s !== symbolId),
    scaleMode,
    autoScale: typeof obj.autoScale === 'boolean' ? obj.autoScale : fallback.autoScale,
    invertScale:
      typeof obj.invertScale === 'boolean' ? obj.invertScale : fallback.invertScale,
    lockPriceToBarRatio:
      typeof obj.lockPriceToBarRatio === 'boolean'
        ? obj.lockPriceToBarRatio
        : fallback.lockPriceToBarRatio,
    priceScalePosition,
    showVolume:
      typeof obj.showVolume === 'boolean' ? obj.showVolume : fallback.showVolume,
    showGrid: typeof obj.showGrid === 'boolean' ? obj.showGrid : fallback.showGrid,
    showBuySellButtons:
      typeof obj.showBuySellButtons === 'boolean'
        ? obj.showBuySellButtons
        : fallback.showBuySellButtons,
    countdownVisible:
      typeof obj.countdownVisible === 'boolean'
        ? obj.countdownVisible
        : fallback.countdownVisible,
    rangePreset,
  };
}

/**
 * Slices candles for active Bar Replay mode.
 * Returns the full series when replay is inactive.
 */
export function sliceCandlesForReplay(
  candles: readonly Candle[],
  replay: ReplayState,
): Candle[] {
  if (!replay.active || candles.length === 0) {
    return candles as Candle[];
  }
  const endIdx = Math.max(0, Math.min(candles.length - 1, replay.barIndex));
  return candles.slice(0, endIdx + 1);
}

/**
 * Maps a bottom toolbar RangePreset (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, ALL)
 * to a suggested bar count slice for viewport zooming.
 */
export function getVisibleBarCountForRange(
  preset: RangePreset,
  totalBars: number,
): number {
  switch (preset) {
    case '1D':
      return Math.min(totalBars, 30);
    case '5D':
      return Math.min(totalBars, 50);
    case '1M':
      return Math.min(totalBars, 65);
    case '3M':
      return Math.min(totalBars, 95);
    case '6M':
      return Math.min(totalBars, 140);
    case 'YTD':
      return Math.min(totalBars, 180);
    case '1Y':
      return Math.min(totalBars, 240);
    case '5Y':
    case 'ALL':
      return totalBars;
  }
}

/**
 * Computes all visible IndicatorSeries for the active pane,
 * honoring optional `visibleTimeframes` and `lineStyle`, and
 * optionally appending plots & hlines from an applied Pine Script.
 */
export function computePaneIndicatorSeries(
  candles: readonly Candle[],
  indicators: readonly IndicatorConfig[],
  appliedPine: PineExecutionResult | null,
  activeTimeframe?: Timeframe,
): IndicatorSeries[] {
  const series: IndicatorSeries[] = [];

  for (const cfg of indicators) {
    if (!cfg.visible) continue;
    if (
      activeTimeframe &&
      cfg.visibleTimeframes &&
      cfg.visibleTimeframes.length > 0 &&
      !cfg.visibleTimeframes.includes(activeTimeframe)
    ) {
      continue;
    }
    const computed = computeIndicatorSeries(candles, cfg);
    if (cfg.lineStyle) {
      series.push({
        ...computed,
        plots: computed.plots.map((p) => ({
          ...p,
          lineStyle: p.lineStyle ?? cfg.lineStyle,
        })),
      });
    } else {
      series.push(computed);
    }
  }

  if (
    appliedPine &&
    appliedPine.ok &&
    (appliedPine.plots.length > 0 || appliedPine.hlines.length > 0)
  ) {
    const overlayPlots = appliedPine.plots.filter((p) => p.pane === 'overlay');
    const separatePlots = appliedPine.plots.filter((p) => p.pane === 'separate');

    if (
      overlayPlots.length > 0 ||
      (appliedPine.overlay && appliedPine.hlines.length > 0)
    ) {
      series.push({
        id: 'pine-overlay-series',
        configId: 'pine-overlay',
        type: 'PINE',
        title: `${appliedPine.scriptName} (Pine)`,
        pane: 'overlay',
        plots: overlayPlots.map((p) => ({
          key: p.id,
          label: p.title,
          kind: 'line',
          color: p.color,
          lineWidth: p.lineWidth,
          data: p.data,
        })),
        hlines: appliedPine.overlay
          ? appliedPine.hlines.map((h) => ({
              value: h.value,
              label: h.title,
              color: h.color,
              lineStyle: h.lineStyle,
            }))
          : undefined,
      });
    }

    if (
      separatePlots.length > 0 ||
      (!appliedPine.overlay && appliedPine.hlines.length > 0)
    ) {
      series.push({
        id: 'pine-separate-series',
        configId: 'pine-separate',
        type: 'PINE',
        title: `${appliedPine.scriptName} (Pine)`,
        pane: 'separate',
        plots: separatePlots.map((p) => ({
          key: p.id,
          label: p.title,
          kind: 'line',
          color: p.color,
          lineWidth: p.lineWidth,
          data: p.data,
        })),
        hlines: !appliedPine.overlay
          ? appliedPine.hlines.map((h) => ({
              value: h.value,
              label: h.title,
              color: h.color,
              lineStyle: h.lineStyle,
            }))
          : undefined,
      });
    }
  }

  return series;
}

// ======================== DRAWING HISTORY PURE HELPERS ========================

export interface DrawingsBundle {
  drawingsBySymbol: Record<string, DrawingObject[]>;
  historyBySymbol: Record<string, DrawingSymbolHistory>;
}

function normalizeDrawingZIndices(list: DrawingObject[]): DrawingObject[] {
  return list.map((d, idx) => ({ ...d, zIndex: idx + 1 }));
}

function pushDrawingSnapshot(
  bundle: DrawingsBundle,
  symbol: string,
  nextList: DrawingObject[],
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const currentList = bundle.drawingsBySymbol[sym] ?? [];
  const prevHist = bundle.historyBySymbol[sym] ?? { past: [], future: [] };
  const nextPast = [...prevHist.past, currentList].slice(-MAX_DRAWING_HISTORY);

  return {
    drawingsBySymbol: {
      ...bundle.drawingsBySymbol,
      [sym]: nextList,
    },
    historyBySymbol: {
      ...bundle.historyBySymbol,
      [sym]: {
        past: nextPast,
        future: [],
      },
    },
  };
}

export function addDrawingMutation(
  bundle: DrawingsBundle,
  drawing: DrawingObject,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(drawing.symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  const maxZ = current.reduce((acc, item, i) => Math.max(acc, item.zIndex ?? i + 1), 0);
  const normalized: DrawingObject = {
    ...drawing,
    symbol: sym,
    zIndex: drawing.zIndex ?? maxZ + 1,
  };
  return pushDrawingSnapshot(bundle, sym, [...current, normalized]);
}

export function updateDrawingMutation(
  bundle: DrawingsBundle,
  symbol: string,
  drawingId: string,
  patch: Partial<DrawingObject>,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  if (!current.some((d) => d.id === drawingId)) return bundle;
  const nextList = current.map((d) =>
    d.id === drawingId ? { ...d, ...patch, id: d.id, symbol: sym } : d,
  );
  return pushDrawingSnapshot(bundle, sym, nextList);
}

export function deleteDrawingMutation(
  bundle: DrawingsBundle,
  symbol: string,
  drawingId: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  if (!current.some((d) => d.id === drawingId)) return bundle;
  return pushDrawingSnapshot(
    bundle,
    sym,
    current.filter((d) => d.id !== drawingId),
  );
}

let cloneSeq = 1;

/**
 * Clones a drawing with a gentle price offset so it is immediately visible
 * next to the original, assigning a new unique ID and top z-order.
 */
export function cloneDrawingMutation(
  bundle: DrawingsBundle,
  symbol: string,
  drawingId: string,
  newId?: string,
): { bundle: DrawingsBundle; cloned: DrawingObject | null } {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  const source = current.find((d) => d.id === drawingId);
  if (!source) {
    return { bundle, cloned: null };
  }

  const prices = source.points.map((p) => p.price);
  const minP = prices.length > 0 ? Math.min(...prices) : 0;
  const maxP = prices.length > 0 ? Math.max(...prices) : 0;
  const spanP = maxP - minP;
  const priceOffset =
    spanP > 0 ? spanP * 0.08 : Math.max(Math.abs(minP) * 0.005, 0.01);

  cloneSeq += 1;
  const id = newId ?? `drw-clone-${Date.now()}-${cloneSeq}`;
  const maxZ = current.reduce((acc, item, i) => Math.max(acc, item.zIndex ?? i + 1), 0);

  const cloned: DrawingObject = {
    ...source,
    id,
    symbol: sym,
    locked: false,
    visible: true,
    createdAt: Date.now(),
    zIndex: maxZ + 1,
    points: source.points.map((pt) => ({
      time: pt.time,
      price: pt.price + priceOffset,
    })),
    style: { ...source.style },
    fibLevels: source.fibLevels ? [...source.fibLevels] : undefined,
    visibleTimeframes: source.visibleTimeframes
      ? [...source.visibleTimeframes]
      : undefined,
    stopPrice:
      source.stopPrice !== undefined
        ? source.stopPrice + priceOffset
        : undefined,
    targetPrice:
      source.targetPrice !== undefined
        ? source.targetPrice + priceOffset
        : undefined,
  };

  return {
    bundle: pushDrawingSnapshot(bundle, sym, [...current, cloned]),
    cloned,
  };
}

/** Moves a drawing to the top of the visual render stack (highest zIndex) */
export function bringDrawingToFrontMutation(
  bundle: DrawingsBundle,
  symbol: string,
  drawingId: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  const idx = current.findIndex((d) => d.id === drawingId);
  if (idx === -1) return bundle;
  if (idx === current.length - 1 && current[idx].zIndex === current.length) {
    return bundle;
  }
  const reordered = [...current.slice(0, idx), ...current.slice(idx + 1), current[idx]];
  return pushDrawingSnapshot(bundle, sym, normalizeDrawingZIndices(reordered));
}

/** Moves a drawing to the bottom of the visual render stack (lowest zIndex) */
export function sendDrawingToBackMutation(
  bundle: DrawingsBundle,
  symbol: string,
  drawingId: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  const idx = current.findIndex((d) => d.id === drawingId);
  if (idx === -1) return bundle;
  if (idx === 0 && current[0].zIndex === 1) {
    return bundle;
  }
  const reordered = [current[idx], ...current.slice(0, idx), ...current.slice(idx + 1)];
  return pushDrawingSnapshot(bundle, sym, normalizeDrawingZIndices(reordered));
}

export function clearDrawingsMutation(
  bundle: DrawingsBundle,
  symbol: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const current = bundle.drawingsBySymbol[sym] ?? [];
  if (current.length === 0) return bundle;
  return pushDrawingSnapshot(bundle, sym, []);
}

export function undoDrawingMutation(
  bundle: DrawingsBundle,
  symbol: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const hist = bundle.historyBySymbol[sym];
  if (!hist || hist.past.length === 0) return bundle;

  const previous = hist.past[hist.past.length - 1];
  const current = bundle.drawingsBySymbol[sym] ?? [];

  return {
    drawingsBySymbol: {
      ...bundle.drawingsBySymbol,
      [sym]: previous,
    },
    historyBySymbol: {
      ...bundle.historyBySymbol,
      [sym]: {
        past: hist.past.slice(0, -1),
        future: [current, ...hist.future].slice(0, MAX_DRAWING_HISTORY),
      },
    },
  };
}

export function redoDrawingMutation(
  bundle: DrawingsBundle,
  symbol: string,
): DrawingsBundle {
  const sym = normalizeSymbolTicker(symbol);
  const hist = bundle.historyBySymbol[sym];
  if (!hist || hist.future.length === 0) return bundle;

  const next = hist.future[0];
  const current = bundle.drawingsBySymbol[sym] ?? [];

  return {
    drawingsBySymbol: {
      ...bundle.drawingsBySymbol,
      [sym]: next,
    },
    historyBySymbol: {
      ...bundle.historyBySymbol,
      [sym]: {
        past: [...hist.past, current].slice(-MAX_DRAWING_HISTORY),
        future: hist.future.slice(1),
      },
    },
  };
}

// ======================== WATCHLIST PURE HELPERS ========================

export function addSymbolToWatchlistList(
  watchlists: readonly WatchlistGroup[],
  watchlistId: string,
  ticker: string,
): WatchlistGroup[] {
  const sym = normalizeSymbolTicker(ticker);
  return watchlists.map((wl) => {
    if (wl.id !== watchlistId) return wl;
    if (wl.symbols.includes(sym)) return wl;
    return { ...wl, symbols: [...wl.symbols, sym] };
  });
}

export function removeSymbolFromWatchlistList(
  watchlists: readonly WatchlistGroup[],
  watchlistId: string,
  ticker: string,
): WatchlistGroup[] {
  const sym = normalizeSymbolTicker(ticker);
  return watchlists.map((wl) => {
    if (wl.id !== watchlistId) return wl;
    return { ...wl, symbols: wl.symbols.filter((s) => s !== sym) };
  });
}

// ======================== SAFE PERSISTENCE HELPERS ========================

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

export function loadPersistedTheme(storage?: StorageLike): ThemeMode {
  const store = resolveStorage(storage);
  if (!store) return 'dark';
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.theme);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function savePersistedTheme(theme: ThemeMode, storage?: StorageLike): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.theme, theme);
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedChartSettings(
  theme: ThemeMode,
  storage?: StorageLike,
): ChartSettings {
  const defaults = getDefaultChartSettings(theme);
  const store = resolveStorage(storage);
  if (!store) return defaults;
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.chartSettings);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return mergeChartSettings(defaults, parsed as ChartSettingsPatch);
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export function savePersistedChartSettings(
  settings: ChartSettings,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.chartSettings, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedLayoutMode(storage?: StorageLike): LayoutMode {
  const store = resolveStorage(storage);
  if (!store) return '1';
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.layoutMode);
    if (raw && VALID_LAYOUT_MODES.has(raw as LayoutMode)) {
      return raw as LayoutMode;
    }
    return '1';
  } catch {
    return '1';
  }
}

export function savePersistedLayoutMode(
  mode: LayoutMode,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.layoutMode, mode);
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedActivePaneIndex(
  layoutMode: LayoutMode,
  storage?: StorageLike,
): number {
  const maxIdx = Math.max(0, LAYOUT_PANE_COUNTS[layoutMode] - 1);
  const store = resolveStorage(storage);
  if (!store) return 0;
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.activePaneIndex);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= maxIdx) {
      return parsed;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function savePersistedActivePaneIndex(
  index: number,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.activePaneIndex, String(Math.max(0, Math.min(3, index))));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads all 4 persisted chart panes (`tv_it_panes_v1`), syncing pane 0 with `chartSettings`
 * so reload NEVER causes a UI-vs-Canvas mismatch.
 * If `explicitRouteSymbol` is provided (from `#/chart/<SYMBOL>`), overrides pane 0's symbolId
 * while preserving persisted timeframe, chartType, indicators, scale settings, and panes 1..3.
 */
export function loadPersistedPanes(
  explicitRouteSymbol?: string,
  chartSettings?: ChartSettings,
  storage?: StorageLike,
): ChartPaneState[] {
  const defaults = createDefaultPanes(explicitRouteSymbol ?? 'FTSEMIB');
  const store = resolveStorage(storage);

  let hydrated = defaults;
  let loadedFromStorage = false;

  if (store) {
    try {
      const raw = store.getItem(STORE_STORAGE_KEYS.panes);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hydrated = defaults.map((def, idx) => sanitizePane(parsed[idx], def));
          loadedFromStorage = true;
        }
      }
    } catch {
      // Fallback to defaults
    }
  }

  if (chartSettings) {
    // Keep pane 0 synchronized with persisted chartSettings (prevents desync on reload)
    hydrated[0] = syncPaneWithChartSettings(hydrated[0], chartSettings);
    if (!loadedFromStorage) {
      for (let i = 1; i < hydrated.length; i++) {
        hydrated[i] = syncPaneWithChartSettings(hydrated[i], chartSettings);
      }
    }
  }

  if (explicitRouteSymbol) {
    const sym = normalizeSymbolTicker(explicitRouteSymbol);
    hydrated[0] = {
      ...hydrated[0],
      symbolId: sym,
      compareSymbols: hydrated[0].compareSymbols.filter((s) => s !== sym),
    };
  }

  return hydrated;
}

export function savePersistedPanes(
  panes: readonly ChartPaneState[],
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.panes, JSON.stringify(panes));
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedDrawings(
  storage?: StorageLike,
): Record<string, DrawingObject[]> {
  const store = resolveStorage(storage);
  if (!store) return {};
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.drawings);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const normalized: Record<string, DrawingObject[]> = {};
      for (const [rawKey, rawList] of Object.entries(
        parsed as Record<string, unknown>,
      )) {
        if (!Array.isArray(rawList)) continue;
        const sym = normalizeSymbolTicker(rawKey);
        const existing = normalized[sym] ?? [];
        const existingIds = new Set(existing.map((d) => d.id));
        for (const item of rawList) {
          if (!item || typeof item !== 'object') continue;
          const d = item as DrawingObject;
          if (typeof d.id !== 'string' || !d.id || existingIds.has(d.id)) continue;
          existing.push({ ...d, symbol: sym });
          existingIds.add(d.id);
        }
        normalized[sym] = existing;
      }
      return normalized;
    }
    return {};
  } catch {
    return {};
  }
}

export function savePersistedDrawings(
  drawings: Record<string, DrawingObject[]>,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.drawings, JSON.stringify(drawings));
    return true;
  } catch {
    return false;
  }
}

export interface PersistedWorkspacePrefs {
  magnetMode: MagnetMode;
  stayInDrawingMode: boolean;
  lockDrawings: boolean;
  hideMode: HideMode;
  pineCode: string;
  pineAppliedToChart: boolean;
  bottomPanelHeight: number;
  liveCryptoEnabled?: boolean;
}

export function getDefaultWorkspacePrefs(): PersistedWorkspacePrefs {
  return {
    magnetMode: 'off',
    stayInDrawingMode: false,
    lockDrawings: false,
    hideMode: 'none',
    pineCode: PINE_TEMPLATES[0].code,
    pineAppliedToChart: false,
    bottomPanelHeight: 280,
  };
}

export function loadPersistedWorkspacePrefs(
  storage?: StorageLike,
): PersistedWorkspacePrefs {
  const defaults = getDefaultWorkspacePrefs();
  const store = resolveStorage(storage);
  if (!store) return defaults;
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.workspacePrefs);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspacePrefs>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      magnetMode:
        parsed.magnetMode && VALID_MAGNET_MODES.has(parsed.magnetMode)
          ? parsed.magnetMode
          : defaults.magnetMode,
      stayInDrawingMode:
        typeof parsed.stayInDrawingMode === 'boolean'
          ? parsed.stayInDrawingMode
          : defaults.stayInDrawingMode,
      lockDrawings:
        typeof parsed.lockDrawings === 'boolean'
          ? parsed.lockDrawings
          : defaults.lockDrawings,
      hideMode:
        parsed.hideMode && VALID_HIDE_MODES.has(parsed.hideMode)
          ? parsed.hideMode
          : defaults.hideMode,
      pineCode:
        typeof parsed.pineCode === 'string' && parsed.pineCode.length > 0
          ? parsed.pineCode
          : defaults.pineCode,
      pineAppliedToChart:
        typeof parsed.pineAppliedToChart === 'boolean'
          ? parsed.pineAppliedToChart
          : defaults.pineAppliedToChart,
      bottomPanelHeight:
        typeof parsed.bottomPanelHeight === 'number' &&
        Number.isFinite(parsed.bottomPanelHeight)
          ? Math.max(160, Math.min(620, Math.round(parsed.bottomPanelHeight)))
          : defaults.bottomPanelHeight,
      liveCryptoEnabled:
        typeof parsed.liveCryptoEnabled === 'boolean'
          ? parsed.liveCryptoEnabled
          : undefined,
    };
  } catch {
    return defaults;
  }
}

export function savePersistedWorkspacePrefs(
  prefs: PersistedWorkspacePrefs,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.workspacePrefs, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

// ======================== NAMED SAVED LAYOUTS ENGINE ========================

export interface SavedLayoutsStoragePayload {
  savedLayouts: SavedChartLayout[];
  activeLayoutId: string;
  autoSave: boolean;
  lastSavedAt: number | null;
}

export function sanitizeSavedLayout(
  raw: unknown,
  theme: ThemeMode,
): SavedChartLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<SavedChartLayout>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;

  const baseSettings = getDefaultChartSettings(theme);
  const chartSettings =
    obj.chartSettings && typeof obj.chartSettings === 'object'
      ? mergeChartSettings(baseSettings, obj.chartSettings as ChartSettingsPatch)
      : baseSettings;

  const layoutMode: LayoutMode =
    typeof obj.layoutMode === 'string' &&
    VALID_LAYOUT_MODES.has(obj.layoutMode as LayoutMode)
      ? (obj.layoutMode as LayoutMode)
      : '1';

  const maxPaneIdx = Math.max(0, LAYOUT_PANE_COUNTS[layoutMode] - 1);
  const activePaneIndex =
    typeof obj.activePaneIndex === 'number' &&
    Number.isFinite(obj.activePaneIndex)
      ? Math.max(0, Math.min(maxPaneIdx, Math.round(obj.activePaneIndex)))
      : 0;

  const defaultPanes = createDefaultPanes('FTSEMIB');
  const rawPanes = Array.isArray(obj.panes) ? obj.panes : [];
  const panes = defaultPanes.map((def, idx) => sanitizePane(rawPanes[idx], def));
  panes[activePaneIndex] = syncPaneWithChartSettings(
    panes[activePaneIndex],
    chartSettings,
  );

  const drawingsBySymbol =
    obj.drawingsBySymbol &&
    typeof obj.drawingsBySymbol === 'object' &&
    !Array.isArray(obj.drawingsBySymbol)
      ? cloneDrawingsMap(obj.drawingsBySymbol)
      : {};

  return {
    id: obj.id,
    name:
      typeof obj.name === 'string' && obj.name.trim()
        ? obj.name.trim()
        : DEFAULT_LAYOUT_NAME,
    updatedAt:
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt)
        ? obj.updatedAt
        : Date.now(),
    layoutMode,
    activePaneIndex,
    panes,
    chartSettings,
    drawingsBySymbol,
    pineCode:
      typeof obj.pineCode === 'string' && obj.pineCode.length > 0
        ? obj.pineCode
        : PINE_TEMPLATES[0].code,
    pineAppliedToChart: Boolean(obj.pineAppliedToChart),
  };
}

export function loadPersistedLayoutsBundle(
  fallbackLayout: SavedChartLayout,
  theme: ThemeMode,
  storage?: StorageLike,
): SavedLayoutsStoragePayload {
  const defaultPayload: SavedLayoutsStoragePayload = {
    savedLayouts: [fallbackLayout],
    activeLayoutId: fallbackLayout.id,
    autoSave: true,
    lastSavedAt: fallbackLayout.updatedAt,
  };

  const store = resolveStorage(storage);
  if (!store) return defaultPayload;
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.savedLayouts);
    if (!raw) return defaultPayload;
    const parsed = JSON.parse(raw) as Partial<SavedLayoutsStoragePayload>;
    if (!parsed || typeof parsed !== 'object') return defaultPayload;

    const layouts = Array.isArray(parsed.savedLayouts)
      ? parsed.savedLayouts
          .map((item) => sanitizeSavedLayout(item, theme))
          .filter((x): x is SavedChartLayout => x !== null)
      : [];

    if (layouts.length === 0) return defaultPayload;

    const activeLayoutId =
      typeof parsed.activeLayoutId === 'string' &&
      layouts.some((l) => l.id === parsed.activeLayoutId)
        ? parsed.activeLayoutId
        : layouts[0].id;

    return {
      savedLayouts: layouts,
      activeLayoutId,
      autoSave: typeof parsed.autoSave === 'boolean' ? parsed.autoSave : true,
      lastSavedAt:
        typeof parsed.lastSavedAt === 'number' && Number.isFinite(parsed.lastSavedAt)
          ? parsed.lastSavedAt
          : layouts.find((l) => l.id === activeLayoutId)?.updatedAt ?? Date.now(),
    };
  } catch {
    return defaultPayload;
  }
}

export function savePersistedLayoutsBundle(
  payload: SavedLayoutsStoragePayload,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.savedLayouts, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function serializeLayoutForExport(layout: SavedChartLayout): string {
  return JSON.stringify(
    {
      version: 1,
      app: 'tradingview-italia',
      exportedAt: Date.now(),
      layout,
    },
    null,
    2,
  );
}

export function parseImportedLayoutJson(
  json: string,
  theme: ThemeMode,
): { ok: true; layout: SavedChartLayout } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Formato JSON non valido.' };
    }
    const candidate =
      'layout' in (parsed as Record<string, unknown>) &&
      (parsed as { layout?: unknown }).layout &&
      typeof (parsed as { layout?: unknown }).layout === 'object'
        ? (parsed as { layout: Record<string, unknown> }).layout
        : (parsed as Record<string, unknown>);

    if (!Array.isArray(candidate.panes) || candidate.panes.length === 0) {
      return {
        ok: false,
        error: 'Il JSON non contiene un layout grafico valido (campo "panes" mancante).',
      };
    }

    const withFreshId = {
      ...candidate,
      id: `layout-import-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      updatedAt: Date.now(),
    };
    const sanitized = sanitizeSavedLayout(withFreshId, theme);
    if (!sanitized) {
      return { ok: false, error: 'Impossibile validare il layout importato.' };
    }
    return { ok: true, layout: sanitized };
  } catch {
    return { ok: false, error: 'Errore di sintassi JSON durante l’importazione.' };
  }
}

export function loadPersistedFavoriteTools(
  storage?: StorageLike,
): CanonicalDrawingToolType[] {
  const store = resolveStorage(storage);
  if (!store) return [...DEFAULT_FAVORITE_TOOLS];
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.favoriteTools);
    if (!raw) return [...DEFAULT_FAVORITE_TOOLS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_FAVORITE_TOOLS];
    const out: CanonicalDrawingToolType[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const norm = normalizeDrawingTool(item as DrawingToolType);
      if (norm in DRAWING_TOOL_REGISTRY && !out.includes(norm)) {
        out.push(norm);
      }
    }
    return out;
  } catch {
    return [...DEFAULT_FAVORITE_TOOLS];
  }
}

export function savePersistedFavoriteTools(
  tools: readonly CanonicalDrawingToolType[],
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.favoriteTools, JSON.stringify(tools));
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedShowFavoritesBar(storage?: StorageLike): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    return store.getItem(STORE_STORAGE_KEYS.showFavoritesBar) === '1';
  } catch {
    return false;
  }
}

export function savePersistedShowFavoritesBar(
  show: boolean,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.showFavoritesBar, show ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedWatchlists(storage?: StorageLike): WatchlistGroup[] {
  const store = resolveStorage(storage);
  if (!store) return DEFAULT_WATCHLISTS.map((w) => ({ ...w, symbols: [...w.symbols] }));
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.watchlists);
    if (!raw) return DEFAULT_WATCHLISTS.map((w) => ({ ...w, symbols: [...w.symbols] }));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as WatchlistGroup[];
    }
    return DEFAULT_WATCHLISTS.map((w) => ({ ...w, symbols: [...w.symbols] }));
  } catch {
    return DEFAULT_WATCHLISTS.map((w) => ({ ...w, symbols: [...w.symbols] }));
  }
}

export function savePersistedWatchlists(
  watchlists: readonly WatchlistGroup[],
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.watchlists, JSON.stringify(watchlists));
    return true;
  } catch {
    return false;
  }
}

export function loadPersistedActiveWatchlistId(
  watchlists: readonly WatchlistGroup[],
  storage?: StorageLike,
): string {
  const fallback = watchlists[0]?.id ?? DEFAULT_WATCHLISTS[0].id;
  const store = resolveStorage(storage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(STORE_STORAGE_KEYS.activeWatchlist);
    if (raw && watchlists.some((w) => w.id === raw)) return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

export function savePersistedActiveWatchlistId(
  id: string,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(STORE_STORAGE_KEYS.activeWatchlist, id);
    return true;
  } catch {
    return false;
  }
}
