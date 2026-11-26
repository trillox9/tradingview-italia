import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getDefaultChartSettings,
  mergeChartSettings,
  normalizeDrawingTool,
  type AlertRule,
  type AlertTriggerEvent,
  type Candle,
  type CanonicalDrawingToolType,
  type ChartSettings,
  type ChartSettingsPatch,
  type ChartType,
  type DataSourceKind,
  type DrawingObject,
  type DrawingToolType,
  type IndicatorConfig,
  type PaperAccountState,
  type PineExecutionResult,
  type PriceScalePosition,
  type QuoteTick,
  type Timeframe,
  type WatchlistGroup,
} from '../types';
import {
  MarketFeed,
  fetchYahooChart,
  getCandlesForSymbol,
  isTestEnvironment,
  marketFeed as defaultMarketFeed,
  mergeLatestBarIntoSeries,
  resolveRealCandlesSmart,
} from '../data';
import {
  PINE_TEMPLATES,
  calculateTechnicalSummary,
  cancelPaperOrder,
  closePaperPosition,
  createAlertRule,
  evaluateAlerts,
  evaluatePineScript,
  loadAlerts,
  loadPaperAccount,
  markToMarket,
  placePaperOrder,
  resetPaperAccount,
  saveAlerts,
  savePaperAccount,
  type CreateAlertRuleParams,
  type PlaceOrderRequest,
} from '../engine';
import {
  navigateTo,
  parseRoute,
  subscribeRoute,
  type AppRoute,
  type AppView,
} from './router';
import {
  DEFAULT_LAYOUT_ID,
  DEFAULT_LAYOUT_NAME,
  INITIAL_MODAL_STATE,
  INITIAL_REPLAY_STATE,
  LAYOUT_PANE_COUNTS,
  addDrawingMutation,
  addSymbolToWatchlistList,
  bringDrawingToFrontMutation,
  clearDrawingsMutation,
  cloneChartPane,
  cloneDrawingMutation,
  cloneDrawingsMap,
  computePaneIndicatorSeries,
  createDefaultPanes,
  deleteDrawingMutation,
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
  normalizeSymbolTicker,
  parseImportedLayoutJson,
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
  syncPaneWithChartSettings,
  undoDrawingMutation,
  updateDrawingMutation,
  type DrawingsBundle,
  type PersistedWorkspacePrefs,
} from './stateHelpers';
import type {
  ActivityLogEntry,
  BottomPanelTab,
  ChartPaneState,
  HideMode,
  LayoutMode,
  MagnetMode,
  ModalName,
  ModalState,
  QuotesContextValue,
  RangePreset,
  ReplayState,
  RightPanelTab,
  SavedChartLayout,
  ScaleMode,
  ThemeMode,
  TradingViewContextValue,
  TradingViewStateContextValue,
} from './types';

const QuotesContext = createContext<QuotesContextValue | null>(null);
const TradingViewStateContext =
  createContext<TradingViewStateContextValue | null>(null);

function quotesMapToRecord(map: Map<string, QuoteTick>): Record<string, QuoteTick> {
  const out: Record<string, QuoteTick> = {};
  for (const [k, v] of map) {
    out[k] = v;
  }
  return out;
}

function adaptChartSettingsForTheme(
  current: ChartSettings,
  prevTheme: ThemeMode,
  nextTheme: ThemeMode,
): ChartSettings {
  if (prevTheme === nextTheme) return current;
  const prevDefaults = getDefaultChartSettings(prevTheme).canvas;
  const nextDefaults = getDefaultChartSettings(nextTheme).canvas;
  return {
    ...current,
    canvas: {
      ...current.canvas,
      bgColor:
        current.canvas.bgColor === prevDefaults.bgColor
          ? nextDefaults.bgColor
          : current.canvas.bgColor,
      bgGradientEnd:
        current.canvas.bgGradientEnd === prevDefaults.bgGradientEnd
          ? nextDefaults.bgGradientEnd
          : current.canvas.bgGradientEnd,
      vertGridColor:
        current.canvas.vertGridColor === prevDefaults.vertGridColor
          ? nextDefaults.vertGridColor
          : current.canvas.vertGridColor,
      horzGridColor:
        current.canvas.horzGridColor === prevDefaults.horzGridColor
          ? nextDefaults.horzGridColor
          : current.canvas.horzGridColor,
      crosshairColor:
        current.canvas.crosshairColor === prevDefaults.crosshairColor
          ? nextDefaults.crosshairColor
          : current.canvas.crosshairColor,
      watermarkColor:
        current.canvas.watermarkColor === prevDefaults.watermarkColor
          ? nextDefaults.watermarkColor
          : current.canvas.watermarkColor,
      scaleTextColor:
        current.canvas.scaleTextColor === prevDefaults.scaleTextColor
          ? nextDefaults.scaleTextColor
          : current.canvas.scaleTextColor,
    },
  };
}

export interface TradingViewProviderProps {
  children?: ReactNode;
  /** Optional custom MarketFeed instance (handy for testing) */
  feed?: MarketFeed;
  /** Automatically start live marketFeed ticking on mount (default: true) */
  autoStartFeed?: boolean;
  /** Optional initial route override (defaults to current window hash) */
  initialRoute?: AppRoute;
}

let logSeq = 1;
const MAX_ACTIVITY_LOGS = 200;

