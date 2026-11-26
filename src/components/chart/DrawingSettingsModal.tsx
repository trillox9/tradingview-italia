import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DRAWING_TOOL_REGISTRY,
  normalizeDrawingTool,
  type Candle,
  type CanonicalDrawingToolType,
  type DrawingObject,
  type LineStyle,
} from '../../types';
import { useActivePane, useDrawings } from '../../store';
import {
  TV_DRAWING_COLORS,
  parseColorToHexAndAlpha,
  supportsFillTool,
  toRgbaString,
} from './FloatingDrawingToolbar';
import { DrawingToolIcon } from './DrawingToolbar';
import '../../styles/drawingTools.css';

type SettingsTab = 'style' | 'text' | 'coords';

const STANDARD_FIB_LEVELS: readonly number[] = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618,
];

const FIB_TOOLS = new Set<CanonicalDrawingToolType>([
  'fib_retracement',
  'fib_extension',
  'fib_channel',
  'fib_circles',
  'fib_speed_fan',
]);

const EXTENDABLE_TOOLS = new Set<CanonicalDrawingToolType>([
  'trendline',
  'ray',
  'info_line',
  'extended_line',
  'trend_angle',
  'channel',
  'flat_channel',
  'disjoint_channel',
  'regression_trend',
  'fib_retracement',
  'fib_extension',
  'fib_channel',
]);

const MEDIAN_LINE_TOOLS = new Set<CanonicalDrawingToolType>([
  'channel',
  'flat_channel',
  'disjoint_channel',
  'regression_trend',
  'pitchfork',
  'schiff_pitchfork',
]);

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24] as const;

function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const val = Number(normalized);
  return Number.isFinite(val) ? val : null;
}

