import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Calendar, Check, ChevronDown, Settings, X } from 'lucide-react';
import { CHART_TIMEZONE_OPTIONS, type ChartTimezoneSetting } from '../../types';
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

const RANGE_PRESETS: Array<{
  preset: RangePreset;
  label: string;
  title: string;
  mobileDesc: string;
}> = [
  { preset: '1D', label: '1D', title: '1 giorno', mobileDesc: 'Intervallo 1 giorno' },
  { preset: '5D', label: '5D', title: '5 giorni', mobileDesc: 'Intervallo 5 giorni' },
  { preset: '1M', label: '1M', title: '1 mese', mobileDesc: 'Intervallo 1 mese' },
  { preset: '3M', label: '3M', title: '3 mesi', mobileDesc: 'Intervallo 3 mesi' },
  { preset: '6M', label: '6M', title: '6 mesi', mobileDesc: 'Intervallo 6 mesi' },
  { preset: 'YTD', label: 'YTD', title: 'Da inizio anno', mobileDesc: 'Anno in corso (YTD)' },
  { preset: '1Y', label: '1Y', title: '1 anno', mobileDesc: 'Intervallo 1 anno' },
  { preset: '5Y', label: '5Y', title: '5 anni', mobileDesc: 'Intervallo 5 anni' },
  { preset: 'ALL', label: 'Tutto', title: 'Tutti i dati', mobileDesc: 'Tutti i dati disponibili' },
];

const TIMEZONE_OPTIONS = CHART_TIMEZONE_OPTIONS.map((tz) => ({
  id: tz.value,
  label: tz.label,
  shortTag: tz.shortTag,
}));

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

