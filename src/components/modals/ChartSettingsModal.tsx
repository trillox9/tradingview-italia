import { useCallback, useState } from 'react';
import {
  Activity,
  BarChart2,
  CandlestickChart,
  Eye,
  Moon,
  Palette,
  RotateCcw,
  Ruler,
  Settings,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import type { ChartType } from '../../types';
import {
  useActivePane,
  useTradingView,
  type RangePreset,
  type ScaleMode,
} from '../../store';

export interface ChartSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type SettingsTab = 'symbol' | 'status' | 'scales' | 'appearance';

const CHART_TYPE_OPTIONS: {
  value: ChartType;
  label: string;
  desc: string;
}[] = [
  { value: 'candles', label: 'Candele', desc: 'Candele giapponesi classiche' },
  { value: 'hollow', label: 'Candele vuote', desc: 'Corpo vuoto su rialzi' },
  { value: 'bars', label: 'Barre OHLC', desc: 'Barre apertura/chiusura' },
  { value: 'line', label: 'Linea', desc: 'Linea su prezzo chiusura' },
  { value: 'area', label: 'Area', desc: 'Linea con sfumatura' },
  { value: 'baseline', label: 'Linea di base', desc: 'Sopra/sotto livello base' },
  { value: 'heikinAshi', label: 'Heikin Ashi', desc: 'Candele mediate anti-rumore' },
];

const SCALE_MODES: { value: ScaleMode; label: string; desc: string }[] = [
  {
    value: 'regular',
    label: 'Regolare',
    desc: 'Scala aritmetica lineare standard sui prezzi',
  },
  {
    value: 'log',
    label: 'Logaritmica',
    desc: 'Variazioni percentuali uguali occupano la stessa altezza',
  },
  {
    value: 'percent',
    label: 'Percentuale (%)',
    desc: 'Normalizza la performance a partire da 0% (ideale per confronti)',
  },
];

const RANGE_PRESETS: RangePreset[] = [
  '1D',
  '5D',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  '5Y',
  'ALL',
];

function SwitchControl({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="tvm-switch-row">
      <div className="tvm-switch-info">
        <span className="tvm-switch-title">{title}</span>
        <span className="tvm-switch-desc">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className="tvm-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="tvm-switch-thumb" />
      </button>
    </div>
  );
}

export function ChartSettingsModal({ isOpen, onClose }: ChartSettingsModalProps) {
  const {
    modals,
    closeModal,
    theme,
    setTheme,
    liveCryptoEnabled,
    setLiveCryptoEnabled,
  } = useTradingView();
  const {
    activePane,
    activeSymbol,
    setChartType,
    setScaleMode,
    toggleAutoScale,
    setRangePreset,
    updateActivePane,
  } = useActivePane();

  const visible = isOpen ?? modals.settings;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('settings');
  }, [closeModal, onClose]);

  const [tab, setTab] = useState<SettingsTab>('symbol');

  const handleResetDefaults = () => {
    updateActivePane({
      chartType: 'candles',
      scaleMode: 'regular',
      autoScale: true,
      showVolume: true,
      showGrid: true,
      showBuySellButtons: true,
      countdownVisible: true,
      rangePreset: '6M',
    });
  };

  if (!visible) return null;

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'symbol', label: 'Simbolo', icon: CandlestickChart },
    { id: 'status', label: 'Linea di stato', icon: Eye },
    { id: 'scales', label: 'Scale', icon: Ruler },
    { id: 'appearance', label: 'Aspetto', icon: Palette },
  ];

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Impostazioni grafico"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="tvm-dialog tvm-dialog--lg">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <Settings size={19} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div>
              <h2 className="tvm-title">Impostazioni grafico</h2>
              <div className="tvm-subtitle">
                Pannello attivo: {activeSymbol.ticker} · {activePane.timeframe}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="tvm-body tvm-body--flush">
          <div className="tvm-split">
            <aside className="tvm-sidebar" role="tablist" aria-label="Sezioni impostazioni">
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

            <div className="tvm-main-pane">
              {tab === 'symbol' && (
                <>
                  <div>
                    <div className="tvm-label" style={{ marginBottom: 10 }}>
                      Tipo di grafico
                    </div>
                    <div className="tvm-option-cards">
                      {CHART_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`tvm-option-card ${
                            activePane.chartType === opt.value ? 'is-active' : ''
                          }`}
                          onClick={() => setChartType(opt.value)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.84rem' }}>
                            {opt.value === 'line' || opt.value === 'area' ? (
                              <TrendingUp size={15} />
                            ) : opt.value === 'bars' ? (
                              <BarChart2 size={15} />
                            ) : (
                              <CandlestickChart size={15} />
                            )}
                            <span>{opt.label}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                            {opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <SwitchControl
                      title="Mostra istogramma Volume"
                      description="Visualizza i volumi scambiati nella parte inferiore del pannello principale."
                      checked={activePane.showVolume}
                      onChange={(showVolume) => updateActivePane({ showVolume })}
                    />
                    <SwitchControl
                      title="Colori candele TradingView"
                      description="Rialzista #089981 · Ribassista #F23645 (attivo di serie)"
                      checked={true}
                      onChange={() => {}}
                    />
                  </div>
                </>
              )}

              {tab === 'status' && (
                <div>
                  <SwitchControl
                    title="Pulsanti rapidi Acquista / Vendi"
                    description="Mostra i badge Bid/Ask cliccabili in alto a sinistra per inviare ordini Paper Trading istantanei."
                    checked={activePane.showBuySellButtons}
                    onChange={(showBuySellButtons) =>
                      updateActivePane({ showBuySellButtons })
                    }
                  />
                  <SwitchControl
                    title="Conto alla rovescia chiusura barra"
                    description="Visualizza sull’asse prezzi il tempo rimanente alla chiusura della candela corrente."
                    checked={activePane.countdownVisible}
                    onChange={(countdownVisible) =>
                      updateActivePane({ countdownVisible })
                    }
                  />
                  <SwitchControl
                    title="Feed WebSocket Binance Live (Cripto)"
                    description="Collega i prezzi cripto ai trade in tempo reale di Binance con fallback simulato automatico."
                    checked={liveCryptoEnabled}
                    onChange={(enabled) => setLiveCryptoEnabled(enabled)}
                  />
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: 'var(--tv-bg-primary, #131313)',
                      border: '1px solid var(--tv-border-subtle, #222222)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: '0.8rem',
                      color: 'var(--tv-text-secondary, #8c8c8c)',
                    }}
                  >
                    <Activity size={16} style={{ color: 'var(--tv-brand, #2962ff)', flexShrink: 0 }} />
                    <span>
                      Simbolo corrente: <strong style={{ color: 'var(--tv-text-heading, #fff)' }}>{activeSymbol.id}</strong> · Precisione: {activeSymbol.precision} decimali · Valuta: {activeSymbol.currency}
                    </span>
                  </div>
                </div>
              )}

              {tab === 'scales' && (
                <>
                  <div>
                    <div className="tvm-label" style={{ marginBottom: 10 }}>
                      Modalità scala prezzi
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {SCALE_MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          className={`tvm-option-card ${
                            activePane.scaleMode === m.value ? 'is-active' : ''
                          }`}
                          style={{ width: '100%' }}
                          onClick={() => setScaleMode(m.value)}
                        >
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{m.label}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                            {m.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <SwitchControl
                    title="Scala automatica (Auto)"
                    description="Adatta automaticamente l’asse verticale ai massimi e minimi delle candele visibili."
                    checked={activePane.autoScale}
                    onChange={() => toggleAutoScale()}
                  />

                  <div>
                    <div className="tvm-label" style={{ marginBottom: 8 }}>
                      Intervallo predefinito vista
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {RANGE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`tvm-filter-pill ${
                            activePane.rangePreset === preset ? 'is-active' : ''
                          }`}
                          onClick={() => setRangePreset(preset)}
                        >
                          {preset === 'ALL' ? 'Tutto' : preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'appearance' && (
                <>
                  <div>
                    <div className="tvm-label" style={{ marginBottom: 10 }}>
                      Tema dell’interfaccia
                    </div>
                    <div className="tvm-theme-preview-grid">
                      <button
                        type="button"
                        className={`tvm-theme-card ${theme === 'dark' ? 'is-active' : ''}`}
                        onClick={() => setTheme('dark')}
                      >
                        <div
                          className="tvm-theme-swatch"
                          style={{ backgroundColor: '#131722' }}
                        >
                          <div style={{ display: 'flex', gap: 5 }}>
                            <span style={{ width: 8, height: 18, borderRadius: 2, backgroundColor: '#089981' }} />
                            <span style={{ width: 8, height: 12, borderRadius: 2, backgroundColor: '#F23645', marginTop: 6 }} />
                            <span style={{ width: 8, height: 22, borderRadius: 2, backgroundColor: '#089981' }} />
                            <span style={{ width: 8, height: 16, borderRadius: 2, backgroundColor: '#2962FF', marginTop: 4 }} />
                          </div>
                          <span style={{ fontSize: '0.68rem', color: '#8c8c8c' }}>#131722 · #000000</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                          <Moon size={15} />
                          <span>Tema scuro</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`tvm-theme-card ${theme === 'light' ? 'is-active' : ''}`}
                        onClick={() => setTheme('light')}
                      >
                        <div
                          className="tvm-theme-swatch"
                          style={{ backgroundColor: '#ffffff' }}
                        >
                          <div style={{ display: 'flex', gap: 5 }}>
                            <span style={{ width: 8, height: 18, borderRadius: 2, backgroundColor: '#089981' }} />
                            <span style={{ width: 8, height: 12, borderRadius: 2, backgroundColor: '#F23645', marginTop: 6 }} />
                            <span style={{ width: 8, height: 22, borderRadius: 2, backgroundColor: '#089981' }} />
                            <span style={{ width: 8, height: 16, borderRadius: 2, backgroundColor: '#2962FF', marginTop: 4 }} />
                          </div>
                          <span style={{ fontSize: '0.68rem', color: '#707070' }}>#FFFFFF · #F9F9F9</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                          <Sun size={15} />
                          <span>Tema chiaro</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <SwitchControl
                    title="Mostra linee della griglia"
                    description="Visualizza la griglia orizzontale e verticale sullo sfondo del grafico."
                    checked={activePane.showGrid}
                    onChange={(showGrid) => updateActivePane({ showGrid })}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="tvm-footer">
          <button
            type="button"
            className="tvm-btn tvm-btn--ghost"
            onClick={handleResetDefaults}
          >
            <RotateCcw size={14} />
            Ripristina predefiniti
          </button>
          <div className="tvm-footer-actions">
            <button type="button" className="tvm-btn tvm-btn--primary" onClick={handleClose}>
              Fatto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartSettingsModal;