export function TradingViewProvider({
  children,
  feed = defaultMarketFeed,
  autoStartFeed = true,
  initialRoute,
}: TradingViewProviderProps) {
  // ---- Theme & 6-Tab Authentic Chart Settings ----
  const [theme, setThemeState] = useState<ThemeMode>(() => loadPersistedTheme());
  const themeRef = useRef<ThemeMode>(theme);
  themeRef.current = theme;

  const [chartSettings, setChartSettingsState] = useState<ChartSettings>(() =>
    loadPersistedChartSettings(theme),
  );

  useEffect(() => {
    savePersistedChartSettings(chartSettings);
  }, [chartSettings]);

  const setTheme = useCallback((next: ThemeMode) => {
    const prev = themeRef.current;
    setThemeState(next);
    savePersistedTheme(next);
    if (prev !== next) {
      setChartSettingsState((curr) => adaptChartSettingsForTheme(curr, prev, next));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      savePersistedTheme(next);
      setChartSettingsState((curr) => adaptChartSettingsForTheme(curr, prev, next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  // ---- Routing ----
  const [route, setRoute] = useState<AppRoute>(() => initialRoute ?? parseRoute());

  // ---- Activity Log (Registro) ----
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => [
    {
      id: 'log-init',
      timestamp: Date.now(),
      category: 'system',
      level: 'info',
      title: 'Workspace TradingView Supercharts inizializzato',
      detail: 'Feed di mercato, indicatori, 64 strumenti di disegno e Paper Trading pronti.',
    },
  ]);

  const appendLog = useCallback(
    (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
      logSeq += 1;
      const item: ActivityLogEntry = {
        ...entry,
        id: `log-${Date.now()}-${logSeq}`,
        timestamp: Date.now(),
      };
      setActivityLog((prev) => [item, ...prev].slice(0, MAX_ACTIVITY_LOGS));
    },
    [],
  );

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
  }, []);

  // ---- Multi-Chart Panes (100% Persisted & Synced with ChartSettings) ----
  const initialWorkspacePrefs = useMemo(() => loadPersistedWorkspacePrefs(), []);

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() =>
    loadPersistedLayoutMode(),
  );
  const [activePaneIndex, setActivePaneIndexState] = useState<number>(() =>
    loadPersistedActivePaneIndex(layoutMode),
  );
  const [panes, setPanes] = useState<ChartPaneState[]>(() =>
    loadPersistedPanes(
      route.view === 'chart' && route.symbolId ? route.symbolId : undefined,
      chartSettings,
    ),
  );
  const panesRef = useRef<ChartPaneState[]>(panes);
  panesRef.current = panes;

  useEffect(() => {
    savePersistedPanes(panes);
  }, [panes]);

  useEffect(() => {
    savePersistedLayoutMode(layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    savePersistedActivePaneIndex(activePaneIndex);
  }, [activePaneIndex]);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    const maxPanes = LAYOUT_PANE_COUNTS[mode];
    setActivePaneIndexState((prev) => (prev >= maxPanes ? 0 : prev));
  }, []);

  const setActivePaneIndex = useCallback((index: number) => {
    setActivePaneIndexState((prev) =>
      index >= 0 && index < 4 ? index : prev,
    );
  }, []);

  // ---- Indicator Settings Modal State ----
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);

  const openIndicatorSettings = useCallback((indicatorId: string) => {
    setEditingIndicatorId(indicatorId);
  }, []);

  const closeIndicatorSettings = useCallback(() => {
    setEditingIndicatorId(null);
  }, []);

  const activePane = panes[activePaneIndex] ?? panes[0];
  const activeSymbol = useMemo(
    () => resolveSymbolInfo(activePane.symbolId),
    [activePane.symbolId],
  );

  const updatePane = useCallback(
    (
      paneIndex: number,
      updater:
        | Partial<ChartPaneState>
        | ((prev: ChartPaneState) => ChartPaneState),
    ) => {
      setPanes((prev) =>
        prev.map((p, idx) => {
          if (idx !== paneIndex) return p;
          return typeof updater === 'function' ? updater(p) : { ...p, ...updater };
        }),
      );
    },
    [],
  );

  const updateActivePane = useCallback(
    (
      updater:
        | Partial<ChartPaneState>
        | ((prev: ChartPaneState) => ChartPaneState),
    ) => {
      updatePane(activePaneIndex, updater);
    },
    [activePaneIndex, updatePane],
  );

  const updateChartSettings = useCallback(
    (patch: ChartSettingsPatch) => {
      setChartSettingsState((prev) => mergeChartSettings(prev, patch));

      // Keep activePane mirror flags seamlessly synchronized with ChartSettings
      const panePatch: Partial<ChartPaneState> = {};
      if (patch.scales?.mode !== undefined) {
        panePatch.scaleMode = patch.scales.mode;
      }
      if (patch.scales?.invertScale !== undefined) {
        panePatch.invertScale = patch.scales.invertScale;
      }
      if (patch.scales?.lockPriceToBarRatio !== undefined) {
        panePatch.lockPriceToBarRatio = patch.scales.lockPriceToBarRatio;
      }
      if (patch.scales?.position !== undefined) {
        panePatch.priceScalePosition = patch.scales.position;
      }
      if (patch.scales?.showCountdown !== undefined) {
        panePatch.countdownVisible = patch.scales.showCountdown;
      }
      if (patch.canvas?.gridMode !== undefined) {
        panePatch.showGrid = patch.canvas.gridMode !== 'none';
      }
      if (patch.statusLine?.showBuySellButtons !== undefined) {
        panePatch.showBuySellButtons = patch.statusLine.showBuySellButtons;
      } else if (patch.trading?.showBuySellButtons !== undefined) {
        panePatch.showBuySellButtons = patch.trading.showBuySellButtons;
      }
      if (Object.keys(panePatch).length > 0) {
        updatePane(activePaneIndex, panePatch);
      }
    },
    [activePaneIndex, updatePane],
  );

  const resetChartSettings = useCallback(() => {
    const fresh = getDefaultChartSettings(themeRef.current);
    setChartSettingsState(fresh);
    updatePane(activePaneIndex, {
      scaleMode: fresh.scales.mode,
      invertScale: fresh.scales.invertScale,
      lockPriceToBarRatio: fresh.scales.lockPriceToBarRatio,
      priceScalePosition: fresh.scales.position,
      showGrid: fresh.canvas.gridMode !== 'none',
      countdownVisible: fresh.scales.showCountdown,
      showBuySellButtons: fresh.statusLine.showBuySellButtons,
    });
  }, [activePaneIndex, updatePane]);

  // ---- Replay State ----
  const [replay, setReplay] = useState<ReplayState>(INITIAL_REPLAY_STATE);

  const exitReplay = useCallback(() => {
    setReplay(INITIAL_REPLAY_STATE);
  }, []);

  // ---- Navigation helpers ----
  const navigate = useCallback((view: AppView, symbolId?: string) => {
    const nextRoute = navigateTo(view, symbolId);
    setRoute(nextRoute);
    if (nextRoute.view === 'chart' && nextRoute.symbolId) {
      const sym = normalizeSymbolTicker(nextRoute.symbolId);
      setPanes((prev) =>
        prev.map((p, idx) =>
          idx === activePaneIndex ? { ...p, symbolId: sym } : p,
        ),
      );
    }
  }, [activePaneIndex]);

  const openSymbolInChart = useCallback(
    (symbolId: string) => {
      const sym = normalizeSymbolTicker(symbolId);
      const nextRoute = navigateTo('chart', sym);
      setRoute(nextRoute);
      setPanes((prev) =>
        prev.map((p, idx) =>
          idx === activePaneIndex ? { ...p, symbolId: sym } : p,
        ),
      );
      setReplay(INITIAL_REPLAY_STATE);
      appendLog({
        category: 'symbol',
        level: 'info',
        title: `Simbolo aperto: ${sym}`,
        symbol: sym,
      });
    },
    [activePaneIndex, appendLog],
  );

  // Sync external browser hash changes
  useEffect(() => {
    return subscribeRoute((nextRoute) => {
      setRoute(nextRoute);
      if (nextRoute.view === 'chart' && nextRoute.symbolId) {
        const sym = normalizeSymbolTicker(nextRoute.symbolId);
        setPanes((prev) =>
          prev.map((p, idx) =>
            idx === activePaneIndex ? { ...p, symbolId: sym } : p,
          ),
        );
      }
    });
  }, [activePaneIndex]);

  // ---- Active Pane Helpers ----
  const setSymbol = useCallback(
    (symbolId: string, paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      const sym = normalizeSymbolTicker(symbolId);
      updatePane(targetIdx, { symbolId: sym });
      if (targetIdx === activePaneIndex) {
        setReplay(INITIAL_REPLAY_STATE);
        if (route.view === 'chart') {
          const nextRoute = navigateTo('chart', sym);
          setRoute(nextRoute);
        }
        appendLog({
          category: 'symbol',
          level: 'info',
          title: `Simbolo grafico aggiornato: ${sym}`,
          symbol: sym,
        });
      }
    },
    [activePaneIndex, appendLog, route.view, updatePane],
  );

  const setTimeframe = useCallback(
    (timeframe: Timeframe, paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      updatePane(targetIdx, { timeframe });
      if (targetIdx === activePaneIndex) {
        setReplay(INITIAL_REPLAY_STATE);
      }
    },
    [activePaneIndex, updatePane],
  );

  const setChartType = useCallback(
    (chartType: ChartType, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, { chartType });
    },
    [activePaneIndex, updatePane],
  );

  const addIndicator = useCallback(
    (config: IndicatorConfig, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        indicators: [...prev.indicators, config],
      }));
    },
    [activePaneIndex, updatePane],
  );

  const updateIndicator = useCallback(
    (
      indicatorId: string,
      patch: Partial<IndicatorConfig>,
      paneIndex?: number,
    ) => {
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        indicators: prev.indicators.map((ind) =>
          ind.id === indicatorId ? { ...ind, ...patch } : ind,
        ),
      }));
    },
    [activePaneIndex, updatePane],
  );

  const removeIndicator = useCallback(
    (indicatorId: string, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        indicators: prev.indicators.filter((ind) => ind.id !== indicatorId),
      }));
      setEditingIndicatorId((prev) => (prev === indicatorId ? null : prev));
    },
    [activePaneIndex, updatePane],
  );

  const toggleIndicatorVisibility = useCallback(
    (indicatorId: string, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        indicators: prev.indicators.map((ind) =>
          ind.id === indicatorId ? { ...ind, visible: !ind.visible } : ind,
        ),
      }));
    },
    [activePaneIndex, updatePane],
  );

  const addCompareSymbol = useCallback(
    (ticker: string, paneIndex?: number) => {
      const sym = normalizeSymbolTicker(ticker);
      updatePane(paneIndex ?? activePaneIndex, (prev) => {
        if (prev.symbolId === sym || prev.compareSymbols.includes(sym)) {
          return prev;
        }
        return { ...prev, compareSymbols: [...prev.compareSymbols, sym] };
      });
    },
    [activePaneIndex, updatePane],
  );

  const removeCompareSymbol = useCallback(
    (ticker: string, paneIndex?: number) => {
      const sym = normalizeSymbolTicker(ticker);
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        compareSymbols: prev.compareSymbols.filter((s) => s !== sym),
      }));
    },
    [activePaneIndex, updatePane],
  );

  const setScaleMode = useCallback(
    (scaleMode: ScaleMode, paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      updatePane(targetIdx, { scaleMode });
      if (targetIdx === activePaneIndex) {
        setChartSettingsState((prev) =>
          mergeChartSettings(prev, { scales: { mode: scaleMode } }),
        );
      }
    },
    [activePaneIndex, updatePane],
  );

  const toggleAutoScale = useCallback(
    (paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, (prev) => ({
        ...prev,
        autoScale: !prev.autoScale,
      }));
    },
    [activePaneIndex, updatePane],
  );

  const toggleInvertScale = useCallback(
    (paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      const nextVal = !(panesRef.current[targetIdx]?.invertScale ?? false);
      updatePane(targetIdx, { invertScale: nextVal });
      if (targetIdx === activePaneIndex) {
        setChartSettingsState((prev) =>
          mergeChartSettings(prev, { scales: { invertScale: nextVal } }),
        );
      }
    },
    [activePaneIndex, updatePane],
  );

  const toggleLockPriceToBarRatio = useCallback(
    (paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      const nextVal = !(panesRef.current[targetIdx]?.lockPriceToBarRatio ?? false);
      updatePane(targetIdx, { lockPriceToBarRatio: nextVal });
      if (targetIdx === activePaneIndex) {
        setChartSettingsState((prev) =>
          mergeChartSettings(prev, { scales: { lockPriceToBarRatio: nextVal } }),
        );
      }
    },
    [activePaneIndex, updatePane],
  );

  const setPriceScalePosition = useCallback(
    (position: PriceScalePosition, paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      updatePane(targetIdx, { priceScalePosition: position });
      if (targetIdx === activePaneIndex) {
        setChartSettingsState((prev) =>
          mergeChartSettings(prev, { scales: { position } }),
        );
      }
    },
    [activePaneIndex, updatePane],
  );

  const setRangePreset = useCallback(
    (rangePreset: RangePreset, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, { rangePreset });
    },
    [activePaneIndex, updatePane],
  );

  // ---- Active Pane Candle Series & Real Data Provenance ----
  const initialPaneSeries = useMemo(
    () => resolveInitialPaneSeriesState(activePane.symbolId, activePane.timeframe),
    // Computed once for initial state hydration; subsequent changes handled by effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [candles, setCandles] = useState<Candle[]>(() => initialPaneSeries.candles);
  const [paneDataSources, setPaneDataSources] = useState<
    Record<number, DataSourceKind>
  >(() => ({
    0: initialPaneSeries.dataSource,
    1: 'simulated',
    2: 'simulated',
    3: 'simulated',
  }));
  const [paneLoading, setPaneLoading] = useState<Record<number, boolean>>(() => ({
    0: initialPaneSeries.isLoading,
    1: false,
    2: false,
    3: false,
  }));

  // Per-pane monotonic fetch sequence counter prevents out-of-order responses from overwriting newer switches
  const paneFetchSeqRef = useRef<Record<number, number>>({
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  });

  const dataSource: DataSourceKind = paneDataSources[activePaneIndex] ?? 'simulated';
  const isLoadingCandles: boolean = paneLoading[activePaneIndex] ?? false;

  useEffect(() => {
    const symInfo = resolveSymbolInfo(activePane.symbolId);
    const targetPaneIdx = activePaneIndex;
    const targetTimeframe = activePane.timeframe;

    const reqSeq = (paneFetchSeqRef.current[targetPaneIdx] ?? 0) + 1;
    paneFetchSeqRef.current[targetPaneIdx] = reqSeq;
    const controller = new AbortController();
    const isCurrent = () =>
      !controller.signal.aborted &&
      paneFetchSeqRef.current[targetPaneIdx] === reqSeq;

    const init = resolveInitialPaneSeriesState(symInfo.ticker, targetTimeframe);
    setCandles(init.candles);
    setPaneDataSources((prev) => ({
      ...prev,
      [targetPaneIdx]: init.dataSource,
    }));
    setPaneLoading((prev) => ({
      ...prev,
      [targetPaneIdx]: init.isLoading,
    }));

    let unsubCandle: (() => void) | null = null;
    let yahooRefreshTimer: ReturnType<typeof setInterval> | null = null;

    const attachLiveCandleSub = (series: Candle[]) => {
      if (unsubCandle) {
        unsubCandle();
        unsubCandle = null;
      }
      const tailBar = series[series.length - 1];
      if (!tailBar) return;
      unsubCandle = feed.subscribeCandle(
        symInfo.ticker,
        targetTimeframe,
        tailBar,
        (liveCandle) => {
          if (!isCurrent()) return;
          setCandles((prev) => {
            if (prev.length === 0) return [liveCandle];
            const tail = prev[prev.length - 1];
            if (liveCandle.time === tail.time) {
              const copy = prev.slice();
              copy[copy.length - 1] = liveCandle;
              return copy;
            }
            if (liveCandle.time > tail.time) {
              return [...prev, liveCandle];
            }
            return prev;
          });
        },
      );
    };

    if (init.candles.length > 0) {
      attachLiveCandleSub(init.candles);
    }

    // Hydrate real historical candles & live quote in browser environments (skipped under Vitest)
    if (!isTestEnvironment() && (symInfo.binanceSymbol || symInfo.yahooSymbol)) {
      if (init.isLoading) {
        // Not in real cache yet: keep candles=[] + loading spinner until real data arrives (zero fake-chart flash!)
        void resolveRealCandlesSmart(symInfo, targetTimeframe, {
          signal: controller.signal,
          liveTimeoutMs: 1200,
          onLateYahooUpdate: (lateRes) => {
            if (!isCurrent()) return;
            if (lateRes.quote) {
              feed.ingestRealQuote(lateRes.quote);
            }
            setCandles((prev) =>
              mergeLatestBarIntoSeries(prev, lateRes.candles, targetTimeframe),
            );
            setPaneDataSources((prev) => ({
              ...prev,
              [targetPaneIdx]: 'yahoo',
            }));
          },
        })
          .then((res) => {
            if (!isCurrent()) return;
            if (res && res.candles.length > 0) {
              setCandles(res.candles);
              setPaneDataSources((prev) => ({
                ...prev,
                [targetPaneIdx]: res.source,
              }));
              if (res.quote) {
                feed.ingestRealQuote(res.quote);
              }
              attachLiveCandleSub(res.candles);
            } else {
              // Offline fallback ONLY when both live API and real snapshot failed
              const fallback = getCandlesForSymbol(symInfo.ticker, targetTimeframe, 320);
              setCandles(fallback);
              setPaneDataSources((prev) => ({
                ...prev,
                [targetPaneIdx]: 'simulated',
              }));
              attachLiveCandleSub(fallback);
            }
          })
          .finally(() => {
            if (paneFetchSeqRef.current[targetPaneIdx] === reqSeq) {
              setPaneLoading((prev) => ({ ...prev, [targetPaneIdx]: false }));
            }
          });
      } else if (symInfo.yahooSymbol && init.dataSource === 'snapshot') {
        // Already displaying real Yahoo snapshot immediately: quietly patch ONLY the latest bar if live Yahoo responds
        void fetchYahooChart(symInfo, targetTimeframe, false, {
          signal: controller.signal,
        }).then((res) => {
          if (!isCurrent() || !res || res.candles.length === 0) return;
          if (res.quote) {
            feed.ingestRealQuote(res.quote);
          }
          setCandles((prev) =>
            mergeLatestBarIntoSeries(prev, res.candles, targetTimeframe),
          );
          setPaneDataSources((prev) => ({
            ...prev,
            [targetPaneIdx]: 'yahoo',
          }));
        });
      }

      // Periodically patch latest live Yahoo bar every 30s without replacing historical series
      if (symInfo.yahooSymbol) {
        yahooRefreshTimer = setInterval(() => {
          if (!isCurrent()) return;
          void fetchYahooChart(symInfo, targetTimeframe, true, {
            signal: controller.signal,
          }).then((res) => {
            if (!isCurrent() || !res || res.candles.length === 0) return;
            if (res.quote) {
              feed.ingestRealQuote(res.quote);
            }
            setCandles((prev) =>
              mergeLatestBarIntoSeries(prev, res.candles, targetTimeframe),
            );
            setPaneDataSources((prev) => ({
              ...prev,
              [targetPaneIdx]: 'yahoo',
            }));
          });
        }, 30_000);
      }
    }

    return () => {
      controller.abort();
      if (unsubCandle) unsubCandle();
      if (yahooRefreshTimer) clearInterval(yahooRefreshTimer);
    };
  }, [activePane.symbolId, activePane.timeframe, activePaneIndex, feed]);

  const displayedCandles = useMemo(
    () => sliceCandlesForReplay(candles, replay),
    [candles, replay],
  );

  // ---- Replay Controls ----
  const pendingReplayRef = useRef<{ requested: boolean; barIndex?: number }>({
    requested: false,
  });

  const startReplay = useCallback(
    (barIndex?: number) => {
      const total = candles.length;
      if (total < 4) {
        pendingReplayRef.current = { requested: true, barIndex };
        return;
      }
      pendingReplayRef.current = { requested: false };
      const defaultIdx = Math.max(2, Math.floor(total * 0.65));
      const clamped = Math.max(
        1,
        Math.min(total - 2, barIndex ?? defaultIdx),
      );
      setReplay((prev) => ({
        ...prev,
        active: true,
        barIndex: clamped,
        playing: false,
      }));
    },
    [candles.length],
  );

  // Fulfill a Replay click that happened while timeframe/symbol candles were still hydrating
  useEffect(() => {
    if (pendingReplayRef.current.requested && candles.length >= 4) {
      const idx = pendingReplayRef.current.barIndex;
      pendingReplayRef.current = { requested: false };
      startReplay(idx);
    }
  }, [candles.length, startReplay]);

  const stepReplay = useCallback(
    (delta = 1) => {
      setReplay((prev) => {
        if (!prev.active) return prev;
        const maxIdx = Math.max(0, candles.length - 1);
        const nextIdx = Math.max(1, Math.min(maxIdx, prev.barIndex + delta));
        const reachedEnd = nextIdx >= maxIdx;
        return {
          ...prev,
          barIndex: nextIdx,
          playing: reachedEnd ? false : prev.playing,
        };
      });
    },
    [candles.length],
  );

  const setReplayPlaying = useCallback((playing: boolean) => {
    setReplay((prev) => (prev.active ? { ...prev, playing } : prev));
  }, []);

  const toggleReplayPlay = useCallback(() => {
    setReplay((prev) => {
      if (!prev.active) return prev;
      const atEnd = prev.barIndex >= candles.length - 1;
      return {
        ...prev,
        playing: atEnd ? false : !prev.playing,
      };
    });
  }, [candles.length]);

  const setReplaySpeed = useCallback((speedMs: number) => {
    setReplay((prev) => ({
      ...prev,
      speedMs: Math.max(100, Math.min(3000, speedMs)),
    }));
  }, []);

  const setReplayBarIndex = useCallback(
    (barIndex: number) => {
      const maxIdx = Math.max(0, candles.length - 1);
      setReplay((prev) => ({
        ...prev,
        active: true,
        barIndex: Math.max(1, Math.min(maxIdx, barIndex)),
      }));
    },
    [candles.length],
  );

  useEffect(() => {
    if (!replay.active || !replay.playing) return;
    const id = setInterval(() => {
      stepReplay(1);
    }, replay.speedMs);
    return () => clearInterval(id);
  }, [replay.active, replay.playing, replay.speedMs, stepReplay]);

  // ---- Drawings State & Pro Drawing Controls ----
  const [drawingsBundle, setDrawingsBundle] = useState<DrawingsBundle>(() => ({
    drawingsBySymbol: loadPersistedDrawings(),
    historyBySymbol: {},
  }));
  const drawingsBundleRef = useRef<DrawingsBundle>(drawingsBundle);
  drawingsBundleRef.current = drawingsBundle;

  const [activeTool, setActiveTool] = useState<DrawingToolType>('crosshair');
  const [favoriteTools, setFavoriteTools] = useState<CanonicalDrawingToolType[]>(
    () => loadPersistedFavoriteTools(),
  );
  const [showFavoritesBar, setShowFavoritesBarState] = useState<boolean>(() =>
    loadPersistedShowFavoritesBar(),
  );
  const [magnetMode, setMagnetMode] = useState<MagnetMode>(
    () => initialWorkspacePrefs.magnetMode,
  );
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(
    () => initialWorkspacePrefs.stayInDrawingMode,
  );
  const [lockDrawings, setLockDrawings] = useState<boolean>(
    () => initialWorkspacePrefs.lockDrawings,
  );
  const [hideMode, setHideModeState] = useState<HideMode>(
    () => initialWorkspacePrefs.hideMode,
  );
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [selectedDrawingSettingsId, setSelectedDrawingSettingsId] = useState<
    string | null
  >(null);
  const [selectedDrawingSettingsOpen, setSelectedDrawingSettingsOpen] =
    useState<boolean>(false);

  useEffect(() => {
    savePersistedDrawings(drawingsBundle.drawingsBySymbol);
  }, [drawingsBundle.drawingsBySymbol]);

  useEffect(() => {
    savePersistedFavoriteTools(favoriteTools);
  }, [favoriteTools]);

  useEffect(() => {
    savePersistedShowFavoritesBar(showFavoritesBar);
  }, [showFavoritesBar]);

  const hideDrawings = hideMode === 'drawings' || hideMode === 'all';

  const setHideMode = useCallback((mode: HideMode) => {
    setHideModeState(mode);
  }, []);

  const setHideDrawings = useCallback((hidden: boolean) => {
    setHideModeState((prev) => {
      if (hidden) {
        return prev === 'all' ? 'all' : 'drawings';
      }
      return prev === 'drawings' || prev === 'all' ? 'none' : prev;
    });
  }, []);

  const toggleFavoriteTool = useCallback((tool: DrawingToolType) => {
    const norm = normalizeDrawingTool(tool);
    setFavoriteTools((prev) =>
      prev.includes(norm) ? prev.filter((t) => t !== norm) : [...prev, norm],
    );
  }, []);

  const setShowFavoritesBar = useCallback((visible: boolean) => {
    setShowFavoritesBarState(visible);
  }, []);

  const toggleFavoritesBar = useCallback(() => {
    setShowFavoritesBarState((prev) => !prev);
  }, []);

  const openDrawingSettings = useCallback((id: string) => {
    setSelectedDrawingId(id);
    setSelectedDrawingSettingsId(id);
    setSelectedDrawingSettingsOpen(true);
  }, []);

  const closeDrawingSettings = useCallback(() => {
    setSelectedDrawingSettingsOpen(false);
    setSelectedDrawingSettingsId(null);
  }, []);

  const activeDrawings = useMemo(
    () => drawingsBundle.drawingsBySymbol[activePane.symbolId] ?? [],
    [drawingsBundle.drawingsBySymbol, activePane.symbolId],
  );

  const activeHistory = drawingsBundle.historyBySymbol[activePane.symbolId];
  const canUndoDrawing = Boolean(activeHistory && activeHistory.past.length > 0);
  const canRedoDrawing = Boolean(activeHistory && activeHistory.future.length > 0);

  const addDrawing = useCallback(
    (drawing: DrawingObject) => {
      setDrawingsBundle((prev) => addDrawingMutation(prev, drawing));
      setSelectedDrawingId(drawing.id);
      if (!stayInDrawingMode) {
        setActiveTool('crosshair');
      }
    },
    [stayInDrawingMode],
  );

  const updateDrawing = useCallback(
    (symbol: string, drawingId: string, patch: Partial<DrawingObject>) => {
      setDrawingsBundle((prev) =>
        updateDrawingMutation(prev, symbol, drawingId, patch),
      );
    },
    [],
  );

  const deleteDrawing = useCallback((symbol: string, drawingId: string) => {
    setDrawingsBundle((prev) => deleteDrawingMutation(prev, symbol, drawingId));
    setSelectedDrawingId((prev) => (prev === drawingId ? null : prev));
    setSelectedDrawingSettingsId((prev) => {
      if (prev === drawingId) {
        setSelectedDrawingSettingsOpen(false);
        return null;
      }
      return prev;
    });
  }, []);

  const cloneDrawing = useCallback(
    (id: string, symbol?: string): DrawingObject | null => {
      const targetSym = symbol ?? activePane.symbolId;
      const result = cloneDrawingMutation(drawingsBundleRef.current, targetSym, id);
      if (!result.cloned) return null;
      drawingsBundleRef.current = result.bundle;
      setDrawingsBundle(result.bundle);
      setSelectedDrawingId(result.cloned.id);
      appendLog({
        category: 'drawing',
        level: 'info',
        title: `Disegno clonato su ${normalizeSymbolTicker(targetSym)}`,
        symbol: normalizeSymbolTicker(targetSym),
      });
      return result.cloned;
    },
    [activePane.symbolId, appendLog],
  );

  const bringToFront = useCallback(
    (id: string, symbol?: string) => {
      const targetSym = symbol ?? activePane.symbolId;
      setDrawingsBundle((prev) => bringDrawingToFrontMutation(prev, targetSym, id));
    },
    [activePane.symbolId],
  );

  const sendToBack = useCallback(
    (id: string, symbol?: string) => {
      const targetSym = symbol ?? activePane.symbolId;
      setDrawingsBundle((prev) => sendDrawingToBackMutation(prev, targetSym, id));
    },
    [activePane.symbolId],
  );

  const clearDrawings = useCallback(
    (symbol?: string) => {
      const target = symbol ?? activePane.symbolId;
      setDrawingsBundle((prev) => clearDrawingsMutation(prev, target));
      setSelectedDrawingId(null);
      setSelectedDrawingSettingsId(null);
      setSelectedDrawingSettingsOpen(false);
    },
    [activePane.symbolId],
  );

  const undoDrawing = useCallback(
    (symbol?: string) => {
      setDrawingsBundle((prev) =>
        undoDrawingMutation(prev, symbol ?? activePane.symbolId),
      );
    },
    [activePane.symbolId],
  );

  const redoDrawing = useCallback(
    (symbol?: string) => {
      setDrawingsBundle((prev) =>
        redoDrawingMutation(prev, symbol ?? activePane.symbolId),
      );
    },
    [activePane.symbolId],
  );

  // ---- Watchlists ----
  const [watchlists, setWatchlists] = useState<WatchlistGroup[]>(() =>
    loadPersistedWatchlists(),
  );
  const [activeWatchlistId, setActiveWatchlistIdState] = useState<string>(() =>
    loadPersistedActiveWatchlistId(watchlists),
  );

  useEffect(() => {
    savePersistedWatchlists(watchlists);
  }, [watchlists]);

  const setActiveWatchlistId = useCallback((id: string) => {
    setActiveWatchlistIdState(id);
    savePersistedActiveWatchlistId(id);
  }, []);

  const activeWatchlist = useMemo(
    () => watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0],
    [watchlists, activeWatchlistId],
  );

  const addSymbolToWatchlist = useCallback(
    (ticker: string, watchlistId?: string) => {
      const targetId = watchlistId ?? activeWatchlistId;
      setWatchlists((prev) => addSymbolToWatchlistList(prev, targetId, ticker));
    },
    [activeWatchlistId],
  );

  const removeSymbolFromWatchlist = useCallback(
    (ticker: string, watchlistId?: string) => {
      const targetId = watchlistId ?? activeWatchlistId;
      setWatchlists((prev) =>
        removeSymbolFromWatchlistList(prev, targetId, ticker),
      );
    },
    [activeWatchlistId],
  );

  const createWatchlist = useCallback(
    (name: string, symbols: string[] = []): WatchlistGroup => {
      const created: WatchlistGroup = {
        id: `wl-custom-${Date.now()}`,
        name: name.trim() || 'Nuova Watchlist',
        color: '#2962FF',
        symbols: symbols.map(normalizeSymbolTicker),
      };
      setWatchlists((prev) => [...prev, created]);
      setActiveWatchlistId(created.id);
      return created;
    },
    [setActiveWatchlistId],
  );

  const deleteWatchlist = useCallback(
    (watchlistId: string) => {
      setWatchlists((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((w) => w.id !== watchlistId);
        if (activeWatchlistId === watchlistId && filtered[0]) {
          setActiveWatchlistId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeWatchlistId, setActiveWatchlistId],
  );

  // ---- Alerts ----
  const [alerts, setAlerts] = useState<AlertRule[]>(() => loadAlerts());
  const [triggeredToasts, setTriggeredToasts] = useState<AlertTriggerEvent[]>([]);
  const [alertLog, setAlertLog] = useState<AlertTriggerEvent[]>([]);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  const createAlert = useCallback(
    (params: CreateAlertRuleParams): AlertRule => {
      const rule = createAlertRule({
        ...params,
        symbol: normalizeSymbolTicker(params.symbol),
      });
      setAlerts((prev) => [rule, ...prev]);
      appendLog({
        category: 'alert',
        level: 'info',
        title: `Alert creato: ${rule.name}`,
        detail: rule.message,
        symbol: rule.symbol,
      });
      return rule;
    },
    [appendLog],
  );

  const toggleAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== alertId) return a;
        const nextStatus = a.status === 'active' ? 'paused' : 'active';
        return { ...a, status: nextStatus };
      }),
    );
  }, []);

  const deleteAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setTriggeredToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const clearToasts = useCallback(() => {
    setTriggeredToasts([]);
  }, []);

  // ---- Paper Trading ----
  const [paperAccount, setPaperAccount] = useState<PaperAccountState>(() =>
    loadPaperAccount(),
  );
  const paperAccountRef = useRef(paperAccount);
  paperAccountRef.current = paperAccount;

  useEffect(() => {
    savePaperAccount(paperAccount);
  }, [paperAccount]);

  // ---- Live Quotes & MarketFeed Bridge ----
  const [quotes, setQuotes] = useState<Record<string, QuoteTick>>(() =>
    quotesMapToRecord(feed.getAllQuotes()),
  );
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  const prevPricesRef = useRef<Record<string, number>>(
    Object.fromEntries(
      Object.entries(quotes).map(([k, q]) => [k, q.price]),
    ),
  );

  const [liveCryptoEnabled, setLiveCryptoEnabledState] = useState<boolean>(() => {
    if (
      !isTestEnvironment() &&
      initialWorkspacePrefs.liveCryptoEnabled !== undefined
    ) {
      feed.setLiveCryptoEnabled(initialWorkspacePrefs.liveCryptoEnabled);
      return initialWorkspacePrefs.liveCryptoEnabled;
    }
    return feed.isLiveCryptoEnabled();
  });

  const setLiveCryptoEnabled = useCallback(
    (enabled: boolean) => {
      feed.setLiveCryptoEnabled(enabled);
      setLiveCryptoEnabledState(enabled);
    },
    [feed],
  );

  const getQuote = useCallback(
    (ticker: string) => {
      const sym = normalizeSymbolTicker(ticker);
      return quotesRef.current[sym] ?? feed.getQuote(sym);
    },
    [feed],
  );

  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const activeSymbolIdRef = useRef(activePane.symbolId);
  activeSymbolIdRef.current = activePane.symbolId;

  useEffect(() => {
    if (autoStartFeed) {
      feed.start();
    }

    const unsubscribe = feed.subscribeQuotes((quotesMap, changedTickers) => {
      const nextRecord = quotesMapToRecord(quotesMap);
      setQuotes(nextRecord);

      const currentAlerts = alertsRef.current;
      const hasActiveAlerts = currentAlerts.some((a) => a.status === 'active');
      if (hasActiveAlerts) {
        let workingRules = currentAlerts;
        const newlyTriggered: AlertTriggerEvent[] = [];

        for (const ticker of changedTickers) {
          const tick = nextRecord[ticker];
          if (!tick) continue;
          const prevPrice = prevPricesRef.current[ticker] ?? tick.price;
          const evalOut = evaluateAlerts(workingRules, {
            symbol: ticker,
            prevPrice,
            currentPrice: tick.price,
            candles:
              ticker === activeSymbolIdRef.current
                ? candlesRef.current
                : undefined,
            nowMs: tick.timestamp,
          });
          workingRules = evalOut.rules;
          if (evalOut.triggered.length > 0) {
            newlyTriggered.push(...evalOut.triggered);
          }
        }

        if (newlyTriggered.length > 0) {
          setAlerts(workingRules);
          setTriggeredToasts((prev) => [...newlyTriggered, ...prev].slice(0, 6));
          setAlertLog((prev) => [...newlyTriggered, ...prev].slice(0, 100));
          for (const evt of newlyTriggered) {
            appendLog({
              category: 'alert',
              level: 'warning',
              title: `Alert scattato: ${evt.alertName}`,
              detail: evt.message,
              symbol: evt.symbol,
            });
          }
        }
      }

      for (const ticker of changedTickers) {
        const tick = nextRecord[ticker];
        if (tick) prevPricesRef.current[ticker] = tick.price;
      }

      const acc = paperAccountRef.current;
      if (acc.positions.length > 0 || acc.orders.length > 0) {
        const priceLookup: Record<string, number> = {};
        for (const ticker of changedTickers) {
          const tick = nextRecord[ticker];
          if (tick) priceLookup[ticker] = tick.price;
        }
        if (Object.keys(priceLookup).length > 0) {
          setPaperAccount((prev) => markToMarket(prev, priceLookup));
        }
      }
    });

    return () => {
      unsubscribe();
      if (autoStartFeed) {
        feed.stop();
      }
    };
  }, [appendLog, autoStartFeed, feed]);

  // ---- Paper Trading Actions ----
  const placeOrder = useCallback(
    (request: PlaceOrderRequest, marketPriceOverride?: number) => {
      const sym = normalizeSymbolTicker(request.symbol);
      const price =
        marketPriceOverride ??
        quotesRef.current[sym]?.price ??
        resolveSymbolInfo(sym).basePrice;

      setPaperAccount((prev) => {
        const next = placePaperOrder(prev, { ...request, symbol: sym }, price);
        const latest = next.history[0];
        if (latest && latest.id !== prev.history[0]?.id) {
          const sideLabel = request.side === 'buy' ? 'ACQUISTO' : 'VENDITA';
          appendLog({
            category: 'order',
            level: latest.status === 'rejected' ? 'error' : 'success',
            title:
              latest.status === 'rejected'
                ? `Ordine rifiutato (${sym})`
                : `Ordine ${sideLabel} eseguito: ${request.quantity} ${sym}`,
            detail:
              latest.status === 'rejected'
                ? latest.rejectReason
                : `Prezzo: ${latest.filledPrice ?? price}`,
            symbol: sym,
          });
        } else if (next.orders.length > prev.orders.length) {
          appendLog({
            category: 'order',
            level: 'info',
            title: `Ordine ${request.type.toUpperCase()} inserito: ${request.quantity} ${sym}`,
            symbol: sym,
          });
        }
        return next;
      });
    },
    [appendLog],
  );

  const closePosition = useCallback(
    (symbol: string, marketPriceOverride?: number) => {
      const sym = normalizeSymbolTicker(symbol);
      const price =
        marketPriceOverride ??
        quotesRef.current[sym]?.price ??
        resolveSymbolInfo(sym).basePrice;
      setPaperAccount((prev) => {
        const next = closePaperPosition(prev, sym, price);
        const latest = next.history[0];
        if (latest && latest.id !== prev.history[0]?.id) {
          appendLog({
            category: 'order',
            level: 'info',
            title: `Posizione chiusa: ${sym}`,
            detail: `P&L realizzato: ${latest.realizedPnl ?? 0} EUR`,
            symbol: sym,
          });
        }
        return next;
      });
    },
    [appendLog],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      setPaperAccount((prev) => cancelPaperOrder(prev, orderId));
      appendLog({
        category: 'order',
        level: 'info',
        title: `Ordine pendente annullato`,
        detail: orderId,
      });
    },
    [appendLog],
  );

  const resetAccount = useCallback(
    (initialBalance?: number) => {
      setPaperAccount(resetPaperAccount(initialBalance));
      appendLog({
        category: 'order',
        level: 'warning',
        title: 'Conto Paper Trading ripristinato',
        detail: `Saldo iniziale: ${(initialBalance ?? 100_000).toLocaleString('it-IT')} EUR`,
      });
    },
    [appendLog],
  );

  // ---- Pine Editor & Strategy Tester ----
  const [pineCode, setPineCode] = useState<string>(
    () => initialWorkspacePrefs.pineCode,
  );
  const [pineResult, setPineResult] = useState<PineExecutionResult | null>(() =>
    candles.length > 0
      ? evaluatePineScript(initialWorkspacePrefs.pineCode, candles)
      : null,
  );
  const [pineAppliedToChart, setPineAppliedToChart] = useState<boolean>(
    () => initialWorkspacePrefs.pineAppliedToChart,
  );

  useEffect(() => {
    if (displayedCandles.length === 0) return;
    if (pineAppliedToChart || pineResult === null) {
      setPineResult(evaluatePineScript(pineCode, displayedCandles));
    }
  }, [displayedCandles, pineAppliedToChart, pineCode, pineResult]);

  const runPineScript = useCallback(
    (codeOverride?: string): PineExecutionResult => {
      const source = codeOverride ?? pineCode;
      if (codeOverride !== undefined) setPineCode(codeOverride);
      const res = evaluatePineScript(source, displayedCandles);
      setPineResult(res);
      appendLog({
        category: 'pine',
        level: res.ok ? 'success' : 'error',
        title: res.ok
          ? `Pine eseguito: ${res.scriptName}`
          : `Errore compilazione Pine`,
        detail: res.logs[0] ?? res.diagnostics[0]?.message,
        symbol: activePane.symbolId,
      });
      return res;
    },
    [activePane.symbolId, appendLog, displayedCandles, pineCode],
  );

  const applyPineToChart = useCallback(
    (codeOverride?: string): PineExecutionResult => {
      const res = runPineScript(codeOverride);
      if (res.ok) {
        setPineAppliedToChart(true);
      }
      return res;
    },
    [runPineScript],
  );

  const clearPineFromChart = useCallback(() => {
    setPineAppliedToChart(false);
  }, []);

  const clearIndicators = useCallback(
    (paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      updatePane(targetIdx, { indicators: [] });
      if (targetIdx === activePaneIndex) {
        setPineAppliedToChart(false);
        setEditingIndicatorId(null);
      }
    },
    [activePaneIndex, updatePane],
  );

  const clearAllObjects = useCallback(
    (paneIndex?: number) => {
      const targetIdx = paneIndex ?? activePaneIndex;
      const targetSym = panesRef.current[targetIdx]?.symbolId ?? activePane.symbolId;
      clearDrawings(targetSym);
      clearIndicators(targetIdx);
    },
    [activePane.symbolId, activePaneIndex, clearDrawings, clearIndicators],
  );

  const loadPineTemplate = useCallback(
    (templateId: string) => {
      const tpl = PINE_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      setPineCode(tpl.code);
      const res = evaluatePineScript(tpl.code, displayedCandles);
      setPineResult(res);
    },
    [displayedCandles],
  );

  // ---- Derived Indicator Series & Technical Summary ----
  const indicatorSeries = useMemo(
    () =>
      hideMode === 'indicators' || hideMode === 'all'
        ? []
        : computePaneIndicatorSeries(
            displayedCandles,
            activePane.indicators,
            pineAppliedToChart ? pineResult : null,
            activePane.timeframe,
          ),
    [
      displayedCandles,
      activePane.indicators,
      activePane.timeframe,
      pineAppliedToChart,
      pineResult,
      hideMode,
    ],
  );

  const technicalSummary = useMemo(
    () => calculateTechnicalSummary(displayedCandles),
    [displayedCandles],
  );

  // ---- Workspace UI Panels & Modals ----
  // Supercharts Pro: right sidebar starts collapsed (null) on all viewports for maximum canvas area
  const [rightPanel, setRightPanel] = useState<RightPanelTab>(null);
  const [bottomPanel, setBottomPanel] = useState<BottomPanelTab>(null);
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState<boolean>(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(
    () => initialWorkspacePrefs.bottomPanelHeight,
  );
  const [modals, setModals] = useState<ModalState>(INITIAL_MODAL_STATE);

  // Persist workspace preferences (drawing modes, Pine script, bottom panel height, liveCryptoEnabled)
  useEffect(() => {
    savePersistedWorkspacePrefs({
      magnetMode,
      stayInDrawingMode,
      lockDrawings,
      hideMode,
      pineCode,
      pineAppliedToChart,
      bottomPanelHeight,
      liveCryptoEnabled,
    });
  }, [
    magnetMode,
    stayInDrawingMode,
    lockDrawings,
    hideMode,
    pineCode,
    pineAppliedToChart,
    bottomPanelHeight,
    liveCryptoEnabled,
  ]);

  // ---- Named Saved Chart Layouts & Salva / Auto-Save Engine ----
  const initialLayoutsBundle = useMemo(() => {
    const fallbackLayout: SavedChartLayout = {
      id: DEFAULT_LAYOUT_ID,
      name: DEFAULT_LAYOUT_NAME,
      updatedAt: Date.now(),
      layoutMode,
      activePaneIndex,
      panes: panes.map(cloneChartPane),
      chartSettings: mergeChartSettings(chartSettings, {}),
      drawingsBySymbol: cloneDrawingsMap(drawingsBundle.drawingsBySymbol),
      pineCode,
      pineAppliedToChart,
    };
    return loadPersistedLayoutsBundle(fallbackLayout, theme);
    // Initialized once at provider mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [savedLayouts, setSavedLayouts] = useState<SavedChartLayout[]>(
    () => initialLayoutsBundle.savedLayouts,
  );
  const [activeLayoutId, setActiveLayoutId] = useState<string>(
    () => initialLayoutsBundle.activeLayoutId,
  );
  const [autoSave, setAutoSaveState] = useState<boolean>(
    () => initialLayoutsBundle.autoSave,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(
    () => initialLayoutsBundle.lastSavedAt,
  );

  const activeLayoutName = useMemo(
    () =>
      savedLayouts.find((l) => l.id === activeLayoutId)?.name ??
      DEFAULT_LAYOUT_NAME,
    [savedLayouts, activeLayoutId],
  );

  // Keep latest mutable state in a ref for synchronous saveCurrentLayout & beforeunload flush
  const latestStateRef = useRef({
    theme,
    chartSettings,
    panes,
    layoutMode,
    activePaneIndex,
    drawingsBySymbol: drawingsBundle.drawingsBySymbol,
    favoriteTools,
    showFavoritesBar,
    watchlists,
    activeWatchlistId,
    alerts,
    paperAccount,
    magnetMode,
    stayInDrawingMode,
    lockDrawings,
    hideMode,
    pineCode,
    pineAppliedToChart,
    bottomPanelHeight,
    liveCryptoEnabled,
    savedLayouts,
    activeLayoutId,
    activeLayoutName,
    autoSave,
    hasUnsavedChanges,
    lastSavedAt,
  });
  latestStateRef.current = {
    theme,
    chartSettings,
    panes,
    layoutMode,
    activePaneIndex,
    drawingsBySymbol: drawingsBundle.drawingsBySymbol,
    favoriteTools,
    showFavoritesBar,
    watchlists,
    activeWatchlistId,
    alerts,
    paperAccount,
    magnetMode,
    stayInDrawingMode,
    lockDrawings,
    hideMode,
    pineCode,
    pineAppliedToChart,
    bottomPanelHeight,
    liveCryptoEnabled,
    savedLayouts,
    activeLayoutId,
    activeLayoutName,
    autoSave,
    hasUnsavedChanges,
    lastSavedAt,
  };

  const buildSnapshotFromRef = useCallback(
    (id: string, name: string, now: number): SavedChartLayout => {
      const s = latestStateRef.current;
      return {
        id,
        name: name.trim() || DEFAULT_LAYOUT_NAME,
        updatedAt: now,
        layoutMode: s.layoutMode,
        activePaneIndex: s.activePaneIndex,
        panes: s.panes.map(cloneChartPane),
        chartSettings: mergeChartSettings(s.chartSettings, {}),
        drawingsBySymbol: cloneDrawingsMap(s.drawingsBySymbol),
        pineCode: s.pineCode,
        pineAppliedToChart: s.pineAppliedToChart,
      };
    },
    [],
  );

  const flushAllPersistedState = useCallback(() => {
    const s = latestStateRef.current;
    savePersistedTheme(s.theme);
    savePersistedChartSettings(s.chartSettings);
    savePersistedPanes(s.panes);
    savePersistedLayoutMode(s.layoutMode);
    savePersistedActivePaneIndex(s.activePaneIndex);
    savePersistedDrawings(s.drawingsBySymbol);
    savePersistedFavoriteTools(s.favoriteTools);
    savePersistedShowFavoritesBar(s.showFavoritesBar);
    savePersistedWatchlists(s.watchlists);
    savePersistedActiveWatchlistId(s.activeWatchlistId);
    saveAlerts(s.alerts);
    savePaperAccount(s.paperAccount);
    const prefs: PersistedWorkspacePrefs = {
      magnetMode: s.magnetMode,
      stayInDrawingMode: s.stayInDrawingMode,
      lockDrawings: s.lockDrawings,
      hideMode: s.hideMode,
      pineCode: s.pineCode,
      pineAppliedToChart: s.pineAppliedToChart,
      bottomPanelHeight: s.bottomPanelHeight,
      liveCryptoEnabled: s.liveCryptoEnabled,
    };
    savePersistedWorkspacePrefs(prefs);
    savePersistedLayoutsBundle({
      savedLayouts: s.savedLayouts,
      activeLayoutId: s.activeLayoutId,
      autoSave: s.autoSave,
      lastSavedAt: s.lastSavedAt,
    });
  }, []);

  // Synchronous flush on page unload/reload so recent edits NEVER vanish
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeUnload = () => {
      flushAllPersistedState();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flushAllPersistedState]);

  const didMountLayoutRef = useRef(false);
  const suppressLayoutDirtyRef = useRef(false);

  const saveCurrentLayout = useCallback(() => {
    const s = latestStateRef.current;
    const now = Date.now();
    const snapshot = buildSnapshotFromRef(s.activeLayoutId, s.activeLayoutName, now);
    const exists = s.savedLayouts.some((l) => l.id === s.activeLayoutId);
    const nextLayouts = exists
      ? s.savedLayouts.map((l) => (l.id === s.activeLayoutId ? snapshot : l))
      : [snapshot, ...s.savedLayouts];

    setSavedLayouts(nextLayouts);
    setHasUnsavedChanges(false);
    setLastSavedAt(now);

    latestStateRef.current = {
      ...s,
      savedLayouts: nextLayouts,
      hasUnsavedChanges: false,
      lastSavedAt: now,
    };
    flushAllPersistedState();

    appendLog({
      category: 'system',
      level: 'success',
      title: `Layout salvato: ${snapshot.name}`,
      detail: `${snapshot.panes[snapshot.activePaneIndex]?.symbolId ?? 'FTSEMIB'} (${snapshot.panes[snapshot.activePaneIndex]?.timeframe ?? '1D'})`,
    });
  }, [appendLog, buildSnapshotFromRef, flushAllPersistedState]);

  // Track changes to layout-owned state: auto-save when autoSave=true, otherwise flag hasUnsavedChanges
  useEffect(() => {
    if (!didMountLayoutRef.current) {
      didMountLayoutRef.current = true;
      return;
    }
    if (suppressLayoutDirtyRef.current) {
      suppressLayoutDirtyRef.current = false;
      return;
    }

    const s = latestStateRef.current;
    if (s.autoSave) {
      const now = Date.now();
      const snapshot = buildSnapshotFromRef(s.activeLayoutId, s.activeLayoutName, now);
      const exists = s.savedLayouts.some((l) => l.id === s.activeLayoutId);
      const nextLayouts = exists
        ? s.savedLayouts.map((l) => (l.id === s.activeLayoutId ? snapshot : l))
        : [snapshot, ...s.savedLayouts];
      setSavedLayouts(nextLayouts);
      setHasUnsavedChanges(false);
      setLastSavedAt(now);
      savePersistedLayoutsBundle({
        savedLayouts: nextLayouts,
        activeLayoutId: s.activeLayoutId,
        autoSave: true,
        lastSavedAt: now,
      });
    } else {
      setHasUnsavedChanges(true);
    }
  }, [
    panes,
    layoutMode,
    activePaneIndex,
    chartSettings,
    drawingsBundle.drawingsBySymbol,
    pineCode,
    pineAppliedToChart,
    buildSnapshotFromRef,
  ]);

  const setAutoSave = useCallback(
    (enabled: boolean) => {
      setAutoSaveState(enabled);
      const s = latestStateRef.current;
      latestStateRef.current = { ...s, autoSave: enabled };
      if (enabled && s.hasUnsavedChanges) {
        saveCurrentLayout();
      } else {
        savePersistedLayoutsBundle({
          savedLayouts: s.savedLayouts,
          activeLayoutId: s.activeLayoutId,
          autoSave: enabled,
          lastSavedAt: s.lastSavedAt,
        });
      }
    },
    [saveCurrentLayout],
  );

  const renameActiveLayout = useCallback(
    (name: string) => {
      const cleanName = name.trim() || DEFAULT_LAYOUT_NAME;
      const s = latestStateRef.current;
      const now = Date.now();
      const nextLayouts = s.savedLayouts.map((l) =>
        l.id === s.activeLayoutId ? { ...l, name: cleanName, updatedAt: now } : l,
      );
      setSavedLayouts(nextLayouts);
      setLastSavedAt(now);
      savePersistedLayoutsBundle({
        savedLayouts: nextLayouts,
        activeLayoutId: s.activeLayoutId,
        autoSave: s.autoSave,
        lastSavedAt: now,
      });
      appendLog({
        category: 'system',
        level: 'info',
        title: `Layout rinominato in "${cleanName}"`,
      });
    },
    [appendLog],
  );

  const duplicateActiveLayout = useCallback(
    (name?: string) => {
      const s = latestStateRef.current;
      const now = Date.now();
      const newId = `layout-${now}-${Math.floor(Math.random() * 10000)}`;
      const copyName = name?.trim() || `${s.activeLayoutName} (copia)`;
      const copySnapshot = buildSnapshotFromRef(newId, copyName, now);
      const nextLayouts = [copySnapshot, ...s.savedLayouts];

      setSavedLayouts(nextLayouts);
      setActiveLayoutId(newId);
      setHasUnsavedChanges(false);
      setLastSavedAt(now);
      savePersistedLayoutsBundle({
        savedLayouts: nextLayouts,
        activeLayoutId: newId,
        autoSave: s.autoSave,
        lastSavedAt: now,
      });
      appendLog({
        category: 'system',
        level: 'success',
        title: `Copia layout creata: "${copyName}"`,
      });
    },
    [appendLog, buildSnapshotFromRef],
  );

  const applySavedLayoutToWorkspace = useCallback(
    (target: SavedChartLayout, nextLayouts: SavedChartLayout[]) => {
      suppressLayoutDirtyRef.current = true;
      const syncedPanes = target.panes.map((p, idx) =>
        idx === target.activePaneIndex
          ? syncPaneWithChartSettings(cloneChartPane(p), target.chartSettings)
          : cloneChartPane(p),
      );
      const clonedDrawings = cloneDrawingsMap(target.drawingsBySymbol);
      const clonedSettings = mergeChartSettings(target.chartSettings, {});

      setLayoutModeState(target.layoutMode);
      setActivePaneIndexState(target.activePaneIndex);
      setPanes(syncedPanes);
      setChartSettingsState(clonedSettings);
      setDrawingsBundle({
        drawingsBySymbol: clonedDrawings,
        historyBySymbol: {},
      });
      setSelectedDrawingId(null);
      setEditingIndicatorId(null);
      setPineCode(target.pineCode);
      setPineAppliedToChart(target.pineAppliedToChart);
      setSavedLayouts(nextLayouts);
      setActiveLayoutId(target.id);
      setHasUnsavedChanges(false);
      setLastSavedAt(target.updatedAt);

      savePersistedPanes(syncedPanes);
      savePersistedLayoutMode(target.layoutMode);
      savePersistedActivePaneIndex(target.activePaneIndex);
      savePersistedChartSettings(clonedSettings);
      savePersistedDrawings(clonedDrawings);
      savePersistedLayoutsBundle({
        savedLayouts: nextLayouts,
        activeLayoutId: target.id,
        autoSave: latestStateRef.current.autoSave,
        lastSavedAt: target.updatedAt,
      });
    },
    [],
  );

  const loadSavedLayout = useCallback(
    (id: string) => {
      const s = latestStateRef.current;
      const target = s.savedLayouts.find((l) => l.id === id);
      if (!target) return;
      applySavedLayoutToWorkspace(target, s.savedLayouts);
      appendLog({
        category: 'system',
        level: 'info',
        title: `Layout caricato: "${target.name}"`,
      });
    },
    [appendLog, applySavedLayoutToWorkspace],
  );

  const deleteSavedLayout = useCallback(
    (id: string) => {
      const s = latestStateRef.current;
      if (s.savedLayouts.length <= 1) return;
      const remaining = s.savedLayouts.filter((l) => l.id !== id);
      if (id === s.activeLayoutId && remaining[0]) {
        applySavedLayoutToWorkspace(remaining[0], remaining);
      } else {
        setSavedLayouts(remaining);
        savePersistedLayoutsBundle({
          savedLayouts: remaining,
          activeLayoutId: s.activeLayoutId,
          autoSave: s.autoSave,
          lastSavedAt: s.lastSavedAt,
        });
      }
      appendLog({
        category: 'system',
        level: 'warning',
        title: 'Layout eliminato',
      });
    },
    [appendLog, applySavedLayoutToWorkspace],
  );

  const createNewLayout = useCallback(
    (name?: string) => {
      const s = latestStateRef.current;
      const now = Date.now();
      const newId = `layout-${now}-${Math.floor(Math.random() * 10000)}`;
      const freshSettings = getDefaultChartSettings(themeRef.current);
      const freshPanes = createDefaultPanes('FTSEMIB').map((p) =>
        syncPaneWithChartSettings(p, freshSettings),
      );
      const freshName =
        name?.trim() || `Layout ${s.savedLayouts.length + 1}`;
      const freshLayout: SavedChartLayout = {
        id: newId,
        name: freshName,
        updatedAt: now,
        layoutMode: '1',
        activePaneIndex: 0,
        panes: freshPanes,
        chartSettings: freshSettings,
        drawingsBySymbol: {},
        pineCode: PINE_TEMPLATES[0].code,
        pineAppliedToChart: false,
      };
      const nextLayouts = [freshLayout, ...s.savedLayouts];
      applySavedLayoutToWorkspace(freshLayout, nextLayouts);
      appendLog({
        category: 'system',
        level: 'success',
        title: `Nuovo layout creato: "${freshName}"`,
      });
    },
    [appendLog, applySavedLayoutToWorkspace],
  );

  const exportLayoutJson = useCallback((): string => {
    const s = latestStateRef.current;
    const snap = buildSnapshotFromRef(s.activeLayoutId, s.activeLayoutName, Date.now());
    return serializeLayoutForExport(snap);
  }, [buildSnapshotFromRef]);

  const importLayoutJson = useCallback(
    (json: string): { ok: boolean; error?: string } => {
      const parsed = parseImportedLayoutJson(json, themeRef.current);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      const s = latestStateRef.current;
      const nextLayouts = [parsed.layout, ...s.savedLayouts];
      applySavedLayoutToWorkspace(parsed.layout, nextLayouts);
      appendLog({
        category: 'system',
        level: 'success',
        title: `Layout importato: "${parsed.layout.name}"`,
      });
      return { ok: true };
    },
    [appendLog, applySavedLayoutToWorkspace],
  );

  const toggleRightPanel = useCallback((panel: Exclude<RightPanelTab, null>) => {
    setRightPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const toggleBottomPanel = useCallback((panel: Exclude<BottomPanelTab, null>) => {
    setBottomPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const toggleBottomPanelExpanded = useCallback(() => {
    setBottomPanelExpanded((prev) => !prev);
  }, []);

  const openModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: false }));
  }, []);

  const toggleModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(INITIAL_MODAL_STATE);
  }, []);

  useEffect(() => {
    setModals(INITIAL_MODAL_STATE);
  }, [route.view]);

  // ---- Memoized Context Values ----
  const quotesContextValue = useMemo<QuotesContextValue>(
    () => ({
      quotes,
      liveCryptoEnabled,
      setLiveCryptoEnabled,
      getQuote,
    }),
    [quotes, liveCryptoEnabled, setLiveCryptoEnabled, getQuote],
  );

  const stateContextValue = useMemo<TradingViewStateContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      chartSettings,
      updateChartSettings,
      resetChartSettings,
      savedLayouts,
      activeLayoutId,
      activeLayoutName,
      autoSave,
      hasUnsavedChanges,
      lastSavedAt,
      saveCurrentLayout,
      setAutoSave,
      renameActiveLayout,
      duplicateActiveLayout,
      loadSavedLayout,
      deleteSavedLayout,
      createNewLayout,
      exportLayoutJson,
      importLayoutJson,
      editingIndicatorId,
      openIndicatorSettings,
      closeIndicatorSettings,
      route,
      navigate,
      openSymbolInChart,
      layoutMode,
      setLayoutMode,
      activePaneIndex,
      setActivePaneIndex,
      panes,
      activePane,
      activeSymbol,
      candles,
      displayedCandles,
      paneDataSources,
      paneLoading,
      dataSource,
      isLoadingCandles,
      indicatorSeries,
      technicalSummary,
      updatePane,
      updateActivePane,
      setSymbol,
      setTimeframe,
      setChartType,
      addIndicator,
      updateIndicator,
      removeIndicator,
      clearIndicators,
      clearAllObjects,
      toggleIndicatorVisibility,
      addCompareSymbol,
      removeCompareSymbol,
      setScaleMode,
      toggleAutoScale,
      toggleInvertScale,
      toggleLockPriceToBarRatio,
      setPriceScalePosition,
      setRangePreset,
      replay,
      startReplay,
      stepReplay,
      setReplayPlaying,
      toggleReplayPlay,
      setReplaySpeed,
      setReplayBarIndex,
      exitReplay,
      drawingsBySymbol: drawingsBundle.drawingsBySymbol,
      activeDrawings,
      activeTool,
      setActiveTool,
      favoriteTools,
      toggleFavoriteTool,
      showFavoritesBar,
      setShowFavoritesBar,
      toggleFavoritesBar,
      magnetMode,
      setMagnetMode,
      stayInDrawingMode,
      setStayInDrawingMode,
      lockDrawings,
      setLockDrawings,
      hideMode,
      setHideMode,
      hideDrawings,
      setHideDrawings,
      selectedDrawingId,
      setSelectedDrawingId,
      selectedDrawingSettingsId,
      selectedDrawingSettingsOpen,
      openDrawingSettings,
      closeDrawingSettings,
      canUndoDrawing,
      canRedoDrawing,
      addDrawing,
      updateDrawing,
      deleteDrawing,
      cloneDrawing,
      bringToFront,
      sendToBack,
      clearDrawings,
      undoDrawing,
      redoDrawing,
      watchlists,
      activeWatchlistId,
      activeWatchlist,
      setActiveWatchlistId,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      createWatchlist,
      deleteWatchlist,
      alerts,
      triggeredToasts,
      alertLog,
      createAlert,
      toggleAlert,
      deleteAlert,
      dismissToast,
      clearToasts,
      paperAccount,
      placeOrder,
      closePosition,
      cancelOrder,
      resetAccount,
      pineCode,
      setPineCode,
      pineResult,
      pineAppliedToChart,
      runPineScript,
      applyPineToChart,
      clearPineFromChart,
      loadPineTemplate,
      rightPanel,
      setRightPanel,
      toggleRightPanel,
      bottomPanel,
      setBottomPanel,
      toggleBottomPanel,
      bottomPanelExpanded,
      setBottomPanelExpanded,
      toggleBottomPanelExpanded,
      bottomPanelHeight,
      setBottomPanelHeight,
      modals,
      openModal,
      closeModal,
      toggleModal,
      closeAllModals,
      activityLog,
      appendLog,
      clearActivityLog,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      chartSettings,
      updateChartSettings,
      resetChartSettings,
      savedLayouts,
      activeLayoutId,
      activeLayoutName,
      autoSave,
      hasUnsavedChanges,
      lastSavedAt,
      saveCurrentLayout,
      setAutoSave,
      renameActiveLayout,
      duplicateActiveLayout,
      loadSavedLayout,
      deleteSavedLayout,
      createNewLayout,
      exportLayoutJson,
      importLayoutJson,
      editingIndicatorId,
      openIndicatorSettings,
      closeIndicatorSettings,
      route,
      navigate,
      openSymbolInChart,
      layoutMode,
      setLayoutMode,
      activePaneIndex,
      setActivePaneIndex,
      panes,
      activePane,
      activeSymbol,
      candles,
      displayedCandles,
      paneDataSources,
      paneLoading,
      dataSource,
      isLoadingCandles,
      indicatorSeries,
      technicalSummary,
      updatePane,
      updateActivePane,
      setSymbol,
      setTimeframe,
      setChartType,
      addIndicator,
      updateIndicator,
      removeIndicator,
      clearIndicators,
      clearAllObjects,
      toggleIndicatorVisibility,
      addCompareSymbol,
      removeCompareSymbol,
      setScaleMode,
      toggleAutoScale,
      toggleInvertScale,
      toggleLockPriceToBarRatio,
      setPriceScalePosition,
      setRangePreset,
      replay,
      startReplay,
      stepReplay,
      setReplayPlaying,
      toggleReplayPlay,
      setReplaySpeed,
      setReplayBarIndex,
      exitReplay,
      drawingsBundle.drawingsBySymbol,
      activeDrawings,
      activeTool,
      favoriteTools,
      toggleFavoriteTool,
      showFavoritesBar,
      setShowFavoritesBar,
      toggleFavoritesBar,
      magnetMode,
      stayInDrawingMode,
      lockDrawings,
      hideMode,
      setHideMode,
      hideDrawings,
      setHideDrawings,
      selectedDrawingId,
      selectedDrawingSettingsId,
      selectedDrawingSettingsOpen,
      openDrawingSettings,
      closeDrawingSettings,
      canUndoDrawing,
      canRedoDrawing,
      addDrawing,
      updateDrawing,
      deleteDrawing,
      cloneDrawing,
      bringToFront,
      sendToBack,
      clearDrawings,
      undoDrawing,
      redoDrawing,
      watchlists,
      activeWatchlistId,
      activeWatchlist,
      setActiveWatchlistId,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      createWatchlist,
      deleteWatchlist,
      alerts,
      triggeredToasts,
      alertLog,
      createAlert,
      toggleAlert,
      deleteAlert,
      dismissToast,
      clearToasts,
      paperAccount,
      placeOrder,
      closePosition,
      cancelOrder,
      resetAccount,
      pineCode,
      pineResult,
      pineAppliedToChart,
      runPineScript,
      applyPineToChart,
      clearPineFromChart,
      loadPineTemplate,
      rightPanel,
      toggleRightPanel,
      bottomPanel,
      toggleBottomPanel,
      bottomPanelExpanded,
      toggleBottomPanelExpanded,
      bottomPanelHeight,
      modals,
      openModal,
      closeModal,
      toggleModal,
      closeAllModals,
      activityLog,
      appendLog,
      clearActivityLog,
    ],
  );

  return (
    <TradingViewStateContext.Provider value={stateContextValue}>
      <QuotesContext.Provider value={quotesContextValue}>
        {children}
      </QuotesContext.Provider>
    </TradingViewStateContext.Provider>
  );
}

