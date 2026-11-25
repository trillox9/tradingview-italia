import type {
  QuoteTick,
  ScreenerCategory,
  ScreenerQuery,
  ScreenerRow,
  ScreenerSortField,
  SymbolInfo,
  Timeframe,
} from '../types';
import { SYMBOLS, getCandlesForSymbol } from '../data';
import {
  calculateATR,
  calculateRSI,
  calculateSMA,
  calculateTechnicalSummary,
} from './indicators';

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  query: ScreenerQuery;
}

export const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'top-gainers',
    name: 'Migliori del giorno',
    description: 'Titoli con la maggiore performance positiva giornaliera',
    query: { category: 'all', minChangePercent: 0, sortBy: 'changePercent', sortDir: 'desc' },
  },
  {
    id: 'borsa-italiana',
    name: 'Blue Chip Borsa Italiana',
    description: 'Azioni principali quotate su Piazza Affari (MIL)',
    query: { category: 'italian', sortBy: 'marketCap', sortDir: 'desc' },
  },
  {
    id: 'strong-buy',
    name: 'Segnale Forte Acquisto',
    description: 'Strumenti con valutazione tecnica aggregata Forte acquisto',
    query: { category: 'all', rating: 'Forte acquisto', sortBy: 'technicalScore', sortDir: 'desc' },
  },
  {
    id: 'oversold-rsi',
    name: 'Ipervenduto (RSI < 35)',
    description: 'Strumenti con RSI(14) in zona di possibile rimbalzo',
    query: { category: 'all', maxRsi: 35, sortBy: 'rsi14', sortDir: 'asc' },
  },
  {
    id: 'overbought-rsi',
    name: 'Ipercomprato (RSI > 65)',
    description: 'Strumenti con momentum esteso su RSI(14)',
    query: { category: 'all', minRsi: 65, sortBy: 'rsi14', sortDir: 'desc' },
  },
  {
    id: 'high-dividend',
    name: 'Alti Dividendi (> 4%)',
    description: 'Azioni con rendimento da dividendo superiore al 4%',
    query: { category: 'stocks', sortBy: 'dividendYield', sortDir: 'desc' },
  },
  {
    id: 'crypto-momentum',
    name: 'Criptovalute Attive',
    description: 'Principali criptovalute ordinate per variazione giornaliera',
    query: { category: 'crypto', sortBy: 'changePercent', sortDir: 'desc' },
  },
];

function lastNumber(arr: readonly (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v !== null && Number.isFinite(v)) return Math.round(v * 1000) / 1000;
  }
  return null;
}

/**
 * Computes enriched ScreenerRow objects across the symbol catalog,
 * combining deterministic indicator telemetry (RSI, ATR, SMA20/50, Technical Rating)
 * with optional live QuoteTick prices and volumes.
 */
export function buildScreenerRows(
  symbols: readonly SymbolInfo[] = SYMBOLS,
  liveQuotes?: Map<string, QuoteTick>,
  timeframe: Timeframe = '1D',
): ScreenerRow[] {
  return symbols.map((symbol) => {
    const candles = getCandlesForSymbol(symbol.ticker, timeframe, 220);
    const live = liveQuotes?.get(symbol.ticker);

    const lastCandle = candles[candles.length - 1];
    const price = live?.price ?? lastCandle?.close ?? symbol.basePrice;
    const prevClose = live?.prevClose ?? symbol.prevClose;
    const change = live?.change ?? price - prevClose;
    const changePercent =
      live?.changePercent ??
      (prevClose !== 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0);
    const volume = live?.volume ?? lastCandle?.volume ?? symbol.avgVolume;
    const relativeVolume =
      symbol.avgVolume > 0
        ? Math.round((volume / symbol.avgVolume) * 100) / 100
        : 1;

    const rsi14 = lastNumber(calculateRSI(candles, 14));
    const atr14 = lastNumber(calculateATR(candles, 14));
    const sma20 = lastNumber(calculateSMA(candles.map((c) => c.close), 20));
    const sma50 = lastNumber(calculateSMA(candles.map((c) => c.close), 50));
    const tech = calculateTechnicalSummary(candles);

    return {
      symbol,
      ticker: symbol.ticker,
      name: symbol.name,
      exchange: symbol.exchange,
      assetClass: symbol.assetClass,
      sector: symbol.sector,
      country: symbol.country,
      currency: symbol.currency,
      price,
      change: Math.round(change * Math.pow(10, symbol.precision)) / Math.pow(10, symbol.precision),
      changePercent,
      volume,
      relativeVolume,
      marketCap: symbol.marketCap ?? 0,
      peRatio: symbol.peRatio ?? null,
      dividendYield: symbol.dividendYield ?? null,
      rsi14,
      atr14,
      sma20,
      sma50,
      high52w: symbol.high52w,
      low52w: symbol.low52w,
      technicalRating: tech.summary.rating,
      technicalScore: tech.summary.score,
    };
  });
}

