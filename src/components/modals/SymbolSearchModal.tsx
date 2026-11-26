import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  GitCompareArrows,
  Search,
  X,
} from 'lucide-react';
import type { AssetClass, DataSourceKind, SymbolInfo } from '../../types';
import {
  SYMBOLS,
  formatPercent,
  formatPrice,
} from '../../data';
import { useActivePane, useQuotes, useTradingView } from '../../store';

export type SymbolSearchMode = 'chart' | 'compare';

export interface SymbolSearchModalProps {
  isOpen?: boolean;
  mode?: SymbolSearchMode;
  onClose?: () => void;
  onSelectSymbol?: (symbol: SymbolInfo) => void;
}

type SearchCategoryId =
  | 'all'
  | 'crypto'
  | 'stock_us'
  | 'stock_it'
  | 'index'
  | 'forex'
  | 'futures'
  | 'etf'
  | 'bond';

const CATEGORY_PILLS: { id: SearchCategoryId; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'crypto', label: 'Cripto' },
  { id: 'stock_us', label: 'Azioni USA' },
  { id: 'stock_it', label: 'Azioni Italia' },
  { id: 'index', label: 'Indici' },
  { id: 'forex', label: 'Forex' },
  { id: 'futures', label: 'Futures' },
  { id: 'etf', label: 'ETF' },
  { id: 'bond', label: 'Obbligazioni' },
];

const ASSET_CLASS_BADGE_IT: Record<AssetClass, string> = {
  stock: 'AZIONE',
  index: 'INDICE',
  crypto: 'CRIPTO SPOT',
  forex: 'FOREX',
  futures: 'FUTURES',
  bond: 'OBBLIGAZIONE',
  etf: 'FONDO ETF',
};

const COUNTRY_FLAGS: Record<string, string> = {
  IT: '🇮🇹',
  US: '🇺🇸',
  DE: '🇩🇪',
  EU: '🇪🇺',
  GB: '🇬🇧',
  JP: '🇯🇵',
  CH: '🇨🇭',
  AU: '🇦🇺',
  CA: '🇨🇦',
  GLOBAL: '🌐',
};

const INITIAL_RENDER_LIMIT = 80;

function matchesSearchCategory(sym: SymbolInfo, cat: SearchCategoryId): boolean {
  switch (cat) {
    case 'all':
      return true;
    case 'crypto':
      return sym.assetClass === 'crypto';
    case 'stock_us':
      return sym.assetClass === 'stock' && sym.country === 'US';
    case 'stock_it':
      return sym.assetClass === 'stock' && sym.country === 'IT';
    case 'index':
      return sym.assetClass === 'index';
    case 'forex':
      return sym.assetClass === 'forex';
    case 'futures':
      return sym.assetClass === 'futures';
    case 'etf':
      return sym.assetClass === 'etf';
    case 'bond':
      return sym.assetClass === 'bond';
  }
}

function renderSourceBadge(source?: DataSourceKind) {
  if (source === 'binance' || source === 'yahoo') {
    return (
      <span
        className="tvm-source-badge tvm-source-badge--live"
        title={source === 'binance' ? 'Prezzo live Binance' : 'Prezzo live Yahoo Finance'}
      >
        LIVE
      </span>
    );
  }
  if (source === 'snapshot') {
    return (
      <span
        className="tvm-source-badge tvm-source-badge--real"
        title="Dati reali da snapshot di mercato"
      >
        REALE
      </span>
    );
  }
  return null;
}

