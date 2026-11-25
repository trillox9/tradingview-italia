import type { ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Columns2,
  Crosshair,
  Eye,
  EyeOff,
  GitCommitHorizontal,
  ListOrdered,
  Lock,
  Magnet,
  Minus,
  Paintbrush,
  Pin,
  Ruler,
  SeparatorVertical,
  Square,
  Trash2,
  TrendingUp,
  Type,
  Unlock,
} from 'lucide-react';
import type { DrawingToolType } from '../../types';
import { useDrawings, type MagnetMode } from '../../store';

interface ToolItem {
  tool: DrawingToolType;
  label: string;
  shortcut?: string;
  icon: ReactNode;
}

const DRAWING_TOOLS_GROUP_1: ToolItem[] = [
  { tool: 'crosshair', label: 'Mirino', shortcut: 'Esc', icon: <Crosshair size={18} /> },
  { tool: 'trendline', label: 'Linea di tendenza', shortcut: 'Alt+T', icon: <TrendingUp size={18} /> },
  { tool: 'ray', label: 'Semiretta', icon: <ArrowUpRight size={18} /> },
  { tool: 'horizontalLine', label: 'Linea orizzontale', shortcut: 'Alt+H', icon: <Minus size={18} /> },
  { tool: 'verticalLine', label: 'Linea verticale', shortcut: 'Alt+V', icon: <SeparatorVertical size={18} /> },
  { tool: 'parallelChannel', label: 'Canale parallelo', icon: <Columns2 size={18} /> },
  { tool: 'fibRetracement', label: 'Ritracciamento di Fibonacci', shortcut: 'Alt+F', icon: <ListOrdered size={18} /> },
];

const DRAWING_TOOLS_GROUP_2: ToolItem[] = [
  { tool: 'rectangle', label: 'Rettangolo', icon: <Square size={17} /> },
  { tool: 'brush', label: 'Pennello', icon: <Paintbrush size={17} /> },
  { tool: 'text', label: 'Testo / Annotazione', icon: <Type size={17} /> },
  { tool: 'measure', label: 'Misura (Righello)', shortcut: 'Shift+Click', icon: <Ruler size={17} /> },
  { tool: 'longPosition', label: 'Posizione Long', icon: <GitCommitHorizontal size={18} style={{ color: '#089981' }} /> },
  { tool: 'shortPosition', label: 'Posizione Short', icon: <ArrowDownRight size={18} style={{ color: '#f23645' }} /> },
];

const MAGNET_CYCLE: MagnetMode[] = ['off', 'weak', 'strong'];
const MAGNET_LABELS: Record<MagnetMode, string> = {
  off: 'Calamita: Disattivata (clicca per Debole)',
  weak: 'Calamita: Debole OHLC (clicca per Forte)',
  strong: 'Calamita: Forte OHLC (clicca per disattivare)',
};

export function DrawingToolbar() {
  const {
    drawings,
    activeTool,
    setActiveTool,
    magnetMode,
    setMagnetMode,
    stayInDrawingMode,
    setStayInDrawingMode,
    lockDrawings,
    setLockDrawings,
    hideDrawings,
    setHideDrawings,
    clearDrawings,
  } = useDrawings();

  const cycleMagnet = () => {
    const idx = MAGNET_CYCLE.indexOf(magnetMode);
    setMagnetMode(MAGNET_CYCLE[(idx + 1) % MAGNET_CYCLE.length]);
  };

  const handleClearAll = () => {
    if (drawings.length === 0) return;
    clearDrawings();
  };

  return (
    <aside
      className="sc-left-bar"
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Strumenti di disegno"
    >
      {DRAWING_TOOLS_GROUP_1.map((item) => {
        const active = activeTool === item.tool;
        const title = item.shortcut ? `${item.label} (${item.shortcut})` : item.label;
        return (
          <button
            key={item.tool}
            type="button"
            className={`sc-draw-btn ${active ? 'sc-draw-btn--active' : ''}`}
            title={title}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => setActiveTool(item.tool)}
          >
            {item.icon}
          </button>
        );
      })}

      <div className="sc-draw-sep" />

      {DRAWING_TOOLS_GROUP_2.map((item) => {
        const active = activeTool === item.tool;
        const title = item.shortcut ? `${item.label} (${item.shortcut})` : item.label;
        return (
          <button
            key={item.tool}
            type="button"
            className={`sc-draw-btn ${active ? 'sc-draw-btn--active' : ''}`}
            title={title}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => setActiveTool(item.tool)}
          >
            {item.icon}
          </button>
        );
      })}

      <div className="sc-draw-sep" />

      {/* Magnet Mode (Off -> Weak -> Strong) */}
      <button
        type="button"
        className={`sc-draw-btn ${magnetMode !== 'off' ? 'sc-draw-btn--active' : ''}`}
        title={MAGNET_LABELS[magnetMode]}
        aria-label={MAGNET_LABELS[magnetMode]}
        aria-pressed={magnetMode !== 'off'}
        onClick={cycleMagnet}
      >
        <Magnet size={17} />
        {magnetMode !== 'off' && (
          <span className="sc-magnet-badge">
            {magnetMode === 'weak' ? 'D' : 'F'}
          </span>
        )}
      </button>

      {/* Stay in Drawing Mode */}
      <button
        type="button"
        className={`sc-draw-btn ${stayInDrawingMode ? 'sc-draw-btn--active' : ''}`}
        title="Rimani in modalità disegno"
        aria-label="Rimani in modalità disegno"
        aria-pressed={stayInDrawingMode}
        onClick={() => setStayInDrawingMode(!stayInDrawingMode)}
      >
        <Pin size={16} />
      </button>

      {/* Lock all drawings */}
      <button
        type="button"
        className={`sc-draw-btn ${lockDrawings ? 'sc-draw-btn--active' : ''}`}
        title={lockDrawings ? 'Sblocca tutti i disegni' : 'Blocca tutti i disegni'}
        aria-label="Blocca tutti i disegni"
        aria-pressed={lockDrawings}
        onClick={() => setLockDrawings(!lockDrawings)}
      >
        {lockDrawings ? <Lock size={16} /> : <Unlock size={16} />}
      </button>

      {/* Hide all drawings */}
      <button
        type="button"
        className={`sc-draw-btn ${hideDrawings ? 'sc-draw-btn--active' : ''}`}
        title={hideDrawings ? 'Mostra tutti i disegni' : 'Nascondi tutti i disegni'}
        aria-label="Nascondi disegni"
        aria-pressed={hideDrawings}
        onClick={() => setHideDrawings(!hideDrawings)}
      >
        {hideDrawings ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {/* Delete all drawings */}
      <button
        type="button"
        className="sc-draw-btn sc-draw-btn--danger"
        title={
          drawings.length > 0
            ? `Elimina tutti i disegni (${drawings.length})`
            : 'Nessun disegno da eliminare'
        }
        aria-label="Elimina disegni"
        disabled={drawings.length === 0}
        onClick={handleClearAll}
      >
        <Trash2 size={16} />
      </button>
    </aside>
  );
}
