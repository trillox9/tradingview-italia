import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { AssetClass, Candle, DataSourceKind, SymbolInfo, Timeframe } from '../../types';
import {
  fetchRealCandles,
  formatPercent,
  formatPrice,
  generateSparkline,
  getCandlesForSymbol,
  getSymbolsByAssetClass,
} from '../../data';
import { useQuotes, useTradingView } from '../../store';
import { MiniAreaChart, type MiniRangeKey } from './MiniAreaChart';
import { SparklineSvg } from './SparklineSvg';

interface CategoryTab {
  key: AssetClass;
  label: string;
  allLinkLabel: string;
}

const SUMMARY_TABS: CategoryTab[] = [
  { key: 'index', label: 'Indici', allLinkLabel: 'Vedi tutti gli indici principali' },
  { key: 'stock', label: 'Azioni', allLinkLabel: 'Vedi tutte le azioni' },
  { key: 'crypto', label: 'Cripto', allLinkLabel: 'Vedi tutte le criptovalute' },
  { key: 'futures', label: 'Futures', allLinkLabel: 'Vedi tutti i futures' },
  { key: 'forex', label: 'Forex', allLinkLabel: 'Vedi tutte le valute' },
  { key: 'bond', label: 'Obbligazioni', allLinkLabel: 'Vedi tutte le obbligazioni' },
  { key: 'etf', label: 'ETF', allLinkLabel: 'Vedi tutti gli ETF' },
];

const RANGE_SPECS: Record<MiniRangeKey, { timeframe: Timeframe; count: number }> = {
  '1G': { timeframe: '5m', count: 78 },
  '1M': { timeframe: '1D', count: 30 },
  '3M': { timeframe: '1D', count: 65 },
  '1A': { timeframe: '1D', count: 180 },
  '5A': { timeframe: '1W', count: 160 },
  Tutto: { timeframe: '1M', count: 96 },
};

const RANGE_KEYS: MiniRangeKey[] = ['1G', '1M', '3M', '1A', '5A', 'Tutto'];

const YIELD_CURVE_POINTS = [
  { tenor: '1M', yieldPct: 4.32 },
  { tenor: '3Y', yieldPct: 4.18 },
  { tenor: '7Y', yieldPct: 4.29 },
  { tenor: '10Y', yieldPct: 4.41 },
  { tenor: '20Y', yieldPct: 4.68 },
  { tenor: '30Y', yieldPct: 4.64 },
];

const COMMODITY_UNITS: Record<string, string> = {
  'GC1!': 'USD / oncia troy',
  'CL1!': 'USD / barile',
  'SI1!': 'USD / oncia troy',
  'NG1!': 'USD / MMBtu',
  'HG1!': 'USD / lb',
};

function isLiveSource(source?: DataSourceKind): boolean {
  return source === 'binance' || source === 'yahoo';
}

