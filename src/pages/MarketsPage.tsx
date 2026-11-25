import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CandlestickChart,
  ChevronRight,
  Filter,
  LayoutGrid,
  Maximize2,
  TrendingUp,
} from 'lucide-react';
import type { Candle, DataSourceKind, NewsItem, SymbolInfo, Timeframe } from '../types';
import {
  fetchRealCandles,
  FINANCIAL_NEWS,
  formatPercent,
  formatPrice,
  formatVolume,
  generateSparkline,
  getCandlesForSymbol,
  HEATMAP_SECTORS,
  SYMBOLS,
} from '../data';
import { useQuotes, useTradingView } from '../store';
import { SiteFooter, SiteHeader } from '../components/layout';
import {
  LiveCryptoSection,
  MiniAreaChart,
  SparklineSvg,
  UsStocksSection,
  type MiniRangeKey,
} from '../components/home';
import '../styles/home.css';

type MarketShowcaseCategory =
  | 'indices'
  | 'italy'
  | 'us'
  | 'crypto'
  | 'forex'
  | 'futures'
  | 'bonds_etf';

const RANGE_SPECS: Record<MiniRangeKey, { timeframe: Timeframe; count: number }> = {
  '1G': { timeframe: '5m', count: 78 },
  '1M': { timeframe: '1D', count: 30 },
  '3M': { timeframe: '1D', count: 65 },
  '1A': { timeframe: '1D', count: 180 },
  '5A': { timeframe: '1W', count: 160 },
  Tutto: { timeframe: '1M', count: 96 },
};

const RANGE_KEYS: MiniRangeKey[] = ['1G', '1M', '3M', '1A', '5A', 'Tutto'];

const NEWS_FILTERS: Array<{ key: 'all' | NewsItem['category']; label: string }> = [
  { key: 'all', label: 'Tutte' },
  { key: 'mercati', label: 'Mercati' },
  { key: 'macro', label: 'Macro' },
  { key: 'azioni', label: 'Azioni' },
  { key: 'cripto', label: 'Cripto' },
  { key: 'forex', label: 'Forex' },
  { key: 'materie-prime', label: 'Materie prime' },
];

function symbolsForCategory(cat: MarketShowcaseCategory): SymbolInfo[] {
  switch (cat) {
    case 'indices':
      return SYMBOLS.filter((s) => s.assetClass === 'index');
    case 'italy':
      return SYMBOLS.filter((s) => s.assetClass === 'stock' && s.exchange === 'MIL');
    case 'us':
      return SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'US');
    case 'crypto':
      return SYMBOLS.filter((s) => s.assetClass === 'crypto');
    case 'forex':
      return SYMBOLS.filter((s) => s.assetClass === 'forex');
    case 'futures':
      return SYMBOLS.filter((s) => s.assetClass === 'futures');
    case 'bonds_etf':
      return SYMBOLS.filter((s) => s.assetClass === 'bond' || s.assetClass === 'etf');
  }
}

function isLiveSource(source?: DataSourceKind): boolean {
  return source === 'binance' || source === 'yahoo';
}

function heatmapTileBg(pct: number): string {
  if (pct >= 2) return 'var(--tv-hm-pos-4)';
  if (pct >= 0.75) return 'var(--tv-hm-pos-3)';
  if (pct > 0) return 'var(--tv-hm-pos-2)';
  if (pct <= -2) return 'var(--tv-hm-neg-4)';
  if (pct <= -0.75) return 'var(--tv-hm-neg-3)';
  if (pct < 0) return 'var(--tv-hm-neg-2)';
  return 'var(--tv-hm-neutral)';
}

