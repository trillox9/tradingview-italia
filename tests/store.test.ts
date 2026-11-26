import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getDefaultChartSettings,
  mergeChartSettings,
  type DrawingObject,
} from '../src/types';
import snapshotJson from '../public/real-market-snapshot.json';
import {
  DEFAULT_WATCHLISTS,
  MarketFeed,
  clearRealMarketCaches,
  getCandlesForSymbol,
  parseRealSnapshot,
  setLoadedSnapshotForTest,
} from '../src/data';
import {
  DEFAULT_INDICATOR_PRESETS,
  PINE_TEMPLATES,
  evaluatePineScript,
} from '../src/engine';
import {
  DEFAULT_FAVORITE_TOOLS,
  DEFAULT_LAYOUT_ID,
  DEFAULT_LAYOUT_NAME,
  INITIAL_REPLAY_STATE,
  LAYOUT_PANE_COUNTS,
  TradingViewProvider,
  addDrawingMutation,
  addSymbolToWatchlistList,
  bringDrawingToFrontMutation,
  buildRouteHash,
  clearDrawingsMutation,
  cloneDrawingMutation,
  computePaneIndicatorSeries,
  createDefaultPanes,
  deleteDrawingMutation,
  getVisibleBarCountForRange,
  loadPersistedActivePaneIndex,
  loadPersistedActiveWatchlistId,
  loadPersistedChartSettings,
  loadPersistedDrawings,
  loadPersistedFavoriteTools,
  loadPersistedLayoutMode,
  loadPersistedLayoutsBundle,
  loadPersistedPanes,
  loadPersistedShowFavoritesBar,
  loadPersistedTheme,
  loadPersistedWatchlists,
  loadPersistedWorkspacePrefs,
  navigateTo,
  normalizeSymbolTicker,
  parseImportedLayoutJson,
  parseRoute,
  redoDrawingMutation,
  removeSymbolFromWatchlistList,
  resolveInitialPaneSeriesState,
  resolveSymbolInfo,
  savePersistedActivePaneIndex,
  savePersistedActiveWatchlistId,
  savePersistedChartSettings,
  savePersistedDrawings,
  savePersistedFavoriteTools,
  savePersistedLayoutMode,
  savePersistedLayoutsBundle,
  savePersistedPanes,
  savePersistedShowFavoritesBar,
  savePersistedTheme,
  savePersistedWatchlists,
  savePersistedWorkspacePrefs,
  sendDrawingToBackMutation,
  serializeLayoutForExport,
  sliceCandlesForReplay,
  undoDrawingMutation,
  updateDrawingMutation,
  useActivePane,
  useAlerts,
  useDrawings,
  usePaperTrading,
  useQuotes,
  useSymbolQuote,
  useTradingView,
  useWatchlists,
  type DrawingsBundle,
  type SavedChartLayout,
} from '../src/store';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('Supercharts-First Router (src/store/router.ts)', () => {
  it('defaults root and unknown routes directly to Supercharts while supporting chart symbols and tool views', () => {
    expect(parseRoute('')).toEqual({ view: 'chart' });
    expect(parseRoute('#/')).toEqual({ view: 'chart' });
    expect(parseRoute('#/chart')).toEqual({ view: 'chart' });
    expect(parseRoute('#/chart/FTSEMIB')).toEqual({
      view: 'chart',
      symbolId: 'FTSEMIB',
    });
    expect(parseRoute('#/chart/MIL:RACE')).toEqual({
      view: 'chart',
      symbolId: 'RACE',
    });
    expect(parseRoute('#/chart/COMEX%3AGC1!')).toEqual({
      view: 'chart',
      symbolId: 'GC1!',
    });
    // Shorthand direct ticker hash opens directly in Supercharts
    expect(parseRoute('#/BTCUSDT')).toEqual({
      view: 'chart',
      symbolId: 'BTCUSDT',
    });
    expect(parseRoute('#/screener')).toEqual({ view: 'screener' });
    expect(parseRoute('#/heatmap')).toEqual({ view: 'heatmap' });
    expect(parseRoute('#/unknown-route')).toEqual({ view: 'chart' });
  });

  it('builds clean hash URLs and returns normalized routes from navigateTo', () => {
    expect(buildRouteHash('chart')).toBe('#/');
    expect(buildRouteHash('screener')).toBe('#/screener');
    expect(buildRouteHash('chart', 'MIL:RACE')).toBe('#/chart/RACE');
    expect(buildRouteHash('chart', 'GC1!')).toBe('#/chart/GC1!');

    expect(navigateTo('chart', 'MIL:UCG')).toEqual({
      view: 'chart',
      symbolId: 'UCG',
    });
    expect(navigateTo('heatmap')).toEqual({ view: 'heatmap' });
  });
});

