import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Check, RotateCcw, Settings } from 'lucide-react';
import type { ChartTimezoneSetting } from '../../types';
import {
  useActivePane,
  useTradingView,
  type RangePreset,
} from '../../store';

export interface ChartBottomBarProps {
  onSelectRange?: (preset: RangePreset) => void;
  onResetView?: () => void;
  onOpenPriceScaleMenu?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
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

const TIMEZONE_OPTIONS: Array<{
  id: ChartTimezoneSetting;
  label: string;
  shortTag: string;
}> = [
  { id: 'Europe/Rome', label: '(UTC+1) Roma / Europa', shortTag: 'UTC+1' },
  { id: 'UTC', label: '(UTC) Tempo Universale', shortTag: 'UTC' },
  { id: 'America/New_York', label: '(EST) New York', shortTag: 'EST' },
  { id: 'Asia/Tokyo', label: '(UTC+9) Tokyo', shortTag: 'UTC+9' },
];

function resolveOffsetTag(now: Date, tz: ChartTimezoneSetting): string {
  if (tz === 'UTC') return 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const zoneVal = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (zoneVal) {
      if (zoneVal === 'GMT' || zoneVal === 'UTC') return 'UTC';
      return zoneVal.replace(/^GMT/, 'UTC');
    }
  } catch {
    // Fallback below
  }
  return TIMEZONE_OPTIONS.find((t) => t.id === tz)?.shortTag ?? 'UTC+1';
}

function formatClockForTimezone(now: Date, tz: ChartTimezoneSetting): string {
  const offsetTag = resolveOffsetTag(now, tz);
  try {
    const time = new Intl.DateTimeFormat('it-IT', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
    return `${time} ${offsetTag}`;
  } catch {
    return `${now.toTimeString().slice(0, 8)} ${offsetTag}`;
  }
}

export function ChartBottomBar({
  onSelectRange,
  onResetView,
  onOpenPriceScaleMenu,
}: ChartBottomBarProps) {
  const { openModal } = useTradingView();
  const {
    activePane,
    chartSettings,
    updateChartSettings,
    setRangePreset,
    setScaleMode,
    toggleAutoScale,
  } = useActivePane();

  const timezone = chartSettings.symbol.timezone;
  const [clock, setClock] = useState<string>(() =>
    formatClockForTimezone(new Date(), timezone),
  );
  const [tzOpen, setTzOpen] = useState(false);
  const [tzPos, setTzPos] = useState<{ bottom: number; left: number }>({
    bottom: 44,
    left: 12,
  });
  const tzMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setClock(formatClockForTimezone(new Date(), timezone));
    const id = window.setInterval(() => {
      setClock(formatClockForTimezone(new Date(), timezone));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timezone]);

  useEffect(() => {
    if (!tzOpen) return;
    const onPointerDown = (ev: MouseEvent) => {
      if (tzMenuRef.current && !tzMenuRef.current.contains(ev.target as Node)) {
        setTzOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setTzOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [tzOpen]);

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

  const handleToggleTzPopover = (el: HTMLElement) => {
    if (tzOpen) {
      setTzOpen(false);
      return;
    }
    const rect = el.getBoundingClientRect();
    const menuWidth = 224;
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    setTzPos({
      bottom: Math.max(44, Math.round(window.innerHeight - rect.top + 6)),
      left: Math.max(8, Math.min(Math.round(rect.right - menuWidth), maxLeft)),
    });
    setTzOpen(true);
  };

  const handleGearClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (onOpenPriceScaleMenu) {
      onOpenPriceScaleMenu(e);
    } else {
      openModal('settings');
    }
  };

  return (
    <div className="sc-bottom-bar" role="toolbar" aria-label="Intervallo rapido e controlli scala">
      {/* Left: Quick Date Ranges + Reset Vista */}
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          title="Reset vista (Alt+R)"
          aria-label="Reset vista (Alt+R)"
          onClick={() => onResetView?.()}
        >
          <RotateCcw size={13} />
          <span className="sc-desktop-label">Reset vista</span>
        </button>
      </div>

      {/* Right: Live Timezone Clock + %, log, auto toggles + Price Scale Settings Gear */}
      <div className="sc-bottom-right">
        <button
          type="button"
          className={`sc-range-btn sc-clock ${tzOpen ? 'sc-range-btn--active' : ''}`}
          title={`Fuso orario: ${timezone} — clicca per cambiare`}
          aria-label={`Fuso orario ${timezone}`}
          aria-haspopup="menu"
          aria-expanded={tzOpen}
          onClick={(e) => handleToggleTzPopover(e.currentTarget)}
        >
          {clock}
        </button>

        <div className="sc-tb-divider sc-clock-sep" />

        <button
          type="button"
          className={`sc-range-btn ${activePane.scaleMode === 'percent' ? 'sc-range-btn--active' : ''}`}
          title="Scala percentuale (Alt+P)"
          aria-pressed={activePane.scaleMode === 'percent'}
          onClick={togglePercent}
        >
          %
        </button>
        <button
          type="button"
          className={`sc-range-btn ${activePane.scaleMode === 'log' ? 'sc-range-btn--active' : ''}`}
          title="Scala logaritmica (Alt+L)"
          aria-pressed={activePane.scaleMode === 'log'}
          onClick={toggleLog}
        >
          log
        </button>
        <button
          type="button"
          className={`sc-range-btn ${activePane.autoScale ? 'sc-range-btn--active' : ''}`}
          title="Auto (adatta dati a schermo)"
          aria-pressed={activePane.autoScale}
          onClick={() => toggleAutoScale()}
        >
          auto
        </button>

        <div className="sc-tb-divider" />

        <button
          type="button"
          className="sc-range-btn"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}
          title="Impostazioni scala prezzi"
          aria-label="Impostazioni scala prezzi"
          onClick={handleGearClick}
        >
          <Settings size={14} />
        </button>
      </div>

      {tzOpen && (
        <div
          ref={tzMenuRef}
          className="sc-menu"
          style={{
            top: 'auto',
            bottom: tzPos.bottom,
            left: tzPos.left,
            width: 224,
          }}
          role="menu"
          aria-label="Seleziona fuso orario"
        >
          <div className="sc-menu-section">Fuso orario</div>
          {TIMEZONE_OPTIONS.map((tz) => {
            const active = timezone === tz.id;
            return (
              <button
                key={tz.id}
                type="button"
                className={`sc-menu-item ${active ? 'sc-menu-item--active' : ''}`}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  updateChartSettings({ symbol: { timezone: tz.id } });
                  setTzOpen(false);
                }}
              >
                <span>{tz.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
