import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DRAWING_TOOL_REGISTRY,
  TIMEFRAME_SECONDS,
  isCursorOrUtilityTool,
  normalizeChartType,
  normalizeDrawingTool,
  type Candle,
  type CanonicalDrawingToolType,
  type CursorToolType,
  type DataSourceKind,
  type DrawingObject,
  type DrawingPoint,
  type IndicatorSeries,
  type PersistableDrawingType,
  type ScreenPoint,
} from '../../types';
import {
  formatPercent,
  formatPrice,
  formatVolume,
  getCachedRealCandles,
  getCandlesForSymbol,
  getSnapshotCandles,
  isTestEnvironment,
  mergeLatestBarIntoSeries,
  resolveRealCandlesSmart,
} from '../../data';
import {
  distanceBetween,
  hitTestDrawing,
  snapPriceToCandle,
  toHeikinAshi,
} from '../../engine';
import {
  computePaneIndicatorSeries,
  getVisibleBarCountForRange,
  resolveSymbolInfo,
  useActivePane,
  useAlerts,
  useDrawings,
  usePaperTrading,
  useQuotes,
  useTradingView,
  type ChartPaneState,
  type RangePreset,
} from '../../store';
import {
  COMPARE_COLORS,
  computePriceAxisWidth,
  getSubPaneAtY,
  indexToTime,
  indexToX,
  isNearSubPaneSplitter,
  isPointInMainPlot,
  isPointInMainPriceAxis,
  isPointInPriceAxis,
  isPointInTimeAxis,
  priceToY,
  renderChart,
  resolveEffectivePrecision,
  timeToIndex,
  toScaledValue,
  xToIndex,
  yToPrice,
  type ChartLayoutMetrics,
  type CompareSeriesData,
  type CrosshairState,
  type ViewportState,
  type ZoomBoxOverlay,
} from './chartRenderer';

export type ChartContextMenuTarget =
  | 'price_axis'
  | 'time_axis'
  | 'drawing'
  | 'canvas';

export interface ChartContextMenuPayload {
  target: ChartContextMenuTarget;
  clientX: number;
  clientY: number;
  price: number;
  barIndex: number;
  timestamp: number;
  drawingId?: string;
  paneIndex: number;
}

export interface PriceAxisPlusPayload {
  clientX: number;
  clientY: number;
  price: number;
  symbolId: string;
  paneIndex: number;
}

export interface ChartCanvasProps {
  pane: ChartPaneState;
  paneIndex: number;
  isActivePane: boolean;
  isMultiChart: boolean;
  rangeSignal?: { preset: RangePreset; seq: number } | null;
  resetSignal?: number;
  onFocusPane: (paneIndex: number) => void;
  onHoverCandle?: (candle: Candle | null, barIndex: number | null) => void;
  onChartContextMenu?: (payload: ChartContextMenuPayload) => void;
  onPriceAxisPlusClick?: (payload: PriceAxisPlusPayload) => void;
  onZoomHistoryChange?: (canZoomOut: boolean, zoomOutFn: () => void) => void;
  /** Suppresses the legacy inline drawing swatch bar when FloatingDrawingToolbar is mounted */
  hideInlineDrawingBar?: boolean;
  /** Multi-chart synchronized crosshair timestamp from sibling panes */
  syncedCrosshairTime?: number | null;
  /** Emits hovered bar timestamp for multi-chart crosshair sync */
  onCrosshairTimeChange?: (timestamp: number | null) => void;
}

const MIN_VISIBLE_BARS = 8;
const MAX_VISIBLE_BARS = 480;
const DRAWING_SWATCHES = ['#2962ff', '#089981', '#f23645', '#ff9800', '#ab47bc', '#ffffff'];

const TEXT_PROMPT_TOOLS = new Set<CanonicalDrawingToolType>([
  'text',
  'anchored_text',
  'note',
  'price_note',
  'callout',
]);

/** Only genuinely drag-drawn tools capture 1-finger drag directly on touchscreens */
const DRAG_CAPTURED_TOOLS = new Set<CanonicalDrawingToolType>([
  'brush',
  'highlighter',
  'zoom_box',
  'measure',
]);

