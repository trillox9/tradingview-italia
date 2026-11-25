import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronDown,
  Globe,
  Home,
  Keyboard,
  LayoutGrid,
  LineChart,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Plus,
  Redo2,
  Rewind,
  Settings,
  Sun,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS_IT,
  type ChartType,
  type Timeframe,
} from '../../types';
import {
  useActivePane,
  useDrawings,
  useTradingView,
  type LayoutMode,
} from '../../store';

export interface ChartTopToolbarProps {
  showDrawingBar: boolean;
  onToggleDrawingBar: () => void;
}

const CHART_STYLES: Array<{
  type: ChartType;
  label: string;
  group: string;
}> = [
  { type: 'bars', label: 'Barre', group: 'Prezzo' },
  { type: 'candles', label: 'Candele', group: 'Prezzo' },
  { type: 'hollow', label: 'Candele vuote', group: 'Prezzo' },
  { type: 'line', label: 'Linea', group: 'Linea & Area' },
  { type: 'area', label: 'Area', group: 'Linea & Area' },
  { type: 'baseline', label: 'Baseline', group: 'Linea & Area' },
  { type: 'heikinAshi', label: 'Heikin Ashi', group: 'Avanzati' },
];

const TIMEFRAME_GROUPS: Array<{ title: string; items: Timeframe[] }> = [
  { title: 'Minuti', items: ['1m', '5m', '15m'] },
  { title: 'Ore', items: ['1H', '4H'] },
  { title: 'Giorni & Oltre', items: ['1D', '1W', '1M'] },
];

const LAYOUT_OPTIONS: Array<{
  mode: LayoutMode;
  label: string;
  cells: number;
}> = [
  { mode: '1', label: '1 Grafico', cells: 1 },
  { mode: '2v', label: '2 Verticale', cells: 2 },
  { mode: '2h', label: '2 Orizzontale', cells: 2 },
  { mode: '4', label: '4 Griglia', cells: 4 },
];

function ChartStyleIcon({ type }: { type: ChartType }) {
  switch (type) {
    case 'bars':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 4v10M3 7h2M5 11h2M13 3v11M11 6h2M13 10h2" strokeLinecap="round" />
        </svg>
      );
    case 'hollow':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M5.5 3v2.5M5.5 12.5V15M12.5 2v2M12.5 11v4" strokeLinecap="round" />
          <rect x="3.5" y="5.5" width="4" height="7" rx="0.6" />
          <rect x="10.5" y="4" width="4" height="7" rx="0.6" />
        </svg>
      );
    case 'line':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2.5 12.5L6.5 8.5L10 10.5L15.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'area':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 14.5V11L6.5 7.5L10.5 9.5L15.5 4.5V14.5H2.5Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M2.5 11L6.5 7.5L10.5 9.5L15.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'baseline':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 9.5h14" stroke="currentColor" strokeOpacity="0.45" strokeDasharray="2 2" />
          <path d="M2.5 12.5L6 6.5L10.5 11.5L15.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'heikinAshi':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M5 14V4M13 13V3" strokeLinecap="round" />
          <rect x="3.5" y="7" width="3" height="5" fill="currentColor" rx="0.5" />
          <rect x="11.5" y="5" width="3" height="5.5" fill="currentColor" rx="0.5" />
        </svg>
      );
    case 'candles':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M5.5 3v12M12.5 2.5v12.5" strokeLinecap="round" />
          <rect x="3.75" y="5.5" width="3.5" height="6.5" fill="currentColor" rx="0.6" />
          <rect x="10.75" y="4.5" width="3.5" height="5.5" fill="currentColor" rx="0.6" />
        </svg>
      );
  }
}

function LayoutPreviewSvg({ mode }: { mode: LayoutMode }) {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="1.5" width="23" height="15" rx="2" />
      {mode === '2v' && <line x1="13" y1="1.5" x2="13" y2="16.5" />}
      {mode === '2h' && <line x1="1.5" y1="9" x2="24.5" y2="9" />}
      {mode === '4' && (
        <>
          <line x1="13" y1="1.5" x2="13" y2="16.5" />
          <line x1="1.5" y1="9" x2="24.5" y2="9" />
        </>
      )}
    </svg>
  );
}

