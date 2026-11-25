import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AssetClass, DataSourceKind, RatingLabel, SymbolInfo } from '../../types';
import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
  generateSparkline,
  getCandlesForSymbol,
  getSymbolsByAssetClass,
  SYMBOLS,
} from '../../data';
import { calculateTechnicalSummary } from '../../engine';
import { useQuotes, useTradingView } from '../../store';
import { SparklineSvg } from './SparklineSvg';

type ItalianStocksTab = 'active' | 'gainers' | 'losers';
type UsStocksTab = 'active' | 'gainers' | 'losers' | 'tech';
type CryptoTab = 'active' | 'gainers' | 'losers' | 'subcent';

function ratingBadgeClass(rating: RatingLabel): string {
  if (rating === 'Forte acquisto' || rating === 'Acquisto') return 'tv-rating-pill--buy';
  if (rating === 'Forte vendita' || rating === 'Vendita') return 'tv-rating-pill--sell';
  return 'tv-rating-pill--neutral';
}

function isLiveSource(source?: DataSourceKind): boolean {
  return source === 'binance' || source === 'yahoo';
}

function SourcePill({ source }: { source?: DataSourceKind }) {
  if (isLiveSource(source)) {
    return (
      <span className="tv-live-badge" title={source === 'binance' ? 'Live Binance' : 'Live Yahoo'}>
        <span className="tv-live-dot" />
        LIVE
      </span>
    );
  }
  if (source === 'snapshot') {
    return (
      <span className="tv-real-badge" title="Snapshot reale Yahoo Finance">
        REALE
      </span>
    );
  }
  return null;
}

/**
 * 🇮🇹 Borsa Italiana (MIL) — 20 real Italian .MI stocks with live quotes,
 * sparklines, volumes, and technical ratings.
 */