describe('Store Pure Helpers, ChartSettings & Pro Drawing Mutations (src/store/stateHelpers.ts)', () => {
  it('creates 4 default panes with scale controls, normalizes tickers, and maps layout counts', () => {
    expect(LAYOUT_PANE_COUNTS).toEqual({ '1': 1, '2h': 2, '2v': 2, '4': 4 });
    expect(normalizeSymbolTicker('MIL:RACE')).toBe('RACE');
    expect(normalizeSymbolTicker('nonexistent')).toBe('FTSEMIB');
    expect(resolveSymbolInfo('BTCUSDT').exchange).toBe('BINANCE');

    const panes = createDefaultPanes('MIL:RACE');
    expect(panes).toHaveLength(4);
    expect(panes[0].symbolId).toBe('RACE');
    expect(panes[0].indicators.length).toBeGreaterThan(0);
    expect(panes[0].invertScale).toBe(false);
    expect(panes[0].lockPriceToBarRatio).toBe(false);
    expect(panes[0].priceScalePosition).toBe('right');
    // Avoid duplicating primary symbol in pane 2
    expect(panes[1].symbolId).toBe('FTSEMIB');
  });

  it('eliminates simulated candle flash in browser mode until real cache/snapshot is ready', () => {
    clearRealMarketCaches();

    // Browser mode with cold cache: live crypto & Yahoo stocks start empty + loading (ZERO fake flash!)
    const coldCrypto = resolveInitialPaneSeriesState('BTCUSDT', '1D', false);
    expect(coldCrypto.candles).toEqual([]);
    expect(coldCrypto.isLoading).toBe(true);

    const coldStock = resolveInitialPaneSeriesState('RACE', '1D', false);
    expect(coldStock.candles).toEqual([]);
    expect(coldStock.isLoading).toBe(true);

    // Once real Yahoo snapshot is hydrated, 1D/1W/1M open instantaneously with real snapshot bars (no spinner, no fake flash)
    const parsedSnap = parseRealSnapshot(snapshotJson);
    setLoadedSnapshotForTest(parsedSnap);
    const hydratedDaily = resolveInitialPaneSeriesState('RACE', '1D', false);
    expect(hydratedDaily.isLoading).toBe(false);
    expect(hydratedDaily.dataSource).toBe('snapshot');
    expect(hydratedDaily.candles.length).toBeGreaterThan(100);

    // Intraday Yahoo timeframe without live cache stays loading (zero fake flash)
    const coldIntraday = resolveInitialPaneSeriesState('RACE', '15m', false);
    expect(coldIntraday.candles).toEqual([]);
    expect(coldIntraday.isLoading).toBe(true);

    clearRealMarketCaches();

    // Vitest deterministic mode stays synchronous with 320 bars and isLoading=false
    const testMode = resolveInitialPaneSeriesState('BTCUSDT', '1D', true);
    expect(testMode.candles).toHaveLength(320);
    expect(testMode.isLoading).toBe(false);
  });

  it('merges and persists authentic 6-tab ChartSettings per theme', () => {
    const darkDefaults = getDefaultChartSettings('dark');
    const lightDefaults = getDefaultChartSettings('light');
    expect(darkDefaults.canvas.bgColor).toBe('#000000');
    expect(lightDefaults.canvas.bgColor).toBe('#FFFFFF');

    const patched = mergeChartSettings(darkDefaults, {
      symbol: { candleUpColor: '#00E676', showWicks: false },
      scales: { mode: 'indexed100', invertScale: true, position: 'left' },
      canvas: { gridMode: 'horz', showWatermark: false },
      alerts: { showAlertLines: false },
    });
    expect(patched.symbol.candleUpColor).toBe('#00E676');
    expect(patched.symbol.showWicks).toBe(false);
    expect(patched.symbol.candleDownColor).toBe(darkDefaults.symbol.candleDownColor);
    expect(patched.scales.mode).toBe('indexed100');
    expect(patched.scales.invertScale).toBe(true);
    expect(patched.scales.position).toBe('left');
    expect(patched.canvas.gridMode).toBe('horz');
    expect(patched.alerts.showAlertLines).toBe(false);

    const mem = createMemoryStorage();
    savePersistedChartSettings(patched, mem);
    const reloaded = loadPersistedChartSettings('dark', mem);
    expect(reloaded.symbol.candleUpColor).toBe('#00E676');
    expect(reloaded.scales.mode).toBe('indexed100');
    expect(reloaded.scales.position).toBe('left');
  });

  it('slices candles accurately for Bar Replay and Range Presets', () => {
    const candles = getCandlesForSymbol('FTSEMIB', '1D', 100);
    expect(sliceCandlesForReplay(candles, INITIAL_REPLAY_STATE)).toHaveLength(100);

    const replayed = sliceCandlesForReplay(candles, {
      active: true,
      barIndex: 39,
      playing: false,
      speedMs: 500,
    });
    expect(replayed).toHaveLength(40);
    expect(replayed[39]).toEqual(candles[39]);

    expect(getVisibleBarCountForRange('1D', 320)).toBe(30);
    expect(getVisibleBarCountForRange('ALL', 320)).toBe(320);
  });

  it('computes combined indicatorSeries for visible indicators and applied Pine scripts', () => {
    const candles = getCandlesForSymbol('BTCUSDT', '1D', 150);
    const sma = { ...DEFAULT_INDICATOR_PRESETS[0], visible: true };
    const hiddenEma = { ...DEFAULT_INDICATOR_PRESETS[1], visible: false };
    const pineRes = evaluatePineScript(PINE_TEMPLATES[0].code, candles);

    const series = computePaneIndicatorSeries(candles, [sma, hiddenEma], pineRes);
    expect(series.some((s) => s.type === 'SMA')).toBe(true);
    expect(series.some((s) => s.type === 'EMA')).toBe(false);
    expect(series.some((s) => s.type === 'PINE')).toBe(true);
  });

  it('supports per-symbol drawing CRUD, cloning, z-order (front/back), and undo/redo history', () => {
    let bundle: DrawingsBundle = { drawingsBySymbol: {}, historyBySymbol: {} };
    const d1: DrawingObject = {
      id: 'drw-1',
      symbol: 'MIL:RACE',
      type: 'trendline',
      points: [
        { time: 100, price: 420 },
        { time: 200, price: 450 },
      ],
      style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
      locked: true,
      visible: true,
      createdAt: 1,
    };
    const d2: DrawingObject = { ...d1, id: 'drw-2', symbol: 'BTCUSDT', locked: false };

    bundle = addDrawingMutation(bundle, d1);
    bundle = addDrawingMutation(bundle, d2);
    expect(bundle.drawingsBySymbol.RACE).toHaveLength(1);
    expect(bundle.drawingsBySymbol.BTCUSDT).toHaveLength(1);

    // Clone RACE drawing -> unlocked copy with offset price & new ID
    const cloneOut = cloneDrawingMutation(bundle, 'RACE', 'drw-1', 'drw-1-copy');
    bundle = cloneOut.bundle;
    expect(cloneOut.cloned).not.toBeNull();
    expect(cloneOut.cloned!.id).toBe('drw-1-copy');
    expect(cloneOut.cloned!.locked).toBe(false);
    expect(cloneOut.cloned!.points[0].price).toBeGreaterThan(420);
    expect(bundle.drawingsBySymbol.RACE).toHaveLength(2);

    // Z-order: bring drw-1 to front, then send drw-1 to back
    bundle = bringDrawingToFrontMutation(bundle, 'RACE', 'drw-1');
    expect(bundle.drawingsBySymbol.RACE.map((d) => d.id)).toEqual(['drw-1-copy', 'drw-1']);
    expect(bundle.drawingsBySymbol.RACE[1].zIndex).toBe(2);

    bundle = sendDrawingToBackMutation(bundle, 'RACE', 'drw-1');
    expect(bundle.drawingsBySymbol.RACE.map((d) => d.id)).toEqual(['drw-1', 'drw-1-copy']);
    expect(bundle.drawingsBySymbol.RACE[0].zIndex).toBe(1);

    // Undo z-order brings drw-1 back to front; BTCUSDT untouched
    bundle = undoDrawingMutation(bundle, 'RACE');
    expect(bundle.drawingsBySymbol.RACE.map((d) => d.id)).toEqual(['drw-1-copy', 'drw-1']);
    expect(bundle.drawingsBySymbol.BTCUSDT).toHaveLength(1);

    // Update, undo, redo
    bundle = updateDrawingMutation(bundle, 'RACE', 'drw-1', { text: 'Supporto chiave' });
    expect(bundle.drawingsBySymbol.RACE[1].text).toBe('Supporto chiave');
    bundle = undoDrawingMutation(bundle, 'RACE');
    expect(bundle.drawingsBySymbol.RACE[1].text).toBeUndefined();
    bundle = redoDrawingMutation(bundle, 'RACE');
    expect(bundle.drawingsBySymbol.RACE[1].text).toBe('Supporto chiave');

    // Delete & clear
    bundle = deleteDrawingMutation(bundle, 'RACE', 'drw-1');
    expect(bundle.drawingsBySymbol.RACE).toHaveLength(1);
    bundle = clearDrawingsMutation(bundle, 'RACE');
    expect(bundle.drawingsBySymbol.RACE).toHaveLength(0);
  });

  it('persists watchlists, theme, drawings, favorite tools, and favorites bar toggle', () => {
    let list = DEFAULT_WATCHLISTS;
    const wlId = list[0].id;
    list = addSymbolToWatchlistList(list, wlId, 'MIL:RACE');
    const afterFirstAdd = list[0].symbols.length;
    list = addSymbolToWatchlistList(list, wlId, 'RACE'); // duplicate ignored
    expect(list[0].symbols.length).toBe(afterFirstAdd);
    list = removeSymbolFromWatchlistList(list, wlId, 'RACE');
    expect(list[0].symbols).not.toContain('RACE');

    const mem = createMemoryStorage();
    expect(loadPersistedTheme(mem)).toBe('dark');
    savePersistedTheme('light', mem);
    expect(loadPersistedTheme(mem)).toBe('light');

    savePersistedDrawings({ RACE: [] }, mem);
    expect(loadPersistedDrawings(mem)).toEqual({ RACE: [] });

    expect(loadPersistedFavoriteTools(mem)).toEqual(DEFAULT_FAVORITE_TOOLS);
    savePersistedFavoriteTools(['trendline', 'pitchfork', 'volume_profile_fixed'], mem);
    expect(loadPersistedFavoriteTools(mem)).toEqual([
      'trendline',
      'pitchfork',
      'volume_profile_fixed',
    ]);

    expect(loadPersistedShowFavoritesBar(mem)).toBe(false);
    savePersistedShowFavoritesBar(true, mem);
    expect(loadPersistedShowFavoritesBar(mem)).toBe(true);

    savePersistedWatchlists(list, mem);
    expect(loadPersistedWatchlists(mem)).toHaveLength(list.length);
    savePersistedActiveWatchlistId(list[1].id, mem);
    expect(loadPersistedActiveWatchlistId(list, mem)).toBe(list[1].id);
  });

  it('persists full panes (including removed/edited indicators, timeframe, chartType, scale, layoutMode), normalized drawings, and workspace prefs cleanly across reload', () => {
    const mem = createMemoryStorage();

    // Build modified multi-chart panes: remove SMA from pane 0, add customized RSI, switch to 1H Heikin Ashi, compare ETHUSDT
    const rsiPreset = DEFAULT_INDICATOR_PRESETS.find((p) => p.type === 'RSI')!;
    const customRsi = {
      ...rsiPreset,
      id: 'rsi-custom-1',
      params: { ...rsiPreset.params, period: 21 },
      lineStyle: 'dashed' as const,
      visibleTimeframes: ['1H', '4H', '1D'] as ('1H' | '4H' | '1D')[],
    };

    const panes = createDefaultPanes('BTCUSDT');
    panes[0] = {
      ...panes[0],
      timeframe: '1H',
      chartType: 'heikin_ashi',
      indicators: [customRsi],
      compareSymbols: ['ETHUSDT'],
      scaleMode: 'log',
      invertScale: true,
      priceScalePosition: 'left',
      autoScale: false,
      lockPriceToBarRatio: true,
    };
    panes[1] = {
      ...panes[1],
      symbolId: 'NVDA',
      timeframe: '15m',
      indicators: [], // explicitly empty indicators must remain empty!
    };

    const settings = mergeChartSettings(getDefaultChartSettings('dark'), {
      scales: {
        mode: 'log',
        invertScale: true,
        position: 'left',
        lockPriceToBarRatio: true,
      },
    });

    savePersistedChartSettings(settings, mem);
    savePersistedPanes(panes, mem);
    savePersistedLayoutMode('2v', mem);
    savePersistedActivePaneIndex(1, mem);

    // Reload on root #/ (no explicit route symbol) -> restores BTCUSDT, 1H, heikin_ashi, custom RSI, empty pane 1 indicators, 2v layout
    const reloadedSettings = loadPersistedChartSettings('dark', mem);
    const reloadedPanes = loadPersistedPanes(undefined, reloadedSettings, mem);
    expect(reloadedPanes[0].symbolId).toBe('BTCUSDT');
    expect(reloadedPanes[0].timeframe).toBe('1H');
    expect(reloadedPanes[0].chartType).toBe('heikin_ashi');
    expect(reloadedPanes[0].indicators).toHaveLength(1);
    expect(reloadedPanes[0].indicators[0].params.period).toBe(21);
    expect(reloadedPanes[0].indicators[0].lineStyle).toBe('dashed');
    expect(reloadedPanes[0].indicators[0].visibleTimeframes).toEqual(['1H', '4H', '1D']);
    expect(reloadedPanes[0].compareSymbols).toEqual(['ETHUSDT']);
    expect(reloadedPanes[0].scaleMode).toBe('log');
    expect(reloadedPanes[0].invertScale).toBe(true);
    expect(reloadedPanes[0].priceScalePosition).toBe('left');
    expect(reloadedPanes[1].symbolId).toBe('NVDA');
    expect(reloadedPanes[1].indicators).toEqual([]);
    expect(loadPersistedLayoutMode(mem)).toBe('2v');
    expect(loadPersistedActivePaneIndex('2v', mem)).toBe(1);

    // Reload on explicit #/chart/RACE -> overrides ONLY pane 0 symbol while preserving persisted timeframe/indicators/settings
    const routeOverridePanes = loadPersistedPanes('MIL:RACE', reloadedSettings, mem);
    expect(routeOverridePanes[0].symbolId).toBe('RACE');
    expect(routeOverridePanes[0].timeframe).toBe('1H');
    expect(routeOverridePanes[0].indicators).toHaveLength(1);

    // ChartSettings vs panes[0] desync prevention when only chartSettings existed in storage
    const onlySettingsMem = createMemoryStorage();
    savePersistedChartSettings(settings, onlySettingsMem);
    const syncedDefaults = loadPersistedPanes(
      undefined,
      loadPersistedChartSettings('dark', onlySettingsMem),
      onlySettingsMem,
    );
    expect(syncedDefaults[0].invertScale).toBe(true);
    expect(syncedDefaults[0].priceScalePosition).toBe('left');
    expect(syncedDefaults[0].scaleMode).toBe('log');

    // Normalized drawings key loading merges qualified & canonical keys cleanly
    const rawDrawing: DrawingObject = {
      id: 'drw-norm-1',
      symbol: 'MIL:RACE',
      type: 'hline',
      points: [{ time: 1000, price: 440 }],
      style: { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' },
      locked: false,
      visible: true,
      createdAt: 1,
    };
    savePersistedDrawings(
      {
        'MIL:RACE': [rawDrawing],
        RACE: [rawDrawing, { ...rawDrawing, id: 'drw-norm-2' }],
      },
      mem,
    );
    const loadedDrawings = loadPersistedDrawings(mem);
    expect(Object.keys(loadedDrawings)).toEqual(['RACE']);
    expect(loadedDrawings.RACE).toHaveLength(2);
    expect(loadedDrawings.RACE[0].symbol).toBe('RACE');

    // Workspace prefs (magnet, stayInDrawing, lock, hideMode, custom Pine, bottomPanelHeight, liveCrypto)
    savePersistedWorkspacePrefs(
      {
        magnetMode: 'strong',
        stayInDrawingMode: true,
        lockDrawings: true,
        hideMode: 'drawings',
        pineCode: '//@version=5\nindicator("Custom", overlay=true)\nplot(ta.ema(close, 9))',
        pineAppliedToChart: true,
        bottomPanelHeight: 360,
        liveCryptoEnabled: false,
      },
      mem,
    );
    const prefs = loadPersistedWorkspacePrefs(mem);
    expect(prefs.magnetMode).toBe('strong');
    expect(prefs.stayInDrawingMode).toBe(true);
    expect(prefs.lockDrawings).toBe(true);
    expect(prefs.hideMode).toBe('drawings');
    expect(prefs.pineCode).toContain('ta.ema(close, 9)');
    expect(prefs.pineAppliedToChart).toBe(true);
    expect(prefs.bottomPanelHeight).toBe(360);
    expect(prefs.liveCryptoEnabled).toBe(false);

    // Indicator visibleTimeframes filtering & lineStyle propagation
    const btcCandles = getCandlesForSymbol('BTCUSDT', '1D', 120);
    const shownOn1H = computePaneIndicatorSeries(btcCandles, [customRsi], null, '1H');
    expect(shownOn1H).toHaveLength(1);
    expect(shownOn1H[0].plots[0].lineStyle).toBe('dashed');
    const hiddenOn5m = computePaneIndicatorSeries(btcCandles, [customRsi], null, '5m');
    expect(hiddenOn5m).toHaveLength(0);
  });

  it('persists named SavedChartLayouts and supports clean JSON export/import validation', () => {
    const mem = createMemoryStorage();
    const darkSettings = getDefaultChartSettings('dark');
    const fallbackLayout: SavedChartLayout = {
      id: DEFAULT_LAYOUT_ID,
      name: DEFAULT_LAYOUT_NAME,
      updatedAt: 1700000000000,
      layoutMode: '1',
      activePaneIndex: 0,
      panes: createDefaultPanes('FTSEMIB'),
      chartSettings: darkSettings,
      drawingsBySymbol: {},
      pineCode: PINE_TEMPLATES[0].code,
      pineAppliedToChart: false,
    };

    const customLayout: SavedChartLayout = {
      ...fallbackLayout,
      id: 'layout-swing-pro',
      name: 'Swing Italia Pro',
      layoutMode: '2h',
      panes: createDefaultPanes('RACE'),
    };

    savePersistedLayoutsBundle(
      {
        savedLayouts: [customLayout, fallbackLayout],
        activeLayoutId: 'layout-swing-pro',
        autoSave: false,
        lastSavedAt: 1700000050000,
      },
      mem,
    );

    const loaded = loadPersistedLayoutsBundle(fallbackLayout, 'dark', mem);
    expect(loaded.savedLayouts).toHaveLength(2);
    expect(loaded.activeLayoutId).toBe('layout-swing-pro');
    expect(loaded.autoSave).toBe(false);
    expect(loaded.savedLayouts[0].name).toBe('Swing Italia Pro');

    // JSON Export -> Import round-trip
    const exportedJson = serializeLayoutForExport(customLayout);
    const imported = parseImportedLayoutJson(exportedJson, 'dark');
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.layout.name).toBe('Swing Italia Pro');
      expect(imported.layout.layoutMode).toBe('2h');
      expect(imported.layout.panes[0].symbolId).toBe('RACE');
      expect(imported.layout.id).not.toBe(customLayout.id);
    }

    // Invalid JSON cleanly rejected
    expect(parseImportedLayoutJson('{broken', 'dark').ok).toBe(false);
    expect(parseImportedLayoutJson('{"hello":"world"}', 'dark').ok).toBe(false);
  });
});

