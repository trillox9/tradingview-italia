import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Check,
  Filter,
  Grid2x2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  DataSourceKind,
  RatingLabel,
  ScreenerCategory,
  ScreenerQuery,
  ScreenerRow,
  ScreenerSortField,
  Timeframe,
} from '../types';
import {
  SYMBOLS,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
  generateSparkline,
} from '../data';
import {
  SCREENER_PRESETS,
  buildScreenerRows,
  filterAndSortScreener,
  getScreenerSectors,
} from '../engine';
import { useQuotes, useTradingView, useWatchlists } from '../store';
import '../styles/modals.css';

type MarketTabId = 'all' | 'us' | 'crypto' | 'italian' | 'macro';
type MacroSubFilter = 'all_macro' | 'indices' | 'forex' | 'futures' | 'etf' | 'bonds';

const MACRO_ASSET_CLASSES = new Set(['index', 'forex', 'futures', 'etf', 'bond']);

const MARKET_TABS: { id: MarketTabId; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'us', label: '🇺🇸 Azioni USA' },
  { id: 'crypto', label: '₿ Cripto' },
  { id: 'italian', label: '🇮🇹 Italia MIL' },
  { id: 'macro', label: 'Indici & Macro' },
];

const MACRO_SUB_TABS: { id: MacroSubFilter; label: string }[] = [
  { id: 'all_macro', label: 'Tutti Macro' },
  { id: 'indices', label: 'Indici' },
  { id: 'forex', label: 'Forex' },
  { id: 'futures', label: 'Futures' },
  { id: 'etf', label: 'ETF' },
  { id: 'bonds', label: 'Obbligazioni' },
];

const RATING_OPTIONS: (RatingLabel | 'all')[] = [
  'all',
  'Forte acquisto',
  'Acquisto',
  'Neutrale',
  'Vendita',
  'Forte vendita',
];

const SCREENER_TIMEFRAMES: Timeframe[] = ['15m', '1H', '4H', '1D', '1W'];
const DEFAULT_PAGE_SIZE = 80;

const sparklineCache = new Map<string, number[]>();

function getCachedSparkline(ticker: string): number[] {
  let cached = sparklineCache.get(ticker);
  if (!cached) {
    cached = generateSparkline(ticker, 24);
    sparklineCache.set(ticker, cached);
  }
  return cached;
}

function ratingClassName(rating: RatingLabel): string {
  switch (rating) {
    case 'Forte acquisto':
      return 'tvp-rating-pill tvp-rating--strong-buy';
    case 'Acquisto':
      return 'tvp-rating-pill tvp-rating--buy';
    case 'Neutrale':
      return 'tvp-rating-pill tvp-rating--neutral';
    case 'Vendita':
      return 'tvp-rating-pill tvp-rating--sell';
    case 'Forte vendita':
      return 'tvp-rating-pill tvp-rating--strong-sell';
  }
}

function renderSourceTag(source?: DataSourceKind) {
  if (source === 'binance' || source === 'yahoo') {
    return (
      <span
        className="tvm-source-badge tvm-source-badge--live"
        title={source === 'binance' ? 'Live Binance' : 'Live Yahoo Finance'}
      >
        LIVE
      </span>
    );
  }
  if (source === 'snapshot') {
    return (
      <span
        className="tvm-source-badge tvm-source-badge--real"
        title="Snapshot di mercato reale"
      >
        REALE
      </span>
    );
  }
  return null;
}

function MiniSparkline({
  points,
  isUp,
  id,
}: {
  points: number[];
  isUp: boolean;
  id: string;
}) {
  if (points.length < 2) return null;
  const w = 84;
  const h = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - 3 - ((p - min) / range) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = isUp ? '#089981' : '#F23645';
  const gradId = `sp-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${gradId})`}
        points={`0,${h} ${coords.join(' ')} ${w},${h}`}
      />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}

