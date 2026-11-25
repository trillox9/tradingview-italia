import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Code2,
  Flame,
  Lightbulb,
  MessageSquare,
  Play,
  Rocket,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type { MarketIdea } from '../types';
import {
  MARKET_IDEAS,
  formatPercent,
  formatPrice,
  getCandlesForSymbol,
  getSymbolByTicker,
} from '../data';
import { PINE_TEMPLATES, calculateEMA, type PineTemplate } from '../engine';
import { useActivePane, useQuotes, useTradingView } from '../store';
import '../styles/modals.css';

type CommunityTab = 'ideas' | 'scripts';
type IdeaMarketFilter = 'all' | MarketIdea['category'];
type IdeaDirectionFilter = 'ALL' | 'LONG' | 'SHORT' | 'NEUTRALE';
type IdeaSortMode = 'editors' | 'popular' | 'recent';

interface CommunityScriptCard {
  id: string;
  name: string;
  description: string;
  isStrategy: boolean;
  author: string;
  authorBadge: string;
  authorColor: string;
  boosts: number;
  comments: number;
  symbolPreview: string;
  isEditorsPick?: boolean;
  code: string;
}

const BOOST_STORAGE_KEY = 'tv_it_community_boosts_v1';

const EXTRA_COMMUNITY_SCRIPTS: CommunityScriptCard[] = [
  {
    id: 'script-vwap-bands',
    name: 'Trend Momentum EMA 12/26 + Volatilità',
    description:
      'Combina incrocio EMA veloce/lenta con filtro di deviazione standard per filtrare i falsi breakout laterali su FTSE MIB e BTC.',
    isStrategy: false,
    author: 'QuantMilano_Lab',
    authorBadge: 'WIZARD',
    authorColor: '#089981',
    boosts: 1420,
    comments: 94,
    symbolPreview: 'FTSEMIB',
    isEditorsPick: true,
    code: `//@version=5
indicator("Trend Momentum EMA 12/26", overlay=true)

fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
dev = ta.stdev(close, 20)
upper = slow + dev * 1.5
lower = slow - dev * 1.5

plot(fast, title="EMA 12", color=color.blue, linewidth=2)
plot(slow, title="EMA 26", color=color.orange, linewidth=2)
plot(upper, title="Banda Superiore", color=color.green, linewidth=1)
plot(lower, title="Banda Inferiore", color=color.red, linewidth=1)`,
  },
  {
    id: 'script-atr-trailing',
    name: 'Canale ATR Dinamico Multi-Timeframe',
    description:
      'Traccia livelli dinamici di supporto e resistenza calibrati sull’Average True Range a 14 periodi per gestire gli stop-loss.',
    isStrategy: false,
    author: 'ElenaQuant',
    authorBadge: 'PREMIUM',
    authorColor: '#7C3AED',
    boosts: 985,
    comments: 62,
    symbolPreview: 'RACE',
    isEditorsPick: true,
    code: `//@version=5
indicator("Canale ATR Dinamico", overlay=true)

basis = ta.ema(close, 20)
atrVal = ta.atr(14)
upperBand = basis + atrVal * 2
lowerBand = basis - atrVal * 2

plot(basis, title="EMA 20", color=color.aqua, linewidth=2)
plot(upperBand, title="Resistenza ATR", color=color.red, linewidth=1)
plot(lowerBand, title="Supporto ATR", color=color.green, linewidth=1)`,
  },
];

function buildCommunityScripts(): CommunityScriptCard[] {
  const authors = [
    { name: 'PineMaster_IT', badge: 'WIZARD', color: '#2962FF', boosts: 1840, comments: 142, sym: 'NVDA' },
    { name: 'AlgoTorino', badge: 'PRO+', color: '#7E57C2', boosts: 1120, comments: 78, sym: 'BTCUSDT' },
    { name: 'MarcoTrader_MI', badge: 'PRO+', color: '#0284C7', boosts: 860, comments: 53, sym: 'UCG' },
    { name: 'BreakoutLab', badge: 'PREMIUM', color: '#F59E0B', boosts: 1295, comments: 89, sym: 'GC1!' },
  ];

  const fromTemplates: CommunityScriptCard[] = PINE_TEMPLATES.map(
    (tpl: PineTemplate, idx) => {
      const meta = authors[idx % authors.length];
      return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        isStrategy: tpl.isStrategy,
        author: meta.name,
        authorBadge: meta.badge,
        authorColor: meta.color,
        boosts: meta.boosts,
        comments: meta.comments,
        symbolPreview: meta.sym,
        isEditorsPick: idx < 2,
        code: tpl.code,
      };
    },
  );

  return [...fromTemplates, ...EXTRA_COMMUNITY_SCRIPTS];
}

function loadBoostedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function IdeaMiniChartSvg({
  symbol,
  direction,
  large = false,
  isScript = false,
}: {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRALE';
  large?: boolean;
  isScript?: boolean;
}) {
  const { candles, ema } = useMemo(() => {
    const series = getCandlesForSymbol(symbol, '1D', large ? 64 : 42).slice(
      large ? -64 : -42,
    );
    const emaVals = calculateEMA(
      series.map((c) => c.close),
      10,
    );
    return { candles: series, ema: emaVals };
  }, [symbol, large]);

  const w = large ? 680 : 360;
  const h = large ? 280 : 196;
  const padX = 14;
  const padY = 18;

  if (candles.length < 4) return null;

  const minP = Math.min(...candles.map((c) => c.low));
  const maxP = Math.max(...candles.map((c) => c.high));
  const range = maxP - minP || 1;

  const toX = (i: number) =>
    padX + (i / (candles.length - 1)) * (w - padX * 2);
  const toY = (v: number) =>
    h - padY - ((v - minP) / range) * (h - padY * 2);

  const candleW = Math.max(2.5, ((w - padX * 2) / candles.length) * 0.62);

  const emaPoints = ema
    .map((v, i) => (v !== null ? `${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : null))
    .filter((pt): pt is string => pt !== null)
    .join(' ');

  const last = candles[candles.length - 1];
  const lastY = toY(last.close);
  const targetY =
    direction === 'LONG'
      ? Math.max(padY + 6, lastY - (h - padY * 2) * 0.22)
      : direction === 'SHORT'
        ? Math.min(h - padY - 6, lastY + (h - padY * 2) * 0.22)
        : lastY;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Subtle grid */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={0}
          x2={w}
          y1={h * ratio}
          y2={h * ratio}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* Directional target zone on ideas */}
      {!isScript && direction !== 'NEUTRALE' && (
        <rect
          x={w * 0.72}
          y={Math.min(lastY, targetY)}
          width={w * 0.24}
          height={Math.max(10, Math.abs(targetY - lastY))}
          fill={
            direction === 'LONG'
              ? 'rgba(8, 153, 129, 0.16)'
              : 'rgba(242, 54, 69, 0.16)'
          }
          stroke={direction === 'LONG' ? '#089981' : '#F23645'}
          strokeWidth="1"
          strokeDasharray="3 3"
          rx="3"
        />
      )}

      {/* Candlesticks */}
      {candles.map((c, idx) => {
        const cx = toX(idx);
        const isBull = c.close >= c.open;
        const color = isBull ? '#089981' : '#F23645';
        const top = toY(Math.max(c.open, c.close));
        const bot = toY(Math.min(c.open, c.close));
        return (
          <g key={c.time}>
            <line
              x1={cx}
              x2={cx}
              y1={toY(c.high)}
              y2={toY(c.low)}
              stroke={color}
              strokeWidth="1"
            />
            <rect
              x={cx - candleW / 2}
              y={top}
              width={candleW}
              height={Math.max(1.5, bot - top)}
              fill={color}
              rx="0.6"
            />
          </g>
        );
      })}

      {/* EMA overlay line */}
      {emaPoints && (
        <polyline
          fill="none"
          stroke={isScript ? '#2962FF' : '#FF9800'}
          strokeWidth={large ? '2.2' : '1.8'}
          points={emaPoints}
        />
      )}

      {/* Secondary signal line for scripts */}
      {isScript && (
        <polyline
          fill="none"
          stroke="#26C6DA"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          points={candles
            .map((c, i) => `${toX(i).toFixed(1)},${toY(c.close * 0.992).toFixed(1)}`)
            .join(' ')}
        />
      )}
    </svg>
  );
}

export function CommunityPage() {
  const { openSymbolInChart, applyPineToChart, setBottomPanel, navigate } =
    useTradingView();
  const { activePane } = useActivePane();
  const { quotes } = useQuotes();

  const [tab, setTab] = useState<CommunityTab>('ideas');
  const [marketFilter, setMarketFilter] = useState<IdeaMarketFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<IdeaDirectionFilter>('ALL');
  const [sortMode, setSortMode] = useState<IdeaSortMode>('editors');
  const [search, setSearch] = useState('');
  const [boostedIds, setBoostedIds] = useState<string[]>(() => loadBoostedIds());
  const [selectedIdea, setSelectedIdea] = useState<MarketIdea | null>(null);
  const [selectedScript, setSelectedScript] = useState<CommunityScriptCard | null>(
    null,
  );
  const [localComments, setLocalComments] = useState<
    Record<string, { author: string; text: string; ago: string }[]>
  >({});
  const [commentDraft, setCommentDraft] = useState('');

  const communityScripts = useMemo(() => buildCommunityScripts(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BOOST_STORAGE_KEY, JSON.stringify(boostedIds));
    } catch {
      // ignore storage errors
    }
  }, [boostedIds]);

  const toggleBoost = (id: string) => {
    setBoostedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = MARKET_IDEAS.filter((idea) => {
      if (marketFilter !== 'all' && idea.category !== marketFilter) return false;
      if (directionFilter !== 'ALL' && idea.direction !== directionFilter) return false;
      if (q) {
        const hay =
          `${idea.title} ${idea.symbol} ${idea.author} ${idea.summary} ${idea.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'editors') {
        const aPick = a.isEditorsPick ? 1 : 0;
        const bPick = b.isEditorsPick ? 1 : 0;
        if (bPick !== aPick) return bPick - aPick;
        return b.likes - a.likes;
      }
      if (sortMode === 'popular') {
        const aScore = a.likes + (boostedIds.includes(a.id) ? 1 : 0);
        const bScore = b.likes + (boostedIds.includes(b.id) ? 1 : 0);
        return bScore - aScore;
      }
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }, [boostedIds, directionFilter, marketFilter, search, sortMode]);

  const filteredScripts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communityScripts.filter((sc) => {
      if (!q) return true;
      return (
        sc.name.toLowerCase().includes(q) ||
        sc.description.toLowerCase().includes(q) ||
        sc.author.toLowerCase().includes(q)
      );
    });
  }, [communityScripts, search]);

  const handleAddComment = (e: FormEvent, ideaId: string) => {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    setLocalComments((prev) => ({
      ...prev,
      [ideaId]: [
        { author: 'Tu (Trader IT)', text, ago: 'Adesso' },
        ...(prev[ideaId] ?? []),
      ],
    }));
    setCommentDraft('');
  };

  const handleApplyScriptToChart = (script: CommunityScriptCard) => {
    applyPineToChart(script.code);
    navigate('chart', script.symbolPreview || activePane.symbolId);
    setBottomPanel(script.isStrategy ? 'strategy' : 'pine');
    setSelectedScript(null);
  };

  return (
    <main className="tvp-page">
      <div className="tvp-inner">
        <header className="tvp-page-header">
          <div>
            <h1 className="tvp-page-title">
              <Lightbulb size={28} style={{ color: 'var(--tv-brand, #2962ff)' }} />
              Idee della community &amp; Script
            </h1>
            <p className="tvp-page-subtitle">
              Analisi tecniche pubblicate dai trader italiani e script Pine v5 pronti da applicare su Supercharts.
            </p>
          </div>
          <div className="tvm-underline-tabs" role="tablist" aria-label="Sezioni community">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'ideas'}
              className={`tvm-underline-tab ${tab === 'ideas' ? 'is-active' : ''}`}
              onClick={() => setTab('ideas')}
            >
              Idee di trading ({MARKET_IDEAS.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'scripts'}
              className={`tvm-underline-tab ${tab === 'scripts' ? 'is-active' : ''}`}
              onClick={() => setTab('scripts')}
            >
              Indicatori e strategie ({communityScripts.length})
            </button>
          </div>
        </header>

        {/* Filters Toolbar */}
        <section className="tvp-toolbar" aria-label="Filtri community">
          {tab === 'ideas' ? (
            <div className="tvp-toolbar-group" role="group" aria-label="Filtro mercato">
              {(
                [
                  { id: 'all', label: 'Tutti i mercati' },
                  { id: 'azioni', label: 'Azioni' },
                  { id: 'cripto', label: 'Cripto' },
                  { id: 'forex', label: 'Forex' },
                  { id: 'indici', label: 'Indici' },
                  { id: 'materie-prime', label: 'Materie Prime' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`tvp-pill ${marketFilter === m.id ? 'is-active' : ''}`}
                  onClick={() => setMarketFilter(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="tvp-toolbar-group">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', fontWeight: 600 }}>
                <Code2 size={16} style={{ color: 'var(--tv-brand, #2962ff)' }} />
                Script Pine Script® v5 verificati ed eseguibili nel motore integrato
              </span>
            </div>
          )}

          <div className="tvp-toolbar-group">
            {tab === 'ideas' && (
              <>
                <div className="tv-segmented" role="group" aria-label="Direzione">
                  {(['ALL', 'LONG', 'SHORT', 'NEUTRALE'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className={`tv-segmented-btn ${directionFilter === dir ? 'is-active' : ''}`}
                      onClick={() => setDirectionFilter(dir)}
                    >
                      {dir === 'ALL' ? 'Tutte' : dir}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Ordina idee"
                  className="tvp-select"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as IdeaSortMode)}
                >
                  <option value="editors">Selezione editoriale</option>
                  <option value="popular">Popolari (Boost)</option>
                  <option value="recent">Più recenti</option>
                </select>
              </>
            )}

            <div className="tvm-search-wrap" style={{ width: 220, height: 34 }}>
              <Search size={15} />
              <input
                type="text"
                className="tvm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === 'ideas'
                    ? 'Cerca titolo, simbolo, autore...'
                    : 'Cerca indicatore o strategia...'
                }
              />
            </div>
          </div>
        </section>

        {/* IDEAS TAB */}
        {tab === 'ideas' && (
          <>
            {filteredIdeas.length === 0 ? (
              <div className="tvp-cal-day-block">
                <div className="tvp-empty-state">
                  <Lightbulb size={28} />
                  <div>Nessuna idea trovata con i filtri attuali.</div>
                </div>
              </div>
            ) : (
              <section className="tvp-ideas-grid" aria-label="Griglia idee di trading">
                {filteredIdeas.map((idea) => {
                  const symInfo = getSymbolByTicker(idea.symbol);
                  const live = quotes[idea.symbol];
                  const isBoosted = boostedIds.includes(idea.id);
                  const boostCount = idea.likes + (isBoosted ? 1 : 0);
                  const commentTotal =
                    idea.comments + (localComments[idea.id]?.length ?? 0);

                  return (
                    <article
                      key={idea.id}
                      className="tvp-idea-card"
                      onClick={() => setSelectedIdea(idea)}
                    >
                      <div className="tvp-idea-thumb">
                        <IdeaMiniChartSvg
                          symbol={idea.symbol}
                          direction={idea.direction}
                        />
                        {idea.isEditorsPick && (
                          <span className="tvp-tv-ribbon">
                            <Flame size={11} />
                            SELEZIONE TV
                          </span>
                        )}
                        <div className="tvp-idea-overlay-badges">
                          <span
                            className="tvm-avatar tvm-avatar--sm"
                            style={{
                              backgroundColor: symInfo?.logoColor ?? '#2962FF',
                              border: '2px solid rgba(19,23,34,0.85)',
                            }}
                          >
                            {symInfo?.logoText ?? idea.symbol.slice(0, 3)}
                          </span>
                          <span
                            className={
                              idea.direction === 'LONG'
                                ? 'tv-long-badge'
                                : idea.direction === 'SHORT'
                                  ? 'tv-short-badge'
                                  : 'tvm-asset-tag'
                            }
                            style={
                              idea.direction === 'NEUTRALE'
                                ? {
                                    backgroundColor: 'rgba(19, 23, 34, 0.85)',
                                    color: '#d1d4dc',
                                    padding: '3px 7px',
                                  }
                                : undefined
                            }
                            title={idea.direction}
                          >
                            {idea.direction === 'LONG' ? (
                              <TrendingUp size={13} />
                            ) : idea.direction === 'SHORT' ? (
                              <TrendingDown size={13} />
                            ) : (
                              'NEUT'
                            )}
                          </span>
                          <span
                            className="tvm-asset-tag"
                            style={{
                              backgroundColor: 'rgba(19, 23, 34, 0.86)',
                              color: '#ffffff',
                              padding: '3px 7px',
                            }}
                          >
                            {idea.symbol} · {idea.timeframe}
                          </span>
                        </div>
                      </div>

                      <div className="tvp-idea-body">
                        <h3 className="tvp-idea-title">{idea.title}</h3>
                        <p className="tvp-idea-excerpt">{idea.summary}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
                          {idea.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tvm-asset-tag">
                              #{tag}
                            </span>
                          ))}
                          {live && (
                            <span
                              className={`tvm-symbol-delta ${
                                live.changePercent >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                              }`}
                              style={{ marginLeft: 'auto', fontSize: '0.73rem' }}
                            >
                              {formatPercent(live.changePercent)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="tvp-idea-footer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="tvp-author-chip">
                          <span
                            className="tvm-avatar tvm-avatar--sm"
                            style={{ backgroundColor: idea.authorAvatarColor }}
                          >
                            {idea.author.slice(0, 2).toUpperCase()}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span
                                className="tv-truncate"
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: 'var(--tv-text-heading, #fff)',
                                }}
                              >
                                di {idea.author}
                              </span>
                              {idea.authorBadge && (
                                <span className="tvp-author-badge">
                                  {idea.authorBadge}
                                </span>
                              )}
                            </div>
                            <span className="tvm-subtitle" style={{ fontSize: '0.7rem' }}>
                              {idea.publishedAgo}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.76rem',
                              color: 'var(--tv-text-secondary, #8c8c8c)',
                            }}
                          >
                            <MessageSquare size={14} />
                            {commentTotal}
                          </span>
                          <button
                            type="button"
                            className={`tvp-boost-btn ${isBoosted ? 'is-boosted' : ''}`}
                            aria-pressed={isBoosted}
                            onClick={() => toggleBoost(idea.id)}
                          >
                            <Rocket size={13} />
                            <span>{boostCount}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}

        {/* SCRIPTS TAB */}
        {tab === 'scripts' && (
          <section className="tvp-ideas-grid" aria-label="Indicatori e strategie Pine Script">
            {filteredScripts.map((script) => {
              const boostKey = `script-${script.id}`;
              const isBoosted = boostedIds.includes(boostKey);
              const boostCount = script.boosts + (isBoosted ? 1 : 0);

              return (
                <article
                  key={script.id}
                  className="tvp-idea-card"
                  onClick={() => setSelectedScript(script)}
                >
                  <div className="tvp-idea-thumb">
                    <IdeaMiniChartSvg
                      symbol={script.symbolPreview}
                      direction="LONG"
                      isScript
                    />
                    {script.isEditorsPick && (
                      <span className="tvp-tv-ribbon">SELEZIONE TV</span>
                    )}
                    <span
                      className={`tvp-script-type-badge ${
                        script.isStrategy ? 'tvp-script-type-badge--strategy' : ''
                      }`}
                    >
                      {script.isStrategy ? 'STRATEGIA' : 'INDICATORE'}
                    </span>
                  </div>

                  <div className="tvp-idea-body">
                    <h3 className="tvp-idea-title">{script.name}</h3>
                    <p className="tvp-idea-excerpt">{script.description}</p>
                    <div
                      style={{ display: 'flex', gap: 8, marginTop: 'auto' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="tvm-btn tvm-btn--sm tvm-btn--primary"
                        style={{ flex: 1 }}
                        onClick={() => handleApplyScriptToChart(script)}
                      >
                        <Play size={13} />
                        Applica sul grafico
                      </button>
                      <button
                        type="button"
                        className="tvm-btn tvm-btn--sm tvm-btn--secondary"
                        onClick={() => setSelectedScript(script)}
                      >
                        <Code2 size={13} />
                        Codice
                      </button>
                    </div>
                  </div>

                  <div
                    className="tvp-idea-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="tvp-author-chip">
                      <span
                        className="tvm-avatar tvm-avatar--sm"
                        style={{ backgroundColor: script.authorColor }}
                      >
                        {script.author.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--tv-text-heading, #fff)' }}>
                            di {script.author}
                          </span>
                          <span className="tvp-author-badge">{script.authorBadge}</span>
                        </div>
                        <span className="tvm-subtitle" style={{ fontSize: '0.7rem' }}>
                          Pine Script® v5
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`tvp-boost-btn ${isBoosted ? 'is-boosted' : ''}`}
                      aria-pressed={isBoosted}
                      onClick={() => toggleBoost(boostKey)}
                    >
                      <Rocket size={13} />
                      <span>{boostCount.toLocaleString('it-IT')}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {/* Idea Detail Modal */}
      {selectedIdea && (() => {
        const symInfo = getSymbolByTicker(selectedIdea.symbol);
        const live = quotes[selectedIdea.symbol];
        const isBoosted = boostedIds.includes(selectedIdea.id);
        const boostCount = selectedIdea.likes + (isBoosted ? 1 : 0);
        const ideaComments = localComments[selectedIdea.id] ?? [];

        return (
          <div
            className="tvm-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={selectedIdea.title}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedIdea(null);
            }}
          >
            <div className="tvm-dialog tvm-dialog--xl">
              <div className="tvm-header">
                <div className="tvm-title-group">
                  <span
                    className="tvm-avatar"
                    style={{ backgroundColor: symInfo?.logoColor ?? '#2962FF' }}
                  >
                    {symInfo?.logoText ?? selectedIdea.symbol.slice(0, 3)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="tvm-title" style={{ whiteSpace: 'normal' }}>
                      {selectedIdea.title}
                    </h2>
                    <div className="tvm-subtitle">
                      di <strong>{selectedIdea.author}</strong> · {selectedIdea.symbol} ({selectedIdea.exchange}) · {selectedIdea.timeframe} · {selectedIdea.publishedAgo}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="tvm-close-btn"
                  aria-label="Chiudi"
                  onClick={() => setSelectedIdea(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid var(--tv-border, #303030)',
                    backgroundColor: 'var(--tv-chart-bg, #131722)',
                    height: 260,
                  }}
                >
                  <IdeaMiniChartSvg
                    symbol={selectedIdea.symbol}
                    direction={selectedIdea.direction}
                    large
                  />
                </div>

                {/* Live Quote + Direction strip */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: 'var(--tv-bg-primary, #131313)',
                    border: '1px solid var(--tv-border, #303030)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className={
                        selectedIdea.direction === 'LONG'
                          ? 'tv-pill-up'
                          : selectedIdea.direction === 'SHORT'
                            ? 'tv-pill-down'
                            : 'tv-pill-neutral'
                      }
                    >
                      {selectedIdea.direction}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                        {selectedIdea.symbol}{' '}
                        {symInfo && (
                          <span style={{ fontWeight: 500, color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                            — {symInfo.name}
                          </span>
                        )}
                      </div>
                      {live && symInfo && (
                        <div className="tv-num" style={{ fontSize: '0.82rem' }}>
                          Quotazione live:{' '}
                          <strong>
                            {formatPrice(live.price, symInfo.precision)} {symInfo.currency}
                          </strong>{' '}
                          <span
                            className={
                              live.changePercent >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                            }
                          >
                            ({formatPercent(live.changePercent)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tvm-btn tvm-btn--primary"
                    onClick={() => {
                      openSymbolInChart(selectedIdea.symbol);
                      setSelectedIdea(null);
                    }}
                  >
                    Apri sul grafico
                    <ArrowUpRight size={15} />
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.65, color: 'var(--tv-text-primary, #dbdbdb)' }}>
                  {selectedIdea.summary}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedIdea.tags.map((tag) => (
                    <span key={tag} className="tvm-asset-tag" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Comment composer */}
                <div style={{ borderTop: '1px solid var(--tv-border, #303030)', paddingTop: 14 }}>
                  <div className="tvm-label" style={{ marginBottom: 8 }}>
                    Commenti ({selectedIdea.comments + ideaComments.length})
                  </div>
                  <form
                    onSubmit={(e) => handleAddComment(e, selectedIdea.id)}
                    style={{ display: 'flex', gap: 8, marginBottom: 10 }}
                  >
                    <input
                      type="text"
                      className="tvm-input"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Aggiungi un commento tecnico all’idea..."
                    />
                    <button type="submit" className="tvm-btn tvm-btn--secondary">
                      <Send size={14} />
                      Invia
                    </button>
                  </form>
                  {ideaComments.map((c, idx) => (
                    <div
                      key={`${selectedIdea.id}-c-${idx}`}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: 'var(--tv-bg-primary, #131313)',
                        border: '1px solid var(--tv-border-subtle, #222222)',
                        marginBottom: 6,
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <strong style={{ color: 'var(--tv-text-heading, #fff)' }}>{c.author}</strong>
                        <span className="tvm-subtitle">{c.ago}</span>
                      </div>
                      <div>{c.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tvm-footer">
                <button
                  type="button"
                  className={`tvp-boost-btn ${isBoosted ? 'is-boosted' : ''}`}
                  onClick={() => toggleBoost(selectedIdea.id)}
                >
                  <Rocket size={14} />
                  <span>{isBoosted ? 'Boost attivo' : 'Metti Boost'} ({boostCount})</span>
                </button>
                <div className="tvm-footer-actions">
                  <button
                    type="button"
                    className="tvm-btn tvm-btn--secondary"
                    onClick={() => setSelectedIdea(null)}
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    className="tvm-btn tvm-btn--primary"
                    onClick={() => {
                      openSymbolInChart(selectedIdea.symbol);
                      setSelectedIdea(null);
                    }}
                  >
                    Apri sul grafico
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pine Script Detail Modal */}
      {selectedScript && (
        <div
          className="tvm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={selectedScript.name}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedScript(null);
          }}
        >
          <div className="tvm-dialog tvm-dialog--lg">
            <div className="tvm-header">
              <div className="tvm-title-group">
                <Code2 size={20} style={{ color: 'var(--tv-brand, #2962ff)' }} />
                <div>
                  <h2 className="tvm-title">{selectedScript.name}</h2>
                  <div className="tvm-subtitle">
                    di {selectedScript.author} · {selectedScript.isStrategy ? 'Strategia Pine v5' : 'Indicatore Pine v5'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="tvm-close-btn"
                aria-label="Chiudi"
                onClick={() => setSelectedScript(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>
                {selectedScript.description}
              </p>
              <div>
                <div className="tvm-label" style={{ marginBottom: 6 }}>
                  Codice sorgente Pine Script® v5
                </div>
                <pre className="tvp-code-block">{selectedScript.code}</pre>
              </div>
            </div>

            <div className="tvm-footer">
              <span className="tvm-subtitle">
                Si carica direttamente nell’Editor Pine integrato con backtest live.
              </span>
              <div className="tvm-footer-actions">
                <button
                  type="button"
                  className="tvm-btn tvm-btn--secondary"
                  onClick={() => setSelectedScript(null)}
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  className="tvm-btn tvm-btn--primary"
                  onClick={() => handleApplyScriptToChart(selectedScript)}
                >
                  <Play size={15} />
                  Applica su Supercharts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CommunityPage;
