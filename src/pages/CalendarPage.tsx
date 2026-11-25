import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Globe,
  Search,
  Star,
} from 'lucide-react';
import type { EconomicEvent } from '../types';
import { ECONOMIC_CALENDAR } from '../data';
import { useTradingView } from '../store';
import '../styles/modals.css';

type DayRangeFilter = 'week' | 'today' | 'tomorrow';
type ImpactFilter = 'all' | 1 | 2 | 3;
type CurrencyFilter = 'ALL' | 'EUR' | 'USD' | 'GBP' | 'JPY';
type CategoryFilter = 'all' | EconomicEvent['category'];

const TODAY_ISO = '2026-11-25';
const TOMORROW_ISO = '2026-11-26';

const DAY_HEADERS_IT: Record<string, { label: string; tag?: string }> = {
  '2026-11-25': { label: 'Mercoledì 25 Novembre 2026', tag: 'Oggi' },
  '2026-11-26': { label: 'Giovedì 26 Novembre 2026', tag: 'Domani' },
  '2026-11-27': { label: 'Venerdì 27 Novembre 2026' },
  '2026-11-28': { label: 'Sabato 28 Novembre 2026' },
};

const COUNTRY_FLAGS: Record<string, string> = {
  IT: '🇮🇹',
  DE: '🇩🇪',
  EU: '🇪🇺',
  US: '🇺🇸',
  GB: '🇬🇧',
  JP: '🇯🇵',
};

const CATEGORY_LABELS_IT: Record<EconomicEvent['category'], string> = {
  tassi: 'Tassi & Banche Centrali',
  inflazione: 'Inflazione',
  pil: 'PIL & Crescita',
  lavoro: 'Mercato del Lavoro',
  pmi: 'PMI & Fiducia',
  bilancia: 'Vendite & Bilancia',
};

const CATEGORY_EXPLANATIONS_IT: Record<EconomicEvent['category'], string> = {
  tassi:
    'Le decisioni sui tassi di interesse e le aste sovrane determinano il costo del denaro, i rendimenti obbligazionari (BTP/Treasury) e la direzione primaria dei cambi Forex.',
  inflazione:
    'Misura la variazione dei prezzi al consumo. Letture superiori alle attese tendono a rafforzare la valuta locale e ad aumentare i rendimenti per attese di politica monetaria restrittiva.',
  pil:
    'Rappresenta la salute complessiva dell’attività economica nazionale o dell’area valutaria. Sorprese positive sostengono gli indici azionari e i titoli ciclici.',
  lavoro:
    'I dati sull’occupazione sono tra i principali driver di volatilità intraday su indici, oro e USD/EUR perché guidano le decisioni di Federal Reserve e BCE.',
  pmi:
    'Indici anticipatori basati su sondaggi presso direttori acquisti e imprese: valori sopra 50 indicano espansione economica, sotto 50 contrazione.',
  bilancia:
    'Misura i consumi al dettaglio e gli scambi commerciali, offrendo un termometro diretto sulla domanda interna.',
};

const CURRENCY_RELATED_SYMBOLS: Record<string, string[]> = {
  EUR: ['FTSEMIB', 'EURUSD', 'IT10Y', 'DAX'],
  USD: ['SPX', 'NDX', 'EURUSD', 'US10Y', 'GC1!'],
  GBP: ['GBPUSD', 'EURGBP', 'SPX'],
  JPY: ['USDJPY', 'NKY', 'GC1!'],
};

function parseNumericMetric(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, '')
    .replace('%', '')
    .replace(/K$/i, '')
    .replace(',', '.');
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) ? val : null;
}

function getActualTone(evt: EconomicEvent): 'up' | 'down' | 'neutral' {
  const actual = parseNumericMetric(evt.actual);
  const forecast = parseNumericMetric(evt.forecast);
  if (actual === null || forecast === null) return 'neutral';
  if (Math.abs(actual - forecast) < 1e-6) return 'neutral';
  // Lower unemployment claims or lower inflation vs forecast often treated constructively, keep simple numeric beat/miss highlight
  if (evt.category === 'lavoro' && evt.title.toLowerCase().includes('sussidi')) {
    return actual < forecast ? 'up' : 'down';
  }
  return actual > forecast ? 'up' : 'down';
}