function timeToBarIndex(time: number, candles: readonly Candle[]): number {
  if (candles.length === 0) return 0;
  if (candles.length === 1) return 0;
  const step = Math.max(
    1,
    candles[candles.length - 1].time - candles[candles.length - 2].time,
  );
  if (time <= candles[0].time) {
    return Math.round((time - candles[0].time) / step);
  }
  if (time >= candles[candles.length - 1].time) {
    return Math.round(
      candles.length - 1 + (time - candles[candles.length - 1].time) / step,
    );
  }
  let bestIdx = 0;
  let bestDiff = Math.abs(candles[0].time - time);
  for (let i = 1; i < candles.length; i++) {
    const diff = Math.abs(candles[i].time - time);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function barIndexToTime(barIndex: number, candles: readonly Candle[]): number {
  if (candles.length === 0) return Math.floor(Date.now() / 1000);
  if (candles.length === 1) return candles[0].time;
  const step = Math.max(
    1,
    candles[candles.length - 1].time - candles[candles.length - 2].time,
  );
  const idx = Math.round(barIndex);
  if (idx < 0) return candles[0].time + idx * step;
  if (idx >= candles.length) {
    return candles[candles.length - 1].time + (idx - (candles.length - 1)) * step;
  }
  return candles[idx].time;
}

function formatPointTimestamp(unixSec: number): string {
  try {
    return new Date(unixSec * 1000).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function cloneDrawingSnapshot(d: DrawingObject): DrawingObject {
  return {
    ...d,
    points: d.points.map((pt) => ({ ...pt })),
    style: { ...d.style },
    fibLevels: d.fibLevels ? [...d.fibLevels] : undefined,
    visibleTimeframes: d.visibleTimeframes ? [...d.visibleTimeframes] : undefined,
  };
}

export function DrawingSettingsModal() {
  const { activeSymbol, displayedCandles } = useActivePane();
  const {
    drawings,
    selectedDrawingSettingsId,
    selectedDrawingSettingsOpen,
    closeDrawingSettings,
    updateDrawing,
    deleteDrawing,
  } = useDrawings();

  const drawing = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingSettingsId) ?? null,
    [drawings, selectedDrawingSettingsId],
  );

  const [tab, setTab] = useState<SettingsTab>('style');
  const snapshotRef = useRef<DrawingObject | null>(null);
  const activeSessionKeyRef = useRef<string | null>(null);

  // Draft input buffers so typing decimal numbers & bars never breaks mid-edit
  const [priceDrafts, setPriceDrafts] = useState<string[]>([]);
  const [barDrafts, setBarDrafts] = useState<string[]>([]);
  const [stopDraft, setStopDraft] = useState<string>('');
  const [targetDraft, setTargetDraft] = useState<string>('');
  const [fibRows, setFibRows] = useState<
    Array<{ id: string; enabled: boolean; draft: string; ratio: number }>
  >([]);

  const syncBuffersFromDrawing = useCallback(
    (src: DrawingObject) => {
      const prec = Math.max(2, activeSymbol.precision);
      setPriceDrafts(src.points.map((pt) => pt.price.toFixed(prec)));
      setBarDrafts(
        src.points.map((pt) => String(timeToBarIndex(pt.time, displayedCandles))),
      );
      setStopDraft(
        src.stopPrice !== undefined ? src.stopPrice.toFixed(prec) : '',
      );
      setTargetDraft(
        src.targetPrice !== undefined ? src.targetPrice.toFixed(prec) : '',
      );

      const currentFibs = src.fibLevels ?? [
        0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618,
      ];
      const mergedRatios = [...STANDARD_FIB_LEVELS];
      for (const lv of currentFibs) {
        if (!mergedRatios.some((r) => Math.abs(r - lv) < 1e-6)) {
          mergedRatios.push(lv);
        }
      }
      mergedRatios.sort((a, b) => a - b);
      setFibRows(
        mergedRatios.map((r, idx) => ({
          id: `fib-${idx}-${r}`,
          enabled: currentFibs.some((lv) => Math.abs(lv - r) < 1e-6),
          ratio: r,
          draft: String(r),
        })),
      );
    },
    [activeSymbol.precision, displayedCandles],
  );

  useEffect(() => {
    if (!selectedDrawingSettingsOpen || !drawing) {
      activeSessionKeyRef.current = null;
      snapshotRef.current = null;
      return;
    }
    const key = `${drawing.id}:${selectedDrawingSettingsOpen}`;
    if (activeSessionKeyRef.current !== key) {
      activeSessionKeyRef.current = key;
      snapshotRef.current = cloneDrawingSnapshot(drawing);
      setTab('style');
      syncBuffersFromDrawing(drawing);
    }
  }, [drawing, selectedDrawingSettingsOpen, syncBuffersFromDrawing]);

  const handleCancel = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap && drawing) {
      updateDrawing(activeSymbol.ticker, drawing.id, {
        points: snap.points,
        style: snap.style,
        text: snap.text,
        label: snap.label,
        locked: snap.locked,
        visible: snap.visible,
        extendLeft: snap.extendLeft,
        extendRight: snap.extendRight,
        showMiddleLine: snap.showMiddleLine,
        showPriceLabels: snap.showPriceLabels,
        showPercentLabels: snap.showPercentLabels,
        showStats: snap.showStats,
        inverted: snap.inverted,
        fibLevels: snap.fibLevels,
        stopPrice: snap.stopPrice,
        targetPrice: snap.targetPrice,
      });
    }
    closeDrawingSettings();
  }, [activeSymbol.ticker, closeDrawingSettings, drawing, updateDrawing]);

  useEffect(() => {
    if (!selectedDrawingSettingsOpen || !drawing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawing, handleCancel, selectedDrawingSettingsOpen]);

  if (!selectedDrawingSettingsOpen || !drawing) return null;

  const canonical = normalizeDrawingTool(drawing.type);
  const meta = DRAWING_TOOL_REGISTRY[canonical];
  const isFibTool = FIB_TOOLS.has(canonical);
  const isPositionTool =
    canonical === 'long_position' || canonical === 'short_position';
  const showFill = supportsFillTool(drawing.type);
  const showExtend = EXTENDABLE_TOOLS.has(canonical);
  const showMedianOpt = MEDIAN_LINE_TOOLS.has(canonical);

  const strokeParsed = parseColorToHexAndAlpha(drawing.style.color, '#2962FF', 1);
  const fillParsed = parseColorToHexAndAlpha(
    drawing.style.fillColor,
    strokeParsed.hex,
    drawing.style.fillOpacity ?? 0.18,
  );
  const fillAlpha =
    drawing.style.fillOpacity !== undefined
      ? drawing.style.fillOpacity
      : fillParsed.alpha;
  const textColorParsed = parseColorToHexAndAlpha(
    drawing.style.textColor ?? drawing.style.color,
    '#FFFFFF',
    1,
  );

  const patchDrawing = (patch: Partial<DrawingObject>) => {
    updateDrawing(activeSymbol.ticker, drawing.id, patch);
  };

  const patchStyle = (stylePatch: Partial<DrawingObject['style']>) => {
    patchDrawing({ style: { ...drawing.style, ...stylePatch } });
  };

  const commitFibRows = (nextRows: typeof fibRows) => {
    setFibRows(nextRows);
    const activeRatios = Array.from(
      new Set(
        nextRows
          .filter((r) => r.enabled && Number.isFinite(r.ratio))
          .map((r) => Math.round(r.ratio * 10000) / 10000),
      ),
    ).sort((a, b) => a - b);
    patchDrawing({ fibLevels: activeRatios });
  };

  const handleResetDefaults = () => {
    const defaultFillAlpha = meta.defaultFillColor
      ? parseColorToHexAndAlpha(meta.defaultFillColor, meta.defaultColor, 0.16).alpha
      : 0.16;
    const resetPatch: Partial<DrawingObject> = {
      style: {
        ...drawing.style,
        color: meta.defaultColor,
        lineWidth: meta.defaultLineWidth,
        lineStyle: meta.defaultLineStyle,
        fillColor: meta.defaultFillColor,
        fillOpacity: meta.defaultFillColor ? defaultFillAlpha : undefined,
        fontSize: 13,
        fontBold: false,
        fontItalic: false,
        textColor: meta.defaultColor,
        showLabels: true,
      },
      extendLeft: false,
      extendRight: false,
      showMiddleLine: true,
      showPriceLabels: true,
      showStats: true,
      inverted: false,
      fibLevels: isFibTool
        ? canonical === 'fib_extension'
          ? [...STANDARD_FIB_LEVELS]
          : [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618]
        : undefined,
    };
    patchDrawing(resetPatch);
    syncBuffersFromDrawing({ ...drawing, ...resetPatch, style: resetPatch.style! });
  };

  return (
    <div
      className="sc-drw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Impostazioni ${meta?.labelIt ?? 'disegno'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="sc-drw-modal">
        {/* Header */}
        <div className="sc-drw-modal-header">
          <div className="sc-drw-modal-title-wrap">
            <DrawingToolIcon tool={canonical} size={18} />
            <div>
              <h2 className="sc-drw-modal-title">
                {meta?.labelIt ?? 'Impostazioni disegno'}
              </h2>
              <div className="sc-drw-modal-sub">
                {activeSymbol.ticker} · {drawing.points.length}{' '}
                {drawing.points.length === 1 ? 'punto' : 'punti'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="sc-drw-modal-close"
            aria-label="Chiudi"
            onClick={handleCancel}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
              <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
            </svg>
          </button>
        </div>

        {/* 3 Tabs: Stile | Testo | Coordinate */}
        <div className="sc-drw-tabs" role="tablist" aria-label="Sezioni impostazioni disegno">
          {(
            [
              { id: 'style', label: 'Stile' },
              { id: 'text', label: 'Testo' },
              { id: 'coords', label: 'Coordinate' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`sc-drw-tab ${tab === t.id ? 'sc-drw-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="sc-drw-modal-body">
          {/* ---------------- TAB 1: STILE ---------------- */}
          {tab === 'style' && (
            <>
              <div className="sc-drw-section-title">Linea e bordo</div>

              <div className="sc-drw-row">
                <span className="sc-drw-row-label">Colore principale</span>
                <div className="sc-drw-inline-controls">
                  {TV_DRAWING_COLORS.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`sc-swatch-cell ${
                        strokeParsed.hex === c.toUpperCase()
                          ? 'sc-swatch-cell--active'
                          : ''
                      }`}
                      style={{ backgroundColor: c, width: 20, height: 20 }}
                      title={c}
                      onClick={() => patchStyle({ color: c })}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Colore linea personalizzato"
                    value={strokeParsed.hex}
                    onChange={(e) => patchStyle({ color: e.target.value })}
                    style={{
                      width: 28,
                      height: 24,
                      border: '1px solid var(--dt-border)',
                      borderRadius: 4,
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div className="sc-drw-row">
                <span className="sc-drw-row-label">Spessore linea</span>
                <div className="sc-drw-pill-group">
                  {([1, 2, 3, 4] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`sc-drw-pill ${
                        Math.round(drawing.style.lineWidth || 1) === w
                          ? 'sc-drw-pill--active'
                          : ''
                      }`}
                      onClick={() => patchStyle({ lineWidth: w })}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </div>

              <div className="sc-drw-row">
                <span className="sc-drw-row-label">Stile linea</span>
                <div className="sc-drw-pill-group">
                  {(
                    [
                      { value: 'solid', label: 'Continua' },
                      { value: 'dashed', label: 'Tratteggiata' },
                      { value: 'dotted', label: 'Punteggiata' },
                    ] as ReadonlyArray<{ value: LineStyle; label: string }>
                  ).map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      className={`sc-drw-pill ${
                        drawing.style.lineStyle === st.value
                          ? 'sc-drw-pill--active'
                          : ''
                      }`}
                      onClick={() => patchStyle({ lineStyle: st.value })}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {showFill && (
                <>
                  <div className="sc-drw-section-title">Riempimento</div>
                  <div className="sc-drw-row">
                    <span className="sc-drw-row-label">Colore sfondo</span>
                    <div className="sc-drw-inline-controls">
                      {TV_DRAWING_COLORS.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`sc-swatch-cell ${
                            fillParsed.hex === c.toUpperCase()
                              ? 'sc-swatch-cell--active'
                              : ''
                          }`}
                          style={{ backgroundColor: c, width: 20, height: 20 }}
                          title={c}
                          onClick={() =>
                            patchStyle({
                              fillColor: toRgbaString(c, fillAlpha),
                              fillOpacity: fillAlpha,
                            })
                          }
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Colore riempimento personalizzato"
                        value={fillParsed.hex}
                        onChange={(e) =>
                          patchStyle({
                            fillColor: toRgbaString(e.target.value, fillAlpha),
                            fillOpacity: fillAlpha,
                          })
                        }
                        style={{
                          width: 28,
                          height: 24,
                          border: '1px solid var(--dt-border)',
                          borderRadius: 4,
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>

                  <div className="sc-drw-row">
                    <span className="sc-drw-row-label">
                      Opacità riempimento ({Math.round(fillAlpha * 100)}%)
                    </span>
                    <input
                      type="range"
                      className="sc-fdt-range"
                      style={{ maxWidth: 220 }}
                      min={0}
                      max={100}
                      step={2}
                      value={Math.round(fillAlpha * 100)}
                      onChange={(e) => {
                        const a = Number(e.target.value) / 100;
                        patchStyle({
                          fillOpacity: a,
                          fillColor: toRgbaString(fillParsed.hex, a),
                        });
                      }}
                    />
                  </div>
                </>
              )}

              <div className="sc-drw-section-title">Estensione e visualizzazione</div>
              <div className="sc-drw-fib-grid">
                {showExtend && (
                  <>
                    <label className="sc-drw-check">
                      <input
                        type="checkbox"
                        checked={Boolean(drawing.extendLeft)}
                        onChange={(e) =>
                          patchDrawing({ extendLeft: e.target.checked })
                        }
                      />
                      <span>Estendi a sinistra</span>
                    </label>
                    <label className="sc-drw-check">
                      <input
                        type="checkbox"
                        checked={Boolean(drawing.extendRight)}
                        onChange={(e) =>
                          patchDrawing({ extendRight: e.target.checked })
                        }
                      />
                      <span>Estendi a destra</span>
                    </label>
                  </>
                )}

                {showMedianOpt && (
                  <label className="sc-drw-check">
                    <input
                      type="checkbox"
                      checked={drawing.showMiddleLine ?? true}
                      onChange={(e) =>
                        patchDrawing({ showMiddleLine: e.target.checked })
                      }
                    />
                    <span>Mostra linea mediana</span>
                  </label>
                )}

                <label className="sc-drw-check">
                  <input
                    type="checkbox"
                    checked={drawing.showPriceLabels ?? true}
                    onChange={(e) =>
                      patchDrawing({ showPriceLabels: e.target.checked })
                    }
                  />
                  <span>Mostra etichette prezzo</span>
                </label>

                <label className="sc-drw-check">
                  <input
                    type="checkbox"
                    checked={drawing.showStats ?? true}
                    onChange={(e) =>
                      patchDrawing({ showStats: e.target.checked })
                    }
                  />
                  <span>Mostra statistiche</span>
                </label>

                <label className="sc-drw-check">
                  <input
                    type="checkbox"
                    checked={drawing.visible}
                    onChange={(e) => patchDrawing({ visible: e.target.checked })}
                  />
                  <span>Visibile</span>
                </label>

                <label className="sc-drw-check">
                  <input
                    type="checkbox"
                    checked={drawing.locked}
                    onChange={(e) => patchDrawing({ locked: e.target.checked })}
                  />
                  <span>Bloccato</span>
                </label>
              </div>

              {isFibTool && (
                <>
                  <div className="sc-drw-section-title">Livelli Fibonacci</div>
                  <div className="sc-drw-row">
                    <label className="sc-drw-check">
                      <input
                        type="checkbox"
                        checked={Boolean(drawing.inverted)}
                        onChange={(e) =>
                          patchDrawing({ inverted: e.target.checked })
                        }
                      />
                      <span>Inverti</span>
                    </label>
                    <button
                      type="button"
                      className="sc-drw-btn sc-drw-btn--ghost"
                      style={{ height: 26, fontSize: 11.5 }}
                      onClick={() => {
                        const base = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618];
                        commitFibRows(
                          STANDARD_FIB_LEVELS.map((r, i) => ({
                            id: `std-${i}-${r}`,
                            enabled: base.includes(r),
                            ratio: r,
                            draft: String(r),
                          })),
                        );
                      }}
                    >
                      Ripristina livelli
                    </button>
                  </div>

                  <div className="sc-drw-fib-grid">
                    {fibRows.map((row, idx) => (
                      <div key={row.id} className="sc-drw-fib-item">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          aria-label={`Abilita livello ${row.draft}`}
                          onChange={(e) => {
                            const next = fibRows.map((r, i) =>
                              i === idx ? { ...r, enabled: e.target.checked } : r,
                            );
                            commitFibRows(next);
                          }}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          className="sc-drw-fib-input"
                          aria-label={`Moltiplicatore livello ${idx + 1}`}
                          value={row.draft}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed = parseNumericInput(raw);
                            const next = fibRows.map((r, i) =>
                              i === idx
                                ? {
                                    ...r,
                                    draft: raw,
                                    ratio: parsed !== null ? parsed : r.ratio,
                                  }
                                : r,
                            );
                            if (parsed !== null) {
                              commitFibRows(next);
                            } else {
                              setFibRows(next);
                            }
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--dt-text-muted)' }}>
                          ({Math.round(row.ratio * 1000) / 10}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isPositionTool && (
                <>
                  <div className="sc-drw-section-title">Livelli Posizione</div>
                  <div className="sc-drw-coord-fields">
                    <div className="sc-drw-coord-field">
                      <label htmlFor="drw-pos-tp">Take Profit (Prezzo)</label>
                      <input
                        id="drw-pos-tp"
                        type="text"
                        inputMode="decimal"
                        className="sc-drw-input"
                        value={targetDraft}
                        onChange={(e) => {
                          setTargetDraft(e.target.value);
                          const val = parseNumericInput(e.target.value);
                          if (val !== null) patchDrawing({ targetPrice: val });
                        }}
                      />
                    </div>
                    <div className="sc-drw-coord-field">
                      <label htmlFor="drw-pos-sl">Stop Loss (Prezzo)</label>
                      <input
                        id="drw-pos-sl"
                        type="text"
                        inputMode="decimal"
                        className="sc-drw-input"
                        value={stopDraft}
                        onChange={(e) => {
                          setStopDraft(e.target.value);
                          const val = parseNumericInput(e.target.value);
                          if (val !== null) patchDrawing({ stopPrice: val });
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ---------------- TAB 2: TESTO ---------------- */}
          {tab === 'text' && (
            <>
              <div className="sc-drw-section-title">Contenuto etichetta</div>
              <textarea
                className="sc-drw-textarea"
                placeholder="Inserisci testo o nota sul grafico..."
                aria-label="Testo disegno"
                value={drawing.text ?? ''}
                onChange={(e) => patchDrawing({ text: e.target.value })}
              />

              <div className="sc-drw-row">
                <span className="sc-drw-row-label">Colore testo</span>
                <div className="sc-drw-inline-controls">
                  {TV_DRAWING_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`sc-swatch-cell ${
                        textColorParsed.hex === c.toUpperCase()
                          ? 'sc-swatch-cell--active'
                          : ''
                      }`}
                      style={{ backgroundColor: c, width: 20, height: 20 }}
                      title={c}
                      onClick={() => patchStyle({ textColor: c })}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Colore testo personalizzato"
                    value={textColorParsed.hex}
                    onChange={(e) => patchStyle({ textColor: e.target.value })}
                    style={{
                      width: 28,
                      height: 24,
                      border: '1px solid var(--dt-border)',
                      borderRadius: 4,
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div className="sc-drw-row">
                <span className="sc-drw-row-label">Dimensione carattere</span>
                <div className="sc-drw-inline-controls">
                  <select
                    className="sc-drw-select"
                    style={{ width: 96 }}
                    aria-label="Dimensione testo"
                    value={drawing.style.fontSize ?? 13}
                    onChange={(e) =>
                      patchStyle({ fontSize: Number(e.target.value) })
                    }
                  >
                    {FONT_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}px
                      </option>
                    ))}
                  </select>

                  <div className="sc-drw-pill-group">
                    <button
                      type="button"
                      className={`sc-drw-pill ${
                        drawing.style.fontBold ? 'sc-drw-pill--active' : ''
                      }`}
                      title="Grassetto"
                      aria-label="Grassetto"
                      aria-pressed={Boolean(drawing.style.fontBold)}
                      onClick={() =>
                        patchStyle({ fontBold: !drawing.style.fontBold })
                      }
                    >
                      <strong>G</strong>
                    </button>
                    <button
                      type="button"
                      className={`sc-drw-pill ${
                        drawing.style.fontItalic ? 'sc-drw-pill--active' : ''
                      }`}
                      title="Corsivo"
                      aria-label="Corsivo"
                      aria-pressed={Boolean(drawing.style.fontItalic)}
                      onClick={() =>
                        patchStyle({ fontItalic: !drawing.style.fontItalic })
                      }
                    >
                      <em>C</em>
                    </button>
                  </div>
                </div>
              </div>

              <label className="sc-drw-check">
                <input
                  type="checkbox"
                  checked={drawing.style.showLabels ?? true}
                  onChange={(e) => patchStyle({ showLabels: e.target.checked })}
                />
                <span>Mostra testo sul disegno</span>
              </label>
            </>
          )}

          {/* ---------------- TAB 3: COORDINATE ---------------- */}
          {tab === 'coords' && (
            <>
              <div className="sc-drw-section-title">
                Punti di ancoraggio ({drawing.points.length})
              </div>
              {drawing.points.map((pt, idx) => (
                <div key={idx} className="sc-drw-coord-card">
                  <div className="sc-drw-coord-head">
                    <span>Punto #{idx + 1}</span>
                    <span className="sc-drw-coord-time">
                      {formatPointTimestamp(pt.time)}
                    </span>
                  </div>
                  <div className="sc-drw-coord-fields">
                    <div className="sc-drw-coord-field">
                      <label htmlFor={`drw-pt-price-${idx}`}>Prezzo</label>
                      <input
                        id={`drw-pt-price-${idx}`}
                        type="text"
                        inputMode="decimal"
                        className="sc-drw-input"
                        value={priceDrafts[idx] ?? String(pt.price)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setPriceDrafts((prev) => {
                            const next = [...prev];
                            next[idx] = raw;
                            return next;
                          });
                          const val = parseNumericInput(raw);
                          if (val !== null) {
                            const nextPts = drawing.points.map((p, pIdx) =>
                              pIdx === idx ? { ...p, price: val } : p,
                            );
                            patchDrawing({ points: nextPts });
                          }
                        }}
                      />
                    </div>
                    <div className="sc-drw-coord-field">
                      <label htmlFor={`drw-pt-bar-${idx}`}>Barra #</label>
                      <input
                        id={`drw-pt-bar-${idx}`}
                        type="number"
                        step={1}
                        className="sc-drw-input"
                        value={
                          barDrafts[idx] ??
                          String(timeToBarIndex(pt.time, displayedCandles))
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          setBarDrafts((prev) => {
                            const next = [...prev];
                            next[idx] = raw;
                            return next;
                          });
                          const val = parseNumericInput(raw);
                          if (val !== null) {
                            const nextTime = barIndexToTime(val, displayedCandles);
                            const nextPts = drawing.points.map((p, pIdx) =>
                              pIdx === idx ? { ...p, time: nextTime } : p,
                            );
                            patchDrawing({ points: nextPts });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {isPositionTool && (
                <div className="sc-drw-coord-card">
                  <div className="sc-drw-coord-head">
                    <span>Target & Stop (Posizione)</span>
                  </div>
                  <div className="sc-drw-coord-fields">
                    <div className="sc-drw-coord-field">
                      <label htmlFor="drw-coord-tp">Take Profit</label>
                      <input
                        id="drw-coord-tp"
                        type="text"
                        inputMode="decimal"
                        className="sc-drw-input"
                        value={targetDraft}
                        onChange={(e) => {
                          setTargetDraft(e.target.value);
                          const val = parseNumericInput(e.target.value);
                          if (val !== null) patchDrawing({ targetPrice: val });
                        }}
                      />
                    </div>
                    <div className="sc-drw-coord-field">
                      <label htmlFor="drw-coord-sl">Stop Loss</label>
                      <input
                        id="drw-coord-sl"
                        type="text"
                        inputMode="decimal"
                        className="sc-drw-input"
                        value={stopDraft}
                        onChange={(e) => {
                          setStopDraft(e.target.value);
                          const val = parseNumericInput(e.target.value);
                          if (val !== null) patchDrawing({ stopPrice: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sc-drw-modal-footer">
          <button
            type="button"
            className="sc-drw-btn sc-drw-btn--ghost"
            onClick={handleResetDefaults}
          >
            Predefiniti
          </button>
          <button
            type="button"
            className="sc-drw-btn sc-drw-btn--danger"
            onClick={() => {
              deleteDrawing(activeSymbol.ticker, drawing.id);
              closeDrawingSettings();
            }}
          >
            Elimina
          </button>
          <div className="sc-drw-footer-right">
            <button
              type="button"
              className="sc-drw-btn sc-drw-btn--ghost"
              onClick={handleCancel}
            >
              Annulla
            </button>
            <button
              type="button"
              className="sc-drw-btn sc-drw-btn--primary"
              onClick={() => closeDrawingSettings()}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawingSettingsModal;