export function ScreenerPage() {
  const { openSymbolInChart, navigate } = useTradingView();
  const { quotes } = useQuotes();
  const { activeWatchlist, addSymbolToWatchlist, removeSymbolFromWatchlist } =
    useWatchlists();

  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [marketTab, setMarketTab] = useState<MarketTabId>('all');
  const [macroSub, setMacroSub] = useState<MacroSubFilter>('all_macro');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);
  const [query, setQuery] = useState<ScreenerQuery>({
    category: 'all',
    search: '',
    sector: 'all',
    rating: 'all',
    sortBy: 'marketCap',
    sortDir: 'desc',
  });
  const [directionFilter, setDirectionFilter] = useState<'all' | 'up' | 'down'>('all');

  // Heavy candle/indicator computation memoized strictly by timeframe
  const baseRows = useMemo<ScreenerRow[]>(
    () => buildScreenerRows(SYMBOLS, undefined, timeframe),
    [timeframe],
  );

  // Market tab counts across all 222 instruments
  const marketCounts = useMemo<Record<MarketTabId, number>>(() => {
    let us = 0;
    let crypto = 0;
    let italian = 0;
    let macro = 0;
    for (const s of SYMBOLS) {
      if (s.assetClass === 'stock' && s.country === 'US') us += 1;
      else if (s.assetClass === 'crypto') crypto += 1;
      else if (s.assetClass === 'stock' && s.country === 'IT') italian += 1;
      else if (MACRO_ASSET_CLASSES.has(s.assetClass)) macro += 1;
    }
    return { all: SYMBOLS.length, us, crypto, italian, macro };
  }, []);

  // Lightweight reactive overlay of live quote ticks
  const liveRows = useMemo<ScreenerRow[]>(() => {
    return baseRows.map((row) => {
      const live = quotes[row.ticker];
      if (!live) return row;
      const relativeVolume =
        row.symbol.avgVolume > 0
          ? Math.round((live.volume / row.symbol.avgVolume) * 100) / 100
          : row.relativeVolume;
      return {
        ...row,
        price: live.price,
        change: live.change,
        changePercent: live.changePercent,
        volume: live.volume,
        relativeVolume,
      };
    });
  }, [baseRows, quotes]);

  const sectors = useMemo(() => getScreenerSectors(baseRows), [baseRows]);

  const filteredRows = useMemo(() => {
    const preFiltered =
      marketTab === 'macro' && macroSub === 'all_macro'
        ? liveRows.filter((r) => MACRO_ASSET_CLASSES.has(r.assetClass))
        : liveRows;

    const resolvedCategory: ScreenerCategory =
      marketTab === 'macro'
        ? macroSub === 'all_macro'
          ? 'all'
          : macroSub
        : query.category ?? (marketTab === 'all' ? 'all' : marketTab);

    const effectiveQuery: ScreenerQuery = {
      ...query,
      category: resolvedCategory,
      minChangePercent:
        directionFilter === 'up' ? 0.0001 : query.minChangePercent,
      maxChangePercent:
        directionFilter === 'down' ? -0.0001 : query.maxChangePercent,
    };
    return filterAndSortScreener(preFiltered, effectiveQuery);
  }, [directionFilter, liveRows, macroSub, marketTab, query]);

  const visibleRows = useMemo(() => {
    if (showAllRows || filteredRows.length <= DEFAULT_PAGE_SIZE) {
      return filteredRows;
    }
    return filteredRows.slice(0, DEFAULT_PAGE_SIZE);
  }, [filteredRows, showAllRows]);

  const metrics = useMemo(() => {
    const up = filteredRows.filter((r) => r.changePercent > 0).length;
    const down = filteredRows.filter((r) => r.changePercent < 0).length;
    const top = [...filteredRows].sort((a, b) => b.changePercent - a.changePercent)[0];
    const buySignals = filteredRows.filter(
      (r) => r.technicalRating === 'Acquisto' || r.technicalRating === 'Forte acquisto',
    ).length;
    let liveFeedCount = 0;
    let snapshotCount = 0;
    for (const r of filteredRows) {
      const src = quotes[r.ticker]?.source;
      if (src === 'binance' || src === 'yahoo') liveFeedCount += 1;
      else if (src === 'snapshot') snapshotCount += 1;
    }
    const validRsi = filteredRows
      .map((r) => r.rsi14)
      .filter((v): v is number => v !== null);
    const avgRsi =
      validRsi.length > 0
        ? validRsi.reduce((a, b) => a + b, 0) / validRsi.length
        : null;
    return { up, down, top, buySignals, avgRsi, liveFeedCount, snapshotCount };
  }, [filteredRows, quotes]);

  const handleSelectMarketTab = (nextTab: MarketTabId) => {
    setActivePresetId(null);
    setMarketTab(nextTab);
    setMacroSub('all_macro');
    setShowAllRows(false);
    setQuery((prev) => ({
      ...prev,
      category: nextTab === 'macro' ? 'all' : nextTab,
      sector: 'all',
    }));
  };

  const handleApplyPreset = (presetId: string) => {
    setShowAllRows(false);
    if (activePresetId === presetId) {
      setActivePresetId(null);
      setMarketTab('all');
      setQuery({
        category: 'all',
        search: '',
        sector: 'all',
        rating: 'all',
        sortBy: 'marketCap',
        sortDir: 'desc',
      });
      setDirectionFilter('all');
      return;
    }
    const preset = SCREENER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setDirectionFilter('all');
    const cat = preset.query.category ?? 'all';
    if (cat === 'italian') setMarketTab('italian');
    else if (cat === 'crypto') setMarketTab('crypto');
    else if (cat === 'us') setMarketTab('us');
    else setMarketTab('all');
    setQuery({
      category: 'all',
      search: '',
      sector: 'all',
      rating: 'all',
      ...preset.query,
    });
  };

  const handleSort = (field: ScreenerSortField) => {
    setActivePresetId(null);
    setQuery((prev) => {
      if (prev.sortBy === field) {
        return { ...prev, sortDir: prev.sortDir === 'desc' ? 'asc' : 'desc' };
      }
      return { ...prev, sortBy: field, sortDir: 'desc' };
    });
  };

  const handleReset = () => {
    setActivePresetId(null);
    setMarketTab('all');
    setMacroSub('all_macro');
    setDirectionFilter('all');
    setShowAllRows(false);
    setQuery({
      category: 'all',
      search: '',
      sector: 'all',
      rating: 'all',
      sortBy: 'marketCap',
      sortDir: 'desc',
    });
  };

  const renderSortIcon = (field: ScreenerSortField) => {
    if (query.sortBy !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: 4 }} />;
    }
    return query.sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ color: 'var(--tv-brand, #2962ff)', marginLeft: 4 }} />
    ) : (
      <ArrowDown size={12} style={{ color: 'var(--tv-brand, #2962ff)', marginLeft: 4 }} />
    );
  };

  const watchlistSet = new Set(activeWatchlist?.symbols ?? []);

  return (
    <main className="tvp-page">
      <div className="tvp-inner">
        <header className="tvp-page-header">
          <div>
            <h1 className="tvp-page-title">
              <SlidersHorizontal size={28} style={{ color: 'var(--tv-brand, #2962ff)' }} />
              Screener Mercati
            </h1>
            <p className="tvp-page-subtitle">
              Analizza in tempo reale {SYMBOLS.length} strumenti reali: 95 Azioni USA, 78 Cripto Live Binance, 20 Borsa Italiana e 29 Indici/Macro.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="tvm-btn tvm-btn--secondary"
              onClick={() => navigate('heatmap')}
            >
              <Grid2x2 size={15} />
              Mappa di calore
            </button>
            <button
              type="button"
              className="tvm-btn tvm-btn--primary"
              onClick={() => openSymbolInChart(filteredRows[0]?.ticker ?? 'FTSEMIB')}
            >
              Apri Supercharts
              <ArrowUpRight size={15} />
            </button>
          </div>
        </header>

        {/* Primary Market Category Tabs with live counts */}
        <div className="tvp-toolbar-group" role="tablist" aria-label="Categoria mercato">
          {MARKET_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={marketTab === tab.id}
              className={`tvp-pill ${marketTab === tab.id ? 'is-active' : ''}`}
              onClick={() => handleSelectMarketTab(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="tvm-pill-count">{marketCounts[tab.id]}</span>
            </button>
          ))}
        </div>

        {/* Sub-filter strip when Indici & Macro is selected */}
        {marketTab === 'macro' && (
          <div className="tvp-toolbar-group" role="group" aria-label="Sottocategoria Macro">
            {MACRO_SUB_TABS.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`tvp-pill tvp-pill--brand ${macroSub === sub.id ? 'is-active' : ''}`}
                onClick={() => {
                  setMacroSub(sub.id);
                  setShowAllRows(false);
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Presets Strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--tv-text-muted, #8c8c8c)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Filter size={13} /> PRESET RAPIDI:
          </span>
          {SCREENER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              className={`tvp-pill tvp-pill--brand ${activePresetId === preset.id ? 'is-active' : ''}`}
              onClick={() => handleApplyPreset(preset.id)}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* KPI Metric Cards */}
        <section className="tvp-kpi-grid" aria-label="Metriche screener">
          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Strumenti trovati</span>
            <span className="tvp-kpi-value">{filteredRows.length}</span>
            <span className="tvp-kpi-sub">
              {metrics.liveFeedCount > 0 || metrics.snapshotCount > 0
                ? `${metrics.liveFeedCount} live · ${metrics.snapshotCount} snapshot reali`
                : `su ${SYMBOLS.length} simboli nel catalogo`}
            </span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Bilancio sessione</span>
            <span className="tvp-kpi-value">
              <span className="tvm-delta-up">{metrics.up}</span>
              <span style={{ color: 'var(--tv-text-muted, #707070)', margin: '0 6px' }}>/</span>
              <span className="tvm-delta-down">{metrics.down}</span>
            </span>
            <span className="tvp-kpi-sub">In rialzo / In ribasso</span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">
              <span>Miglior performer</span>
              <TrendingUp size={15} className="tvm-delta-up" />
            </span>
            <span className="tvp-kpi-value tvm-delta-up">
              {metrics.top ? `${metrics.top.ticker} ${formatPercent(metrics.top.changePercent)}` : '—'}
            </span>
            <span className="tvp-kpi-sub tv-truncate">{metrics.top?.name ?? 'Nessun dato'}</span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Segnali tecnici ({timeframe})</span>
            <span className="tvp-kpi-value">{metrics.buySignals} Acquisto</span>
            <span className="tvp-kpi-sub">
              RSI(14) medio: {metrics.avgRsi !== null ? metrics.avgRsi.toFixed(1) : '—'}
            </span>
          </div>
        </section>

        {/* Multi-Filter Toolbar */}
        <section className="tvp-toolbar" aria-label="Filtri avanzati screener">
          <div className="tvp-toolbar-group" style={{ flex: '1 1 260px' }}>
            <div
              className="tvm-search-wrap"
              style={{ minWidth: 240, flex: '1 1 240px', maxWidth: 340, height: 34 }}
            >
              <Search size={15} />
              <input
                type="text"
                className="tvm-search-input"
                value={query.search ?? ''}
                onChange={(e) => {
                  setShowAllRows(false);
                  setQuery((prev) => ({ ...prev, search: e.target.value }));
                }}
                placeholder="Cerca ticker, azienda, borsa (es. PEPE, NVDA)..."
              />
            </div>

            <select
              aria-label="Settore"
              className="tvp-select"
              value={query.sector ?? 'all'}
              onChange={(e) => {
                setActivePresetId(null);
                setShowAllRows(false);
                setQuery((prev) => ({ ...prev, sector: e.target.value }));
              }}
            >
              <option value="all">Tutti i settori</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            <select
              aria-label="Valutazione tecnica"
              className="tvp-select"
              value={query.rating ?? 'all'}
              onChange={(e) => {
                setActivePresetId(null);
                setShowAllRows(false);
                setQuery((prev) => ({
                  ...prev,
                  rating: e.target.value as RatingLabel | 'all',
                }));
              }}
            >
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === 'all' ? 'Tutti i rating tecnici' : r}
                </option>
              ))}
            </select>
          </div>

          <div className="tvp-toolbar-group">
            <div className="tv-segmented" role="group" aria-label="Direzione giornaliera">
              <button
                type="button"
                className={`tv-segmented-btn ${directionFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => {
                  setDirectionFilter('all');
                  setShowAllRows(false);
                }}
              >
                Tutti
              </button>
              <button
                type="button"
                className={`tv-segmented-btn ${directionFilter === 'up' ? 'is-active' : ''}`}
                onClick={() => {
                  setDirectionFilter('up');
                  setShowAllRows(false);
                }}
              >
                Rialzi
              </button>
              <button
                type="button"
                className={`tv-segmented-btn ${directionFilter === 'down' ? 'is-active' : ''}`}
                onClick={() => {
                  setDirectionFilter('down');
                  setShowAllRows(false);
                }}
              >
                Ribassi
              </button>
            </div>

            <select
              aria-label="Timeframe analisi tecnica"
              className="tvp-select"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            >
              {SCREENER_TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  TF: {tf}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="tvm-btn tvm-btn--sm tvm-btn--ghost"
              onClick={handleReset}
              title="Ripristina tutti i filtri"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        </section>

        {/* Live Sortable Table */}
        <section className="tvp-table-card">
          <div className="tvp-table-scroll">
            <table className="tvp-table">
              <thead>
                <tr>
                  <th className="is-sortable" onClick={() => handleSort('ticker')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Simbolo {renderSortIcon('ticker')}
                    </span>
                  </th>
                  <th style={{ textAlign: 'center' }}>Andamento</th>
                  <th className="is-sortable" onClick={() => handleSort('price')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Ultimo {renderSortIcon('price')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('changePercent')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Var % {renderSortIcon('changePercent')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('volume')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Volume {renderSortIcon('volume')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('relativeVolume')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Vol. Rel {renderSortIcon('relativeVolume')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('marketCap')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Cap. {renderSortIcon('marketCap')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('peRatio')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      P/E {renderSortIcon('peRatio')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('rsi14')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      RSI (14) {renderSortIcon('rsi14')}
                    </span>
                  </th>
                  <th className="is-sortable" onClick={() => handleSort('technicalScore')}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Rating tecnico {renderSortIcon('technicalScore')}
                    </span>
                  </th>
                  <th style={{ textAlign: 'center' }}>Lista</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        textAlign: 'center',
                        padding: '44px 16px',
                        color: 'var(--tv-text-secondary, #8c8c8c)',
                      }}
                    >
                      Nessuno strumento corrisponde ai filtri selezionati. Prova a resettare i filtri.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const isUp = row.changePercent >= 0;
                    const inWatchlist = watchlistSet.has(row.ticker);
                    const source = quotes[row.ticker]?.source;
                    const rsi = row.rsi14;
                    const rsiBg =
                      rsi === null
                        ? 'transparent'
                        : rsi >= 70
                          ? 'rgba(242, 54, 69, 0.18)'
                          : rsi <= 30
                            ? 'rgba(8, 153, 129, 0.2)'
                            : 'var(--tv-bg-chip, #222222)';
                    const rsiColor =
                      rsi === null
                        ? 'var(--tv-text-muted, #707070)'
                        : rsi >= 70
                          ? 'var(--tv-down, #f7525f)'
                          : rsi <= 30
                            ? 'var(--tv-up, #22ab94)'
                            : 'var(--tv-text-heading, #ffffff)';

                    return (
                      <tr
                        key={row.symbol.id}
                        onClick={() => openSymbolInChart(row.ticker)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              className="tvm-avatar tvm-avatar--sm"
                              style={{ backgroundColor: row.symbol.logoColor }}
                            >
                              {row.symbol.logoText}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, color: 'var(--tv-text-heading, #ffffff)' }}>
                                  {row.ticker}
                                </span>
                                <span className="tvm-asset-tag">{row.exchange}</span>
                                {renderSourceTag(source)}
                              </div>
                              <div
                                className="tvm-subtitle tv-truncate"
                                style={{ maxWidth: 210 }}
                              >
                                {row.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <MiniSparkline
                            id={row.symbol.id}
                            points={getCachedSparkline(row.ticker)}
                            isUp={isUp}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--tv-text-heading, #ffffff)' }}>
                          {formatPrice(row.price, row.symbol.precision)}{' '}
                          <span style={{ fontSize: '0.7rem', color: 'var(--tv-text-muted, #8c8c8c)', fontWeight: 500 }}>
                            {row.currency}
                          </span>
                        </td>
                        <td>
                          <span className={isUp ? 'tv-pill-up' : 'tv-pill-down'}>
                            {formatPercent(row.changePercent)}
                          </span>
                        </td>
                        <td>{formatVolume(row.volume)}</td>
                        <td
                          style={{
                            color:
                              row.relativeVolume >= 1.3
                                ? 'var(--tv-up, #22ab94)'
                                : 'var(--tv-text-secondary, #8c8c8c)',
                            fontWeight: row.relativeVolume >= 1.3 ? 700 : 500,
                          }}
                        >
                          {row.relativeVolume.toFixed(2)}×
                        </td>
                        <td>{formatMarketCap(row.marketCap)}</td>
                        <td>{row.peRatio !== null ? row.peRatio.toFixed(1) : '—'}</td>
                        <td>
                          <span
                            className="tvp-rsi-pill"
                            style={{ backgroundColor: rsiBg, color: rsiColor }}
                          >
                            {rsi !== null ? rsi.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className={ratingClassName(row.technicalRating)}>
                            {row.technicalRating.includes('acquisto') ||
                            row.technicalRating === 'Acquisto' ? (
                              <TrendingUp size={12} />
                            ) : row.technicalRating.includes('vendita') ||
                              row.technicalRating === 'Vendita' ? (
                              <TrendingDown size={12} />
                            ) : null}
                            {row.technicalRating}
                          </span>
                        </td>
                        <td
                          style={{ textAlign: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={`tvm-icon-action ${inWatchlist ? 'is-active' : ''}`}
                            title={
                              inWatchlist
                                ? 'Rimuovi dalla watchlist'
                                : 'Aggiungi alla watchlist'
                            }
                            onClick={() =>
                              inWatchlist
                                ? removeSymbolFromWatchlist(row.ticker)
                                : addSymbolToWatchlist(row.ticker)
                            }
                          >
                            {inWatchlist ? <Check size={15} /> : <Plus size={15} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > DEFAULT_PAGE_SIZE && (
            <div className="tvp-table-footer">
              <span>
                Mostrati <strong>{visibleRows.length}</strong> di{' '}
                <strong>{filteredRows.length}</strong> strumenti
              </span>
              <button
                type="button"
                className="tvm-btn tvm-btn--sm tvm-btn--secondary"
                onClick={() => setShowAllRows((prev) => !prev)}
              >
                {showAllRows
                  ? `Mostra primi ${DEFAULT_PAGE_SIZE}`
                  : `Mostra tutti (${filteredRows.length})`}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ScreenerPage;
