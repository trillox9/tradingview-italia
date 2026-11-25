import React, { useMemo, useState } from 'react';
import { ChevronRight, MessageSquare, Play, Rocket } from 'lucide-react';
import type { IndicatorType } from '../../types';
import { DEFAULT_INDICATOR_PRESETS } from '../../engine';
import { useTradingView } from '../../store';
import { IdeaChartPreviewSvg } from './SparklineSvg';

interface IndicatorShowcaseItem {
  id: string;
  title: string;
  author: string;
  kind: 'INDICATORE' | 'STRATEGIA';
  summary: string;
  boosts: number;
  comments: number;
  seed: number;
  accentColor: string;
  indicatorType?: IndicatorType;
  pineTemplateId?: string;
  editorsPick?: boolean;
}

const INDICATOR_SHOWCASE: IndicatorShowcaseItem[] = [
  {
    id: 'ind-supertrend',
    title: 'SuperTrend Adattivo ATR (10, 3)',
    author: 'QuantMilano',
    kind: 'INDICATORE',
    summary:
      'Identifica automaticamente il regime direzionale e posiziona stop dinamici basati su Average True Range sui listini europei e crypto.',
    boosts: 1510,
    comments: 44,
    seed: 2101,
    accentColor: '#089981',
    indicatorType: 'SUPERTREND',
    editorsPick: true,
  },
  {
    id: 'ind-bb-squeeze',
    title: 'Bande di Bollinger Volatility Squeeze',
    author: 'AlgoBorsaIT',
    kind: 'INDICATORE',
    summary:
      'Misura le fasi di compressione della volatilità (20, 2σ) per individuare in anticipo espansioni direzionali su FTSE MIB, NASDAQ e Bitcoin.',
    boosts: 982,
    comments: 29,
    seed: 2202,
    accentColor: '#2962FF',
    indicatorType: 'BB',
    editorsPick: true,
  },
  {
    id: 'strat-ema-cross',
    title: 'Strategia Incrocio EMA 9/21 (Pine v5)',
    author: 'PineStudio_IT',
    kind: 'STRATEGIA',
    summary:
      'Strategia completa in Pine Script con backtest istantaneo su curva equity, profit factor e drawdown massimo nello Strategy Tester.',
    boosts: 1245,
    comments: 61,
    seed: 2303,
    accentColor: '#FF9800',
    pineTemplateId: 'ema-cross-strategy',
    editorsPick: true,
  },
  {
    id: 'ind-ichimoku',
    title: 'Ichimoku Kinko Hyo — Nube Istituzionale',
    author: 'TokyoDesk_IT',
    kind: 'INDICATORE',
    summary:
      'Tenkan-sen, Kijun-sen e Kumo completa per valutare momentum, supporti dinamici e qualità del trend su tutti i timeframe.',
    boosts: 740,
    comments: 19,
    seed: 2404,
    accentColor: '#9C27B0',
    indicatorType: 'ICHIMOKU',
  },
  {
    id: 'strat-rsi-rev',
    title: 'Strategia RSI (14) Mean Reversion',
    author: 'ElenaQuant',
    kind: 'STRATEGIA',
    summary:
      'Sistema automatico su zone estreme 30/70 con livelli orizzontali e simulazione storico ordini direttamente sui Supercharts.',
    boosts: 618,
    comments: 23,
    seed: 2505,
    accentColor: '#00BCD4',
    pineTemplateId: 'rsi-mean-reversion',
  },
  {
    id: 'ind-macd-pro',
    title: 'MACD (12, 26, 9) + Istogramma Momentum',
    author: 'MacroWave',
    kind: 'INDICATORE',
    summary:
      'Divergenze di momentum e incroci della signal line con colorazione dinamica dell’istogramma in sotto-pannello dedicato.',
    boosts: 890,
    comments: 31,
    seed: 2606,
    accentColor: '#2962FF',
    indicatorType: 'MACD',
  },
];

