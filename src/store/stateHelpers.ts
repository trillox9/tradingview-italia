import {
  DRAWING_TOOL_REGISTRY,
  getDefaultChartSettings,
  mergeChartSettings,
  normalizeDrawingTool,
  type Candle,
  type CanonicalDrawingToolType,
  type ChartSettings,
  type ChartSettingsPatch,
  type DataSourceKind,
  type DrawingObject,
  type DrawingToolType,
  type IndicatorConfig,
  type IndicatorSeries,
  type PineExecutionResult,
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
  computeIndicatorSeries,
  type StorageLike,
} from '../engine';
import type {
  ChartPaneState,
  DrawingSymbolHistory,
  LayoutMode,
  ModalState,
  RangePreset,
  ReplayState,
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

function cloneIndicatorPreset(type: IndicatorConfig['type'], suffix: string): IndicatorConfig {
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
    createDefaultPane('pane-2', primary === 'RACE' ? 'FTSEMIB' : 'RACE', '1D', false),
    createDefaultPane('pane-3', primary === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT', '1H', false),
    createDefaultPane('pane-4', primary === 'SPX' ? 'NVDA' : 'SPX', '1D', false),
  ];
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
 * optionally appending plots & hlines from an applied Pine Script.
 */
export function computePaneIndicatorSeries(
  candles: readonly Candle[],
  indicators: readonly IndicatorConfig[],
  appliedPine: PineExecutionResult | null,
): IndicatorSeries[] {
  const series: IndicatorSeries[] = [];

  for (const cfg of indicators) {
    if (!cfg.visible) continue;
    series.push(computeIndicatorSeries(candles, cfg));
  }

  if (appliedPine && appliedPine.ok && (appliedPine.plots.length > 0 || appliedPine.hlines.length > 0)) {
    const overlayPlots = appliedPine.plots.filter((p) => p.pane === 'overlay');
    const separatePlots = appliedPine.plots.filter((p) => p.pane === 'separate');

    if (overlayPlots.length > 0 || (appliedPine.overlay && appliedPine.hlines.length > 0)) {
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

    if (separatePlots.length > 0 || (!appliedPine.overlay && appliedPine.hlines.length > 0)) {
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
      return parsed as Record<string, DrawingObject[]>;
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
