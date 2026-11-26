import { useState } from 'react';
import { BarChart3, Bell, Layers, List, X } from 'lucide-react';
import type { Candle } from '../../types';
import { useAlerts, useTradingView, type RightPanelTab } from '../../store';
import { AlertsPanel } from './AlertsPanel';
import { DataWindowPanel } from './DataWindowPanel';
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

const PANEL_TABS: Array<{
  id: Exclude<RightPanelTab, null>;
  label: string;
  Icon: typeof List;
}> = [
  { id: 'watchlist', label: 'Lista', Icon: List },
  { id: 'alerts', label: 'Avvisi', Icon: Bell },
  { id: 'data', label: 'Dati', Icon: BarChart3 },
  { id: 'objectTree', label: 'Oggetti', Icon: Layers },
];

export function RightSidebar({
  hoveredCandle,
  hoveredCandleIndex,
}: RightSidebarProps) {
  const { rightPanel, setRightPanel } = useTradingView();
  const { alerts, triggeredToasts } = useAlerts();
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState<boolean>(false);

  if (!rightPanel) {
    return null;
  }

  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const unreadAlertsCount = triggeredToasts.length;

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
    <>
      <div
        className="tv-right-sidebar-backdrop"
        aria-hidden="true"
        onClick={() => setRightPanel(null)}
      />

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

        {/* Pure Supercharts Panel Switcher + Close Bar (visible across all viewports) */}
        <div className="tv-right-sidebar-mobile-bar">
          <div className="tv-right-sidebar-mobile-tabs" role="tablist">
            {PANEL_TABS.map(({ id, label, Icon }) => {
              const active = rightPanel === id;
              const badgeCount =
                id === 'alerts'
                  ? unreadAlertsCount > 0
                    ? unreadAlertsCount
                    : activeAlertsCount
                  : 0;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`tv-right-sidebar-mobile-tab${active ? ' is-active' : ''}`}
                  onClick={() => setRightPanel(id)}
                >
                  <Icon size={13} strokeWidth={1.9} />
                  <span>{label}</span>
                  {badgeCount > 0 && (
                    <span className="tv-tab-count">{badgeCount}</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="tv-right-sidebar-close-btn"
            aria-label="Chiudi pannello laterale"
            title="Chiudi pannello"
            onClick={() => setRightPanel(null)}
          >
            <X size={16} />
          </button>
        </div>

        {rightPanel === 'watchlist' && <WatchlistPanel />}
        {rightPanel === 'alerts' && <AlertsPanel />}
        {rightPanel === 'data' && (
          <DataWindowPanel
            hoveredCandle={hoveredCandle}
            hoveredCandleIndex={hoveredCandleIndex}
          />
        )}
        {rightPanel === 'objectTree' && <ObjectTreePanel />}
      </section>
    </>
  );
}
