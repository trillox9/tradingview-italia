import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { NewsItem } from '../../types';
import { FINANCIAL_NEWS } from '../../data';
import { useActivePane } from '../../store';

const CATEGORY_LABELS: Record<NewsItem['category'] | 'all', string> = {
  all: 'Tutte',
  mercati: 'Mercati',
  macro: 'Macro',
  azioni: 'Azioni',
  cripto: 'Cripto',
  forex: 'Forex',
  'materie-prime': 'Materie prime',
};

export function NewsPanel() {
  const { activeSymbol, setSymbol } = useActivePane();

  const [scope, setScope] = useState<'symbol' | 'all'>('all');
  const [category, setCategory] = useState<NewsItem['category'] | 'all'>('all');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const items = useMemo(() => {
    return FINANCIAL_NEWS.filter((item) => {
      if (
        scope === 'symbol' &&
        !item.relatedTickers.includes(activeSymbol.ticker)
      ) {
        return false;
      }
      if (category !== 'all' && item.category !== category) {
        return false;
      }
      return true;
    });
  }, [scope, category, activeSymbol.ticker]);

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Notizie finanziarie</h3>
      </div>

      <div className="tv-panel-tabs">
        <button
          type="button"
          className={`tv-panel-tab${scope === 'symbol' ? ' is-active' : ''}`}
          onClick={() => setScope('symbol')}
        >
          {activeSymbol.ticker}
        </button>
        <button
          type="button"
          className={`tv-panel-tab${scope === 'all' ? ' is-active' : ''}`}
          onClick={() => setScope('all')}
        >
          Tutti i mercati
        </button>
      </div>

      <div className="tv-chip-row">
        {(
          ['all', 'mercati', 'macro', 'azioni', 'cripto', 'forex', 'materie-prime'] as const
        ).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`tv-chip${category === cat ? ' is-active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {selectedNews && (
        <div className="tv-news-preview">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span className="tv-badge-pill is-brand">
              {selectedNews.source} • {selectedNews.publishedAgo}
            </span>
            <button
              type="button"
              className="tv-panel-icon-btn"
              aria-label="Chiudi anteprima articolo"
              onClick={() => setSelectedNews(null)}
            >
              <X size={14} />
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--tv-text-heading, #fff)',
              lineHeight: 1.35,
            }}
          >
            {selectedNews.title}
          </div>
          <p
            style={{
              margin: '6px 0 8px',
              fontSize: 11.5,
              lineHeight: 1.45,
              color: 'var(--tv-text-secondary, #8c8c8c)',
            }}
          >
            {selectedNews.summary}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {selectedNews.relatedTickers.map((t) => (
              <button
                key={t}
                type="button"
                className="tv-chip"
                onClick={() => setSymbol(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tv-panel-body">
        {items.length === 0 ? (
          <div className="tv-empty-state">
            Nessuna notizia recente per <strong>{activeSymbol.ticker}</strong>. Passa a{' '}
            <em>Tutti i mercati</em> per leggere il flusso completo.
          </div>
        ) : (
          items.map((item) => {
            const sentimentBadge =
              item.sentiment === 'positive'
                ? 'is-up'
                : item.sentiment === 'negative'
                  ? 'is-down'
                  : '';
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className="tv-list-card"
                style={{
                  cursor: 'pointer',
                  background:
                    selectedNews?.id === item.id
                      ? 'var(--tv-brand-soft, #132042)'
                      : undefined,
                }}
                onClick={() => setSelectedNews(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNews(item);
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      color: 'var(--tv-text-muted, #707070)',
                    }}
                  >
                    {item.source} • {item.publishedAgo}
                  </span>
                  <span className={`tv-badge-pill ${sentimentBadge}`}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--tv-text-heading, #fff)',
                    lineHeight: 1.35,
                  }}
                >
                  {item.title}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {item.relatedTickers.slice(0, 4).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="tv-badge-pill is-brand"
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSymbol(t);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
