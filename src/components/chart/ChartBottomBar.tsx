import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  useActivePane,
  type RangePreset,
} from '../../store';

export interface ChartBottomBarProps {
  onSelectRange?: (preset: RangePreset) => void;
  onResetView?: () => void;
}

const RANGE_PRESETS: Array<{ preset: RangePreset; label: string; title: string }> = [
  { preset: '1D', label: '1G', title: 'Intervallo 1 giorno' },
  { preset: '5D', label: '5G', title: 'Intervallo 5 giorni' },
  { preset: '1M', label: '1M', title: 'Intervallo 1 mese' },
  { preset: '3M', label: '3M', title: 'Intervallo 3 mesi' },
  { preset: '6M', label: '6M', title: 'Intervallo 6 mesi' },
  { preset: 'YTD', label: 'YTD', title: 'Anno in corso' },
  { preset: '1Y', label: '1A', title: 'Intervallo 1 anno' },
  { preset: '5Y', label: '5A', title: 'Intervallo 5 anni' },
  { preset: 'ALL', label: 'Tutto', title: 'Tutti i dati disponibili' },
];

function formatRomeClock(now: Date): string {
  try {
    const time = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    return `${time} (UTC+1)`;
  } catch {
    return `${now.toTimeString().slice(0, 8)} (UTC+1)`;
  }
}

export function ChartBottomBar({
  onSelectRange,
  onResetView,
}: ChartBottomBarProps) {
  const {
    activePane,
    setRangePreset,
    setScaleMode,
    toggleAutoScale,
  } = useActivePane();

  const [clock, setClock] = useState<string>(() => formatRomeClock(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(formatRomeClock(new Date()));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleRangeClick = (preset: RangePreset) => {
    setRangePreset(preset);
    onSelectRange?.(preset);
  };

  const togglePercent = () => {
    setScaleMode(activePane.scaleMode === 'percent' ? 'regular' : 'percent');
  };

  const toggleLog = () => {
    setScaleMode(activePane.scaleMode === 'log' ? 'regular' : 'log');
  };

  return (
    <div className="sc-bottom-bar" role="toolbar" aria-label="Intervallo rapido e controlli scala">
      {/* Left: Quick Date Ranges + Go-to-Date */}
      <div className="sc-bottom-left">
        {RANGE_PRESETS.map((r) => (
          <button
            key={r.preset}
            type="button"
            className={`sc-range-btn ${activePane.rangePreset === r.preset ? 'sc-range-btn--active' : ''}`}
            title={r.title}
            onClick={() => handleRangeClick(r.preset)}
          >
            {r.label}
          </button>
        ))}

        <div className="sc-tb-divider" />

        <button
          type="button"
          className="sc-range-btn"
          title="Vai all'ultima barra / Ripristina vista"
          aria-label="Vai a"
          onClick={() => onResetView?.()}
        >
          <CalendarClock size={14} />
        </button>
      </div>

      {/* Right: Rome Clock + %, log, auto toggles */}
      <div className="sc-bottom-right">
        <span className="sc-clock" title="Fuso orario Europa/Roma">
          {clock}
        </span>

        <div className="sc-tb-divider sc-clock-sep" />

        <button
          type="button"
          className={`sc-range-btn ${activePane.scaleMode === 'percent' ? 'sc-range-btn--active' : ''}`}
          title="Scala percentuale (%)"
          onClick={togglePercent}
        >
          %
        </button>
        <button
          type="button"
          className={`sc-range-btn ${activePane.scaleMode === 'log' ? 'sc-range-btn--active' : ''}`}
          title="Scala logaritmica"
          onClick={toggleLog}
        >
          log
        </button>
        <button
          type="button"
          className={`sc-range-btn ${activePane.autoScale ? 'sc-range-btn--active' : ''}`}
          title="Auto (adatta dati a schermo)"
          onClick={() => toggleAutoScale()}
        >
          auto
        </button>
      </div>
    </div>
  );
}