function matchesCategory(row: ScreenerRow, category: ScreenerCategory): boolean {
  switch (category) {
    case 'all':
      return true;
    case 'stocks':
      return row.assetClass === 'stock';
    case 'italian':
      return row.assetClass === 'stock' && row.country === 'IT';
    case 'us':
      return row.assetClass === 'stock' && row.country === 'US';
    case 'crypto':
      return row.assetClass === 'crypto';
    case 'forex':
      return row.assetClass === 'forex';
    case 'indices':
      return row.assetClass === 'index';
    case 'futures':
      return row.assetClass === 'futures';
    case 'bonds':
      return row.assetClass === 'bond';
    case 'etf':
      return row.assetClass === 'etf';
  }
}

function extractSortValue(row: ScreenerRow, field: ScreenerSortField): string | number | null {
  switch (field) {
    case 'ticker':
      return row.ticker;
    case 'name':
      return row.name;
    case 'price':
      return row.price;
    case 'changePercent':
      return row.changePercent;
    case 'volume':
      return row.volume;
    case 'relativeVolume':
      return row.relativeVolume;
    case 'marketCap':
      return row.marketCap;
    case 'peRatio':
      return row.peRatio;
    case 'dividendYield':
      return row.dividendYield;
    case 'rsi14':
      return row.rsi14;
    case 'technicalScore':
      return row.technicalScore;
  }
}

/**
 * Multi-column filter, search, and stable sort for the Azioni / Cripto / Forex Screener.
 */
export function filterAndSortScreener(
  rows: readonly ScreenerRow[],
  query: ScreenerQuery = {},
): ScreenerRow[] {
  const category = query.category ?? 'all';
  const search = (query.search ?? '').trim().toLowerCase();
  const sector = query.sector && query.sector !== 'all' ? query.sector.toLowerCase() : null;
  const country = query.country && query.country !== 'all' ? query.country.toUpperCase() : null;
  const rating = query.rating && query.rating !== 'all' ? query.rating : null;

  const filtered = rows.filter((row) => {
    if (!matchesCategory(row, category)) return false;

    if (search) {
      const hay = `${row.ticker} ${row.name} ${row.exchange} ${row.sector}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }

    if (sector && row.sector.toLowerCase() !== sector) return false;
    if (country && row.country.toUpperCase() !== country) return false;
    if (rating && row.technicalRating !== rating) return false;

    if (query.minPrice !== undefined && row.price < query.minPrice) return false;
    if (query.maxPrice !== undefined && row.price > query.maxPrice) return false;
    if (
      query.minChangePercent !== undefined &&
      row.changePercent < query.minChangePercent
    ) {
      return false;
    }
    if (
      query.maxChangePercent !== undefined &&
      row.changePercent > query.maxChangePercent
    ) {
      return false;
    }
    if (query.minRsi !== undefined && (row.rsi14 === null || row.rsi14 < query.minRsi)) {
      return false;
    }
    if (query.maxRsi !== undefined && (row.rsi14 === null || row.rsi14 > query.maxRsi)) {
      return false;
    }
    if (query.minMarketCap !== undefined && row.marketCap < query.minMarketCap) {
      return false;
    }
    if (query.minVolume !== undefined && row.volume < query.minVolume) {
      return false;
    }

    return true;
  });

  const sortBy = query.sortBy ?? 'marketCap';
  const dir = query.sortDir === 'asc' ? 1 : -1;

  return [...filtered].sort((a, b) => {
    const va = extractSortValue(a, sortBy);
    const vb = extractSortValue(b, sortBy);

    // Always place nulls at the bottom regardless of sort direction
    if (va === null && vb === null) return a.ticker.localeCompare(b.ticker);
    if (va === null) return 1;
    if (vb === null) return -1;

    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb, 'it') * dir;
    }

    const diff = (va as number) - (vb as number);
    if (diff === 0) return a.ticker.localeCompare(b.ticker);
    return diff * dir;
  });
}

export function getScreenerSectors(rows: readonly ScreenerRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.sector) set.add(r.sector);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'));
}