export const IndicatorsSection: React.FC = () => {
  const {
    navigate,
    addIndicator,
    loadPineTemplate,
    applyPineToChart,
    setBottomPanel,
  } = useTradingView();

  const [tab, setTab] = useState<'editors' | 'popular'>('editors');
  const [boostedIds, setBoostedIds] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const sorted =
      tab === 'editors'
        ? INDICATOR_SHOWCASE.filter((x) => x.editorsPick).concat(
            INDICATOR_SHOWCASE.filter((x) => !x.editorsPick),
          )
        : [...INDICATOR_SHOWCASE].sort((a, b) => b.boosts - a.boosts);
    return sorted.slice(0, 3);
  }, [tab]);

  const handleTryOnChart = (item: IndicatorShowcaseItem) => {
    if (item.pineTemplateId) {
      loadPineTemplate(item.pineTemplateId);
      setBottomPanel('pine');
      navigate('chart');
      window.setTimeout(() => {
        applyPineToChart();
      }, 60);
      return;
    }

    if (item.indicatorType) {
      const preset = DEFAULT_INDICATOR_PRESETS.find((p) => p.type === item.indicatorType);
      if (preset) {
        addIndicator({
          ...preset,
          id: `${preset.type.toLowerCase()}-${Date.now()}`,
          visible: true,
        });
      }
    }
    navigate('chart');
  };

  return (
    <section id="home-indicators" className="tv-section" style={{ paddingTop: 12 }}>
      <div className="tv-container">
        <div className="tv-section-header">
          <button
            type="button"
            className="tv-section-heading"
            onClick={() => navigate('community')}
          >
            <span>Indicatori e strategie</span>
            <ChevronRight size={24} />
          </button>

          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('community')}
          >
            <span>Vedi tutti gli indicatori e strategie</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-tabs" role="tablist" style={{ marginBottom: 18 }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'editors'}
            className={`tv-tab${tab === 'editors' ? ' is-active' : ''}`}
            onClick={() => setTab('editors')}
          >
            Selezione editoriale
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'popular'}
            className={`tv-tab${tab === 'popular' ? ' is-active' : ''}`}
            onClick={() => setTab('popular')}
          >
            Popolari
          </button>
        </div>

        <div className="tv-ideas-grid">
          {visible.map((item) => {
            const boosted = Boolean(boostedIds[item.id]);
            const count = item.boosts + (boosted ? 1 : 0);

            return (
              <article key={item.id} className="tv-idea-card">
                <div
                  className="tv-idea-card__media"
                  onClick={() => handleTryOnChart(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTryOnChart(item);
                    }
                  }}
                >
                  <IdeaChartPreviewSvg
                    seed={item.seed}
                    mode="indicator"
                    accentColor={item.accentColor}
                  />

                  {item.editorsPick && (
                    <span className="tv-idea-card__ribbon" title="Selezione editoriale">
                      TV
                    </span>
                  )}

                  <span
                    className="tv-idea-card__badge-tr tv-indicator-badge"
                    style={
                      item.kind === 'STRATEGIA'
                        ? { backgroundColor: 'rgba(41,98,255,0.22)', color: '#90BFF9' }
                        : undefined
                    }
                  >
                    {item.kind}
                  </span>
                </div>

                <div className="tv-idea-card__body">
                  <button
                    type="button"
                    className="tv-idea-card__title tv-line-clamp-2"
                    onClick={() => handleTryOnChart(item)}
                  >
                    {item.title}
                  </button>

                  <p className="tv-idea-card__summary tv-line-clamp-3">{item.summary}</p>

                  <div className="tv-idea-card__footer">
                    <span style={{ fontSize: 12, color: 'var(--tv-text-secondary)' }}>
                      di <strong style={{ color: 'var(--tv-text-primary)' }}>{item.author}</strong>
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className="tv-num"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          color: 'var(--tv-text-secondary)',
                          marginRight: 4,
                        }}
                      >
                        <MessageSquare size={13} />
                        {item.comments}
                      </span>
                      <button
                        type="button"
                        className={`tv-boost-btn tv-num${boosted ? ' is-boosted' : ''}`}
                        onClick={() =>
                          setBoostedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        aria-pressed={boosted}
                      >
                        <Rocket size={13} />
                        <span>{count >= 1000 ? `${(count / 1000).toFixed(1)} K` : count}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary tv-btn-sm"
                    style={{ width: '100%', marginTop: 6 }}
                    onClick={() => handleTryOnChart(item)}
                  >
                    <Play size={13} />
                    <span>Prova sul grafico</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
