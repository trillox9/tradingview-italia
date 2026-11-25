import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  Code2,
  Layers,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import type { IndicatorConfig, IndicatorType } from '../../types';
import { DEFAULT_INDICATOR_PRESETS, PINE_TEMPLATES } from '../../engine';
import { useActivePane, useTradingView } from '../../store';

export interface IndicatorsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type IndicatorCategory =
  | 'all'
  | 'favorites'
  | 'overlays'
  | 'oscillators'
  | 'volatility'
  | 'volume'
  | 'pine';

const FAV_STORAGE_KEY = 'tv_it_fav_indicators_v1';

const OVERLAY_TYPES = new Set<IndicatorType>([
  'SMA',
  'EMA',
  'WMA',
  'VWAP',
  'SUPERTREND',
  'ICHIMOKU',
  'PIVOT',
]);
const OSCILLATOR_TYPES = new Set<IndicatorType>(['RSI', 'MACD', 'STOCH']);
const VOLATILITY_TYPES = new Set<IndicatorType>(['BB', 'ATR', 'SUPERTREND']);
const VOLUME_TYPES = new Set<IndicatorType>(['VOLUME', 'VWAP']);

const INDICATOR_DESCRIPTIONS_IT: Record<IndicatorType, string> = {
  SMA: 'Media aritmetica dei prezzi di chiusura su un periodo configurabile.',
  EMA: 'Media mobile esponenziale con peso maggiore sulle barre recenti.',
  WMA: 'Media mobile ponderata linearmente per reagire più velocemente ai trend.',
  BB: 'Canale di volatilità basato su SMA(20) ± 2 deviazioni standard.',
  VWAP: 'Prezzo medio ponderato per i volumi intraday — riferimento istituzionale.',
  RSI: 'Oscillatore di momentum 0-100 per aree di ipercomprato (>70) e ipervenduto (<30).',
  MACD: 'Convergenza/divergenza tra medie mobili esponenziali (12, 26, 9).',
  STOCH: 'Oscillatore Stocastico (%K / %D) per individuare punti di inversione.',
  ATR: 'Average True Range — misura l’ampiezza media della volatilità per barra.',
  SUPERTREND: 'Indicatore direzionale trend-following dinamico basato su ATR.',
  ICHIMOKU: 'Sistema completo giapponese con nube Kumo, Tenkan-sen e Kijun-sen.',
  PIVOT: 'Livelli statici di supporto (S1-S3) e resistenza (R1-R3) dalla sessione precedente.',
  VOLUME: 'Istogramma dei volumi scambiati per barra, colorato per direzione candela.',
};

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return ['preset-sma-20', 'preset-rsi', 'preset-macd'];
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return ['preset-sma-20', 'preset-rsi', 'preset-macd'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function formatParamsSummary(params: Record<string, number | string>): string {
  const vals = Object.values(params);
  return vals.length > 0 ? `(${vals.join(', ')})` : '';
}

export function IndicatorsModal({ isOpen, onClose }: IndicatorsModalProps) {
  const {
    modals,
    closeModal,
    applyPineToChart,
    pineAppliedToChart,
    pineResult,
    clearPineFromChart,
    setBottomPanel,
  } = useTradingView();
  const { activePane, addIndicator, removeIndicator } = useActivePane();

  const visible = isOpen ?? modals.indicators;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('indicators');
  }, [closeModal, onClose]);

  const [category, setCategory] = useState<IndicatorCategory>('all');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // ignore storage errors
    }
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const clonePreset = useCallback((preset: IndicatorConfig): IndicatorConfig => {
    return {
      ...preset,
      id: `${preset.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      params: { ...preset.params },
      styles: Object.fromEntries(
        Object.entries(preset.styles).map(([k, v]) => [k, { ...v }]),
      ),
    };
  }, []);

  const handleTogglePreset = useCallback(
    (preset: IndicatorConfig) => {
      const existing = activePane.indicators.find((i) => i.type === preset.type);
      if (existing) {
        removeIndicator(existing.id);
      } else {
        addIndicator(clonePreset(preset));
      }
    },
    [activePane.indicators, addIndicator, clonePreset, removeIndicator],
  );

  const handleAddAnother = useCallback(
    (preset: IndicatorConfig) => {
      const countSame = activePane.indicators.filter(
        (i) => i.type === preset.type,
      ).length;
      const cloned = clonePreset(preset);
      // Vary default period slightly when adding a second MA for convenience
      if ((cloned.type === 'SMA' || cloned.type === 'EMA') && countSame > 0) {
        const nextPeriods = [50, 100, 200, 9, 21];
        cloned.params.period = nextPeriods[(countSame - 1) % nextPeriods.length];
      }
      addIndicator(cloned);
    },
    [activePane.indicators, addIndicator, clonePreset],
  );

  const filteredPresets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DEFAULT_INDICATOR_PRESETS.filter((preset) => {
      if (category === 'favorites' && !favorites.includes(preset.id)) return false;
      if (category === 'overlays' && !OVERLAY_TYPES.has(preset.type)) return false;
      if (category === 'oscillators' && !OSCILLATOR_TYPES.has(preset.type)) return false;
      if (category === 'volatility' && !VOLATILITY_TYPES.has(preset.type)) return false;
      if (category === 'volume' && !VOLUME_TYPES.has(preset.type)) return false;
      if (category === 'pine') return false;
      if (!q) return true;
      return (
        preset.name.toLowerCase().includes(q) ||
        preset.type.toLowerCase().includes(q) ||
        (preset.shortName ?? '').toLowerCase().includes(q) ||
        INDICATOR_DESCRIPTIONS_IT[preset.type].toLowerCase().includes(q)
      );
    });
  }, [category, favorites, search]);

  const filteredPine = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (category !== 'pine' && category !== 'all' && category !== 'favorites') {
      return [];
    }
    return PINE_TEMPLATES.filter((tpl) => {
      if (category === 'favorites' && !favorites.includes(`pine-${tpl.id}`)) {
        return false;
      }
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q)
      );
    });
  }, [category, favorites, search]);

  if (!visible) return null;

  const totalActiveCount =
    activePane.indicators.length + (pineAppliedToChart ? 1 : 0);

  const categories: {
    id: IndicatorCategory;
    label: string;
    icon: typeof Layers;
    count?: number;
  }[] = [
    { id: 'all', label: 'Tutti', icon: Sparkles, count: DEFAULT_INDICATOR_PRESETS.length + PINE_TEMPLATES.length },
    { id: 'favorites', label: 'Preferiti', icon: Star, count: favorites.length },
    { id: 'overlays', label: 'Sovrapposizioni', icon: Layers },
    { id: 'oscillators', label: 'Oscillatori', icon: Activity },
    { id: 'volatility', label: 'Volatilità', icon: Waves },
    { id: 'volume', label: 'Volume', icon: BarChart3 },
    { id: 'pine', label: 'Script Pine', icon: Code2, count: PINE_TEMPLATES.length },
  ];

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Indicatori, metriche e strategie"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="tvm-dialog tvm-dialog--lg">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <h2 className="tvm-title">Indicatori, metriche e strategie</h2>
            <span className="tvm-count-badge" style={{ backgroundColor: 'var(--tv-brand, #2962ff)', color: '#fff' }}>
              {totalActiveCount} attivi
            </span>
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
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--tv-border, #303030)' }}>
            <div className="tvm-search-wrap">
              <Search size={16} />
              <input
                type="text"
                className="tvm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca indicatori tecnici, oscillatori o script Pine..."
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="tvm-close-btn"
                  style={{ width: 24, height: 24 }}
                  onClick={() => setSearch('')}
                  aria-label="Cancella ricerca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="tvm-split">
            <aside className="tvm-sidebar" aria-label="Categorie indicatori">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`tvm-nav-btn ${category === cat.id ? 'is-active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className="tvm-nav-btn-left">
                      <Icon size={15} />
                      <span>{cat.label}</span>
                    </span>
                    {cat.count !== undefined && (
                      <span className="tvm-count-badge">{cat.count}</span>
                    )}
                  </button>
                );
              })}
            </aside>

            <div className="tvm-main-pane">
              {totalActiveCount > 0 && (
                <div className="tvm-active-strip">
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tv-text-secondary, #8c8c8c)', marginRight: 4 }}>
                    ATTIVI SUL GRAFICO:
                  </span>
                  {activePane.indicators.map((ind) => (
                    <span key={ind.id} className="tvm-active-chip">
                      <span>
                        {ind.shortName ?? ind.type} {formatParamsSummary(ind.params)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Rimuovi ${ind.name}`}
                        onClick={() => removeIndicator(ind.id)}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {pineAppliedToChart && pineResult && (
                    <span className="tvm-active-chip" style={{ backgroundColor: 'rgba(8, 153, 129, 0.18)', color: 'var(--tv-up, #22ab94)' }}>
                      <span>Pine: {pineResult.scriptName}</span>
                      <button
                        type="button"
                        aria-label="Rimuovi script Pine"
                        onClick={() => clearPineFromChart()}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {filteredPresets.length === 0 && filteredPine.length === 0 ? (
                <div className="tvp-empty-state">
                  <Activity size={28} />
                  <div>Nessun indicatore trovato in questa categoria.</div>
                </div>
              ) : (
                <>
                  {filteredPresets.map((preset) => {
                    const activeInstances = activePane.indicators.filter(
                      (i) => i.type === preset.type,
                    );
                    const isApplied = activeInstances.length > 0;
                    const isFav = favorites.includes(preset.id);

                    return (
                      <div
                        key={preset.id}
                        className={`tvm-indicator-row ${isApplied ? 'is-applied' : ''}`}
                        onClick={() => handleTogglePreset(preset)}
                      >
                        <div className="tvm-symbol-left" style={{ gap: 10 }}>
                          <button
                            type="button"
                            className={`tvm-star-btn ${isFav ? 'is-fav' : ''}`}
                            aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(preset.id);
                            }}
                          >
                            <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          <div className="tvm-symbol-meta">
                            <div className="tvm-symbol-ticker-line">
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.88rem',
                                  color: 'var(--tv-text-heading, #ffffff)',
                                }}
                              >
                                {preset.name}
                              </span>
                              <span className="tvm-asset-tag">
                                {preset.pane === 'overlay' ? 'Sovrapposizione' : 'Oscillatore'}
                              </span>
                              {activeInstances.length > 0 && (
                                <span
                                  className="tvm-asset-tag"
                                  style={{
                                    backgroundColor: 'var(--tv-brand, #2962ff)',
                                    color: '#ffffff',
                                  }}
                                >
                                  ×{activeInstances.length}
                                </span>
                              )}
                            </div>
                            <span className="tvm-symbol-name" style={{ whiteSpace: 'normal', fontSize: '0.76rem' }}>
                              {INDICATOR_DESCRIPTIONS_IT[preset.type]}
                            </span>
                          </div>
                        </div>

                        <div
                          className="tvm-row-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isApplied ? (
                            <>
                              <button
                                type="button"
                                className="tvm-btn tvm-btn--sm tvm-btn--secondary"
                                title="Aggiungi un’altra istanza"
                                onClick={() => handleAddAnother(preset)}
                              >
                                <Plus size={13} />
                              </button>
                              <button
                                type="button"
                                className="tvm-btn tvm-btn--sm tvm-btn--danger"
                                onClick={() => removeIndicator(activeInstances[0].id)}
                              >
                                <Trash2 size={13} />
                                Rimuovi
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="tvm-btn tvm-btn--sm tvm-btn--primary"
                              onClick={() => handleTogglePreset(preset)}
                            >
                              <Plus size={13} />
                              Aggiungi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredPine.length > 0 && (
                    <>
                      {filteredPresets.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--tv-text-muted, #8c8c8c)',
                            paddingTop: 8,
                          }}
                        >
                          Script Pine v5 della Community
                        </div>
                      )}
                      {filteredPine.map((tpl) => {
                        const favId = `pine-${tpl.id}`;
                        const isFav = favorites.includes(favId);
                        const isActivePine =
                          pineAppliedToChart &&
                          pineResult?.scriptName
                            .toLowerCase()
                            .includes(tpl.name.split(' ')[1]?.toLowerCase() ?? '___');

                        return (
                          <div
                            key={tpl.id}
                            className={`tvm-indicator-row ${isActivePine ? 'is-applied' : ''}`}
                            onClick={() => {
                              applyPineToChart(tpl.code);
                              setBottomPanel(tpl.isStrategy ? 'strategy' : 'pine');
                            }}
                          >
                            <div className="tvm-symbol-left" style={{ gap: 10 }}>
                              <button
                                type="button"
                                className={`tvm-star-btn ${isFav ? 'is-fav' : ''}`}
                                aria-label="Preferito"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(favId);
                                }}
                              >
                                <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                              </button>
                              <div className="tvm-symbol-meta">
                                <div className="tvm-symbol-ticker-line">
                                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--tv-text-heading, #ffffff)' }}>
                                    {tpl.name}
                                  </span>
                                  <span
                                    className="tvm-asset-tag"
                                    style={{
                                      backgroundColor: tpl.isStrategy
                                        ? 'rgba(41, 98, 255, 0.2)'
                                        : 'rgba(8, 153, 129, 0.2)',
                                      color: tpl.isStrategy
                                        ? 'var(--tv-link, #5b9cf6)'
                                        : 'var(--tv-up, #22ab94)',
                                    }}
                                  >
                                    {tpl.isStrategy ? 'STRATEGIA PINE' : 'INDICATORE PINE'}
                                  </span>
                                </div>
                                <span className="tvm-symbol-name" style={{ whiteSpace: 'normal', fontSize: '0.76rem' }}>
                                  {tpl.description}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`tvm-btn tvm-btn--sm ${isActivePine ? 'tvm-btn--success' : 'tvm-btn--secondary'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyPineToChart(tpl.code);
                                setBottomPanel(tpl.isStrategy ? 'strategy' : 'pine');
                              }}
                            >
                              {isActivePine ? <Check size={13} /> : <Code2 size={13} />}
                              {isActivePine ? 'Attivo' : 'Applica'}
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="tvm-footer">
          <span className="tvm-subtitle">
            Clicca su un indicatore per aggiungerlo o rimuoverlo istantaneamente dal pannello attivo.
          </span>
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

export default IndicatorsModal;