export const MarketsPage: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();

  const [category, setCategory] = useState<MarketShowcaseCategory>('indices');
  const [selectedTicker, setSelectedTicker] = useState<string>('FTSEMIB');
  const [rangeKey, setRangeKey] = useState<MiniRangeKey>('1M');
  const [chartStyle, setChartStyle] = useState<'area' | 'candles'>('area');
  const [newsFilter, setNewsFilter] = useState<'all' | NewsItem['category']>('all');
  const [hydratedCandles, setHydratedCandles] = useState<{
    key: string;
    candles: Candle[];
    source: DataSourceKind;
  } | null>(null);

  const marketCategories = useMemo(
    () => [
      { key: 'indices' as const, label: `Indici (${symbolsForCategory('indices').length})` },
      { key: 'italy' as const, label: `Azioni Italiane (${symbolsForCategory('italy').length})` },
      { key: 'us' as const, label: `Azioni USA (${symbolsForCategory('us').length})` },
      { key: 'crypto' as const, label: `Cripto Live (${symbolsForCategory('crypto').length})` },
      { key: 'forex' as const, label: `Forex (${symbolsForCategory('forex').length})` },
      { key: 'futures' as const, label: `Futures (${symbolsForCategory('futures').length})` },
      {
        key: 'bonds_etf' as const,
        label: `Obbligazioni & ETF (${symbolsForCategory('bonds_etf').length})`,
      },
    ],
    [],
  );

  const categorySymbols = useMemo(() => symbolsForCategory(category), [category]);

  const activeSymbol = useMemo(
    () => categorySymbols.find((s) => s.ticker === selectedTicker) ?? categorySymbols[0] ?? SYMBOLS[0],
    [categorySymbols, selectedTicker],
  );

  const activeQuote = quotes[activeSymbol.ticker];
  const activePrice = activeQuote?.price ?? activeSymbol.basePrice;
  const activeChangePct =
    activeQuote?.changePercent ??
    ((activeSymbol.basePrice - activeSymbol.prevClose) / activeSymbol.prevClose) * 100;
  const activeSource: DataSourceKind = activeQuote?.source ?? 'simulated';

  const seriesKey = `${activeSymbol.ticker}|${rangeKey}`;

  useEffect(() => {
    let cancelled = false;
    const spec = RANGE_SPECS[rangeKey];
    fetchRealCandles(activeSymbol, spec.timeframe)
      .then((res) => {
        if (cancelled || !res || res.candles.length < 2) return;
        setHydratedCandles({
          key: seriesKey,
          candles: res.candles.slice(-spec.count),
          source: res.source,
        });
      })
      .catch(() => {
        // Keep snapshot/local candles on network error
      });
    return () => {
      cancelled = true;
    };
  }, [activeSymbol, rangeKey, seriesKey]);

  const showcaseCandles = useMemo(() => {
    if (hydratedCandles && hydratedCandles.key === seriesKey) {
      return hydratedCandles.candles;
    }
    const spec = RANGE_SPECS[rangeKey];
    return getCandlesForSymbol(activeSymbol.ticker, spec.timeframe, spec.count);
  }, [hydratedCandles, seriesKey, activeSymbol.ticker, rangeKey, activeSource]);

  const effectiveSource: DataSourceKind =
    hydratedCandles?.key === seriesKey ? hydratedCandles.source : activeSource;

  const italianTrends = useMemo(() => {
    const picks = ['RACE', 'UCG', 'ISP', 'ENI', 'LDO'];
    return picks
      .map((t) => SYMBOLS.find((s) => s.ticker === t))
      .filter((s): s is SymbolInfo => Boolean(s));
  }, []);

  const raceSource = quotes['RACE']?.source;

  const trendSparks = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of italianTrends) {
      map.set(s.ticker, generateSparkline(s, 22));
    }
    return map;
  }, [italianTrends, raceSource]);

  const leaderboards = useMemo(() => {
    const rows = SYMBOLS.map((sym) => {
      const q = quotes[sym.ticker];
      const price = q?.price ?? sym.basePrice;
      const changePercent =
        q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
      const volume = q?.volume ?? sym.avgVolume;
      return { sym, price, changePercent, volume, source: q?.source };
    });

    return {
      gainers: [...rows].sort((a, b) => b.changePercent - a.changePercent).slice(0, 6),
      losers: [...rows].sort((a, b) => a.changePercent - b.changePercent).slice(0, 6),
      volumes: [...rows].sort((a, b) => b.volume - a.volume).slice(0, 6),
    };
  }, [quotes]);

  const filteredNews = useMemo(() => {
    if (newsFilter === 'all') return FINANCIAL_NEWS;
    return FINANCIAL_NEWS.filter((n) => n.category === newsFilter);
  }, [newsFilter]);

  const handleCategoryChange = (next: MarketShowcaseCategory) => {
    setCategory(next);
    const first = symbolsForCategory(next)[0];
    if (first) {
      setSelectedTicker(first.ticker);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--tv-body-bg)' }}>
      <SiteHeader />

      <main className="tv-container">
        {/* 1. Mercati, ovunque Hero */}
        <section className="tv-markets-hero">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="tv-live-badge">
              <span className="tv-live-dot" />
              {SYMBOLS.length} STRUMENTI REALI
            </span>
          </div>
          <h1 className="tv-heading-1" style={{ marginBottom: 12 }}>
            Mercati, ovunque
          </h1>
          <p
            className="tv-text-secondary"
            style={{ fontSize: 16, maxWidth: 680, margin: '0 auto 24px' }}
          >
            Monitora 78 criptovalute live Binance, 95 azioni USA NASDAQ/NYSE, 20 titoli di Borsa
            Italiana, indici globali, forex, futures, obbligazioni ed ETF in tempo reale.
          </p>

          {/* 7 Category Pill Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="tv-sticky-pillbar tv-no-scrollbar" role="tablist">
              {marketCategories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={category === cat.key}
                  className={`tv-sticky-pill-item${category === cat.key ? ' is-active' : ''}`}
                  onClick={() => handleCategoryChange(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Big Interactive Showcase Chart */}
        <section id="markets-showcase" style={{ paddingBottom: 32 }}>
          <div className="tv-card">
            <div className="tv-markets-pill-row tv-no-scrollbar">
              {categorySymbols.slice(0, 8).map((sym) => {
                const q = quotes[sym.ticker];
                const price = q?.price ?? sym.basePrice;
                const pct =
                  q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                const isPos = pct >= 0;
                const selected = sym.ticker === activeSymbol.ticker;
                const live = isLiveSource(q?.source);

                return (
                  <button
                    key={sym.id}
                    type="button"
                    className={`tv-markets-symbol-pill${selected ? ' is-active' : ''}`}
                    onClick={() => setSelectedTicker(sym.ticker)}
                  >
                    <span
                      className="tv-symbol-avatar"
                      style={{ backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                        <span>{sym.shortName}</span>
                        {live && <span className="tv-live-dot" title="Flusso live" />}
                      </div>
                      <div className="tv-num" style={{ fontSize: 12, marginTop: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                          {formatPrice(price, sym.precision)}
                        </span>{' '}
                        <span style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>
                          {sym.currency}
                        </span>{' '}
                        <span className={isPos ? 'tv-delta-up' : 'tv-delta-down'}>
                          {formatPercent(pct)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 16, color: 'var(--tv-text-heading)' }}>
                  {activeSymbol.name}
                </strong>
                <span className="tv-ticker-badge">
                  {activeSymbol.exchange}:{activeSymbol.ticker}
                </span>
                {isLiveSource(effectiveSource) ? (
                  <span className="tv-live-badge">
                    <span className="tv-live-dot" />
                    {effectiveSource === 'binance' ? 'LIVE BINANCE' : 'LIVE YAHOO'}
                  </span>
                ) : effectiveSource === 'snapshot' ? (
                  <span className="tv-real-badge">DATI REALI YAHOO</span>
                ) : null}
              </div>

              <div className="tv-num" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                  {formatPrice(activePrice, activeSymbol.precision)}{' '}
                  <span style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                    {activeSymbol.currency}
                  </span>
                </span>
                <span
                  className={activeChangePct >= 0 ? 'tv-delta-up' : 'tv-delta-down'}
                  style={{ fontSize: 14, fontWeight: 700 }}
                >
                  {formatPercent(activeChangePct)}
                </span>
              </div>
            </div>

            <MiniAreaChart
              candles={showcaseCandles}
              livePrice={activePrice}
              precision={activeSymbol.precision}
              currency={activeSymbol.currency}
              rangeKey={rangeKey}
              chartStyle={chartStyle}
              isPositive={activeChangePct >= 0}
              height={330}
            />

            <div className="tv-mini-chart-footer" style={{ marginTop: 10 }}>
              <div className="tv-range-pills" role="group" aria-label="Intervallo grafico mercati">
                {RANGE_KEYS.map((rk) => (
                  <button
                    key={rk}
                    type="button"
                    className={`tv-range-pill${rangeKey === rk ? ' is-active' : ''}`}
                    onClick={() => setRangeKey(rk)}
                  >
                    {rk}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="tv-segmented" role="group" aria-label="Stile grafico">
                  <button
                    type="button"
                    className={`tv-segmented-btn${chartStyle === 'area' ? ' is-active' : ''}`}
                    onClick={() => setChartStyle('area')}
                    title="Grafico Area"
                  >
                    <TrendingUp size={14} style={{ marginRight: 4 }} />
                    Area
                  </button>
                  <button
                    type="button"
                    className={`tv-segmented-btn${chartStyle === 'candles' ? ' is-active' : ''}`}
                    onClick={() => setChartStyle('candles')}
                    title="Grafico a Candele"
                  >
                    <CandlestickChart size={14} style={{ marginRight: 4 }} />
                    Candele
                  </button>
                </div>

                <button
                  type="button"
                  className="tv-btn tv-btn-primary tv-btn-sm"
                  onClick={() => openSymbolInChart(activeSymbol.ticker)}
                >
                  <Maximize2 size={13} />
                  <span>Apri su Supercharts</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Tendenze della community — Borsa Italiana */}
        <section id="markets-italy" className="tv-section" style={{ paddingTop: 12 }}>
          <div className="tv-section-header">
            <h2 className="tv-heading-2">Tendenze della community · Borsa Italiana</h2>
            <button
              type="button"
              className="tv-section-link"
              onClick={() => navigate('screener')}
            >
              <span>Tutti i 20 titoli MIL</span>
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="tv-grid-5">
            {italianTrends.map((sym) => {
              const q = quotes[sym.ticker];
              const price = q?.price ?? sym.basePrice;
              const pct =
                q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
              const isPos = pct >= 0;

              return (
                <button
                  key={sym.id}
                  type="button"
                  className="tv-card-compact tv-card-interactive"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}
                  onClick={() => openSymbolInChart(sym.ticker)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                        <span>{sym.ticker}</span>
                        {isLiveSource(q?.source) && <span className="tv-live-dot" />}
                      </div>
                      <div className="tv-truncate" style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                        {sym.name}
                      </div>
                    </div>
                  </div>

                  <SparklineSvg
                    values={trendSparks.get(sym.ticker) ?? []}
                    isPositive={isPos}
                    width={180}
                    height={34}
                  />

                  <div
                    className="tv-num"
                    style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                      {formatPrice(price, sym.precision)} {sym.currency}
                    </span>
                    <span className={isPos ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 13 }}>
                      {formatPercent(pct)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. Live Asset-Class Leaderboards across all 222 symbols */}
        <section className="tv-section" style={{ paddingTop: 12 }}>
          <div className="tv-bento-3">
            {/* Rialzi */}
            <div className="tv-card">
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tv-text-heading)', marginBottom: 12 }}>
                Migliori rialzi (222 mercati)
              </div>
              {leaderboards.gainers.map(({ sym, price, changePercent, source }) => (
                <button
                  key={sym.id}
                  type="button"
                  className="tv-row tv-row-bordered"
                  style={{ width: '100%', paddingInline: 4 }}
                  onClick={() => openSymbolInChart(sym.ticker)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}
                      >
                        <span className="tv-truncate">{sym.shortName}</span>
                        {isLiveSource(source) && <span className="tv-live-dot" />}
                      </div>
                      <span className="tv-ticker-badge">{sym.ticker}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tv-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                      {formatPrice(price, sym.precision)}
                    </span>
                    <span className="tv-pill-up">{formatPercent(changePercent)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Ribassi */}
            <div className="tv-card">
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tv-text-heading)', marginBottom: 12 }}>
                Peggiori ribassi (222 mercati)
              </div>
              {leaderboards.losers.map(({ sym, price, changePercent, source }) => (
                <button
                  key={sym.id}
                  type="button"
                  className="tv-row tv-row-bordered"
                  style={{ width: '100%', paddingInline: 4 }}
                  onClick={() => openSymbolInChart(sym.ticker)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}
                      >
                        <span className="tv-truncate">{sym.shortName}</span>
                        {isLiveSource(source) && <span className="tv-live-dot" />}
                      </div>
                      <span className="tv-ticker-badge">{sym.ticker}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tv-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                      {formatPrice(price, sym.precision)}
                    </span>
                    <span className={changePercent >= 0 ? 'tv-pill-up' : 'tv-pill-down'}>
                      {formatPercent(changePercent)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Maggiori Volumi */}
            <div className="tv-card">
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--tv-text-heading)', marginBottom: 12 }}>
                Volume più elevato
              </div>
              {leaderboards.volumes.map(({ sym, price, volume, changePercent, source }) => (
                <button
                  key={sym.id}
                  type="button"
                  className="tv-row tv-row-bordered"
                  style={{ width: '100%', paddingInline: 4 }}
                  onClick={() => openSymbolInChart(sym.ticker)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}
                      >
                        <span className="tv-truncate">{sym.shortName}</span>
                        {isLiveSource(source) && <span className="tv-live-dot" />}
                      </div>
                      <span className="tv-ticker-badge">{sym.ticker}</span>
                    </div>
                  </div>
                  <div className="tv-num" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                      Vol {formatVolume(volume)}
                    </div>
                    <div
                      style={{ fontSize: 12 }}
                      className={changePercent >= 0 ? 'tv-delta-up' : 'tv-delta-down'}
                    >
                      {formatPrice(price, sym.precision)} ({formatPercent(changePercent)})
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Rich Real US Stocks & Live Binance Crypto Showcases */}
        <div style={{ marginInline: 'calc(-1 * var(--tv-container-pad))' }}>
          <UsStocksSection />
          <LiveCryptoSection />
        </div>

        {/* 6. Heatmap & Screener Interactive Preview Banners */}
        <section className="tv-section" style={{ paddingTop: 12 }}>
          <div className="tv-bento-2">
            {/* Heatmap Preview Banner */}
            <div className="tv-feature-promo-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <LayoutGrid size={18} color="#2962FF" />
                  <h3 className="tv-heading-3">Heatmap Azioni &amp; Cripto</h3>
                </div>
                <p className="tv-text-secondary" style={{ fontSize: 13, marginBottom: 14 }}>
                  Visualizza istantaneamente la rotazione settoriale ponderata per capitalizzazione
                  su Piazza Affari, Wall Street e mercato cripto.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 6,
                  }}
                >
                  {HEATMAP_SECTORS.map((sec) => (
                    <div
                      key={sec.id}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 'var(--tv-radius-md)',
                        backgroundColor: heatmapTileBg(sec.avgChangePercent),
                        color: '#ffffff',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{sec.name}</div>
                      <div className="tv-num" style={{ fontSize: 11, opacity: 0.92 }}>
                        {formatPercent(sec.avgChangePercent)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="tv-btn tv-btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => navigate('heatmap')}
              >
                <span>Apri Heatmap completa</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Screener Preview Banner */}
            <div className="tv-feature-promo-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Filter size={18} color="#089981" />
                  <h3 className="tv-heading-3">Screener Azioni, Cripto &amp; Forex</h3>
                </div>
                <p className="tv-text-secondary" style={{ fontSize: 13, marginBottom: 14 }}>
                  Filtra tutti i {SYMBOLS.length} strumenti reali (78 Cripto Binance, 95 Azioni
                  USA, 20 Borsa Italiana, 29 Macro) per RSI(14), rating tecnico, capitalizzazione e
                  variazione percentuale.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    'Italia MIL (20 titoli)',
                    'Azioni USA (95 titoli)',
                    'Cripto Live Binance (78)',
                    'Top Rialzi Giornalieri',
                    'Ipervenduto RSI < 35',
                    'Obbligazioni & ETF',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="tv-btn tv-btn-pill tv-btn-sm"
                      onClick={() => navigate('screener')}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="tv-btn tv-btn-contrast"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => navigate('screener')}
              >
                <span>Apri Screener completo</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* 7. Latest Italian Market News */}
        <section id="markets-news" className="tv-section">
          <div className="tv-section-header">
            <h2 className="tv-heading-2">Ultime notizie dai mercati</h2>
            <div className="tv-tabs" role="tablist">
              {NEWS_FILTERS.map((nf) => (
                <button
                  key={nf.key}
                  type="button"
                  role="tab"
                  aria-selected={newsFilter === nf.key}
                  className={`tv-tab${newsFilter === nf.key ? ' is-active' : ''}`}
                  onClick={() => setNewsFilter(nf.key)}
                >
                  {nf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tv-bento-3">
            {filteredNews.map((item) => (
              <article key={item.id} className="tv-news-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--tv-text-muted)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--tv-text-secondary)' }}>
                    {item.source} · {item.publishedAgo}
                  </span>
                  <span className="tv-micro-badge">{item.category}</span>
                </div>

                <button
                  type="button"
                  className="tv-idea-card__title tv-line-clamp-2"
                  style={{ fontSize: 15 }}
                  onClick={() => {
                    const first = item.relatedTickers[0];
                    if (first) openSymbolInChart(first);
                  }}
                >
                  {item.title}
                </button>

                <p className="tv-text-secondary tv-line-clamp-3" style={{ fontSize: 13 }}>
                  {item.summary}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                  {item.relatedTickers.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="tv-ticker-badge"
                      onClick={() => openSymbolInChart(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};
