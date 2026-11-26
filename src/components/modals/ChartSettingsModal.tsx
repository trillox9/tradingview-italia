import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowLeftRight,
  Bell,
  CandlestickChart,
  ChevronDown,
  Moon,
  Palette,
  RotateCcw,
  Ruler,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import {
  CHART_TYPES_META,
  normalizeChartType,
  type CanvasGridMode,
  type ChartDateFormat,
  type ChartPrecisionSetting,
  type ChartScaleMode,
  type ChartSettings,
  type ChartTimezoneSetting,
  type ChartType,
  type LineStyle,
  type PriceScalePosition,
  type StatusLineTitleMode,
} from '../../types';
import {
  useActivePane,
  useTradingView,
  type ThemeMode,
} from '../../store';

export interface ChartSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type SettingsTab =
  | 'symbol'
  | 'statusLine'
  | 'scales'
  | 'canvas'
  | 'trading'
  | 'alerts';

interface SettingsSnapshot {
  chartSettings: ChartSettings;
  theme: ThemeMode;
  chartType: ChartType;
  showVolume: boolean;
  liveCryptoEnabled: boolean;
}

const SWATCH_PALETTE = [
  '#089981',
  '#22AB94',
  '#F23645',
  '#F7525F',
  '#2962FF',
  '#5B9CF6',
  '#FF9800',
  '#FACC15',
  '#7E57C2',
  '#26C6DA',
  '#FFFFFF',
  '#D1D4DC',
  '#8C8C8C',
  '#464646',
  '#131722',
  '#000000',
];

function cloneSettings(s: ChartSettings): ChartSettings {
  return {
    symbol: { ...s.symbol },
    statusLine: { ...s.statusLine },
    scales: { ...s.scales },
    canvas: { ...s.canvas },
    trading: { ...s.trading },
    alerts: { ...s.alerts },
  };
}

function parseColorToHexAlpha(color: string): { hex: string; alpha: number } {
  const trimmed = color.trim();
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hexMatch) {
    return { hex: `#${hexMatch[1].toLowerCase()}`, alpha: 1 };
  }
  const shortHex = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('');
    return { hex: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(), alpha: 1 };
  }
  const rgbaMatch =
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(
      trimmed,
    );
  if (rgbaMatch) {
    const r = Math.min(255, Number(rgbaMatch[1])).toString(16).padStart(2, '0');
    const g = Math.min(255, Number(rgbaMatch[2])).toString(16).padStart(2, '0');
    const b = Math.min(255, Number(rgbaMatch[3])).toString(16).padStart(2, '0');
    const a =
      rgbaMatch[4] !== undefined
        ? Math.max(0, Math.min(1, Number.parseFloat(rgbaMatch[4])))
        : 1;
    return { hex: `#${r}${g}${b}`, alpha: Number.isFinite(a) ? a : 1 };
  }
  return { hex: '#2962ff', alpha: 1 };
}

function formatHexAlpha(hex: string, alpha: number, allowAlpha: boolean): string {
  if (!allowAlpha || alpha >= 0.995) {
    return hex.toUpperCase();
  }
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16) || 0;
  const g = Number.parseInt(clean.slice(2, 4), 16) || 0;
  const b = Number.parseInt(clean.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}

