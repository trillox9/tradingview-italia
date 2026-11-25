import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, MessageSquare, Rocket } from 'lucide-react';
import { MARKET_IDEAS } from '../../data';
import { useTradingView } from '../../store';
import { IdeaChartPreviewSvg } from './SparklineSvg';

type IdeasFilter = 'editors' | 'popular';

export const CommunityIdeasSection: React.FC = () => {
  const { navigate, openSymbolInChart } = useTradingView();
  const [filter, setFilter] = useState<IdeasFilter>('editors');
  const [boostedIds, setBoostedIds] = useState<Record<string, boolean>>({});

  const visibleIdeas = useMemo(() => {
    const base =
      filter === 'editors'
        ? MARKET_IDEAS.filter((i) => i.isEditorsPick).concat(
            MARKET_IDEAS.filter((i) => !i.isEditorsPick),
          )
        : [...MARKET_IDEAS].sort((a, b) => b.likes - a.likes);
    return base.slice(0, 6);
  }, [filter]);

  const toggleBoost = (id: string) => {
    setBoostedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section id="home-ideas" className="tv-section">
      <div className="tv-container">
        <div className="tv-section-header">
          <button
            type="button"
            className="tv-section-heading"
            onClick={() => navigate('community')}
          >
            <span>Idee della community</span>
            <ChevronRight size={24} />
          </button>

          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('community')}
          >
            <span>Vedi tutte le idee selezionate</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-tabs" role="tablist" style={{ marginBottom: 18 }}>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'editors'}
            className={`tv-tab${filter === 'editors' ? ' is-active' : ''}`}
            onClick={() => setFilter('editors')}
          >
            Selezione editoriale
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'popular'}
            className={`tv-tab${filter === 'popular' ? ' is-active' : ''}`}
            onClick={() => setFilter('popular')}
          >
            Popolari
          </button>
        </div>

        <div className="tv-ideas-grid">
          {visibleIdeas.map((idea) => {
            const boosted = Boolean(boostedIds[idea.id]);
            const likesCount = idea.likes + (boosted ? 1 : 0);

            return (
              <article key={idea.id} className="tv-idea-card">
                <div
                  className="tv-idea-card__media"
                  onClick={() => openSymbolInChart(idea.symbol)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openSymbolInChart(idea.symbol);
                    }
                  }}
                >
                  <IdeaChartPreviewSvg
                    seed={idea.chartSeed}
                    direction={idea.direction}
                    mode="idea"
                  />

                  {idea.isEditorsPick && (
                    <span className="tv-idea-card__ribbon" title="Selezione editoriale">
                      TV
                    </span>
                  )}

                  <div className="tv-idea-card__badges-bottom" style={{ gap: 8 }}>
                    {idea.direction === 'LONG' && (
                      <span
                        className="tv-long-badge"
                        title="Long"
                        style={{ flexShrink: 0 }}
                      >
                        <ArrowUpRight size={14} />
                      </span>
                    )}
                    {idea.direction === 'SHORT' && (
                      <span
                        className="tv-short-badge"
                        title="Short"
                        style={{ flexShrink: 0 }}
                      >
                        <ArrowDownRight size={14} />
                      </span>
                    )}
                    {idea.direction === 'NEUTRALE' && (
                      <span className="tv-micro-badge" style={{ flexShrink: 0 }}>
                        NEUTRALE
                      </span>
                    )}
                    <span
                      className="tv-ticker-pill"
                      style={{
                        backgroundColor: 'rgba(19, 23, 34, 0.92)',
                        color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.16)',
                        flexShrink: 0,
                      }}
                    >
                      {idea.symbol} · {idea.timeframe}
                    </span>
                  </div>
                </div>

                <div className="tv-idea-card__body">
                  <button
                    type="button"
                    className="tv-idea-card__title tv-line-clamp-2"
                    onClick={() => openSymbolInChart(idea.symbol)}
                  >
                    {idea.title}
                  </button>

                  <p className="tv-idea-card__summary tv-line-clamp-3">{idea.summary}</p>

                  <div className="tv-idea-card__footer">
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--tv-text-primary)',
                        }}
                      >
                        <span>di {idea.author}</span>
                        {idea.authorBadge && (
                          <span className="tv-micro-badge">{idea.authorBadge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--tv-text-muted)', marginTop: 2 }}>
                        {idea.publishedAgo}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="tv-btn tv-btn-ghost tv-btn-sm tv-num"
                        style={{ color: 'var(--tv-text-secondary)' }}
                        onClick={() => navigate('community')}
                        aria-label={`${idea.comments} commenti`}
                      >
                        <MessageSquare size={14} />
                        <span>{idea.comments}</span>
                      </button>

                      <button
                        type="button"
                        className={`tv-boost-btn tv-num${boosted ? ' is-boosted' : ''}`}
                        onClick={() => toggleBoost(idea.id)}
                        aria-pressed={boosted}
                        aria-label={`Boost ${likesCount}`}
                      >
                        <Rocket size={14} />
                        <span>{likesCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