export function SymbolSearchModal({
  isOpen,
  mode: initialMode,
  onClose,
  onSelectSymbol,
}: SymbolSearchModalProps) {
  const {
    modals,
    closeModal,
    openSymbolInChart,
  } = useTradingView();
  const { quotes } = useQuotes();
  const { activePane, addCompareSymbol, setScaleMode } = useActivePane();

  const visible = isOpen ?? modals.symbolSearch;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('symbolSearch');
  }, [closeModal, onClose]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategoryId>('all');
  const [activeMode, setActiveMode] = useState<SymbolSearchMode>(
    initialMode ?? 'chart',
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAllSymbols, setShowAllSymbols] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!visible) return;
    setSelectedIndex(0);
    setShowAllSymbols(false);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [visible]);

  const categoryCounts = useMemo<Record<SearchCategoryId, number>>(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? SYMBOLS.filter(
          (s) =>
            s.ticker.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.exchange.toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        )
      : SYMBOLS;

    const counts: Record<SearchCategoryId, number> = {
      all: base.length,
      crypto: 0,
      stock_us: 0,
      stock_it: 0,
      index: 0,
      forex: 0,
      futures: 0,
      etf: 0,
      bond: 0,
    };
    for (const s of base) {
      if (s.assetClass === 'crypto') counts.crypto += 1;
      else if (s.assetClass === 'stock' && s.country === 'US') counts.stock_us += 1;
      else if (s.assetClass === 'stock' && s.country === 'IT') counts.stock_it += 1;
      else if (s.assetClass === 'index') counts.index += 1;
      else if (s.assetClass === 'forex') counts.forex += 1;
      else if (s.assetClass === 'futures') counts.futures += 1;
      else if (s.assetClass === 'etf') counts.etf += 1;
      else if (s.assetClass === 'bond') counts.bond += 1;
    }
    return counts;
  }, [query]);

  const filteredSymbols = useMemo<SymbolInfo[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = SYMBOLS.filter((s) => {
      if (!matchesSearchCategory(s, category)) return false;
      if (!q) return true;
      return (
        s.ticker.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.exchange.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });

    const qUpper = query.trim().toUpperCase();
    if (!qUpper) return matches;
    return [...matches].sort((a, b) => {
      const aScore =
        a.ticker.toUpperCase() === qUpper
          ? 0
          : a.ticker.toUpperCase().startsWith(qUpper)
            ? 1
            : a.name.toUpperCase().startsWith(qUpper)
              ? 2
              : 3;
      const bScore =
        b.ticker.toUpperCase() === qUpper
          ? 0
          : b.ticker.toUpperCase().startsWith(qUpper)
            ? 1
            : b.name.toUpperCase().startsWith(qUpper)
              ? 2
              : 3;
      return aScore - bScore;
    });
  }, [category, query]);

  const displayedSymbols = useMemo(() => {
    if (showAllSymbols || filteredSymbols.length <= INITIAL_RENDER_LIMIT) {
      return filteredSymbols;
    }
    return filteredSymbols.slice(0, INITIAL_RENDER_LIMIT);
  }, [filteredSymbols, showAllSymbols]);

  const activeListLength = displayedSymbols.length;

  useEffect(() => {
    setSelectedIndex((prev) =>
      activeListLength === 0 ? 0 : Math.min(prev, activeListLength - 1),
    );
  }, [activeListLength]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(
      `[data-result-index="${selectedIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSymbolAction = useCallback(
    (sym: SymbolInfo, overrideMode?: SymbolSearchMode) => {
      if (onSelectSymbol && !overrideMode) {
        onSelectSymbol(sym);
        handleClose();
        return;
      }

      const modeToUse = overrideMode ?? activeMode;
      if (modeToUse === 'compare') {
        addCompareSymbol(sym.ticker);
        setScaleMode('percent');
        handleClose();
        return;
      }
      openSymbolInChart(sym.ticker);
      handleClose();
    },
    [
      activeMode,
      addCompareSymbol,
      handleClose,
      onSelectSymbol,
      openSymbolInChart,
      setScaleMode,
    ],
  );

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeListLength > 0) {
        setSelectedIndex((prev) => (prev + 1) % activeListLength);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeListLength > 0) {
        setSelectedIndex(
          (prev) => (prev - 1 + activeListLength) % activeListLength,
        );
      }
      return;
    }
    if (e.key === 'Enter' && activeListLength > 0) {
      e.preventDefault();
      const sym = displayedSymbols[selectedIndex];
      if (sym) handleSymbolAction(sym);
    }
  };

  if (!visible) return null;

  const compareSet = new Set(activePane.compareSymbols);

  return (
    <div
      className="tvm-backdrop tvm-backdrop--top"
      role="dialog"
      aria-modal="true"
      aria-label="Ricerca simboli"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="tvm-search-shell">
        {/* Floating Pill Search Input (matches it.tradingview.com Global Search) */}
        <div className="tvm-search-floating-bar">
          <Search
            size={19}
            style={{ color: 'var(--tv-text-secondary, #8c8c8c)', flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
              setShowAllSymbols(false);
            }}
            placeholder="Simbolo, ISIN o CUSIP (es. RACE, NVDA, PEPEUSDT, FTSEMIB)"
            aria-label="Simbolo, ISIN o CUSIP"
          />
          {query && (
            <button
              type="button"
              className="tvm-search-clear-btn"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                setShowAllSymbols(false);
                inputRef.current?.focus();
              }}
            >
              Cancella
            </button>
          )}
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Results Card */}
        <div className="tvm-search-card">
          <div className="tvm-search-top-tabs">
            <div className="tvm-underline-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={true}
                className="tvm-underline-tab is-active"
              >
                Simboli ({categoryCounts.all})
              </button>
            </div>

            {!onSelectSymbol && (
              <div className="tvm-search-mode-bar" aria-label="Azione al clic">
                <button
                  type="button"
                  className={`tvm-search-mode-btn ${activeMode === 'chart' ? 'is-active' : ''}`}
                  onClick={() => setActiveMode('chart')}
                >
                  Grafico
                </button>
                <button
                  type="button"
                  className={`tvm-search-mode-btn ${activeMode === 'compare' ? 'is-active' : ''}`}
                  onClick={() => setActiveMode('compare')}
                >
                  Confronta
                </button>
              </div>
            )}
          </div>

          <div
            className="tvm-pill-strip tv-no-scrollbar"
            role="tablist"
            aria-label="Categorie strumenti"
          >
            {CATEGORY_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={category === pill.id}
                className={`tvm-filter-pill ${category === pill.id ? 'is-active' : ''}`}
                onClick={() => {
                  setCategory(pill.id);
                  setSelectedIndex(0);
                  setShowAllSymbols(false);
                }}
              >
                <span>{pill.label}</span>
                <span className="tvm-pill-count">{categoryCounts[pill.id]}</span>
              </button>
            ))}
          </div>

          <div className="tvm-search-results" ref={listRef}>
            {displayedSymbols.length === 0 ? (
                  <div className="tvp-empty-state">
                    <Search size={28} />
                    <div>Nessun simbolo trovato per &ldquo;{query}&rdquo;</div>
                  </div>
                ) : (
                  <>
                    {displayedSymbols.map((sym, idx) => {
                      const live = quotes[sym.ticker];
                      const price = live?.price ?? sym.basePrice;
                      const deltaPct =
                        live?.changePercent ??
                        ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                      const isUp = deltaPct > 0.0001;
                      const isDown = deltaPct < -0.0001;
                      const inCompare = compareSet.has(sym.ticker);
                      const flag = COUNTRY_FLAGS[sym.country] ?? '🌐';

                      return (
                        <div
                          key={sym.id}
                          data-result-index={idx}
                          role="option"
                          aria-selected={idx === selectedIndex}
                          className={`tvm-symbol-row ${idx === selectedIndex ? 'is-selected' : ''}`}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => handleSymbolAction(sym)}
                        >
                          <div className="tvm-symbol-left">
                            <span
                              className="tvm-avatar"
                              style={{ backgroundColor: sym.logoColor }}
                            >
                              {sym.logoText}
                            </span>
                            <div className="tvm-symbol-meta">
                              <div className="tvm-symbol-ticker-line">
                                <span className="tvm-symbol-ticker">{sym.ticker}</span>
                                <span className="tvm-asset-tag tvm-symbol-asset-tag">
                                  {ASSET_CLASS_BADGE_IT[sym.assetClass]}
                                </span>
                                {renderSourceBadge(live?.source)}
                              </div>
                              <div className="tvm-symbol-desc-line">
                                <span className="tvm-symbol-exch-inline">
                                  {flag} {sym.exchange} ·
                                </span>
                                <span className="tvm-symbol-name">{sym.name}</span>
                              </div>
                            </div>
                          </div>

                          <div className="tvm-symbol-right">
                            <div className="tvm-symbol-quote">
                              <span className="tvm-symbol-price">
                                {formatPrice(price, sym.precision)}
                              </span>
                              <span
                                className={`tvm-symbol-delta ${
                                  isUp
                                    ? 'tvm-delta-up'
                                    : isDown
                                      ? 'tvm-delta-down'
                                      : 'tvm-delta-flat'
                                }`}
                              >
                                {formatPercent(deltaPct)}
                              </span>
                            </div>

                            <span className="tvm-exchange-pill tvm-symbol-exch-desktop">
                              <span>{flag}</span>
                              <span>{sym.exchange}</span>
                            </span>

                            <div
                              className="tvm-row-actions tvm-symbol-actions-desktop"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className={`tvm-icon-action ${inCompare ? 'is-active' : ''}`}
                                title="Confronta sul grafico attivo"
                                onClick={() => {
                                  addCompareSymbol(sym.ticker);
                                  setScaleMode('percent');
                                }}
                              >
                                <GitCompareArrows size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!showAllSymbols && filteredSymbols.length > INITIAL_RENDER_LIMIT && (
                      <div style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="tvm-btn tvm-btn--sm tvm-btn--secondary"
                          onClick={() => setShowAllSymbols(true)}
                        >
                          Mostra tutti i {filteredSymbols.length} strumenti
                        </button>
                      </div>
                    )}
                  </>
                )}
          </div>

          <div className="tvm-search-footer">
            <div className="tvm-kbd-hints">
              <span className="tvm-kbd-hint">
                <kbd className="tvm-kbd">↑</kbd>
                <kbd className="tvm-kbd">↓</kbd> Naviga
              </span>
              <span className="tvm-kbd-hint">
                <kbd className="tvm-kbd">↵</kbd>{' '}
                {activeMode === 'compare' ? 'Confronta' : 'Apri su Supercharts'}
              </span>
              <span className="tvm-kbd-hint">
                <kbd className="tvm-kbd">Esc</kbd> Chiudi
              </span>
            </div>
            <span>
              {displayedSymbols.length} di {filteredSymbols.length} strumenti
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SymbolSearchModal;
