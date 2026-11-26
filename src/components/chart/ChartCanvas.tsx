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
  getCandlesForSymbol,
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
  indexToTime,
  indexToX,
  isPointInMainPlot,
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
}

const DRAWING_SWATCHES = ['#2962ff', '#089981', '#f23645', '#ff9800', '#ab47bc', '#ffffff'];

const TEXT_PROMPT_TOOLS = new Set<CanonicalDrawingToolType>([
  'text',
  'anchored_text',
  'note',
  'price_note',
  'callout',
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
}: ChartCanvasProps) {
  const { theme, openModal, setBottomPanel, chartSettings } = useTradingView();
  const { quotes } = useQuotes();
  const {
    displayedCandles: activeDisplayedCandles,
    indicatorSeries: activeIndicatorSeries,
    paneDataSources,
    paneLoading,
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

  // Raw candles
  const secondaryBaseCandles = useMemo(() => {
    if (isActivePane) return [];
    return getCandlesForSymbol(pane.symbolId, pane.timeframe, 320);
  }, [isActivePane, pane.symbolId, pane.timeframe]);

  const rawCandles = useMemo<Candle[]>(() => {
    if (isActivePane) return activeDisplayedCandles;
    if (secondaryBaseCandles.length === 0) return [];
    if (!liveQuote) return secondaryBaseCandles;
    const copy = secondaryBaseCandles.slice();
    const last = copy[copy.length - 1];
    copy[copy.length - 1] = {
      ...last,
      close: liveQuote.price,
      high: Math.max(last.high, liveQuote.price),
      low: Math.min(last.low, liveQuote.price),
    };
    return copy;
  }, [isActivePane, activeDisplayedCandles, secondaryBaseCandles, liveQuote]);

  // Display candles (transformed for Heikin Ashi)
  const displayCandles = useMemo<Candle[]>(() => {
    if (canonicalChartType === 'heikin_ashi') {
      return toHeikinAshi(rawCandles);
    }
    return rawCandles;
  }, [canonicalChartType, rawCandles]);

  // Indicator series for this pane
  const paneIndicatorSeries = useMemo<IndicatorSeries[]>(() => {
    if (hideMode === 'indicators' || hideMode === 'all') return [];
    if (isActivePane) return activeIndicatorSeries;
    return computePaneIndicatorSeries(rawCandles, pane.indicators, null);
  }, [isActivePane, activeIndicatorSeries, rawCandles, pane.indicators, hideMode]);

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
      const cList = getCandlesForSymbol(ticker, pane.timeframe, 320);
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

  // Clear manual vertical bounds whenever autoScale turns ON or scaleMode changes
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
  const zoomHistoryRef = useRef<Array<{ viewport: ViewportState; autoScale: boolean }>>([]);

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

  const paneSource: DataSourceKind = isActivePane
    ? (paneDataSources[paneIndex] ?? liveQuote?.source ?? 'simulated')
    : (liveQuote?.source ?? paneDataSources[paneIndex] ?? 'simulated');
  const isPaneLoading = Boolean(paneLoading[paneIndex]);

  const effectiveScaleMode =
    pane.compareSymbols.length > 0 && pane.scaleMode !== 'indexed100'
      ? 'percent'
      : pane.scaleMode;
  const dynamicPriceAxisWidth = computePriceAxisWidth(
    effectivePrecision,
    effectiveScaleMode,
    chartSettings.canvas.scaleFontSize,
  );

  // Reset & auto-fit viewport when symbol/timeframe changes, real candles hydrate asynchronously, or Replay steps
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
      const rightPad = Math.max(3, Math.min(rightMarginBars, Math.round(targetVisible * 0.12)));
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
      visibleBars: Math.max(20, count),
      rightIndex: Math.max(20, rawCandles.length + rightMarginBars),
      yZoom: 1,
      yOffset: 0,
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
    'plot' | 'priceAxis' | 'timeAxis' | 'plusButton'
  >('plot');
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [eraserHoveredId, setEraserHoveredId] = useState<string | null>(null);
  const [zoomBox, setZoomBox] = useState<ZoomBoxOverlay | null>(null);

  // Drawing interaction state
  const [draftDrawing, setDraftDrawing] = useState<DrawingObject | null>(null);
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

  // Bid/Ask prices for legend & Bid/Ask lines/labels
  const legendBar =
    (hoveredIdx !== null ? rawCandles[hoveredIdx] : undefined) ??
    rawCandles[rawCandles.length - 1];
  const bidPrice =
    liveQuote?.bid ??
    (legendBar ? legendBar.close - symbol.tickSize : symbol.basePrice);
  const askPrice =
    liveQuote?.ask ??
    (legendBar ? legendBar.close + symbol.tickSize : symbol.basePrice);

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

  // Keyboard shortcuts when active pane (Delete drawing, Escape cancel, Enter commit path, Alt+R reset)
  useEffect(() => {
    if (!isActivePane) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
        ev.preventDefault();
        deleteDrawing(symbol.ticker, selectedDrawingId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isActivePane,
    draftDrawing,
    textInputState,
    zoomBox,
    canonicalTool,
    setActiveTool,
    selectedDrawingId,
    setSelectedDrawingId,
    lockDrawings,
    deleteDrawing,
    addDrawing,
    stayInDrawingMode,
    symbol.ticker,
    resetChartView,
  ]);

  // Helper: convert screen (x, y) to snapped DrawingPoint
  const screenToDrawingPoint = useCallback(
    (x: number, y: number): DrawingPoint | null => {
      const layout = layoutRef.current;
      if (!layout) return null;
      const barFloat = xToIndex(x, layout);
      const barIdx = Math.round(barFloat);
      const time = indexToTime(barIdx, rawCandles);
      let price = yToPrice(y, layout);

      if (magnetMode !== 'off') {
        const clamped = Math.max(0, Math.min(rawCandles.length - 1, barIdx));
        const candle = rawCandles[clamped];
        if (candle) {
          price = snapPriceToCandle(price, candle, magnetMode);
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
      // Sort descending by zIndex so topmost visual drawing wins
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

  // Helper: emit unified ContextMenu payload for mouse right-click & mobile long-press
  const emitContextMenuAt = useCallback(
    (localX: number, localY: number, clientX: number, clientY: number) => {
      if (!onChartContextMenu) return;
      const layout = layoutRef.current;
      if (!layout) return;

      const barIndex = Math.max(
        0,
        Math.min(rawCandles.length - 1, Math.round(xToIndex(localX, layout))),
      );
      const price = yToPrice(localY, layout);
      const timestamp = indexToTime(barIndex, rawCandles);

      if (isPointInPriceAxis(localX, localY, layout)) {
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
    [onChartContextMenu, rawCandles, paneIndex, findHitDrawing, setSelectedDrawingId],
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
    (x: number, y: number): boolean => {
      const layout = layoutRef.current;
      if (!layout || !isPointInMainPlot(x, y, layout)) return false;

      if (canonicalTool === 'eraser') {
        if (lockDrawings) return true;
        const hit = findHitDrawing(x, y, layout, 10, false);
        if (hit) {
          deleteDrawing(symbol.ticker, hit.drawing.id);
          setEraserHoveredId(null);
        }
        return true;
      }

      if (isCursorOrUtilityTool(activeTool) || lockDrawings) {
        return false;
      }

      const pt = screenToDrawingPoint(x, y);
      if (!pt) return false;
      const meta = DRAWING_TOOL_REGISTRY[canonicalTool];
      const toolType = canonicalTool as PersistableDrawingType;

      // 1) Freehand tools (brush, highlighter)
      if (meta.pointCount === 'freehand') {
        const draft: DrawingObject = {
          id: makeDrawingId(),
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt],
          style: buildDrawingStyle(canonicalTool),
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
        if (TEXT_PROMPT_TOOLS.has(canonicalTool)) {
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
          style: buildDrawingStyle(canonicalTool),
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
        return true;
      }

      // 3) Multi-point open polyline ('path' — click adds points, double-click or Enter finishes)
      if (meta.pointCount === 'multi') {
        if (!draftDrawing) {
          setDraftDrawing({
            id: makeDrawingId(),
            symbol: symbol.ticker,
            timeframe: pane.timeframe,
            type: toolType,
            points: [pt, pt],
            style: buildDrawingStyle(canonicalTool),
            locked: false,
            visible: true,
            createdAt: Date.now(),
          });
        } else {
          setDraftDrawing({
            ...draftDrawing,
            points: draftDrawing.points.slice(0, -1).concat(pt, pt),
          });
        }
        return true;
      }

      // 4) Fixed N-point tools (2, 3, 4, 5, 6 points)
      const requiredPoints = meta.pointCount;
      if (!draftDrawing) {
        setDraftDrawing({
          id: makeDrawingId(),
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt, pt],
          style: buildDrawingStyle(canonicalTool),
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
        return true;
      }

      const committedSoFar = draftDrawing.points.slice(0, -1).concat(pt);
      if (committedSoFar.length < requiredPoints) {
        setDraftDrawing({
          ...draftDrawing,
          points: committedSoFar.concat(pt),
        });
        return true;
      }

      // All required points placed!
      if (TEXT_PROMPT_TOOLS.has(canonicalTool)) {
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
        ...draftDrawing,
        points: committedSoFar,
      });
      return true;
    },
    [
      canonicalTool,
      activeTool,
      lockDrawings,
      findHitDrawing,
      deleteDrawing,
      symbol.ticker,
      screenToDrawingPoint,
      pane.timeframe,
      draftDrawing,
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

      // Save current view onto zoomHistory stack
      zoomHistoryRef.current.push({
        viewport: { ...viewportRef.current },
        autoScale: pane.autoScale,
      });

      const barA = xToIndex(minX, layout);
      const barB = xToIndex(maxX, layout);
      const nextVisible = Math.max(10, Math.min(400, barB - barA));
      const nextRight = Math.max(6, Math.min(rawCandles.length + nextVisible * 0.7, barB));

      // Compute selected scaled Y bounds (pixel-exact match!)
      const pTop = yToPrice(minY, layout);
      const pBot = yToPrice(maxY, layout);
      const sTop = toScaledValue(pTop, layout.scaleMode, layout.basePrice);
      const sBot = toScaledValue(pBot, layout.scaleMode, layout.basePrice);
      const selMin = Math.min(sTop, sBot);
      const selMax = Math.max(sTop, sBot);

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

  // Touch state ref for mobile pan, 2D free pan, axis drag, pinch zoom, double-tap & long-press
  const lastTapRef = useRef<{ time: number; zone: 'priceAxis' | 'timeAxis' | 'plot' }>({
    time: 0,
    zone: 'plot',
  });
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
  >(null);

  // Native non-passive touch listeners for smooth 1:1 mobile gestures
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clearLongPress = () => {
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
      if (ev.touches.length === 0) return;
      ev.preventDefault();
      onFocusPane(paneIndex);
      const layout = layoutRef.current;
      if (!layout) return;

      clearLongPress();

      if (ev.touches.length >= 2) {
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

      // Freehand drawing via touch (brush / highlighter)
      const meta = DRAWING_TOOL_REGISTRY[canonicalTool];
      if (
        meta.pointCount === 'freehand' &&
        !lockDrawings &&
        isPointInMainPlot(p.x, p.y, layout)
      ) {
        const pt = screenToDrawingPoint(p.x, p.y);
        if (pt) {
          const draft: DrawingObject = {
            id: makeDrawingId(),
            symbol: symbol.ticker,
            timeframe: pane.timeframe,
            type: canonicalTool as PersistableDrawingType,
            points: [pt],
            style: buildDrawingStyle(canonicalTool),
            locked: false,
            visible: true,
            createdAt: Date.now(),
          };
          setDraftDrawing(draft);
          touchRef.current = { kind: 'freehand', drawing: draft };
          return;
        }
      }

      const zone: 'priceAxis' | 'timeAxis' | 'plot' = isPointInPriceAxis(p.x, p.y, layout)
        ? 'priceAxis'
        : isPointInTimeAxis(p.x, p.y, layout)
          ? 'timeAxis'
          : 'plot';

      if (zone === 'priceAxis' && pane.autoScale) {
        updatePane(paneIndex, { autoScale: false });
      }

      touchRef.current = {
        kind: 'single',
        startX: p.x,
        startY: p.y,
        clientX: p.clientX,
        clientY: p.clientY,
        moved: false,
        longPressed: false,
        zone,
        startVp: { ...viewportRef.current },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };

      // Schedule long-press (~520ms) context menu trigger for mobile
      longPressTimerRef.current = window.setTimeout(() => {
        const st = touchRef.current;
        if (st && st.kind === 'single' && !st.moved) {
          st.longPressed = true;
          emitContextMenuAt(st.startX, st.startY, st.clientX, st.clientY);
        }
      }, 520);
    };

    const onTouchMove = (ev: TouchEvent) => {
      const state = touchRef.current;
      const layout = layoutRef.current;
      if (!state || !layout || ev.touches.length === 0) return;
      ev.preventDefault();

      // Upgrade 1-finger to 2-finger pinch cleanly
      if (ev.touches.length >= 2 && state.kind !== 'pinch') {
        clearLongPress();
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

        // Horizontal zoom + simultaneous pan anchored to midpoint
        const scale = state.startDist / dist;
        const nextBars = Math.max(
          10,
          Math.min(400, state.startVp.visibleBars * scale),
        );
        const anchorRatio = Math.max(
          0,
          Math.min(1, (state.startMidX - layout.plotLeft) / Math.max(1, layout.plotWidth)),
        );
        const anchorIndex =
          state.startVp.rightIndex - state.startVp.visibleBars * (1 - anchorRatio);
        const panShift =
          (midX - state.startMidX) / Math.max(1, layout.plotWidth / nextBars);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio) - panShift;

        // Vertical zoom when predominantly vertical pinch or manual scaling (!autoScale)
        const predominantlyVertical =
          Math.abs(curDy - state.startDy) > Math.abs(curDx - state.startDx) * 1.4;
        let nextManualMin = state.startVp.manualMin ?? null;
        let nextManualMax = state.startVp.manualMax ?? null;
        let nextYZoom = state.startVp.yZoom;
        if (predominantlyVertical || !pane.autoScale) {
          if (predominantlyVertical && pane.autoScale) {
            updatePane(paneIndex, { autoScale: false });
          }
          const baseSpan = Math.max(1e-12, state.startMax - state.startMin);
          const nextSpan = Math.max(
            state.rawSpan / 20,
            Math.min(state.rawSpan * 20, baseSpan * (state.startDy / Math.max(8, curDy))),
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
            Math.min(rawCandles.length + nextBars * 0.7, nextRight),
          ),
          yZoom: nextYZoom,
          manualMin: nextManualMin,
          manualMax: nextManualMax,
        }));
        return;
      }

      const p = getLocal(ev.touches[0]);
      if (state.kind === 'freehand') {
        const pt = screenToDrawingPoint(p.x, p.y);
        if (pt) {
          state.drawing = {
            ...state.drawing,
            points: [...state.drawing.points, pt],
          };
          setDraftDrawing(state.drawing);
        }
        return;
      }

      if (state.kind === 'single') {
        if (state.longPressed) return;
        const dx = p.x - state.startX;
        const dy = p.y - state.startY;
        if (!state.moved && Math.hypot(dx, dy) > 6) {
          state.moved = true;
          clearLongPress();
        }
        if (!state.moved) return;

        if (state.zone === 'priceAxis') {
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
            10,
            Math.min(420, state.startVp.visibleBars * Math.exp(-dx * 0.005)),
          );
          setViewport((vp) => ({ ...vp, visibleBars: nextBars }));
        } else {
          const deltaBars = dx / Math.max(1, layout.barStepPx);
          const nextRight = Math.max(
            6,
            Math.min(
              rawCandles.length + state.startVp.visibleBars * 0.8,
              state.startVp.rightIndex - deltaBars,
            ),
          );
          if (pane.autoScale) {
            setViewport((vp) => ({ ...vp, rightIndex: nextRight }));
          } else {
            const ySign = invertScale ? -1 : 1;
            const span = Math.max(1e-12, state.startMax - state.startMin);
            const deltaScaled =
              (ySign * dy / Math.max(80, layout.mainRect.height)) * span;
            setViewport((vp) => ({
              ...vp,
              rightIndex: nextRight,
              manualMin: state.startMin + deltaScaled,
              manualMax: state.startMax + deltaScaled,
            }));
          }
        }

        const barIndex = Math.max(
          0,
          Math.min(rawCandles.length - 1, Math.round(xToIndex(p.x, layout))),
        );
        setCrosshair({ x: p.x, y: p.y, barIndex, visible: true });
        if (isActivePane) {
          setHoveredIdx(barIndex);
          onHoverCandle?.(rawCandles[barIndex] ?? null, barIndex);
        }
      }
    };

    const onTouchEnd = () => {
      clearLongPress();
      const state = touchRef.current;
      touchRef.current = null;
      if (!state) return;

      if (state.kind === 'freehand') {
        if (state.drawing.points.length >= 2) {
          commitCompletedDrawing(state.drawing);
        } else {
          setDraftDrawing(null);
        }
        return;
      }

      if (state.kind === 'single' && !state.moved && !state.longPressed) {
        const layout = layoutRef.current;
        if (!layout) return;

        // Detect double-tap on Price Axis or Time Axis
        const now = Date.now();
        const isDoubleTap =
          now - lastTapRef.current.time < 320 &&
          lastTapRef.current.zone === state.zone;
        lastTapRef.current = { time: now, zone: state.zone };

        if (isDoubleTap && state.zone === 'priceAxis') {
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
        if (isDoubleTap && state.zone === 'timeAxis') {
          setViewport((vp) => ({
            ...vp,
            visibleBars: 120,
            rightIndex: Math.max(120, rawCandles.length + rightMarginBars),
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
          onPriceAxisPlusClick?.({
            clientX: state.clientX,
            clientY: state.clientY,
            price: layout.plusButtonRect.price,
            symbolId: symbol.ticker,
            paneIndex,
          });
          return;
        }

        // Tap with active drawing tool places anchor point
        if (placeDrawingPointAt(state.startX, state.startY)) {
          return;
        }

        // Otherwise tap updates crosshair + selects drawing if hit
        const barIndex = Math.max(
          0,
          Math.min(
            rawCandles.length - 1,
            Math.round(xToIndex(state.startX, layout)),
          ),
        );
        setCrosshair({
          x: state.startX,
          y: state.startY,
          barIndex,
          visible: true,
        });
        if (isActivePane) {
          setHoveredIdx(barIndex);
          onHoverCandle?.(rawCandles[barIndex] ?? null, barIndex);
        }
        if (!lockDrawings) {
          const hit = findHitDrawing(state.startX, state.startY, layout, 12, false);
          setSelectedDrawingId(hit ? hit.drawing.id : null);
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      clearLongPress();
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    paneIndex,
    onFocusPane,
    canonicalTool,
    lockDrawings,
    screenToDrawingPoint,
    symbol.ticker,
    pane.timeframe,
    pane.autoScale,
    invertScale,
    rightMarginBars,
    updatePane,
    rawCandles,
    isActivePane,
    onHoverCandle,
    commitCompletedDrawing,
    placeDrawingPointAt,
    findHitDrawing,
    setSelectedDrawingId,
    emitContextMenuAt,
    onPriceAxisPlusClick,
  ]);

  // Native non-passive wheel listener:
  // - Over Price Axis (Left OR Right): zooms VERTICALLY ONLY (disables autoScale, NEVER changes visibleBars!)
  // - Over Time Axis: zooms HORIZONTALLY ONLY anchored to right edge
  // - Over Main Plot: zooms HORIZONTALLY anchored cleanly to cursor X
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const layout = layoutRef.current;
      if (!layout) return;

      // 1) Wheel OVER Price Axis -> VERTICAL ZOOM ONLY (never touches visibleBars/rightIndex!)
      if (isPointInPriceAxis(x, y, layout)) {
        const wasAuto = pane.autoScale;
        if (wasAuto) {
          updatePane(paneIndex, { autoScale: false });
        }
        const spanFactor = ev.deltaY > 0 ? 1.14 : 0.88;
        const clampedY = Math.max(
          layout.mainRect.top,
          Math.min(layout.mainRect.bottom, y),
        );
        const f = layout.invertScale
          ? (clampedY - layout.mainRect.top) / Math.max(1, layout.mainRect.height)
          : (layout.mainRect.bottom - clampedY) / Math.max(1, layout.mainRect.height);

        setViewport((vp) => {
          const curMin =
            !wasAuto && vp.manualMin != null && vp.manualMax != null
              ? vp.manualMin
              : layout.mainMin;
          const curMax =
            !wasAuto && vp.manualMin != null && vp.manualMax != null
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

      // 2) Wheel OVER Time Axis -> HORIZONTAL ZOOM ONLY anchored to right edge
      if (isPointInTimeAxis(x, y, layout)) {
        const factor = ev.deltaY > 0 ? 1.12 : 0.89;
        setViewport((vp) => ({
          ...vp,
          visibleBars: Math.max(10, Math.min(420, vp.visibleBars * factor)),
        }));
        return;
      }

      // 3) Wheel OVER Main Plot -> HORIZONTAL ZOOM anchored cleanly to cursor X
      const factor = ev.deltaY > 0 ? 1.12 : 0.89;
      const anchorRatio = Math.max(
        0,
        Math.min(1, (x - layout.plotLeft) / Math.max(1, layout.plotWidth)),
      );

      setViewport((vp) => {
        const nextBars = Math.max(10, Math.min(420, vp.visibleBars * factor));
        const anchorIndex = vp.rightIndex - vp.visibleBars * (1 - anchorRatio);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio);
        return {
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(
            6,
            Math.min(rawCandles.length + nextBars * 0.75, nextRight),
          ),
        };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [rawCandles.length, pane.autoScale, paneIndex, updatePane]);

  const handleMouseDown = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    if (ev.button !== 0) return;
    onFocusPane(paneIndex);

    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

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

    // 1) Price Axis vertical zoom drag (works on Left OR Right)
    if (isPointInPriceAxis(x, y, layout)) {
      dragRef.current = {
        kind: 'priceZoom',
        startX: x,
        startY: y,
        startVp: { ...viewport },
        startMin: layout.mainMin,
        startMax: layout.mainMax,
        rawSpan: layout.rawMainSpan,
      };
      if (pane.autoScale) {
        updatePane(paneIndex, { autoScale: false });
      }
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

    // 5) Drawing placement (or Eraser deletion) when a drawing tool is active
    if (placeDrawingPointAt(x, y)) {
      return;
    }

    // 6) Hit-test existing drawings for selection & dragging
    if (inMainPlot && !lockDrawings) {
      const hit = findHitDrawing(x, y, layout, 8, false);
      if (hit) {
        setSelectedDrawingId(hit.drawing.id);
        const startPt = screenToDrawingPoint(x, y);
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
    } else if (isPointInPriceAxis(x, y, layout)) {
      setHoverZone('priceAxis');
    } else if (isPointInTimeAxis(x, y, layout)) {
      setHoverZone('timeAxis');
    } else {
      setHoverZone('plot');
    }

    const barIndex = Math.max(
      0,
      Math.min(rawCandles.length - 1, Math.round(xToIndex(x, layout))),
    );
    setCrosshair({ x, y, barIndex, visible: true });

    if (barIndex !== hoveredIdx) {
      setHoveredIdx(barIndex);
      if (isActivePane) {
        onHoverCandle?.(rawCandles[barIndex] ?? null, barIndex);
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
      const pt = screenToDrawingPoint(x, y);
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

    if (drag.kind === 'pan') {
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const deltaBars = dx / Math.max(1, layout.barStepPx);
      const nextRight = Math.max(
        6,
        Math.min(
          rawCandles.length + drag.startVp.visibleBars * 0.8,
          drag.startVp.rightIndex - deltaBars,
        ),
      );
      if (pane.autoScale) {
        setViewport((vp) => ({ ...vp, rightIndex: nextRight }));
      } else {
        const ySign = invertScale ? -1 : 1;
        const span = Math.max(1e-12, drag.startMax - drag.startMin);
        const deltaScaled =
          (ySign * dy / Math.max(80, layout.mainRect.height)) * span;
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
        10,
        Math.min(420, drag.startVp.visibleBars * Math.exp(-dx * 0.005)),
      );
      setViewport((vp) => ({ ...vp, visibleBars: nextBars }));
    } else if (drag.kind === 'zoomBox') {
      drag.x2 = Math.max(layout.plotLeft, Math.min(layout.plotRight, x));
      drag.y2 = Math.max(layout.mainRect.top, Math.min(layout.mainRect.bottom, y));
      setZoomBox({ x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2 });
    } else if (drag.kind === 'freehand') {
      const pt = screenToDrawingPoint(x, y);
      if (pt) {
        drag.drawing = {
          ...drag.drawing,
          points: [...drag.drawing.points, pt],
        };
        setDraftDrawing(drag.drawing);
      }
    } else if (drag.kind === 'dragDrawing') {
      const curPt = screenToDrawingPoint(x, y);
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
    if (isActivePane) {
      onHoverCandle?.(null, null);
    }
  };

  const handleDoubleClick = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // 1) Double-click on Price Axis -> resets autoScale = true, yZoom = 1, yOffset = 0
    if (isPointInPriceAxis(x, y, layout)) {
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
    const price =
      liveQuote?.price ??
      rawCandles[rawCandles.length - 1]?.close ??
      symbol.basePrice;
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

  // Legend OHLCV metrics
  const prevBar =
    hoveredIdx !== null && hoveredIdx > 0
      ? rawCandles[hoveredIdx - 1]
      : rawCandles[rawCandles.length - 2];
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
    if (hoverZone === 'priceAxis') return 'ns-resize';
    if (hoverZone === 'timeAxis') return 'ew-resize';
    if (isDraggingPan) return 'grabbing';
    if (canonicalTool === 'zoom_box') return 'zoom-in';
    if (canonicalTool === 'eraser') return eraserHoveredId ? 'pointer' : 'cell';
    if (canonicalTool === 'arrow_cursor') return 'default';
    if (canonicalTool === 'dot') return crosshair.visible ? 'none' : 'default';
    return 'crosshair';
  })();

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

          {statusCfg.showOpenMarketStatus && (
            <span className={badge.className} title={badge.title}>
              <span className="sc-source-dot" />
              {badge.label}
            </span>
          )}

          {isPaneLoading && (
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
              const series = paneIndicatorSeries.find(
                (s) => s.configId === ind.id,
              );
              const refIdx =
                hoveredIdx !== null
                  ? hoveredIdx
                  : Math.max(0, rawCandles.length - 1);
              const rawTitle = series?.title ?? ind.name;
              const displayTitle = statusCfg.showIndicatorArguments
                ? rawTitle
                : rawTitle.replace(/\s*\([^)]*\)/g, '').replace(/\s+\d[\d,\s.]*$/, '');
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
                      onClick={() => toggleIndicatorVisibility(ind.id, paneIndex)}
                    >
                      {ind.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      className="sc-ind-act-btn"
                      title="Rimuovi indicatore"
                      onClick={() => removeIndicator(ind.id, paneIndex)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              );
            })}

          {compareSeries.map((comp) => (
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
          ))}
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
            onClick={() => deleteDrawing(symbol.ticker, selectedDrawing.id)}
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

      {/* ======================== FLOATING NAVIGATION CONTROLS ======================== */}
      {!(isActivePane && replay.active) && (
        <div
          className="sc-nav-controls"
          role="toolbar"
          aria-label="Controlli navigazione"
        >
          <button
            type="button"
            className="sc-nav-btn"
            title="Rimpicciolisci"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                visibleBars: Math.min(420, vp.visibleBars * 1.25),
              }))
            }
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Ingrandisci"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                visibleBars: Math.max(12, vp.visibleBars * 0.8),
              }))
            }
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="sc-nav-btn"
            title="Scorri verso sinistra"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                rightIndex: Math.max(
                  10,
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
            title="Scorri verso destra"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                rightIndex: Math.min(
                  rawCandles.length + vp.visibleBars * 0.5,
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
