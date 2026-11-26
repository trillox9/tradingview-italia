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
import { useDrawings, useTradingView } from '../../store';
import { DrawingToolIcon } from './DrawingToolbar';
import '../../styles/drawingTools.css';

const STORAGE_KEY = 'tv_it_favorites_bar_pos_v1';

export interface FloatingBarPosition {
  x: number;
  y: number;
}

function loadInitialPosition(): FloatingBarPosition {
  const defaultPos = (): FloatingBarPosition => {
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
    const parsed = JSON.parse(raw) as Partial<FloatingBarPosition>;
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

export function measureBottomObstructionTop(): number | null {
  if (typeof document === 'undefined') return null;
  let minTop = Number.POSITIVE_INFINITY;
  for (const selector of ['.sc-bottom-bar', '.tv-bottom-drawer']) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.top > 44) {
      minTop = Math.min(minTop, rect.top);
    }
  }
  return Number.isFinite(minTop) ? Math.round(minTop) : null;
}

export function clampFloatingBarPosition(
  pos: FloatingBarPosition,
  barW: number,
  barH: number,
  obstructionTop?: number | null,
): FloatingBarPosition {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(8, window.innerWidth - barW - 8);
  const defaultMaxY = window.innerHeight - barH - 70;
  const clearanceMaxY =
    obstructionTop != null ? obstructionTop - barH - 8 : defaultMaxY;
  const maxY = Math.max(44, Math.min(defaultMaxY, clearanceMaxY));
  return {
    x: Math.max(8, Math.min(maxX, Math.round(pos.x))),
    y: Math.max(44, Math.min(maxY, Math.round(pos.y))),
  };
}

/**
 * Tracks a floating toolbar's rendered size and the live top edge of
 * `.sc-bottom-bar` / `.tv-bottom-drawer` so the bar clears the bottom drawer
 * cleanly whenever it opens, resizes, or expands, and returns on collapse.
 */
export function useFloatingBarClearance(
  barRef: { current: HTMLDivElement | null },
  isVisible: boolean,
  defaultWidth: number,
  contentKey?: string | number,
  onWindowResize?: () => void,
) {
  const { bottomPanel, bottomPanelExpanded, bottomPanelHeight } = useTradingView();
  const [viewportH, setViewportH] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );
  const [barSize, setBarSize] = useState<{ w: number; h: number }>({
    w: defaultWidth,
    h: 38,
  });
  const [measuredTop, setMeasuredTop] = useState<number | null>(null);

  const effectiveDrawerHeight = bottomPanel
    ? bottomPanelExpanded
      ? Math.round(viewportH * 0.56)
      : bottomPanelHeight
    : 0;
  const fallbackTop = viewportH - (bottomPanel ? effectiveDrawerHeight + 78 : 78);
  const obstructionTop = measuredTop ?? fallbackTop;

  const obstructionTopRef = useRef(obstructionTop);
  obstructionTopRef.current = obstructionTop;
  const barSizeRef = useRef(barSize);
  barSizeRef.current = barSize;
  const onWindowResizeRef = useRef(onWindowResize);
  onWindowResizeRef.current = onWindowResize;

  useLayoutEffect(() => {
    if (!isVisible) return;
    const syncMetrics = (fromResize: boolean) => {
      if (typeof window !== 'undefined') {
        setViewportH((prev) =>
          prev === window.innerHeight ? prev : window.innerHeight,
        );
      }
      const rect = barRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const nextW = Math.round(rect.width);
        const nextH = Math.round(rect.height);
        setBarSize((prev) =>
          prev.w === nextW && prev.h === nextH ? prev : { w: nextW, h: nextH },
        );
      }
      const nextTop = measureBottomObstructionTop();
      setMeasuredTop((prev) => (prev === nextTop ? prev : nextTop));
      if (fromResize) {
        onWindowResizeRef.current?.();
      }
    };
    const handleResize = () => syncMetrics(true);
    const handleObserve = () => syncMetrics(false);
    syncMetrics(false);
    window.addEventListener('resize', handleResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleObserve);
      for (const selector of ['.sc-bottom-bar', '.tv-bottom-drawer']) {
        const el = document.querySelector(selector);
        if (el) ro.observe(el);
      }
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
    };
  }, [
    barRef,
    isVisible,
    contentKey,
    bottomPanel,
    bottomPanelExpanded,
    bottomPanelHeight,
  ]);

  const getLiveObstructionTop = useCallback(
    () => measureBottomObstructionTop() ?? obstructionTopRef.current,
    [],
  );

  return {
    barSize,
    barSizeRef,
    obstructionTop,
    getLiveObstructionTop,
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
  const [position, setPosition] = useState<FloatingBarPosition>(loadInitialPosition);

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
  const { barSize, barSizeRef, obstructionTop, getLiveObstructionTop } =
    useFloatingBarClearance(barRef, isVisible, 280, visibleTools.length);

  const clampAndCommit = useCallback(
    (nextPos: FloatingBarPosition, persist = false) => {
      const rect = barRef.current?.getBoundingClientRect();
      const w = rect?.width ?? barSizeRef.current.w;
      const h = rect?.height ?? barSizeRef.current.h;
      const clamped = clampFloatingBarPosition(
        nextPos,
        w,
        h,
        getLiveObstructionTop(),
      );
      setPosition(clamped);
      if (persist && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
        } catch {
          // ignore storage failures
        }
      }
    },
    [barSizeRef, getLiveObstructionTop],
  );

  const displayPosition = useMemo(
    () =>
      clampFloatingBarPosition(position, barSize.w, barSize.h, obstructionTop),
    [position, barSize.w, barSize.h, obstructionTop],
  );

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
        left: displayPosition.x,
        top: displayPosition.y,
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
