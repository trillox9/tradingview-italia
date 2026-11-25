import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  ChevronDown,
  ChevronRight,
  LineChart,
  Search,
  Wallet,
} from 'lucide-react';
import {
  ECONOMIC_CALENDAR,
  FINANCIAL_NEWS,
  formatPercent,
  formatPrice,
  getSymbolByTicker,
  SYMBOLS,
} from '../data';
import { useQuotes, useTradingView } from '../store';
import { SiteFooter, SiteHeader } from '../components/layout';
import {
  AssetCategorySection,
  CommunityIdeasSection,
  CompactAssetBoard,
  IndicatorsSection,
  LiveCryptoSection,
  MarketSummarySection,
  UsStocksSection,
} from '../components/home';
import '../styles/home.css';

const HERO_TICKERS = ['FTSEMIB', 'RACE', 'BTCUSDT', 'EURUSD', 'NVDA', 'SPX'] as const;

const STICKY_CATEGORIES = [
  { id: 'home-summary', label: 'Panoramica' },
  { id: 'home-italy', label: 'Azioni Italiane' },
  { id: 'home-us', label: 'Azioni USA' },
  { id: 'home-crypto', label: 'Cripto Live' },
  { id: 'home-futures', label: 'Futures' },
  { id: 'home-forex', label: 'Forex' },
  { id: 'home-economy', label: 'Economia' },
  { id: 'home-news', label: 'Notizie' },
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  IT: '🇮🇹',
  EU: '🇪🇺',
  US: '🇺🇸',
  DE: '🇩🇪',
  GB: '🇬🇧',
  JP: '🇯🇵',
};

const FEATURED_BROKERS = [
  { name: 'OANDA', badge: 'Best 2023', rating: '4.5', verdict: 'Ottimo', markets: 'Forex, CFD' },
  { name: 'easyMarkets', badge: 'Best 2024', rating: '4.8', verdict: 'Eccellente', markets: 'Forex, CFD' },
  { name: 'FxPro', badge: 'Verificato', rating: '4.6', verdict: 'Eccellente', markets: 'Forex, Indici' },
  { name: 'ThinkMarkets', badge: 'Verificato', rating: '4.6', verdict: 'Eccellente', markets: 'Azioni, CFD' },
];