type OpenMenu = 'main' | 'timeframe' | 'style' | 'layout' | null;

export function ChartTopToolbar({
  showDrawingBar,
  onToggleDrawingBar,
}: ChartTopToolbarProps) {
  const {
    theme,
    toggleTheme,
    navigate,
    openModal,
    setBottomPanel,
    appendLog,
  } = useTradingView();

  const {
    activePane,
    activeSymbol,
    layoutMode,
    setLayoutMode,
    setTimeframe,
    setChartType,
    replay,
    startReplay,
    exitReplay,
  } = useActivePane();

  const { canUndo, canRedo, undo, redo } = useDrawings();

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 42,
    left: 6,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = window.setTimeout(() => setToastMsg(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  const toggleMenuAt = (menu: Exclude<OpenMenu, null>, el: HTMLElement) => {
    if (openMenu === menu) {
      setOpenMenu(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - 260);
    setMenuPos({
      top: Math.round(rect.bottom + 4),
      left: Math.min(Math.round(rect.left), maxLeft),
    });
    setOpenMenu(menu);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleReplayToggle = () => {
    if (replay.active) {
      exitReplay();
    } else {
      startReplay();
    }
  };

  const handlePublish = () => {
    openModal('snapshot');
    setToastMsg(`Idea pronta per la pubblicazione (${activeSymbol.ticker} · ${activePane.timeframe})`);
    appendLog({
      category: 'system',
      level: 'info',
      title: `Pubblicazione idea: ${activeSymbol.ticker}`,
      detail: `Timeframe ${activePane.timeframe} — vista snapshot aperta.`,
      symbol: activeSymbol.ticker,
    });
  };

  const currentStyleLabel =
    CHART_STYLES.find((s) => s.type === activePane.chartType)?.label ?? 'Candele';
  const visibleIndicatorCount = activePane.indicators.filter((i) => i.visible).length;

  return (
    <header className="sc-top-bar" role="toolbar" aria-label="Barra degli strumenti Supercharts">
      <div className="sc-top-left">
        {/* Top-left Hamburger Menu Button (52px aligned over left drawing rail) */}
        <div className="sc-burger-slot">
          <button
            type="button"
            className={`sc-tb-btn sc-tb-btn--icon ${openMenu === 'main' ? 'sc-tb-btn--active' : ''}`}
            title="Menu principale"
            aria-label="Menu principale"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'main'}
            onClick={(e) => toggleMenuAt('main', e.currentTarget)}
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Symbol Search Trigger */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-symbol"
          title="Ricerca simbolo (Ctrl+K)"
          aria-label={`Cambia simbolo ${activeSymbol.ticker}`}
          onClick={() => openModal('symbolSearch')}
        >
          <span
            className="sc-symbol-dot"
            style={{ background: activeSymbol.logoColor }}
          >
            {activeSymbol.logoText.slice(0, 2)}
          </span>
          <span>{activeSymbol.ticker}</span>
        </button>

        {/* Compare Symbol (+) */}
        <button
          type="button"
          className={`sc-tb-btn sc-tb-btn--icon ${activePane.compareSymbols.length > 0 ? 'sc-tb-btn--active' : ''}`}
          title="Confronta simboli"
          aria-label="Confronta simboli"
          onClick={() => openModal('compare')}
        >
          <Plus size={17} />
        </button>

        <div className="sc-tb-divider" />

        {/* Timeframe Quick Buttons + Dropdown */}
        <div className="sc-tf-group" role="group" aria-label="Intervalli temporali">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              className={`sc-tb-btn sc-tf-btn ${activePane.timeframe === tf ? 'sc-tb-btn--active' : ''}`}
              title={TIMEFRAME_LABELS_IT[tf]}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
          <button
            type="button"
            className={`sc-tb-btn sc-tb-btn--icon ${openMenu === 'timeframe' ? 'sc-tb-btn--active' : ''}`}
            title="Tutti i timeframe"
            aria-label="Seleziona intervallo temporale"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'timeframe'}
            onClick={(e) => toggleMenuAt('timeframe', e.currentTarget)}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="sc-tb-divider" />

        {/* Chart Style Selector */}
        <button
          type="button"
          className={`sc-tb-btn ${openMenu === 'style' ? 'sc-tb-btn--active' : ''}`}
          title={`Stile grafico: ${currentStyleLabel}`}
          aria-label={`Stile grafico ${currentStyleLabel}`}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'style'}
          onClick={(e) => toggleMenuAt('style', e.currentTarget)}
        >
          <ChartStyleIcon type={activePane.chartType} />
          <ChevronDown size={13} />
        </button>

        <div className="sc-tb-divider" />

        {/* Indicators Button */}
        <button
          type="button"
          className="sc-tb-btn"
          title="Indicatori, metriche e strategie"
          aria-label="Indicatori, metriche e strategie"
          onClick={() => openModal('indicators')}
        >
          <LineChart size={16} />
          <span>Indicatori</span>
          {visibleIndicatorCount > 0 && (
            <span className="sc-badge-count">{visibleIndicatorCount}</span>
          )}
        </button>

        <div className="sc-tb-divider" />

        {/* Alert */}
        <button
          type="button"
          className="sc-tb-btn"
          title="Crea avviso (Alt+A)"
          aria-label="Crea avviso"
          onClick={() => openModal('alert')}
        >
          <Bell size={15} />
          <span>Avviso</span>
        </button>

        {/* Bar Replay */}
        <button
          type="button"
          className={`sc-tb-btn ${replay.active ? 'sc-tb-btn--active' : ''}`}
          title="Bar Replay — simula candela per candela"
          aria-label="Bar replay"
          onClick={handleReplayToggle}
        >
          <Rewind size={15} />
          <span>Replay</span>
        </button>

        <div className="sc-tb-divider" />

        {/* Undo / Redo Drawings */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title="Annulla disegno (Ctrl+Z)"
          aria-label="Annulla"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title="Ripeti disegno (Ctrl+Y)"
          aria-label="Ripeti"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          <Redo2 size={15} />
        </button>
      </div>

      {/* Right Toolbar Actions */}
      <div className="sc-top-right">
        {/* Multi-chart Layout Picker */}
        <button
          type="button"
          className={`sc-tb-btn sc-tb-btn--icon ${openMenu === 'layout' || layoutMode !== '1' ? 'sc-tb-btn--active' : ''}`}
          title="Impostazione layout multi-grafico"
          aria-label="Impostazione layout"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'layout'}
          onClick={(e) => toggleMenuAt('layout', e.currentTarget)}
        >
          <LayoutGrid size={16} />
        </button>

        <div className="sc-tb-divider" />

        {/* Quick Theme Toggle */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title={theme === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
          aria-label={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Chart Settings */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title="Impostazioni grafico"
          aria-label="Impostazioni"
          onClick={() => openModal('settings')}
        >
          <Settings size={16} />
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title={isFullscreen ? 'Esci da schermo intero' : 'Modalità schermo intero'}
          aria-label="Modalità schermo intero"
          onClick={handleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Camera Snapshot */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon"
          title="Fai uno screenshot"
          aria-label="Fai uno screenshot"
          onClick={() => openModal('snapshot')}
        >
          <Camera size={16} />
        </button>

        {/* Trade Pill (opens Paper Trading Drawer) */}
        <button
          type="button"
          className="sc-trade-pill"
          title="Apri Pannello di trading / Paper Trading"
          onClick={() => setBottomPanel('trading')}
        >
          Trade
        </button>

        {/* Pubblica Blue CTA */}
        <button
          type="button"
          className="sc-publish-btn"
          title="Pubblica la tua idea o condividi snapshot"
          onClick={handlePublish}
        >
          <Upload size={13} />
          <span>Pubblica</span>
        </button>
      </div>

      {/* ======================== PORTAL-LIKE FIXED MENUS ======================== */}
      {openMenu === 'main' && (
        <div
          ref={menuRef}
          className="sc-menu"
          style={{ top: menuPos.top, left: 6, width: 248 }}
          role="menu"
        >
          <div className="sc-menu-header">
            <svg width="24" height="16" viewBox="0 0 36 22" fill="currentColor" aria-hidden="true">
              <path d="M14.5 19H8.8V8.2H3V3h11.5v16zM21.5 19h-5.8L23 3h5.8L21.5 19zM30.5 8.6a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z" />
            </svg>
            <span>TradingView Italia</span>
          </div>

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('home');
            }}
          >
            <span className="sc-menu-item-left"><Home size={15} /> Home</span>
          </button>
          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('markets');
            }}
          >
            <span className="sc-menu-item-left"><Globe size={15} /> Mercati</span>
          </button>
          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('heatmap');
            }}
          >
            <span className="sc-menu-item-left"><LayoutGrid size={15} /> Mappe di calore</span>
          </button>
          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('screener');
            }}
          >
            <span className="sc-menu-item-left"><LineChart size={15} /> Screener</span>
          </button>
          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('calendar');
            }}
          >
            <span className="sc-menu-item-left"><Bell size={15} /> Calendario Economico</span>
          </button>
          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('community');
            }}
          >
            <span className="sc-menu-item-left"><Upload size={15} /> Community & Idee</span>
          </button>

          <div className="sc-menu-sep" />

          <button
            type="button"
            className="sc-menu-item"
            onClick={toggleTheme}
          >
            <span className="sc-menu-item-left">
              {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              Tema scuro
            </span>
            <span className={`sc-switch ${theme === 'dark' ? 'sc-switch--on' : ''}`} />
          </button>

          <button
            type="button"
            className="sc-menu-item"
            onClick={onToggleDrawingBar}
          >
            <span className="sc-menu-item-left">
              <LineChart size={15} />
              Pannello dei disegni
            </span>
            <span className={`sc-switch ${showDrawingBar ? 'sc-switch--on' : ''}`} />
          </button>

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              openModal('shortcuts');
            }}
          >
            <span className="sc-menu-item-left">
              <Keyboard size={15} />
              Scorciatoie da tastiera
            </span>
            <span className="sc-menu-kbd">Ctrl + /</span>
          </button>
        </div>
      )}

      {openMenu === 'timeframe' && (
        <div
          ref={menuRef}
          className="sc-menu"
          style={{ top: menuPos.top, left: menuPos.left, width: 210 }}
          role="menu"
        >
          {TIMEFRAME_GROUPS.map((grp, idx) => (
            <div key={grp.title}>
              {idx > 0 && <div className="sc-menu-sep" />}
              <div className="sc-menu-section">{grp.title}</div>
              {grp.items.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`sc-menu-item ${activePane.timeframe === tf ? 'sc-menu-item--active' : ''}`}
                  onClick={() => {
                    setTimeframe(tf);
                    setOpenMenu(null);
                  }}
                >
                  <span>{TIMEFRAME_LABELS_IT[tf]}</span>
                  <span className="sc-menu-kbd">{tf}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {openMenu === 'style' && (
        <div
          ref={menuRef}
          className="sc-menu"
          style={{ top: menuPos.top, left: menuPos.left, width: 224 }}
          role="menu"
        >
          {(['Prezzo', 'Linea & Area', 'Avanzati'] as const).map((grp, idx) => (
            <div key={grp}>
              {idx > 0 && <div className="sc-menu-sep" />}
              <div className="sc-menu-section">{grp}</div>
              {CHART_STYLES.filter((s) => s.group === grp).map((s) => (
                <button
                  key={s.type}
                  type="button"
                  className={`sc-menu-item ${activePane.chartType === s.type ? 'sc-menu-item--active' : ''}`}
                  onClick={() => {
                    setChartType(s.type);
                    setOpenMenu(null);
                  }}
                >
                  <span className="sc-menu-item-left">
                    <ChartStyleIcon type={s.type} />
                    <span>{s.label}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {openMenu === 'layout' && (
        <div
          ref={menuRef}
          className="sc-menu"
          style={{ top: menuPos.top, left: menuPos.left, width: 230 }}
          role="menu"
        >
          <div className="sc-menu-section">Seleziona layout grafico</div>
          <div className="sc-layout-grid">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                className={`sc-layout-opt ${layoutMode === opt.mode ? 'sc-layout-opt--active' : ''}`}
                onClick={() => {
                  setLayoutMode(opt.mode);
                  setOpenMenu(null);
                }}
              >
                <LayoutPreviewSvg mode={opt.mode} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="sc-quick-toast" role="status">
          {toastMsg}
        </div>
      )}
    </header>
  );
}
