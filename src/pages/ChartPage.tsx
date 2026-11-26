import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Candle } from '../types';
import {
  useActivePane,
  useDrawings,
  useTradingView,
  type RangePreset,
} from '../store';
import {
  ChartBottomBar,
  ChartContextMenu,
  ChartTopToolbar,
  DrawingSettingsModal,
  DrawingToolbar,
  FloatingDrawingToolbar,
  FloatingFavoritesBar,
  MultiChartGrid,
  type ChartContextMenuPayload,
  type ChartContextMenuState,
  type PriceAxisPlusPayload,
} from '../components/chart';
import {
  AlertToastStack,
  BottomDrawer,
  RightSidebar,
} from '../components/panels';

export function ChartPage() {
  const { openModal, rightPanel } = useTradingView();
  const {
    activePane,
    activePaneIndex,
    activeSymbol,
    setScaleMode,
    toggleAutoScale,
    toggleInvertScale,
    toggleLockPriceToBarRatio,
  } = useActivePane();
  const {
    drawings,
    selectedDrawingId,
    setActiveTool,
    lockDrawings,
    hideDrawings,
    setHideDrawings,
    deleteDrawing,
    undo,
    redo,
  } = useDrawings();

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false,
  );
  const [showDrawingBar, setShowDrawingBar] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth > 900 : true,
  );

  // Sync mobile flag and drawing toolbar visibility automatically when crossing the 900px responsive breakpoint
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(max-width: 900px)');
    setIsMobileViewport(mq.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobileViewport(e.matches);
      setShowDrawingBar(!e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleToggleDrawingBar = useCallback(() => {
    setShowDrawingBar((v) => !v);
  }, []);

  const handleCloseMobileDrawingBar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setShowDrawingBar(false);
    }
  }, []);

  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredCandleIndex, setHoveredCandleIndex] = useState<number | null>(null);
  const [rangeSignal, setRangeSignal] = useState<{
    preset: RangePreset;
    seq: number;
  } | null>(null);
  const [resetSignal, setResetSignal] = useState<number>(0);

  // Zoom-box history state bridged from active ChartCanvas -> DrawingToolbar Zoom-Out button
  const [canZoomOut, setCanZoomOut] = useState<boolean>(false);
  const zoomOutFnRef = useRef<(() => void) | null>(null);

  // Unified right-click & '+' Price Axis context menu state
  const [contextMenu, setContextMenu] = useState<ChartContextMenuState | null>(null);

  // Ephemeral feedback toast for context-menu actions (copy price, alert, hline, order)
  const [notifyToast, setNotifyToast] = useState<string | null>(null);
  const notifyTimerRef = useRef<number | null>(null);

  const showNotify = useCallback((message: string) => {
    setNotifyToast(message);
    if (notifyTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(notifyTimerRef.current);
    }
    if (typeof window !== 'undefined') {
      notifyTimerRef.current = window.setTimeout(() => {
        setNotifyToast(null);
        notifyTimerRef.current = null;
      }, 2600);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (notifyTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(notifyTimerRef.current);
      }
    };
  }, []);

  const handleHoverCandle = useCallback(
    (candle: Candle | null, index: number | null) => {
      setHoveredCandle(candle);
      setHoveredCandleIndex(index);
    },
    [],
  );

  const handleSelectRange = useCallback((preset: RangePreset) => {
    setRangeSignal((prev) => ({ preset, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleResetView = useCallback(() => {
    if (!activePane.autoScale) {
      toggleAutoScale(activePaneIndex);
    }
    setResetSignal((prev) => prev + 1);
  }, [activePane.autoScale, activePaneIndex, toggleAutoScale]);

  const handleResetPriceScale = useCallback(() => {
    if (!activePane.autoScale) {
      toggleAutoScale(activePaneIndex);
    }
    if (activePane.invertScale) {
      toggleInvertScale(activePaneIndex);
    }
    if (activePane.lockPriceToBarRatio) {
      toggleLockPriceToBarRatio(activePaneIndex);
    }
    setResetSignal((prev) => prev + 1);
  }, [
    activePane.autoScale,
    activePane.invertScale,
    activePane.lockPriceToBarRatio,
    activePaneIndex,
    toggleAutoScale,
    toggleInvertScale,
    toggleLockPriceToBarRatio,
  ]);

  const handleChartContextMenu = useCallback((payload: ChartContextMenuPayload) => {
    setContextMenu({
      target: payload.target,
      clientX: payload.clientX,
      clientY: payload.clientY,
      price: payload.price,
      barIndex: payload.barIndex,
      timestamp: payload.timestamp,
      drawingId: payload.drawingId,
      paneIndex: payload.paneIndex,
    });
  }, []);

  const handlePriceAxisPlusClick = useCallback((payload: PriceAxisPlusPayload) => {
    setContextMenu({
      target: 'price_plus',
      clientX: payload.clientX,
      clientY: payload.clientY,
      price: payload.price,
      paneIndex: payload.paneIndex,
    });
  }, []);

  const handleOpenPriceScaleMenu = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setContextMenu({
        target: 'price_axis',
        clientX: rect.right,
        clientY: rect.top - 4,
        paneIndex: activePaneIndex,
      });
    },
    [activePaneIndex],
  );

  const handleZoomHistoryChange = useCallback(
    (canOut: boolean, zoomOutFn: () => void) => {
      setCanZoomOut(canOut);
      zoomOutFnRef.current = zoomOutFn;
    },
    [],
  );

  const handleZoomOut = useCallback(() => {
    zoomOutFnRef.current?.();
  }, []);

  // Pro Supercharts keyboard shortcuts (ignoring editable inputs)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        openModal('symbolSearch');
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key === '/') {
        ev.preventDefault();
        openModal('shortcuts');
        return;
      }

      if (inEditable) return;

      if ((ev.ctrlKey || ev.metaKey) && ev.altKey && ev.key.toLowerCase() === 'h') {
        ev.preventDefault();
        setHideDrawings(!hideDrawings);
        return;
      }

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) redo();
        else undo();
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        redo();
        return;
      }

      if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedDrawingId) {
        const selected = drawings.find((d) => d.id === selectedDrawingId);
        if (!lockDrawings && selected && !selected.locked) {
          ev.preventDefault();
          deleteDrawing(activeSymbol.ticker, selected.id);
        }
        return;
      }

      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        const k = ev.key.toLowerCase();
        if (k === 'r' && ev.shiftKey) {
          ev.preventDefault();
          setActiveTool('rectangle');
        } else if (k === 'r') {
          ev.preventDefault();
          handleResetView();
        } else if (k === 'i') {
          ev.preventDefault();
          toggleInvertScale(activePaneIndex);
        } else if (k === 'l') {
          ev.preventDefault();
          setScaleMode(
            activePane.scaleMode === 'log' ? 'regular' : 'log',
            activePaneIndex,
          );
        } else if (k === 'p') {
          ev.preventDefault();
          setScaleMode(
            activePane.scaleMode === 'percent' ? 'regular' : 'percent',
            activePaneIndex,
          );
        } else if (k === 't') {
          ev.preventDefault();
          setActiveTool('trendline');
        } else if (k === 'h') {
          ev.preventDefault();
          setActiveTool('hline');
        } else if (k === 'j') {
          ev.preventDefault();
          setActiveTool('hray');
        } else if (k === 'v') {
          ev.preventDefault();
          setActiveTool('vline');
        } else if (k === 'c') {
          ev.preventDefault();
          setActiveTool('cross_line');
        } else if (k === 'f') {
          ev.preventDefault();
          setActiveTool('fib_retracement');
        } else if (k === 'a') {
          ev.preventDefault();
          openModal('alert');
        }
      } else if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key === '?') {
        openModal('shortcuts');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePane.scaleMode,
    activePaneIndex,
    activeSymbol.ticker,
    deleteDrawing,
    drawings,
    handleResetView,
    hideDrawings,
    lockDrawings,
    openModal,
    redo,
    selectedDrawingId,
    setActiveTool,
    setHideDrawings,
    setScaleMode,
    toggleInvertScale,
    undo,
  ]);

  const workspaceClass = [
    'tv-supercharts',
    showDrawingBar ? '' : 'tv-supercharts--no-drawing',
    rightPanel === null ? 'tv-supercharts--no-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={workspaceClass} data-testid="supercharts-workspace">
      {/* Top 38px Supercharts Pro Toolbar */}
      <ChartTopToolbar
        showDrawingBar={showDrawingBar}
        onToggleDrawingBar={handleToggleDrawingBar}
      />

      {/* Left 52px Drawing Toolbar (64 tools across 8 authentic groups) */}
      {showDrawingBar && (
        <DrawingToolbar
          canZoomOut={canZoomOut}
          onZoomOut={handleZoomOut}
          mobileOpen={isMobileViewport && showDrawingBar}
          onCloseMobile={handleCloseMobileDrawingBar}
        />
      )}

      {/* Center Column: Multi-Chart Canvas Stage + Bottom Quick-Range Bar + Resizable Bottom Drawer */}
      <main className="sc-center-column">
        <div className="sc-chart-stage">
          <MultiChartGrid
            rangeSignal={rangeSignal}
            resetSignal={resetSignal}
            onHoverCandle={handleHoverCandle}
            onChartContextMenu={handleChartContextMenu}
            onPriceAxisPlusClick={handlePriceAxisPlusClick}
            onZoomHistoryChange={handleZoomHistoryChange}
            hideInlineDrawingBar={true}
          />
          <ChartBottomBar
            onSelectRange={handleSelectRange}
            onResetView={handleResetView}
            onOpenPriceScaleMenu={handleOpenPriceScaleMenu}
          />
        </div>

        <BottomDrawer />
      </main>

      {/* Right Area: Mounted ONLY when a pure right panel (Lista/Avvisi/Dati/Oggetti) is open */}
      {rightPanel !== null && (
        <div className="sc-right-area">
          <RightSidebar
            hoveredCandle={hoveredCandle}
            hoveredCandleIndex={hoveredCandleIndex}
          />
        </div>
      )}

      {/* Floating Draggable Favorites Bar & Active Drawing Style Bar */}
      <FloatingFavoritesBar />
      <FloatingDrawingToolbar />

      {/* Drawing Properties Modal (Stile / Testo / Coordinate) */}
      <DrawingSettingsModal />

      {/* Unified Right-Click & Price-Axis '+' Context Menus */}
      <ChartContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onResetPriceScale={handleResetPriceScale}
        onResetTimeScale={handleResetView}
        onResetChartView={handleResetView}
        onNotify={showNotify}
      />

      {/* Context Action Feedback Toast */}
      {notifyToast && (
        <div className="sc-action-toast" role="status" aria-live="polite">
          {notifyToast}
        </div>
      )}

      {/* Live Triggered Alert Toasts */}
      <AlertToastStack />
    </div>
  );
}

export default ChartPage;