function ColorSwatchControl({
  value,
  onChange,
  label,
  allowAlpha = false,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  allowAlpha?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { hex, alpha } = parseColorToHexAlpha(value);

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
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="tvs-color-chip" style={{ backgroundColor: value }} />
      </button>

      {open && !disabled && (
        <div className="tvs-color-popover" role="dialog" aria-label={label}>
          <div className="tvs-color-grid">
            {SWATCH_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`tvs-color-dot-btn ${
                  hex.toLowerCase() === swatch.toLowerCase() ? 'is-active' : ''
                }`}
                style={{ backgroundColor: swatch }}
                title={swatch}
                onClick={() => onChange(formatHexAlpha(swatch, alpha, allowAlpha))}
              />
            ))}
          </div>

          <div className="tvs-color-custom-row">
            <label className="tvs-color-native-label">
              <span>Colore</span>
              <input
                type="color"
                value={hex}
                onChange={(e) =>
                  onChange(formatHexAlpha(e.target.value, alpha, allowAlpha))
                }
              />
            </label>
            <span className="tv-mono" style={{ fontSize: '0.7rem', color: 'var(--tv-text-secondary, #8c8c8c)' }}>
              {hex.toUpperCase()}
            </span>
          </div>

          {allowAlpha && (
            <div className="tvs-color-alpha-row">
              <span>Opacità</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(alpha * 100)}
                onChange={(e) =>
                  onChange(formatHexAlpha(hex, Number(e.target.value) / 100, true))
                }
              />
              <span className="tv-num">{Math.round(alpha * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="tvs-checkbox-label">
      <input
        type="checkbox"
        className="tvs-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function ChartSettingsModal({ isOpen, onClose }: ChartSettingsModalProps) {
  const {
    modals,
    closeModal,
    theme,
    setTheme,
    chartSettings,
    updateChartSettings,
    resetChartSettings,
    liveCryptoEnabled,
    setLiveCryptoEnabled,
  } = useTradingView();
  const { activePane, activeSymbol, setChartType, updateActivePane } =
    useActivePane();

  const visible = isOpen ?? modals.settings;
  const closeSelf = useCallback(() => {
    if (onClose) onClose();
    else closeModal('settings');
  }, [closeModal, onClose]);

  const [tab, setTab] = useState<SettingsTab>('symbol');
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<SettingsSnapshot | null>(null);
  const wasVisibleRef = useRef(false);

  // Capture clean snapshot when dialog opens so `Annulla` reverts every live change
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      snapshotRef.current = {
        chartSettings: cloneSettings(chartSettings),
        theme,
        chartType: activePane.chartType,
        showVolume: activePane.showVolume,
        liveCryptoEnabled,
      };
      setTemplateMenuOpen(false);
    }
    wasVisibleRef.current = visible;
  }, [
    visible,
    chartSettings,
    theme,
    activePane.chartType,
    activePane.showVolume,
    liveCryptoEnabled,
  ]);

  useEffect(() => {
    if (!templateMenuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [templateMenuOpen]);

  const handleCancel = useCallback(() => {
    const snap = snapshotRef.current;
    if (snap) {
      setTheme(snap.theme);
      updateChartSettings(snap.chartSettings);
      setChartType(snap.chartType);
      updateActivePane({ showVolume: snap.showVolume });
      setLiveCryptoEnabled(snap.liveCryptoEnabled);
    }
    closeSelf();
  }, [
    closeSelf,
    setChartType,
    setLiveCryptoEnabled,
    setTheme,
    updateActivePane,
    updateChartSettings,
  ]);

  const handleConfirm = useCallback(() => {
    closeSelf();
  }, [closeSelf]);

  if (!visible) return null;

  const { symbol, statusLine, scales, canvas, trading, alerts } = chartSettings;
  const canonicalChartType = normalizeChartType(activePane.chartType);

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'symbol', label: 'Simbolo', icon: CandlestickChart },
    { id: 'statusLine', label: 'Linea di stato', icon: AlignLeft },
    { id: 'scales', label: 'Scale e linee', icon: Ruler },
    { id: 'canvas', label: 'Canvas', icon: Palette },
    { id: 'trading', label: 'Trading', icon: ArrowLeftRight },
    { id: 'alerts', label: 'Avvisi', icon: Bell },
  ];

  return (
    <div
      className="tvm-backdrop tvm-backdrop--live-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Impostazioni grafico"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleConfirm();
      }}
    >
      <div className="tvm-dialog tvm-dialog--lg">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <Settings size={18} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div>
              <h2 className="tvm-title">Impostazioni grafico</h2>
              <div className="tvm-subtitle">
                {activeSymbol.ticker} · {activePane.timeframe} · Anteprima dal vivo
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={handleConfirm}
          >
            <X size={18} />
          </button>
        </div>

        <div className="tvm-body tvm-body--flush">
          <div className="tvm-split">
            <aside
              className="tvm-sidebar"
              role="tablist"
              aria-label="Sezioni impostazioni grafico"
            >
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={`tvm-nav-btn ${tab === item.id ? 'is-active' : ''}`}
                    onClick={() => setTab(item.id)}
                  >
                    <span className="tvm-nav-btn-left">
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className="tvm-main-pane tvs-pane">
              {/* ================= TAB 1: SIMBOLO ================= */}
              {tab === 'symbol' && (
                <>
                  <div className="tvs-section-title">Tipo di grafico</div>
                  <div className="tvs-row">
                    <span className="tvs-row-label">Stile serie</span>
                    <select
                      aria-label="Tipo di grafico"
                      className="tvs-select"
                      value={canonicalChartType}
                      onChange={(e) => setChartType(e.target.value as ChartType)}
                    >
                      {CHART_TYPES_META.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.labelIt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tvs-section-title">Candele e barre</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Corpo</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore corpo rialzista"
                        value={symbol.candleUpColor}
                        onChange={(candleUpColor) =>
                          updateChartSettings({ symbol: { candleUpColor } })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore corpo ribassista"
                        value={symbol.candleDownColor}
                        onChange={(candleDownColor) =>
                          updateChartSettings({ symbol: { candleDownColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Bordi"
                      checked={symbol.showBorders}
                      onChange={(showBorders) =>
                        updateChartSettings({ symbol: { showBorders } })
                      }
                    />
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore bordo rialzista"
                        value={symbol.candleBorderUpColor}
                        disabled={!symbol.showBorders}
                        onChange={(candleBorderUpColor) =>
                          updateChartSettings({ symbol: { candleBorderUpColor } })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore bordo ribassista"
                        value={symbol.candleBorderDownColor}
                        disabled={!symbol.showBorders}
                        onChange={(candleBorderDownColor) =>
                          updateChartSettings({ symbol: { candleBorderDownColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Stoppini"
                      checked={symbol.showWicks}
                      onChange={(showWicks) =>
                        updateChartSettings({ symbol: { showWicks } })
                      }
                    />
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore stoppino rialzista"
                        value={symbol.candleWickUpColor}
                        disabled={!symbol.showWicks}
                        onChange={(candleWickUpColor) =>
                          updateChartSettings({ symbol: { candleWickUpColor } })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore stoppino ribassista"
                        value={symbol.candleWickDownColor}
                        disabled={!symbol.showWicks}
                        onChange={(candleWickDownColor) =>
                          updateChartSettings({ symbol: { candleWickDownColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Colora le barre in base alla chiusura precedente"
                      checked={symbol.colorBarsBasedOnPrevClose}
                      onChange={(colorBarsBasedOnPrevClose) =>
                        updateChartSettings({
                          symbol: { colorBarsBasedOnPrevClose },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Linea, Area e Baseline</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Linea</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore linea"
                        value={symbol.lineColor}
                        onChange={(lineColor) =>
                          updateChartSettings({ symbol: { lineColor } })
                        }
                      />
                      <select
                        aria-label="Spessore linea"
                        className="tvs-select tvs-select--compact"
                        value={symbol.lineWidth}
                        onChange={(e) =>
                          updateChartSettings({
                            symbol: { lineWidth: Number(e.target.value) },
                          })
                        }
                      >
                        {[1, 2, 3, 4].map((w) => (
                          <option key={w} value={w}>
                            {w}px
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Area (alto / basso)</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore superiore area"
                        value={symbol.areaTopColor}
                        allowAlpha
                        onChange={(areaTopColor) =>
                          updateChartSettings({ symbol: { areaTopColor } })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore inferiore area"
                        value={symbol.areaBottomColor}
                        allowAlpha
                        onChange={(areaBottomColor) =>
                          updateChartSettings({ symbol: { areaBottomColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Baseline (sopra / sotto)</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore superiore baseline"
                        value={symbol.baselineTopColor}
                        allowAlpha
                        onChange={(baselineTopColor) =>
                          updateChartSettings({ symbol: { baselineTopColor } })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore inferiore baseline"
                        value={symbol.baselineBottomColor}
                        allowAlpha
                        onChange={(baselineBottomColor) =>
                          updateChartSettings({ symbol: { baselineBottomColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-section-title">Dati e prezzo</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Linea dell'ultimo prezzo"
                      checked={symbol.showLastPriceLine}
                      onChange={(showLastPriceLine) =>
                        updateChartSettings({ symbol: { showLastPriceLine } })
                      }
                    />
                    <select
                      aria-label="Stile linea ultimo prezzo"
                      className="tvs-select tvs-select--compact"
                      disabled={!symbol.showLastPriceLine}
                      value={symbol.lastPriceLineStyle}
                      onChange={(e) =>
                        updateChartSettings({
                          symbol: {
                            lastPriceLineStyle: e.target.value as LineStyle,
                          },
                        })
                      }
                    >
                      <option value="dashed">Tratteggiata</option>
                      <option value="dotted">Punteggiata</option>
                      <option value="solid">Continua</option>
                    </select>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Precisione</span>
                    <select
                      aria-label="Precisione decimali"
                      className="tvs-select"
                      value={symbol.precision}
                      onChange={(e) =>
                        updateChartSettings({
                          symbol: {
                            precision: e.target.value as ChartPrecisionSetting,
                          },
                        })
                      }
                    >
                      <option value="default">Predefinita</option>
                      <option value="0">0 decimali</option>
                      <option value="1">1 decimale</option>
                      <option value="2">2 decimali</option>
                      <option value="4">4 decimali</option>
                      <option value="6">6 decimali</option>
                      <option value="8">8 decimali</option>
                    </select>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Fuso orario</span>
                    <select
                      aria-label="Fuso orario"
                      className="tvs-select"
                      value={symbol.timezone}
                      onChange={(e) =>
                        updateChartSettings({
                          symbol: {
                            timezone: e.target.value as ChartTimezoneSetting,
                          },
                        })
                      }
                    >
                      <option value="Europe/Rome">Europe/Rome (UTC+1)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Feed Live WebSocket Binance (Cripto)"
                      checked={liveCryptoEnabled}
                      onChange={(enabled) => setLiveCryptoEnabled(enabled)}
                    />
                  </div>
                </>
              )}

              {/* ================= TAB 2: LINEA DI STATO ================= */}
              {tab === 'statusLine' && (
                <>
                  <div className="tvs-section-title">Simbolo</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Logo"
                      checked={statusLine.showLogo}
                      onChange={(showLogo) =>
                        updateChartSettings({ statusLine: { showLogo } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Titoli</span>
                    <select
                      aria-label="Modalità titolo simbolo"
                      className="tvs-select"
                      value={statusLine.titleMode}
                      onChange={(e) =>
                        updateChartSettings({
                          statusLine: {
                            titleMode: e.target.value as StatusLineTitleMode,
                          },
                        })
                      }
                    >
                      <option value="ticker">Ticker</option>
                      <option value="description">Descrizione</option>
                      <option value="ticker_and_description">
                        Ticker e descrizione
                      </option>
                    </select>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Stato di apertura mercato"
                      checked={statusLine.showOpenMarketStatus}
                      onChange={(showOpenMarketStatus) =>
                        updateChartSettings({
                          statusLine: { showOpenMarketStatus },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valori OHLC"
                      checked={statusLine.showOhlc}
                      onChange={(showOhlc) =>
                        updateChartSettings({ statusLine: { showOhlc } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valori variazione barra"
                      checked={statusLine.showBarChange}
                      onChange={(showBarChange) =>
                        updateChartSettings({ statusLine: { showBarChange } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Volume"
                      checked={statusLine.showVolume}
                      onChange={(showVolume) => {
                        updateChartSettings({ statusLine: { showVolume } });
                        updateActivePane({ showVolume });
                      }}
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Pulsanti Acquista/Vendi"
                      checked={statusLine.showBuySellButtons}
                      onChange={(showBuySellButtons) =>
                        updateChartSettings({
                          statusLine: { showBuySellButtons },
                          trading: { showBuySellButtons },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Indicatori</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Titoli"
                      checked={statusLine.showIndicatorTitles}
                      onChange={(showIndicatorTitles) =>
                        updateChartSettings({
                          statusLine: { showIndicatorTitles },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Argomenti"
                      checked={statusLine.showIndicatorArguments}
                      onChange={(showIndicatorArguments) =>
                        updateChartSettings({
                          statusLine: { showIndicatorArguments },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valori"
                      checked={statusLine.showIndicatorValues}
                      onChange={(showIndicatorValues) =>
                        updateChartSettings({
                          statusLine: { showIndicatorValues },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Sfondo</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Opacità sfondo legenda</span>
                    <div className="tvs-range-wrap">
                      <input
                        type="range"
                        aria-label="Opacità sfondo linea di stato"
                        min={0}
                        max={100}
                        value={Math.round(statusLine.bgOpacity * 100)}
                        onChange={(e) =>
                          updateChartSettings({
                            statusLine: {
                              bgOpacity: Number(e.target.value) / 100,
                            },
                          })
                        }
                      />
                      <span className="tv-num tvs-range-val">
                        {Math.round(statusLine.bgOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ================= TAB 3: SCALE E LINEE ================= */}
              {tab === 'scales' && (
                <>
                  <div className="tvs-section-title">Asse prezzi</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Posizione scala prezzi</span>
                    <div className="tv-segmented" role="group" aria-label="Posizione scala prezzi">
                      {(
                        [
                          { id: 'left', label: 'Sinistra' },
                          { id: 'right', label: 'Destra' },
                        ] as { id: PriceScalePosition; label: string }[]
                      ).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          className={`tv-segmented-btn ${
                            scales.position === pos.id ? 'is-active' : ''
                          }`}
                          onClick={() =>
                            updateChartSettings({ scales: { position: pos.id } })
                          }
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Modalità scala</span>
                    <select
                      aria-label="Modalità scala"
                      className="tvs-select"
                      value={scales.mode}
                      onChange={(e) =>
                        updateChartSettings({
                          scales: { mode: e.target.value as ChartScaleMode },
                        })
                      }
                    >
                      <option value="regular">Regolare</option>
                      <option value="log">Logaritmica</option>
                      <option value="percent">Percentuale</option>
                      <option value="indexed100">Indicizzato a 100</option>
                    </select>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Inverti scala"
                      checked={scales.invertScale}
                      onChange={(invertScale) =>
                        updateChartSettings({ scales: { invertScale } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Blocca rapporto prezzo/barra"
                      checked={scales.lockPriceToBarRatio}
                      onChange={(lockPriceToBarRatio) =>
                        updateChartSettings({ scales: { lockPriceToBarRatio } })
                      }
                    />
                    {scales.lockPriceToBarRatio && (
                      <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        aria-label="Rapporto prezzo per barra"
                        className="tvs-num-input tv-num"
                        value={scales.priceToBarRatio}
                        onChange={(e) => {
                          const val = Number.parseFloat(e.target.value);
                          if (Number.isFinite(val) && val > 0) {
                            updateChartSettings({
                              scales: { priceToBarRatio: val },
                            });
                          }
                        }}
                      />
                    )}
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Scala solo sul grafico prezzi"
                      checked={scales.scalePriceChartOnly}
                      onChange={(scalePriceChartOnly) =>
                        updateChartSettings({ scales: { scalePriceChartOnly } })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Etichette</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Etichetta nome simbolo"
                      checked={scales.showSymbolNameLabel}
                      onChange={(showSymbolNameLabel) =>
                        updateChartSettings({ scales: { showSymbolNameLabel } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Ultimo valore simbolo"
                      checked={scales.showSymbolLastValueLabel}
                      onChange={(showSymbolLastValueLabel) =>
                        updateChartSettings({
                          scales: { showSymbolLastValueLabel },
                        })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valore massimo e minimo"
                      checked={scales.showHighLowLabels}
                      onChange={(showHighLowLabels) =>
                        updateChartSettings({ scales: { showHighLowLabels } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Etichette Bid e Ask"
                      checked={scales.showBidAskLabels}
                      onChange={(showBidAskLabels) =>
                        updateChartSettings({ scales: { showBidAskLabels } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Linee Bid e Ask"
                      checked={scales.showBidAskLines}
                      onChange={(showBidAskLines) =>
                        updateChartSettings({ scales: { showBidAskLines } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Nome indicatori"
                      checked={scales.showIndicatorNameLabels}
                      onChange={(showIndicatorNameLabels) =>
                        updateChartSettings({
                          scales: { showIndicatorNameLabels },
                        })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valore indicatori"
                      checked={scales.showIndicatorValueLabels}
                      onChange={(showIndicatorValueLabels) =>
                        updateChartSettings({
                          scales: { showIndicatorValueLabels },
                        })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Conto alla rovescia alla chiusura barra"
                      checked={scales.showCountdown}
                      onChange={(showCountdown) =>
                        updateChartSettings({ scales: { showCountdown } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Pulsante più (+)"
                      checked={scales.showPlusButton}
                      onChange={(showPlusButton) =>
                        updateChartSettings({ scales: { showPlusButton } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Nessuna etichetta sovrapposta"
                      checked={scales.noOverlappingLabels}
                      onChange={(noOverlappingLabels) =>
                        updateChartSettings({ scales: { noOverlappingLabels } })
                      }
                    />
                  </div>
                  <div className="tvs-row">
                    <CheckboxItem
                      label="Valuta e unità"
                      checked={scales.showCurrencyUnit}
                      onChange={(showCurrencyUnit) =>
                        updateChartSettings({ scales: { showCurrencyUnit } })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Asse temporale</div>
                  <div className="tvs-row">
                    <span className="tvs-row-label">Formato data</span>
                    <select
                      aria-label="Formato data"
                      className="tvs-select"
                      value={scales.dateFormat}
                      onChange={(e) =>
                        updateChartSettings({
                          scales: {
                            dateFormat: e.target.value as ChartDateFormat,
                          },
                        })
                      }
                    >
                      <option value="DD MMM">GG MMM (es. 25 Nov)</option>
                      <option value="YYYY-MM-DD">AAAA-MM-GG</option>
                      <option value="DD/MM/YYYY">GG/MM/AAAA</option>
                    </select>
                  </div>
                </>
              )}

              {/* ================= TAB 4: CANVAS ================= */}
              {tab === 'canvas' && (
                <>
                  <div className="tvs-section-title">Tema rapido</div>
                  <div className="tvm-theme-preview-grid" style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      className={`tvm-theme-card ${theme === 'dark' ? 'is-active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <div
                        className="tvm-theme-swatch"
                        style={{ backgroundColor: '#000000', height: 50 }}
                      >
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span style={{ width: 7, height: 15, borderRadius: 2, backgroundColor: '#089981' }} />
                          <span style={{ width: 7, height: 11, borderRadius: 2, backgroundColor: '#F23645', marginTop: 4 }} />
                          <span style={{ width: 7, height: 18, borderRadius: 2, backgroundColor: '#089981' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: 'var(--tv-text-heading, #fff)' }}>
                        <Moon size={14} />
                        <span>Scuro Obsidian</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`tvm-theme-card ${theme === 'light' ? 'is-active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <div
                        className="tvm-theme-swatch"
                        style={{ backgroundColor: '#ffffff', height: 50 }}
                      >
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span style={{ width: 7, height: 15, borderRadius: 2, backgroundColor: '#089981' }} />
                          <span style={{ width: 7, height: 11, borderRadius: 2, backgroundColor: '#F23645', marginTop: 4 }} />
                          <span style={{ width: 7, height: 18, borderRadius: 2, backgroundColor: '#089981' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: 'var(--tv-text-heading, #fff)' }}>
                        <Sun size={14} />
                        <span>Chiaro</span>
                      </div>
                    </button>
                  </div>

                  <div className="tvs-section-title">Aspetto grafico</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Sfondo</span>
                    <div className="tvs-inline-controls">
                      <select
                        aria-label="Tipo sfondo"
                        className="tvs-select tvs-select--compact"
                        value={canvas.bgType}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: {
                              bgType: e.target.value as 'solid' | 'gradient',
                            },
                          })
                        }
                      >
                        <option value="solid">Tinta unita</option>
                        <option value="gradient">Gradiente</option>
                      </select>
                      <ColorSwatchControl
                        label="Colore sfondo"
                        value={canvas.bgColor}
                        onChange={(bgColor) =>
                          updateChartSettings({ canvas: { bgColor } })
                        }
                      />
                      {canvas.bgType === 'gradient' && (
                        <ColorSwatchControl
                          label="Colore inferiore gradiente"
                          value={canvas.bgGradientEnd}
                          onChange={(bgGradientEnd) =>
                            updateChartSettings({ canvas: { bgGradientEnd } })
                          }
                        />
                      )}
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Linee griglia</span>
                    <div className="tvs-inline-controls">
                      <select
                        aria-label="Linee griglia"
                        className="tvs-select tvs-select--compact"
                        value={canvas.gridMode}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: {
                              gridMode: e.target.value as CanvasGridMode,
                            },
                          })
                        }
                      >
                        <option value="both">Entrambe</option>
                        <option value="vert">Verticali</option>
                        <option value="horz">Orizzontali</option>
                        <option value="none">Nessuna</option>
                      </select>
                      {(canvas.gridMode === 'both' ||
                        canvas.gridMode === 'vert') && (
                        <ColorSwatchControl
                          label="Colore griglia verticale"
                          value={canvas.vertGridColor}
                          allowAlpha
                          onChange={(vertGridColor) =>
                            updateChartSettings({ canvas: { vertGridColor } })
                          }
                        />
                      )}
                      {(canvas.gridMode === 'both' ||
                        canvas.gridMode === 'horz') && (
                        <ColorSwatchControl
                          label="Colore griglia orizzontale"
                          value={canvas.horzGridColor}
                          allowAlpha
                          onChange={(horzGridColor) =>
                            updateChartSettings({ canvas: { horzGridColor } })
                          }
                        />
                      )}
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Mirino</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore mirino"
                        value={canvas.crosshairColor}
                        onChange={(crosshairColor) =>
                          updateChartSettings({ canvas: { crosshairColor } })
                        }
                      />
                      <select
                        aria-label="Stile mirino"
                        className="tvs-select tvs-select--compact"
                        value={canvas.crosshairStyle}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: {
                              crosshairStyle: e.target.value as LineStyle,
                            },
                          })
                        }
                      >
                        <option value="dashed">Tratteggiata</option>
                        <option value="solid">Continua</option>
                        <option value="dotted">Punteggiata</option>
                      </select>
                      <select
                        aria-label="Spessore mirino"
                        className="tvs-select tvs-select--xs"
                        value={canvas.crosshairWidth}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: { crosshairWidth: Number(e.target.value) },
                          })
                        }
                      >
                        {[1, 2, 3].map((w) => (
                          <option key={w} value={w}>
                            {w}px
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Filigrana"
                      checked={canvas.showWatermark}
                      onChange={(showWatermark) =>
                        updateChartSettings({ canvas: { showWatermark } })
                      }
                    />
                    <div className="tvs-inline-controls">
                      <input
                        type="text"
                        aria-label="Testo filigrana personalizzato"
                        className="tvs-text-input"
                        disabled={!canvas.showWatermark}
                        value={canvas.watermarkText}
                        placeholder={`${activeSymbol.ticker} · ${activePane.timeframe}`}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: { watermarkText: e.target.value },
                          })
                        }
                      />
                      <ColorSwatchControl
                        label="Colore filigrana"
                        value={canvas.watermarkColor}
                        allowAlpha
                        disabled={!canvas.showWatermark}
                        onChange={(watermarkColor) =>
                          updateChartSettings({ canvas: { watermarkColor } })
                        }
                      />
                    </div>
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Testo scale</span>
                    <div className="tvs-inline-controls">
                      <ColorSwatchControl
                        label="Colore testo scale"
                        value={canvas.scaleTextColor}
                        onChange={(scaleTextColor) =>
                          updateChartSettings({ canvas: { scaleTextColor } })
                        }
                      />
                      <select
                        aria-label="Dimensione font scale"
                        className="tvs-select tvs-select--xs"
                        value={canvas.scaleFontSize}
                        onChange={(e) =>
                          updateChartSettings({
                            canvas: { scaleFontSize: Number(e.target.value) },
                          })
                        }
                      >
                        {[10, 11, 12, 13, 14].map((px) => (
                          <option key={px} value={px}>
                            {px}px
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="tvs-section-title">Margini</div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Superiore (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      aria-label="Margine superiore percentuale"
                      className="tvs-num-input tv-num"
                      value={canvas.topMarginPct}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(val)) {
                          updateChartSettings({
                            canvas: {
                              topMarginPct: Math.max(0, Math.min(40, val)),
                            },
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Inferiore (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      aria-label="Margine inferiore percentuale"
                      className="tvs-num-input tv-num"
                      value={canvas.bottomMarginPct}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(val)) {
                          updateChartSettings({
                            canvas: {
                              bottomMarginPct: Math.max(0, Math.min(40, val)),
                            },
                          });
                        }
                      }}
                    />
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Margine destro (barre)</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      aria-label="Margine destro in barre"
                      className="tvs-num-input tv-num"
                      value={canvas.rightMarginBars}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(val)) {
                          updateChartSettings({
                            canvas: {
                              rightMarginBars: Math.max(0, Math.min(60, val)),
                            },
                          });
                        }
                      }}
                    />
                  </div>
                </>
              )}

              {/* ================= TAB 5: TRADING ================= */}
              {tab === 'trading' && (
                <>
                  <div className="tvs-section-title">Ordini rapidi</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Pulsanti Acquista/Vendi"
                      checked={trading.showBuySellButtons}
                      onChange={(showBuySellButtons) =>
                        updateChartSettings({
                          trading: { showBuySellButtons },
                          statusLine: { showBuySellButtons },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Posizionamento ordini istantaneo"
                      checked={trading.instantOrderPlacement}
                      onChange={(instantOrderPlacement) =>
                        updateChartSettings({
                          trading: { instantOrderPlacement },
                        })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Aspetto sul grafico</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Posizioni sul grafico"
                      checked={trading.showPositions}
                      onChange={(showPositions) =>
                        updateChartSettings({ trading: { showPositions } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Ordini sul grafico"
                      checked={trading.showOrders}
                      onChange={(showOrders) =>
                        updateChartSettings({ trading: { showOrders } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Esecuzioni"
                      checked={trading.showExecutions}
                      onChange={(showExecutions) =>
                        updateChartSettings({ trading: { showExecutions } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Estendi linee a sinistra"
                      checked={trading.extendLinesLeft}
                      onChange={(extendLinesLeft) =>
                        updateChartSettings({ trading: { extendLinesLeft } })
                      }
                    />
                  </div>
                </>
              )}

              {/* ================= TAB 6: AVVISI ================= */}
              {tab === 'alerts' && (
                <>
                  <div className="tvs-section-title">Linee e visibilità</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Linee avvisi sul grafico"
                      checked={alerts.showAlertLines}
                      onChange={(showAlertLines) =>
                        updateChartSettings({ alerts: { showAlertLines } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Mostra solo avvisi attivi"
                      checked={alerts.onlyActiveAlerts}
                      onChange={(onlyActiveAlerts) =>
                        updateChartSettings({ alerts: { onlyActiveAlerts } })
                      }
                    />
                  </div>

                  <div className="tvs-row">
                    <span className="tvs-row-label">Colore linea avviso</span>
                    <ColorSwatchControl
                      label="Colore linea avviso"
                      value={alerts.alertLineColor}
                      onChange={(alertLineColor) =>
                        updateChartSettings({ alerts: { alertLineColor } })
                      }
                    />
                  </div>

                  <div className="tvs-section-title">Notifiche</div>

                  <div className="tvs-row">
                    <CheckboxItem
                      label="Notifiche toast"
                      checked={alerts.showToast}
                      onChange={(showToast) =>
                        updateChartSettings({ alerts: { showToast } })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Authentic TradingView Footer: Modello ▾ | Annulla | OK */}
        <div className="tvm-footer">
          <div className="tvs-template-wrap" ref={templateRef}>
            <button
              type="button"
              className="tvm-btn tvm-btn--secondary tvm-btn--sm"
              aria-haspopup="menu"
              aria-expanded={templateMenuOpen}
              onClick={() => setTemplateMenuOpen((prev) => !prev)}
            >
              <span>Modello</span>
              <ChevronDown size={14} />
            </button>

            {templateMenuOpen && (
              <div className="tvs-template-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="tvs-template-item"
                  onClick={() => {
                    resetChartSettings();
                    setTemplateMenuOpen(false);
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Applica impostazioni predefinite</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="tvs-template-item"
                  onClick={() => {
                    setTheme('dark');
                    resetChartSettings();
                    setTemplateMenuOpen(false);
                  }}
                >
                  <Moon size={14} />
                  <span>Predefinito Scuro Obsidian</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="tvs-template-item"
                  onClick={() => {
                    setTheme('light');
                    resetChartSettings();
                    setTemplateMenuOpen(false);
                  }}
                >
                  <Sun size={14} />
                  <span>Predefinito Chiaro</span>
                </button>
              </div>
            )}
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
              onClick={handleConfirm}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartSettingsModal;