function getDefaultGotoDateStr(): string {
  const d = new Date(Date.now() - 30 * 86400 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ChartBottomBar({
  onSelectRange,
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
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoDate, setGotoDate] = useState<string>(getDefaultGotoDateStr);
  const [gotoTime, setGotoTime] = useState<string>('09:00');
  const [mobileRangeOpen, setMobileRangeOpen] = useState(false);
  const [adjEnabled, setAdjEnabled] = useState(false);

  const tzMenuRef = useRef<HTMLDivElement | null>(null);
  const gotoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setClock(formatClockForTimezone(new Date(), timezone));
    const id = window.setInterval(() => {
      setClock(formatClockForTimezone(new Date(), timezone));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timezone]);

  // Global Alt+G shortcut to open TradingView "Vai a" Go-To-Date dialog
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (inEditable) return;
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'g') {
        ev.preventDefault();
        setGotoOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!tzOpen && !gotoOpen) return;
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (tzOpen && tzMenuRef.current && !tzMenuRef.current.contains(target)) {
        setTzOpen(false);
      }
      if (gotoOpen && gotoRef.current && !gotoRef.current.contains(target)) {
        setGotoOpen(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setTzOpen(false);
        setGotoOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [tzOpen, gotoOpen]);

  const handleRangeClick = (preset: RangePreset) => {
    setRangePreset(preset);
    onSelectRange?.(preset);
    setMobileRangeOpen(false);
  };

  const handleGotoSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!gotoDate) return;
    const parsedMs = Date.parse(`${gotoDate}T${gotoTime || '00:00'}:00Z`);
    if (Number.isFinite(parsedMs)) {
      window.dispatchEvent(
        new CustomEvent('tv-chart-goto-date', {
          detail: { timestampSec: Math.floor(parsedMs / 1000) },
        }),
      );
      setGotoOpen(false);
    }
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
    const menuWidth = 232;
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

  const activeRangeLabel =
    RANGE_PRESETS.find((r) => r.preset === activePane.rangePreset)?.label ?? '1Y';

  return (
    <div
      className="sc-bottom-bar"
      role="toolbar"
      aria-label="Intervallo rapido e controlli scala"
    >
      {/* Left: Desktop Quick Date Ranges (1D..Tutto + Vai a) OR Mobile "Range data ▾" Sheet Trigger */}
      <div className="sc-bottom-left">
        <div className="sc-desktop-ranges">
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
            className={`sc-range-btn ${gotoOpen ? 'sc-range-btn--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            title="Vai a una data (Alt+G)"
            aria-label="Vai a"
            aria-expanded={gotoOpen}
            onClick={() => setGotoOpen((prev) => !prev)}
          >
            <Calendar size={13} />
            <span>Vai a</span>
          </button>
        </div>

        {/* Authentic TradingView Mobile "Range data ▾" trigger (<= 900px) */}
        <button
          type="button"
          className={`sc-range-btn sc-mobile-range-btn ${mobileRangeOpen ? 'sc-range-btn--active' : ''}`}
          data-testid="mobile-range-trigger"
          aria-haspopup="dialog"
          aria-expanded={mobileRangeOpen}
          onClick={() => setMobileRangeOpen(true)}
        >
          <span>Range data ({activeRangeLabel})</span>
          <ChevronDown size={13} />
        </button>
      </div>

      {/* Right: Live Timezone Clock + adg, %, log, auto + Corner Gear */}
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
          className={`sc-range-btn ${adjEnabled ? 'sc-range-btn--active' : ''}`}
          title="Adegua i dati ai dividendi"
          aria-label="Adegua i dati"
          aria-pressed={adjEnabled}
          onClick={() => setAdjEnabled((v) => !v)}
        >
          adg
        </button>
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
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
          }}
          title="Impostazioni scala prezzi"
          aria-label="Impostazioni scala prezzi"
          onClick={handleGearClick}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Go-To-Date ("Vai a") Popover */}
      {gotoOpen && (
        <div
          ref={gotoRef}
          className="sc-goto-popover"
          role="dialog"
          aria-label="Vai a data"
          data-testid="goto-date-popover"
        >
          <div className="sc-goto-head">
            <span>Vai a</span>
            <button
              type="button"
              className="sc-ind-act-btn"
              aria-label="Chiudi Vai a"
              onClick={() => setGotoOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <form className="sc-goto-form" onSubmit={handleGotoSubmit}>
            <label className="sc-goto-field">
              <span>Data</span>
              <input
                type="date"
                aria-label="Data di destinazione"
                value={gotoDate}
                onChange={(e) => setGotoDate(e.target.value)}
                required
              />
            </label>
            <label className="sc-goto-field">
              <span>Ora (UTC)</span>
              <input
                type="time"
                aria-label="Ora di destinazione"
                value={gotoTime}
                onChange={(e) => setGotoTime(e.target.value)}
              />
            </label>
            <button type="submit" className="sc-goto-submit">
              Vai a
            </button>
          </form>
        </div>
      )}

      {/* Mobile "Range data" Bottom Sheet */}
      {mobileRangeOpen && (
        <div
          className="sc-mobile-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Range data"
          data-testid="mobile-range-sheet"
          onClick={() => setMobileRangeOpen(false)}
        >
          <div
            className="sc-mobile-range-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sc-mobile-sheet-header">
              <span>Range data</span>
              <button
                type="button"
                className="sc-ind-act-btn"
                aria-label="Chiudi Range data"
                onClick={() => setMobileRangeOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="sc-mobile-range-list">
              {RANGE_PRESETS.map((r) => {
                const active = activePane.rangePreset === r.preset;
                return (
                  <button
                    key={r.preset}
                    type="button"
                    className={`sc-menu-item ${active ? 'sc-menu-item--active' : ''}`}
                    onClick={() => handleRangeClick(r.preset)}
                  >
                    <span>
                      <strong>{r.label}</strong> · {r.mobileDesc}
                    </span>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
              <div className="sc-menu-sep" />
              <button
                type="button"
                className="sc-menu-item"
                onClick={() => {
                  setMobileRangeOpen(false);
                  setGotoOpen(true);
                }}
              >
                <span className="sc-menu-item-left">
                  <Calendar size={14} />
                  <span>Vai a una data…</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timezone Popover */}
      {tzOpen && (
        <div
          ref={tzMenuRef}
          className="sc-menu"
          style={{
            top: 'auto',
            bottom: tzPos.bottom,
            left: tzPos.left,
            width: 232,
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
