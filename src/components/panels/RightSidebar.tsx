import { useState } from 'react';
import type { Candle } from '../../types';
import { useTradingView } from '../../store';
import { AlertsPanel } from './AlertsPanel';
import { CalendarPanel } from './CalendarPanel';
import { DataWindowPanel } from './DataWindowPanel';
import { HotlistsPanel } from './HotlistsPanel';
import { NewsPanel } from './NewsPanel';
import { ObjectTreePanel } from './ObjectTreePanel';
import { WatchlistPanel } from './WatchlistPanel';

export interface RightSidebarProps {
  /** Optional crosshair-hovered candle forwarded to DataWindowPanel */
  hoveredCandle?: Candle | null;
  /** Optional crosshair-hovered candle index forwarded to DataWindowPanel */
  hoveredCandleIndex?: number | null;
}

const MIN_WIDTH = 260;
const MAX_WIDTH = 440;
const DEFAULT_WIDTH = 304;

export function RightSidebar({
  hoveredCandle,
  hoveredCandleIndex,
}: RightSidebarProps) {
  const { rightPanel } = useTradingView();
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState<boolean>(false);

  if (!rightPanel) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + delta)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <section
      className="tv-right-sidebar"
      style={{ width: `${width}px` }}
      aria-label="Pannello laterale destro"
    >
      <div
        className={`tv-resize-handle-x${dragging ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Ridimensiona barra laterale destra"
        onMouseDown={handleMouseDown}
      />

      {rightPanel === 'watchlist' && <WatchlistPanel />}
      {rightPanel === 'alerts' && <AlertsPanel />}
      {rightPanel === 'data' && (
        <DataWindowPanel
          hoveredCandle={hoveredCandle}
          hoveredCandleIndex={hoveredCandleIndex}
        />
      )}
      {rightPanel === 'hotlists' && <HotlistsPanel />}
      {rightPanel === 'calendar' && <CalendarPanel />}
      {rightPanel === 'news' && <NewsPanel />}
      {rightPanel === 'objectTree' && <ObjectTreePanel />}
    </section>
  );
}
