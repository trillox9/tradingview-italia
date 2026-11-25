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
  SkipForward,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  TIMEFRAME_SECONDS,
  type Candle,
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
  priceToY,
  renderChart,
  timeToIndex,
  xToIndex,
  yToPrice,
  type ChartLayoutMetrics,
  type CompareSeriesData,
  type CrosshairState,
  type ViewportState,
} from './chartRenderer';

export interface ChartCanvasProps {
  pane: ChartPaneState;
  paneIndex: number;
  isActivePane: boolean;
  isMultiChart: boolean;
  rangeSignal?: { preset: RangePreset; seq: number } | null;
  resetSignal?: number;
  onFocusPane: (paneIndex: number) => void;
  onHoverCandle?: (candle: Candle | null, barIndex: number | null) => void;
}

const DRAWING_SWATCHES = ['#2962ff', '#089981', '#f23645', '#ff9800', '#ab47bc', '#ffffff'];

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

function defaultColorForTool(tool: PersistableDrawingType): string {
  switch (tool) {
    case 'longPosition':
      return '#089981';
    case 'shortPosition':
      return '#f23645';
    case 'horizontalLine':
      return '#ff9800';
    case 'fibRetracement':
      return '#2962ff';
    case 'text':
    case 'callout':
      return '#ffffff';
    default:
      return '#2962ff';
  }
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
}: ChartCanvasProps) {
  const { theme, openModal, setBottomPanel } = useTradingView();
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
    lockDrawings,
    hideDrawings,
    selectedDrawingId,
    setSelectedDrawingId,
    addDrawing,
    updateDrawing,
    deleteDrawing,
  } = useDrawings();

  const { paperAccount, placeOrder } = usePaperTrading();
  const { alerts } = useAlerts();

  const symbol = useMemo(() => resolveSymbolInfo(pane.symbolId), [pane.symbolId]);
  const liveQuote = quotes[symbol.ticker];

  // Raw candles: active pane uses store's live/replay displayedCandles; secondary panes build live series
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
    if (pane.chartType === 'heikinAshi') {
      return toHeikinAshi(rawCandles);
    }
    return rawCandles;
  }, [pane.chartType, rawCandles]);

  // Indicator series for this pane
  const paneIndicatorSeries = useMemo<IndicatorSeries[]>(() => {
    if (isActivePane) return activeIndicatorSeries;
    return computePaneIndicatorSeries(rawCandles, pane.indicators, null);
  }, [isActivePane, activeIndicatorSeries, rawCandles, pane.indicators]);

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
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Viewport state (pan/zoom)
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    visibleBars: 120,
    rightIndex: Math.max(120, rawCandles.length + 5),
    yZoom: 1,
    yOffset: 0,
  }));

  const paneSource: DataSourceKind = isActivePane
    ? (paneDataSources[paneIndex] ?? liveQuote?.source ?? 'simulated')
    : (liveQuote?.source ?? paneDataSources[paneIndex] ?? 'simulated');
  const isPaneLoading = Boolean(paneLoading[paneIndex]);

  const effectiveScaleMode =
    pane.compareSymbols.length > 0 ? 'percent' : pane.scaleMode;
  const dynamicPriceAxisWidth = computePriceAxisWidth(
    symbol.precision,
    effectiveScaleMode,
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
      len > 0 && (prev.firstTime !== firstTime || Math.abs(len - prev.length) > 1);

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
      const rightPad = Math.min(6, Math.max(3, Math.round(targetVisible * 0.05)));
      setViewport((vp) => ({
        visibleBars: symTfChanged || sourceUpgraded || finishedLoading ? targetVisible : vp.visibleBars,
        rightIndex: Math.max(targetVisible * 0.5, len + rightPad),
        yZoom: pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading ? 1 : vp.yZoom,
        yOffset: pane.autoScale || symTfChanged || sourceUpgraded || finishedLoading ? 0 : vp.yOffset,
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
  ]);

  // Apply external rangePreset signal from ChartBottomBar
  useEffect(() => {
    if (!isActivePane || !rangeSignal) return;
    const count = getVisibleBarCountForRange(rangeSignal.preset, rawCandles.length || 140);
    setViewport((vp) => ({
      ...vp,
      visibleBars: Math.max(20, count),
      rightIndex: Math.max(20, rawCandles.length + 5),
      yZoom: 1,
      yOffset: 0,
    }));
  }, [isActivePane, rangeSignal, rawCandles.length]);

  // Apply external reset signal
  useEffect(() => {
    if (!isActivePane || !resetSignal) return;
    setViewport({
      visibleBars: 120,
      rightIndex: Math.max(120, rawCandles.length + 5),
      yZoom: 1,
      yOffset: 0,
    });
    updatePane(paneIndex, { autoScale: true });
  }, [isActivePane, resetSignal, rawCandles.length, paneIndex, updatePane]);

  // Countdown tick (1s)
  const [countdownText, setCountdownText] = useState<string | null>(null);
  useEffect(() => {
    if (!pane.countdownVisible) {
      setCountdownText(null);
      return;
    }
    const tfSec = TIMEFRAME_SECONDS[pane.timeframe];
    const update = () => setCountdownText(formatCountdown(tfSec, Date.now()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [pane.countdownVisible, pane.timeframe]);

  // Crosshair & hovered candle
  const [crosshair, setCrosshair] = useState<CrosshairState>({
    x: 0,
    y: 0,
    barIndex: -1,
    visible: false,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Drawing interaction state
  const [draftDrawing, setDraftDrawing] = useState<DrawingObject | null>(null);
  const [textInputState, setTextInputState] = useState<{
    screen: ScreenPoint;
    point: DrawingPoint;
    value: string;
  } | null>(null);

  const layoutRef = useRef<ChartLayoutMetrics | null>(null);

  // Drag mode ref (pan / price-axis zoom / time-axis zoom / brush / move drawing / move handle)
  const dragRef = useRef<
    | null
    | {
        kind: 'pan' | 'priceZoom' | 'timeZoom';
        startX: number;
        startY: number;
        startVp: ViewportState;
      }
    | {
        kind: 'brush';
        drawing: DrawingObject;
      }
    | {
        kind: 'dragDrawing';
        drawingId: string;
        handleIndex: number | null;
        startPt: DrawingPoint;
        origPoints: DrawingPoint[];
      }
  >(null);

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
        showVolume: pane.showVolume,
        showGrid: pane.showGrid,
        countdownText,
        overlaySeries,
        separateSeries,
        compareSeries,
        drawings: paneDrawings,
        draftDrawing,
        selectedDrawingId: isActivePane ? selectedDrawingId : null,
        hideDrawings,
        positions: paperAccount.positions,
        alerts,
        crosshair,
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
    isActivePane,
    hideDrawings,
    paperAccount.positions,
    alerts,
    crosshair,
  ]);

  // Keyboard shortcuts when active pane (Delete drawing, Escape cancel)
  useEffect(() => {
    if (!isActivePane) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (ev.key === 'Escape') {
        if (draftDrawing) {
          setDraftDrawing(null);
          return;
        }
        if (textInputState) {
          setTextInputState(null);
          return;
        }
        if (activeTool !== 'crosshair') {
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
    activeTool,
    setActiveTool,
    selectedDrawingId,
    setSelectedDrawingId,
    lockDrawings,
    deleteDrawing,
    symbol.ticker,
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

  // Helper: place drawing point for both mouse clicks and touch taps
  const placeDrawingPointAt = useCallback(
    (x: number, y: number): boolean => {
      const layout = layoutRef.current;
      if (!layout) return false;
      const inMainPlot = x <= layout.plotWidth && y <= layout.mainRect.bottom;
      if (
        !inMainPlot ||
        activeTool === 'crosshair' ||
        activeTool === 'cursor' ||
        lockDrawings
      ) {
        return false;
      }
      const pt = screenToDrawingPoint(x, y);
      if (!pt) return false;
      const toolType = activeTool as PersistableDrawingType;

      if (toolType === 'horizontalLine' || toolType === 'verticalLine') {
        addDrawing({
          id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt],
          style: {
            color: defaultColorForTool(toolType),
            lineWidth: 1.8,
            lineStyle: 'solid',
            showLabels: true,
          },
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
        return true;
      }

      if (toolType === 'text' || toolType === 'callout') {
        setTextInputState({ screen: { x, y }, point: pt, value: '' });
        return true;
      }

      if (toolType === 'brush') {
        const draft: DrawingObject = {
          id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: 'brush',
          points: [pt],
          style: { color: '#2962ff', lineWidth: 2, lineStyle: 'solid' },
          locked: false,
          visible: true,
          createdAt: Date.now(),
        };
        setDraftDrawing(draft);
        dragRef.current = { kind: 'brush', drawing: draft };
        return true;
      }

      if (!draftDrawing) {
        setDraftDrawing({
          id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          symbol: symbol.ticker,
          timeframe: pane.timeframe,
          type: toolType,
          points: [pt, pt],
          style: {
            color: defaultColorForTool(toolType),
            lineWidth: 2,
            lineStyle: 'solid',
            showLabels: true,
          },
          locked: false,
          visible: true,
          createdAt: Date.now(),
        });
      } else if (
        draftDrawing.type === 'parallelChannel' &&
        draftDrawing.points.length === 2
      ) {
        setDraftDrawing({
          ...draftDrawing,
          points: [draftDrawing.points[0], pt, pt],
        });
      } else {
        const finalPts = draftDrawing.points.slice(0, -1).concat(pt);
        const committed: DrawingObject = {
          ...draftDrawing,
          points: finalPts,
        };
        if (
          committed.type === 'longPosition' ||
          committed.type === 'shortPosition'
        ) {
          const entry = committed.points[0].price;
          const targetRaw = committed.points[1].price;
          const diff = Math.abs(targetRaw - entry) || entry * 0.02;
          if (committed.type === 'longPosition') {
            committed.targetPrice = Math.max(entry + diff * 0.25, targetRaw);
            committed.stopPrice = entry - diff * 0.5;
          } else {
            committed.targetPrice = Math.min(entry - diff * 0.25, targetRaw);
            committed.stopPrice = entry + diff * 0.5;
          }
        }
        setDraftDrawing(null);
        addDrawing(committed);
      }
      return true;
    },
    [
      activeTool,
      lockDrawings,
      screenToDrawingPoint,
      addDrawing,
      symbol.ticker,
      pane.timeframe,
      draftDrawing,
    ],
  );

  // Touch state ref for mobile pan, 2-finger pinch-to-zoom, and tap-to-draw
  const touchRef = useRef<
    | null
    | {
        kind: 'single';
        startX: number;
        startY: number;
        moved: boolean;
        isPriceAxis: boolean;
        startVp: ViewportState;
      }
    | {
        kind: 'pinch';
        startDist: number;
        startMidX: number;
        startVp: ViewportState;
      }
    | {
        kind: 'brush';
        drawing: DrawingObject;
      }
  >(null);

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Native non-passive touch listeners for smooth mobile pan & pinch-to-zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getLocal = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      ev.preventDefault();
      onFocusPane(paneIndex);
      const layout = layoutRef.current;
      if (!layout) return;

      if (ev.touches.length >= 2) {
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        touchRef.current = {
          kind: 'pinch',
          startDist: Math.max(12, dist),
          startMidX: (p0.x + p1.x) / 2,
          startVp: { ...viewportRef.current },
        };
        return;
      }

      const p = getLocal(ev.touches[0]);
      if (activeTool === 'brush' && !lockDrawings && p.x <= layout.plotWidth && p.y <= layout.mainRect.bottom) {
        const pt = screenToDrawingPoint(p.x, p.y);
        if (pt) {
          const draft: DrawingObject = {
            id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            symbol: symbol.ticker,
            timeframe: pane.timeframe,
            type: 'brush',
            points: [pt],
            style: { color: '#2962ff', lineWidth: 2, lineStyle: 'solid' },
            locked: false,
            visible: true,
            createdAt: Date.now(),
          };
          setDraftDrawing(draft);
          touchRef.current = { kind: 'brush', drawing: draft };
          return;
        }
      }

      const isPriceAxis = p.x > layout.plotWidth && p.y < layout.mainRect.bottom;
      if (isPriceAxis && pane.autoScale) {
        updatePane(paneIndex, { autoScale: false });
      }
      touchRef.current = {
        kind: 'single',
        startX: p.x,
        startY: p.y,
        moved: false,
        isPriceAxis,
        startVp: { ...viewportRef.current },
      };
    };

    const onTouchMove = (ev: TouchEvent) => {
      const state = touchRef.current;
      const layout = layoutRef.current;
      if (!state || !layout || ev.touches.length === 0) return;
      ev.preventDefault();

      // Upgrade 1-finger to 2-finger pinch cleanly
      if (ev.touches.length >= 2 && state.kind !== 'pinch') {
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        touchRef.current = {
          kind: 'pinch',
          startDist: Math.max(12, Math.hypot(p1.x - p0.x, p1.y - p0.y)),
          startMidX: (p0.x + p1.x) / 2,
          startVp: { ...viewportRef.current },
        };
        return;
      }

      if (state.kind === 'pinch' && ev.touches.length >= 2) {
        const p0 = getLocal(ev.touches[0]);
        const p1 = getLocal(ev.touches[1]);
        const dist = Math.max(12, Math.hypot(p1.x - p0.x, p1.y - p0.y));
        const midX = (p0.x + p1.x) / 2;
        const scale = state.startDist / dist;
        const nextBars = Math.max(14, Math.min(360, state.startVp.visibleBars * scale));
        const anchorRatio = Math.max(0, Math.min(1, state.startMidX / Math.max(1, layout.plotWidth)));
        const anchorIndex = state.startVp.rightIndex - state.startVp.visibleBars * (1 - anchorRatio);
        const panShift = (midX - state.startMidX) / Math.max(1, layout.plotWidth / nextBars);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio) - panShift;
        setViewport((vp) => ({
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(6, Math.min(rawCandles.length + nextBars * 0.65, nextRight)),
        }));
        return;
      }

      const p = getLocal(ev.touches[0]);
      if (state.kind === 'brush') {
        const pt = screenToDrawingPoint(p.x, p.y);
        if (pt) {
          state.drawing = { ...state.drawing, points: [...state.drawing.points, pt] };
          setDraftDrawing(state.drawing);
        }
        return;
      }

      if (state.kind === 'single') {
        const dx = p.x - state.startX;
        const dy = p.y - state.startY;
        if (!state.moved && Math.hypot(dx, dy) > 5) {
          state.moved = true;
        }
        if (!state.moved) return;

        if (state.isPriceAxis) {
          const nextZoom = Math.max(
            0.25,
            Math.min(6, state.startVp.yZoom * Math.exp(-dy * 0.006)),
          );
          setViewport((vp) => ({ ...vp, yZoom: nextZoom }));
        } else {
          const deltaBars = dx / Math.max(1, layout.barStepPx);
          const nextRight = Math.max(
            6,
            Math.min(
              rawCandles.length + state.startVp.visibleBars * 0.75,
              state.startVp.rightIndex - deltaBars,
            ),
          );
          setViewport((vp) => ({
            ...vp,
            rightIndex: nextRight,
            yOffset: pane.autoScale
              ? vp.yOffset
              : state.startVp.yOffset + dy / Math.max(80, layout.mainRect.height),
          }));
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
      const state = touchRef.current;
      touchRef.current = null;
      if (!state) return;

      if (state.kind === 'brush') {
        setDraftDrawing(null);
        if (state.drawing.points.length >= 2) {
          addDrawing(state.drawing);
        }
        return;
      }

      if (state.kind === 'single' && !state.moved) {
        const layout = layoutRef.current;
        if (!layout) return;
        // Tap with active drawing tool places anchor point
        if (placeDrawingPointAt(state.startX, state.startY)) {
          return;
        }
        // Otherwise tap updates crosshair + selects drawing if hit
        const barIndex = Math.max(
          0,
          Math.min(rawCandles.length - 1, Math.round(xToIndex(state.startX, layout))),
        );
        setCrosshair({ x: state.startX, y: state.startY, barIndex, visible: true });
        if (isActivePane) {
          setHoveredIdx(barIndex);
          onHoverCandle?.(rawCandles[barIndex] ?? null, barIndex);
        }
        if (!hideDrawings && !lockDrawings) {
          const toScreen = (pt: DrawingPoint): ScreenPoint => ({
            x: indexToX(timeToIndex(pt.time, rawCandles), layout),
            y: priceToY(pt.price, layout),
          });
          let hitId: string | null = null;
          for (let i = paneDrawings.length - 1; i >= 0; i--) {
            const d = paneDrawings[i];
            if (d.locked) continue;
            if (hitTestDrawing(d, { x: state.startX, y: state.startY }, toScreen, 12).hit) {
              hitId = d.id;
              break;
            }
          }
          setSelectedDrawingId(hitId);
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    paneIndex,
    onFocusPane,
    activeTool,
    lockDrawings,
    screenToDrawingPoint,
    symbol.ticker,
    pane.timeframe,
    pane.autoScale,
    updatePane,
    rawCandles,
    isActivePane,
    onHoverCandle,
    addDrawing,
    placeDrawingPointAt,
    hideDrawings,
    paneDrawings,
    setSelectedDrawingId,
  ]);

  // Native non-passive wheel zoom anchored to cursor X
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const layout = layoutRef.current;
      if (!layout) return;

      const factor = ev.deltaY > 0 ? 1.12 : 0.89;
      const anchorRatio = Math.max(0, Math.min(1, x / Math.max(1, layout.plotWidth)));

      setViewport((vp) => {
        const nextBars = Math.max(14, Math.min(360, vp.visibleBars * factor));
        const anchorIndex = vp.rightIndex - vp.visibleBars * (1 - anchorRatio);
        const nextRight = anchorIndex + nextBars * (1 - anchorRatio);
        return {
          ...vp,
          visibleBars: nextBars,
          rightIndex: Math.max(6, Math.min(rawCandles.length + nextBars * 0.65, nextRight)),
        };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [rawCandles.length]);

  const handleMouseDown = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    if (ev.button !== 0) return;
    onFocusPane(paneIndex);

    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // 1) Price Axis vertical zoom drag
    if (x > layout.plotWidth && y < layout.mainRect.bottom) {
      dragRef.current = {
        kind: 'priceZoom',
        startX: x,
        startY: y,
        startVp: { ...viewport },
      };
      if (pane.autoScale) {
        updatePane(paneIndex, { autoScale: false });
      }
      return;
    }

    // 2) Time Axis horizontal zoom drag
    if (y > layout.timeAxisTop && x <= layout.plotWidth) {
      dragRef.current = {
        kind: 'timeZoom',
        startX: x,
        startY: y,
        startVp: { ...viewport },
      };
      return;
    }

    // Only interact with drawings/replay inside main price plot
    const inMainPlot = x <= layout.plotWidth && y <= layout.mainRect.bottom;

    // 3) Bar Replay Shift+Click jump
    if (inMainPlot && isActivePane && replay.active && ev.shiftKey) {
      const idx = Math.round(xToIndex(x, layout));
      setReplayBarIndex(idx);
      return;
    }

    // 4) Drawing placement when a drawing tool is active
    if (placeDrawingPointAt(x, y)) {
      return;
    }

    // 5) Hit-test existing drawings for selection & dragging
    if (inMainPlot && !hideDrawings && !lockDrawings) {
      const toScreen = (pt: DrawingPoint): ScreenPoint => ({
        x: indexToX(timeToIndex(pt.time, rawCandles), layout),
        y: priceToY(pt.price, layout),
      });

      for (let i = paneDrawings.length - 1; i >= 0; i--) {
        const d = paneDrawings[i];
        if (d.locked) continue;
        const hit = hitTestDrawing(d, { x, y }, toScreen, 8);
        if (hit.hit) {
          setSelectedDrawingId(d.id);
          const startPt = screenToDrawingPoint(x, y);
          if (startPt) {
            dragRef.current = {
              kind: 'dragDrawing',
              drawingId: d.id,
              handleIndex: hit.handleIndex,
              startPt,
              origPoints: d.points.map((p) => ({ ...p })),
            };
          }
          return;
        }
      }
      setSelectedDrawingId(null);
    }

    // 6) Default: Pan chart horizontally (and vertically if !autoScale)
    dragRef.current = {
      kind: 'pan',
      startX: x,
      startY: y,
      startVp: { ...viewport },
    };
  };

  const handleMouseMove = (ev: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

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

    // Update ghost draft drawing preview
    if (draftDrawing && (!dragRef.current || dragRef.current.kind !== 'brush')) {
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
          rawCandles.length + drag.startVp.visibleBars * 0.75,
          drag.startVp.rightIndex - deltaBars,
        ),
      );
      setViewport((vp) => ({
        ...vp,
        rightIndex: nextRight,
        yOffset: pane.autoScale
          ? vp.yOffset
          : drag.startVp.yOffset + dy / Math.max(80, layout.mainRect.height),
      }));
    } else if (drag.kind === 'priceZoom') {
      const dy = y - drag.startY;
      const nextZoom = Math.max(
        0.25,
        Math.min(6, drag.startVp.yZoom * Math.exp(-dy * 0.006)),
      );
      setViewport((vp) => ({ ...vp, yZoom: nextZoom }));
    } else if (drag.kind === 'timeZoom') {
      const dx = x - drag.startX;
      const nextBars = Math.max(
        14,
        Math.min(360, drag.startVp.visibleBars * Math.exp(-dx * 0.005)),
      );
      setViewport((vp) => ({ ...vp, visibleBars: nextBars }));
    } else if (drag.kind === 'brush') {
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
    if (drag && drag.kind === 'brush') {
      setDraftDrawing(null);
      if (drag.drawing.points.length >= 2) {
        addDrawing(drag.drawing);
      }
    }
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
    setCrosshair((prev) => ({ ...prev, visible: false }));
    setHoveredIdx(null);
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
    if (x > layout.plotWidth) {
      // Double-click on Price Axis resets autoScale!
      updatePane(paneIndex, { autoScale: true });
      setViewport((vp) => ({ ...vp, yZoom: 1, yOffset: 0 }));
    }
  };

  const commitTextAnnotation = () => {
    if (!textInputState) return;
    const text = textInputState.value.trim();
    if (text) {
      addDrawing({
        id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: symbol.ticker,
        timeframe: pane.timeframe,
        type: 'text',
        points: [textInputState.point],
        text,
        style: {
          color: '#ffffff',
          lineWidth: 1,
          lineStyle: 'solid',
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
    const price = liveQuote?.price ?? rawCandles[rawCandles.length - 1]?.close ?? symbol.basePrice;
    placeOrder({
      symbol: symbol.ticker,
      side,
      type: 'market',
      quantity: 1,
    }, price);
    setBottomPanel('trading');
  };

  // Legend OHLCV bar
  const legendBar =
    (hoveredIdx !== null ? rawCandles[hoveredIdx] : undefined) ??
    rawCandles[rawCandles.length - 1];
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

  const bidPrice = liveQuote?.bid ?? (legendBar ? legendBar.close - symbol.tickSize : symbol.basePrice);
  const askPrice = liveQuote?.ask ?? (legendBar ? legendBar.close + symbol.tickSize : symbol.basePrice);
  const spreadVal = Math.max(0, askPrice - bidPrice);

  const selectedDrawing = useMemo(
    () =>
      isActivePane && selectedDrawingId
        ? paneDrawings.find((d) => d.id === selectedDrawingId) ?? null
        : null,
    [isActivePane, selectedDrawingId, paneDrawings],
  );

  // Canvas cursor style
  const cursorStyle =
    activeTool !== 'crosshair' && activeTool !== 'cursor'
      ? 'crosshair'
      : 'crosshair';

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
      />

      {/* ======================== TOP-LEFT OHLCV & INDICATOR LEGEND ======================== */}
      <div
        className="sc-legend-overlay"
        style={{ right: dynamicPriceAxisWidth + 10 }}
      >
        <div className="sc-legend-main-row">
          <button
            type="button"
            className="sc-legend-title-btn"
            title="Cambia simbolo"
            onClick={() => {
              onFocusPane(paneIndex);
              openModal('symbolSearch');
            }}
          >
            <span className="sc-symbol-dot" style={{ background: symbol.logoColor }}>
              {symbol.logoText.slice(0, 2)}
            </span>
            <span className="sc-legend-name-full">{symbol.name}</span>
            <span className="sc-legend-name-short">{symbol.ticker}</span>
            <span className="sc-legend-meta">
              · {pane.timeframe} <span className="sc-legend-exchange">· {symbol.exchange}</span>
            </span>
          </button>

          <span className={badge.className} title={badge.title}>
            <span className="sc-source-dot" />
            {badge.label}
          </span>

          {isPaneLoading && (
            <span className="sc-loading-pill" role="status" aria-live="polite">
              <span className="sc-loading-spinner" />
              Aggiornamento...
            </span>
          )}

          {legendBar && (
            <div className="sc-ohlc-row">
              <span className="sc-ohlc-item sc-ohlc-verbose">
                <span className="sc-ohlc-lbl">Aper.</span>
                <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                  {formatPrice(legendBar.open, symbol.precision)}
                </span>
              </span>
              <span className="sc-ohlc-item sc-ohlc-verbose">
                <span className="sc-ohlc-lbl">Max.</span>
                <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                  {formatPrice(legendBar.high, symbol.precision)}
                </span>
              </span>
              <span className="sc-ohlc-item sc-ohlc-verbose">
                <span className="sc-ohlc-lbl">Min.</span>
                <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                  {formatPrice(legendBar.low, symbol.precision)}
                </span>
              </span>
              <span className="sc-ohlc-item">
                <span className="sc-ohlc-lbl sc-ohlc-verbose">Chius.</span>
                <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                  {formatPrice(legendBar.close, symbol.precision)}
                </span>
              </span>
              <span className={barDelta >= 0 ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                {barDelta >= 0 ? '+' : ''}
                {formatPrice(barDelta, symbol.precision)} ({formatPercent(barDeltaPct)})
              </span>
            </div>
          )}
        </div>

        {/* Buy / Sell Quick Buttons (REA: VENDI / spread / ACQUISTA) */}
        {pane.showBuySellButtons && (
          <div className="sc-buysell-row">
            <button
              type="button"
              className="sc-order-btn sc-order-btn--sell"
              title={`Vendi 1 ${symbol.ticker} a mercato (Paper Trading)`}
              onClick={() => handleQuickOrder('sell')}
            >
              <span className="sc-order-price">{formatPrice(bidPrice, symbol.precision)}</span>
              <span className="sc-order-tag">VENDI</span>
            </button>
            <span className="sc-spread-label" title="Spread bid/ask">
              {formatPrice(spreadVal, symbol.precision)}
            </span>
            <button
              type="button"
              className="sc-order-btn sc-order-btn--buy"
              title={`Acquista 1 ${symbol.ticker} a mercato (Paper Trading)`}
              onClick={() => handleQuickOrder('buy')}
            >
              <span className="sc-order-price">{formatPrice(askPrice, symbol.precision)}</span>
              <span className="sc-order-tag">ACQUISTA</span>
            </button>
          </div>
        )}

        {/* Volume + Active Indicators + Comparison Symbols Rows */}
        <div className="sc-ind-list">
          {pane.showVolume && legendBar && (
            <div className="sc-ind-row">
              <span>Vol</span>
              <span className={barIsUp ? 'sc-ohlc-val--up' : 'sc-ohlc-val--down'}>
                {formatVolume(legendBar.volume)}
              </span>
            </div>
          )}

          {pane.indicators.map((ind) => {
            const series = paneIndicatorSeries.find((s) => s.configId === ind.id);
            const refIdx =
              hoveredIdx !== null ? hoveredIdx : Math.max(0, rawCandles.length - 1);
            return (
              <div
                key={ind.id}
                className={`sc-ind-row ${ind.visible ? '' : 'sc-ind-row--hidden'}`}
              >
                <span>{series?.title ?? ind.name}</span>
                {ind.visible &&
                  series?.plots.slice(0, 3).map((pl) => {
                    const val = pl.data[refIdx]?.value;
                    if (val == null || !Number.isFinite(val)) return null;
                    return (
                      <span key={pl.key} style={{ color: pl.color }}>
                        {formatPrice(val, ind.pane === 'overlay' ? symbol.precision : 2)}
                      </span>
                    );
                  })}
                <span className="sc-ind-actions">
                  <button
                    type="button"
                    className="sc-ind-act-btn"
                    title={ind.visible ? 'Nascondi indicatore' : 'Mostra indicatore'}
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

      {/* ======================== SELECTED DRAWING MINI BAR ======================== */}
      {selectedDrawing && !lockDrawings && (
        <div
          className="sc-drawing-bar"
          style={{ right: dynamicPriceAxisWidth + 10 }}
          role="toolbar"
          aria-label="Stile disegno selezionato"
        >
          {DRAWING_SWATCHES.map((col) => (
            <button
              key={col}
              type="button"
              className={`sc-color-swatch ${
                selectedDrawing.style.color.toLowerCase() === col ? 'sc-color-swatch--active' : ''
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
            title="Elimina disegno (Canc)"
            onClick={() => deleteDrawing(symbol.ticker, selectedDrawing.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* ======================== INLINE TEXT ANNOTATION POPUP ======================== */}
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
        <div className="sc-replay-bar" role="toolbar" aria-label="Controlli Bar Replay">
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
        <div className="sc-nav-controls" role="toolbar" aria-label="Controlli navigazione">
          <button
            type="button"
            className="sc-nav-btn"
            title="Rimpicciolisci"
            onClick={() =>
              setViewport((vp) => ({
                ...vp,
                visibleBars: Math.min(360, vp.visibleBars * 1.25),
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
                visibleBars: Math.max(16, vp.visibleBars * 0.8),
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
                rightIndex: Math.max(10, vp.rightIndex - Math.round(vp.visibleBars * 0.2)),
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
            title="Reimposta la visualizzazione del grafico"
            onClick={() => {
              setViewport({
                visibleBars: 120,
                rightIndex: Math.max(120, rawCandles.length + 5),
                yZoom: 1,
                yOffset: 0,
              });
              updatePane(paneIndex, { autoScale: true });
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
