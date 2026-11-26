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
} from '../../types';
import { useDrawings } from '../../store';
import { DrawingToolIcon } from './DrawingToolbar';
import '../../styles/drawingTools.css';

const STORAGE_KEY = 'tv_it_favorites_bar_pos_v1';

interface BarPosition {
  x: number;
  y: number;
}

function loadInitialPosition(): BarPosition {
  const defaultPos = (): BarPosition => {
    if (typeof window === 'undefined') return { x: 68, y: 140 };
    const isMobile = window.innerWidth <= 900;
    return {
      x: isMobile ? 10 : 68,
      y: Math.max(120, window.innerHeight - (isMobile ? 146 : 156)),
    };
  };

  if (typeof window === 'undefined') return defaultPos();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPos();
    const parsed = JSON.parse(raw) as Partial<BarPosition>;
    if (
      typeof parsed?.x === 'number' &&
      Number.isFinite(parsed.x) &&
      typeof parsed?.y === 'number' &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore storage failures
  }
  return defaultPos();
}

function clampPosition(pos: BarPosition, barW: number, barH: number): BarPosition {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(8, window.innerWidth - barW - 8);
  const maxY = Math.max(44, window.innerHeight - barH - 70);
  return {
    x: Math.max(8, Math.min(maxX, Math.round(pos.x))),
    y: Math.max(44, Math.min(maxY, Math.round(pos.y))),
  };
}

export function FloatingFavoritesBar() {
  const {
    favoriteTools,
    showFavoritesBar,
    activeTool,
    setActiveTool,
  } = useDrawings();

  const barRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<BarPosition>(loadInitialPosition);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const canonicalActive = useMemo(
    () => normalizeDrawingTool(activeTool),
    [activeTool],
  );

  const visibleTools = useMemo(() => {
    const out: CanonicalDrawingToolType[] = [];
    for (const tool of favoriteTools) {
      const norm = normalizeDrawingTool(tool);
      if (norm in DRAWING_TOOL_REGISTRY && !out.includes(norm)) {
        out.push(norm);
      }
    }
    return out;
  }, [favoriteTools]);

  const isVisible = showFavoritesBar && visibleTools.length > 0;

  const clampAndCommit = useCallback((nextPos: BarPosition, persist = false) => {
    const rect = barRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 280;
    const h = rect?.height ?? 38;
    const clamped = clampPosition(nextPos, w, h);
    setPosition(clamped);
    if (persist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!isVisible) return;
    const syncClamp = () => {
      setPosition((prev) => {
        const rect = barRef.current?.getBoundingClientRect();
        return clampPosition(prev, rect?.width ?? 280, rect?.height ?? 38);
      });
    };
    syncClamp();
    window.addEventListener('resize', syncClamp);
    return () => window.removeEventListener('resize', syncClamp);
  }, [isVisible, visibleTools.length]);

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

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      clampAndCommit({
        x: e.clientX - drag.offsetX,
        y: e.clientY - drag.offsetY,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      clampAndCommit(
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
  }, [clampAndCommit]);

  if (!isVisible) return null;

  return (
    <div
      ref={barRef}
      className="sc-fav-bar"
      role="toolbar"
      aria-label="Barra strumenti di disegno preferiti"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="sc-drag-grip"
        title="Trascina barra preferiti"
        aria-label="Trascina barra preferiti"
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

      <div className="sc-fav-sep" />

      {visibleTools.map((toolId) => {
        const meta = DRAWING_TOOL_REGISTRY[toolId];
        const active = canonicalActive === toolId;
        const title = meta.shortcut ? `${meta.labelIt} (${meta.shortcut})` : meta.labelIt;
        return (
          <button
            key={toolId}
            type="button"
            className={`sc-fav-btn ${active ? 'sc-fav-btn--active' : ''}`}
            title={title}
            aria-label={meta.labelIt}
            aria-pressed={active}
            onClick={() => setActiveTool(toolId)}
          >
            <DrawingToolIcon tool={toolId} size={17} />
          </button>
        );
      })}
    </div>
  );
}

export default FloatingFavoritesBar;
