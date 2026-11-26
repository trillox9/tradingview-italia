import { useCallback, useEffect, useState } from 'react';
import type { Candle } from '../../types';
import {
  LAYOUT_PANE_COUNTS,
  useActivePane,
  type RangePreset,
} from '../../store';
import {
  ChartCanvas,
  type ChartContextMenuPayload,
  type ChartContextMenuTarget,
  type PriceAxisPlusPayload,
} from './ChartCanvas';

export type {
  ChartContextMenuPayload,
  ChartContextMenuTarget,
  PriceAxisPlusPayload,
};

export interface MultiChartSyncOptions {
  symbol: boolean;
  timeframe: boolean;
  crosshair: boolean;
  time: boolean;
}

const MULTICHART_SYNC_KEY = 'tv_it_multichart_sync_v1';

export const DEFAULT_MULTICHART_SYNC: MultiChartSyncOptions = {
  symbol: false,
  timeframe: false,
  crosshair: true,
  time: true,
};

export function loadMultiChartSync(): MultiChartSyncOptions {
  if (typeof window === 'undefined') return DEFAULT_MULTICHART_SYNC;
  try {
    const raw = window.localStorage.getItem(MULTICHART_SYNC_KEY);
    if (!raw) return DEFAULT_MULTICHART_SYNC;
    const parsed = JSON.parse(raw) as Partial<MultiChartSyncOptions>;
    return {
      symbol: Boolean(parsed.symbol ?? DEFAULT_MULTICHART_SYNC.symbol),
      timeframe: Boolean(parsed.timeframe ?? DEFAULT_MULTICHART_SYNC.timeframe),
      crosshair: Boolean(parsed.crosshair ?? DEFAULT_MULTICHART_SYNC.crosshair),
      time: Boolean(parsed.time ?? DEFAULT_MULTICHART_SYNC.time),
    };
  } catch {
    return DEFAULT_MULTICHART_SYNC;
  }
}

export function saveMultiChartSync(next: MultiChartSyncOptions): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MULTICHART_SYNC_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent<MultiChartSyncOptions>('tv-multichart-sync-change', {
      detail: next,
    }),
  );
}

export interface MultiChartGridProps {
  rangeSignal?: { preset: RangePreset; seq: number } | null;
  resetSignal?: number;
  onHoverCandle?: (candle: Candle | null, barIndex: number | null) => void;
  onChartContextMenu?: (payload: ChartContextMenuPayload) => void;
  onPriceAxisPlusClick?: (payload: PriceAxisPlusPayload) => void;
  onZoomHistoryChange?: (canZoomOut: boolean, zoomOutFn: () => void) => void;
  hideInlineDrawingBar?: boolean;
}

export function MultiChartGrid({
  rangeSignal,
  resetSignal,
  onHoverCandle,
  onChartContextMenu,
  onPriceAxisPlusClick,
  onZoomHistoryChange,
  hideInlineDrawingBar,
}: MultiChartGridProps) {
  const {
    layoutMode,
    panes,
    activePane,
    activePaneIndex,
    setActivePaneIndex,
    updatePane,
  } = useActivePane();

  const visibleCount = LAYOUT_PANE_COUNTS[layoutMode];
  const visiblePanes = panes.slice(0, visibleCount);
  const isMultiChart = visibleCount > 1;

  const [syncOpts, setSyncOpts] = useState<MultiChartSyncOptions>(loadMultiChartSync);

  useEffect(() => {
    const onSyncChange = (ev: Event) => {
      const detail = (ev as CustomEvent<MultiChartSyncOptions>).detail;
      if (detail) setSyncOpts(detail);
    };
    window.addEventListener('tv-multichart-sync-change', onSyncChange);
    return () => window.removeEventListener('tv-multichart-sync-change', onSyncChange);
  }, []);

  // Sync Symbol across all visible panes when `Simbolo` sync is enabled
  useEffect(() => {
    if (!isMultiChart || !syncOpts.symbol) return;
    for (let i = 0; i < visibleCount; i++) {
      if (i !== activePaneIndex && panes[i] && panes[i].symbolId !== activePane.symbolId) {
        updatePane(i, { symbolId: activePane.symbolId });
      }
    }
  }, [isMultiChart, syncOpts.symbol, activePane.symbolId, activePaneIndex, visibleCount, panes, updatePane]);

  // Sync Timeframe across all visible panes when `Timeframe` sync is enabled
  useEffect(() => {
    if (!isMultiChart || !syncOpts.timeframe) return;
    for (let i = 0; i < visibleCount; i++) {
      if (i !== activePaneIndex && panes[i] && panes[i].timeframe !== activePane.timeframe) {
        updatePane(i, { timeframe: activePane.timeframe });
      }
    }
  }, [isMultiChart, syncOpts.timeframe, activePane.timeframe, activePaneIndex, visibleCount, panes, updatePane]);

  // Multi-chart synchronized timestamp crosshair across all visible sibling panes
  const [syncedCrosshair, setSyncedCrosshair] = useState<{
    timestamp: number | null;
    sourcePaneIndex: number;
  }>({ timestamp: null, sourcePaneIndex: -1 });

  useEffect(() => {
    if (!isMultiChart || !syncOpts.crosshair) {
      setSyncedCrosshair({ timestamp: null, sourcePaneIndex: -1 });
    }
  }, [isMultiChart, syncOpts.crosshair]);

  const handleCrosshairTimeChange = useCallback(
    (paneIndex: number, timestamp: number | null) => {
      if (!isMultiChart || !syncOpts.crosshair) return;
      setSyncedCrosshair((prev) => {
        if (timestamp === null) {
          return prev.sourcePaneIndex === paneIndex
            ? { timestamp: null, sourcePaneIndex: -1 }
            : prev;
        }
        if (prev.timestamp === timestamp && prev.sourcePaneIndex === paneIndex) {
          return prev;
        }
        return { timestamp, sourcePaneIndex: paneIndex };
      });
    },
    [isMultiChart, syncOpts.crosshair],
  );

  return (
    <div
      className={`sc-multichart-grid sc-multichart-grid--${layoutMode}`}
      data-testid="multichart-grid"
      data-layout-mode={layoutMode}
      role="region"
      aria-label="Area grafici Supercharts"
    >
      {visiblePanes.map((pane, idx) => (
        <ChartCanvas
          key={pane.id}
          pane={pane}
          paneIndex={idx}
          isActivePane={idx === activePaneIndex}
          isMultiChart={isMultiChart}
          rangeSignal={idx === activePaneIndex || syncOpts.time ? rangeSignal : null}
          resetSignal={idx === activePaneIndex ? resetSignal : undefined}
          onFocusPane={setActivePaneIndex}
          onHoverCandle={idx === activePaneIndex ? onHoverCandle : undefined}
          onChartContextMenu={onChartContextMenu}
          onPriceAxisPlusClick={onPriceAxisPlusClick}
          onZoomHistoryChange={
            idx === activePaneIndex ? onZoomHistoryChange : undefined
          }
          hideInlineDrawingBar={hideInlineDrawingBar}
          syncedCrosshairTime={
            isMultiChart && syncOpts.crosshair && syncedCrosshair.sourcePaneIndex !== idx
              ? syncedCrosshair.timestamp
              : null
          }
          onCrosshairTimeChange={
            isMultiChart && syncOpts.crosshair
              ? (ts) => handleCrosshairTimeChange(idx, ts)
              : undefined
          }
        />
      ))}
    </div>
  );
}
