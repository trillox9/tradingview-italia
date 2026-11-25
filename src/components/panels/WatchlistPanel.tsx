import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import type { AssetClass, RatingLabel, SymbolInfo } from '../../types';
import {
  FINANCIAL_NEWS,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
  getSymbolByTicker,
} from '../../data';
import {
  useActivePane,
  useQuotes,
  useTradingView,
  useWatchlists,
} from '../../store';

const ASSET_GROUP_ORDER: AssetClass[] = [
  'index',
  'stock',
  'crypto',
  'forex',
  'futures',
  'bond',
  'etf',
];

const ASSET_GROUP_LABELS_IT: Record<AssetClass, string> = {
  index: 'Indici',
  stock: 'Azioni',
  crypto: 'Cripto',
  forex: 'Forex',
  futures: 'Futures',
  bond: 'Obbligazioni',
  etf: 'ETF',
};

function ratingColor(rating: RatingLabel): string {
  switch (rating) {
    case 'Forte acquisto':
    case 'Acquisto':
      return 'var(--tv-up, #22ab94)';
    case 'Forte vendita':
    case 'Vendita':
      return 'var(--tv-down, #f7525f)';
    default:
      return 'var(--tv-text-secondary, #8c8c8c)';
  }
}

interface TechnicalGaugeProps {
  score: number;
  rating: RatingLabel;
  sellCount: number;
  neutralCount: number;
  buyCount: number;
}

function TechnicalSpeedometer({
  score,
  rating,
  sellCount,
  neutralCount,
  buyCount,
}: TechnicalGaugeProps) {
  // Clamp score [-1, +1] -> angle [-78deg, +78deg] where 0 is straight up
  const clamped = Math.max(-1, Math.min(1, score));
  const angleDeg = clamped * 78;

  // Helper to build SVG arc segments along a semicircle (center 100, 96, radius 74)
  const cx = 100;
  const cy = 96;
  const r = 72;
  const polarToXY = (degFromLeft: number) => {
    const rad = ((180 - degFromLeft) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };
  const arcPath = (startDeg: number, endDeg: number) => {
    const s = polarToXY(startDeg);
    const e = polarToXY(endDeg);
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  return (
    <div className="tv-gauge-wrap">
      <svg
        viewBox="0 0 200 112"
        width="186"
        height="104"
        role="img"
        aria-label={`Valutazione tecnica: ${rating}`}
      >
        {/* 5 TradingView Gauge Segments */}
        <path d={arcPath(4, 35)} fill="none" stroke="#f23645" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(40, 71)} fill="none" stroke="#f77c80" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(76, 104)} fill="none" stroke="#787b86" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(109, 140)} fill="none" stroke="#42bda8" strokeWidth="7" strokeLinecap="round" />
        <path d={arcPath(145, 176)} fill="none" stroke="#089981" strokeWidth="7" strokeLinecap="round" />

        {/* Subtle outer labels */}
        <text x="12" y="108" fontSize="8" fill="var(--tv-text-muted, #707070)">
          Vendita
        </text>
        <text x="100" y="14" fontSize="8" textAnchor="middle" fill="var(--tv-text-muted, #707070)">
          Neutrale
        </text>
        <text x="188" y="108" fontSize="8" textAnchor="end" fill="var(--tv-text-muted, #707070)">
          Acquisto
        </text>

        {/* Animated Needle */}
        <g
          transform={`rotate(${angleDeg.toFixed(1)} ${cx} ${cy})`}
          style={{ transition: 'transform 320ms cubic-bezier(0.2, 0, 0, 1)' }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - 56}
            stroke="var(--tv-text-heading, #ffffff)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill="var(--tv-text-heading, #ffffff)" />
          <circle cx={cx} cy={cy} r="2.2" fill="var(--tv-toolbar-bg, #000000)" />
        </g>
      </svg>

      <div className="tv-gauge-rating" style={{ color: ratingColor(rating) }}>
        {rating}
      </div>

      <div className="tv-ta-counts" style={{ width: '100%' }}>
        <div className="tv-ta-count-box">
          <span className="tv-ta-count-label">Vendita</span>
          <span className="tv-ta-count-num tv-val-down">{sellCount}</span>
        </div>
        <div className="tv-ta-count-box">
          <span className="tv-ta-count-label">Neutrale</span>
          <span className="tv-ta-count-num tv-val-neutral">{neutralCount}</span>
        </div>
        <div className="tv-ta-count-box">
          <span className="tv-ta-count-label">Acquisto</span>
          <span className="tv-ta-count-num tv-val-up">{buyCount}</span>
        </div>
      </div>
    </div>
  );
}

