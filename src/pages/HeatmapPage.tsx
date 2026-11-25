import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Grid2x2,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { DataSourceKind, SymbolInfo } from '../types';
import {
  SYMBOLS,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
} from '../data';
import { useQuotes, useTradingView } from '../store';
import '../styles/modals.css';

type HeatmapMarketFilter = 'all' | 'us' | 'crypto' | 'italy';
type HeatmapSizeMetric = 'marketCap' | 'volume';

interface HeatmapTileItem {
  symbol: SymbolInfo;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  weight: number;
  rawMetric: number;
  source?: DataSourceKind;
}

interface HeatmapSectorGroup {
  name: string;
  avgChangePercent: number;
  totalWeight: number;
  totalMarketCap: number;
  tiles: HeatmapTileItem[];
}

interface LayoutRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Bruls-Huizing-van Wijk Squarified Treemap layout algorithm.
 * Returns normalized 0..100 percentage coordinates for responsive rendering.
 */
function computeSquarifiedLayout<T>(
  items: { item: T; value: number }[],
  containerW: number,
  containerH: number,
): LayoutRect<T>[] {
  const valid = items
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  if (valid.length === 0) return [];

  const totalValue = valid.reduce((acc, i) => acc + i.value, 0);
  const totalArea = containerW * containerH;
  const scaled = valid.map((v) => ({
    item: v.item,
    area: (v.value / totalValue) * totalArea,
  }));

  const results: LayoutRect<T>[] = [];

  const worstRatio = (areas: number[], side: number): number => {
    if (areas.length === 0 || side <= 0) return Infinity;
    const sum = areas.reduce((a, b) => a + b, 0);
    const maxA = Math.max(...areas);
    const minA = Math.min(...areas);
    const s2 = side * side;
    return Math.max((s2 * maxA) / (sum * sum), (sum * sum) / (s2 * minA));
  };

  let rx = 0;
  let ry = 0;
  let rw = containerW;
  let rh = containerH;

  let idx = 0;
  while (idx < scaled.length) {
    const horizontal = rw >= rh;
    const shortSide = Math.min(rw, rh);
    const row: typeof scaled = [scaled[idx]];
    let rowAreas = [scaled[idx].area];
    idx += 1;

    while (idx < scaled.length) {
      const candidate = scaled[idx];
      const nextAreas = [...rowAreas, candidate.area];
      if (worstRatio(nextAreas, shortSide) <= worstRatio(rowAreas, shortSide)) {
        row.push(candidate);
        rowAreas = nextAreas;
        idx += 1;
      } else {
        break;
      }
    }

    const rowSum = rowAreas.reduce((a, b) => a + b, 0);
    if (horizontal) {
      const stripW = rh > 0 ? rowSum / rh : 0;
      let cy = ry;
      for (const entry of row) {
        const tileH = stripW > 0 ? entry.area / stripW : 0;
        results.push({
          item: entry.item,
          x: (rx / containerW) * 100,
          y: (cy / containerH) * 100,
          w: (stripW / containerW) * 100,
          h: (tileH / containerH) * 100,
        });
        cy += tileH;
      }
      rx += stripW;
      rw = Math.max(0, rw - stripW);
    } else {
      const stripH = rw > 0 ? rowSum / rw : 0;
      let cx = rx;
      for (const entry of row) {
        const tileW = stripH > 0 ? entry.area / stripH : 0;
        results.push({
          item: entry.item,
          x: (cx / containerW) * 100,
          y: (ry / containerH) * 100,
          w: (tileW / containerW) * 100,
          h: (stripH / containerH) * 100,
        });
        cx += tileW;
      }
      ry += stripH;
      rh = Math.max(0, rh - stripH);
    }
  }

  return results;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): string {
  const clamped = Math.max(0, Math.min(1, t));
  return `rgb(${lerpChannel(c1[0], c2[0], clamped)}, ${lerpChannel(c1[1], c2[1], clamped)}, ${lerpChannel(c1[2], c2[2], clamped)})`;
}

/**
 * Smooth TradingView heatmap color scale:
 * deep red (#F23645) -> dark red (#991F29) -> neutral (#434651) -> dark green (#056656) -> bright green (#089981)
 */