export const AssetCategorySection: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();
  const [subTab, setSubTab] = useState<ItalianStocksTab>('active');
  const [showAll, setShowAll] = useState(false);

  const italianSymbols = useMemo(
    () => SYMBOLS.filter((s) => s.assetClass === 'stock' && s.exchange === 'MIL'),
    [],
  );

  // Track snapshot hydration via a lightweight source key on a flagship MIL symbol
  const sampleSource = quotes['RACE']?.source;

  const staticMeta = useMemo(() => {
    const map = new Map<string, { spark: number[]; rating: RatingLabel }>();
    for (const sym of italianSymbols) {
      const candles = getCandlesForSymbol(sym.ticker, '1D', 120);
      const summary = calculateTechnicalSummary(candles);
      map.set(sym.ticker, {
        spark: generateSparkline(sym, 24),
        rating: summary.summary.rating,
      });
    }
    return map;
  }, [italianSymbols, sampleSource]);

  const sortedRows = useMemo(() => {
    const enriched = italianSymbols.map((sym) => {
      const q = quotes[sym.ticker];
      const price = q?.price ?? sym.basePrice;
      const changePercent =
        q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
      const volume = q?.volume ?? sym.avgVolume;
      return { sym, price, changePercent, volume, source: q?.source };
    });

    if (subTab === 'gainers') {
      return enriched.sort((a, b) => b.changePercent - a.changePercent);
    }
    if (subTab === 'losers') {
      return enriched.sort((a, b) => a.changePercent - b.changePercent);
    }
    return enriched.sort((a, b) => b.volume * b.price - a.volume * a.price);
  }, [italianSymbols, quotes, subTab]);

  const displayedRows = showAll ? sortedRows : sortedRows.slice(0, 10);

  return (
    <section id="home-italy" className="tv-section">
      <div className="tv-container">
        <div className="tv-section-header">
          <button
            type="button"
            className="tv-section-heading"
            onClick={() => navigate('screener')}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                width: 26,
                height: 26,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <span style={{ flex: 1, backgroundColor: '#008C45' }} />
              <span style={{ flex: 1, backgroundColor: '#F4F5F0' }} />
              <span style={{ flex: 1, backgroundColor: '#CD212A' }} />
            </span>
            <span>Azioni Italiane</span>
            <span className="tv-micro-badge">
              BORSA ITALIANA · {italianSymbols.length} TITOLI
            </span>
            <ChevronRight size={24} />
          </button>

          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('screener')}
          >
            <span>Apri Screener Borsa Italiana</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'active'}
            className={`tv-tab${subTab === 'active' ? ' is-active' : ''}`}
            onClick={() => setSubTab('active')}
          >
            Più attive
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'gainers'}
            className={`tv-tab${subTab === 'gainers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('gainers')}
          >
            Migliori rialzi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'losers'}
            className={`tv-tab${subTab === 'losers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('losers')}
          >
            Peggiori ribassi
          </button>
        </div>

        <div className="tv-card" style={{ padding: '6px 0' }}>
          <div className="tv-stock-table-wrap">
            <table className="tv-stock-table">
              <thead>
                <tr>
                  <th>Simbolo</th>
                  <th className="is-right">Prezzo</th>
                  <th className="is-right">Var %</th>
                  <th className="is-right tv-col-hide-sm">Andamento</th>
                  <th className="is-right tv-col-hide-md">Volume</th>
                  <th className="is-right tv-col-hide-sm">Rating tecnico</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map(({ sym, price, changePercent, volume, source }) => {
                  const meta = staticMeta.get(sym.ticker);
                  const isPos = changePercent >= 0;
                  return (
                    <tr
                      key={sym.id}
                      onClick={() => openSymbolInChart(sym.ticker)}
                      title={`Apri ${sym.name} su Supercharts`}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            className="tv-symbol-avatar"
                            style={{ backgroundColor: sym.logoColor }}
                          >
                            {sym.logoText}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--tv-text-heading)', minWidth: 0 }}>
                              <span className="tv-stock-name">{sym.name}</span>
                              <SourcePill source={source} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span className="tv-ticker-pill">{sym.ticker}</span>
                              <span className="tv-stock-sector-meta" style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                                {sym.sector}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="is-right tv-num" style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                          {formatPrice(price, sym.precision)}
                        </span>{' '}
                        <span style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                          {sym.currency}
                        </span>
                      </td>

                      <td className="is-right" style={{ whiteSpace: 'nowrap' }}>
                        <span className={isPos ? 'tv-pill-up' : 'tv-pill-down'}>
                          {formatPercent(changePercent)}
                        </span>
                      </td>

                      <td className="is-right tv-col-hide-sm">
                        <div style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                          <SparklineSvg
                            values={meta?.spark ?? []}
                            isPositive={isPos}
                            width={92}
                            height={28}
                          />
                        </div>
                      </td>

                      <td className="is-right tv-num tv-col-hide-md" style={{ color: 'var(--tv-text-secondary)' }}>
                        {formatVolume(volume)}
                      </td>

                      <td className="is-right tv-col-hide-sm">
                        <span
                          className={`tv-rating-pill ${ratingBadgeClass(
                            meta?.rating ?? 'Neutrale',
                          )}`}
                        >
                          {meta?.rating ?? 'Neutrale'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedRows.length > 10 && (
            <div style={{ padding: '12px 16px 6px', textAlign: 'center' }}>
              <button
                type="button"
                className="tv-btn tv-btn-secondary tv-btn-sm"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll
                  ? 'Mostra meno'
                  : `Mostra tutte le ${sortedRows.length} azioni italiane`}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

/**
 * 🇺🇸 Azioni USA (NASDAQ & NYSE — 95 real US stocks)
 */
export const UsStocksSection: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();
  const [subTab, setSubTab] = useState<UsStocksTab>('active');

  const usSymbols = useMemo(
    () => SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'US'),
    [],
  );

  const sampleSource = quotes['AAPL']?.source;

  const sortedRows = useMemo(() => {
    const filtered =
      subTab === 'tech'
        ? usSymbols.filter((s) => s.sector === 'Tecnologia')
        : usSymbols;

    const enriched = filtered.map((sym) => {
      const q = quotes[sym.ticker];
      const price = q?.price ?? sym.basePrice;
      const changePercent =
        q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
      const volume = q?.volume ?? sym.avgVolume;
      return { sym, price, changePercent, volume, source: q?.source };
    });

    if (subTab === 'gainers') {
      return enriched.sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
    }
    if (subTab === 'losers') {
      return enriched.sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
    }
    return enriched.sort((a, b) => (b.sym.marketCap ?? 0) - (a.sym.marketCap ?? 0)).slice(0, 10);
  }, [usSymbols, quotes, subTab]);

  const sparks = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of sortedRows) {
      map.set(row.sym.ticker, generateSparkline(row.sym, 22));
    }
    return map;
  }, [sortedRows, sampleSource]);

  return (
    <section id="home-us" className="tv-section" style={{ paddingTop: 12 }}>
      <div className="tv-container">
        <div className="tv-section-header">
          <button
            type="button"
            className="tv-section-heading"
            onClick={() => navigate('screener')}
          >
            <span aria-hidden="true" style={{ fontSize: 22 }}>🇺🇸</span>
            <span>Azioni USA</span>
            <span className="tv-micro-badge">
              NASDAQ · NYSE · {usSymbols.length} TITOLI REALI
            </span>
            <ChevronRight size={24} />
          </button>

          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('screener')}
          >
            <span>Esplora tutti i {usSymbols.length} titoli USA</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'active'}
            className={`tv-tab${subTab === 'active' ? ' is-active' : ''}`}
            onClick={() => setSubTab('active')}
          >
            Maggiore cap.
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'gainers'}
            className={`tv-tab${subTab === 'gainers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('gainers')}
          >
            Migliori rialzi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'losers'}
            className={`tv-tab${subTab === 'losers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('losers')}
          >
            Peggiori ribassi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'tech'}
            className={`tv-tab${subTab === 'tech' ? ' is-active' : ''}`}
            onClick={() => setSubTab('tech')}
          >
            Big Tech &amp; AI
          </button>
        </div>

        <div className="tv-card" style={{ padding: '6px 0' }}>
          <div className="tv-stock-table-wrap">
            <table className="tv-stock-table">
              <thead>
                <tr>
                  <th>Simbolo</th>
                  <th className="is-right">Prezzo</th>
                  <th className="is-right">Var %</th>
                  <th className="is-right tv-col-hide-sm">Andamento</th>
                  <th className="is-right tv-col-hide-sm">Cap. Mercato</th>
                  <th className="is-right tv-col-hide-md">Volume</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ sym, price, changePercent, volume, source }) => {
                  const isPos = changePercent >= 0;
                  return (
                    <tr
                      key={sym.id}
                      onClick={() => openSymbolInChart(sym.ticker)}
                      title={`Apri ${sym.name} su Supercharts`}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            className="tv-symbol-avatar"
                            style={{ backgroundColor: sym.logoColor }}
                          >
                            {sym.logoText}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--tv-text-heading)', minWidth: 0 }}>
                              <span className="tv-stock-name">{sym.name}</span>
                              <SourcePill source={source} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span className="tv-ticker-pill">{sym.ticker}</span>
                              <span className="tv-stock-sector-meta" style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                                {sym.exchange} · {sym.sector}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="is-right tv-num" style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                          {formatPrice(price, sym.precision)}
                        </span>{' '}
                        <span style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                          {sym.currency}
                        </span>
                      </td>

                      <td className="is-right" style={{ whiteSpace: 'nowrap' }}>
                        <span className={isPos ? 'tv-pill-up' : 'tv-pill-down'}>
                          {formatPercent(changePercent)}
                        </span>
                      </td>

                      <td className="is-right tv-col-hide-sm">
                        <div style={{ display: 'inline-flex', justifyContent: 'flex-end' }}>
                          <SparklineSvg
                            values={sparks.get(sym.ticker) ?? []}
                            isPositive={isPos}
                            width={92}
                            height={28}
                          />
                        </div>
                      </td>

                      <td className="is-right tv-num tv-col-hide-sm" style={{ color: 'var(--tv-text-primary)', fontWeight: 600 }}>
                        {formatMarketCap(sym.marketCap)}
                      </td>

                      <td className="is-right tv-num tv-col-hide-md" style={{ color: 'var(--tv-text-secondary)' }}>
                        {formatVolume(volume)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * Cripto Live (Binance — 78 live USDT pairs with sub-cent precision support)
 */
export const LiveCryptoSection: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();
  const [subTab, setSubTab] = useState<CryptoTab>('active');

  const cryptoSymbols = useMemo(() => getSymbolsByAssetClass('crypto'), []);

  const liveCount = useMemo(
    () => cryptoSymbols.filter((s) => quotes[s.ticker]?.source === 'binance').length,
    [cryptoSymbols, quotes],
  );

  const sortedRows = useMemo(() => {
    const filtered =
      subTab === 'subcent'
        ? cryptoSymbols.filter((s) => s.precision >= 5 || s.basePrice < 0.1)
        : cryptoSymbols;

    const enriched = filtered.map((sym) => {
      const q = quotes[sym.ticker];
      const price = q?.price ?? sym.basePrice;
      const changePercent =
        q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
      const volume = q?.volume ?? sym.avgVolume;
      return { sym, price, changePercent, volume, source: q?.source };
    });

    if (subTab === 'gainers') {
      return enriched.sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
    }
    if (subTab === 'losers') {
      return enriched.sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
    }
    return enriched.sort((a, b) => (b.sym.marketCap ?? 0) - (a.sym.marketCap ?? 0)).slice(0, 10);
  }, [cryptoSymbols, quotes, subTab]);

  const sparks = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of sortedRows) {
      map.set(row.sym.ticker, generateSparkline(row.sym, 22));
    }
    return map;
  }, [sortedRows]);

  return (
    <section id="home-crypto" className="tv-section" style={{ paddingTop: 12 }}>
      <div className="tv-container">
        <div className="tv-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tv-section-heading"
              onClick={() => navigate('markets')}
            >
              <span>Cripto Live</span>
              <ChevronRight size={24} />
            </button>
            <span className="tv-live-badge">
              <span className="tv-live-dot" />
              {liveCount > 0 ? `${liveCount}/${cryptoSymbols.length} BINANCE LIVE` : `${cryptoSymbols.length} COPPIE BINANCE`}
            </span>
          </div>

          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('screener')}
          >
            <span>Vedi tutte le {cryptoSymbols.length} cripto</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'active'}
            className={`tv-tab${subTab === 'active' ? ' is-active' : ''}`}
            onClick={() => setSubTab('active')}
          >
            Top Cap.
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'gainers'}
            className={`tv-tab${subTab === 'gainers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('gainers')}
          >
            Migliori rialzi 24H
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'losers'}
            className={`tv-tab${subTab === 'losers' ? ' is-active' : ''}`}
            onClick={() => setSubTab('losers')}
          >
            Peggiori ribassi 24H
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'subcent'}
            className={`tv-tab${subTab === 'subcent' ? ' is-active' : ''}`}
            onClick={() => setSubTab('subcent')}
          >
            Meme &amp; Sub-cent
          </button>
        </div>

        <div className="tv-grid-5">
          {sortedRows.map(({ sym, price, changePercent, volume, source }) => {
            const isPos = changePercent >= 0;
            const live = isLiveSource(source);
            return (
              <button
                key={sym.id}
                type="button"
                className="tv-card-compact tv-card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  textAlign: 'left',
                  width: '100%',
                }}
                onClick={() => openSymbolInChart(sym.ticker)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}
                      >
                        <span className="tv-truncate">{sym.ticker}</span>
                        {live && <span className="tv-live-dot" title="Live Binance" />}
                      </div>
                      <div className="tv-truncate" style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                        {sym.shortName}
                      </div>
                    </div>
                  </div>
                </div>

                <SparklineSvg
                  values={sparks.get(sym.ticker) ?? []}
                  isPositive={isPos}
                  width={180}
                  height={32}
                />

                <div
                  className="tv-num"
                  style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    {formatPrice(price, sym.precision)}
                  </span>
                  <span className={isPos ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 12.5 }}>
                    {formatPercent(changePercent)}
                  </span>
                </div>

                <div className="tv-num" style={{ fontSize: 11, color: 'var(--tv-text-muted)' }}>
                  Vol 24H: {formatVolume(volume)} · {sym.currency}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export interface CompactAssetBoardProps {
  id: string;
  title: string;
  subtitle?: string;
  assetClass: AssetClass;
  allLabel: string;
  maxItems?: number;
}

export const CompactAssetBoard: React.FC<CompactAssetBoardProps> = ({
  id,
  title,
  subtitle,
  assetClass,
  allLabel,
  maxItems = 10,
}) => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart } = useTradingView();

  const symbols: SymbolInfo[] = useMemo(
    () => getSymbolsByAssetClass(assetClass).slice(0, maxItems),
    [assetClass, maxItems],
  );

  const sampleSource = symbols[0] ? quotes[symbols[0].ticker]?.source : undefined;

  const sparks = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of symbols) {
      map.set(s.ticker, generateSparkline(s, 22));
    }
    return map;
  }, [symbols, sampleSource]);

  return (
    <section id={id} className="tv-section" style={{ paddingBlock: 24 }}>
      <div className="tv-container">
        <div className="tv-section-header">
          <div>
            <button
              type="button"
              className="tv-section-heading"
              onClick={() => navigate('markets')}
            >
              <span>{title}</span>
              <ChevronRight size={24} />
            </button>
            {subtitle && (
              <p className="tv-text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="tv-section-link"
            onClick={() => navigate('markets')}
          >
            <span>{allLabel}</span>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="tv-grid-5">
          {symbols.map((sym) => {
            const q = quotes[sym.ticker];
            const price = q?.price ?? sym.basePrice;
            const pct =
              q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
            const isPos = pct >= 0;
            const live = isLiveSource(q?.source);

            return (
              <button
                key={sym.id}
                type="button"
                className="tv-card-compact tv-card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  textAlign: 'left',
                  width: '100%',
                }}
                onClick={() => openSymbolInChart(sym.ticker)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="tv-symbol-avatar"
                      style={{ width: 28, height: 28, fontSize: 10, backgroundColor: sym.logoColor }}
                    >
                      {sym.logoText}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="tv-truncate"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'var(--tv-text-heading)' }}
                      >
                        <span className="tv-truncate">{sym.ticker}</span>
                        {live && <span className="tv-live-dot" title="Flusso live" />}
                      </div>
                      <div className="tv-truncate" style={{ fontSize: 11, color: 'var(--tv-text-secondary)' }}>
                        {sym.shortName}
                      </div>
                    </div>
                  </div>
                </div>

                <SparklineSvg
                  values={sparks.get(sym.ticker) ?? []}
                  isPositive={isPos}
                  width={180}
                  height={34}
                />

                <div
                  className="tv-num"
                  style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                    {formatPrice(price, sym.precision)}{' '}
                    <span style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>
                      {sym.currency}
                    </span>
                  </span>
                  <span className={isPos ? 'tv-delta-up' : 'tv-delta-down'} style={{ fontSize: 13 }}>
                    {formatPercent(pct)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
