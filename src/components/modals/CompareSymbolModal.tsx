import { useCallback, useMemo, useState } from 'react';
import { Check, GitCompareArrows, Percent, Plus, Search, X } from 'lucide-react';
import {
  formatPercent,
  formatPrice,
  getSymbolByTicker,
  searchSymbols,
} from '../../data';
import { useActivePane, useQuotes, useTradingView } from '../../store';

export interface CompareSymbolModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const COMPARE_PALETTE = [
  '#FF9800',
  '#E91E63',
  '#00BCD4',
  '#AB47BC',
  '#4CAF50',
  '#FACC15',
  '#38BDF8',
];

const QUICK_BENCHMARKS = [
  'SPX',
  'NDX',
  'FTSEMIB',
  'DAX',
  'BTCUSDT',
  'RACE',
  'NVDA',
  'GC1!',
  'EURUSD',
];

export function CompareSymbolModal({ isOpen, onClose }: CompareSymbolModalProps) {
  const { modals, closeModal } = useTradingView();
  const {
    activePane,
    activeSymbol,
    addCompareSymbol,
    removeCompareSymbol,
    setScaleMode,
  } = useActivePane();
  const { quotes } = useQuotes();

  const visible = isOpen ?? modals.compare;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('compare');
  }, [closeModal, onClose]);

  const [query, setQuery] = useState('');
  const [autoPercentScale, setAutoPercentScale] = useState(true);

  const candidates = useMemo(() => {
    return searchSymbols(query).filter((s) => s.ticker !== activeSymbol.ticker);
  }, [activeSymbol.ticker, query]);

  const handleAdd = useCallback(
    (ticker: string) => {
      addCompareSymbol(ticker);
      if (autoPercentScale && activePane.scaleMode !== 'percent') {
        setScaleMode('percent');
      }
    },
    [activePane.scaleMode, addCompareSymbol, autoPercentScale, setScaleMode],
  );

  if (!visible) return null;

  const compared = activePane.compareSymbols;

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Confronta o aggiungi simbolo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="tvm-dialog tvm-dialog--md">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <GitCompareArrows size={19} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div>
              <h2 className="tvm-title">Confronta o aggiungi simbolo</h2>
              <div className="tvm-subtitle">
                Sovrapponi altri strumenti a {activeSymbol.ticker} ({activeSymbol.name})
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

        <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active comparisons */}
          <div>
            <div className="tvm-label" style={{ marginBottom: 8 }}>
              Simboli confrontati sul grafico ({compared.length})
            </div>
            {compared.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--tv-bg-primary, #131313)',
                  border: '1px dashed var(--tv-border, #303030)',
                  fontSize: '0.8rem',
                  color: 'var(--tv-text-secondary, #8c8c8c)',
                }}
              >
                Nessun simbolo in confronto. Scegli un benchmark rapido o cerca uno strumento qui sotto.
              </div>
            ) : (
              <div className="tvm-compare-pills">
                {compared.map((ticker, idx) => {
                  const info = getSymbolByTicker(ticker);
                  const live = quotes[ticker];
                  const pct = live?.changePercent ?? 0;
                  const color = COMPARE_PALETTE[idx % COMPARE_PALETTE.length];
                  return (
                    <span key={ticker} className="tvm-compare-pill">
                      <span className="tvm-color-dot" style={{ backgroundColor: color }} />
                      <span>{ticker}</span>
                      {info && (
                        <span
                          className={`tvm-symbol-delta ${
                            pct >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                          }`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {formatPercent(pct)}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`Rimuovi ${ticker}`}
                        onClick={() => removeCompareSymbol(ticker)}
                        style={{
                          display: 'inline-flex',
                          color: 'var(--tv-text-secondary, #8c8c8c)',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Percent scale toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              backgroundColor: 'var(--tv-bg-primary, #131313)',
              border: '1px solid var(--tv-border-subtle, #222222)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <Percent size={15} style={{ color: 'var(--tv-brand, #2962ff)' }} />
              <span>
                Usa scala percentuale (<strong>%</strong>) per confronto normalizzato
              </span>
            </span>
            <input
              type="checkbox"
              checked={autoPercentScale}
              onChange={(e) => {
                setAutoPercentScale(e.target.checked);
                if (e.target.checked) setScaleMode('percent');
              }}
            />
          </label>

          {/* Quick benchmarks */}
          <div>
            <div className="tvm-label" style={{ marginBottom: 8 }}>
              Benchmark rapidi
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_BENCHMARKS.filter((t) => t !== activeSymbol.ticker).map(
                (ticker) => {
                  const isAdded = compared.includes(ticker);
                  return (
                    <button
                      key={ticker}
                      type="button"
                      className={`tvm-filter-pill ${isAdded ? 'is-active' : ''}`}
                      onClick={() =>
                        isAdded ? removeCompareSymbol(ticker) : handleAdd(ticker)
                      }
                    >
                      {isAdded ? <Check size={13} /> : <Plus size={13} />}
                      {ticker}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Search box + list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="tvm-search-wrap">
              <Search size={16} />
              <input
                type="text"
                className="tvm-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca simbolo da confrontare (es. SPX, NDX, BTCUSDT, RACE)..."
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  className="tvm-close-btn"
                  style={{ width: 24, height: 24 }}
                  onClick={() => setQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div
              style={{
                maxHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {candidates.map((sym) => {
                const isAdded = compared.includes(sym.ticker);
                const live = quotes[sym.ticker];
                const price = live?.price ?? sym.basePrice;
                const pct =
                  live?.changePercent ??
                  ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;

                return (
                  <div
                    key={sym.id}
                    className="tvm-symbol-row"
                    onClick={() =>
                      isAdded
                        ? removeCompareSymbol(sym.ticker)
                        : handleAdd(sym.ticker)
                    }
                  >
                    <div className="tvm-symbol-left">
                      <span
                        className="tvm-avatar tvm-avatar--sm"
                        style={{ backgroundColor: sym.logoColor }}
                      >
                        {sym.logoText}
                      </span>
                      <div className="tvm-symbol-meta">
                        <div className="tvm-symbol-ticker-line">
                          <span className="tvm-symbol-ticker" style={{ fontSize: '0.86rem' }}>
                            {sym.ticker}
                          </span>
                          <span className="tvm-asset-tag">{sym.exchange}</span>
                        </div>
                        <span className="tvm-symbol-name">{sym.name}</span>
                      </div>
                    </div>

                    <div className="tvm-symbol-right">
                      <div className="tvm-symbol-quote">
                        <span className="tvm-symbol-price" style={{ fontSize: '0.82rem' }}>
                          {formatPrice(price, sym.precision)}
                        </span>
                        <span
                          className={`tvm-symbol-delta ${
                            pct >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                          }`}
                        >
                          {formatPercent(pct)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`tvm-btn tvm-btn--sm ${
                          isAdded ? 'tvm-btn--danger' : 'tvm-btn--secondary'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdded) removeCompareSymbol(sym.ticker);
                          else handleAdd(sym.ticker);
                        }}
                      >
                        {isAdded ? 'Rimuovi' : 'Confronta'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="tvm-footer">
          <span className="tvm-subtitle">
            Scala attuale:{' '}
            <strong>
              {activePane.scaleMode === 'percent'
                ? 'Percentuale (%)'
                : activePane.scaleMode === 'log'
                  ? 'Logaritmica'
                  : 'Regolare'}
            </strong>
          </span>
          <div className="tvm-footer-actions">
            {compared.length > 0 && (
              <button
                type="button"
                className="tvm-btn tvm-btn--ghost"
                onClick={() => compared.forEach((t) => removeCompareSymbol(t))}
              >
                Rimuovi tutti
              </button>
            )}
            <button type="button" className="tvm-btn tvm-btn--primary" onClick={handleClose}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompareSymbolModal;