function getHeatmapTileColor(changePercent: number): string {
  const neutral: [number, number, number] = [67, 70, 81]; // #434651
  const darkRed: [number, number, number] = [153, 31, 41]; // #991F29
  const brightRed: [number, number, number] = [242, 54, 69]; // #F23645
  const darkGreen: [number, number, number] = [5, 102, 86]; // #056656
  const brightGreen: [number, number, number] = [8, 153, 129]; // #089981

  if (Math.abs(changePercent) < 0.05) {
    return '#434651';
  }
  if (changePercent > 0) {
    if (changePercent <= 1.5) {
      return lerpRgb(neutral, darkGreen, changePercent / 1.5);
    }
    return lerpRgb(darkGreen, brightGreen, (changePercent - 1.5) / 2.0);
  }
  const abs = Math.abs(changePercent);
  if (abs <= 1.5) {
    return lerpRgb(neutral, darkRed, abs / 1.5);
  }
  return lerpRgb(darkRed, brightRed, (abs - 1.5) / 2.0);
}

const CRYPTO_DEFI = new Set([
  'UNIUSDT', 'AAVEUSDT', 'LINKUSDT', 'ONDOUSDT', 'ENAUSDT', 'JUPUSDT',
  'LDOUSDT', 'CRVUSDT', 'RUNEUSDT', 'PENDLEUSDT', 'COMPUSDT', 'SNXUSDT',
  'CAKEUSDT', 'RAYUSDT', 'DYDXUSDT', 'HYPEUSDT', 'PAXGUSDT',
]);
const CRYPTO_AI_L2 = new Set([
  'ARBUSDT', 'OPUSDT', 'RENDERUSDT', 'FETUSDT', 'TAOUSDT', 'IMXUSDT',
  'GRTUSDT', 'STXUSDT', 'TIAUSDT', 'WLDUSDT', 'POLUSDT', 'STRKUSDT',
  'ZROUSDT', 'EIGENUSDT', 'VIRTUALUSDT', 'PYTHUSDT', 'FILUSDT', 'ARUSDT',
]);
const CRYPTO_MEME_GAMING = new Set([
  'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT',
  'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'PENGUUSDT', 'TRUMPUSDT', 'AXSUSDT',
  'CHZUSDT',
]);

function resolveHeatmapSector(sym: SymbolInfo, market: HeatmapMarketFilter): string {
  if (market === 'crypto') {
    if (CRYPTO_DEFI.has(sym.ticker)) return 'DeFi & Exchange';
    if (CRYPTO_AI_L2.has(sym.ticker)) return 'AI & Layer 2';
    if (CRYPTO_MEME_GAMING.has(sym.ticker)) return 'Meme & Gaming';
    return 'Layer 1 & Major';
  }
  return sym.sector;
}

const SECTOR_ORDER = [
  'Tecnologia',
  'Finanza',
  'Sanità',
  'Consumi',
  'Energia',
  'Industria',
  'Automotive',
  'Lusso',
  'Layer 1 & Major',
  'DeFi & Exchange',
  'AI & Layer 2',
  'Meme & Gaming',
  'Criptovalute',
];

const LEGEND_STOPS = [-3, -2, -1, 0, 1, 2, 3];

