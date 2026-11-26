import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DRAWING_TOOL_REGISTRY,
  normalizeDrawingTool,
  type CanonicalDrawingToolType,
  type DrawingToolType,
  type LineStyle,
} from '../../types';
import { useActivePane, useDrawings } from '../../store';
import '../../styles/drawingTools.css';

const TOOLBAR_POS_KEY = 'tv_it_drawing_toolbar_pos_v1';

export const TV_DRAWING_COLORS: readonly string[] = [
  '#2962FF',
  '#089981',
  '#F23645',
  '#FF9800',
  '#FACC15',
  '#AB47BC',
  '#7E57C2',
  '#00BCD4',
  '#4CAF50',
  '#E91E63',
  '#FFFFFF',
  '#D1D4DC',
  '#787B86',
  '#363A45',
  '#131722',
  '#000000',
];

const LINE_WIDTHS = [1, 2, 3, 4] as const;

const LINE_STYLES: ReadonlyArray<{ value: LineStyle; label: string }> = [
  { value: 'solid', label: 'Continua' },
  { value: 'dashed', label: 'Tratteggiata' },
  { value: 'dotted', label: 'Punteggiata' },
];

type PopoverKey = 'stroke' | 'fill' | 'width' | 'style' | 'order';

const FILLABLE_TOOLS = new Set<CanonicalDrawingToolType>([
  'channel',
  'flat_channel',
  'disjoint_channel',
  'regression_trend',
  'fib_retracement',
  'fib_extension',
  'fib_channel',
  'fib_speed_fan',
  'gann_box',
  'xabcd_pattern',
  'cypher_pattern',
  'head_shoulders',
  'bars_pattern',
  'long_position',
  'short_position',
  'forecast',
  'price_range',
  'date_range',
  'date_price_range',
  'volume_profile_fixed',
  'rectangle',
  'rotated_rectangle',
  'circle',
  'ellipse',
  'triangle',
  'arc',
  'note',
  'price_note',
  'callout',
  'price_label',
  'flag_mark',
  'arrow_up',
  'arrow_down',
]);

export function supportsFillTool(tool: DrawingToolType): boolean {
  return FILLABLE_TOOLS.has(normalizeDrawingTool(tool));
}

export function parseColorToHexAndAlpha(
  color?: string,
  fallbackHex = '#2962FF',
  fallbackAlpha = 0.18,
): { hex: string; alpha: number } {
  if (!color) return { hex: fallbackHex, alpha: fallbackAlpha };
  const trimmed = color.trim();

  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return { hex: `#${r}${r}${g}${g}${b}${b}`.toUpperCase(), alpha: fallbackAlpha };
    }
    if (trimmed.length >= 7) {
      let alpha = fallbackAlpha;
      if (trimmed.length === 9) {
        const parsedA = parseInt(trimmed.slice(7, 9), 16);
        if (Number.isFinite(parsedA)) alpha = Math.round((parsedA / 255) * 100) / 100;
      }
      return { hex: trimmed.slice(0, 7).toUpperCase(), alpha };
    }
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, Number(rgbaMatch[1]))).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, Number(rgbaMatch[2]))).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, Number(rgbaMatch[3]))).toString(16).padStart(2, '0');
    const a =
      rgbaMatch[4] !== undefined
        ? Math.max(0, Math.min(1, Number(rgbaMatch[4])))
        : 1;
    return { hex: `#${r}${g}${b}`.toUpperCase(), alpha: a };
  }

  return { hex: fallbackHex, alpha: fallbackAlpha };
}