export const MarketSummarySection: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();

  const [activeTab, setActiveTab] = useState<AssetClass>('index');
  const [selectedTicker, setSelectedTicker] = useState<string>('FTSEMIB');
  const [rangeKey, setRangeKey] = useState<MiniRangeKey>('1M');
  const [hydratedCandles, setHydratedCandles] = useState<{
    key: string;
    candles: Candle[];
    source: DataSourceKind;
  } | null>(null);

  const tabSymbols = useMemo(() => {
    const list = getSymbolsByAssetClass(activeTab);
    if (activeTab === 'stock') {
      const priority = ['RACE', 'UCG', 'ISP', 'NVDA', 'AAPL', 'MSFT'];
      const map = new Map(list.map((s) => [s.ticker, s]));
      const ordered: SymbolInfo[] = [];
      for (const t of priority) {
        const s = map.get(t);
        if (s) ordered.push(s);
      }
      for (const s of list) {
        if (!ordered.includes(s)) ordered.push(s);
      }
      return ordered.slice(0, 6);
    }
    if (activeTab === 'crypto') {
      const priority = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
      const map = new Map(list.map((s) => [s.ticker, s]));
      const ordered = priority
        .map((t) => map.get(t))
        .filter((s): s is SymbolInfo => Boolean(s));
      return ordered.length >= 6 ? ordered : list.slice(0, 6);
    }
    return list.slice(0, 6);
  }, [activeTab]);

  const activeSymbol: SymbolInfo = useMemo(() => {
    return (
      tabSymbols.find((s) => s.ticker === selectedTicker) ??
      tabSymbols[0] ??
      getSymbolsByAssetClass('index')[0]
    );
  }, [tabSymbols, selectedTicker]);

  const activeQuote = quotes[activeSymbol.ticker];
  const activePrice = activeQuote?.price ?? activeSymbol.basePrice;
  const activeChangePct =
    activeQuote?.changePercent ??
    ((activeSymbol.basePrice - activeSymbol.prevClose) / activeSymbol.prevClose) * 100;
  const activePositive = activeChangePct >= 0;
  const activeSource: DataSourceKind = activeQuote?.source ?? 'simulated';

  const seriesKey = `${activeSymbol.ticker}|${rangeKey}`;

  // Proactively hydrate real Binance / Yahoo candles for the selected showcase symbol
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
        // Silently keep snapshot/local candles
      });
    return () => {
      cancelled = true;
    };
  }, [activeSymbol, rangeKey, seriesKey]);

  const activeCandles = useMemo(() => {
    if (hydratedCandles && hydratedCandles.key === seriesKey) {
      return hydratedCandles.candles;
    }
    const spec = RANGE_SPECS[rangeKey];
    return getCandlesForSymbol(activeSymbol.ticker, spec.timeframe, spec.count);
  }, [hydratedCandles, seriesKey, activeSymbol.ticker, rangeKey, activeSource]);

  const cryptoLeaders = useMemo(
    () => getSymbolsByAssetClass('crypto').slice(0, 2),
    [],
  );
  const futuresLeaders = useMemo(
    () => getSymbolsByAssetClass('futures').slice(0, 4),
    [],
  );
  const bondLeaders = useMemo(() => getSymbolsByAssetClass('bond').slice(0, 2), []);

  const btcQuote = quotes['BTCUSDT'];
  const goldQuote = quotes['GC1!'];

  const btcSpark = useMemo(() => {
    const base = generateSparkline('BTCUSDT', 32);
    if (btcQuote && base.length > 0) {
      return [...base.slice(0, -1), btcQuote.price];
    }
    return base;
  }, [btcQuote?.source, btcQuote?.price]);

  const goldSpark = useMemo(() => {
    const base = generateSparkline('GC1!', 32);
    if (goldQuote && base.length > 0) {
      return [...base.slice(0, -1), goldQuote.price];
    }
    return base;
  }, [goldQuote?.source, goldQuote?.price]);

  const handleSelectTab = (tab: AssetClass) => {
    setActiveTab(tab);
    const list = getSymbolsByAssetClass(tab);
    const first =
      tab === 'stock'
        ? list.find((s) => s.ticker === 'RACE') ?? list[0]
        : list[0];
    if (first) {
      setSelectedTicker(first.ticker);
    }
  };

  const activeTabMeta =
    SUMMARY_TABS.find((t) => t.key === activeTab) ?? SUMMARY_TABS[0];

  const effectiveSource: DataSourceKind =
    hydratedCandles?.key === seriesKey ? hydratedCandles.source : activeSource;

  const statusLabel =
    activeSymbol.marketStatus === '24x7'
      ? 'Mercato 24/7'
      : activeSymbol.marketStatus === 'open'
        ? 'Mercato aperto'
        : 'Mercato chiuso';

  return (
    <section id="home-summary" className="tv-section">
      <div className="tv-container">
        <div className="tv-section-header">
          <button
            type="button"
            className="tv-section-heading"
            onClick={() => navigate('markets')}
          >
            <span>Panoramica mercato</span>
            <ChevronRight size={24} />
          </button>
          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('markets')}
          >
            <span>Esplora tutti i 222 mercati</span>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Asset Class Tabs (Indici | Azioni | Cripto | Futures | Forex | Obbligazioni | ETF) */}
        <div className="tv-summary-tabs" role="tablist" aria-label="Categorie di mercato">
          {SUMMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`tv-tab${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => handleSelectTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 1: Asymmetric Bento — Featured Interactive Chart + Right Leaderboard Card */}
        <div className="tv-bento-asymmetric">
          {/* Left Featured Chart Card */}
          <div className="tv-card tv-featured-chart-card">
            <div className="tv-featured-chart-head">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span
                  className="tv-symbol-avatar"
                  style={{
                    width: 42,
                    height: 42,
                    fontSize: 13,
                    backgroundColor: activeSymbol.logoColor,
                  }}
                >
                  {activeSymbol.logoText}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: 'var(--tv-text-heading)',
                        marginRight: 2,
                      }}
                      onClick={() => openSymbolInChart(activeSymbol.ticker)}
                    >
                      {activeSymbol.name}
                    </button>
                    <span className="tv-ticker-pill" style={{ flexShrink: 0 }}>
                      {activeSymbol.ticker}
                    </span>
                    {isLiveSource(effectiveSource) ? (
                      <span
                        className="tv-live-badge"
                        title={`Dati live da ${effectiveSource === 'binance' ? 'Binance' : 'Yahoo Finance'}`}
                      >
                        <span className="tv-live-dot" />
                        LIVE
                      </span>
                    ) : effectiveSource === 'snapshot' ? (
                      <span className="tv-real-badge" title="Snapshot reale Yahoo Finance">
                        REALE
                      </span>
                    ) : (
                      <span
                        className="tv-micro-badge"
                        style={{
                          flexShrink: 0,
                          color:
                            activeSymbol.marketStatus === 'closed'
                              ? 'var(--tv-text-secondary)'
                              : 'var(--tv-up)',
                          backgroundColor:
                            activeSymbol.marketStatus === 'closed'
                              ? 'var(--tv-bg-chip)'
                              : 'var(--tv-up-bg)',
                        }}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  <div className="tv-featured-price-row tv-num">
                    <span className="tv-featured-price">
                      {formatPrice(activePrice, activeSymbol.precision)}
                    </span>
                    <span className="tv-featured-unit">{activeSymbol.currency}</span>
                    <span
                      className={`tv-featured-delta ${
                        activePositive ? 'tv-delta-up' : 'tv-delta-down'
                      }`}
                    >
                      {formatPercent(activeChangePct)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="tv-btn tv-btn-secondary tv-btn-sm"
                onClick={() => openSymbolInChart(activeSymbol.ticker)}
              >
                <span>Apri su Supercharts</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <MiniAreaChart
              candles={activeCandles}
              livePrice={activePrice}
              precision={activeSymbol.precision}
              currency={activeSymbol.currency}
              rangeKey={rangeKey}
              isPositive={activePositive}
              height={264}
            />

            <div className="tv-mini-chart-footer">
              <div className="tv-range-pills" role="group" aria-label="Intervallo grafico">
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
              <span className="tv-text-muted" style={{ fontSize: 12 }}>
                {activeSymbol.exchange}:{activeSymbol.ticker} • Passa il cursore per i dettagli
              </span>
            </div>
          </div>

          {/* Right List Card (Indici principali / Category Leaders) */}
          <div
            className="tv-card"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--tv-text-heading)',
                  marginBottom: 12,
                }}
              >
                {activeTab === 'index' ? 'Indici principali' : `${activeTabMeta.label} in evidenza`}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {tabSymbols.map((sym) => {
                  const q = quotes[sym.ticker];
                  const price = q?.price ?? sym.basePrice;
                  const pct =
                    q?.changePercent ??
                    ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                  const isPos = pct >= 0;
                  const isSelected = sym.ticker === activeSymbol.ticker;
                  const live = isLiveSource(q?.source);

                  return (
                    <button
                      key={sym.id}
                      type="button"
                      className="tv-row tv-row-bordered"
                      style={{
                        backgroundColor: isSelected ? 'var(--tv-bg-hover)' : undefined,
                        borderRadius: isSelected ? 'var(--tv-radius-md)' : undefined,
                        paddingInline: 8,
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onClick={() => setSelectedTicker(sym.ticker)}
                      onDoubleClick={() => openSymbolInChart(sym.ticker)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span
                          className="tv-symbol-avatar"
                          style={{ backgroundColor: sym.logoColor }}
                        >
                          {sym.logoText}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="tv-truncate"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--tv-text-heading)',
                            }}
                          >
                            <span className="tv-truncate">{sym.shortName}</span>
                            {live && <span className="tv-live-dot" title="Flusso live" />}
                          </div>
                          <span className="tv-ticker-pill" style={{ marginTop: 3 }}>
                            {sym.ticker}
                          </span>
                        </div>
                      </div>

                      <div className="tv-num" style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--tv-text-heading)',
                          }}
                        >
                          {formatPrice(price, sym.precision)}{' '}
                          <span style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>
                            {sym.currency}
                          </span>
                        </div>
                        <div
                          className={isPos ? 'tv-delta-up' : 'tv-delta-down'}
                          style={{ fontSize: 13 }}
                        >
                          {formatPercent(pct)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--tv-border-subtle)' }}>
              <button
                type="button"
                className="tv-section-link"
                onClick={() => navigate('markets')}
              >
                <span>{activeTabMeta.allLinkLabel}</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Live Interactive Ticker Cards Strip below chart */}
        <div className="tv-ticker-strip">
          {tabSymbols.map((sym) => {
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
                className={`tv-ticker-card${selected ? ' is-selected' : ''}`}
                onClick={() => setSelectedTicker(sym.ticker)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 26, height: 26, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <span
                      className="tv-truncate"
                      style={{ fontWeight: 600, fontSize: 13, color: 'var(--tv-text-heading)' }}
                    >
                      {sym.shortName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {live && <span className="tv-live-dot" title="Live" />}
                    <span className="tv-ticker-pill">{sym.ticker}</span>
                  </div>
                </div>

                <div
                  className="tv-num"
                  style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    {formatPrice(price, sym.precision)}
                  </span>
                  <span className={isPos ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 13 }}>
                    {formatPercent(pct)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Row 2: 3-Column Bento Strip (Dominanza Cripto | Materie Prime | Curva Rendimenti & BTP/US10Y) */}
        <div className="tv-bento-3" style={{ marginTop: 20 }}>
          {/* Bento Card 1: Dominanza Cripto */}
          <div className="tv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                Capitalizzazione cripto
              </span>
              <span className="tv-live-badge">
                <span className="tv-live-dot" />
                78 LIVE
              </span>
            </div>

            <div className="tv-num" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                3,14 T <span style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>USD</span>
              </span>
              <span
                className={(btcQuote?.changePercent ?? 0) >= 0 ? 'tv-delta-up' : 'tv-delta-down'}
                style={{ fontSize: 13 }}
              >
                {formatPercent(btcQuote?.changePercent ?? 2.18)}
              </span>
            </div>

            <SparklineSvg
              values={btcSpark}
              isPositive={(btcQuote?.changePercent ?? 0) >= 0}
              width={340}
              height={64}
            />

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                Dominanza Cripto
              </div>
              <div className="tv-dominance-legend tv-num">
                <div>
                  <div style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                    <span style={{ color: '#2962FF' }}>●</span> Bitcoin
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    58,98%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                    <span style={{ color: '#089981' }}>●</span> Ethereum
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    10,84%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                    <span style={{ color: '#F23645' }}>●</span> Altri
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    30,18%
                  </div>
                </div>
              </div>
              <div className="tv-dominance-bar" aria-label="Dominanza Bitcoin 58.98%, Ethereum 10.84%, Altri 30.18%">
                <div style={{ width: '58.98%', backgroundColor: '#2962FF' }} />
                <div style={{ width: '10.84%', backgroundColor: '#089981' }} />
                <div style={{ width: '30.18%', backgroundColor: '#F23645' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {cryptoLeaders.map((sym) => {
                const q = quotes[sym.ticker];
                const price = q?.price ?? sym.basePrice;
                const pct =
                  q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                return (
                  <button
                    key={sym.id}
                    type="button"
                    className="tv-row"
                    style={{ padding: '7px 6px', width: '100%' }}
                    onClick={() => openSymbolInChart(sym.ticker)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="tv-symbol-avatar"
                        style={{ width: 26, height: 26, fontSize: 10, backgroundColor: sym.logoColor }}
                      >
                        {sym.logoText}
                      </span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                          <span>{sym.shortName}</span>
                          {isLiveSource(q?.source) && <span className="tv-live-dot" />}
                        </div>
                        <span className="tv-ticker-pill">{sym.ticker}</span>
                      </div>
                    </div>
                    <div className="tv-num" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                        {formatPrice(price, sym.precision)}
                      </div>
                      <div className={pct >= 0 ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 12 }}>
                        {formatPercent(pct)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="tv-section-link"
              style={{ marginTop: 'auto' }}
              onClick={() => navigate('markets')}
            >
              <span>Vedi tutte le 78 criptovalute</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Bento Card 2: Materie Prime */}
          <div className="tv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                Materie prime e Futures
              </span>
              <span className="tv-ticker-pill">COMEX / NYMEX</span>
            </div>

            <SparklineSvg
              values={goldSpark}
              isPositive={(goldQuote?.changePercent ?? 0) >= 0}
              width={340}
              height={64}
            />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {futuresLeaders.map((sym) => {
                const q = quotes[sym.ticker];
                const price = q?.price ?? sym.basePrice;
                const pct =
                  q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                return (
                  <button
                    key={sym.id}
                    type="button"
                    className="tv-row tv-row-bordered"
                    style={{ width: '100%', paddingInline: 6 }}
                    onClick={() => openSymbolInChart(sym.ticker)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="tv-symbol-avatar"
                        style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                      >
                        {sym.logoText}
                      </span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                          <span>{sym.shortName}</span>
                          {isLiveSource(q?.source) && <span className="tv-live-dot" />}
                        </div>
                        <span className="tv-ticker-pill">{sym.ticker}</span>
                      </div>
                    </div>
                    <div className="tv-num" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                        {formatPrice(price, sym.precision)}{' '}
                        <span style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>
                          {COMMODITY_UNITS[sym.ticker] ?? sym.currency}
                        </span>
                      </div>
                      <div className={pct >= 0 ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 12 }}>
                        {formatPercent(pct)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="tv-section-link"
              style={{ marginTop: 'auto' }}
              onClick={() => navigate('markets')}
            >
              <span>Vedi tutti i futures</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Bento Card 3: Curva dei rendimenti / BTP & US10Y */}
          <div className="tv-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                Curva dei rendimenti USA
              </span>
              <span className="tv-micro-badge">TREASURY</span>
            </div>

            {/* 6-point Yield Curve SVG */}
            <svg viewBox="0 0 320 116" width="100%" height="116" aria-label="Curva dei rendimenti USA">
              {[24, 58, 92].map((y, idx) => (
                <g key={y}>
                  <line x1="34" x2="310" y1={y} y2={y} stroke="var(--tv-border-subtle)" />
                  <text x="0" y={y + 4} fill="var(--tv-text-muted)" fontSize="10" className="tv-num">
                    {idx === 0 ? '5,0%' : idx === 1 ? '4,5%' : '4,0%'}
                  </text>
                </g>
              ))}
              {(() => {
                const xs = [46, 98, 150, 200, 254, 302];
                const toY = (pct: number) => 92 - ((pct - 4.0) / 1.0) * 68;
                const d = YIELD_CURVE_POINTS.map(
                  (pt, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${toY(pt.yieldPct).toFixed(1)}`,
                ).join(' ');
                return (
                  <>
                    <path d={d} fill="none" stroke="#2962FF" strokeWidth="2.2" />
                    {YIELD_CURVE_POINTS.map((pt, i) => (
                      <g key={pt.tenor}>
                        <circle
                          cx={xs[i]}
                          cy={toY(pt.yieldPct)}
                          r="4"
                          fill="#2962FF"
                          stroke="var(--tv-bg-primary)"
                          strokeWidth="1.5"
                        />
                        <text
                          x={xs[i]}
                          y="112"
                          textAnchor="middle"
                          fill="var(--tv-text-muted)"
                          fontSize="10"
                        >
                          {pt.tenor}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
              Titoli di Stato — BTP 10Y &amp; US 10Y
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bondLeaders.map((sym) => {
                const q = quotes[sym.ticker];
                const price = q?.price ?? sym.basePrice;
                const pct =
                  q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                const fillWidth = Math.min(92, Math.max(25, (price / 6) * 100));
                return (
                  <button
                    key={sym.id}
                    type="button"
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 'var(--tv-radius-md)',
                      backgroundColor: 'var(--tv-bg-subtle)',
                      width: '100%',
                    }}
                    onClick={() => openSymbolInChart(sym.ticker)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="tv-symbol-avatar"
                          style={{ width: 24, height: 24, fontSize: 9, backgroundColor: sym.logoColor }}
                        >
                          {sym.logoText}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                          {sym.name}
                        </span>
                      </div>
                      <span className="tv-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                        {formatPrice(price, sym.precision)}%
                      </span>
                    </div>
                    <div
                      className="tv-num"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        marginTop: 4,
                        color: 'var(--tv-text-secondary)',
                      }}
                    >
                      <span>{sym.ticker} • Rendimento benchmark</span>
                      <span className={pct >= 0 ? 'tv-delta-up' : 'tv-delta-down'}>
                        {formatPercent(pct)}
                      </span>
                    </div>
                    <div className="tv-yield-bar">
                      <div style={{ width: `${fillWidth}%`, backgroundColor: '#2962FF' }} />
                      <div style={{ width: '12%', backgroundColor: '#FF9800' }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="tv-section-link"
              style={{ marginTop: 'auto' }}
              onClick={() => navigate('markets')}
            >
              <span>Vedi tutte le obbligazioni</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
