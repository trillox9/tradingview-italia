import { useCallback, useEffect, useState } from 'react';
import type { Candle } from '../types';
import {
  useDrawings,
  useTradingView,
  type RangePreset,
} from '../store';
import {
  ChartBottomBar,
  ChartTopToolbar,
  DrawingToolbar,
  MultiChartGrid,
} from '../components/chart';
import {
  AlertToastStack,
  BottomDrawer,
  RightSidebar,
  RightToolRail,
} from '../components/panels';
import '../styles/panels.css';
import '../styles/chart.css';

export function ChartPage() {
  const { openModal } = useTradingView();
  const { setActiveTool, undo, redo } = useDrawings();

  const [showDrawingBar, setShowDrawingBar] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredCandleIndex, setHoveredCandleIndex] = useState<number | null>(null);
  const [rangeSignal, setRangeSignal] = useState<{
    preset: RangePreset;
    seq: number;
  } | null>(null);
  const [resetSignal, setResetSignal] = useState<number>(0);

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
    setResetSignal((prev) => prev + 1);
  }, []);

  // Supercharts keyboard shortcuts (Ctrl+K, Alt+T/H/V/F/A, Ctrl+Z/Y, Ctrl+/)
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

      if (ev.altKey) {
        const k = ev.key.toLowerCase();
        if (k === 't') {
          ev.preventDefault();
          setActiveTool('trendline');
        } else if (k === 'h') {
          ev.preventDefault();
          setActiveTool('horizontalLine');
        } else if (k === 'v') {
          ev.preventDefault();
          setActiveTool('verticalLine');
        } else if (k === 'f') {
          ev.preventDefault();
          setActiveTool('fibRetracement');
        } else if (k === 'a') {
          ev.preventDefault();
          openModal('alert');
        }
      } else if (ev.key === '?') {
        openModal('shortcuts');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openModal, setActiveTool, undo, redo]);

  return (
    <div
      className={`tv-supercharts ${showDrawingBar ? '' : 'tv-supercharts--no-drawing'}`}
      data-testid="supercharts-workspace"
    >
      {/* Top 38px Supercharts Toolbar */}
      <ChartTopToolbar
        showDrawingBar={showDrawingBar}
        onToggleDrawingBar={() => setShowDrawingBar((v) => !v)}
      />

      {/* Left 52px Drawing Toolbar */}
      {showDrawingBar && <DrawingToolbar />}

      {/* Center Column: Multi-Chart Canvas Stage + Bottom Quick-Range Bar + Resizable Bottom Drawer */}
      <main className="sc-center-column">
        <div className="sc-chart-stage">
          <MultiChartGrid
            rangeSignal={rangeSignal}
            resetSignal={resetSignal}
            onHoverCandle={handleHoverCandle}
          />
          <ChartBottomBar
            onSelectRange={handleSelectRange}
            onResetView={handleResetView}
          />
        </div>

        <BottomDrawer />
      </main>

      {/* Right Area: Resizable Sidebar (Watchlist/Alerts/DataWindow/etc.) + 44px Tool Rail */}
      <div className="sc-right-area">
        <RightSidebar
          hoveredCandle={hoveredCandle}
          hoveredCandleIndex={hoveredCandleIndex}
        />
        <RightToolRail />
      </div>

      {/* Live Triggered Alert Toasts */}
      <AlertToastStack />
    </div>
  );
}

export default ChartPage;