export function toRgbaString(hex: string, alpha: number): string {
  const parsed = parseColorToHexAndAlpha(hex, '#2962FF', alpha);
  const clean = parsed.hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 41;
  const g = parseInt(clean.slice(2, 4), 16) || 98;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  const clampedAlpha = Math.max(0, Math.min(1, Math.round(alpha * 100) / 100));
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

interface ToolbarPos {
  x: number;
  y: number;
}

function getInitialPos(): ToolbarPos {
  if (typeof window === 'undefined') return { x: 260, y: 94 };
  try {
    const raw = window.localStorage.getItem(TOOLBAR_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ToolbarPos>;
      if (
        typeof parsed?.x === 'number' &&
        Number.isFinite(parsed.x) &&
        typeof parsed?.y === 'number' &&
        Number.isFinite(parsed.y)
      ) {
        return { x: parsed.x, y: parsed.y };
      }
    }
  } catch {
    // ignore storage errors
  }
  const isNarrow = window.innerWidth <= 640;
  const isMobile = window.innerWidth <= 900;
  return {
    x: isMobile ? 8 : Math.max(68, Math.round(window.innerWidth * 0.5 - 190)),
    y: isNarrow ? 116 : 94,
  };
}

function clampToolbarPos(pos: ToolbarPos, w: number, h: number): ToolbarPos {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(44, window.innerHeight - h - 70);
  return {
    x: Math.max(8, Math.min(maxX, Math.round(pos.x))),
    y: Math.max(44, Math.min(maxY, Math.round(pos.y))),
  };
}

function LinePreview({
  width,
  style,
}: {
  width: number;
  style: LineStyle;
}) {
  const dash =
    style === 'dashed' ? '5 3' : style === 'dotted' ? '2 2.5' : undefined;
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
      <line
        x1="1"
        y1="6"
        x2="25"
        y2="6"
        stroke="currentColor"
        strokeWidth={Math.max(1, Math.min(4, width))}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FloatingDrawingToolbar() {
  const { activeSymbol } = useActivePane();
  const {
    drawings,
    selectedDrawingId,
    updateDrawing,
    deleteDrawing,
    cloneDrawing,
    bringToFront,
    sendToBack,
    openDrawingSettings,
  } = useDrawings();

  const drawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) ?? null,
    [drawings, selectedDrawingId],
  );

  const barRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const anchorBtnRef = useRef<HTMLElement | null>(null);

  const [pos, setPos] = useState<ToolbarPos>(getInitialPos);
  const [openPopover, setOpenPopover] = useState<PopoverKey | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({
    top: 90,
    left: 260,
  });

  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const clampAndSetPos = useCallback((next: ToolbarPos, persist = false) => {
    const rect = barRef.current?.getBoundingClientRect();
    const clamped = clampToolbarPos(next, rect?.width ?? 360, rect?.height ?? 38);
    setPos(clamped);
    if (persist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(TOOLBAR_POS_KEY, JSON.stringify(clamped));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!drawing) {
      setOpenPopover(null);
      return;
    }
    const sync = () => {
      const rect = barRef.current?.getBoundingClientRect();
      setPos((prev) => clampToolbarPos(prev, rect?.width ?? 360, rect?.height ?? 38));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [drawing, drawing?.type]);

  const positionPopover = useCallback((anchor: HTMLElement | null) => {
    if (!anchor || typeof window === 'undefined') return;
    anchorBtnRef.current = anchor;
    const rect = anchor.getBoundingClientRect();
    setPopoverCoords({
      top: Math.min(window.innerHeight - 160, rect.bottom + 6),
      left: Math.max(8, Math.min(window.innerWidth - 210, rect.left)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!openPopover || !popoverRef.current || !anchorBtnRef.current) return;
    const clampPop = () => {
      if (!popoverRef.current || !anchorBtnRef.current) return;
      const anchor = anchorBtnRef.current.getBoundingClientRect();
      const pop = popoverRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = anchor.left;
      if (left + pop.width > vw - 8) {
        left = vw - pop.width - 8;
      }
      left = Math.max(8, left);

      let top = anchor.bottom + 6;
      if (top + pop.height > vh - 8) {
        top = anchor.top - pop.height - 6;
      }
      top = Math.max(44, top);

      setPopoverCoords({ top, left });
    };
    clampPop();
    window.addEventListener('resize', clampPop);
    return () => window.removeEventListener('resize', clampPop);
  }, [openPopover]);

  useEffect(() => {
    if (!openPopover) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target) || barRef.current?.contains(target)) {
        return;
      }
      setOpenPopover(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openPopover]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setOpenPopover(null);
      clampAndSetPos({
        x: e.clientX - drag.offsetX,
        y: e.clientY - drag.offsetY,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      clampAndSetPos(
        {
          x: e.clientX - drag.offsetX,
          y: e.clientY - drag.offsetY,
        },
        true,
      );
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clampAndSetPos]);

  if (!drawing) return null;

  const canonicalType = normalizeDrawingTool(drawing.type);
  const toolMeta = DRAWING_TOOL_REGISTRY[canonicalType];
  const hasFill = supportsFillTool(drawing.type);

  const strokeParsed = parseColorToHexAndAlpha(drawing.style.color, '#2962FF', 1);
  const fillParsed = parseColorToHexAndAlpha(
    drawing.style.fillColor,
    strokeParsed.hex,
    drawing.style.fillOpacity ?? 0.18,
  );
  const effectiveFillAlpha =
    drawing.style.fillOpacity !== undefined
      ? drawing.style.fillOpacity
      : fillParsed.alpha;

  const togglePop = (key: PopoverKey, el: HTMLElement) => {
    if (openPopover === key) {
      setOpenPopover(null);
      return;
    }
    positionPopover(el);
    setOpenPopover(key);
  };

  const applyStylePatch = (patch: Partial<typeof drawing.style>) => {
    updateDrawing(activeSymbol.ticker, drawing.id, {
      style: { ...drawing.style, ...patch },
    });
  };

  const handleGripPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  return (
    <>
      <div
        ref={barRef}
        className="sc-float-draw-bar"
        role="toolbar"
        aria-label={`Barra strumenti ${toolMeta?.labelIt ?? 'disegno'}`}
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Drag grip */}
        <div
          className="sc-drag-grip"
          title={`Trascina barra (${toolMeta?.labelIt ?? drawing.type})`}
          aria-label="Trascina barra disegno"
          onPointerDown={handleGripPointerDown}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.2" />
            <circle cx="7" cy="3" r="1.2" />
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="7" cy="8" r="1.2" />
            <circle cx="3" cy="13" r="1.2" />
            <circle cx="7" cy="13" r="1.2" />
          </svg>
        </div>

        <div className="sc-fdt-sep" />

        {/* Stroke Color */}
        <button
          type="button"
          className={`sc-fdt-btn ${openPopover === 'stroke' ? 'sc-fdt-btn--active' : ''}`}
          title="Colore linea"
          aria-label="Colore linea"
          aria-expanded={openPopover === 'stroke'}
          onClick={(e) => togglePop('stroke', e.currentTarget)}
        >
          <span className="sc-fdt-color-pill">
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9.5 1.5l3 3-7 7H2.5v-3l7-7z" />
            </svg>
            <span
              className="sc-fdt-color-bar"
              style={{ backgroundColor: strokeParsed.hex }}
            />
          </span>
        </button>

        {/* Fill Color + Opacity */}
        {hasFill && (
          <button
            type="button"
            className={`sc-fdt-btn ${openPopover === 'fill' ? 'sc-fdt-btn--active' : ''}`}
            title="Colore riempimento e opacità"
            aria-label="Colore riempimento"
            aria-expanded={openPopover === 'fill'}
            onClick={(e) => togglePop('fill', e.currentTarget)}
          >
            <span
              className="sc-fdt-fill-box"
              style={{
                backgroundColor: toRgbaString(fillParsed.hex, effectiveFillAlpha),
              }}
            />
          </button>
        )}

        {/* Line Width */}
        <button
          type="button"
          className={`sc-fdt-btn ${openPopover === 'width' ? 'sc-fdt-btn--active' : ''}`}
          title="Spessore linea"
          aria-label="Spessore linea"
          aria-expanded={openPopover === 'width'}
          onClick={(e) => togglePop('width', e.currentTarget)}
        >
          <span>{Math.round(drawing.style.lineWidth || 1)}px</span>
        </button>

        {/* Line Style */}
        <button
          type="button"
          className={`sc-fdt-btn ${openPopover === 'style' ? 'sc-fdt-btn--active' : ''}`}
          title="Stile linea"
          aria-label="Stile linea"
          aria-expanded={openPopover === 'style'}
          onClick={(e) => togglePop('style', e.currentTarget)}
        >
          <LinePreview width={2} style={drawing.style.lineStyle} />
        </button>

        <div className="sc-fdt-sep" />

        {/* Impostazioni (gear) */}
        <button
          type="button"
          className="sc-fdt-btn"
          title="Impostazioni disegno"
          aria-label="Impostazioni"
          onClick={() => {
            setOpenPopover(null);
            openDrawingSettings(drawing.id);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="9" r="2.5" />
            <path d="M9 2.2v1.6M9 14.2v1.6M2.2 9h1.6M14.2 9h1.6M4.2 4.2l1.1 1.1M12.7 12.7l1.1 1.1M13.8 4.2l-1.1 1.1M5.3 12.7l-1.1 1.1" />
          </svg>
        </button>

        {/* Ordine visualizzazione */}
        <button
          type="button"
          className={`sc-fdt-btn ${openPopover === 'order' ? 'sc-fdt-btn--active' : ''}`}
          title="Ordine visualizzazione"
          aria-label="Ordine visualizzazione"
          aria-expanded={openPopover === 'order'}
          onClick={(e) => togglePop('order', e.currentTarget)}
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.2" />
            <path d="M7 13h7a1 1 0 0 0 1-1V7" />
          </svg>
        </button>

        {/* Clona */}
        <button
          type="button"
          className="sc-fdt-btn"
          title="Clona disegno"
          aria-label="Clona"
          onClick={() => {
            setOpenPopover(null);
            cloneDrawing(drawing.id, activeSymbol.ticker);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="6" width="9" height="9" rx="1.4" />
            <path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
          </svg>
        </button>

        {/* Blocca / Sblocca */}
        <button
          type="button"
          className={`sc-fdt-btn ${drawing.locked ? 'sc-fdt-btn--active' : ''}`}
          title={drawing.locked ? 'Sblocca' : 'Blocca'}
          aria-label={drawing.locked ? 'Sblocca disegno' : 'Blocca disegno'}
          aria-pressed={drawing.locked}
          onClick={() =>
            updateDrawing(activeSymbol.ticker, drawing.id, {
              locked: !drawing.locked,
            })
          }
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="8.2" width="10" height="7" rx="1.5" />
            {drawing.locked ? (
              <path d="M6.2 8.2V5.8a2.8 2.8 0 0 1 5.6 0v2.4" />
            ) : (
              <path d="M6.2 8.2V5.5a2.8 2.8 0 0 1 5.4-1" />
            )}
          </svg>
        </button>

        {/* Nascondi / Mostra */}
        <button
          type="button"
          className={`sc-fdt-btn ${!drawing.visible ? 'sc-fdt-btn--active' : ''}`}
          title={drawing.visible ? 'Nascondi' : 'Mostra'}
          aria-label={drawing.visible ? 'Nascondi disegno' : 'Mostra disegno'}
          aria-pressed={!drawing.visible}
          onClick={() =>
            updateDrawing(activeSymbol.ticker, drawing.id, {
              visible: !drawing.visible,
            })
          }
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 9s2.7-4.5 7-4.5S16 9 16 9s-2.7 4.5-7 4.5S2 9 2 9z" />
            <circle cx="9" cy="9" r="2" />
            {!drawing.visible && <line x1="3" y1="15" x2="15" y2="3" />}
          </svg>
        </button>

        {/* Elimina */}
        <button
          type="button"
          className="sc-fdt-btn sc-fdt-btn--danger"
          title="Elimina (Canc)"
          aria-label="Elimina disegno"
          onClick={() => {
            setOpenPopover(null);
            deleteDrawing(activeSymbol.ticker, drawing.id);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 5h11M6.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5" />
            <path d="M5 5l.8 9.5a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9L13 5" />
          </svg>
        </button>
      </div>

      {/* ======================== POPOVERS ======================== */}
      {openPopover && (
        <div
          ref={popoverRef}
          className="sc-fdt-popover"
          style={{ left: popoverCoords.left, top: popoverCoords.top }}
        >
          {openPopover === 'stroke' && (
            <div>
              <div className="sc-swatch-grid">
                {TV_DRAWING_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`sc-swatch-cell ${
                      strokeParsed.hex === col.toUpperCase()
                        ? 'sc-swatch-cell--active'
                        : ''
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                    aria-label={`Colore ${col}`}
                    onClick={() => {
                      applyStylePatch({ color: col });
                      setOpenPopover(null);
                    }}
                  />
                ))}
              </div>
              <label className="sc-fdt-custom-color">
                <span>Personalizzato</span>
                <input
                  type="color"
                  value={strokeParsed.hex}
                  onChange={(e) => applyStylePatch({ color: e.target.value })}
                />
              </label>
            </div>
          )}

          {openPopover === 'fill' && (
            <div>
              <div className="sc-swatch-grid">
                {TV_DRAWING_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`sc-swatch-cell ${
                      fillParsed.hex === col.toUpperCase()
                        ? 'sc-swatch-cell--active'
                        : ''
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                    aria-label={`Colore riempimento ${col}`}
                    onClick={() =>
                      applyStylePatch({
                        fillColor: toRgbaString(col, effectiveFillAlpha),
                        fillOpacity: effectiveFillAlpha,
                      })
                    }
                  />
                ))}
              </div>

              <label className="sc-fdt-custom-color">
                <span>Personalizzato</span>
                <input
                  type="color"
                  value={fillParsed.hex}
                  onChange={(e) =>
                    applyStylePatch({
                      fillColor: toRgbaString(e.target.value, effectiveFillAlpha),
                      fillOpacity: effectiveFillAlpha,
                    })
                  }
                />
              </label>

              <div className="sc-fdt-opacity-row">
                <div className="sc-fdt-opacity-head">
                  <span>Opacità</span>
                  <span>{Math.round(effectiveFillAlpha * 100)}%</span>
                </div>
                <input
                  type="range"
                  className="sc-fdt-range"
                  min={0}
                  max={100}
                  step={2}
                  value={Math.round(effectiveFillAlpha * 100)}
                  onChange={(e) => {
                    const nextAlpha = Number(e.target.value) / 100;
                    applyStylePatch({
                      fillOpacity: nextAlpha,
                      fillColor: toRgbaString(fillParsed.hex, nextAlpha),
                    });
                  }}
                />
              </div>
            </div>
          )}

          {openPopover === 'width' && (
            <div className="sc-fdt-dropdown-list">
              {LINE_WIDTHS.map((w) => {
                const active = Math.round(drawing.style.lineWidth || 1) === w;
                return (
                  <button
                    key={w}
                    type="button"
                    className={`sc-fdt-dropdown-item ${
                      active ? 'sc-fdt-dropdown-item--active' : ''
                    }`}
                    onClick={() => {
                      applyStylePatch({ lineWidth: w });
                      setOpenPopover(null);
                    }}
                  >
                    <LinePreview width={w} style={drawing.style.lineStyle} />
                    <span>{w}px</span>
                  </button>
                );
              })}
            </div>
          )}

          {openPopover === 'style' && (
            <div className="sc-fdt-dropdown-list">
              {LINE_STYLES.map((st) => {
                const active = drawing.style.lineStyle === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    className={`sc-fdt-dropdown-item ${
                      active ? 'sc-fdt-dropdown-item--active' : ''
                    }`}
                    onClick={() => {
                      applyStylePatch({ lineStyle: st.value });
                      setOpenPopover(null);
                    }}
                  >
                    <span>{st.label}</span>
                    <LinePreview width={2} style={st.value} />
                  </button>
                );
              })}
            </div>
          )}

          {openPopover === 'order' && (
            <div className="sc-fdt-dropdown-list">
              <button
                type="button"
                className="sc-fdt-dropdown-item"
                onClick={() => {
                  bringToFront(drawing.id, activeSymbol.ticker);
                  setOpenPopover(null);
                }}
              >
                <span>Porta avanti</span>
              </button>
              <button
                type="button"
                className="sc-fdt-dropdown-item"
                onClick={() => {
                  sendToBack(drawing.id, activeSymbol.ticker);
                  setOpenPopover(null);
                }}
              >
                <span>Porta indietro</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default FloatingDrawingToolbar;
