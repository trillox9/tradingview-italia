import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Palette,
  RotateCcw,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS_IT,
  type IndicatorConfig,
  type IndicatorStyleSpec,
  type LineStyle,
  type Timeframe,
} from '../../types';
import { DEFAULT_INDICATOR_PRESETS } from '../../engine';
import { useActivePane, useTradingView } from '../../store';

export interface IndicatorSettingsModalProps {
  indicatorId?: string | null;
  onClose?: () => void;
}

type IndicatorTab = 'inputs' | 'style' | 'visibility';

interface ParamMeta {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

const PARAM_META_IT: Record<string, ParamMeta> = {
  period: { label: 'Lunghezza', min: 1, max: 500, step: 1 },
  length: { label: 'Lunghezza', min: 1, max: 500, step: 1 },
  multiplier: { label: 'Deviazione standard', min: 0.1, max: 10, step: 0.1 },
  stdDev: { label: 'Deviazione standard', min: 0.1, max: 10, step: 0.1 },
  factor: { label: 'Fattore ATR', min: 0.5, max: 20, step: 0.1 },
  fast: { label: 'Lunghezza veloce', min: 1, max: 200, step: 1 },
  slow: { label: 'Lunghezza lenta', min: 1, max: 400, step: 1 },
  signal: { label: 'Smoothing segnale', min: 1, max: 100, step: 1 },
  kPeriod: { label: 'Lunghezza %K', min: 1, max: 200, step: 1 },
  kSmooth: { label: 'Smoothing %K', min: 1, max: 50, step: 1 },
  dSmooth: { label: 'Smoothing %D', min: 1, max: 50, step: 1 },
  dPeriod: { label: 'Smoothing %D', min: 1, max: 50, step: 1 },
  smooth: { label: 'Smoothing', min: 1, max: 50, step: 1 },
  tenkan: { label: 'Conversione (Tenkan-sen)', min: 1, max: 200, step: 1 },
  kijun: { label: 'Linea di base (Kijun-sen)', min: 1, max: 300, step: 1 },
  senkouB: { label: 'Span B (Senkou B)', min: 1, max: 400, step: 1 },
  displacement: { label: 'Spostamento (Chikou)', min: 1, max: 100, step: 1 },
  source: {
    label: 'Sorgente',
    options: [
      { value: 'close', label: 'Chiusura (close)' },
      { value: 'open', label: 'Apertura (open)' },
      { value: 'high', label: 'Massimo (high)' },
      { value: 'low', label: 'Minimo (low)' },
      { value: 'hl2', label: 'HL2' },
      { value: 'hlc3', label: 'HLC3' },
      { value: 'ohlc4', label: 'OHLC4' },
    ],
  },
};

const PLOT_LABELS_IT: Record<string, string> = {
  main: 'Linea principale',
  upper: 'Banda superiore',
  middle: 'Linea mediana (Base)',
  lower: 'Banda inferiore',
  up: 'Trend rialzista',
  down: 'Trend ribassista',
  macd: 'Linea MACD',
  signal: 'Linea segnale',
  histogram: 'Istogramma',
  k: 'Linea %K',
  d: 'Linea %D',
  tenkan: 'Conversion Line (Tenkan)',
  kijun: 'Base Line (Kijun)',
  senkouA: 'Leading Span A',
  senkouB: 'Leading Span B',
  chikou: 'Lagging Span (Chikou)',
  p: 'Pivot (P)',
  r: 'Resistenze (R1–R3)',
  s: 'Supporti (S1–S3)',
};

const INDICATOR_SWATCHES = [
  '#2962FF',
  '#5B9CF6',
  '#089981',
  '#22AB94',
  '#F23645',
  '#F7525F',
  '#FF9800',
  '#FACC15',
  '#7E57C2',
  '#AB47BC',
  '#26C6DA',
  '#E91E63',
  '#FFFFFF',
  '#B8B8B8',
  '#787B86',
  '#131722',
];

function cloneIndicatorSnapshot(cfg: IndicatorConfig): Partial<IndicatorConfig> {
  return {
    visible: cfg.visible,
    lineStyle: cfg.lineStyle,
    visibleTimeframes: cfg.visibleTimeframes ? [...cfg.visibleTimeframes] : undefined,
    params: { ...cfg.params },
    styles: Object.fromEntries(
      Object.entries(cfg.styles).map(([k, v]) => [k, { ...v }]),
    ),
  };
}

function IndicatorColorPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hexVal = /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '#2962ff';

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  return (
    <div className="tvs-color-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tvs-color-trigger"
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="tvs-color-chip" style={{ backgroundColor: value }} />
      </button>

      {open && (
        <div className="tvs-color-popover" role="dialog" aria-label={label}>
          <div className="tvs-color-grid">
            {INDICATOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`tvs-color-dot-btn ${
                  hexVal.toLowerCase() === swatch.toLowerCase() ? 'is-active' : ''
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
                onClick={() => onChange(swatch)}
              />
            ))}
          </div>
          <div className="tvs-color-custom-row">
            <label className="tvs-color-native-label">
              <span>Colore</span>
              <input
                type="color"
                value={hexVal}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
              />
            </label>
            <span
              className="tv-mono"
              style={{ fontSize: '0.7rem', color: 'var(--tv-text-secondary, #8c8c8c)' }}
            >
              {hexVal.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function IndicatorSettingsModal({
  indicatorId: propId,
  onClose,
}: IndicatorSettingsModalProps) {
  const { editingIndicatorId, closeIndicatorSettings } = useTradingView();
  const { activePane, updateIndicator, removeIndicator } = useActivePane();

  const targetId = propId !== undefined ? propId : editingIndicatorId;
  const indicator = useMemo(
    () =>
      targetId
        ? activePane.indicators.find((i) => i.id === targetId) ?? null
        : null,
    [activePane.indicators, targetId],
  );

  const closeSelf = useCallback(() => {
    if (onClose) onClose();
    else closeIndicatorSettings();
  }, [closeIndicatorSettings, onClose]);

  const [tab, setTab] = useState<IndicatorTab>('inputs');
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const snapshotRef = useRef<{
    id: string;
    data: Partial<IndicatorConfig>;
  } | null>(null);

  // Capture clean snapshot whenever a new indicator opens for editing
  useEffect(() => {
    if (!indicator) {
      snapshotRef.current = null;
      return;
    }
    if (snapshotRef.current?.id !== indicator.id) {
      snapshotRef.current = {
        id: indicator.id,
        data: cloneIndicatorSnapshot(indicator),
      };
      setTab('inputs');
      const drafts: Record<string, string> = {};
      for (const [k, v] of Object.entries(indicator.params)) {
        drafts[k] = String(v);
      }
      setNumericDrafts(drafts);
    }
  }, [indicator]);

  const handleCancel = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap && indicator && snap.id === indicator.id) {
      updateIndicator(indicator.id, snap.data);
    }
    closeSelf();
  }, [closeSelf, indicator, updateIndicator]);

  const handleResetDefaults = useCallback(() => {
    if (!indicator) return;
    const preset = DEFAULT_INDICATOR_PRESETS.find((p) => p.type === indicator.type);
    if (!preset) return;
    const freshParams = { ...preset.params };
    const freshStyles: Record<string, IndicatorStyleSpec> = Object.fromEntries(
      Object.entries(preset.styles).map(([k, v]) => [k, { ...v }]),
    );
    updateIndicator(indicator.id, {
      visible: true,
      lineStyle: 'solid',
      visibleTimeframes: undefined,
      params: freshParams,
      styles: freshStyles,
    });
    const drafts: Record<string, string> = {};
    for (const [k, v] of Object.entries(freshParams)) {
      drafts[k] = String(v);
    }
    setNumericDrafts(drafts);
  }, [indicator, updateIndicator]);

  const handleRemove = useCallback(() => {
    if (!indicator) return;
    removeIndicator(indicator.id);
    closeSelf();
  }, [closeSelf, indicator, removeIndicator]);

  if (!indicator) return null;

  const paramEntries = Object.entries(indicator.params);
  const styleEntries = Object.entries(indicator.styles);
  const effectiveStyleEntries: [string, IndicatorStyleSpec][] =
    styleEntries.length > 0
      ? styleEntries
      : [['main', { color: '#2962FF', lineWidth: 2, lineStyle: indicator.lineStyle ?? 'solid' }]];

  const allTimeframesEnabled =
    !indicator.visibleTimeframes || indicator.visibleTimeframes.length === 0;
  const activeTfSet = new Set<Timeframe>(
    allTimeframesEnabled ? TIMEFRAMES : indicator.visibleTimeframes,
  );

  const updatePlotStyle = (plotKey: string, patch: Partial<IndicatorStyleSpec>) => {
    const prevPlot = indicator.styles[plotKey] ?? {
      color: '#2962FF',
      lineWidth: 2,
      lineStyle: 'solid' as LineStyle,
    };
    const nextStyles: Record<string, IndicatorStyleSpec> = {
      ...indicator.styles,
      [plotKey]: { ...prevPlot, ...patch },
    };
    const topPatch: Partial<IndicatorConfig> = { styles: nextStyles };
    if (patch.lineStyle && effectiveStyleEntries.length === 1) {
      topPatch.lineStyle = patch.lineStyle;
    }
    updateIndicator(indicator.id, topPatch);
  };

  const toggleTimeframeVisibility = (tf: Timeframe) => {
    const current = new Set<Timeframe>(
      allTimeframesEnabled ? TIMEFRAMES : indicator.visibleTimeframes,
    );
    if (current.has(tf)) {
      current.delete(tf);
    } else {
      current.add(tf);
    }
    const nextList = TIMEFRAMES.filter((t) => current.has(t));
    // Keep at least 1 timeframe selected; if all 8 selected, store undefined (all)
    if (nextList.length === 0) return;
    updateIndicator(indicator.id, {
      visibleTimeframes:
        nextList.length === TIMEFRAMES.length ? undefined : nextList,
    });
  };

  return (
    <div
      className="tvm-backdrop tvm-backdrop--live-preview"
      role="dialog"
      aria-modal="true"
      aria-label={`Impostazioni ${indicator.name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSelf();
      }}
    >
      <div className="tvm-dialog tvm-dialog--sm tvs-ind-dialog">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <Sliders size={18} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div style={{ minWidth: 0 }}>
              <h2 className="tvm-title">{indicator.name}</h2>
              <div className="tvm-subtitle">
                {indicator.pane === 'overlay' ? 'Sovrapposizione' : 'Oscillatore'} · Anteprima dal vivo
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={closeSelf}
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Authentic TradingView Tabs: Input | Stile | Visibilità */}
        <div className="tvs-ind-tabs" role="tablist" aria-label="Schede impostazioni indicatore">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'inputs'}
            className={`tvm-underline-tab ${tab === 'inputs' ? 'is-active' : ''}`}
            onClick={() => setTab('inputs')}
          >
            Input
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'style'}
            className={`tvm-underline-tab ${tab === 'style' ? 'is-active' : ''}`}
            onClick={() => setTab('style')}
          >
            Stile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'visibility'}
            className={`tvm-underline-tab ${tab === 'visibility' ? 'is-active' : ''}`}
            onClick={() => setTab('visibility')}
          >
            Visibilità
          </button>
        </div>

        <div className="tvm-body tvs-pane" style={{ maxHeight: 380 }}>
          {/* ================= TAB 1: INPUT ================= */}
          {tab === 'inputs' && (
            <>
              {paramEntries.length === 0 ? (
                <div
                  style={{
                    padding: '16px 12px',
                    borderRadius: 10,
                    backgroundColor: 'var(--tv-bg-primary, #131313)',
                    border: '1px solid var(--tv-border-subtle, #222222)',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    color: 'var(--tv-text-secondary, #8c8c8c)',
                  }}
                >
                  Questo indicatore ({indicator.name}) si calcola automaticamente dai dati OHLCV della sessione e non richiede parametri numerici di lunghezza. Usa la scheda <strong>Stile</strong> per personalizzare colori e spessore.
                </div>
              ) : (
                paramEntries.map(([key, rawVal]) => {
                  const meta = PARAM_META_IT[key] ?? {
                    label: key.charAt(0).toUpperCase() + key.slice(1),
                    min: 1,
                    max: 500,
                    step: 1,
                  };

                  if (meta.options) {
                    return (
                      <div key={key} className="tvs-row">
                        <label
                          className="tvs-row-label"
                          htmlFor={`ind-param-${key}`}
                        >
                          {meta.label}
                        </label>
                        <select
                          id={`ind-param-${key}`}
                          className="tvs-select"
                          value={String(rawVal)}
                          onChange={(e) =>
                            updateIndicator(indicator.id, {
                              params: { ...indicator.params, [key]: e.target.value },
                            })
                          }
                        >
                          {meta.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  const draftStr = numericDrafts[key] ?? String(rawVal);

                  return (
                    <div key={key} className="tvs-row">
                      <label
                        className="tvs-row-label"
                        htmlFor={`ind-param-${key}`}
                      >
                        {meta.label}
                      </label>
                      <input
                        id={`ind-param-${key}`}
                        type="number"
                        className="tvs-num-input tv-num"
                        style={{ width: 96 }}
                        min={meta.min}
                        max={meta.max}
                        step={meta.step ?? 1}
                        value={draftStr}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setNumericDrafts((prev) => ({ ...prev, [key]: txt }));
                          const parsed = Number.parseFloat(txt);
                          if (Number.isFinite(parsed)) {
                            const min = meta.min ?? -Infinity;
                            const max = meta.max ?? Infinity;
                            const clamped = Math.max(min, Math.min(max, parsed));
                            updateIndicator(indicator.id, {
                              params: { ...indicator.params, [key]: clamped },
                            });
                          }
                        }}
                        onBlur={() => {
                          setNumericDrafts((prev) => ({
                            ...prev,
                            [key]: String(indicator.params[key]),
                          }));
                        }}
                      />
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ================= TAB 2: STILE ================= */}
          {tab === 'style' && (
            <>
              <div className="tvs-row">
                <label className="tvs-checkbox-label">
                  <input
                    type="checkbox"
                    className="tvs-checkbox"
                    checked={indicator.visible}
                    onChange={(e) =>
                      updateIndicator(indicator.id, { visible: e.target.checked })
                    }
                  />
                  <span>Visibile sul grafico</span>
                </label>
                <span className="tvm-subtitle" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={13} />
                  {indicator.visible ? 'Attivo' : 'Nascosto'}
                </span>
              </div>

              <div className="tvs-section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Palette size={12} /> Serie grafiche
                </span>
              </div>

              {effectiveStyleEntries.map(([plotKey, spec]) => {
                const plotLabel =
                  PLOT_LABELS_IT[plotKey] ??
                  plotKey.charAt(0).toUpperCase() + plotKey.slice(1);
                const lineStyleVal: LineStyle =
                  spec.lineStyle ?? indicator.lineStyle ?? 'solid';
                const lineWidthVal = spec.lineWidth ?? 2;

                return (
                  <div key={plotKey} className="tvs-row">
                    <span className="tvs-row-label">{plotLabel}</span>
                    <div className="tvs-inline-controls">
                      <IndicatorColorPicker
                        label={`Colore ${plotLabel}`}
                        value={spec.color}
                        onChange={(color) => updatePlotStyle(plotKey, { color })}
                      />
                      <select
                        aria-label={`Spessore ${plotLabel}`}
                        className="tvs-select tvs-select--xs"
                        value={lineWidthVal}
                        onChange={(e) =>
                          updatePlotStyle(plotKey, {
                            lineWidth: Number(e.target.value),
                          })
                        }
                      >
                        {[1, 2, 3, 4].map((w) => (
                          <option key={w} value={w}>
                            {w}px
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Stile linea ${plotLabel}`}
                        className="tvs-select tvs-select--compact"
                        value={lineStyleVal}
                        onChange={(e) =>
                          updatePlotStyle(plotKey, {
                            lineStyle: e.target.value as LineStyle,
                          })
                        }
                      >
                        <option value="solid">Continua</option>
                        <option value="dashed">Tratteggiata</option>
                        <option value="dotted">Punteggiata</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ================= TAB 3: VISIBILITÀ ================= */}
          {tab === 'visibility' && (
            <>
              <div className="tvs-row">
                <label className="tvs-checkbox-label">
                  <input
                    type="checkbox"
                    className="tvs-checkbox"
                    checked={allTimeframesEnabled}
                    onChange={(e) =>
                      updateIndicator(indicator.id, {
                        visibleTimeframes: e.target.checked
                          ? undefined
                          : [...TIMEFRAMES],
                      })
                    }
                  />
                  <span>Visibile su tutti i timeframe</span>
                </label>
              </div>

              <div className="tvs-ind-tf-quick">
                <button
                  type="button"
                  className="tvm-offset-btn"
                  onClick={() =>
                    updateIndicator(indicator.id, { visibleTimeframes: undefined })
                  }
                >
                  Tutti
                </button>
                <button
                  type="button"
                  className="tvm-offset-btn"
                  onClick={() =>
                    updateIndicator(indicator.id, {
                      visibleTimeframes: ['1m', '5m', '15m', '1H', '4H'],
                    })
                  }
                >
                  Solo Intraday
                </button>
                <button
                  type="button"
                  className="tvm-offset-btn"
                  onClick={() =>
                    updateIndicator(indicator.id, {
                      visibleTimeframes: ['1D', '1W', '1M'],
                    })
                  }
                >
                  Solo Giornalieri+
                </button>
              </div>

              <div className="tvs-section-title">Timeframe specifici</div>

              <div className="tvs-tf-grid">
                {TIMEFRAMES.map((tf) => {
                  const checked = activeTfSet.has(tf);
                  return (
                    <label key={tf} className="tvs-tf-item">
                      <input
                        type="checkbox"
                        className="tvs-checkbox"
                        checked={checked}
                        onChange={() => toggleTimeframeVisibility(tf)}
                      />
                      <span className="tv-mono" style={{ fontWeight: 700, minWidth: 32 }}>
                        {tf}
                      </span>
                      <span className="tvm-subtitle">{TIMEFRAME_LABELS_IT[tf]}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="tvm-footer">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="tvm-btn tvm-btn--sm tvm-btn--secondary"
              onClick={handleResetDefaults}
            >
              <RotateCcw size={13} />
              Predefiniti
            </button>
            <button
              type="button"
              className="tvm-btn tvm-btn--sm tvm-btn--danger"
              onClick={handleRemove}
            >
              <Trash2 size={13} />
              Rimuovi
            </button>
          </div>

          <div className="tvm-footer-actions">
            <button
              type="button"
              className="tvm-btn tvm-btn--secondary"
              onClick={handleCancel}
            >
              Annulla
            </button>
            <button
              type="button"
              className="tvm-btn tvm-btn--primary"
              onClick={closeSelf}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndicatorSettingsModal;