export function WatchlistPanel() {
  const { openModal, setBottomPanel, setRightPanel } = useTradingView();
  const { quotes } = useQuotes();
  const { activeSymbol, setSymbol, technicalSummary } = useActivePane();
  const {
    watchlists,
    activeWatchlist,
    activeWatchlistId,
    setActiveWatchlistId,
    removeSymbolFromWatchlist,
  } = useWatchlists();

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [taTab, setTaTab] = useState<'oscillators' | 'summary' | 'movingAverages'>(
    'summary',
  );
  const [detailsHeight, setDetailsHeight] = useState<number>(330);
  const [isResizingSplit, setIsResizingSplit] = useState<boolean>(false);

  // Track tick flash direction per symbol
  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashState, setFlashState] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    const nextFlashes: Record<string, 'up' | 'down'> = {};
    let hasChange = false;

    for (const ticker of activeWatchlist.symbols) {
      const current = quotes[ticker]?.price;
      const prev = prevPricesRef.current[ticker];
      if (current !== undefined) {
        if (prev !== undefined && current !== prev) {
          nextFlashes[ticker] = current > prev ? 'up' : 'down';
          hasChange = true;
        }
        prevPricesRef.current[ticker] = current;
      }
    }

    if (!hasChange) return;
    setFlashState((prev) => ({ ...prev, ...nextFlashes }));
    const timer = setTimeout(() => {
      setFlashState((prev) => {
        const copy = { ...prev };
        for (const key of Object.keys(nextFlashes)) {
          delete copy[key];
        }
        return copy;
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [quotes, activeWatchlist.symbols]);

  const groupedSymbols = useMemo(() => {
    const buckets = new Map<AssetClass, SymbolInfo[]>();
    for (const ticker of activeWatchlist.symbols) {
      const sym = getSymbolByTicker(ticker);
      if (!sym) continue;
      const list = buckets.get(sym.assetClass) ?? [];
      list.push(sym);
      buckets.set(sym.assetClass, list);
    }
    return ASSET_GROUP_ORDER.filter((cls) => buckets.has(cls)).map((cls) => ({
      assetClass: cls,
      label: ASSET_GROUP_LABELS_IT[cls],
      items: buckets.get(cls)!,
    }));
  }, [activeWatchlist.symbols]);

  const toggleGroup = (cls: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [cls]: !prev[cls] }));
  };

  // Resizable horizontal split drag
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = detailsHeight;
    setIsResizingSplit(true);

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setDetailsHeight(Math.max(180, Math.min(520, startH + delta)));
    };
    const onUp = () => {
      setIsResizingSplit(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const activeQuote = quotes[activeSymbol.ticker];
  const livePrice = activeQuote?.price ?? activeSymbol.basePrice;
  const liveOpen = activeQuote?.open ?? activeSymbol.prevClose;
  const liveHigh = activeQuote?.high ?? Math.max(livePrice, activeSymbol.prevClose);
  const liveLow = activeQuote?.low ?? Math.min(livePrice, activeSymbol.prevClose);
  const liveChange = activeQuote?.change ?? livePrice - activeSymbol.prevClose;
  const liveChangePct =
    activeQuote?.changePercent ??
    ((livePrice - activeSymbol.prevClose) / activeSymbol.prevClose) * 100;
  const liveVol = activeQuote?.volume ?? activeSymbol.avgVolume;
  const liveBid = activeQuote?.bid ?? livePrice;
  const liveAsk = activeQuote?.ask ?? livePrice;

  const dayPct =
    liveHigh > liveLow
      ? Math.max(0, Math.min(100, ((livePrice - liveLow) / (liveHigh - liveLow)) * 100))
      : 50;
  const yearPct =
    activeSymbol.high52w > activeSymbol.low52w
      ? Math.max(
          0,
          Math.min(
            100,
            ((livePrice - activeSymbol.low52w) /
              (activeSymbol.high52w - activeSymbol.low52w)) *
              100,
          ),
        )
      : 50;

  const activeGauge =
    taTab === 'oscillators'
      ? technicalSummary.oscillators
      : taTab === 'movingAverages'
        ? technicalSummary.movingAverages
        : technicalSummary.summary;

  const symbolNews = useMemo(() => {
    const matched = FINANCIAL_NEWS.filter((n) =>
      n.relatedTickers.includes(activeSymbol.ticker),
    );
    return (matched.length > 0 ? matched : FINANCIAL_NEWS).slice(0, 3);
  }, [activeSymbol.ticker]);

  return (
    <div className="tv-watchlist-layout">
      {/* Top Split: Watchlist Selector + Grouped Rows */}
      <div className="tv-watchlist-top">
        <div className="tv-panel-header">
          <select
            className="tv-select-compact"
            aria-label="Seleziona lista titoli"
            value={activeWatchlistId}
            onChange={(e) => setActiveWatchlistId(e.target.value)}
          >
            {watchlists.map((wl) => (
              <option key={wl.id} value={wl.id}>
                {wl.name} ({wl.symbols.length})
              </option>
            ))}
          </select>

          <div className="tv-panel-actions">
            <button
              type="button"
              className="tv-panel-icon-btn"
              title="Aggiungi simbolo (Ctrl+K)"
              aria-label="Aggiungi simbolo"
              onClick={() => openModal('symbolSearch')}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="tv-wl-cols-header">
          <span>Simbolo</span>
          <span>Ultimo</span>
          <span>Var</span>
          <span>Var%</span>
        </div>

        <div className="tv-panel-body">
          {groupedSymbols.length === 0 ? (
            <div className="tv-empty-state">
              Nessun titolo in questa lista. Clicca <strong>+</strong> per aggiungere simboli.
            </div>
          ) : (
            groupedSymbols.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.assetClass]);
              return (
                <div key={group.assetClass}>
                  <button
                    type="button"
                    className="tv-wl-group-header"
                    onClick={() => toggleGroup(group.assetClass)}
                  >
                    <span className="tv-wl-group-left">
                      {isCollapsed ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                      {group.label}
                    </span>
                    <span>{group.items.length}</span>
                  </button>

                  {!isCollapsed &&
                    group.items.map((sym) => {
                      const q = quotes[sym.ticker];
                      const price = q?.price ?? sym.basePrice;
                      const chg = q?.change ?? price - sym.prevClose;
                      const chgPct =
                        q?.changePercent ??
                        ((price - sym.prevClose) / sym.prevClose) * 100;
                      const isUp = chg >= 0;
                      const isSelected = sym.ticker === activeSymbol.ticker;
                      const flash = flashState[sym.ticker];

                      return (
                        <div
                          key={sym.ticker}
                          role="button"
                          tabIndex={0}
                          className={`tv-wl-row${isSelected ? ' is-selected' : ''}${flash === 'up' ? ' is-flash-up' : ''}${flash === 'down' ? ' is-flash-down' : ''}`}
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
                              <span className="tv-wl-exchange">{sym.exchange}</span>
                            </div>
                          </div>

                          <span className="tv-wl-price tv-num">
                            {formatPrice(price, sym.precision)}
                          </span>
                          <span
                            className={`tv-wl-chg tv-num ${isUp ? 'tv-val-up' : 'tv-val-down'}`}
                          >
                            {chg > 0 ? '+' : ''}
                            {formatPrice(chg, Math.min(sym.precision, 2))}
                          </span>
                          <span
                            className={`tv-wl-chg-pct tv-num ${isUp ? 'tv-val-up' : 'tv-val-down'}`}
                          >
                            {formatPercent(chgPct)}
                          </span>

                          <button
                            type="button"
                            className="tv-wl-remove-btn"
                            title={`Rimuovi ${sym.ticker}`}
                            aria-label={`Rimuovi ${sym.ticker}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSymbolFromWatchlist(sym.ticker);
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Resizable Divider */}
      <div
        className={`tv-resize-handle-y${isResizingSplit ? ' is-dragging' : ''}`}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Ridimensiona dettagli simbolo"
        onMouseDown={handleSplitMouseDown}
      />

      {/* Bottom Split: Dettagli Simbolo + Analisi Tecnica */}
      <div
        className="tv-symbol-details"
        style={{ height: `${detailsHeight}px` }}
      >
        <div className="tv-sd-head">
          <div className="tv-sd-title-wrap">
            <span
              className="tv-ticker-badge is-lg"
              style={{ backgroundColor: activeSymbol.logoColor }}
            >
              {activeSymbol.logoText}
            </span>
            <div>
              <div className="tv-sd-name">{activeSymbol.name}</div>
              <div className="tv-sd-sub">
                {activeSymbol.ticker} • {activeSymbol.exchange} • {activeSymbol.sector}
              </div>
            </div>
          </div>

          <span
            className={`tv-market-status${activeSymbol.marketStatus === 'closed' ? ' is-closed' : ''}`}
          >
            <span className="tv-status-dot" />
            {activeSymbol.marketStatus === '24x7'
              ? '24/7'
              : activeSymbol.marketStatus === 'closed'
                ? 'Chiuso'
                : 'Aperto'}
          </span>
        </div>

        <div className="tv-sd-price-row">
          <span className="tv-sd-price tv-num">
            {formatPrice(livePrice, activeSymbol.precision)}
          </span>
          <span className="tv-sd-currency">{activeSymbol.currency}</span>
          <span
            className={`tv-sd-delta tv-num ${liveChange >= 0 ? 'tv-val-up' : 'tv-val-down'}`}
          >
            {liveChange > 0 ? '+' : ''}
            {formatPrice(liveChange, activeSymbol.precision)} ({formatPercent(liveChangePct)})
          </span>
        </div>

        {/* Quick Sell / Buy Paper Trade Triggers */}
        <div className="tv-sd-quick-trade">
          <button
            type="button"
            className="tv-quick-btn is-sell"
            onClick={() => setBottomPanel('trading')}
            title="Apri Pannello di Trading per vendere"
          >
            <span className="tv-quick-btn-label">Vendi</span>
            <span className="tv-quick-btn-price tv-num">
              {formatPrice(liveBid, activeSymbol.precision)}
            </span>
          </button>
          <button
            type="button"
            className="tv-quick-btn is-buy"
            onClick={() => setBottomPanel('trading')}
            title="Apri Pannello di Trading per acquistare"
          >
            <span className="tv-quick-btn-label">Acquista</span>
            <span className="tv-quick-btn-price tv-num">
              {formatPrice(liveAsk, activeSymbol.precision)}
            </span>
          </button>
        </div>

        {/* Intervallo giornaliero */}
        <div className="tv-range-block">
          <div className="tv-range-label">
            <span>Intervallo giornaliero</span>
          </div>
          <div className="tv-range-track">
            <div className="tv-range-fill" style={{ width: `${dayPct}%` }} />
            <div className="tv-range-marker" style={{ left: `${dayPct}%` }} />
          </div>
          <div className="tv-range-values tv-num">
            <span>{formatPrice(liveLow, activeSymbol.precision)}</span>
            <span>{formatPrice(liveHigh, activeSymbol.precision)}</span>
          </div>
        </div>

        {/* Intervallo 52 settimane */}
        <div className="tv-range-block">
          <div className="tv-range-label">
            <span>Intervallo 52 settimane</span>
          </div>
          <div className="tv-range-track">
            <div className="tv-range-fill" style={{ width: `${yearPct}%` }} />
            <div className="tv-range-marker" style={{ left: `${yearPct}%` }} />
          </div>
          <div className="tv-range-values tv-num">
            <span>{formatPrice(activeSymbol.low52w, activeSymbol.precision)}</span>
            <span>{formatPrice(activeSymbol.high52w, activeSymbol.precision)}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="tv-metrics-grid">
          <div className="tv-metric-item">
            <span className="tv-metric-label">Apertura</span>
            <span className="tv-metric-val tv-num">
              {formatPrice(liveOpen, activeSymbol.precision)}
            </span>
          </div>
          <div className="tv-metric-item">
            <span className="tv-metric-label">Volume</span>
            <span className="tv-metric-val tv-num">{formatVolume(liveVol)}</span>
          </div>
          <div className="tv-metric-item">
            <span className="tv-metric-label">Cap. mercato</span>
            <span className="tv-metric-val tv-num">
              {formatMarketCap(activeSymbol.marketCap)}
            </span>
          </div>
          <div className="tv-metric-item">
            <span className="tv-metric-label">P/E • Dividendo</span>
            <span className="tv-metric-val tv-num">
              {activeSymbol.peRatio ? activeSymbol.peRatio.toFixed(1) : '—'}
              {activeSymbol.dividendYield !== undefined
                ? ` • ${activeSymbol.dividendYield.toFixed(2)}%`
                : ''}
            </span>
          </div>
        </div>

        {/* Analisi Tecnica Gauge */}
        <div className="tv-ta-card">
          <h4 className="tv-ta-title">Analisi tecnica</h4>
          <div className="tv-ta-tabs">
            <button
              type="button"
              className={`tv-ta-tab${taTab === 'oscillators' ? ' is-active' : ''}`}
              onClick={() => setTaTab('oscillators')}
            >
              Oscillatori
            </button>
            <button
              type="button"
              className={`tv-ta-tab${taTab === 'summary' ? ' is-active' : ''}`}
              onClick={() => setTaTab('summary')}
            >
              Sommario
            </button>
            <button
              type="button"
              className={`tv-ta-tab${taTab === 'movingAverages' ? ' is-active' : ''}`}
              onClick={() => setTaTab('movingAverages')}
            >
              Medie mobili
            </button>
          </div>

          <TechnicalSpeedometer
            score={activeGauge.score}
            rating={activeGauge.rating}
            sellCount={activeGauge.sellCount}
            neutralCount={activeGauge.neutralCount}
            buyCount={activeGauge.buyCount}
          />
        </div>

        {/* Latest 3 Symbol News */}
        <div className="tv-sd-news">
          <h4 className="tv-ta-title">Ultime notizie</h4>
          {symbolNews.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tv-sd-news-item"
              onClick={() => setRightPanel('news')}
            >
              <div className="tv-sd-news-meta">
                {item.source} • {item.publishedAgo}
              </div>
              <div className="tv-sd-news-title">{item.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