export const HomePage: React.FC = () => {
  const { quotes } = useQuotes();
  const { navigate, openSymbolInChart, openModal, setBottomPanel } = useTradingView();
  const [activeAnchor, setActiveAnchor] = useState<string>('home-summary');

  const heroSymbols = useMemo(
    () =>
      HERO_TICKERS.map((ticker) => getSymbolByTicker(ticker)).filter(
        (s): s is NonNullable<typeof s> => Boolean(s),
      ),
    [],
  );

  const upcomingEvents = useMemo(() => ECONOMIC_CALENDAR.slice(0, 4), []);
  const topNews = useMemo(() => FINANCIAL_NEWS.slice(0, 6), []);

  const scrollToSection = (id: string) => {
    setActiveAnchor(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--tv-body-bg)' }}>
      <SiteHeader transparentOverHero />

      <main>
        {/* 1. Dramatic Atmospheric Dark Hero */}
        <section className="tv-hero" aria-label="Hero TradingView Italia">
          <div className="tv-hero__backdrop" />
          <div className="tv-hero__grid-overlay" />

          <div className="tv-hero__content">
            <div className="tv-hero__eyebrow">
              <span className="tv-live-dot" />
              <span>Dati Reali · 78 Cripto Live Binance · 95 Azioni USA · 20 Borsa Italiana</span>
            </div>

            <h1 className="tv-hero__title">
              Guarda prima
              <br />
              <span className="tv-hero__title-accent">Poi agisci.</span>
            </h1>

            <p className="tv-hero__subtitle">
              Le migliori operazioni richiedono ricerca, quindi impegno. Analizza{' '}
              {SYMBOLS.length} strumenti reali tra Piazza Affari, Wall Street, cripto Binance
              live, forex e futures con Supercharts, Pine Script e Paper Trading.
            </p>

            {/* Interactive Search Pill */}
            <button
              type="button"
              className="tv-hero__search-pill"
              onClick={() => openModal('symbolSearch')}
              aria-label="Cerca mercati, simboli o ticker"
            >
              <span className="tv-hero__search-left">
                <Search size={19} />
                <span>Cerca tra 222 mercati, simboli, ISIN o ticker...</span>
              </span>
              <span className="tv-hero__search-kbd">Ctrl+K</span>
            </button>

            {/* Quick Live Ticker Chips */}
            <div className="tv-hero__chips">
              {heroSymbols.map((sym) => {
                const q = quotes[sym.ticker];
                const price = q?.price ?? sym.basePrice;
                const pct =
                  q?.changePercent ?? ((sym.basePrice - sym.prevClose) / sym.prevClose) * 100;
                const isPos = pct >= 0;
                const isLive = q?.source === 'binance' || q?.source === 'yahoo';

                return (
                  <button
                    key={sym.id}
                    type="button"
                    className="tv-hero__chip tv-num"
                    onClick={() => openSymbolInChart(sym.ticker)}
                  >
                    {isLive ? (
                      <span className="tv-live-dot" title="Live" />
                    ) : (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: sym.logoColor,
                        }}
                      />
                    )}
                    <strong style={{ fontWeight: 700 }}>{sym.ticker}</strong>
                    <span style={{ opacity: 0.85 }}>{formatPrice(price, sym.precision)}</span>
                    <span style={{ color: isPos ? '#22AB94' : '#F7525F', fontWeight: 600 }}>
                      {formatPercent(pct)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hero CTAs */}
            <div className="tv-hero__actions">
              <button
                type="button"
                className="tv-hero__cta-primary"
                onClick={() => navigate('chart')}
              >
                <LineChart size={18} />
                <span>Esplora Supercharts</span>
              </button>
              <button
                type="button"
                className="tv-hero__cta-secondary"
                onClick={() => navigate('markets')}
              >
                <span>Panoramica mercati</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <button
            type="button"
            className="tv-hero__scroll-cue"
            aria-label="Scorri a Panoramica mercato"
            onClick={() => scrollToSection('home-summary')}
          >
            <ChevronDown size={28} />
          </button>
        </section>

        {/* 2. Floating Sticky Italian Category Pill Nav */}
        <div className="tv-sticky-nav-wrap">
          <div className="tv-sticky-pillbar tv-no-scrollbar" role="tablist" aria-label="Sezioni homepage">
            {STICKY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeAnchor === cat.id}
                className={`tv-sticky-pill-item${activeAnchor === cat.id ? ' is-active' : ''}`}
                onClick={() => scrollToSection(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Panoramica mercato (Tabs, Interactive Chart, Live Cards, 3-col Bento) */}
        <MarketSummarySection />

        {/* 4. Idee della community */}
        <CommunityIdeasSection />

        {/* 5. Indicatori e strategie */}
        <IndicatorsSection />

        {/* 6. Azioni Italiane (Borsa Italiana / MIL — 20 titoli reali) */}
        <AssetCategorySection />

        {/* 7. Azioni USA (NASDAQ & NYSE — 95 titoli reali) */}
        <UsStocksSection />

        {/* 8. Cripto Live (Binance — 78 coppie USDT con supporto sub-cent) */}
        <LiveCryptoSection />

        {/* 9. Futures e Forex Live Boards */}
        <CompactAssetBoard
          id="home-futures"
          title="Futures e materie prime"
          subtitle="Oro, Petrolio WTI, Argento, Gas Naturale e Rame su COMEX e NYMEX"
          assetClass="futures"
          allLabel="Vedi tutti i futures"
          maxItems={5}
        />

        <CompactAssetBoard
          id="home-forex"
          title="Forex e valute"
          subtitle="Coppie valutarie principali e cross europei in tempo reale"
          assetClass="forex"
          allLabel="Vedi tutti i tassi Forex"
          maxItems={5}
        />

        {/* 10. Economia & Calendario Economico */}
        <section id="home-economy" className="tv-section">
          <div className="tv-container">
            <div className="tv-section-header">
              <button
                type="button"
                className="tv-section-heading"
                onClick={() => navigate('calendar')}
              >
                <span>Economia e calendario economico</span>
                <ChevronRight size={24} />
              </button>
              <button
                type="button"
                className="tv-section-link"
                onClick={() => navigate('calendar')}
              >
                <span>Vedi tutti gli eventi del mercato</span>
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="tv-grid-4">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="tv-eco-card tv-card-interactive"
                  onClick={() => navigate('calendar')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('calendar');
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--tv-text-secondary)' }}>
                      {COUNTRY_FLAGS[ev.country] ?? '🌐'} {ev.countryName} · {ev.time}
                    </span>
                    <span
                      className="tv-impact-bars"
                      title={`Importanza ${ev.impact}/3`}
                      aria-label={`Importanza ${ev.impact} su 3`}
                    >
                      {[1, 2, 3].map((lvl) => (
                        <span
                          key={lvl}
                          className={`tv-impact-bar${
                            lvl <= ev.impact
                              ? ev.impact === 3
                                ? ' is-active-high'
                                : ' is-active-low'
                              : ''
                          }`}
                          style={{ height: lvl * 4 }}
                        />
                      ))}
                    </span>
                  </div>

                  <div
                    className="tv-line-clamp-2"
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--tv-text-heading)',
                      lineHeight: 1.35,
                      minHeight: 38,
                    }}
                  >
                    {ev.title}
                  </div>

                  <div
                    className="tv-num"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      paddingTop: 8,
                      borderTop: '1px solid var(--tv-border-subtle)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>Attuale</div>
                      <div style={{ fontWeight: 700, color: 'var(--tv-text-heading)' }}>
                        {ev.actual ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>Previsione</div>
                      <div style={{ fontWeight: 600, color: 'var(--tv-text-secondary)' }}>
                        {ev.forecast ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--tv-text-muted)' }}>Precedente</div>
                      <div style={{ fontWeight: 600, color: 'var(--tv-text-secondary)' }}>
                        {ev.previous ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 11. Notizie principali */}
        <section id="home-news" className="tv-section" style={{ paddingTop: 12 }}>
          <div className="tv-container">
            <div className="tv-section-header">
              <button
                type="button"
                className="tv-section-heading"
                onClick={() => navigate('markets')}
              >
                <span>Notizie principali</span>
                <ChevronRight size={24} />
              </button>
              <button
                type="button"
                className="tv-section-link"
                onClick={() => navigate('markets')}
              >
                <span>Tutte le notizie finanziarie</span>
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="tv-bento-3">
              {topNews.map((item) => (
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
                      const firstTicker = item.relatedTickers[0];
                      if (firstTicker) {
                        openSymbolInChart(firstTicker);
                      } else {
                        navigate('markets');
                      }
                    }}
                  >
                    {item.title}
                  </button>

                  <p className="tv-text-secondary tv-line-clamp-2" style={{ fontSize: 13 }}>
                    {item.summary}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 6 }}>
                    {item.relatedTickers.slice(0, 4).map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        className="tv-ticker-badge"
                        onClick={() => openSymbolInChart(ticker)}
                      >
                        {ticker}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 12. Trading & Broker Showcase + CTA Banner */}
        <section id="home-brokers" className="tv-section">
          <div className="tv-container">
            <div className="tv-section-header">
              <div>
                <h2 className="tv-heading-2">Trading e broker</h2>
                <p className="tv-text-secondary" style={{ fontSize: 14, marginTop: 4 }}>
                  Fai trading direttamente sui grafici con Paper Trading integrato o confronta i
                  broker verificati dalla community.
                </p>
              </div>
            </div>

            <div className="tv-grid-4" style={{ marginBottom: 28 }}>
              {FEATURED_BROKERS.map((broker) => (
                <div
                  key={broker.name}
                  className="tv-card-compact"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 16, color: 'var(--tv-text-heading)' }}>
                      {broker.name}
                    </strong>
                    <span
                      className="tv-micro-badge"
                      style={{
                        backgroundColor: 'var(--tv-brand-soft)',
                        color: 'var(--tv-brand-soft-text)',
                      }}
                    >
                      <Award size={10} style={{ marginRight: 3 }} />
                      {broker.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tv-text-secondary)' }}>
                    {broker.markets}
                  </div>
                  <div className="tv-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading)' }}>
                    ★ {broker.rating} · <span className="tv-delta-up">{broker.verdict}</span>
                  </div>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary tv-btn-sm"
                    style={{ width: '100%', marginTop: 'auto' }}
                    onClick={() => {
                      setBottomPanel('trading');
                      navigate('chart');
                    }}
                  >
                    Simula in Paper Trading
                  </button>
                </div>
              ))}
            </div>

            <div className="tv-cta-banner">
              <div style={{ maxWidth: 620 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#90BFF9',
                    marginBottom: 8,
                  }}
                >
                  222 Strumenti Reali · Supercharts · Pine Script v5 · Paper Trading
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--tv-font-display)',
                    fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                    fontWeight: 800,
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    marginBottom: 10,
                  }}
                >
                  Dove il mondo osserva i mercati
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.5 }}>
                  Passa subito all’area di lavoro Supercharts multi-grafico con 78 criptovalute
                  live Binance, 95 azioni USA, 20 titoli di Piazza Affari, 12 indicatori tecnici,
                  Bar Replay e Paper Trading da €100.000.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button
                  type="button"
                  className="tv-hero__cta-primary"
                  onClick={() => navigate('chart')}
                >
                  <LineChart size={18} />
                  <span>Apri Supercharts</span>
                </button>
                <button
                  type="button"
                  className="tv-hero__cta-secondary"
                  onClick={() => {
                    setBottomPanel('trading');
                    navigate('chart');
                  }}
                >
                  <Wallet size={17} />
                  <span>Prova Paper Trading</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};