function useRequiredState(): TradingViewStateContextValue {
  const ctx = useContext(TradingViewStateContext);
  if (!ctx) {
    throw new Error('useTradingView must be used inside <TradingViewProvider>');
  }
  return ctx;
}

/** High-frequency live quotes hook */
export function useQuotes(): QuotesContextValue {
  const ctx = useContext(QuotesContext);
  if (!ctx) {
    throw new Error('useQuotes must be used inside <TradingViewProvider>');
  }
  return ctx;
}

/** Convenience hook returning a single live QuoteTick by ticker or qualified ID */
export function useSymbolQuote(ticker: string): QuoteTick | undefined {
  const { quotes } = useQuotes();
  return quotes[normalizeSymbolTicker(ticker)];
}

/** Unified hook exposing the complete TradingView workspace state & live quotes */
export function useTradingView(): TradingViewContextValue {
  const state = useRequiredState();
  const quotesCtx = useQuotes();
  return useMemo(
    () => ({ ...state, ...quotesCtx }),
    [state, quotesCtx],
  );
}

/** Scoped hook for the active chart pane, chart settings, multi-chart layout, series, indicators & replay */
export function useActivePane() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      layoutMode: ctx.layoutMode,
      setLayoutMode: ctx.setLayoutMode,
      activePaneIndex: ctx.activePaneIndex,
      setActivePaneIndex: ctx.setActivePaneIndex,
      panes: ctx.panes,
      pane: ctx.activePane,
      activePane: ctx.activePane,
      indicators: ctx.activePane.indicators,
      editingIndicatorId: ctx.editingIndicatorId,
      openIndicatorSettings: ctx.openIndicatorSettings,
      closeIndicatorSettings: ctx.closeIndicatorSettings,
      symbol: ctx.activeSymbol,
      activeSymbol: ctx.activeSymbol,
      chartSettings: ctx.chartSettings,
      updateChartSettings: ctx.updateChartSettings,
      resetChartSettings: ctx.resetChartSettings,
      candles: ctx.candles,
      displayedCandles: ctx.displayedCandles,
      paneDataSources: ctx.paneDataSources,
      paneLoading: ctx.paneLoading,
      dataSource: ctx.dataSource,
      isLoadingCandles: ctx.isLoadingCandles,
      indicatorSeries: ctx.indicatorSeries,
      technicalSummary: ctx.technicalSummary,
      updatePane: ctx.updatePane,
      updateActivePane: ctx.updateActivePane,
      setSymbol: ctx.setSymbol,
      setTimeframe: ctx.setTimeframe,
      setChartType: ctx.setChartType,
      addIndicator: ctx.addIndicator,
      updateIndicator: ctx.updateIndicator,
      removeIndicator: ctx.removeIndicator,
      clearIndicators: ctx.clearIndicators,
      clearAllObjects: ctx.clearAllObjects,
      toggleIndicatorVisibility: ctx.toggleIndicatorVisibility,
      addCompareSymbol: ctx.addCompareSymbol,
      removeCompareSymbol: ctx.removeCompareSymbol,
      setScaleMode: ctx.setScaleMode,
      toggleAutoScale: ctx.toggleAutoScale,
      toggleInvertScale: ctx.toggleInvertScale,
      toggleLockPriceToBarRatio: ctx.toggleLockPriceToBarRatio,
      setPriceScalePosition: ctx.setPriceScalePosition,
      setRangePreset: ctx.setRangePreset,
      replay: ctx.replay,
      startReplay: ctx.startReplay,
      stepReplay: ctx.stepReplay,
      setReplayPlaying: ctx.setReplayPlaying,
      toggleReplayPlay: ctx.toggleReplayPlay,
      setReplaySpeed: ctx.setReplaySpeed,
      setReplayBarIndex: ctx.setReplayBarIndex,
      exitReplay: ctx.exitReplay,
    }),
    [
      ctx.layoutMode,
      ctx.setLayoutMode,
      ctx.activePaneIndex,
      ctx.setActivePaneIndex,
      ctx.panes,
      ctx.activePane,
      ctx.editingIndicatorId,
      ctx.openIndicatorSettings,
      ctx.closeIndicatorSettings,
      ctx.activeSymbol,
      ctx.chartSettings,
      ctx.updateChartSettings,
      ctx.resetChartSettings,
      ctx.candles,
      ctx.displayedCandles,
      ctx.paneDataSources,
      ctx.paneLoading,
      ctx.dataSource,
      ctx.isLoadingCandles,
      ctx.indicatorSeries,
      ctx.technicalSummary,
      ctx.updatePane,
      ctx.updateActivePane,
      ctx.setSymbol,
      ctx.setTimeframe,
      ctx.setChartType,
      ctx.addIndicator,
      ctx.updateIndicator,
      ctx.removeIndicator,
      ctx.clearIndicators,
      ctx.clearAllObjects,
      ctx.toggleIndicatorVisibility,
      ctx.addCompareSymbol,
      ctx.removeCompareSymbol,
      ctx.setScaleMode,
      ctx.toggleAutoScale,
      ctx.toggleInvertScale,
      ctx.toggleLockPriceToBarRatio,
      ctx.setPriceScalePosition,
      ctx.setRangePreset,
      ctx.replay,
      ctx.startReplay,
      ctx.stepReplay,
      ctx.setReplayPlaying,
      ctx.toggleReplayPlay,
      ctx.setReplaySpeed,
      ctx.setReplayBarIndex,
      ctx.exitReplay,
    ],
  );
}