describe('TradingViewProvider & React Hooks (src/store/TradingViewContext.tsx)', () => {
  it('provides unified Supercharts Pro state across all scoped hooks during React render', () => {
    const feed = new MarketFeed({ enableLiveCrypto: false, seed: 7 });

    function Inspector() {
      const tv = useTradingView();
      const quotesCtx = useQuotes();
      const raceQuote = useSymbolQuote('MIL:RACE');
      const paneCtx = useActivePane();
      const drawingsCtx = useDrawings();
      const paperCtx = usePaperTrading();
      const alertsCtx = useAlerts();
      const wlCtx = useWatchlists();

      const payload = {
        theme: tv.theme,
        route: tv.route,
        rightPanel: tv.rightPanel,
        paneSymbol: paneCtx.pane.symbolId,
        scalePosition: paneCtx.pane.priceScalePosition,
        invertScale: paneCtx.pane.invertScale,
        chartSettingsBg: paneCtx.chartSettings.canvas.bgColor,
        chartSettingsScaleMode: paneCtx.chartSettings.scales.mode,
        candleCount: paneCtx.displayedCandles.length,
        indicatorSeriesCount: paneCtx.indicatorSeries.length,
        rating: paneCtx.technicalSummary.summary.rating,
        hasQuotes: Object.keys(quotesCtx.quotes).length > 30,
        racePrice: raceQuote?.price ?? 0,
        activeTool: drawingsCtx.activeTool,
        favoriteToolsCount: drawingsCtx.favoriteTools.length,
        showFavoritesBar: drawingsCtx.showFavoritesBar,
        hideMode: drawingsCtx.hideMode,
        activeLayoutName: tv.activeLayoutName,
        autoSave: tv.autoSave,
        hasUnsavedChanges: tv.hasUnsavedChanges,
        savedLayoutsCount: tv.savedLayouts.length,
        editingIndicatorId: tv.editingIndicatorId,
        paneIndicatorsCount: paneCtx.indicators.length,
        hasLayoutAndIndicatorApis:
          typeof tv.saveCurrentLayout === 'function' &&
          typeof tv.setAutoSave === 'function' &&
          typeof tv.renameActiveLayout === 'function' &&
          typeof tv.duplicateActiveLayout === 'function' &&
          typeof tv.loadSavedLayout === 'function' &&
          typeof tv.deleteSavedLayout === 'function' &&
          typeof tv.createNewLayout === 'function' &&
          typeof tv.exportLayoutJson === 'function' &&
          typeof tv.importLayoutJson === 'function' &&
          typeof tv.openIndicatorSettings === 'function' &&
          typeof tv.closeIndicatorSettings === 'function',
        hasProDrawingActions:
          typeof drawingsCtx.cloneDrawing === 'function' &&
          typeof drawingsCtx.bringToFront === 'function' &&
          typeof drawingsCtx.sendToBack === 'function' &&
          typeof drawingsCtx.openDrawingSettings === 'function' &&
          typeof drawingsCtx.clearAllObjects === 'function',
        paperBalance: paperCtx.account.balance,
        alertsCount: alertsCtx.alerts.length,
        watchlistsCount: wlCtx.watchlists.length,
        pineOk: tv.pineResult?.ok ?? false,
        pineTrades: tv.pineResult?.backtest?.totalTrades ?? 0,
      };

      return createElement('pre', null, JSON.stringify(payload));
    }

    const html = renderToStaticMarkup(
      createElement(
        TradingViewProvider,
        {
          feed,
          autoStartFeed: false,
          initialRoute: { view: 'chart', symbolId: 'MIL:RACE' },
        },
        createElement(Inspector),
      ),
    );

    const jsonText = html
      .replace(/^<pre>/, '')
      .replace(/<\/pre>$/, '')
      .replace(/&quot;/g, '"');
    const data = JSON.parse(jsonText) as Record<string, unknown>;

    expect(data.theme).toBe('dark');
    expect(data.route).toEqual({ view: 'chart', symbolId: 'MIL:RACE' });
    expect(data.rightPanel).toBeNull();
    expect(data.paneSymbol).toBe('RACE');
    expect(data.scalePosition).toBe('right');
    expect(data.invertScale).toBe(false);
    expect(data.chartSettingsBg).toBe('#000000');
    expect(data.chartSettingsScaleMode).toBe('regular');
    expect(data.candleCount).toBe(320);
    expect(data.indicatorSeriesCount).toBe(1);
    expect(data.hasQuotes).toBe(true);
    expect(data.racePrice).toBeCloseTo(442.8, 2);
    expect(data.activeTool).toBe('crosshair');
    expect(data.favoriteToolsCount).toBe(DEFAULT_FAVORITE_TOOLS.length);
    expect(data.showFavoritesBar).toBe(false);
    expect(data.hideMode).toBe('none');
    expect(data.activeLayoutName).toBe(DEFAULT_LAYOUT_NAME);
    expect(data.autoSave).toBe(true);
    expect(data.hasUnsavedChanges).toBe(false);
    expect(data.savedLayoutsCount).toBe(1);
    expect(data.editingIndicatorId).toBeNull();
    expect(data.paneIndicatorsCount).toBe(1);
    expect(data.hasLayoutAndIndicatorApis).toBe(true);
    expect(data.hasProDrawingActions).toBe(true);
    expect(data.paperBalance).toBe(100_000);
    expect(data.alertsCount).toBe(0);
    expect(data.watchlistsCount).toBeGreaterThanOrEqual(5);
    expect(data.pineOk).toBe(true);
    expect(data.pineTrades as number).toBeGreaterThan(0);
  });

  it('throws a clear error when hooks are used outside TradingViewProvider', () => {
    function BrokenConsumer() {
      useTradingView();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(BrokenConsumer))).toThrow(
      /TradingViewProvider/,
    );
  });
});