function formatCountdown(timeframeSec: number, nowMs: number): string {
  const nowSec = Math.floor(nowMs / 1000);
  const rem = Math.max(0, timeframeSec - (nowSec % timeframeSec));
  const hrs = Math.floor(rem / 3600);
  const mins = Math.floor((rem % 3600) / 60);
  const secs = rem % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function makeDrawingId(): string {
  return `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildDrawingStyle(canonical: CanonicalDrawingToolType) {
  const meta = DRAWING_TOOL_REGISTRY[canonical];
  return {
    color: meta.defaultColor,
    lineWidth: meta.defaultLineWidth,
    lineStyle: meta.defaultLineStyle,
    fillColor: meta.defaultFillColor,
    showLabels: true,
  };
}

function finalizePositionDrawing(drawing: DrawingObject): DrawingObject {
  const canonical = normalizeDrawingTool(drawing.type);
  if (
    (canonical === 'long_position' || canonical === 'short_position') &&
    drawing.points.length >= 2
  ) {
    const entry = drawing.points[0].price;
    const targetRaw = drawing.points[1].price;
    const diff = Math.abs(targetRaw - entry) || Math.max(entry * 0.02, 1e-6);
    if (canonical === 'long_position') {
      return {
        ...drawing,
        targetPrice: Math.max(entry + diff * 0.25, targetRaw),
        stopPrice: entry - diff * 0.5,
      };
    }
    return {
      ...drawing,
      targetPrice: Math.min(entry - diff * 0.25, targetRaw),
      stopPrice: entry + diff * 0.5,
    };
  }
  return drawing;
}

function maxRightBound(candleCount: number, visibleBars: number): number {
  return Math.max(visibleBars, candleCount + visibleBars * 0.85);
}

export function ChartCanvas({
  pane,
  paneIndex,
  isActivePane,
  isMultiChart,
  rangeSignal,
  resetSignal,
  onFocusPane,
  onHoverCandle,
  onChartContextMenu,
  onPriceAxisPlusClick,
  onZoomHistoryChange,
  hideInlineDrawingBar = false,
  syncedCrosshairTime = null,
  onCrosshairTimeChange,
}: ChartCanvasProps) {
  const {
    theme,
    openModal,
    setBottomPanel,
    chartSettings,
    openIndicatorSettings,
  } = useTradingView();

  const { quotes } = useQuotes();
  const {
    displayedCandles: activeDisplayedCandles,
    indicatorSeries: activeIndicatorSeries,
    paneDataSources,
    paneLoading,
    isLoadingCandles,
    toggleIndicatorVisibility,
    removeIndicator,
    removeCompareSymbol,
    updatePane,
    replay,
    stepReplay,
    toggleReplayPlay,
    setReplaySpeed,
    setReplayBarIndex,
    exitReplay,
  } = useActivePane();

  const {
    drawingsBySymbol,
    activeTool,
    setActiveTool,
    magnetMode,
    stayInDrawingMode,
    lockDrawings,
    hideMode,
    hideDrawings,
    selectedDrawingId,
    setSelectedDrawingId,
    openDrawingSettings,
    addDrawing,
    updateDrawing,
    deleteDrawing,
  } = useDrawings();

  const { paperAccount, placeOrder } = usePaperTrading();
  const { alerts } = useAlerts();

  const symbol = useMemo(() => resolveSymbolInfo(pane.symbolId), [pane.symbolId]);
  const liveQuote = quotes[symbol.ticker];
  const canonicalTool = normalizeDrawingTool(activeTool);
  const canonicalChartType = normalizeChartType(pane.chartType);

  const cursorMode: CursorToolType =
    canonicalTool === 'dot' ||
    canonicalTool === 'arrow_cursor' ||
    canonicalTool === 'eraser'
      ? canonicalTool
      : 'crosshair';

  const effectivePrecision = resolveEffectivePrecision(
    symbol.precision,
    chartSettings,
  );
  const priceScalePosition =
    pane.priceScalePosition ?? chartSettings.scales.position;
  const invertScale = pane.invertScale ?? chartSettings.scales.invertScale;
  const lockPriceToBarRatio =
    pane.lockPriceToBarRatio ?? chartSettings.scales.lockPriceToBarRatio;

  // ======================== REAL SECONDARY PANE HYDRATION ========================
  const [secondaryRealState, setSecondaryRealState] = useState<{
    key: string;
    candles: Candle[];
    source: DataSourceKind;
    loading: boolean;
  }>(() => {
    const key = `${symbol.ticker}:${pane.timeframe}`;
    if (isActivePane) {
      return { key, candles: [], source: 'simulated', loading: false };
    }
    const cached = getCachedRealCandles(symbol.ticker, pane.timeframe);
    if (cached && cached.candles.length > 0) {
      return { key, candles: cached.candles, source: cached.source, loading: false };
    }
    const snap = getSnapshotCandles(symbol.ticker, pane.timeframe);
    if (snap && snap.length > 0) {
      return { key, candles: snap, source: 'snapshot', loading: false };
    }
    if (isTestEnvironment() || (!symbol.binanceSymbol && !symbol.yahooSymbol)) {
      return {
        key,
        candles: getCandlesForSymbol(pane.symbolId, pane.timeframe, 320),
        source: 'simulated',
        loading: false,
      };
    }
    return { key, candles: [], source: 'simulated', loading: true };
  });

  useEffect(() => {
    if (isActivePane) return;
    const key = `${symbol.ticker}:${pane.timeframe}`;

    const cached = getCachedRealCandles(symbol.ticker, pane.timeframe);
    if (cached && cached.candles.length > 0) {
      setSecondaryRealState({
        key,
        candles: cached.candles,
        source: cached.source,
        loading: false,
      });
      return;
    }

    const snap = getSnapshotCandles(symbol.ticker, pane.timeframe);
    if (snap && snap.length > 0) {
      setSecondaryRealState({
        key,
        candles: snap,
        source: 'snapshot',
        loading: false,
      });
    } else if (isTestEnvironment() || (!symbol.binanceSymbol && !symbol.yahooSymbol)) {
      setSecondaryRealState({
        key,
        candles: getCandlesForSymbol(pane.symbolId, pane.timeframe, 320),
        source: 'simulated',
        loading: false,
      });
      return;
    } else {
      setSecondaryRealState({
        key,
        candles: [],
        source: 'simulated',
        loading: true,
      });
    }

    if (isTestEnvironment() || (!symbol.binanceSymbol && !symbol.yahooSymbol)) {
      return;
    }

    const ctrl = new AbortController();
    let cancelled = false;

    void resolveRealCandlesSmart(symbol, pane.timeframe, {
      signal: ctrl.signal,
      onLateYahooUpdate: (lateRes) => {
        if (cancelled || lateRes.candles.length === 0) return;
        setSecondaryRealState((prev) =>
          prev.key !== key
            ? prev
            : {
                key,
                candles: mergeLatestBarIntoSeries(
                  prev.candles,
                  lateRes.candles,
                  pane.timeframe,
                ),
                source: 'yahoo',
                loading: false,
              },
        );
      },
    })
      .then((res) => {
        if (cancelled || ctrl.signal.aborted) return;
        if (res && res.candles.length > 0) {
          setSecondaryRealState({
            key,
            candles: res.candles,
            source: res.source,
            loading: false,
          });
        } else {
          setSecondaryRealState((prev) =>
            prev.key === key && prev.candles.length > 0
              ? { ...prev, loading: false }
              : {
                  key,
                  candles: getCandlesForSymbol(pane.symbolId, pane.timeframe, 320),
                  source: 'simulated',
                  loading: false,
                },
          );
        }
      })
      .catch(() => {
        if (cancelled || ctrl.signal.aborted) return;
        setSecondaryRealState((prev) =>
          prev.key === key && prev.candles.length > 0
            ? { ...prev, loading: false }
            : {
                key,
                candles: getCandlesForSymbol(pane.symbolId, pane.timeframe, 320),
                source: 'simulated',
                loading: false,
              },
        );
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [isActivePane, symbol, pane.symbolId, pane.timeframe]);

  const rawCandles = useMemo<Candle[]>(() => {
    if (isActivePane) return activeDisplayedCandles;
    const base =
      secondaryRealState.key === `${symbol.ticker}:${pane.timeframe}`
        ? secondaryRealState.candles
        : [];
    if (base.length === 0) return [];
    if (!liveQuote) return base;
    const last = base[base.length - 1];
    // Only live-patch when liveQuote is coherent with hydrated candles
    if (Math.abs(liveQuote.price - last.close) / Math.max(1e-9, last.close) > 0.05) {
      return base;
    }
    const copy = base.slice();
    copy[copy.length - 1] = {
      ...last,
      close: liveQuote.price,
      high: Math.max(last.high, liveQuote.price),
      low: Math.min(last.low, liveQuote.price),
    };
    return copy;
  }, [
    isActivePane,
    activeDisplayedCandles,
    secondaryRealState,
    symbol.ticker,
    pane.timeframe,
    liveQuote,
  ]);

  // Display candles (transformed for Heikin Ashi)
  const displayCandles = useMemo<Candle[]>(() => {
    if (canonicalChartType === 'heikin_ashi') {
      return toHeikinAshi(rawCandles);
    }
    return rawCandles;
  }, [canonicalChartType, rawCandles]);

  // Indicator series for this pane (honoring visibleTimeframes & lineStyle overrides!)
  const paneIndicatorSeries = useMemo<IndicatorSeries[]>(() => {
    if (hideMode === 'indicators' || hideMode === 'all') return [];
    const rawSeries = isActivePane
      ? activeIndicatorSeries
      : computePaneIndicatorSeries(rawCandles, pane.indicators, null);

    const cfgById = new Map(pane.indicators.map((c) => [c.id, c]));
    return rawSeries
      .filter((s) => {
        const cfg = cfgById.get(s.configId);
        if (
          cfg?.visibleTimeframes &&
          cfg.visibleTimeframes.length > 0 &&
          !cfg.visibleTimeframes.includes(pane.timeframe)
        ) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const cfg = cfgById.get(s.configId);
        if (!cfg) return s;
        let changed = false;
        const nextPlots = s.plots.map((pl) => {
          const overrideStyle =
            cfg.styles?.[pl.key]?.lineStyle ?? cfg.lineStyle;
          if (!overrideStyle || overrideStyle === pl.lineStyle) return pl;
          changed = true;
          return {
            ...pl,
            lineStyle: overrideStyle,
          };
        });
        return changed ? { ...s, plots: nextPlots } : s;
      });
  }, [
    isActivePane,
    activeIndicatorSeries,
    rawCandles,
    pane.indicators,
    pane.timeframe,
    hideMode,
  ]);

  const overlaySeries = useMemo(
    () => paneIndicatorSeries.filter((s) => s.pane === 'overlay'),
    [paneIndicatorSeries],
  );
  const separateSeries = useMemo(
    () => paneIndicatorSeries.filter((s) => s.pane === 'separate'),
    [paneIndicatorSeries],
  );

  // Comparison symbols series
  const compareSeries = useMemo<CompareSeriesData[]>(() => {
    return pane.compareSymbols.map((ticker, idx) => {
      const cached = getCachedRealCandles(ticker, pane.timeframe);
      const snap = getSnapshotCandles(ticker, pane.timeframe);
      const cList =
        cached?.candles && cached.candles.length > 0
          ? cached.candles
          : snap && snap.length > 0
            ? snap
            : getCandlesForSymbol(ticker, pane.timeframe, 320);
      const byTime = new Map<number, number>();
      for (const c of cList) byTime.set(c.time, c.close);
      return {
        ticker,
        color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
        candles: cList,
        byTime,
      };
    });
  }, [pane.compareSymbols, pane.timeframe]);

  const paneDrawings = useMemo(
    () => drawingsBySymbol[symbol.ticker] ?? [],
    [drawingsBySymbol, symbol.ticker],
  );

  // Canvas & container sizing
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 500,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(120, Math.floor(rect.width));
      const h = Math.max(120, Math.floor(rect.height));
      setSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resizable sub-pane total height share (dragged via main/sub-pane horizontal divider)
  const [subPaneHeightRatio, setSubPaneHeightRatio] = useState<number | undefined>(
    undefined,
  );

  // Viewport state (pan/zoom)
  const rightMarginBars = Math.max(
    0,
    Math.min(60, chartSettings.canvas.rightMarginBars ?? 10),
  );
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    visibleBars: 120,
    rightIndex: Math.max(120, rawCandles.length + rightMarginBars),
    yZoom: 1,
    yOffset: 0,
    manualMin: null,
    manualMax: null,
  }));

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Clear manual vertical bounds whenever autoScale turns ON or scaleMode/symbol/timeframe changes
  useEffect(() => {
    if (pane.autoScale) {
      setViewport((vp) =>
        vp.yZoom === 1 &&
        vp.yOffset === 0 &&
        vp.manualMin == null &&
        vp.manualMax == null
          ? vp
          : { ...vp, yZoom: 1, yOffset: 0, manualMin: null, manualMax: null },
      );
    }
  }, [pane.autoScale]);

  useEffect(() => {
    setViewport((vp) =>
      vp.manualMin == null && vp.manualMax == null
        ? vp
        : { ...vp, yZoom: 1, yOffset: 0, manualMin: null, manualMax: null },
    );
  }, [pane.scaleMode, pane.symbolId, pane.timeframe]);

  // Zoom-box history stack for Zoom Out & Alt+R
  const zoomHistoryRef = useRef<
    Array<{ viewport: ViewportState; autoScale: boolean }>
  >([]);

  const handleZoomOut = useCallback(() => {
    const prev = zoomHistoryRef.current.pop();
    if (prev) {
      setViewport(prev.viewport);
      updatePane(paneIndex, { autoScale: prev.autoScale });
    }
    onZoomHistoryChange?.(zoomHistoryRef.current.length > 0, handleZoomOut);
  }, [paneIndex, updatePane, onZoomHistoryChange]);

  const resetChartView = useCallback(() => {
    zoomHistoryRef.current = [];
    onZoomHistoryChange?.(false, handleZoomOut);
    setViewport({
      visibleBars: 120,
      rightIndex: Math.max(120, rawCandles.length + rightMarginBars),
      yZoom: 1,
      yOffset: 0,
      manualMin: null,
      manualMax: null,
    });
    updatePane(paneIndex, { autoScale: true });
  }, [
    rawCandles.length,
    rightMarginBars,
    paneIndex,
    updatePane,
    onZoomHistoryChange,
    handleZoomOut,
  ]);

  const zoomAroundCenter = useCallback(
    (factor: number) => {
      setViewport((vp) => {
        const nextBars = Math.max(
          MIN_VISIBLE_BARS,
          Math.min(MAX_VISIBLE_BARS, vp.visibleBars * factor),
        );
        const centerIndex = vp.rightIndex - vp.visibleBars * 0.5;
        const nextRight = centerIndex + nextBars * 0.5;
        return {
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(
            6,
            Math.min(maxRightBound(rawCandles.length, nextBars), nextRight),
          ),
        };
      });
    },
    [rawCandles.length],
  );

  const jumpToRealtime = useCallback(() => {
    setViewport((vp) => ({
      ...vp,
      rightIndex: Math.max(vp.visibleBars * 0.5, rawCandles.length + rightMarginBars),
    }));
  }, [rawCandles.length, rightMarginBars]);

  // Wire global keyboard navigation CustomEvents dispatched by ChartPage.tsx
  useEffect(() => {
    if (!isActivePane) return;
    const onZoomInEv = () => zoomAroundCenter(0.8);
    const onZoomOutEv = () => zoomAroundCenter(1.25);
    const onPanLeftEv = (ev: Event) => {
      const fast = Boolean((ev as CustomEvent<{ fast?: boolean }>).detail?.fast);
      setViewport((vp) => ({
        ...vp,
        rightIndex: Math.max(
          6,
          vp.rightIndex - Math.max(2, Math.round(vp.visibleBars * (fast ? 0.35 : 0.08))),
        ),
      }));
    };
    const onPanRightEv = (ev: Event) => {
      const fast = Boolean((ev as CustomEvent<{ fast?: boolean }>).detail?.fast);
      setViewport((vp) => ({
        ...vp,
        rightIndex: Math.min(
          maxRightBound(rawCandles.length, vp.visibleBars),
          vp.rightIndex + Math.max(2, Math.round(vp.visibleBars * (fast ? 0.35 : 0.08))),
        ),
      }));
    };
    const onJumpStartEv = () => {
      setViewport((vp) => ({
        ...vp,
        rightIndex: Math.max(MIN_VISIBLE_BARS, vp.visibleBars),
      }));
    };
    const onJumpEndEv = () => jumpToRealtime();
    const onResetViewEv = () => resetChartView();

    window.addEventListener('tv-chart-zoom-in', onZoomInEv);
    window.addEventListener('tv-chart-zoom-out', onZoomOutEv);
    window.addEventListener('tv-chart-pan-left', onPanLeftEv);
    window.addEventListener('tv-chart-pan-right', onPanRightEv);
    window.addEventListener('tv-chart-jump-start', onJumpStartEv);
    window.addEventListener('tv-chart-jump-end', onJumpEndEv);
    window.addEventListener('tv-chart-reset-view', onResetViewEv);
    return () => {
      window.removeEventListener('tv-chart-zoom-in', onZoomInEv);
      window.removeEventListener('tv-chart-zoom-out', onZoomOutEv);
      window.removeEventListener('tv-chart-pan-left', onPanLeftEv);
      window.removeEventListener('tv-chart-pan-right', onPanRightEv);
      window.removeEventListener('tv-chart-jump-start', onJumpStartEv);
      window.removeEventListener('tv-chart-jump-end', onJumpEndEv);
      window.removeEventListener('tv-chart-reset-view', onResetViewEv);
    };
  }, [isActivePane, rawCandles.length, zoomAroundCenter, jumpToRealtime, resetChartView]);

  const paneSource: DataSourceKind = isActivePane
    ? (paneDataSources[paneIndex] ?? liveQuote?.source ?? 'simulated')
    : secondaryRealState.key === `${symbol.ticker}:${pane.timeframe}`
      ? secondaryRealState.source
      : (liveQuote?.source ?? 'simulated');
  const isPaneLoading = isActivePane
    ? Boolean(paneLoading[paneIndex]) || isLoadingCandles
    : secondaryRealState.key === `${symbol.ticker}:${pane.timeframe}` &&
      secondaryRealState.loading;
  const autoScaleRef = useRef(pane.autoScale);
  autoScaleRef.current = pane.autoScale;

  const effectiveScaleMode =
    pane.compareSymbols.length > 0 && pane.scaleMode !== 'indexed100'
      ? 'percent'
      : pane.scaleMode;
  const dynamicPriceAxisWidth = computePriceAxisWidth(
    effectivePrecision,
    effectiveScaleMode,
    chartSettings.canvas.scaleFontSize,
  );

  // Reset & auto-fit viewport when symbol/timeframe changes, real candles hydrate, or Replay steps
  const prevSeriesMetaRef = useRef<{
    symTf: string;
    source: DataSourceKind;
    loading: boolean;
    firstTime: number;
    length: number;
  }>({
    symTf: `${pane.symbolId}:${pane.timeframe}`,
    source: paneSource,
    loading: isPaneLoading,
    firstTime: rawCandles[0]?.time ?? 0,
    length: rawCandles.length,
  });

  useEffect(() => {
    const prev = prevSeriesMetaRef.current;
    const symTf = `${pane.symbolId}:${pane.timeframe}`;
    const firstTime = rawCandles[0]?.time ?? 0;
    const len = rawCandles.length;

    const symTfChanged = prev.symTf !== symTf;
    const sourceUpgraded = prev.source !== paneSource;
    const finishedLoading = prev.loading && !isPaneLoading;
    const seriesReplaced =
      len > 0 &&
      (prev.firstTime !== firstTime || Math.abs(len - prev.length) > 1);

    prevSeriesMetaRef.current = {
      symTf,
      source: paneSource,
      loading: isPaneLoading,
      firstTime,
      length: len,
    };

    if (symTfChanged || sourceUpgraded || finishedLoading || seriesReplaced) {
      const targetVisible = Math.max(
        20,
        Math.min(
          Math.max(20, len),
          getVisibleBarCountForRange(pane.rangePreset, len || 140),
        ),
      );
      const rightPad = Math.max(
        3,
        Math.min(rightMarginBars, Math.round(targetVisible * 0.12)),
      );
      setViewport((vp) => ({
        visibleBars:
          symTfChanged || sourceUpgraded || finishedLoading
            ? targetVisible
            : vp.visibleBars,
        rightIndex: Math.max(targetVisible * 0.5, len + rightPad),
        yZoom:
          pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading
            ? 1
            : vp.yZoom,
        yOffset:
          pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading
            ? 0
            : vp.yOffset,
        manualMin:
          pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading
            ? null
            : vp.manualMin,
        manualMax:
          pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading
            ? null
            : vp.manualMax,
      }));
    } else if (isActivePane && replay.active) {
      setViewport((vp) => ({
        ...vp,
        rightIndex: Math.max(vp.visibleBars * 0.5, len + 4),
      }));
    }
  }, [
    pane.symbolId,
    pane.timeframe,
    pane.rangePreset,
    pane.autoScale,
    paneSource,
    isPaneLoading,
    rawCandles,
    isActivePane,
    replay.active,
    rightMarginBars,
  ]);

  // Apply external rangePreset signal from ChartBottomBar
  useEffect(() => {
    if (!isActivePane || !rangeSignal) return;
    const count = getVisibleBarCountForRange(
      rangeSignal.preset,
      rawCandles.length || 140,
    );
    setViewport((vp) => ({
      ...vp,
      visibleBars: Math.max(MIN_VISIBLE_BARS, Math.min(MAX_VISIBLE_BARS, count)),
      rightIndex: Math.max(20, rawCandles.length + rightMarginBars),
      yZoom: 1,
      yOffset: 0,
      manualMin: null,
      manualMax: null,
    }));
  }, [isActivePane, rangeSignal, rawCandles.length, rightMarginBars]);

  // Apply external reset signal
  useEffect(() => {
    if (!isActivePane || !resetSignal) return;
    resetChartView();
  }, [isActivePane, resetSignal, resetChartView]);

  // Countdown tick (1s)
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const showCountdown = pane.countdownVisible && chartSettings.scales.showCountdown;
  useEffect(() => {
    if (!showCountdown) {
      setCountdownText(null);
      return;
    }
    const tfSec = TIMEFRAME_SECONDS[pane.timeframe];
    const update = () => setCountdownText(formatCountdown(tfSec, Date.now()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [showCountdown, pane.timeframe]);

  // Crosshair, hovered candle, hover cursor zone, eraser target & zoom box
  const [crosshair, setCrosshair] = useState<CrosshairState>({
    x: 0,
    y: 0,
    barIndex: -1,
    visible: false,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverZone, setHoverZone] = useState<
    'plot' | 'priceAxis' | 'timeAxis' | 'plusButton' | 'subSplitter'
  >('plot');
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const ctrlHeldRef = useRef(false);
  const [eraserHoveredId, setEraserHoveredId] = useState<string | null>(null);
  const [zoomBox, setZoomBox] = useState<ZoomBoxOverlay | null>(null);

  // Drawing interaction state
  const [draftDrawing, setDraftDrawing] = useState<DrawingObject | null>(null);
  const draftDrawingRef = useRef<DrawingObject | null>(null);
  draftDrawingRef.current = draftDrawing;

  // Track touch interaction to deduplicate synthetic mouse events & show mobile hint pill
  const lastTouchMsRef = useRef<number>(0);
  const [usedTouchRecently, setUsedTouchRecently] = useState(false);
  const isSyntheticMouseAfterTouch = useCallback(
    () => Date.now() - lastTouchMsRef.current < 650,
    [],
  );

  const [textInputState, setTextInputState] = useState<{
    screen: ScreenPoint;
    points: DrawingPoint[];
    toolType: PersistableDrawingType;
    value: string;
  } | null>(null);

  const layoutRef = useRef<ChartLayoutMetrics | null>(null);

  const dragRef = useRef<
    | null
    | {
        kind: 'pan' | 'priceZoom' | 'timeZoom';
        startX: number;
        startY: number;
        startVp: ViewportState;
        startMin: number;
        startMax: number;
        rawSpan: number;
      }
    | {
        kind: 'subResize';
      }
    | {
        kind: 'freehand';
        drawing: DrawingObject;
      }
    | {
        kind: 'zoomBox';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }
    | {
        kind: 'dragDrawing';
        drawingId: string;
        handleIndex: number | null;
        startPt: DrawingPoint;
        origPoints: DrawingPoint[];
      }
  >(null);

  // Synced sibling hovered index (for Multi-Chart OHLC & indicator readouts)
  const syncedBarIdx = useMemo<number | null>(() => {
    if (crosshair.visible || syncedCrosshairTime == null || rawCandles.length === 0) {
      return null;
    }
    return Math.max(
      0,
      Math.min(rawCandles.length - 1, Math.round(timeToIndex(syncedCrosshairTime, rawCandles))),
    );
  }, [crosshair.visible, syncedCrosshairTime, rawCandles]);

  // Bid/Ask prices anchored to hydrated candle close when liveQuote is stale
  const lastCandle = rawCandles[rawCandles.length - 1];
  const legendRefIdx =
    hoveredIdx !== null
      ? hoveredIdx
      : syncedBarIdx !== null
        ? syncedBarIdx
        : rawCandles.length > 0
          ? rawCandles.length - 1
          : null;
  const legendBar =
    legendRefIdx !== null ? rawCandles[legendRefIdx] : undefined;

  const quoteMatchesCandles =
    liveQuote &&
    lastCandle &&
    Math.abs(liveQuote.price - lastCandle.close) / Math.max(1e-9, lastCandle.close) <=
      0.015;
  const anchorClose = lastCandle?.close ?? liveQuote?.price ?? symbol.basePrice;
  const halfSpread = Math.max(symbol.tickSize * 0.5, anchorClose * 0.00006);
  const bidPrice = quoteMatchesCandles
    ? liveQuote.bid
    : Math.max(symbol.tickSize, anchorClose - halfSpread);
  const askPrice = quoteMatchesCandles ? liveQuote.ask : anchorClose + halfSpread;

  // Render canvas via requestAnimationFrame whenever visual state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetW = Math.round(size.width * dpr);
    const targetH = Math.round(size.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      layoutRef.current = renderChart({
        ctx,
        width: size.width,
        height: size.height,
        theme,
        symbol,
        timeframe: pane.timeframe,
        chartType: pane.chartType,
        candles: displayCandles,
        rawCandles,
        viewport,
        scaleMode: pane.scaleMode,
        autoScale: pane.autoScale,
        invertScale,
        lockPriceToBarRatio,
        priceScalePosition,
        showVolume: pane.showVolume,
        showGrid: pane.showGrid,
        countdownText,
        overlaySeries,
        separateSeries,
        compareSeries,
        drawings: paneDrawings,
        draftDrawing,
        selectedDrawingId: isActivePane ? selectedDrawingId : null,
        eraserHoveredId:
          isActivePane && canonicalTool === 'eraser' ? eraserHoveredId : null,
        hideDrawings,
        hideMode,
        positions: paperAccount.positions,
        orders: paperAccount.orders,
        executions: paperAccount.history,
        alerts,
        crosshair,
        syncedCrosshairTime,
        subPaneHeightRatio,
        subPaneSplitterHovered:
          hoverZone === 'subSplitter' || dragRef.current?.kind === 'subResize',
        cursorMode,
        bidPrice,
        askPrice,
        zoomBox,
        chartSettings,
      });
      ctx.restore();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    size,
    theme,
    symbol,
    pane.timeframe,
    pane.chartType,
    pane.scaleMode,
    pane.autoScale,
    invertScale,
    lockPriceToBarRatio,
    priceScalePosition,
    pane.showVolume,
    pane.showGrid,
    displayCandles,
    rawCandles,
    viewport,
    countdownText,
    overlaySeries,
    separateSeries,
    compareSeries,
    paneDrawings,
    draftDrawing,
    selectedDrawingId,
    eraserHoveredId,
    canonicalTool,
    isActivePane,
    hideDrawings,
    hideMode,
    paperAccount.positions,
    paperAccount.orders,
    paperAccount.history,
    alerts,
    crosshair,
    syncedCrosshairTime,
    subPaneHeightRatio,
    hoverZone,
    cursorMode,
    bidPrice,
    askPrice,
    zoomBox,
    chartSettings,
  ]);

  // Clear draft / eraser hover when active tool switches
  useEffect(() => {
    setDraftDrawing(null);
    setZoomBox(null);
    if (canonicalTool !== 'eraser') setEraserHoveredId(null);
  }, [canonicalTool]);

  // Track Space (pan while drawing tool active) & Ctrl (temporary weak magnet) + Delete/Esc/Enter/Alt+R
  useEffect(() => {
    if (!isActivePane) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Control') ctrlHeldRef.current = true;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ev.code === 'Space' && !ev.repeat) {
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }

      if (ev.altKey && ev.key.toLowerCase() === 'r') {
        ev.preventDefault();
        resetChartView();
        return;
      }

      if (ev.key === 'Enter' && draftDrawing) {
        const draftCanon = normalizeDrawingTool(draftDrawing.type);
        if (draftCanon === 'path' && draftDrawing.points.length >= 2) {
          ev.preventDefault();
          const finalPts = draftDrawing.points.slice(0, -1);
          if (finalPts.length >= 2) {
            addDrawing({ ...draftDrawing, points: finalPts });
          }
          setDraftDrawing(null);
          if (!stayInDrawingMode) setActiveTool('crosshair');
          return;
        }
      }

      if (ev.key === 'Escape') {
        if (draftDrawing) {
          setDraftDrawing(null);
          return;
        }
        if (textInputState) {
          setTextInputState(null);
          return;
        }
        if (zoomBox) {
          setZoomBox(null);
          return;
        }
        if (canonicalTool !== 'crosshair') {
          setActiveTool('crosshair');
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        }
      } else if (
        (ev.key === 'Delete' || ev.key === 'Backspace') &&
        selectedDrawingId &&
        !lockDrawings
      ) {
        const selected = paneDrawings.find((d) => d.id === selectedDrawingId);
        if (selected && !selected.locked) {
          ev.preventDefault();
          deleteDrawing(symbol.ticker, selectedDrawingId);
        }
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === 'Control') ctrlHeldRef.current = false;
      if (ev.code === 'Space') {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
      }
    };

    const onBlur = () => {
      ctrlHeldRef.current = false;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    isActivePane,
    draftDrawing,
    textInputState,
    zoomBox,
    canonicalTool,
    setActiveTool,
    selectedDrawingId,
    setSelectedDrawingId,
    paneDrawings,
    lockDrawings,
    deleteDrawing,
    addDrawing,
    stayInDrawingMode,
    symbol.ticker,
    resetChartView,
  ]);

  // Helper: convert screen (x, y) to snapped DrawingPoint (honoring magnetMode OR temporary Ctrl weak magnet)
  const screenToDrawingPoint = useCallback(
    (x: number, y: number, forceWeakMagnet = false): DrawingPoint | null => {
      const layout = layoutRef.current;
      if (!layout) return null;
      const barFloat = xToIndex(x, layout);
      const barIdx = Math.round(barFloat);
      const time = indexToTime(barIdx, rawCandles);
      let price = yToPrice(y, layout);

      const effectiveMagnet =
        magnetMode !== 'off'
          ? magnetMode
          : forceWeakMagnet || ctrlHeldRef.current
            ? 'weak'
            : 'off';

      if (effectiveMagnet !== 'off' && rawCandles.length > 0) {
        const clamped = Math.max(0, Math.min(rawCandles.length - 1, barIdx));
        const candle = rawCandles[clamped];
        if (candle) {
          price = snapPriceToCandle(price, candle, effectiveMagnet);
        }
      }
      return { time, price };
    },
    [rawCandles, magnetMode],
  );

  // Helper: find top-most hit drawing at (x, y)
  const findHitDrawing = useCallback(
    (
      x: number,
      y: number,
      layout: ChartLayoutMetrics,
      tolerancePx = 8,
      includeLocked = false,
    ): { drawing: DrawingObject; handleIndex: number | null } | null => {
      if (hideDrawings || hideMode === 'drawings' || hideMode === 'all') {
        return null;
      }
      const toScreen = (pt: DrawingPoint): ScreenPoint => ({
        x: indexToX(timeToIndex(pt.time, rawCandles), layout),
        y: priceToY(pt.price, layout),
      });
      const sorted = paneDrawings
        .map((d, idx) => ({ d, idx }))
        .sort((a, b) => (b.d.zIndex ?? 0) - (a.d.zIndex ?? 0) || b.idx - a.idx);

      for (const { d } of sorted) {
        if (!d.visible) continue;
        if (!includeLocked && d.locked) continue;
        const hit = hitTestDrawing(d, { x, y }, toScreen, tolerancePx);
        if (hit.hit) {
          return { drawing: d, handleIndex: hit.handleIndex };
        }
      }
      return null;
    },
    [hideDrawings, hideMode, paneDrawings, rawCandles],
  );

  // Helper: emit unified ContextMenu payload (handles main plot, sub-panes cleanly, price axis, time axis)
  const emitContextMenuAt = useCallback(
    (localX: number, localY: number, clientX: number, clientY: number) => {
      if (!onChartContextMenu) return;
      const layout = layoutRef.current;
      if (!layout) return;

      const barIndex =
        rawCandles.length > 0
          ? Math.max(
              0,
              Math.min(rawCandles.length - 1, Math.round(xToIndex(localX, layout))),
            )
          : -1;
      const timestamp = indexToTime(Math.max(0, barIndex), rawCandles);

      // Avoid emitting bogus negative main-plot prices when right-clicking inside an RSI/MACD sub-pane
      const subHit = getSubPaneAtY(localY, layout);
      let price: number;
      if (subHit) {
        price = rawCandles[rawCandles.length - 1]?.close ?? symbol.basePrice;
      } else {
        price = yToPrice(localY, layout);
      }

      if (isPointInMainPriceAxis(localX, localY, layout)) {
        onChartContextMenu({
          target: 'price_axis',
          clientX,
          clientY,
          price,
          barIndex,
          timestamp,
          paneIndex,
        });
        return;
      }

      if (isPointInTimeAxis(localX, localY, layout)) {
        onChartContextMenu({
          target: 'time_axis',
          clientX,
          clientY,
          price,
          barIndex,
          timestamp,
          paneIndex,
        });
        return;
      }

      if (isPointInMainPlot(localX, localY, layout)) {
        const hit = findHitDrawing(localX, localY, layout, 10, true);
        if (hit) {
          setSelectedDrawingId(hit.drawing.id);
          onChartContextMenu({
            target: 'drawing',
            clientX,
            clientY,
            price,
            barIndex,
            timestamp,
            drawingId: hit.drawing.id,
            paneIndex,
          });
          return;
        }
      }

      onChartContextMenu({
        target: 'canvas',
        clientX,
        clientY,
        price,
        barIndex,
        timestamp,
        paneIndex,
      });
    },
    [
      onChartContextMenu,
      rawCandles,
      symbol.basePrice,
      paneIndex,
      findHitDrawing,
      setSelectedDrawingId,
    ],
  );

  // Helper: commit a completed drawing and honor stayInDrawingMode
  const commitCompletedDrawing = useCallback(
    (drawing: DrawingObject) => {
      const finalized = finalizePositionDrawing(drawing);
      setDraftDrawing(null);
      addDrawing(finalized);
      if (!stayInDrawingMode) {
        setActiveTool('crosshair');
      }
    },
    [addDrawing, stayInDrawingMode, setActiveTool],
  );

  // Helper: place drawing point for ALL 64 tools (mouse clicks & touch taps)
  const placeDrawingPointAt = useCallback(
    (
      x: number,
      y: number,
      overrideTool?: CanonicalDrawingToolType,
      forceWeakMagnet = false,
    ): boolean => {
      const layout = layoutRef.current;
      if (!layout || rawCandles.length === 0 || !isPointInMainPlot(x, y, layout)) {
        return false;
      }

      const tool = overrideTool ?? canonicalTool;

      if (tool === 'eraser') {
        if (lockDrawings) return true;
        const hit = findHitDrawing(x, y, layout, 10, false);
        if (hit) {
          deleteDrawing(symbol.ticker, hit.drawing.id);
          setEraserHoveredId(null);
        }
        return true;
      }

      if (isCursorOrUtilityTool(tool) || lockDrawings) {
        return false;
      }

      const pt = screenToDrawingPoint(x, y, forceWeakMagnet);
      if (!pt) return false;
      const meta = DRAWING_TOOL_REGISTRY[tool];
      const toolType = tool as PersistableDrawingType;

      // 1) Freehand tools (brush, highlighter)
      if (meta.pointCount === 'freehand') {
        const draft: DrawingObject = {
          id: makeDrawingId(),
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt],
          style: buildDrawingStyle(tool),
          locked: false,
          visible: true,
          createdAt: Date.now(),
        };
        setDraftDrawing(draft);
        dragRef.current = { kind: 'freehand', drawing: draft };
        return true;
      }

      // 2) Single-point tools (1 click commits, or prompts text for text/anchored_text)
      if (meta.pointCount === 1) {
        if (TEXT_PROMPT_TOOLS.has(tool)) {
          setTextInputState({
            screen: { x, y },
            points: [pt],
            toolType,
            value: '',
          });
          return true;
        }
        commitCompletedDrawing({
          id: makeDrawingId(),
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt],
          style: buildDrawingStyle(tool),
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
        return true;
      }

      // 3) Multi-point open polyline ('path' — click adds points, double-click or Enter finishes)
      const currentDraft = draftDrawingRef.current;
      if (meta.pointCount === 'multi') {
        if (!currentDraft) {
          setDraftDrawing({
            id: makeDrawingId(),
            symbol: symbol.ticker,
            timeframe: pane.timeframe,
            type: toolType,
            points: [pt, pt],
            style: buildDrawingStyle(tool),
            locked: false,
            visible: true,
            createdAt: Date.now(),
          });
        } else {
          setDraftDrawing({
            ...currentDraft,
            points: currentDraft.points.slice(0, -1).concat(pt, pt),
          });
        }
        return true;
      }

      // 4) Fixed N-point tools (2, 3, 4, 5, 6 points)
      const requiredPoints = meta.pointCount;
      if (!currentDraft) {
        setDraftDrawing({
          id: makeDrawingId(),
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt, pt],
          style: buildDrawingStyle(tool),
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
        return true;
      }

      const committedSoFar = currentDraft.points.slice(0, -1).concat(pt);
      if (committedSoFar.length < requiredPoints) {
        setDraftDrawing({
          ...currentDraft,
          points: committedSoFar.concat(pt),
        });
        return true;
      }

      // All required points placed!
      if (TEXT_PROMPT_TOOLS.has(tool)) {
        setDraftDrawing(null);
        setTextInputState({
          screen: { x, y },
          points: committedSoFar,
          toolType,
          value: '',
        });
        return true;
      }

      commitCompletedDrawing({
        ...currentDraft,
        points: committedSoFar,
      });
      return true;
    },
    [
      canonicalTool,
      rawCandles.length,
      lockDrawings,
      findHitDrawing,
      deleteDrawing,
      symbol.ticker,
      screenToDrawingPoint,
      pane.timeframe,
      commitCompletedDrawing,
    ],
  );

  // Helper: execute Zoom Box selection -> match exact bar & price bounds!
  const applyZoomBox = useCallback(
    (box: ZoomBoxOverlay) => {
      const layout = layoutRef.current;
      if (!layout) return;
      const minX = Math.min(box.x1, box.x2);
      const maxX = Math.max(box.x1, box.x2);
      const minY = Math.min(box.y1, box.y2);
      const maxY = Math.max(box.y1, box.y2);
      if (maxX - minX < 10 || maxY - minY < 10) return;

      zoomHistoryRef.current.push({
        viewport: { ...viewportRef.current },
        autoScale: pane.autoScale,
      });

      const barA = xToIndex(minX, layout);
      const barB = xToIndex(maxX, layout);
      const nextVisible = Math.max(
        MIN_VISIBLE_BARS,
        Math.min(MAX_VISIBLE_BARS, barB - barA),
      );
      const nextRight = Math.max(
        6,
        Math.min(maxRightBound(rawCandles.length, nextVisible), barB),
      );

      const pTop = yToPrice(minY, layout);
      const pBot = yToPrice(maxY, layout);
      const sTop = toScaledValue(pTop, layout.scaleMode, layout.basePrice);
      const sBot = toScaledValue(pBot, layout.scaleMode, layout.basePrice);
      const selMin = Math.min(sTop, sBot);
      const selMax = Math.max(sTop, sBot);

      autoScaleRef.current = false;
      updatePane(paneIndex, { autoScale: false });
      setViewport({
        visibleBars: nextVisible,
        rightIndex: nextRight,
        yZoom: Math.max(
          0.15,
          Math.min(12, layout.rawMainSpan / Math.max(1e-12, selMax - selMin)),
        ),
        yOffset: 0,
        manualMin: selMin,
        manualMax: selMax,
      });
      onZoomHistoryChange?.(true, handleZoomOut);
      if (!stayInDrawingMode) {
        setActiveTool('crosshair');
      }
    },
    [
      pane.autoScale,
      paneIndex,
      rawCandles.length,
      updatePane,
      onZoomHistoryChange,
      handleZoomOut,
      stayInDrawingMode,
      setActiveTool,
    ],
  );

  const placeDrawingPointAtRef = useRef(placeDrawingPointAt);
  placeDrawingPointAtRef.current = placeDrawingPointAt;

  // ======================== 1:1 TRADINGVIEW MOBILE TOUCH ENGINE ========================
  const lastTapRef = useRef<{
    time: number;
    zone: 'priceAxis' | 'timeAxis' | 'plot';
    x: number;
    y: number;
  }>({
    time: 0,
    zone: 'plot',
    x: 0,
    y: 0,
  });
  const inspectTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const touchRef = useRef<
    | null
    | {
        kind: 'single';
        startX: number;
        startY: number;
        clientX: number;
        clientY: number;
        moved: boolean;
        longPressed: boolean;
        inspecting: boolean;
        inspectMoved: boolean;
        zone: 'priceAxis' | 'timeAxis' | 'plot';
        startVp: ViewportState;
        startMin: number;
        startMax: number;
        rawSpan: number;
      }
    | {
        kind: 'pinch';
        startDist: number;
        startDx: number;
        startDy: number;
        startMidX: number;
        startVp: ViewportState;
        startMin: number;
        startMax: number;
        rawSpan: number;
      }
    | {
        kind: 'freehand';
        drawing: DrawingObject;
      }
    | {
        kind: 'zoomBox';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }
    | {
        kind: 'measureDrag';
        startX: number;
        startY: number;
        lastX: number;
        lastY: number;
        dragged: boolean;
        startedWithDraft: boolean;
        point1Anchored: boolean;
      }
  >(null);

  // Keep latest reactive data/callbacks in a ref so touch listeners & press-and-hold timers
  // NEVER get torn down or cancelled by live Binance/Yahoo WebSocket candle/quote ticks!
  const touchEnvRef = useRef({
    paneIndex,
    onFocusPane,
    activeTool,
    canonicalTool,
    lockDrawings,
    screenToDrawingPoint,
    symbolTicker: symbol.ticker,
    timeframe: pane.timeframe,
    invertScale,
    rightMarginBars,
    updatePane,
    rawCandles,
    isActivePane,
    onHoverCandle,
    commitCompletedDrawing,
    applyZoomBox,
    findHitDrawing,
    setSelectedDrawingId,
    emitContextMenuAt,
    onPriceAxisPlusClick,
  });
  touchEnvRef.current = {
    paneIndex,
    onFocusPane,
    activeTool,
    canonicalTool,
    lockDrawings,
    screenToDrawingPoint,
    symbolTicker: symbol.ticker,
    timeframe: pane.timeframe,
    invertScale,
    rightMarginBars,
    updatePane,
    rawCandles,
    isActivePane,
    onHoverCandle,
    commitCompletedDrawing,
    applyZoomBox,
    findHitDrawing,
    setSelectedDrawingId,
    emitContextMenuAt,
    onPriceAxisPlusClick,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clearTimers = () => {
      if (inspectTimerRef.current !== null) {
        window.clearTimeout(inspectTimerRef.current);
        inspectTimerRef.current = null;
      }
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const getLocal = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
        clientX: t.clientX,
        clientY: t.clientY,
      };
    };

    const onTouchStart = (ev: TouchEvent) => {
      const env = touchEnvRef.current;
      lastTouchMsRef.current = Date.now();
      setUsedTouchRecently(true);
      if (ev.touches.length === 0) return;
      ev.preventDefault();
      env.onFocusPane(env.paneIndex);
      const layout = layoutRef.current;
      if (!layout) return;

      clearTimers();

      if (env.rawCandles.length === 0) {
        touchRef.current = null;
        return;
      }

      // 2-finger pinch ALWAYS works (even while a drawing tool is selected!)
      if (ev.touches.length >= 2) {
        setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setHoveredIdx(null);
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        const dx = Math.abs(p1.x - p0.x);
        const dy = Math.abs(p1.y - p0.y);
        touchRef.current = {
          kind: 'pinch',
          startDist: Math.max(12, Math.hypot(dx, dy)),
          startDx: Math.max(8, dx),
          startDy: Math.max(8, dy),
          startMidX: (p0.x + p1.x) / 2,
          startVp: { ...viewportRef.current },
          startMin: layout.mainMin,
          startMax: layout.mainMax,
          rawSpan: layout.rawMainSpan,
        };
        return;
      }

      const p = getLocal(ev.touches[0]);
      const inMainPlot = isPointInMainPlot(p.x, p.y, layout);

      // Only genuinely drag-drawn tools capture 1-finger drag directly:
      // 1) Zoom-In Box
      if (env.canonicalTool === 'zoom_box' && inMainPlot) {
        const box: ZoomBoxOverlay = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        touchRef.current = { kind: 'zoomBox', ...box };
        setZoomBox(box);
        return;
      }

      // 2) Freehand (brush / highlighter)
      const meta = DRAWING_TOOL_REGISTRY[env.canonicalTool];
      if (meta.pointCount === 'freehand' && !env.lockDrawings && inMainPlot) {
        const pt = env.screenToDrawingPoint(p.x, p.y);
        if (pt) {
          const draft: DrawingObject = {
            id: makeDrawingId(),
            symbol: env.symbolTicker,
            timeframe: env.timeframe,
            type: env.canonicalTool as PersistableDrawingType,
            points: [pt],
            style: buildDrawingStyle(env.canonicalTool),
            locked: false,
            visible: true,
            createdAt: Date.now(),
          };
          setDraftDrawing(draft);
          touchRef.current = { kind: 'freehand', drawing: draft };
          return;
        }
      }

      // 3) Measure tool (drag-to-measure OR tap-tap!)
      if (env.canonicalTool === 'measure' && !env.lockDrawings && inMainPlot) {
        const hadDraft = Boolean(draftDrawingRef.current);
        touchRef.current = {
          kind: 'measureDrag',
          startX: p.x,
          startY: p.y,
          lastX: p.x,
          lastY: p.y,
          dragged: false,
          startedWithDraft: hadDraft,
          point1Anchored: hadDraft,
        };
        return;
      }

      // 4) ALL other tools (cursors + ALL click-placed drawing tools):
      //    1-finger drag (> 10px) PANS THE CHART SMOOTHLY; stationary tap (<= 10px) places anchor / selects!
      const zone: 'priceAxis' | 'timeAxis' | 'plot' = isPointInMainPriceAxis(
        p.x,
        p.y,
        layout,
      )
        ? 'priceAxis'
        : isPointInTimeAxis(p.x, p.y, layout)
          ? 'timeAxis'
          : 'plot';

      touchRef.current = {
        kind: 'single',
        startX: p.x,
        startY: p.y,
        clientX: p.clientX,
        clientY: p.clientY,
        moved: false,
        longPressed: false,
        inspecting: false,
        inspectMoved: false,
        zone,
        startVp: { ...viewportRef.current },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };

      const isPlacementTool =
        !isCursorOrUtilityTool(env.activeTool) && !env.lockDrawings;

      // Press-and-hold (260ms) enters TradingView Mobile Crosshair Inspect Mode (cursor mode on plot)
      if (zone === 'plot' && !isPlacementTool && env.canonicalTool !== 'eraser') {
        inspectTimerRef.current = window.setTimeout(() => {
          const curEnv = touchEnvRef.current;
          const st = touchRef.current;
          const lay = layoutRef.current;
          if (!st || st.kind !== 'single' || st.moved || !lay) return;
          if (curEnv.rawCandles.length === 0) return;
          st.inspecting = true;
          const vIdx = Math.round(xToIndex(st.startX, lay));
          const cIdx = Math.max(0, Math.min(curEnv.rawCandles.length - 1, vIdx));
          setCrosshair({ x: st.startX, y: st.startY, barIndex: vIdx, visible: true });
          if (curEnv.isActivePane) {
            setHoveredIdx(cIdx);
            curEnv.onHoverCandle?.(curEnv.rawCandles[cIdx] ?? null, cIdx);
          }

          // Continued stationary hold (~360ms more = 620ms total) opens context menu
          longPressTimerRef.current = window.setTimeout(() => {
            const lpEnv = touchEnvRef.current;
            const cur = touchRef.current;
            if (cur && cur.kind === 'single' && cur.inspecting && !cur.inspectMoved) {
              cur.longPressed = true;
              cur.inspecting = false;
              setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
              setHoveredIdx(null);
              lpEnv.emitContextMenuAt(cur.startX, cur.startY, cur.clientX, cur.clientY);
            }
          }, 360);
        }, 260);
      } else if (zone === 'priceAxis') {
        // Stationary hold (~550ms) on Price Axis opens Price Axis Context Menu
        longPressTimerRef.current = window.setTimeout(() => {
          const lpEnv = touchEnvRef.current;
          const st = touchRef.current;
          if (st && st.kind === 'single' && !st.moved) {
            st.longPressed = true;
            lpEnv.emitContextMenuAt(st.startX, st.startY, st.clientX, st.clientY);
          }
        }, 550);
      }
    };

    const onTouchMove = (ev: TouchEvent) => {
      const env = touchEnvRef.current;
      lastTouchMsRef.current = Date.now();
      const state = touchRef.current;
      const layout = layoutRef.current;
      if (!state || !layout || ev.touches.length === 0 || env.rawCandles.length === 0) return;
      ev.preventDefault();

      // Upgrade 1-finger to 2-finger pinch cleanly
      if (ev.touches.length >= 2 && state.kind !== 'pinch') {
        clearTimers();
        if (state.kind === 'zoomBox') setZoomBox(null);
        setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setHoveredIdx(null);
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        const dx = Math.abs(p1.x - p0.x);
        const dy = Math.abs(p1.y - p0.y);
        touchRef.current = {
          kind: 'pinch',
          startDist: Math.max(12, Math.hypot(dx, dy)),
          startDx: Math.max(8, dx),
          startDy: Math.max(8, dy),
          startMidX: (p0.x + p1.x) / 2,
          startVp: { ...viewportRef.current },
          startMin: layout.mainMin,
          startMax: layout.mainMax,
          rawSpan: layout.rawMainSpan,
        };
        return;
      }

      if (state.kind === 'pinch' && ev.touches.length >= 2) {
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        const curDx = Math.abs(p1.x - p0.x);
        const curDy = Math.abs(p1.y - p0.y);
        const dist = Math.max(12, Math.hypot(curDx, curDy));
        const midX = (p0.x + p1.x) / 2;

        const scale = state.startDist / dist;
        const nextBars = Math.max(
          MIN_VISIBLE_BARS,
          Math.min(MAX_VISIBLE_BARS, state.startVp.visibleBars * scale),
        );
        const anchorRatio = Math.max(
          0,
          Math.min(
            1,
            (state.startMidX - layout.plotLeft) / Math.max(1, layout.plotWidth),
          ),
        );
        const anchorIndex =
          state.startVp.rightIndex - state.startVp.visibleBars * (1 - anchorRatio);
        const panShift =
          (midX - state.startMidX) / Math.max(1, layout.plotWidth / nextBars);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio) - panShift;

        const predominantlyVertical =
          Math.abs(curDy - state.startDy) > Math.abs(curDx - state.startDx) * 1.4;
        let nextManualMin = state.startVp.manualMin ?? null;
        let nextManualMax = state.startVp.manualMax ?? null;
        let nextYZoom = state.startVp.yZoom;
        if (predominantlyVertical || !autoScaleRef.current) {
          if (predominantlyVertical && autoScaleRef.current) {
            autoScaleRef.current = false;
            env.updatePane(env.paneIndex, { autoScale: false });
          }
          const baseSpan = Math.max(1e-12, state.startMax - state.startMin);
          const nextSpan = Math.max(
            state.rawSpan / 20,
            Math.min(
              state.rawSpan * 20,
              baseSpan * (state.startDy / Math.max(8, curDy)),
            ),
          );
          const mid = (state.startMin + state.startMax) / 2;
          nextManualMin = mid - nextSpan / 2;
          nextManualMax = mid + nextSpan / 2;
          nextYZoom = Math.max(0.15, Math.min(12, state.rawSpan / nextSpan));
        }

        setViewport((vp) => ({
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(
            6,
            Math.min(maxRightBound(env.rawCandles.length, nextBars), nextRight),
          ),
          yZoom: nextYZoom,
          manualMin: nextManualMin,
          manualMax: nextManualMax,
        }));
        return;
      }

      const p = getLocal(ev.touches[0]);

      if (state.kind === 'zoomBox') {
        state.x2 = Math.max(layout.plotLeft, Math.min(layout.plotRight, p.x));
        state.y2 = Math.max(layout.mainRect.top, Math.min(layout.mainRect.bottom, p.y));
        setZoomBox({ x1: state.x1, y1: state.y1, x2: state.x2, y2: state.y2 });
        return;
      }

      if (state.kind === 'freehand') {
        const pt = env.screenToDrawingPoint(p.x, p.y);
        if (pt) {
          state.drawing = {
            ...state.drawing,
            points: [...state.drawing.points, pt],
          };
          setDraftDrawing(state.drawing);
        }
        return;
      }

      if (state.kind === 'measureDrag') {
        state.lastX = Math.max(layout.plotLeft, Math.min(layout.plotRight, p.x));
        state.lastY = Math.max(layout.mainRect.top, Math.min(layout.mainRect.bottom, p.y));
        const dist = Math.hypot(p.x - state.startX, p.y - state.startY);
        if (!state.dragged && dist > 10) {
          state.dragged = true;
          if (!state.point1Anchored) {
            state.point1Anchored = true;
            placeDrawingPointAtRef.current(state.startX, state.startY);
          }
        }
        if (state.dragged || state.startedWithDraft) {
          const pt = env.screenToDrawingPoint(state.lastX, state.lastY);
          if (pt) {
            setDraftDrawing((prev) => {
              if (!prev) return null;
              return { ...prev, points: prev.points.slice(0, -1).concat(pt) };
            });
          }
        }
        return;
      }

      if (state.kind === 'single') {
        if (state.longPressed) return;
        const dx = p.x - state.startX;
        const dy = p.y - state.startY;

        // If already in Mobile Crosshair Inspect Mode -> scrub crosshair smoothly without panning!
        if (state.inspecting) {
          if (!state.inspectMoved && Math.hypot(dx, dy) > 8) {
            state.inspectMoved = true;
            if (longPressTimerRef.current !== null) {
              window.clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }
          const clampedX = Math.max(layout.plotLeft, Math.min(layout.plotRight, p.x));
          const clampedY = Math.max(0, Math.min(layout.timeAxisTop, p.y));
          const vIdx = Math.round(xToIndex(clampedX, layout));
          const cIdx = Math.max(0, Math.min(env.rawCandles.length - 1, vIdx));
          setCrosshair({ x: clampedX, y: clampedY, barIndex: vIdx, visible: true });
          if (env.isActivePane) {
            setHoveredIdx(cIdx);
            env.onHoverCandle?.(env.rawCandles[cIdx] ?? null, cIdx);
          }
          return;
        }

        const slop =
          !isCursorOrUtilityTool(env.activeTool) || env.canonicalTool === 'eraser'
            ? 10
            : 7;
        if (!state.moved && Math.hypot(dx, dy) > slop) {
          state.moved = true;
          clearTimers();
          // TradingView Mobile: normal 1-finger pan hides crosshair immediately (zero stuck pills!)
          setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          setHoveredIdx(null);
          if (env.isActivePane) env.onHoverCandle?.(null, null);
        }
        if (!state.moved) return;

        if (state.zone === 'priceAxis') {
          if (autoScaleRef.current) {
            autoScaleRef.current = false;
            env.updatePane(env.paneIndex, { autoScale: false });
          }
          const baseSpan = Math.max(1e-12, state.startMax - state.startMin);
          const nextSpan = Math.max(
            state.rawSpan / 20,
            Math.min(state.rawSpan * 20, baseSpan * Math.exp(dy * 0.006)),
          );
          const mid = (state.startMin + state.startMax) / 2;
          setViewport((vp) => ({
            ...vp,
            yZoom: Math.max(0.15, Math.min(12, state.rawSpan / nextSpan)),
            manualMin: mid - nextSpan / 2,
            manualMax: mid + nextSpan / 2,
          }));
        } else if (state.zone === 'timeAxis') {
          const nextBars = Math.max(
            MIN_VISIBLE_BARS,
            Math.min(MAX_VISIBLE_BARS, state.startVp.visibleBars * Math.exp(-dx * 0.005)),
          );
          setViewport((vp) => ({ ...vp, visibleBars: nextBars }));
        } else {
          const deltaBars = dx / Math.max(1, layout.barStepPx);
          const nextRight = Math.max(
            6,
            Math.min(
              maxRightBound(env.rawCandles.length, state.startVp.visibleBars),
              state.startVp.rightIndex - deltaBars,
            ),
          );
          if (autoScaleRef.current) {
            setViewport((vp) => ({ ...vp, rightIndex: nextRight }));
          } else {
            const ySign = env.invertScale ? -1 : 1;
            const span = Math.max(1e-12, state.startMax - state.startMin);
            const deltaScaled =
              ((ySign * dy) / Math.max(80, layout.mainRect.height)) * span;
            setViewport((vp) => ({
              ...vp,
              rightIndex: nextRight,
              manualMin: state.startMin + deltaScaled,
              manualMax: state.startMax + deltaScaled,
            }));
          }
        }
      }
    };

    const onTouchEnd = () => {
      const env = touchEnvRef.current;
      lastTouchMsRef.current = Date.now();
      clearTimers();
      const state = touchRef.current;
      touchRef.current = null;
      if (!state) return;

      if (state.kind === 'zoomBox') {
        setZoomBox(null);
        env.applyZoomBox({ x1: state.x1, y1: state.y1, x2: state.x2, y2: state.y2 });
        return;
      }

      if (state.kind === 'freehand') {
        if (state.drawing.points.length >= 2) {
          env.commitCompletedDrawing(state.drawing);
        } else {
          setDraftDrawing(null);
        }
        return;
      }

      if (state.kind === 'measureDrag') {
        const targetX = state.dragged ? state.lastX : state.startX;
        const targetY = state.dragged ? state.lastY : state.startY;
        placeDrawingPointAtRef.current(targetX, targetY);
        return;
      }

      // Lifting finger from Mobile Inspect Mode cleanly dismisses crosshair (zero stuck pills!)
      if (state.kind === 'single' && state.inspecting) {
        setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setHoveredIdx(null);
        if (env.isActivePane) env.onHoverCandle?.(null, null);
        return;
      }

      if (state.kind === 'single' && !state.moved && !state.longPressed) {
        const layout = layoutRef.current;
        if (!layout || env.rawCandles.length === 0) return;

        // Detect double-tap on Price Axis or Time Axis (420ms window + 44px proximity)
        const now = Date.now();
        const isDoubleTap =
          now - lastTapRef.current.time <= 420 &&
          lastTapRef.current.zone === state.zone &&
          Math.hypot(
            state.startX - lastTapRef.current.x,
            state.startY - lastTapRef.current.y,
          ) <= 44;
        lastTapRef.current = isDoubleTap
          ? { time: 0, zone: 'plot', x: 0, y: 0 }
          : { time: now, zone: state.zone, x: state.startX, y: state.startY };

        if (isDoubleTap && state.zone === 'priceAxis') {
          autoScaleRef.current = true;
          env.updatePane(env.paneIndex, { autoScale: true });
          setViewport((vp) => ({
            ...vp,
            yZoom: 1,
            yOffset: 0,
            manualMin: null,
            manualMax: null,
          }));
          return;
        }
        if (isDoubleTap && state.zone === 'timeAxis') {
          setViewport((vp) => ({
            ...vp,
            visibleBars: 120,
            rightIndex: Math.max(120, env.rawCandles.length + env.rightMarginBars),
          }));
          return;
        }

        // Tap on floating `+` button
        if (
          layout.plusButtonRect &&
          distanceBetween(
            { x: state.startX, y: state.startY },
            layout.plusButtonRect,
          ) <=
            layout.plusButtonRect.radius + 4
        ) {
          env.onPriceAxisPlusClick?.({
            clientX: state.clientX,
            clientY: state.clientY,
            price: layout.plusButtonRect.price,
            symbolId: env.symbolTicker,
            paneIndex: env.paneIndex,
          });
          return;
        }

        // Stationary tap with eraser or click-placed drawing tool places anchor point cleanly!
        if (placeDrawingPointAtRef.current(state.startX, state.startY)) {
          return;
        }

        // Cursor mode quick tap: dismiss any crosshair & select/deselect drawing (NEVER leaves frozen crosshair!)
        setCrosshair((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setHoveredIdx(null);
        if (env.isActivePane) env.onHoverCandle?.(null, null);
        if (!env.lockDrawings) {
          const hit = env.findHitDrawing(state.startX, state.startY, layout, 12, false);
          env.setSelectedDrawingId(hit ? hit.drawing.id : null);
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      clearTimers();
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // ======================== SILKY SMOOTH WHEEL ZOOM & TRACKPAD HORIZONTAL PAN ========================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const layout = layoutRef.current;
      if (!layout || rawCandles.length === 0) return;

      // 1) Wheel OVER MAIN Price Axis -> VERTICAL ZOOM ONLY (sub-pane price axis ignored!)
      if (isPointInMainPriceAxis(x, y, layout)) {
        if (autoScaleRef.current) {
          autoScaleRef.current = false;
          updatePane(paneIndex, { autoScale: false });
        }
        const clampedDy = Math.max(-120, Math.min(120, ev.deltaY));
        const spanFactor = Math.exp(clampedDy * 0.0022);
        const clampedY = Math.max(
          layout.mainRect.top,
          Math.min(layout.mainRect.bottom, y),
        );
        const f = layout.invertScale
          ? (clampedY - layout.mainRect.top) / Math.max(1, layout.mainRect.height)
          : (layout.mainRect.bottom - clampedY) / Math.max(1, layout.mainRect.height);

        setViewport((vp) => {
          const curMin =
            vp.manualMin != null && vp.manualMax != null
              ? vp.manualMin
              : layout.mainMin;
          const curMax =
            vp.manualMin != null && vp.manualMax != null
              ? vp.manualMax
              : layout.mainMax;
          const curSpan = Math.max(1e-12, curMax - curMin);
          const nextSpan = Math.max(
            layout.rawMainSpan / 20,
            Math.min(layout.rawMainSpan * 20, curSpan * spanFactor),
          );
          const cursorScaled = curMin + f * curSpan;
          const nextMin = cursorScaled - f * nextSpan;
          const nextMax = cursorScaled + (1 - f) * nextSpan;
          return {
            ...vp,
            yZoom: Math.max(0.15, Math.min(12, layout.rawMainSpan / nextSpan)),
            manualMin: nextMin,
            manualMax: nextMax,
          };
        });
        return;
      }

      // Ignore vertical wheel inside sub-pane price axis so it never distorts main price scale
      if (isPointInPriceAxis(x, y, layout)) {
        return;
      }

      // 2) Two-finger horizontal trackpad swipe -> smooth horizontal pan!
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) && Math.abs(ev.deltaX) > 2) {
        const deltaBars = ev.deltaX / Math.max(1, layout.barStepPx);
        setViewport((vp) => ({
          ...vp,
          rightIndex: Math.max(
            6,
            Math.min(
              maxRightBound(rawCandles.length, vp.visibleBars),
              vp.rightIndex + deltaBars,
            ),
          ),
        }));
        return;
      }

      // 3) Smooth proportional exponential zoom (works silky-smooth on both wheel clicks & trackpads)
      const clampedDy = Math.max(-120, Math.min(120, ev.deltaY));
      const factor = Math.exp(clampedDy * 0.0018);

      // Over Time Axis -> anchored to right edge
      if (isPointInTimeAxis(x, y, layout)) {
        setViewport((vp) => ({
          ...vp,
          visibleBars: Math.max(
            MIN_VISIBLE_BARS,
            Math.min(MAX_VISIBLE_BARS, vp.visibleBars * factor),
          ),
        }));
        return;
      }

      // Over Main Plot / Sub-Panes -> anchored cleanly to cursor X
      const anchorRatio = Math.max(
        0,
        Math.min(1, (x - layout.plotLeft) / Math.max(1, layout.plotWidth)),
      );

      setViewport((vp) => {
        const nextBars = Math.max(
          MIN_VISIBLE_BARS,
          Math.min(MAX_VISIBLE_BARS, vp.visibleBars * factor),
        );
        const anchorIndex = vp.rightIndex - vp.visibleBars * (1 - anchorRatio);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio);
        return {
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(
            6,
            Math.min(maxRightBound(rawCandles.length, nextBars), nextRight),
          ),
        };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [rawCandles.length, paneIndex, updatePane]);

  const handleMouseDown = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    if (isSyntheticMouseAfterTouch()) return;
    onFocusPane(paneIndex);

    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout || rawCandles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Middle-click OR Space+Left-click -> pan freely even while a drawing tool is active!
    if (ev.button === 1 || (ev.button === 0 && spaceHeldRef.current)) {
      ev.preventDefault();
      setIsDraggingPan(true);
      dragRef.current = {
        kind: 'pan',
        startX: x,
        startY: y,
        startVp: { ...viewport },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };
      return;
    }

    if (ev.button !== 0) return;

    // 0) Price Axis Floating `+` Button click (intercept before price-axis drag!)
    if (
      layout.plusButtonRect &&
      distanceBetween({ x, y }, layout.plusButtonRect) <=
        layout.plusButtonRect.radius + 2
    ) {
      onPriceAxisPlusClick?.({
        clientX: ev.clientX,
        clientY: ev.clientY,
        price: layout.plusButtonRect.price,
        symbolId: symbol.ticker,
        paneIndex,
      });
      return;
    }

    // 0b) Horizontal Sub-Pane Splitter Drag
    if (isNearSubPaneSplitter(x, y, layout)) {
      dragRef.current = { kind: 'subResize' };
      return;
    }

    // 1) MAIN Price Axis vertical zoom drag (sub-pane price axis excluded!)
    if (isPointInMainPriceAxis(x, y, layout)) {
      dragRef.current = {
        kind: 'priceZoom',
        startX: x,
        startY: y,
        startVp: { ...viewport },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };
      if (autoScaleRef.current) {
        autoScaleRef.current = false;
        updatePane(paneIndex, { autoScale: false });
      }
      return;
    }

    if (isPointInPriceAxis(x, y, layout)) {
      return;
    }

    // 2) Time Axis horizontal zoom drag
    if (isPointInTimeAxis(x, y, layout)) {
      dragRef.current = {
        kind: 'timeZoom',
        startX: x,
        startY: y,
        startVp: { ...viewport },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };
      return;
    }

    const inMainPlot = isPointInMainPlot(x, y, layout);

    // 3) Zoom-In Box drag tool
    if (inMainPlot && canonicalTool === 'zoom_box') {
      const box: ZoomBoxOverlay = { x1: x, y1: y, x2: x, y2: y };
      dragRef.current = { kind: 'zoomBox', ...box };
      setZoomBox(box);
      return;
    }

    // 4) Bar Replay Shift+Click jump
    if (inMainPlot && isActivePane && replay.active && ev.shiftKey) {
      const idx = Math.round(xToIndex(x, layout));
      setReplayBarIndex(idx);
      return;
    }

    // 4b) Quick Shift+Click Measure (when in cursor mode & not in replay; 2nd click completes even without holding Shift!)
    const activeMeasureDraft =
      draftDrawingRef.current !== null &&
      normalizeDrawingTool(draftDrawingRef.current.type) === 'measure';
    if (
      inMainPlot &&
      !lockDrawings &&
      (activeMeasureDraft || (ev.shiftKey && isCursorOrUtilityTool(activeTool)))
    ) {
      if (placeDrawingPointAt(x, y, 'measure', ev.ctrlKey)) {
        return;
      }
    }

    // 5) Drawing placement (or Eraser deletion) when a drawing tool is active
    if (placeDrawingPointAt(x, y, undefined, ev.ctrlKey)) {
      return;
    }

    // 6) Hit-test existing drawings for selection & dragging
    if (inMainPlot && !lockDrawings) {
      const hit = findHitDrawing(x, y, layout, 8, false);
      if (hit) {
        setSelectedDrawingId(hit.drawing.id);
        const startPt = screenToDrawingPoint(x, y, ev.ctrlKey);
        if (startPt) {
          dragRef.current = {
            kind: 'dragDrawing',
            drawingId: hit.drawing.id,
            handleIndex: hit.handleIndex,
            startPt,
            origPoints: hit.drawing.points.map((p) => ({ ...p })),
          };
        }
        return;
      }
      setSelectedDrawingId(null);
    }

    // 7) Default: Pan chart horizontally (and TRUE 2D FREE PAN vertically when !autoScale!)
    setIsDraggingPan(true);
    dragRef.current = {
      kind: 'pan',
      startX: x,
      startY: y,
      startVp: { ...viewport },
      startMin: layout.mainMin,
      startMax: layout.mainMax,
      rawSpan: layout.rawMainSpan,
    };
  };

  const handleMouseMove = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    if (isSyntheticMouseAfterTouch()) return;
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Update hover cursor zone
    if (
      layout.plusButtonRect &&
      distanceBetween({ x, y }, layout.plusButtonRect) <=
        layout.plusButtonRect.radius + 2
    ) {
      setHoverZone('plusButton');
    } else if (isNearSubPaneSplitter(x, y, layout)) {
      setHoverZone('subSplitter');
    } else if (isPointInMainPriceAxis(x, y, layout)) {
      setHoverZone('priceAxis');
    } else if (isPointInTimeAxis(x, y, layout)) {
      setHoverZone('timeAxis');
    } else {
      setHoverZone('plot');
    }

    if (rawCandles.length === 0) return;

    // Unclamped virtualBarIndex so crosshair snaps cleanly into future whitespace right of latest candle!
    const virtualBarIndex = Math.round(xToIndex(x, layout));
    setCrosshair({ x, y, barIndex: virtualBarIndex, visible: true });

    if (onCrosshairTimeChange && x >= layout.plotLeft && x <= layout.plotRight) {
      onCrosshairTimeChange(indexToTime(virtualBarIndex, rawCandles));
    }

    const clampedIdx = Math.max(0, Math.min(rawCandles.length - 1, virtualBarIndex));
    if (clampedIdx !== hoveredIdx) {
      setHoveredIdx(clampedIdx);
      if (isActivePane) {
        onHoverCandle?.(rawCandles[clampedIdx] ?? null, clampedIdx);
      }
    }

    // Eraser hover highlight
    if (canonicalTool === 'eraser' && !dragRef.current) {
      if (isPointInMainPlot(x, y, layout) && !lockDrawings) {
        const hit = findHitDrawing(x, y, layout, 10, false);
        setEraserHoveredId(hit ? hit.drawing.id : null);
      } else {
        setEraserHoveredId(null);
      }
    }

    // Update ghost draft drawing preview
    if (draftDrawing && (!dragRef.current || dragRef.current.kind !== 'freehand')) {
      const pt = screenToDrawingPoint(x, y, ev.ctrlKey);
      if (pt) {
        setDraftDrawing((prev) => {
          if (!prev) return null;
          const nextPts = prev.points.slice(0, -1).concat(pt);
          return { ...prev, points: nextPts };
        });
      }
    }

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'subResize') {
      const usableH = Math.max(100, layout.timeAxisTop);
      const nextSubH = usableH - y;
      const nextRatio = Math.max(0.12, Math.min(0.62, nextSubH / usableH));
      setSubPaneHeightRatio(nextRatio);
      return;
    }

    if (drag.kind === 'pan') {
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const deltaBars = dx / Math.max(1, layout.barStepPx);
      const nextRight = Math.max(
        6,
        Math.min(
          maxRightBound(rawCandles.length, drag.startVp.visibleBars),
          drag.startVp.rightIndex - deltaBars,
        ),
      );
      if (autoScaleRef.current) {
        setViewport((vp) => ({ ...vp, rightIndex: nextRight }));
      } else {
        const ySign = invertScale ? -1 : 1;
        const span = Math.max(1e-12, drag.startMax - drag.startMin);
        const deltaScaled =
          ((ySign * dy) / Math.max(80, layout.mainRect.height)) * span;
        setViewport((vp) => ({
          ...vp,
          rightIndex: nextRight,
          manualMin: drag.startMin + deltaScaled,
          manualMax: drag.startMax + deltaScaled,
        }));
      }
    } else if (drag.kind === 'priceZoom') {
      const dy = y - drag.startY;
      const baseSpan = Math.max(1e-12, drag.startMax - drag.startMin);
      const nextSpan = Math.max(
        drag.rawSpan / 20,
        Math.min(drag.rawSpan * 20, baseSpan * Math.exp(dy * 0.006)),
      );
      const mid = (drag.startMin + drag.startMax) / 2;
      setViewport((vp) => ({
        ...vp,
        yZoom: Math.max(0.15, Math.min(12, drag.rawSpan / nextSpan)),
        manualMin: mid - nextSpan / 2,
        manualMax: mid + nextSpan / 2,
      }));
    } else if (drag.kind === 'timeZoom') {
      const dx = x - drag.startX;
      const nextBars = Math.max(
        MIN_VISIBLE_BARS,
        Math.min(MAX_VISIBLE_BARS, drag.startVp.visibleBars * Math.exp(-dx * 0.005)),
      );
      setViewport((vp) => ({ ...vp, visibleBars: nextBars }));
    } else if (drag.kind === 'zoomBox') {
      drag.x2 = Math.max(layout.plotLeft, Math.min(layout.plotRight, x));
      drag.y2 = Math.max(layout.mainRect.top, Math.min(layout.mainRect.bottom, y));
      setZoomBox({ x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 });
    } else if (drag.kind === 'freehand') {
      const pt = screenToDrawingPoint(x, y, ev.ctrlKey);
      if (pt) {
        drag.drawing = {
          ...drag.drawing,
          points: [...drag.drawing.points, pt],
        };
        setDraftDrawing(drag.drawing);
      }
    } else if (drag.kind === 'dragDrawing') {
      const curPt = screenToDrawingPoint(x, y, ev.ctrlKey);
      if (!curPt) return;
      if (drag.handleIndex !== null) {
        const nextPts = drag.origPoints.map((p, idx) =>
          idx === drag.handleIndex ? curPt : p,
        );
        updateDrawing(symbol.ticker, drag.drawingId, { points: nextPts });
      } else {
        const dt = curPt.time - drag.startPt.time;
        const dp = curPt.price - drag.startPt.price;
        const nextPts = drag.origPoints.map((p) => ({
          time: p.time + dt,
          price: p.price + dp,
        }));
        updateDrawing(symbol.ticker, drag.drawingId, { points: nextPts });
      }
    }
  };

  const handleMouseUp = () => {
    if (isSyntheticMouseAfterTouch()) return;
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDraggingPan(false);

    if (drag && drag.kind === 'freehand') {
      if (drag.drawing.points.length >= 2) {
        commitCompletedDrawing(drag.drawing);
      } else {
        setDraftDrawing(null);
      }
    } else if (drag && drag.kind === 'zoomBox') {
      setZoomBox(null);
      applyZoomBox({ x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 });
    }
  };

  const handleMouseLeave = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDraggingPan(false);
    if (drag?.kind === 'zoomBox') setZoomBox(null);
    setCrosshair((prev) => ({ ...prev, visible: false }));
    setHoveredIdx(null);
    setEraserHoveredId(null);
    onCrosshairTimeChange?.(null);
    if (isActivePane) {
      onHoverCandle?.(null, null);
    }
  };

  const handleDoubleClick = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    if (isSyntheticMouseAfterTouch()) return;
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout || rawCandles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // 0) Double-click on sub-pane splitter resets default sub-pane height
    if (isNearSubPaneSplitter(x, y, layout)) {
      setSubPaneHeightRatio(undefined);
      return;
    }

    // 1) Double-click on MAIN Price Axis -> resets autoScale = true
    if (isPointInMainPriceAxis(x, y, layout)) {
      autoScaleRef.current = true;
      updatePane(paneIndex, { autoScale: true });
      setViewport((vp) => ({
        ...vp,
        yZoom: 1,
        yOffset: 0,
        manualMin: null,
        manualMax: null,
      }));
      return;
    }

    // 2) Double-click on Time Axis -> resets default visibleBars & rightIndex
    if (isPointInTimeAxis(x, y, layout)) {
      setViewport((vp) => ({
        ...vp,
        visibleBars: 120,
        rightIndex: Math.max(120, rawCandles.length + rightMarginBars),
      }));
      return;
    }

    // 3) Double-click finishes 'path' multi-point drawing
    if (draftDrawing && normalizeDrawingTool(draftDrawing.type) === 'path') {
      const pts = draftDrawing.points.slice(0, -1);
      if (pts.length >= 2) {
        commitCompletedDrawing({ ...draftDrawing, points: pts });
      } else {
        setDraftDrawing(null);
      }
      return;
    }

    // 4) Double-click on an existing drawing -> opens DrawingSettingsModal!
    if (isPointInMainPlot(x, y, layout)) {
      const hit = findHitDrawing(x, y, layout, 9, true);
      if (hit) {
        setSelectedDrawingId(hit.drawing.id);
        openDrawingSettings(hit.drawing.id);
      }
    }
  };

  const handleContextMenu = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    ev.preventDefault();
    onFocusPane(paneIndex);

    // 1:1 TradingView: Right-click mid-drawing or mid-zoombox cancels draft cleanly instead of opening context menu!
    if (draftDrawing || zoomBox) {
      setDraftDrawing(null);
      setZoomBox(null);
      dragRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    emitContextMenuAt(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      ev.clientX,
      ev.clientY,
    );
  };

  const commitTextAnnotation = () => {
    if (!textInputState) return;
    const canonical = normalizeDrawingTool(textInputState.toolType);
    const fallback =
      canonical === 'callout'
        ? 'Fumetto'
        : canonical === 'price_note'
          ? ''
          : canonical === 'note'
            ? 'Nota'
            : 'Testo';
    const text = textInputState.value.trim() || fallback;
    if (text || canonical === 'price_note') {
      commitCompletedDrawing({
        id: makeDrawingId(),
        symbol: symbol.ticker,
        timeframe: pane.timeframe,
        type: textInputState.toolType,
        points: textInputState.points,
        text: text || undefined,
        style: {
          ...buildDrawingStyle(canonical),
          fontSize: 13,
        },
        locked: false,
        visible: true,
        createdAt: Date.now(),
      });
    }
    setTextInputState(null);
  };

  // Quick Buy/Sell handler
  const handleQuickOrder = (side: 'buy' | 'sell') => {
    const price = anchorClose;
    placeOrder(
      {
        symbol: symbol.ticker,
        side,
        type: 'market',
        quantity: 1,
      },
      price,
    );
    if (!chartSettings.trading.instantOrderPlacement) {
      setBottomPanel('trading');
    }
  };

  // Legend OHLCV metrics (safe when rawCandles is [] while real data hydrates)
  const prevBar =
    legendRefIdx !== null && legendRefIdx > 0
      ? rawCandles[legendRefIdx - 1]
      : undefined;
  const barDelta = legendBar
    ? legendBar.close - (prevBar?.close ?? legendBar.open)
    : 0;
  const barDeltaPct =
    legendBar && (prevBar?.close ?? legendBar.open) > 0
      ? (barDelta / (prevBar?.close ?? legendBar.open)) * 100
      : 0;
  const barIsUp = legendBar ? legendBar.close >= legendBar.open : true;
  const spreadVal = Math.max(0, askPrice - bidPrice);

  const selectedDrawing = useMemo(
    () =>
      isActivePane && selectedDrawingId
        ? paneDrawings.find((d) => d.id === selectedDrawingId) ?? null
        : null,
    [isActivePane, selectedDrawingId, paneDrawings],
  );

  // Dynamic cursor style
  const cursorStyle = (() => {
    if (hoverZone === 'plusButton') return 'pointer';
    if (hoverZone === 'subSplitter') return 'ns-resize';
    if (hoverZone === 'priceAxis') return 'ns-resize';
    if (hoverZone === 'timeAxis') return 'ew-resize';
    if (isDraggingPan) return 'grabbing';
    if (spaceHeld) return 'grab';
    if (canonicalTool === 'zoom_box') return 'zoom-in';
    if (canonicalTool === 'eraser') return eraserHoveredId ? 'pointer' : 'cell';
    if (canonicalTool === 'arrow_cursor') return 'default';
    if (canonicalTool === 'dot') return crosshair.visible ? 'none' : 'default';
    return 'crosshair';
  })();

  // Active-tool mobile / mid-draft hint pill info
  const activeToolMeta = DRAWING_TOOL_REGISTRY[canonicalTool];
  const isPlacementToolActive = !isCursorOrUtilityTool(activeTool) && !lockDrawings;
  const showToolHintPill =
    isActivePane &&
    !replay.active &&
    ((isPlacementToolActive && (usedTouchRecently || size.width <= 900)) ||
      draftDrawing !== null);
  const toolHintParts = (() => {
    if (!showToolHintPill) return { primary: '', secondary: '' };
    const isTouchOrCompact = usedTouchRecently || size.width <= 900;
    if (draftDrawing) {
      const draftTool = normalizeDrawingTool(draftDrawing.type);
      const draftMeta = DRAWING_TOOL_REGISTRY[draftTool];
      const isDraftClickTool = !DRAG_CAPTURED_TOOLS.has(draftTool);
      const placed = Math.max(1, draftDrawing.points.length - 1);
      const total =
        typeof draftMeta.pointCount === 'number'
          ? draftMeta.pointCount
          : null;
      const stepStr = total
        ? isTouchOrCompact
          ? `Tocca punto ${placed + 1}/${total}`
          : `Punto ${placed + 1}/${total}`
        : 'Doppio clic o Invio per finire';
      return {
        primary: `${draftMeta.labelIt} · ${stepStr}`,
        secondary: isDraftClickTool && isTouchOrCompact ? 'Trascina per spostarti' : '',
      };
    }
    if (DRAG_CAPTURED_TOOLS.has(canonicalTool)) {
      return {
        primary: activeToolMeta.labelIt,
        secondary: 'Trascina sul grafico',
      };
    }
    const total =
      typeof activeToolMeta.pointCount === 'number'
        ? activeToolMeta.pointCount
        : null;
    return {
      primary: `${activeToolMeta.labelIt} · ${
        total && total > 1 ? `Tocca punto 1/${total}` : 'Tocca per posizionare'
      }`,
      secondary: 'Trascina per spostarti',
    };
  })();

  // Show "Torna al presente" (>>) when scrolled > 8 bars left into history
  const showJumpRealtime =
    rawCandles.length > 0 &&
    !replay.active &&
    viewport.rightIndex < rawCandles.length - 8;

  // Live Status Line settings
  const statusCfg = chartSettings.statusLine;
  const showBuySellButtons =
    pane.showBuySellButtons &&
    statusCfg.showBuySellButtons &&
    chartSettings.trading.showBuySellButtons;
  const legendBgStyle =
    statusCfg.bgOpacity > 0
      ? {
          backgroundColor:
            theme === 'dark'
              ? `rgba(0, 0, 0, ${Math.min(0.85, statusCfg.bgOpacity * 0.72)})`
              : `rgba(255, 255, 255, ${Math.min(0.92, statusCfg.bgOpacity * 0.85)})`,
          borderRadius: 6,
          padding: '2px 5px',
        }
      : undefined;

  const titlePrimary =
    statusCfg.titleMode === 'ticker'
      ? symbol.ticker
      : statusCfg.titleMode === 'description'
        ? symbol.name
        : `${symbol.ticker} · ${symbol.name}`;

  const sourceBadgeMeta: Record<
    DataSourceKind,
    { label: string; title: string; className: string }
  > = {
    binance: {
      label: 'LIVE BINANCE',
      title: 'Dati in tempo reale via Binance WebSocket & REST API',
      className: 'sc-source-pill sc-source-pill--binance',
    },
    yahoo: {
      label: 'LIVE YAHOO',
      title: 'Dati di mercato in tempo reale via Yahoo Finance',
      className: 'sc-source-pill sc-source-pill--yahoo',
    },
    snapshot: {
      label: 'DATI REALI',
      title: 'Candele storiche e quotazione reale da snapshot di mercato',
      className: 'sc-source-pill sc-source-pill--snapshot',
    },
    simulated: {
      label: 'SIMULATO',
      title: 'Feed simulato locale (fallback offline)',
      className: 'sc-source-pill sc-source-pill--simulated',
    },
  };
  const badge = sourceBadgeMeta[paneSource];

  const legendPositionStyle =
    priceScalePosition === 'left'
      ? { left: dynamicPriceAxisWidth + 10, right: 10 }
      : { left: 10, right: dynamicPriceAxisWidth + 10 };

  // Compute visible start time for Compare % delta legend readout
  const visStartIdx = Math.max(
    0,
    Math.min(
      Math.max(0, rawCandles.length - 1),
      Math.floor(viewport.rightIndex - viewport.visibleBars),
    ),
  );
  const visStartTime = rawCandles[visStartIdx]?.time;

  return (
    <div
      ref={containerRef}
      className={`sc-pane-wrapper ${isMultiChart ? 'sc-pane-wrapper--multi' : ''} ${
        isActivePane ? 'sc-pane-wrapper--active' : ''
      }`}
      onMouseDown={() => {
        if (!isActivePane) onFocusPane(paneIndex);
      }}
    >
      <canvas
        ref={canvasRef}
        className="sc-canvas"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* ======================== REAL-DATA LOADING OVERLAY ======================== */}
      {isPaneLoading && rawCandles.length === 0 && (
        <div className="sc-loading-overlay" role="status" aria-live="polite">
          <div className="sc-loading-card">
            <span className="sc-loading-ring" aria-hidden="true" />
            <span className="sc-loading-title">Caricamento dati reali…</span>
            <span className="sc-loading-sub">
              {symbol.ticker} · {pane.timeframe} · {symbol.exchange}
            </span>
          </div>
        </div>
      )}

      {/* ======================== TOP-LEFT OHLCV & INDICATOR LEGEND ======================== */}
      <div className="sc-legend-overlay" style={legendPositionStyle}>
        <div className="sc-legend-main-row" style={legendBgStyle}>
          <button
            type="button"
            className="sc-legend-title-btn"
            title="Cambia simbolo"
            onClick={() => {
              onFocusPane(paneIndex);
              openModal('symbolSearch');
            }}
          >
            {statusCfg.showLogo && (
              <span
                className="sc-symbol-dot"
                style={{ background: symbol.logoColor }}
              >
                {symbol.logoText.slice(0, 2)}
              </span>
            )}
            <span className="sc-legend-name-full">{titlePrimary}</span>
            <span className="sc-legend-name-short">{symbol.ticker}</span>
            <span className="sc-legend-meta">
              · {pane.timeframe}{' '}
              <span className="sc-legend-exchange">· {symbol.exchange}</span>
            </span>
          </button>

          {statusCfg.showOpenMarketStatus &&
            !(isPaneLoading && rawCandles.length === 0) && (
              <span className={badge.className} title={badge.title}>
                <span className="sc-source-dot" />
                {badge.label}
              </span>
            )}

          {isPaneLoading && rawCandles.length > 0 && (
            <span className="sc-loading-pill" role="status" aria-live="polite">
              <span className="sc-loading-spinner" />
              Aggiornamento...
            </span>
          )}

          {legendBar && (statusCfg.showOhlc || statusCfg.showBarChange) && (
            <div className="sc-ohlc-row">
              {statusCfg.showOhlc && (
                <>
                  <span className="sc-ohlc-item sc-ohlc-verbose">
                    <span className="sc-ohlc-lbl">Aper.</span>
                    <span
                      className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}
                    >
                      {formatPrice(legendBar.open, effectivePrecision)}
                    </span>
                  </span>
                  <span className="sc-ohlc-item sc-ohlc-verbose">
                    <span className="sc-ohlc-lbl">Max.</span>
                    <span
                      className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}
                    >
                      {formatPrice(legendBar.high, effectivePrecision)}
                    </span>
                  </span>
                  <span className="sc-ohlc-item sc-ohlc-verbose">
                    <span className="sc-ohlc-lbl">Min.</span>
                    <span
                      className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}
                    >
                      {formatPrice(legendBar.low, effectivePrecision)}
                    </span>
                  </span>
                  <span className="sc-ohlc-item">
                    <span className="sc-ohlc-lbl sc-ohlc-verbose">Chius.</span>
                    <span
                      className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}
                    >
                      {formatPrice(legendBar.close, effectivePrecision)}
                    </span>
                  </span>
                </>
              )}
              {statusCfg.showBarChange && (
                <span
                  className={barDelta >= 0 ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}
                >
                  {barDelta >= 0 ? '+' : ''}
                  {formatPrice(barDelta, effectivePrecision)} (
                  {formatPercent(barDeltaPct)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Buy / Sell Quick Buttons (VENDI / spread / ACQUISTA) */}
        {showBuySellButtons && (
          <div className="sc-buysell-row">
            <button
              type="button"
              className="sc-order-btn sc-order-btn--sell"
              title={`Vendi 1 ${symbol.ticker} a mercato (Paper Trading)`}
              onClick={() => handleQuickOrder('sell')}
            >
              <span className="sc-order-price">
                {formatPrice(bidPrice, effectivePrecision)}
              </span>
              <span className="sc-order-tag">VENDI</span>
            </button>
            <span className="sc-spread-label" title="Spread bid/ask">
              {formatPrice(spreadVal, effectivePrecision)}
            </span>
            <button
              type="button"
              className="sc-order-btn sc-order-btn--buy"
              title={`Acquista 1 ${symbol.ticker} a mercato (Paper Trading)`}
              onClick={() => handleQuickOrder('buy')}
            >
              <span className="sc-order-price">
                {formatPrice(askPrice, effectivePrecision)}
              </span>
              <span className="sc-order-tag">ACQUISTA</span>
            </button>
          </div>
        )}

        {/* Volume + Active Indicators + Comparison Symbols Rows */}
        <div className="sc-ind-list">
          {pane.showVolume && statusCfg.showVolume && legendBar && (
            <div className="sc-ind-row">
              <span>Vol</span>
              <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                {formatVolume(legendBar.volume)}
              </span>
            </div>
          )}

          {hideMode !== 'indicators' &&
            hideMode !== 'all' &&
            pane.indicators.map((ind) => {
              if (
                ind.visibleTimeframes &&
                ind.visibleTimeframes.length > 0 &&
                !ind.visibleTimeframes.includes(pane.timeframe)
              ) {
                return null;
              }
              const series = paneIndicatorSeries.find(
                (s) => s.configId === ind.id,
              );
              const refIdx = legendRefIdx ?? Math.max(0, rawCandles.length - 1);
              const rawTitle = series?.title ?? ind.name;
              const displayTitle = statusCfg.showIndicatorArguments
                ? rawTitle
                : rawTitle
                    .replace(/\s*\([^)]*\)/g, '')
                    .replace(/\s+\d[\d,\s.]*$/, '');
              return (
                <div
                  key={ind.id}
                  className={`sc-ind-row ${ind.visible ? '' : 'sc-ind-row--hidden'}`}
                >
                  {statusCfg.showIndicatorTitles && <span>{displayTitle}</span>}
                  {ind.visible &&
                    statusCfg.showIndicatorValues &&
                    series?.plots.slice(0, 3).map((pl) => {
                      const val = pl.data[refIdx]?.value;
                      if (val == null || !Number.isFinite(val)) return null;
                      return (
                        <span key={pl.key} style={{ color: pl.color }}>
                          {formatPrice(
                            val,
                            ind.pane === 'overlay' ? effectivePrecision : 2,
                          )}
                        </span>
                      );
                    })}
                  <span className="sc-ind-actions">
                    <button
                      type="button"
                      className="sc-ind-act-btn"
                      title={
                        ind.visible ? 'Nascondi indicatore' : 'Mostra indicatore'
                      }
                      aria-label={
                        ind.visible ? 'Nascondi indicatore' : 'Mostra indicatore'
                      }
                      onClick={() => toggleIndicatorVisibility(ind.id, paneIndex)}
                    >
                      {ind.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      className="sc-ind-act-btn"
                      title="Impostazioni indicatore"
                      aria-label={`Impostazioni ${displayTitle}`}
                      onClick={() => {
                        onFocusPane(paneIndex);
                        openIndicatorSettings(ind.id);
                      }}
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      type="button"
                      className="sc-ind-act-btn"
                      title="Rimuovi indicatore"
                      aria-label={`Rimuovi ${displayTitle}`}
                      onClick={() => removeIndicator(ind.id, paneIndex)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              );
            })}

          {compareSeries.map((comp) => {
            const refTime = legendBar?.time;
            const compVal =
              (refTime != null ? comp.byTime.get(refTime) : undefined) ??
              comp.candles[comp.candles.length - 1]?.close;
            const compBase =
              (visStartTime != null ? comp.byTime.get(visStartTime) : undefined) ??
              comp.candles[0]?.close ??
              compVal ??
              1;
            const compPct =
              compVal != null && compBase > 0
                ? ((compVal - compBase) / compBase) * 100
                : null;
            const compSym = resolveSymbolInfo(comp.ticker);
            return (
              <div key={comp.ticker} className="sc-ind-row">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: comp.color,
                    display: 'inline-block',
                  }}
                />
                <span>Confronto: {comp.ticker}</span>
                {compVal != null && (
                  <span style={{ color: comp.color }}>
                    {formatPrice(compVal, compSym.precision)}
                    {compPct != null ? ` (${formatPercent(compPct)})` : ''}
                  </span>
                )}
                <span className="sc-ind-actions">
                  <button
                    type="button"
                    className="sc-ind-act-btn"
                    title={`Rimuovi confronto ${comp.ticker}`}
                    onClick={() => removeCompareSymbol(comp.ticker, paneIndex)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================== SELECTED DRAWING MINI BAR (optional legacy fallback) ======================== */}
      {!hideInlineDrawingBar && selectedDrawing && !lockDrawings && (
        <div
          className="sc-drawing-bar"
          style={
            priceScalePosition === 'left'
              ? { right: 12 }
              : { right: dynamicPriceAxisWidth + 10 }
          }
          role="toolbar"
          aria-label="Stile disegno selezionato"
        >
          {DRAWING_SWATCHES.map((col) => (
            <button
              key={col}
              type="button"
              className={`sc-color-swatch ${
                selectedDrawing.style.color.toLowerCase() === col
                  ? 'sc-color-swatch--active'
                  : ''
              }`}
              style={{ background: col }}
              title={`Colore ${col}`}
              onClick={() =>
                updateDrawing(symbol.ticker, selectedDrawing.id, {
                  style: { ...selectedDrawing.style, color: col },
                })
              }
            />
          ))}
          <button
            type="button"
            className="sc-ind-act-btn"
            title="Impostazioni disegno"
            onClick={() => openDrawingSettings(selectedDrawing.id)}
          >
            <Settings size={13} />
          </button>
          <button
            type="button"
            className="sc-ind-act-btn"
            title="Elimina disegno (Canc)"
            disabled={selectedDrawing.locked}
            onClick={() => {
              if (!selectedDrawing.locked) {
                deleteDrawing(symbol.ticker, selectedDrawing.id);
              }
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* ======================== INLINE TEXT / NOTE / CALLOUT POPUP ======================== */}
      {textInputState && (
        <div
          className="sc-text-popup"
          style={{
            left: Math.max(8, Math.min(size.width - 280, textInputState.screen.x)),
            top: Math.max(8, Math.min(size.height - 60, textInputState.screen.y - 36)),
          }}
        >
          <input
            type="text"
            autoFocus
            placeholder="Scrivi annotazione…"
            value={textInputState.value}
            onChange={(e) =>
              setTextInputState((prev) =>
                prev ? { ...prev, value: e.target.value } : null,
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextAnnotation();
              if (e.key === 'Escape') setTextInputState(null);
            }}
          />
          <button
            type="button"
            className="sc-replay-btn sc-replay-btn--primary"
            onClick={commitTextAnnotation}
          >
            OK
          </button>
          <button
            type="button"
            className="sc-replay-btn"
            onClick={() => setTextInputState(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ======================== ACTIVE DRAWING TOOL / DRAFT HINT PILL ======================== */}
      {showToolHintPill && (
        <div className="sc-tool-hint-pill" role="status" aria-live="polite">
          <span className="sc-tool-hint-text">
            <span className="sc-tool-hint-primary">{toolHintParts.primary}</span>
            {toolHintParts.secondary && (
              <>
                <span className="sc-tool-hint-sep" aria-hidden="true">
                  {' '}
                  ·{' '}
                </span>
                <span className="sc-tool-hint-secondary">
                  {toolHintParts.secondary}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            className="sc-tool-hint-cancel"
            onClick={() => {
              setDraftDrawing(null);
              setZoomBox(null);
              setActiveTool('crosshair');
            }}
          >
            Annulla
          </button>
        </div>
      )}

      {/* ======================== BAR REPLAY FLOATING TRANSPORT BAR ======================== */}
      {isActivePane && replay.active && (
        <div
          className="sc-replay-bar"
          role="toolbar"
          aria-label="Controlli Bar Replay"
        >
          <span className="sc-replay-pill">REPLAY</span>
          <span>Barra {replay.barIndex + 1}</span>
          <button
            type="button"
            className="sc-replay-btn sc-replay-btn--primary"
            title={replay.playing ? 'Pausa' : 'Avvia riproduzione'}
            onClick={toggleReplayPlay}
          >
            {replay.playing ? <Pause size={13} /> : <Play size={13} />}
            <span>{replay.playing ? 'Pausa' : 'Play'}</span>
          </button>
          <button
            type="button"
            className="sc-replay-btn"
            title="Avanza di 1 barra"
            onClick={() => stepReplay(1)}
          >
            <SkipForward size={13} />
            <span>+1</span>
          </button>
          {[
            { label: '1x', ms: 900 },
            { label: '2x', ms: 450 },
            { label: '5x', ms: 180 },
          ].map((sp) => (
            <button
              key={sp.label}
              type="button"
              className={`sc-replay-btn ${replay.speedMs === sp.ms ? 'sc-replay-btn--primary' : ''}`}
              onClick={() => setReplaySpeed(sp.ms)}
            >
              {sp.label}
            </button>
          ))}
          <button
            type="button"
            className="sc-replay-btn sc-replay-btn--danger"
            title="Torna al tempo reale"
            onClick={exitReplay}
          >
            Esci
          </button>
        </div>
      )}

      {/* ======================== FLOATING "TORNA AL PRESENTE" (>>) BUTTON ======================== */}
      {showJumpRealtime && (
        <button
          type="button"
          className={`sc-jump-realtime-btn${
            showToolHintPill ? ' sc-jump-realtime-btn--raised' : ''
          }`}
          style={
            priceScalePosition === 'left'
              ? { right: 14 }
              : { right: dynamicPriceAxisWidth + 14 }
          }
          title="Scorri fino all'ultima barra (Fine)"
          aria-label="Torna al presente"
          onClick={jumpToRealtime}
        >
          <ChevronsRight size={16} />
        </button>
      )}

      {/* ======================== FLOATING NAVIGATION CONTROLS ======================== */}
      {!(isActivePane && replay.active) && !showToolHintPill && (
        <div
          className="sc-nav-controls"
          role="toolbar"
          aria-label="Controlli navigazione"
        >
          <button
            type="button"
            className="sc-nav-btn"
            title="Rimpicciolisci (-)"
            onClick={() => zoomAroundCenter(1.25)}
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Ingrandisci (+)"
            onClick={() => zoomAroundCenter(0.8)}
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Scorri verso sinistra (←)"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                rightIndex: Math.max(
                  6,
                  vp.rightIndex - Math.round(vp.visibleBars * 0.2),
                ),
              }))
            }
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Scorri verso destra (→)"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                rightIndex: Math.min(
                  maxRightBound(rawCandles.length, vp.visibleBars),
                  vp.rightIndex + Math.round(vp.visibleBars * 0.2),
                ),
              }))
            }
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Reimposta la visualizzazione del grafico (Alt+R)"
            onClick={resetChartView}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