/** Scoped hook for per-symbol chart drawings, active tool, favorites, z-order, hide modes & undo/redo */
export function useDrawings() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      drawings: ctx.activeDrawings,
      drawingsBySymbol: ctx.drawingsBySymbol,
      activeTool: ctx.activeTool,
      setActiveTool: ctx.setActiveTool,
      favoriteTools: ctx.favoriteTools,
      toggleFavoriteTool: ctx.toggleFavoriteTool,
      showFavoritesBar: ctx.showFavoritesBar,
      setShowFavoritesBar: ctx.setShowFavoritesBar,
      toggleFavoritesBar: ctx.toggleFavoritesBar,
      magnetMode: ctx.magnetMode,
      setMagnetMode: ctx.setMagnetMode,
      stayInDrawingMode: ctx.stayInDrawingMode,
      setStayInDrawingMode: ctx.setStayInDrawingMode,
      lockDrawings: ctx.lockDrawings,
      setLockDrawings: ctx.setLockDrawings,
      hideMode: ctx.hideMode,
      setHideMode: ctx.setHideMode,
      hideDrawings: ctx.hideDrawings,
      setHideDrawings: ctx.setHideDrawings,
      selectedDrawingId: ctx.selectedDrawingId,
      setSelectedDrawingId: ctx.setSelectedDrawingId,
      selectedDrawingSettingsId: ctx.selectedDrawingSettingsId,
      selectedDrawingSettingsOpen: ctx.selectedDrawingSettingsOpen,
      openDrawingSettings: ctx.openDrawingSettings,
      closeDrawingSettings: ctx.closeDrawingSettings,
      canUndo: ctx.canUndoDrawing,
      canRedo: ctx.canRedoDrawing,
      addDrawing: ctx.addDrawing,
      updateDrawing: ctx.updateDrawing,
      deleteDrawing: ctx.deleteDrawing,
      cloneDrawing: ctx.cloneDrawing,
      bringToFront: ctx.bringToFront,
      sendToBack: ctx.sendToBack,
      clearDrawings: ctx.clearDrawings,
      clearIndicators: ctx.clearIndicators,
      clearAllObjects: ctx.clearAllObjects,
      undo: ctx.undoDrawing,
      redo: ctx.redoDrawing,
    }),
    [
      ctx.activeDrawings,
      ctx.drawingsBySymbol,
      ctx.activeTool,
      ctx.setActiveTool,
      ctx.favoriteTools,
      ctx.toggleFavoriteTool,
      ctx.showFavoritesBar,
      ctx.setShowFavoritesBar,
      ctx.toggleFavoritesBar,
      ctx.magnetMode,
      ctx.setMagnetMode,
      ctx.stayInDrawingMode,
      ctx.setStayInDrawingMode,
      ctx.lockDrawings,
      ctx.setLockDrawings,
      ctx.hideMode,
      ctx.setHideMode,
      ctx.hideDrawings,
      ctx.setHideDrawings,
      ctx.selectedDrawingId,
      ctx.setSelectedDrawingId,
      ctx.selectedDrawingSettingsId,
      ctx.selectedDrawingSettingsOpen,
      ctx.openDrawingSettings,
      ctx.closeDrawingSettings,
      ctx.canUndoDrawing,
      ctx.canRedoDrawing,
      ctx.addDrawing,
      ctx.updateDrawing,
      ctx.deleteDrawing,
      ctx.cloneDrawing,
      ctx.bringToFront,
      ctx.sendToBack,
      ctx.clearDrawings,
      ctx.clearIndicators,
      ctx.clearAllObjects,
      ctx.undoDrawing,
      ctx.redoDrawing,
    ],
  );
}

