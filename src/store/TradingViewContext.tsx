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
import type {
  AlertRule,
  AlertTriggerEvent,
  Candle,
  ChartType,
  DataSourceKind,
  DrawingObject,
  DrawingToolType,
  IndicatorConfig,
  PaperAccountState,
  PineExecutionResult,
  QuoteTick,
  Timeframe,
  WatchlistGroup,
} from '../types';
import {
  MarketFeed,
  fetchRealCandles,
  fetchYahooChart,
  getCachedRealCandles,
  getCandlesForSymbol,
  getSnapshotCandles,
  isTestEnvironment,
  loadRealSnapshot,
  marketFeed as defaultMarketFeed,
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
  INITIAL_MODAL_STATE,
  INITIAL_REPLAY_STATE,
  LAYOUT_PANE_COUNTS,
  addDrawingMutation,
  addSymbolToWatchlistList,
  clearDrawingsMutation,
  computePaneIndicatorSeries,
  createDefaultPanes,
  deleteDrawingMutation,
  loadPersistedActiveWatchlistId,
  loadPersistedDrawings,
  loadPersistedTheme,
  loadPersistedWatchlists,
  normalizeSymbolTicker,
  redoDrawingMutation,
  removeSymbolFromWatchlistList,
  resolveSymbolInfo,
  savePersistedActiveWatchlistId,
  savePersistedDrawings,
  savePersistedTheme,
  savePersistedWatchlists,
  sliceCandlesForReplay,
  undoDrawingMutation,
  updateDrawingMutation,
  type DrawingsBundle,
} from './stateHelpers';
import type {
  ActivityLogEntry,
  BottomPanelTab,
  ChartPaneState,
  LayoutMode,
  MagnetMode,
  ModalName,
  ModalState,
  QuotesContextValue,
  RangePreset,
  ReplayState,
  RightPanelTab,
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
  // ---- Theme ----
  const [theme, setThemeState] = useState<ThemeMode>(() => loadPersistedTheme());

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    savePersistedTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      savePersistedTheme(next);
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
      title: 'Workspace TradingView Italia inizializzato',
      detail: 'Feed di mercato, indicatori e Paper Trading pronti.',
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

  // ---- Multi-Chart Panes ----
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>('1');
  const [activePaneIndex, setActivePaneIndexState] = useState<number>(0);
  const [panes, setPanes] = useState<ChartPaneState[]>(() =>
    createDefaultPanes(route.view === 'chart' ? route.symbolId : 'FTSEMIB'),
  );

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
      updatePane(paneIndex ?? activePaneIndex, { scaleMode });
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

  const setRangePreset = useCallback(
    (rangePreset: RangePreset, paneIndex?: number) => {
      updatePane(paneIndex ?? activePaneIndex, { rangePreset });
    },
    [activePaneIndex, updatePane],
  );

  // ---- Active Pane Candle Series & Real Data Provenance ----
  const [candles, setCandles] = useState<Candle[]>(() =>
    getCandlesForSymbol(activePane.symbolId, activePane.timeframe, 320),
  );
  const [paneDataSources, setPaneDataSources] = useState<
    Record<number, DataSourceKind>
  >({
    0: 'simulated',
    1: 'simulated',
    2: 'simulated',
    3: 'simulated',
  });
  const [paneLoading, setPaneLoading] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  const dataSource: DataSourceKind = paneDataSources[activePaneIndex] ?? 'simulated';
  const isLoadingCandles: boolean = paneLoading[activePaneIndex] ?? false;

  useEffect(() => {
    const symInfo = resolveSymbolInfo(activePane.symbolId);
    const cached = !isTestEnvironment()
      ? getCachedRealCandles(symInfo.ticker, activePane.timeframe)
      : null;

    const initialSeries =
      cached && cached.candles.length > 0
        ? cached.candles
        : getCandlesForSymbol(symInfo.ticker, activePane.timeframe, 320);

    setCandles(initialSeries);
    const initialSource: DataSourceKind = cached ? cached.source : 'simulated';
    setPaneDataSources((prev) => ({
      ...prev,
      [activePaneIndex]: initialSource,
    }));

    let cancelled = false;
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
        activePane.timeframe,
        tailBar,
        (liveCandle) => {
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

    attachLiveCandleSub(initialSeries);

    // Hydrate real historical candles & live quote in browser environments (skipped under Vitest)
    if (!isTestEnvironment() && (symInfo.binanceSymbol || symInfo.yahooSymbol)) {
      const needsLiveFetch =
        !cached || cached.source === 'snapshot';

      if (needsLiveFetch) {
        setPaneLoading((prev) => ({ ...prev, [activePaneIndex]: true }));

        // Fast-path: if snapshot wasn't loaded yet, hydrate real daily/weekly/monthly snapshot immediately while live Yahoo resolves
        if (symInfo.yahooSymbol && !cached) {
          void loadRealSnapshot().then(() => {
            if (cancelled) return;
            const snapBars = getSnapshotCandles(symInfo.ticker, activePane.timeframe);
            if (snapBars && snapBars.length > 0) {
              setCandles((prev) => (prev === initialSeries ? snapBars : prev));
              setPaneDataSources((prev) =>
                prev[activePaneIndex] === 'simulated'
                  ? { ...prev, [activePaneIndex]: 'snapshot' }
                  : prev,
              );
            }
          });
        }

        void fetchRealCandles(symInfo, activePane.timeframe)
          .then((res) => {
            if (cancelled) return;
            if (res && res.candles.length > 0) {
              setCandles(res.candles);
              setPaneDataSources((prev) => ({
                ...prev,
                [activePaneIndex]: res.source,
              }));
              if (res.quote) {
                feed.ingestRealQuote(res.quote);
              }
              attachLiveCandleSub(res.candles);
            }
          })
          .finally(() => {
            if (!cancelled) {
              setPaneLoading((prev) => ({ ...prev, [activePaneIndex]: false }));
            }
          });
      }

      // Periodically refresh live Yahoo quote (~30s) for active non-crypto instrument
      if (symInfo.yahooSymbol) {
        yahooRefreshTimer = setInterval(() => {
          void fetchYahooChart(symInfo, activePane.timeframe, true).then((res) => {
            if (cancelled || !res) return;
            if (res.quote) {
              feed.ingestRealQuote(res.quote);
            }
            if (res.candles.length > 0) {
              setCandles(res.candles);
              setPaneDataSources((prev) => ({
                ...prev,
                [activePaneIndex]: 'yahoo',
              }));
            }
          });
        }, 30_000);
      }
    }

    return () => {
      cancelled = true;
      if (unsubCandle) unsubCandle();
      if (yahooRefreshTimer) clearInterval(yahooRefreshTimer);
    };
  }, [activePane.symbolId, activePane.timeframe, activePaneIndex, feed]);

  const displayedCandles = useMemo(
    () => sliceCandlesForReplay(candles, replay),
    [candles, replay],
  );

  // ---- Replay Controls ----
  const startReplay = useCallback(
    (barIndex?: number) => {
      const total = candles.length;
      if (total < 10) return;
      const defaultIdx = Math.max(20, Math.floor(total * 0.65));
      const clamped = Math.max(
        5,
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

  // ---- Drawings State ----
  const [drawingsBundle, setDrawingsBundle] = useState<DrawingsBundle>(() => ({
    drawingsBySymbol: loadPersistedDrawings(),
    historyBySymbol: {},
  }));
  const [activeTool, setActiveTool] = useState<DrawingToolType>('crosshair');
  const [magnetMode, setMagnetMode] = useState<MagnetMode>('off');
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [lockDrawings, setLockDrawings] = useState<boolean>(false);
  const [hideDrawings, setHideDrawings] = useState<boolean>(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  useEffect(() => {
    savePersistedDrawings(drawingsBundle.drawingsBySymbol);
  }, [drawingsBundle.drawingsBySymbol]);

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
  }, []);

  const clearDrawings = useCallback(
    (symbol?: string) => {
      const target = symbol ?? activePane.symbolId;
      setDrawingsBundle((prev) => clearDrawingsMutation(prev, target));
      setSelectedDrawingId(null);
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

  const [liveCryptoEnabled, setLiveCryptoEnabledState] = useState<boolean>(() =>
    feed.isLiveCryptoEnabled(),
  );

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

      // Evaluate active alerts for changed symbols
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

      // Update previous price snapshot
      for (const ticker of changedTickers) {
        const tick = nextRecord[ticker];
        if (tick) prevPricesRef.current[ticker] = tick.price;
      }

      // Mark-to-market open Paper Trading positions & resting orders
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
  const [pineCode, setPineCode] = useState<string>(PINE_TEMPLATES[0].code);
  const [pineResult, setPineResult] = useState<PineExecutionResult | null>(() =>
    evaluatePineScript(PINE_TEMPLATES[0].code, candles),
  );
  const [pineAppliedToChart, setPineAppliedToChart] = useState<boolean>(false);

  // Re-evaluate Pine automatically when symbol/timeframe/replay candle series changes if applied
  useEffect(() => {
    if (!pineAppliedToChart) return;
    setPineResult(evaluatePineScript(pineCode, displayedCandles));
  }, [displayedCandles, pineAppliedToChart, pineCode]);

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
      computePaneIndicatorSeries(
        displayedCandles,
        activePane.indicators,
        pineAppliedToChart ? pineResult : null,
      ),
    [displayedCandles, activePane.indicators, pineAppliedToChart, pineResult],
  );

  const technicalSummary = useMemo(
    () => calculateTechnicalSummary(displayedCandles),
    [displayedCandles],
  );

  // ---- Workspace UI Panels & Modals ----
  const [rightPanel, setRightPanel] = useState<RightPanelTab>(() =>
    typeof window !== 'undefined' && window.innerWidth <= 900
      ? null
      : 'watchlist',
  );
  const [bottomPanel, setBottomPanel] = useState<BottomPanelTab>(null);
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState<boolean>(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(280);
  const [modals, setModals] = useState<ModalState>(INITIAL_MODAL_STATE);

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

  // Automatically close any open modal when navigating between views
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
      toggleIndicatorVisibility,
      addCompareSymbol,
      removeCompareSymbol,
      setScaleMode,
      toggleAutoScale,
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
      magnetMode,
      setMagnetMode,
      stayInDrawingMode,
      setStayInDrawingMode,
      lockDrawings,
      setLockDrawings,
      hideDrawings,
      setHideDrawings,
      selectedDrawingId,
      setSelectedDrawingId,
      canUndoDrawing,
      canRedoDrawing,
      addDrawing,
      updateDrawing,
      deleteDrawing,
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
      toggleIndicatorVisibility,
      addCompareSymbol,
      removeCompareSymbol,
      setScaleMode,
      toggleAutoScale,
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
      magnetMode,
      stayInDrawingMode,
      lockDrawings,
      hideDrawings,
      selectedDrawingId,
      canUndoDrawing,
      canRedoDrawing,
      addDrawing,
      updateDrawing,
      deleteDrawing,
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

/** Scoped hook for the active chart pane, multi-chart layout, series, indicators & replay */
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
      symbol: ctx.activeSymbol,
      activeSymbol: ctx.activeSymbol,
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
      toggleIndicatorVisibility: ctx.toggleIndicatorVisibility,
      addCompareSymbol: ctx.addCompareSymbol,
      removeCompareSymbol: ctx.removeCompareSymbol,
      setScaleMode: ctx.setScaleMode,
      toggleAutoScale: ctx.toggleAutoScale,
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
      ctx.activeSymbol,
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
      ctx.toggleIndicatorVisibility,
      ctx.addCompareSymbol,
      ctx.removeCompareSymbol,
      ctx.setScaleMode,
      ctx.toggleAutoScale,
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

/** Scoped hook for per-symbol chart drawings, active tool, magnet/lock/hide toggles & undo/redo */
export function useDrawings() {
  const ctx = useRequiredState();
  return useMemo(
    () => ({
      drawings: ctx.activeDrawings,
      drawingsBySymbol: ctx.drawingsBySymbol,
      activeTool: ctx.activeTool,
      setActiveTool: ctx.setActiveTool,
      magnetMode: ctx.magnetMode,
      setMagnetMode: ctx.setMagnetMode,
      stayInDrawingMode: ctx.stayInDrawingMode,
      setStayInDrawingMode: ctx.setStayInDrawingMode,
      lockDrawings: ctx.lockDrawings,
      setLockDrawings: ctx.setLockDrawings,
      hideDrawings: ctx.hideDrawings,
      setHideDrawings: ctx.setHideDrawings,
      selectedDrawingId: ctx.selectedDrawingId,
      setSelectedDrawingId: ctx.setSelectedDrawingId,
      canUndo: ctx.canUndoDrawing,
      canRedo: ctx.canRedoDrawing,
      addDrawing: ctx.addDrawing,
      updateDrawing: ctx.updateDrawing,
      deleteDrawing: ctx.deleteDrawing,
      clearDrawings: ctx.clearDrawings,
      undo: ctx.undoDrawing,
      redo: ctx.redoDrawing,
    }),
    [
      ctx.activeDrawings,
      ctx.drawingsBySymbol,
      ctx.activeTool,
      ctx.setActiveTool,
      ctx.magnetMode,
      ctx.setMagnetMode,
      ctx.stayInDrawingMode,
      ctx.setStayInDrawingMode,
      ctx.lockDrawings,
      ctx.setLockDrawings,
      ctx.hideDrawings,
      ctx.setHideDrawings,
      ctx.selectedDrawingId,
      ctx.setSelectedDrawingId,
      ctx.canUndoDrawing,
      ctx.canRedoDrawing,
      ctx.addDrawing,
      ctx.updateDrawing,
      ctx.deleteDrawing,
      ctx.clearDrawings,
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