export function HeatmapPage() {
  const { openSymbolInChart, navigate } = useTradingView();
  const { quotes } = useQuotes();

  const [market, setMarket] = useState<HeatmapMarketFilter>('all');
  const [sizeMetric, setSizeMetric] = useState<HeatmapSizeMetric>('marketCap');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [hovered, setHovered] = useState<{
    tile: HeatmapTileItem;
    x: number;
    y: number;
  } | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({
    w: 1332,
    h: 620,
  });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setCanvasSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allMarketTiles = useMemo<HeatmapTileItem[]>(() => {
    const toTile = (sym: SymbolInfo, exponent: number): HeatmapTileItem => {
      const live = quotes[sym.ticker];
      const price = live?.price ?? sym.basePrice;
      const changePercent =
        live?.changePercent ??
        Math.round(((sym.basePrice - sym.prevClose) / sym.prevClose) * 10000) / 100;
      const volume = live?.volume ?? sym.avgVolume;
      const marketCap = sym.marketCap ?? 1;
      const rawMetric =
        sizeMetric === 'marketCap'
          ? Math.max(0.05, marketCap)
          : Math.max(1, (volume * price) / 1_000_000);

      return {
        symbol: sym,
        ticker: sym.ticker,
        name: sym.name,
        exchange: sym.exchange,
        sector: resolveHeatmapSector(sym, market),
        price,
        changePercent,
        marketCap,
        volume,
        rawMetric,
        weight: Math.pow(rawMetric, exponent),
        source: live?.source,
      };
    };

    if (market === 'italy') {
      return SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'IT')
        .map((s) => toTile(s, 0.58))
        .sort((a, b) => b.rawMetric - a.rawMetric);
    }

    if (market === 'us') {
      return SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'US')
        .map((s) => toTile(s, 0.46))
        .sort((a, b) => b.rawMetric - a.rawMetric)
        .slice(0, 45);
    }

    if (market === 'crypto') {
      return SYMBOLS.filter((s) => s.assetClass === 'crypto')
        .map((s) => toTile(s, 0.42))
        .sort((a, b) => b.rawMetric - a.rawMetric)
        .slice(0, 40);
    }

    // Tutti (Top 40): balanced flagship mix of Top 30 US + Top 10 Borsa Italiana
    const topUs = SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'US')
      .map((s) => toTile(s, 0.44))
      .sort((a, b) => b.rawMetric - a.rawMetric)
      .slice(0, 30);
    const topIt = SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'IT')
      .map((s) => toTile(s, 0.44))
      .sort((a, b) => b.rawMetric - a.rawMetric)
      .slice(0, 10);

    return [...topUs, ...topIt].sort((a, b) => b.rawMetric - a.rawMetric);
  }, [market, quotes, sizeMetric]);

  const availableSectors = useMemo(() => {
    const present = new Set(allMarketTiles.map((t) => t.sector));
    return SECTOR_ORDER.filter((sec) => present.has(sec));
  }, [allMarketTiles]);

  const sectorGroups = useMemo<HeatmapSectorGroup[]>(() => {
    const bySector = new Map<string, HeatmapTileItem[]>();
    for (const tile of allMarketTiles) {
      if (selectedSector !== 'all' && tile.sector !== selectedSector) continue;
      const arr = bySector.get(tile.sector) ?? [];
      arr.push(tile);
      bySector.set(tile.sector, arr);
    }

    const groups: HeatmapSectorGroup[] = [];
    for (const sectorName of SECTOR_ORDER) {
      const tiles = bySector.get(sectorName);
      if (!tiles || tiles.length === 0) continue;

      const totalMarketCap = tiles.reduce((a, t) => a + t.marketCap, 0);
      const weightedChange =
        totalMarketCap > 0
          ? tiles.reduce((a, t) => a + t.changePercent * t.marketCap, 0) /
            totalMarketCap
          : tiles.reduce((a, t) => a + t.changePercent, 0) / tiles.length;

      // Apply a gentle per-sector visual floor so smaller tiles remain legible
      const sumW = tiles.reduce((acc, t) => acc + t.weight, 0);
      const floorRatio =
        tiles.length <= 2 ? 0.24 : tiles.length <= 5 ? 0.12 : 0.055;
      const minTileWeight = sumW * floorRatio;
      const adjustedTiles = tiles
        .map((t) => ({
          ...t,
          weight: Math.max(t.weight, minTileWeight),
        }))
        .sort((a, b) => b.weight - a.weight);

      const totalWeight = adjustedTiles.reduce((a, t) => a + t.weight, 0);

      groups.push({
        name: sectorName,
        avgChangePercent: Math.round(weightedChange * 100) / 100,
        totalWeight,
        totalMarketCap,
        tiles: adjustedTiles,
      });
    }

    return groups;
  }, [allMarketTiles, selectedSector]);

  const sectorRects = useMemo(
    () =>
      computeSquarifiedLayout(
        sectorGroups.map((g) => ({ item: g, value: g.totalWeight })),
        canvasSize.w,
        canvasSize.h,
      ),
    [canvasSize.h, canvasSize.w, sectorGroups],
  );

  const stats = useMemo(() => {
    const allTiles = sectorGroups.flatMap((g) => g.tiles);
    const up = allTiles.filter((t) => t.changePercent > 0.05).length;
    const down = allTiles.filter((t) => t.changePercent < -0.05).length;
    const flat = allTiles.length - up - down;
    const liveCount = allTiles.filter(
      (t) => t.source === 'binance' || t.source === 'yahoo',
    ).length;
    const best = [...allTiles].sort((a, b) => b.changePercent - a.changePercent)[0];
    const worst = [...allTiles].sort((a, b) => a.changePercent - b.changePercent)[0];
    const totalCap = allTiles.reduce((a, t) => a + t.marketCap, 0);
    const avg =
      totalCap > 0
        ? allTiles.reduce((a, t) => a + t.changePercent * t.marketCap, 0) / totalCap
        : 0;
    return { total: allTiles.length, up, down, flat, liveCount, best, worst, avg };
  }, [sectorGroups]);

  const handleTileMove = (tile: HeatmapTileItem, e: MouseEvent<HTMLButtonElement>) => {
    const tooltipW = 268;
    const tooltipH = 200;
    const x =
      e.clientX + 16 + tooltipW > window.innerWidth
        ? Math.max(12, e.clientX - tooltipW - 14)
        : e.clientX + 16;
    const y =
      e.clientY + 16 + tooltipH > window.innerHeight
        ? Math.max(12, e.clientY - tooltipH - 14)
        : e.clientY + 16;
    setHovered({ tile, x, y });
  };

  return (
    <main className="tvp-page">
      <div className="tvp-inner">
        <header className="tvp-page-header">
          <div>
            <h1 className="tvp-page-title">
              <Grid2x2 size={28} style={{ color: 'var(--tv-brand, #2962ff)' }} />
              Mappa di calore dei mercati
            </h1>
            <p className="tvp-page-subtitle">
              Treemap proporzionale in tempo reale su 222 strumenti reali — Wall Street (NASDAQ/NYSE), Cripto Live Binance e Borsa Italiana.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="tvm-btn tvm-btn--secondary"
              onClick={() => navigate('screener')}
            >
              <SlidersHorizontal size={15} />
              Screener (222)
            </button>
            <button
              type="button"
              className="tvm-btn tvm-btn--primary"
              onClick={() => openSymbolInChart(market === 'crypto' ? 'BTCUSDT' : 'FTSEMIB')}
            >
              Apri Supercharts
              <ArrowUpRight size={15} />
            </button>
          </div>
        </header>

        {/* Summary KPI Strip */}
        <section className="tvp-kpi-grid" aria-label="Riepilogo mappa di calore">
          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">
              <span>Performance ponderata</span>
              {stats.avg >= 0 ? (
                <TrendingUp size={15} className="tvm-delta-up" />
              ) : (
                <TrendingDown size={15} className="tvm-delta-down" />
              )}
            </span>
            <span
              className={`tvp-kpi-value ${
                stats.avg >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
              }`}
            >
              {formatPercent(stats.avg)}
            </span>
            <span className="tvp-kpi-sub">
              {stats.total} riquadri · {stats.liveCount > 0 ? `${stats.liveCount} feed live` : 'dati reali'}
            </span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Ampiezza di mercato</span>
            <span className="tvp-kpi-value">
              <span className="tvm-delta-up">{stats.up}</span>
              <span style={{ color: 'var(--tv-text-muted, #707070)', margin: '0 6px' }}>/</span>
              <span className="tvm-delta-down">{stats.down}</span>
            </span>
            <span className="tvp-kpi-sub">
              {stats.up} rialzi · {stats.flat} invariati · {stats.down} ribassi
            </span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Miglior titolo</span>
            <span className="tvp-kpi-value tvm-delta-up">
              {stats.best ? `${stats.best.ticker} ${formatPercent(stats.best.changePercent)}` : '—'}
            </span>
            <span className="tvp-kpi-sub tv-truncate">{stats.best?.name ?? ''}</span>
          </div>

          <div className="tvp-kpi-card">
            <span className="tvp-kpi-label">Peggior titolo</span>
            <span className="tvp-kpi-value tvm-delta-down">
              {stats.worst ? `${stats.worst.ticker} ${formatPercent(stats.worst.changePercent)}` : '—'}
            </span>
            <span className="tvp-kpi-sub tv-truncate">{stats.worst?.name ?? ''}</span>
          </div>
        </section>

        {/* Controls Toolbar */}
        <section className="tvp-toolbar" aria-label="Filtri mappa di calore">
          <div className="tvp-toolbar-group" role="tablist" aria-label="Mercato">
            {(
              [
                { id: 'all', label: 'Tutti (Top 40)' },
                { id: 'us', label: '🇺🇸 Azioni USA (Top 45)' },
                { id: 'crypto', label: '₿ Cripto (Top 40)' },
                { id: 'italy', label: '🇮🇹 Azioni Italia (20)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={market === tab.id}
                className={`tvp-pill ${market === tab.id ? 'is-active' : ''}`}
                onClick={() => {
                  setMarket(tab.id);
                  setSelectedSector('all');
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="tvp-toolbar-group">
            <select
              aria-label="Filtra per settore"
              className="tvp-select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <option value="all">Tutti i settori ({availableSectors.length})</option>
              {availableSectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            <div className="tv-segmented" role="group" aria-label="Dimensione riquadri">
              <button
                type="button"
                className={`tv-segmented-btn ${sizeMetric === 'marketCap' ? 'is-active' : ''}`}
                onClick={() => setSizeMetric('marketCap')}
              >
                Cap. di mercato
              </button>
              <button
                type="button"
                className={`tv-segmented-btn ${sizeMetric === 'volume' ? 'is-active' : ''}`}
                onClick={() => setSizeMetric('volume')}
              >
                <BarChart3 size={12} style={{ marginRight: 4 }} />
                Volume
              </button>
            </div>
          </div>
        </section>

        {/* Interactive Squarified Treemap */}
        <section
          ref={canvasRef}
          className="tvp-heatmap-canvas"
          aria-label="Mappa di calore interattiva"
          onMouseLeave={() => setHovered(null)}
        >
          {sectorRects.map((sRect) => {
            const group = sRect.item;
            const innerW = Math.max(40, (sRect.w / 100) * canvasSize.w - 6);
            const innerH = Math.max(40, (sRect.h / 100) * canvasSize.h - 30);
            const tileRects = computeSquarifiedLayout(
              group.tiles.map((t) => ({ item: t, value: t.weight })),
              innerW,
              innerH,
            );

            return (
              <div
                key={group.name}
                className="tvp-hm-sector"
                style={{
                  left: `${sRect.x}%`,
                  top: `${sRect.y}%`,
                  width: `${sRect.w}%`,
                  height: `${sRect.h}%`,
                }}
              >
                <div className="tvp-hm-sector-inner">
                  <div className="tvp-hm-sector-head">
                    <span className="tv-truncate">{group.name}</span>
                    <span
                      className={
                        group.avgChangePercent >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                      }
                    >
                      {formatPercent(group.avgChangePercent)}
                    </span>
                  </div>

                  <div className="tvp-hm-sector-tiles">
                    {tileRects.map((tRect) => {
                      const tile = tRect.item;
                      const bg = getHeatmapTileColor(tile.changePercent);
                      const approxPxW = (tRect.w / 100) * innerW;
                      const approxPxH = (tRect.h / 100) * innerH;
                      const area = approxPxW * approxPxH;
                      const displayLabel =
                        tile.symbol.assetClass === 'crypto'
                          ? tile.ticker.replace(/USDT$/, '')
                          : tile.ticker;
                      const showTicker = approxPxW >= 34 && approxPxH >= 20;
                      const showPct = approxPxW >= 54 && approxPxH >= 38;
                      const showSub =
                        area > 20000 && approxPxW >= 145 && approxPxH >= 104;
                      const charFitPx = Math.floor(
                        (approxPxW - 10) / Math.max(2.6, displayLabel.length * 0.72),
                      );
                      const heightFitPx = Math.floor(approxPxH * (showPct ? 0.28 : 0.42));
                      const tickerPx = Math.max(
                        10,
                        Math.min(20, charFitPx, heightFitPx),
                      );
                      const pctPx = Math.max(
                        10,
                        Math.min(
                          14,
                          Math.floor((approxPxW - 10) / 5.4),
                          Math.floor(approxPxH * 0.2),
                        ),
                      );

                      return (
                        <button
                          key={tile.symbol.id}
                          type="button"
                          className="tvp-hm-tile"
                          style={{
                            left: `${tRect.x}%`,
                            top: `${tRect.y}%`,
                            width: `${tRect.w}%`,
                            height: `${tRect.h}%`,
                            backgroundColor: bg,
                          }}
                          onClick={() => openSymbolInChart(tile.ticker)}
                          onMouseEnter={(e) => handleTileMove(tile, e)}
                          onMouseMove={(e) => handleTileMove(tile, e)}
                          aria-label={`${tile.ticker} ${tile.name} ${formatPercent(tile.changePercent)}`}
                        >
                          {showTicker && (
                            <span
                              className="tvp-hm-tile-ticker"
                              style={{ fontSize: `${tickerPx}px` }}
                            >
                              {displayLabel}
                            </span>
                          )}
                          {showPct && (
                            <span
                              className="tvp-hm-tile-pct"
                              style={{ fontSize: `${pctPx}px` }}
                            >
                              {formatPercent(tile.changePercent)}
                            </span>
                          )}
                          {showSub && (
                            <span className="tvp-hm-tile-sub">
                              {formatPrice(tile.price, tile.symbol.precision)}{' '}
                              {tile.symbol.currency} · {tile.symbol.shortName}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Legend Footer */}
        <footer className="tvp-hm-legend">
          <span className="tvm-subtitle">
            Passa il mouse su un riquadro per quotazione live e dettagli; clicca per aprire su Supercharts.
          </span>
          <div className="tvp-hm-scale" aria-label="Scala colori performance">
            {LEGEND_STOPS.map((stop) => (
              <span
                key={stop}
                className="tvp-hm-scale-step"
                style={{ backgroundColor: getHeatmapTileColor(stop) }}
              >
                {stop > 0 ? `+${stop}%` : `${stop}%`}
              </span>
            ))}
          </div>
        </footer>
      </div>

      {/* Rich Floating Hover Tooltip */}
      {hovered && (
        <div
          className="tvp-hm-tooltip"
          style={{ left: hovered.x, top: hovered.y }}
          role="tooltip"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                className="tvm-avatar tvm-avatar--sm"
                style={{ backgroundColor: hovered.tile.symbol.logoColor }}
              >
                {hovered.tile.symbol.logoText}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--tv-text-heading, #fff)', fontSize: '0.88rem' }}>
                  <span>{hovered.tile.ticker}</span>
                  <span className="tvm-asset-tag">{hovered.tile.exchange}</span>
                  {(hovered.tile.source === 'binance' || hovered.tile.source === 'yahoo') && (
                    <span className="tvm-source-badge tvm-source-badge--live">LIVE</span>
                  )}
                  {hovered.tile.source === 'snapshot' && (
                    <span className="tvm-source-badge tvm-source-badge--real">REALE</span>
                  )}
                </div>
                <div className="tvm-subtitle tv-truncate">{hovered.tile.name}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px',
              fontSize: '0.78rem',
              paddingTop: 8,
              borderTop: '1px solid var(--tv-border-subtle, #222222)',
            }}
          >
            <div>
              <div className="tvm-subtitle">Prezzo</div>
              <div className="tv-num" style={{ fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                {formatPrice(hovered.tile.price, hovered.tile.symbol.precision)}{' '}
                {hovered.tile.symbol.currency}
              </div>
            </div>
            <div>
              <div className="tvm-subtitle">Variazione 24h</div>
              <div
                className={`tv-num ${
                  hovered.tile.changePercent >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                }`}
                style={{ fontWeight: 700 }}
              >
                {formatPercent(hovered.tile.changePercent)}
              </div>
            </div>
            <div>
              <div className="tvm-subtitle">Cap. Mercato</div>
              <div className="tv-num" style={{ fontWeight: 600 }}>
                {formatMarketCap(hovered.tile.marketCap)}
              </div>
            </div>
            <div>
              <div className="tvm-subtitle">Volume</div>
              <div className="tv-num" style={{ fontWeight: 600 }}>
                {formatVolume(hovered.tile.volume)}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--tv-border-subtle, #222222)',
              fontSize: '0.72rem',
              color: 'var(--tv-link, #5b9cf6)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Settore: {hovered.tile.sector}</span>
            <span>Apri grafico →</span>
          </div>
        </div>
      )}
    </main>
  );
}

export default HeatmapPage;