/** Scoped hook for Paper Trading account & order management */
export function usePaperTrading() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      account: ctx.paperAccount,
      paperAccount: ctx.paperAccount,
      placeOrder: ctx.placeOrder,
      closePosition: ctx.closePosition,
      cancelOrder: ctx.cancelOrder,
      resetAccount: ctx.resetAccount,
    }),
    [
      ctx.paperAccount,
      ctx.placeOrder,
      ctx.closePosition,
      ctx.cancelOrder,
      ctx.resetAccount,
    ],
  );
}

/** Scoped hook for live Price/Indicator Alerts and toast notifications */
export function useAlerts() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      alerts: ctx.alerts,
      triggeredToasts: ctx.triggeredToasts,
      alertLog: ctx.alertLog,
      createAlert: ctx.createAlert,
      toggleAlert: ctx.toggleAlert,
      deleteAlert: ctx.deleteAlert,
      dismissToast: ctx.dismissToast,
      clearToasts: ctx.clearToasts,
    }),
    [
      ctx.alerts,
      ctx.triggeredToasts,
      ctx.alertLog,
      ctx.createAlert,
      ctx.toggleAlert,
      ctx.deleteAlert,
      ctx.dismissToast,
      ctx.clearToasts,
    ],
  );
}

/** Scoped hook for Watchlist groups & ticker management */
export function useWatchlists() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      watchlists: ctx.watchlists,
      activeWatchlistId: ctx.activeWatchlistId,
      activeWatchlist: ctx.activeWatchlist,
      setActiveWatchlistId: ctx.setActiveWatchlistId,
      addSymbolToWatchlist: ctx.addSymbolToWatchlist,
      removeSymbolFromWatchlist: ctx.removeSymbolFromWatchlist,
      createWatchlist: ctx.createWatchlist,
      deleteWatchlist: ctx.deleteWatchlist,
    }),
    [
      ctx.watchlists,
      ctx.activeWatchlistId,
      ctx.activeWatchlist,
      ctx.setActiveWatchlistId,
      ctx.addSymbolToWatchlist,
      ctx.removeSymbolFromWatchlist,
      ctx.createWatchlist,
      ctx.deleteWatchlist,
    ],
  );
}