export function CalendarPage() {
  const { openSymbolInChart } = useTradingView();

  const [dayRange, setDayRange] = useState<DayRangeFilter>('week');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(
    ECONOMIC_CALENDAR[0]?.id ?? null,
  );
  const [clockText, setClockText] = useState<string>(() =>
    new Date().toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockText(
        new Date().toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ECONOMIC_CALENDAR.filter((evt) => {
      if (dayRange === 'today' && evt.date !== TODAY_ISO) return false;
      if (dayRange === 'tomorrow' && evt.date !== TOMORROW_ISO) return false;
      if (impactFilter !== 'all' && evt.impact !== impactFilter) return false;
      if (currencyFilter !== 'ALL' && evt.currency !== currencyFilter) return false;
      if (categoryFilter !== 'all' && evt.category !== categoryFilter) return false;
      if (q) {
        const hay =
          `${evt.title} ${evt.countryName} ${evt.currency} ${evt.institution}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categoryFilter, currencyFilter, dayRange, impactFilter, search]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const evt of filteredEvents) {
      const list = map.get(evt.date) ?? [];
      list.push(evt);
      map.set(evt.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const highImpact = filteredEvents.filter((e) => e.impact === 3).length;
    const released = filteredEvents.filter((e) => e.actual !== null).length;
    const nextHigh = filteredEvents.find((e) => e.actual === null && e.impact === 3);
    return { total: filteredEvents.length, highImpact, released, nextHigh };
  }, [filteredEvents]);

  return (
    <main className="tvp-page">
      <div className="tvp-inner">
        <header className="tvp-page-header">
          <div>
            <h1 className="tvp-page-title">
              <Calendar size={28} style={{ color: 'var(--tv-brand, #2962ff)' }} />
              Calendario Economico
            </h1>
            <p className="tvp-page-subtitle">
              Eventi macroeconomici chiave per Italia, Area Euro, Stati Uniti, Regno Unito e Giappone in tempo reale.
            </p>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 9999,
              backgroundColor: 'var(--tv-bg-primary, #131313)',
              border: '1px solid var(--tv-border, #303030)',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <Clock size={15} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <span>Ora Italia (CET):</span>
            <span className="tv-mono" style={{ color: 'var(--tv-text-heading, #fff)' }}>
              {clockText}
            </span>
          </div>
        </header>

        {/* KPI Strip */}
        <section className="tvp-kpi-grid" aria-label="Riepilogo calendario economico">
          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Eventi in programma</span>
            <span className="tvp-kpi-value">{stats.total}</span>
            <span className="tvp-kpi-sub">
              {stats.released} già pubblicati · {stats.total - stats.released} in arrivo
            </span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">
              <span>Alta importanza (3 ★)</span>
              <Flame size={15} style={{ color: 'var(--tv-down, #f7525f)' }} />
            </span>
            <span className="tvp-kpi-value">{stats.highImpact}</span>
            <span className="tvp-kpi-sub">Potenziale elevata volatilità</span>
          </div>

          <div className="tvp-kpi-card" style={{ gridColumn: 'span 2' }}>
            <span className="tvp-kpi-label">Prossimo market mover chiave</span>
            <span
              className="tvp-kpi-value tv-truncate"
              style={{ fontSize: '1.08rem' }}
            >
              {stats.nextHigh
                ? `${COUNTRY_FLAGS[stats.nextHigh.country] ?? '🌐'} ${stats.nextHigh.title}`
                : 'Tutti gli eventi ad alto impatto filtrati sono già usciti'}
            </span>
            <span className="tvp-kpi-sub">
              {stats.nextHigh
                ? `${DAY_HEADERS_IT[stats.nextHigh.date]?.tag ?? stats.nextHigh.date} alle ${stats.nextHigh.time} · ${stats.nextHigh.institution} · Previsto: ${stats.nextHigh.forecast ?? '—'}`
                : 'Seleziona "Questa settimana" per tutti gli appuntamenti'}
            </span>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="tvp-toolbar" aria-label="Filtri calendario economico">
          <div className="tvp-toolbar-group" role="tablist" aria-label="Periodo">
            {(
              [
                { id: 'today', label: 'Oggi' },
                { id: 'tomorrow', label: 'Domani' },
                { id: 'week', label: 'Questa settimana' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={dayRange === d.id}
                className={`tvp-pill ${dayRange === d.id ? 'is-active' : ''}`}
                onClick={() => setDayRange(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="tvp-toolbar-group" role="group" aria-label="Valuta">
            {(
              [
                { id: 'ALL', label: 'Tutte le valute' },
                { id: 'EUR', label: '🇪🇺 EUR' },
                { id: 'USD', label: '🇺🇸 USD' },
                { id: 'GBP', label: '🇬🇧 GBP' },
                { id: 'JPY', label: '🇯🇵 JPY' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tvp-pill tvp-pill--brand ${currencyFilter === c.id ? 'is-active' : ''}`}
                onClick={() => setCurrencyFilter(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="tvp-toolbar" aria-label="Filtri importanza e ricerca">
          <div className="tvp-toolbar-group" role="group" aria-label="Impatto">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--tv-text-muted, #8c8c8c)' }}>
              IMPATTO:
            </span>
            {(
              [
                { id: 'all', label: 'Tutti' },
                { id: 3, label: '★★★ Alto' },
                { id: 2, label: '★★ Medio' },
                { id: 1, label: '★ Basso' },
              ] as const
            ).map((imp) => (
              <button
                key={String(imp.id)}
                type="button"
                className={`tvp-pill ${impactFilter === imp.id ? 'is-active' : ''}`}
                onClick={() => setImpactFilter(imp.id)}
              >
                {imp.label}
              </button>
            ))}
          </div>

          <div className="tvp-toolbar-group">
            <select
              aria-label="Categoria macroeconomica"
              className="tvp-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            >
              <option value="all">Tutte le categorie</option>
              {(Object.keys(CATEGORY_LABELS_IT) as EconomicEvent['category'][]).map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS_IT[cat]}
                  </option>
                ),
              )}
            </select>

            <div className="tvm-search-wrap" style={{ width: 230, height: 34 }}>
              <Search size={15} />
              <input
                type="text"
                className="tvm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca evento, BCE, ISTAT..."
              />
            </div>
          </div>
        </section>

        {/* Grouped Calendar Schedule */}
        {groupedByDate.length === 0 ? (
          <div className="tvp-cal-day-block">
            <div className="tvp-empty-state">
              <Globe size={28} />
              <div>Nessun evento macroeconomico corrisponde ai filtri selezionati.</div>
            </div>
          </div>
        ) : (
          groupedByDate.map(([dateKey, events]) => {
            const meta = DAY_HEADERS_IT[dateKey] ?? { label: dateKey };
            return (
              <section key={dateKey} className="tvp-cal-day-block">
                <div className="tvp-cal-day-header">
                  <div className="tvp-cal-day-title">
                    {meta.tag && (
                      <span
                        className="tvm-asset-tag"
                        style={{
                          backgroundColor:
                            meta.tag === 'Oggi'
                              ? 'var(--tv-brand, #2962ff)'
                              : 'var(--tv-bg-active, #303030)',
                          color: '#ffffff',
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                        }}
                      >
                        {meta.tag}
                      </span>
                    )}
                    <span>{meta.label}</span>
                  </div>
                  <span className="tvm-subtitle">{events.length} eventi</span>
                </div>

                <div className="tvp-cal-row tvp-cal-row-head">
                  <span>Ora / Stato</span>
                  <span>Paese / Valuta</span>
                  <span className="tvp-cal-hide-sm">Impatto</span>
                  <span>Evento</span>
                  <span style={{ textAlign: 'right' }}>Attuale</span>
                  <span className="tvp-cal-hide-sm" style={{ textAlign: 'right' }}>
                    Previsto
                  </span>
                  <span className="tvp-cal-hide-sm" style={{ textAlign: 'right' }}>
                    Precedente
                  </span>
                  <span />
                </div>

                {events.map((evt) => {
                  const isExpanded = expandedId === evt.id;
                  const isReleased = evt.actual !== null;
                  const tone = getActualTone(evt);
                  const relatedTickers =
                    CURRENCY_RELATED_SYMBOLS[evt.currency] ?? ['FTSEMIB', 'SPX'];

                  return (
                    <Fragment key={evt.id}>
                      <div
                        className="tvp-cal-row"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedId((prev) => (prev === evt.id ? null : evt.id))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedId((prev) => (prev === evt.id ? null : evt.id));
                          }
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="tv-mono" style={{ fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                            {evt.time}
                          </span>
                          <span
                            className={`tvp-status-dot ${
                              isReleased
                                ? 'tvp-status-dot--released'
                                : 'tvp-status-dot--upcoming'
                            }`}
                          >
                            {isReleased ? 'Pubblicato' : 'In arrivo'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: '1.1rem' }}>
                            {COUNTRY_FLAGS[evt.country] ?? '🌐'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--tv-text-heading, #fff)' }}>
                              {evt.currency}
                            </div>
                            <div className="tvm-subtitle" style={{ fontSize: '0.7rem' }}>
                              {evt.countryName}
                            </div>
                          </div>
                        </div>

                        <div
                          className="tvp-impact-stars tvp-cal-hide-sm"
                          title={`Importanza ${evt.impact}/3`}
                          aria-label={`Importanza ${evt.impact} su 3`}
                        >
                          {[1, 2, 3].map((level) => {
                            const filled = level <= evt.impact;
                            const starColor =
                              evt.impact === 3
                                ? 'var(--tv-down, #f23645)'
                                : evt.impact === 2
                                  ? 'var(--tv-warning, #ff9800)'
                                  : 'var(--tv-text-secondary, #8c8c8c)';
                            return (
                              <Star
                                key={level}
                                size={14}
                                color={filled ? starColor : 'var(--tv-border-strong, #464646)'}
                                fill={filled ? starColor : 'none'}
                              />
                            );
                          })}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--tv-text-heading, #fff)', lineHeight: 1.3 }}>
                            {evt.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span className="tvm-asset-tag">{evt.institution}</span>
                            <span className="tvm-subtitle" style={{ fontSize: '0.72rem' }}>
                              {CATEGORY_LABELS_IT[evt.category]}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`tv-num ${
                            tone === 'up'
                              ? 'tvm-delta-up'
                              : tone === 'down'
                                ? 'tvm-delta-down'
                                : ''
                          }`}
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color:
                              tone === 'neutral'
                                ? isReleased
                                  ? 'var(--tv-text-heading, #fff)'
                                  : 'var(--tv-text-muted, #707070)'
                                : undefined,
                          }}
                        >
                          {evt.actual ?? '—'}
                        </div>

                        <div
                          className="tv-num tvp-cal-hide-sm"
                          style={{ textAlign: 'right', color: 'var(--tv-text-primary, #dbdbdb)' }}
                        >
                          {evt.forecast ?? '—'}
                        </div>

                        <div
                          className="tv-num tvp-cal-hide-sm"
                          style={{ textAlign: 'right', color: 'var(--tv-text-secondary, #8c8c8c)' }}
                        >
                          {evt.previous ?? '—'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="tvp-cal-detail">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--tv-text-heading, #fff)' }}>
                              Dettagli evento · {evt.institution} ({evt.countryName})
                            </div>
                            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                              {CATEGORY_EXPLANATIONS_IT[evt.category]}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tv-text-muted, #8c8c8c)' }}>
                                MERCATI CORRELATI:
                              </span>
                              {relatedTickers.map((sym) => (
                                <button
                                  key={sym}
                                  type="button"
                                  className="tvm-btn tvm-btn--sm tvm-btn--secondary"
                                  onClick={() => openSymbolInChart(sym)}
                                >
                                  {sym}
                                  <ArrowUpRight size={12} />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: 8,
                              alignContent: 'center',
                            }}
                          >
                            <div className="tvp-kpi-card" style={{ padding: '10px 12px' }}>
                              <span className="tvp-kpi-label">Precedente</span>
                              <span className="tvp-kpi-value" style={{ fontSize: '1.05rem' }}>
                                {evt.previous ?? '—'}
                              </span>
                            </div>
                            <div className="tvp-kpi-card" style={{ padding: '10px 12px' }}>
                              <span className="tvp-kpi-label">Previsto</span>
                              <span className="tvp-kpi-value" style={{ fontSize: '1.05rem' }}>
                                {evt.forecast ?? '—'}
                              </span>
                            </div>
                            <div className="tvp-kpi-card" style={{ padding: '10px 12px' }}>
                              <span className="tvp-kpi-label">Attuale</span>
                              <span
                                className={`tvp-kpi-value ${
                                  tone === 'up'
                                    ? 'tvm-delta-up'
                                    : tone === 'down'
                                      ? 'tvm-delta-down'
                                      : ''
                                }`}
                                style={{ fontSize: '1.05rem' }}
                              >
                                {evt.actual ?? 'In attesa'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}

export default CalendarPage;
