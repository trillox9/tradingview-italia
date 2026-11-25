import { useMemo, useState } from 'react';
import {
  SYMBOLS,
  formatPercent,
  formatPrice,
  formatVolume,
} from '../../data';
import { useActivePane, useQuotes } from '../../store';

type HotlistMode = 'gainers' | 'losers' | 'active';
type MarketFilter = 'all' | 'italian' | 'us' | 'crypto';

export function HotlistsPanel() {
  const { quotes } = useQuotes();
  const { activeSymbol, setSymbol } = useActivePane();

  const [mode, setMode] = useState<HotlistMode>('gainers');
  const [market, setMarket] = useState<MarketFilter>('all');

  const rows = useMemo(() => {
    const filtered = SYMBOLS.filter((s) => {
      if (market === 'italian') return s.assetClass === 'stock' && s.country === 'IT';
      if (market === 'us') return s.assetClass === 'stock' && s.country === 'US';
      if (market === 'crypto') return s.assetClass === 'crypto';
      return true;
    }).map((sym) => {
      const q = quotes[sym.ticker];
      const price = q?.price ?? sym.basePrice;
      const changePercent =
        q?.changePercent ??
        ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
      const volume = q?.volume ?? sym.avgVolume;
      const relVol = sym.avgVolume > 0 ? volume / sym.avgVolume : 1;
      return { sym, price, changePercent, volume, relVol };
    });

    if (mode === 'gainers') {
      return filtered.sort((a, b) => b.changePercent - a.changePercent).slice(0, 18);
    }
    if (mode === 'losers') {
      return filtered.sort((a, b) => a.changePercent - b.changePercent).slice(0, 18);
    }
    return filtered.sort((a, b) => b.volume - a.volume).slice(0, 18);
  }, [quotes, mode, market]);

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Hotlist di mercato</h3>
      </div>

      <div className="tv-panel-tabs">
        <button
          type="button"
          className={`tv-panel-tab${mode === 'gainers' ? ' is-active' : ''}`}
          onClick={() => setMode('gainers')}
        >
          Rialzi
        </button>
        <button
          type="button"
          className={`tv-panel-tab${mode === 'losers' ? ' is-active' : ''}`}
          onClick={() => setMode('losers')}
        >
          Ribassi
        </button>
        <button
          type="button"
          className={`tv-panel-tab${mode === 'active' ? ' is-active' : ''}`}
          onClick={() => setMode('active')}
        >
          Più attivi
        </button>
      </div>

      <div className="tv-chip-row">
        {(
          [
            ['all', 'Tutti'],
            ['italian', 'Italia MIL'],
            ['us', 'USA'],
            ['crypto', 'Cripto'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tv-chip${market === key ? ' is-active' : ''}`}
            onClick={() => setMarket(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tv-panel-body">
        {rows.map(({ sym, price, changePercent, volume }) => {
          const isUp = changePercent >= 0;
          const isSelected = sym.ticker === activeSymbol.ticker;
          return (
            <div
              key={sym.ticker}
              role="button"
              tabIndex={0}
              className={`tv-list-card${isSelected ? ' is-selected' : ''}`}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: isSelected ? 'var(--tv-brand-soft, #132042)' : undefined,
              }}
              onClick={() => setSymbol(sym.ticker)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSymbol(sym.ticker);
                }
              }}
            >
              <div className="tv-wl-sym-cell">
                <span
                  className="tv-ticker-badge"
                  style={{ backgroundColor: sym.logoColor }}
                >
                  {sym.logoText}
                </span>
                <div className="tv-wl-sym-meta">
                  <span className="tv-wl-ticker">{sym.ticker}</span>
                  <span className="tv-wl-exchange">
                    {sym.shortName} • {sym.exchange}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="tv-wl-price tv-num">
                  {formatPrice(price, sym.precision)}
                </div>
                <div
                  className={`tv-num ${mode === 'active' ? 'tv-val-neutral' : isUp ? 'tv-val-up' : 'tv-val-down'}`}
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {mode === 'active'
                    ? `Vol ${formatVolume(volume)}`
                    : formatPercent(changePercent)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
