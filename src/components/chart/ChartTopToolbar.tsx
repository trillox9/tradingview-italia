import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronDown,
  Eye,
  Flame,
  Keyboard,
  Layers,
  LayoutGrid,
  List,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PenTool,
  Plus,
  Redo2,
  Rewind,
  Settings,
  SlidersHorizontal,
  Star,
  Sun,
  Undo2,
} from 'lucide-react';
import {
  CHART_TYPES_META,
  TIMEFRAMES,
  TIMEFRAME_LABELS_IT,
  normalizeChartType,
  type CanonicalChartType,
  type ChartType,
  type Timeframe,
} from '../../types';
import { SYMBOLS } from '../../data';
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

const CHART_STYLE_GROUPS: ReadonlyArray<'Prezzo' | 'Linea e Area' | 'Avanzati'> = [
  'Prezzo',
  'Linea e Area',
  'Avanzati',
];

const TIMEFRAME_GROUPS: Array<{ title: string; items: Timeframe[] }> = [
  { title: 'Minuti', items: ['1m', '5m', '15m'] },
  { title: 'Ore', items: ['1H', '4H'] },
  { title: 'Giorni e oltre', items: ['1D', '1W', '1M'] },
];

const LAYOUT_OPTIONS: Array<{
  mode: LayoutMode;
  label: string;
}> = [
  { mode: '1', label: '1 Grafico' },
  { mode: '2v', label: '2 Verticale' },
  { mode: '2h', label: '2 Orizzontale' },
  { mode: '4', label: '4 Griglia' },
];

function ChartStyleIcon({ type }: { type: ChartType }) {
  const canonical: CanonicalChartType = normalizeChartType(type);
  switch (canonical) {
    case 'bars':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 4v10M3 7h2M5 11h2M13 3v11M11 6h2M13 10h2" strokeLinecap="round" />
        </svg>
      );
    case 'hollow_candles':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M5.5 3v2.5M5.5 12.5V15M12.5 2v2M12.5 11v4" strokeLinecap="round" />
          <rect x="3.5" y="5.5" width="4" height="7" rx="0.6" />
          <rect x="10.5" y="4" width="4" height="7" rx="0.6" />
        </svg>
      );
    case 'volume_candles':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <path d="M5 2.5v10M12.5 3v9.5" strokeLinecap="round" />
          <rect x="2.5" y="5" width="5" height="5" fill="currentColor" rx="0.5" />
          <rect x="10.75" y="5.5" width="3.5" height="4.5" rx="0.5" />
          <path d="M2.5 15.5h5M10.75 15.5h3.5" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'line':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 12.5L6.5 8.5L10 10.5L15.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'line_markers':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M2.5 12.5L6.5 8.5L10.5 10.5L15 4.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="2.5" cy="12.5" r="1.4" fill="currentColor" />
          <circle cx="6.5" cy="8.5" r="1.4" fill="currentColor" />
          <circle cx="10.5" cy="10.5" r="1.4" fill="currentColor" />
          <circle cx="15" cy="4.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'step_line':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M2 13h4V8.5h4.5V11H13V5h3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'area':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M2.5 14.5V11L6.5 7.5L10.5 9.5L15.5 4.5V14.5H2.5Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M2.5 11L6.5 7.5L10.5 9.5L15.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hlc_area':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M2.5 10L6.5 6L11 7.5L15.5 3.5V9.5L11 12.5L6.5 11.5L2.5 14.5Z" fill="currentColor" fillOpacity="0.22" />
          <path d="M2.5 12L6.5 8.5L11 10L15.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'baseline':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M2 9.5h14" stroke="currentColor" strokeOpacity="0.45" strokeDasharray="2 2" />
          <path d="M2.5 12.5L6 6.5L10.5 11.5L15.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'columns':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <rect x="2.5" y="10" width="2.5" height="5" rx="0.5" />
          <rect x="6.5" y="7" width="2.5" height="8" rx="0.5" />
          <rect x="10.5" y="9" width="2.5" height="6" rx="0.5" />
          <rect x="14.5" y="4.5" width="2" height="10.5" rx="0.5" />
        </svg>
      );
    case 'high_low':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3.5" y="5" width="3" height="8" rx="0.6" />
          <rect x="8.5" y="3.5" width="3" height="7.5" rx="0.6" />
          <rect x="13.5" y="6" width="2.5" height="8" rx="0.6" />
        </svg>
      );
    case 'heikin_ashi':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M5 14V4M13 13V3" strokeLinecap="round" />
          <rect x="3.5" y="7" width="3" height="5" fill="currentColor" rx="0.5" />
          <rect x="11.5" y="5" width="3" height="5.5" fill="currentColor" rx="0.5" />
        </svg>
      );
    case 'candles':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M5.5 3v12M12.5 2.5v12.5" strokeLinecap="round" />
          <rect x="3.75" y="5.5" width="3.5" height="6.5" fill="currentColor" rx="0.6" />
          <rect x="10.75" y="4.5" width="3.5" height="5.5" fill="currentColor" rx="0.6" />
        </svg>
      );
  }
}

function FxIndicatorIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3.5 14.5L5.2 5.2C5.4 4.1 6.1 3.5 7.2 3.5h1.1M3.2 8.5h4.2" strokeLinecap="round" />
      <path d="M10.2 8.2l4.3 5.3M14.5 8.2l-4.3 5.3" strokeLinecap="round" />
    </svg>
  );
}

function LayoutPreviewSvg({ mode }: { mode: LayoutMode }) {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
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
    rightPanel,
    toggleRightPanel,
    bottomPanel,
    toggleBottomPanel,
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

  const {
    canUndo,
    canRedo,
    undo,
    redo,
    showFavoritesBar,
    toggleFavoritesBar,
  } = useDrawings();

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 42,
    left: 6,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const toggleMenuAt = (menu: Exclude<OpenMenu, null>, el: HTMLElement) => {
    if (openMenu === menu) {
      setOpenMenu(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const maxLeft = Math.max(6, window.innerWidth - 246);
    setMenuPos({
      top: Math.round(rect.bottom + 4),
      left: Math.max(6, Math.min(Math.round(rect.left), maxLeft)),
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

  const canonicalChartType = normalizeChartType(activePane.chartType);
  const currentStyleLabel =
    CHART_TYPES_META.find((s) => s.id === canonicalChartType)?.labelIt ?? 'Candele';
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
          className={`sc-tb-btn sc-tb-btn--icon sc-desktop-only ${activePane.compareSymbols.length > 0 ? 'sc-tb-btn--active' : ''}`}
          title="Confronta simboli"
          aria-label="Confronta simboli"
          onClick={() => openModal('compare')}
        >
          <Plus size={17} />
        </button>

        <div className="sc-tb-divider sc-desktop-only" />

        {/* Timeframe Quick Buttons (desktop > 900px) + Compact Dropdown Trigger (<= 900px) */}
        <div className="sc-tf-group" role="group" aria-label="Intervalli temporali">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              className={`sc-tb-btn sc-tf-btn sc-tf-inline ${activePane.timeframe === tf ? 'sc-tb-btn--active' : ''}`}
              title={TIMEFRAME_LABELS_IT[tf]}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
          <button
            type="button"
            className={`sc-tb-btn sc-tf-compact ${openMenu === 'timeframe' ? 'sc-tb-btn--active' : ''}`}
            title={`Intervallo: ${TIMEFRAME_LABELS_IT[activePane.timeframe]}`}
            aria-label="Seleziona intervallo temporale"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'timeframe'}
            onClick={(e) => toggleMenuAt('timeframe', e.currentTarget)}
          >
            <span className="sc-tf-compact-val">{activePane.timeframe}</span>
            <ChevronDown size={13} />
          </button>
        </div>

        <div className="sc-tb-divider sc-tablet-up" />

        {/* Chart Style Selector (13 authentic styles) */}
        <button
          type="button"
          className={`sc-tb-btn sc-tablet-up ${openMenu === 'style' ? 'sc-tb-btn--active' : ''}`}
          title={`Stile grafico: ${currentStyleLabel}`}
          aria-label={`Stile grafico ${currentStyleLabel}`}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'style'}
          onClick={(e) => toggleMenuAt('style', e.currentTarget)}
        >
          <ChartStyleIcon type={canonicalChartType} />
          <ChevronDown size={13} />
        </button>

        <div className="sc-tb-divider sc-tablet-up" />

        {/* Indicators Button (fx + active count) */}
        <button
          type="button"
          className="sc-tb-btn sc-ind-trigger"
          title="Indicatori, metriche e strategie (/)"
          aria-label="Indicatori, metriche e strategie"
          onClick={() => openModal('indicators')}
        >
          <FxIndicatorIcon />
          <span className="sc-tablet-up-label">Indicatori</span>
          {visibleIndicatorCount > 0 && (
            <span className="sc-badge-count">{visibleIndicatorCount}</span>
          )}
        </button>

        <div className="sc-tb-divider sc-desktop-only" />

        {/* Alert */}
        <button
          type="button"
          className="sc-tb-btn sc-tablet-up"
          title="Crea avviso (Alt+A)"
          aria-label="Crea avviso"
          onClick={() => openModal('alert')}
        >
          <Bell size={15} />
          <span className="sc-desktop-label">Avviso</span>
        </button>

        {/* Bar Replay */}
        <button
          type="button"
          className={`sc-tb-btn sc-desktop-only ${replay.active ? 'sc-tb-btn--active' : ''}`}
          title="Bar Replay — simula candela per candela"
          aria-label="Bar replay"
          aria-pressed={replay.active}
          onClick={handleReplayToggle}
        >
          <Rewind size={15} />
          <span>Replay</span>
        </button>

        <div className="sc-tb-divider sc-desktop-only" />

        {/* Undo / Redo Drawings */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon sc-desktop-only"
          title="Annulla disegno (Ctrl+Z)"
          aria-label="Annulla"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon sc-desktop-only"
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
        {/* Mobile/Tablet Drawing Bar Quick Toggle */}
        <button
          type="button"
          data-drawing-toggle="true"
          className={`sc-tb-btn sc-tb-btn--icon sc-mobile-only ${showDrawingBar ? 'sc-tb-btn--active' : ''}`}
          title={showDrawingBar ? 'Nascondi strumenti di disegno' : 'Mostra strumenti di disegno'}
          aria-label="Strumenti di disegno"
          aria-pressed={showDrawingBar}
          onClick={onToggleDrawingBar}
        >
          <PenTool size={15} />
        </button>

        {/* Multi-chart Layout Picker */}
        <button
          type="button"
          className={`sc-tb-btn sc-tb-btn--icon sc-desktop-only ${openMenu === 'layout' || layoutMode !== '1' ? 'sc-tb-btn--active' : ''}`}
          title="Impostazione layout multi-grafico"
          aria-label="Impostazione layout"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'layout'}
          onClick={(e) => toggleMenuAt('layout', e.currentTarget)}
        >
          <LayoutGrid size={16} />
        </button>

        <div className="sc-tb-divider sc-desktop-only" />

        {/* Chart Settings */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon sc-tablet-up"
          title="Impostazioni grafico"
          aria-label="Impostazioni"
          onClick={() => openModal('settings')}
        >
          <Settings size={16} />
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon sc-desktop-only"
          title={isFullscreen ? 'Esci da schermo intero (Shift+F)' : 'Modalità schermo intero (Shift+F)'}
          aria-label="Modalità schermo intero"
          aria-pressed={isFullscreen}
          onClick={handleFullscreen}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Camera Snapshot */}
        <button
          type="button"
          className="sc-tb-btn sc-tb-btn--icon sc-desktop-only"
          title="Fai uno screenshot"
          aria-label="Fai uno screenshot"
          onClick={() => openModal('snapshot')}
        >
          <Camera size={16} />
        </button>

        <div className="sc-tb-divider sc-tablet-up" />

        {/* Watchlist (Lista titoli) Toggle — replaces right rail across all viewports */}
        <button
          type="button"
          className={`sc-tb-btn sc-tb-btn--icon ${rightPanel === 'watchlist' ? 'sc-tb-btn--active' : ''}`}
          title={rightPanel === 'watchlist' ? 'Chiudi Lista titoli' : 'Apri Lista titoli'}
          aria-label="Lista titoli"
          aria-pressed={rightPanel === 'watchlist'}
          onClick={() => toggleRightPanel('watchlist')}
        >
          <List size={16} />
        </button>

        {/* Object Tree (Albero degli oggetti) Toggle */}
        <button
          type="button"
          className={`sc-tb-btn sc-tb-btn--icon sc-tablet-up ${rightPanel === 'objectTree' ? 'sc-tb-btn--active' : ''}`}
          title={rightPanel === 'objectTree' ? 'Chiudi Albero degli oggetti' : 'Apri Albero degli oggetti'}
          aria-label="Albero degli oggetti"
          aria-pressed={rightPanel === 'objectTree'}
          onClick={() => toggleRightPanel('objectTree')}
        >
          <Layers size={15} />
        </button>

        {/* Trade Pill (opens/toggles Paper Trading Drawer) */}
        <button
          type="button"
          className={`sc-trade-pill ${bottomPanel === 'trading' ? 'sc-tb-btn--active' : ''}`}
          title="Pannello di trading / Paper Trading"
          aria-pressed={bottomPanel === 'trading'}
          onClick={() => toggleBottomPanel('trading')}
        >
          Trade
        </button>
      </div>

      {/* ======================== PORTAL-LIKE FIXED MENUS ======================== */}
      {openMenu === 'main' && (
        <div
          ref={menuRef}
          className="sc-menu"
          style={{ top: menuPos.top, left: 6, width: 256 }}
          role="menu"
        >
          <div className="sc-menu-header">
            <svg width="24" height="16" viewBox="0 0 36 22" fill="currentColor" aria-hidden="true">
              <path d="M14.5 19H8.8V8.2H3V3h11.5v16zM21.5 19h-5.8L23 3h5.8L21.5 19zM30.5 8.6a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z" />
            </svg>
            <span>TradingView Supercharts</span>
          </div>

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              openModal('settings');
            }}
          >
            <span className="sc-menu-item-left">
              <Settings size={15} />
              Impostazioni grafico...
            </span>
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
              <PenTool size={15} />
              Pannello disegni
            </span>
            <span className={`sc-switch ${showDrawingBar ? 'sc-switch--on' : ''}`} />
          </button>

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => toggleFavoritesBar()}
          >
            <span className="sc-menu-item-left">
              <Star size={15} />
              Barra strumenti preferiti (★)
            </span>
            <span className={`sc-switch ${showFavoritesBar ? 'sc-switch--on' : ''}`} />
          </button>

          <div className="sc-menu-sep" />

          <button
            type="button"
            className={`sc-menu-item ${rightPanel === 'watchlist' ? 'sc-menu-item--active' : ''}`}
            onClick={() => {
              toggleRightPanel('watchlist');
              setOpenMenu(null);
            }}
          >
            <span className="sc-menu-item-left">
              <List size={15} />
              Lista titoli
            </span>
          </button>

          <button
            type="button"
            className={`sc-menu-item ${rightPanel === 'objectTree' ? 'sc-menu-item--active' : ''}`}
            onClick={() => {
              toggleRightPanel('objectTree');
              setOpenMenu(null);
            }}
          >
            <span className="sc-menu-item-left">
              <Layers size={15} />
              Albero degli oggetti
            </span>
          </button>

          <button
            type="button"
            className={`sc-menu-item ${rightPanel === 'data' ? 'sc-menu-item--active' : ''}`}
            onClick={() => {
              toggleRightPanel('data');
              setOpenMenu(null);
            }}
          >
            <span className="sc-menu-item-left">
              <Eye size={15} />
              Finestra dati
            </span>
            <span className="sc-menu-kbd">Alt + D</span>
          </button>

          <div className="sc-menu-sep" />

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('screener');
            }}
          >
            <span className="sc-menu-item-left">
              <SlidersHorizontal size={15} />
              Screener ({SYMBOLS.length} strumenti)
            </span>
          </button>

          <button
            type="button"
            className="sc-menu-item"
            onClick={() => {
              setOpenMenu(null);
              navigate('heatmap');
            }}
          >
            <span className="sc-menu-item-left">
              <Flame size={15} />
              Mappa di calore
            </span>
          </button>

          <div className="sc-menu-sep" />

          {/* Mobile/tablet quick actions hidden from top bar at <= 900px */}
          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            title="Annulla disegno (Ctrl+Z)"
            aria-label="Annulla disegno"
            disabled={!canUndo}
            style={!canUndo ? { opacity: 0.42, cursor: 'not-allowed' } : undefined}
            onClick={() => {
              undo();
              setOpenMenu(null);
            }}
          >
            <span className="sc-menu-item-left"><Undo2 size={15} /> Annulla disegno</span>
            <span className="sc-menu-kbd">Ctrl + Z</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            title="Ripeti disegno (Ctrl+Y)"
            aria-label="Ripeti disegno"
            disabled={!canRedo}
            style={!canRedo ? { opacity: 0.42, cursor: 'not-allowed' } : undefined}
            onClick={() => {
              redo();
              setOpenMenu(null);
            }}
          >
            <span className="sc-menu-item-left"><Redo2 size={15} /> Ripeti disegno</span>
            <span className="sc-menu-kbd">Ctrl + Y</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            onClick={() => {
              setMenuPos((prev) => ({ top: prev.top, left: 6 }));
              setOpenMenu('style');
            }}
          >
            <span className="sc-menu-item-left">
              <ChartStyleIcon type={canonicalChartType} />
              Stile grafico
            </span>
            <span className="sc-menu-kbd">{currentStyleLabel}</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            onClick={() => {
              setOpenMenu(null);
              openModal('compare');
            }}
          >
            <span className="sc-menu-item-left"><Plus size={15} /> Confronta simboli</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            onClick={() => {
              setOpenMenu(null);
              openModal('alert');
            }}
          >
            <span className="sc-menu-item-left"><Bell size={15} /> Crea avviso</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            onClick={() => {
              setOpenMenu(null);
              handleReplayToggle();
            }}
          >
            <span className="sc-menu-item-left"><Rewind size={15} /> {replay.active ? 'Esci da Bar Replay' : 'Bar Replay'}</span>
          </button>

          <button
            type="button"
            className="sc-menu-item sc-mobile-menu-only"
            onClick={() => {
              setOpenMenu(null);
              openModal('snapshot');
            }}
          >
            <span className="sc-menu-item-left"><Camera size={15} /> Istantanea grafico</span>
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
              Scorciatoie da tastiera (?)
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
          style={{ top: menuPos.top, left: menuPos.left, width: 236 }}
          role="menu"
        >
          {CHART_STYLE_GROUPS.map((grp, idx) => (
            <div key={grp}>
              {idx > 0 && <div className="sc-menu-sep" />}
              <div className="sc-menu-section">{grp}</div>
              {CHART_TYPES_META.filter((s) => s.group === grp).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sc-menu-item ${canonicalChartType === s.id ? 'sc-menu-item--active' : ''}`}
                  onClick={() => {
                    setChartType(s.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="sc-menu-item-left">
                    <ChartStyleIcon type={s.id} />
                    <span>{s.labelIt}</span>
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
    </header>
  );
}
