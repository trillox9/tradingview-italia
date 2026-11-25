import type { Candle } from '../../types';
import {
  LAYOUT_PANE_COUNTS,
  useActivePane,
  type RangePreset,
} from '../../store';
import { ChartCanvas } from './ChartCanvas';

export interface MultiChartGridProps {
  rangeSignal?: { preset: RangePreset; seq: number } | null;
  resetSignal?: number;
  onHoverCandle?: (candle: Candle | null, barIndex: number | null) => void;
}

export function MultiChartGrid({
  rangeSignal,
  resetSignal,
  onHoverCandle,
}: MultiChartGridProps) {
  const {
    layoutMode,
    panes,
    activePaneIndex,
    setActivePaneIndex,
  } = useActivePane();

  const visibleCount = LAYOUT_PANE_COUNTS[layoutMode];
  const visiblePanes = panes.slice(0, visibleCount);
  const isMultiChart = visibleCount > 1;

  return (
    <div
      className={`sc-multichart-grid sc-multichart-grid--${layoutMode}`}
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
          rangeSignal={idx === activePaneIndex ? rangeSignal : null}
          resetSignal={idx === activePaneIndex ? resetSignal : undefined}
          onFocusPane={setActivePaneIndex}
          onHoverCandle={idx === activePaneIndex ? onHoverCandle : undefined}
        />
      ))}
    </div>
  );
}
