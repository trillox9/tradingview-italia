import type {
  Candle,
  DataSourceKind,
  QuoteTick,
  SymbolInfo,
  Timeframe,
} from '../types';
import { getSymbolByTicker } from './symbols';

export const BINANCE_REST_BASES = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
] as const;

export const BINANCE_WS_BASES = [
  'wss://data-stream.binance.vision',
  'wss://stream.binance.com:9443',
] as const;

export const BINANCE_INTERVAL_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
};

export const YAHOO_INTERVAL_SPEC: Record<
  Timeframe,
  { interval: string; range: string; aggregateHours?: number }
> = {
  '1m': { interval: '1m', range: '5d' },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '1mo' },
  '1H': { interval: '60m', range: '3mo' },
  '4H': { interval: '60m', range: '6mo', aggregateHours: 4 },
  '1D': { interval: '1d', range: '1y' },
  '1W': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: '10y' },
};

export interface CompactSnapshotEntry {
  /** [price, prevClose, open, high, low, volume, high52w, low52w] */
  q: [number, number, number, number, number, number, number, number];
  /** Compact daily OHLCV tuples: [timeSec, open, high, low, close, volume] */
  c: [number, number, number, number, number, number][];
}

export interface RealMarketSnapshot {
  generatedAt: number;
  source: 'yahoo';
  count: number;
  symbols: Record<string, CompactSnapshotEntry>;
}

/** True under Vitest / Node test runs — prevents real outbound network calls in unit tests */
export function isTestEnvironment(): boolean {
  try {
    const proc = (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process;
    if (proc?.env && (proc.env.VITEST || proc.env.NODE_ENV === 'test')) {
      return true;
    }
  } catch {
    // Browser environment without process
  }
  try {
    const meta = import.meta as unknown as { env?: { MODE?: string } };
    if (meta?.env?.MODE === 'test') return true;
  } catch {
    // Ignore
  }
  return false;
}

function roundTo(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function computeSpread(price: number, symbol: SymbolInfo): number {
  return Math.max(symbol.tickSize, roundTo(price * 0.00012, symbol.precision));
}

// ======================== PURE PARSERS (UNIT TESTED) ========================

/** Parses Binance `/api/v3/klines` array rows into canonical `Candle[]` */
export function parseBinanceKlines(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) return [];
  const candles: Candle[] = [];

  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const openTimeMs = Number(row[0]);
    const open = Number.parseFloat(String(row[1]));
    const high = Number.parseFloat(String(row[2]));
    const low = Number.parseFloat(String(row[3]));
    const close = Number.parseFloat(String(row[4]));
    const volume = Number.parseFloat(String(row[5]));

    if (
      !Number.isFinite(openTimeMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      continue;
    }

    candles.push({
      time: Math.floor(openTimeMs / 1000),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      volume: Number.isFinite(volume) && volume >= 0 ? volume : 0,
    });
  }

  return candles;
}

/** Parses Binance `/api/v3/ticker/24hr` payload into `QuoteTick[]` */
export function parseBinance24hrTickers(
  raw: unknown,
  allowedTickers?: Set<string>,
  nowMs = Date.now(),
): QuoteTick[] {
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const quotes: QuoteTick[] = [];

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const ticker = typeof rec.symbol === 'string' ? rec.symbol.toUpperCase() : '';
    if (!ticker) continue;
    if (allowedTickers && !allowedTickers.has(ticker)) continue;

    const symbol = getSymbolByTicker(ticker);
    if (!symbol) continue;

    const price = Number.parseFloat(String(rec.lastPrice ?? ''));
    const open = Number.parseFloat(String(rec.openPrice ?? ''));
    const high = Number.parseFloat(String(rec.highPrice ?? ''));
    const low = Number.parseFloat(String(rec.lowPrice ?? ''));
    const volume = Number.parseFloat(String(rec.volume ?? '0'));
    const bidRaw = Number.parseFloat(String(rec.bidPrice ?? ''));
    const askRaw = Number.parseFloat(String(rec.askPrice ?? ''));

    if (!Number.isFinite(price) || price <= 0) continue;

    const prevClose = Number.isFinite(open) && open > 0 ? open : price;
    const change = roundTo(price - prevClose, symbol.precision);
    const changePercentRaw = Number.parseFloat(String(rec.priceChangePercent ?? ''));
    const changePercent = Number.isFinite(changePercentRaw)
      ? Math.round(changePercentRaw * 100) / 100
      : prevClose > 0
        ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
        : 0;

    const spread = computeSpread(price, symbol);
    const bid =
      Number.isFinite(bidRaw) && bidRaw > 0
        ? roundTo(bidRaw, symbol.precision)
        : roundTo(Math.max(symbol.tickSize, price - spread / 2), symbol.precision);
    const ask =
      Number.isFinite(askRaw) && askRaw > 0
        ? roundTo(askRaw, symbol.precision)
        : roundTo(price + spread / 2, symbol.precision);

    quotes.push({
      ticker: symbol.ticker,
      id: symbol.id,
      price: roundTo(price, symbol.precision),
      open: roundTo(prevClose, symbol.precision),
      high: Number.isFinite(high) && high > 0 ? roundTo(Math.max(high, price), symbol.precision) : roundTo(price, symbol.precision),
      low: Number.isFinite(low) && low > 0 ? roundTo(Math.min(low, price), symbol.precision) : roundTo(price, symbol.precision),
      prevClose: roundTo(prevClose, symbol.precision),
      change,
      changePercent,
      volume: Number.isFinite(volume) && volume >= 0 ? Math.round(volume) : symbol.avgVolume,
      bid,
      ask,
      timestamp: nowMs,
      source: 'binance',
    });
  }

  return quotes;
}

/** Aggregates hourly candles into N-hour buckets (used for Yahoo 4H timeframe) */
export function aggregateCandlesByHours(
  candles: readonly Candle[],
  hours: number,
): Candle[] {
  if (hours <= 1 || candles.length === 0) return candles.slice();
  const bucketSec = hours * 3600;
  const out: Candle[] = [];

  for (const c of candles) {
    const bucketTime = Math.floor(c.time / bucketSec) * bucketSec;
    const tail = out[out.length - 1];
    if (tail && tail.time === bucketTime) {
      tail.high = Math.max(tail.high, c.high);
      tail.low = Math.min(tail.low, c.low);
      tail.close = c.close;
      tail.volume += c.volume;
    } else {
      out.push({
        time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    }
  }

  return out;
}

/** Aggregates real daily candles into genuine weekly (`1W`) or monthly (`1M`) OHLCV bars */
export function aggregateDailyCandles(
  daily: readonly Candle[],
  mode: '1W' | '1M',
): Candle[] {
  if (daily.length === 0) return [];
  const out: Candle[] = [];

  for (const c of daily) {
    const d = new Date(c.time * 1000);
    let bucketTime: number;
    if (mode === '1W') {
      // Align to Monday 00:00 UTC
      const dayOfWeek = (d.getUTCDay() + 6) % 7;
      bucketTime = Math.floor(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek) / 1000,
      );
    } else {
      bucketTime = Math.floor(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000,
      );
    }

    const tail = out[out.length - 1];
    if (tail && tail.time === bucketTime) {
      tail.high = Math.max(tail.high, c.high);
      tail.low = Math.min(tail.low, c.low);
      tail.close = c.close;
      tail.volume += c.volume;
    } else {
      out.push({
        time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    }
  }

  return out;
}

/** Parses Yahoo Finance `/v8/finance/chart` response into real `Candle[]` + live `QuoteTick` */
export function parseYahooChartResponse(
  raw: unknown,
  symbol: SymbolInfo,
  aggregateHours?: number,
  nowMs = Date.now(),
): { candles: Candle[]; quote: QuoteTick | null } {
  if (!raw || typeof raw !== 'object') return { candles: [], quote: null };
  const chart = (raw as { chart?: { result?: unknown[] } }).chart;
  const first = Array.isArray(chart?.result) ? chart.result[0] : null;
  if (!first || typeof first !== 'object') return { candles: [], quote: null };

  const res = first as {
    meta?: Record<string, unknown>;
    timestamp?: unknown[];
    indicators?: { quote?: Array<Record<string, unknown[]>> };
  };

  const timestamps = Array.isArray(res.timestamp) ? res.timestamp : [];
  const qArr = res.indicators?.quote?.[0];
  const opens = Array.isArray(qArr?.open) ? qArr.open : [];
  const highs = Array.isArray(qArr?.high) ? qArr.high : [];
  const lows = Array.isArray(qArr?.low) ? qArr.low : [];
  const closes = Array.isArray(qArr?.close) ? qArr.close : [];
  const volumes = Array.isArray(qArr?.volume) ? qArr.volume : [];

  const parsed: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = Number(timestamps[i]);
    const o = Number(opens[i]);
    const h = Number(highs[i]);
    const l = Number(lows[i]);
    const c = Number(closes[i]);
    const v = Number(volumes[i]);

    if (
      !Number.isFinite(t) ||
      !Number.isFinite(o) ||
      !Number.isFinite(h) ||
      !Number.isFinite(l) ||
      !Number.isFinite(c) ||
      c <= 0
    ) {
      continue;
    }

    const ro = roundTo(o, symbol.precision);
    const rc = roundTo(c, symbol.precision);
    const rh = Math.max(roundTo(h, symbol.precision), ro, rc);
    const rl = Math.min(roundTo(l, symbol.precision), ro, rc);

    parsed.push({
      time: Math.floor(t),
      open: ro,
      high: rh,
      low: rl,
      close: rc,
      volume: Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
    });
  }

  const candles =
    aggregateHours && aggregateHours > 1
      ? aggregateCandlesByHours(parsed, aggregateHours)
      : parsed;

  const meta = res.meta ?? {};
  const lastBar = candles[candles.length - 1];
  const prevBar = candles.length >= 2 ? candles[candles.length - 2] : lastBar;

  const metaPrice = Number(meta.regularMarketPrice);
  const price =
    Number.isFinite(metaPrice) && metaPrice > 0
      ? roundTo(metaPrice, symbol.precision)
      : lastBar
        ? lastBar.close
        : 0;

  if (price <= 0) {
    return { candles, quote: null };
  }

  const metaPrev = Number(meta.previousClose);
  const metaChartPrev = Number(meta.chartPreviousClose);
  const prevClose =
    Number.isFinite(metaPrev) && metaPrev > 0
      ? roundTo(metaPrev, symbol.precision)
      : prevBar && prevBar.close > 0
        ? prevBar.close
        : Number.isFinite(metaChartPrev) && metaChartPrev > 0
          ? roundTo(metaChartPrev, symbol.precision)
          : price;

  const metaHigh = Number(meta.regularMarketDayHigh);
  const metaLow = Number(meta.regularMarketDayLow);
  const metaVol = Number(meta.regularMarketVolume);

  const high =
    Number.isFinite(metaHigh) && metaHigh > 0
      ? roundTo(Math.max(metaHigh, price), symbol.precision)
      : lastBar
        ? Math.max(lastBar.high, price)
        : price;
  const low =
    Number.isFinite(metaLow) && metaLow > 0
      ? roundTo(Math.min(metaLow, price), symbol.precision)
      : lastBar
        ? Math.min(lastBar.low, price)
        : price;
  const open = lastBar ? lastBar.open : prevClose;
  const volume =
    Number.isFinite(metaVol) && metaVol > 0
      ? Math.round(metaVol)
      : lastBar
        ? lastBar.volume
        : symbol.avgVolume;

  const change = roundTo(price - prevClose, symbol.precision);
  const changePercent =
    prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
  const spread = computeSpread(price, symbol);

  const quote: QuoteTick = {
    ticker: symbol.ticker,
    id: symbol.id,
    price,
    open,
    high,
    low,
    prevClose,
    change,
    changePercent,
    volume,
    bid: roundTo(Math.max(symbol.tickSize, price - spread / 2), symbol.precision),
    ask: roundTo(price + spread / 2, symbol.precision),
    timestamp: nowMs,
    source: 'yahoo',
  };

  return { candles, quote };
}

/** Validates and normalizes the static `public/real-market-snapshot.json` payload */
export function parseRealSnapshot(raw: unknown): RealMarketSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<RealMarketSnapshot>;
  if (!obj.symbols || typeof obj.symbols !== 'object') return null;

  const validSymbols: Record<string, CompactSnapshotEntry> = {};
  for (const [ticker, entry] of Object.entries(obj.symbols)) {
    if (
      !entry ||
      !Array.isArray(entry.q) ||
      entry.q.length < 6 ||
      !Array.isArray(entry.c) ||
      entry.c.length === 0
    ) {
      continue;
    }
    validSymbols[ticker.toUpperCase()] = entry as CompactSnapshotEntry;
  }

  return {
    generatedAt: typeof obj.generatedAt === 'number' ? obj.generatedAt : Date.now(),
    source: 'yahoo',
    count: Object.keys(validSymbols).length,
    symbols: validSymbols,
  };
}

/** Converts a snapshot entry into a canonical `QuoteTick` with `source: 'snapshot'` */
export function snapshotEntryToQuote(
  symbol: SymbolInfo,
  entry: CompactSnapshotEntry,
  nowMs = Date.now(),
): QuoteTick {
  const [rawPrice, rawPrev, rawOpen, rawHigh, rawLow, rawVol] = entry.q;
  const price = roundTo(rawPrice, symbol.precision);
  const prevClose = roundTo(rawPrev > 0 ? rawPrev : price, symbol.precision);
  const open = roundTo(rawOpen > 0 ? rawOpen : prevClose, symbol.precision);
  const high = roundTo(Math.max(rawHigh, price), symbol.precision);
  const low = roundTo(Math.min(rawLow > 0 ? rawLow : price, price), symbol.precision);
  const change = roundTo(price - prevClose, symbol.precision);
  const changePercent =
    prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
  const spread = computeSpread(price, symbol);

  return {
    ticker: symbol.ticker,
    id: symbol.id,
    price,
    open,
    high,
    low,
    prevClose,
    change,
    changePercent,
    volume: Number.isFinite(rawVol) && rawVol >= 0 ? Math.round(rawVol) : symbol.avgVolume,
    bid: roundTo(Math.max(symbol.tickSize, price - spread / 2), symbol.precision),
    ask: roundTo(price + spread / 2, symbol.precision),
    timestamp: nowMs,
    source: 'snapshot',
  };
}

/** Converts a snapshot entry's compact tuples into `Candle[]` */
export function snapshotEntryToCandles(
  entry: CompactSnapshotEntry,
  timeframe: Timeframe = '1D',
): Candle[] {
  const daily: Candle[] = entry.c.map(([time, open, high, low, close, volume]) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  }));
  if (timeframe === '1W' || timeframe === '1M') {
    return aggregateDailyCandles(daily, timeframe);
  }
  return daily;
}

// ======================== IN-MEMORY CACHES & LIVE FETCHERS ========================

interface CandleCacheEntry {
  candles: Candle[];
  source: DataSourceKind;
  quote?: QuoteTick | null;
  expiresAt: number;
}

const klineCache = new Map<string, CandleCacheEntry>();
let loadedSnapshot: RealMarketSnapshot | null = null;
let snapshotLoadPromise: Promise<RealMarketSnapshot | null> | null = null;

function ttlForTimeframe(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m':
    case '5m':
      return 15_000;
    case '15m':
    case '1H':
    case '4H':
      return 60_000;
    case '1D':
    case '1W':
    case '1M':
      return 5 * 60_000;
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Loads `public/real-market-snapshot.json` once and caches in memory */
export async function loadRealSnapshot(): Promise<RealMarketSnapshot | null> {
  if (loadedSnapshot) return loadedSnapshot;
  if (isTestEnvironment() || typeof fetch === 'undefined') return null;

  if (!snapshotLoadPromise) {
    snapshotLoadPromise = (async () => {
      const base =
        (typeof import.meta !== 'undefined' &&
          (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
        './';
      const normalizedBase = base.endsWith('/') ? base : `${base}/`;
      const url = `${normalizedBase}real-market-snapshot.json`;
      const raw = await fetchJsonWithTimeout(url, 12_000);
      const parsed = parseRealSnapshot(raw);
      if (parsed) {
        loadedSnapshot = parsed;
      }
      return parsed;
    })();
  }

  return snapshotLoadPromise;
}

/** Allows tests or SSR hydration to seed the snapshot cache synchronously */
export function setLoadedSnapshotForTest(snapshot: RealMarketSnapshot | null): void {
  loadedSnapshot = snapshot;
  snapshotLoadPromise = snapshot ? Promise.resolve(snapshot) : null;
}

export function getLoadedSnapshot(): RealMarketSnapshot | null {
  return loadedSnapshot;
}

export function getSnapshotQuote(ticker: string): QuoteTick | null {
  if (!loadedSnapshot) return null;
  const sym = getSymbolByTicker(ticker);
  if (!sym) return null;
  const entry = loadedSnapshot.symbols[sym.ticker];
  if (!entry) return null;
  return snapshotEntryToQuote(sym, entry);
}

export function getSnapshotCandles(
  ticker: string,
  timeframe: Timeframe,
): Candle[] | null {
  if (!loadedSnapshot) return null;
  if (timeframe !== '1D' && timeframe !== '1W' && timeframe !== '1M') {
    return null;
  }
  const sym = getSymbolByTicker(ticker);
  if (!sym) return null;
  const entry = loadedSnapshot.symbols[sym.ticker];
  if (!entry) return null;
  const bars = snapshotEntryToCandles(entry, timeframe);
  return bars.length > 0 ? bars : null;
}

export function getCachedRealCandles(
  ticker: string,
  timeframe: Timeframe,
): { candles: Candle[]; source: DataSourceKind; quote?: QuoteTick | null } | null {
  const sym = getSymbolByTicker(ticker);
  if (!sym) return null;
  const key = `${sym.ticker}|${timeframe}`;
  const hit = klineCache.get(key);
  if (hit && hit.expiresAt > Date.now() && hit.candles.length > 0) {
    return {
      candles: hit.candles.map((c) => ({ ...c })),
      source: hit.source,
      quote: hit.quote,
    };
  }
  const snap = getSnapshotCandles(sym.ticker, timeframe);
  if (snap && snap.length > 0) {
    return {
      candles: snap.map((c) => ({ ...c })),
      source: 'snapshot',
      quote: getSnapshotQuote(sym.ticker),
    };
  }
  return null;
}

/** Fetches live batch 24h tickers from Binance Vision (fallback: api.binance.com) */
export async function fetchBinance24hrTickers(
  tickers?: string[],
): Promise<QuoteTick[]> {
  if (isTestEnvironment() || typeof fetch === 'undefined') return [];

  const allowed = tickers
    ? new Set(tickers.map((t) => t.toUpperCase()))
    : undefined;

  for (const base of BINANCE_REST_BASES) {
    // Use symbols=[...] query for small lists or full 24hr endpoint when fetching the whole catalog
    const url =
      allowed && allowed.size > 0 && allowed.size <= 30
        ? `${base}/api/v3/ticker/24hr?symbols=${encodeURIComponent(
            JSON.stringify(Array.from(allowed)),
          )}`
        : `${base}/api/v3/ticker/24hr`;

    const raw = await fetchJsonWithTimeout(url, 10_000);
    if (raw) {
      const parsed = parseBinance24hrTickers(raw, allowed);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

/** Fetches live historical OHLCV klines from Binance Vision for any crypto pair & timeframe */
export async function fetchBinanceKlines(
  symbol: SymbolInfo,
  timeframe: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  if (isTestEnvironment() || typeof fetch === 'undefined' || !symbol.binanceSymbol) {
    return [];
  }

  const cacheKey = `${symbol.ticker}|${timeframe}`;
  const cached = klineCache.get(cacheKey);
  if (cached && cached.source === 'binance' && cached.expiresAt > Date.now()) {
    return cached.candles.map((c) => ({ ...c }));
  }

  const interval = BINANCE_INTERVAL_MAP[timeframe];
  const pair = symbol.ticker.toUpperCase();

  for (const base of BINANCE_REST_BASES) {
    const url = `${base}/api/v3/klines?symbol=${encodeURIComponent(
      pair,
    )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
    const raw = await fetchJsonWithTimeout(url, 9000);
    const candles = parseBinanceKlines(raw);
    if (candles.length > 0) {
      klineCache.set(cacheKey, {
        candles,
        source: 'binance',
        expiresAt: Date.now() + ttlForTimeframe(timeframe),
      });
      return candles.map((c) => ({ ...c }));
    }
  }

  return [];
}

function isLocalhostRuntime(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** Fetches live Yahoo Finance v8 chart candles + quote via local Vite proxy (localhost) or verified allorigins CORS relay (GitHub Pages) */
export async function fetchYahooChart(
  symbol: SymbolInfo,
  timeframe: Timeframe,
  forceRefresh = false,
): Promise<{ candles: Candle[]; quote: QuoteTick | null } | null> {
  if (isTestEnvironment() || typeof fetch === 'undefined' || !symbol.yahooSymbol) {
    return null;
  }

  const cacheKey = `${symbol.ticker}|${timeframe}`;
  if (!forceRefresh) {
    const cached = klineCache.get(cacheKey);
    if (cached && cached.source === 'yahoo' && cached.expiresAt > Date.now()) {
      return {
        candles: cached.candles.map((c) => ({ ...c })),
        quote: cached.quote ?? null,
      };
    }
  }

  const spec = YAHOO_INTERVAL_SPEC[timeframe];
  const yahooPath = `/v8/finance/chart/${encodeURIComponent(
    symbol.yahooSymbol,
  )}?interval=${spec.interval}&range=${spec.range}&includePrePost=false`;
  const directYahooUrl = `https://query2.finance.yahoo.com${yahooPath}`;

  const tryParse = (raw: unknown) => {
    const parsed = parseYahooChartResponse(raw, symbol, spec.aggregateHours);
    if (parsed.candles.length > 0) {
      klineCache.set(cacheKey, {
        candles: parsed.candles,
        source: 'yahoo',
        quote: parsed.quote,
        expiresAt: Date.now() + ttlForTimeframe(timeframe),
      });
      return {
        candles: parsed.candles.map((c) => ({ ...c })),
        quote: parsed.quote,
      };
    }
    return null;
  };

  // 1. Local Vite dev proxy (fastest, zero rate-limit sharing when running `npm run dev`)
  if (isLocalhostRuntime()) {
    const localRaw = await fetchJsonWithTimeout(`/api/yahoo${yahooPath}`, 7000);
    const localParsed = tryParse(localRaw);
    if (localParsed) return localParsed;
  }

  // 2. Verified public CORS relay for static GitHub Pages (`api.allorigins.win/get`, ACAO: *)
  const allOriginsWrapped = await fetchJsonWithTimeout(
    `https://api.allorigins.win/get?url=${encodeURIComponent(directYahooUrl)}`,
    10_000,
  );
  if (
    allOriginsWrapped &&
    typeof allOriginsWrapped === 'object' &&
    typeof (allOriginsWrapped as { contents?: unknown }).contents === 'string'
  ) {
    try {
      const inner = JSON.parse(
        (allOriginsWrapped as { contents: string }).contents,
      );
      const parsed = tryParse(inner);
      if (parsed) return parsed;
    } catch {
      // Malformed upstream string; fall through
    }
  }

  // 3. Secondary raw relay fallback
  const allOriginsRaw = await fetchJsonWithTimeout(
    `https://api.allorigins.win/raw?url=${encodeURIComponent(directYahooUrl)}`,
    9000,
  );
  const rawParsed = tryParse(allOriginsRaw);
  if (rawParsed) return rawParsed;

  return null;
}

/**
 * Unified real historical candle resolver for any catalog symbol & timeframe:
 * - Crypto (`binanceSymbol`): Binance Vision direct REST (`/api/v3/klines`)
 * - Stocks/Indices/FX/Futures/ETFs (`yahooSymbol`): Yahoo Finance live chart -> pre-fetched Yahoo snapshot
 */
export async function fetchRealCandles(
  symbol: SymbolInfo,
  timeframe: Timeframe,
): Promise<{
  candles: Candle[];
  source: DataSourceKind;
  quote?: QuoteTick | null;
} | null> {
  if (isTestEnvironment()) return null;

  if (symbol.isCrypto && symbol.binanceSymbol) {
    const candles = await fetchBinanceKlines(symbol, timeframe, 300);
    if (candles.length > 0) {
      return { candles, source: 'binance' };
    }
    return null;
  }

  if (symbol.yahooSymbol) {
    const yahoo = await fetchYahooChart(symbol, timeframe);
    if (yahoo && yahoo.candles.length > 0) {
      return {
        candles: yahoo.candles,
        source: 'yahoo',
        quote: yahoo.quote,
      };
    }

    // Fallback to static real Yahoo snapshot if live relay is temporarily unavailable
    await loadRealSnapshot();
    const snapCandles = getSnapshotCandles(symbol.ticker, timeframe);
    if (snapCandles && snapCandles.length > 0) {
      return {
        candles: snapCandles,
        source: 'snapshot',
        quote: getSnapshotQuote(symbol.ticker),
      };
    }
  }

  return null;
}

export function clearRealMarketCaches(): void {
  klineCache.clear();
  loadedSnapshot = null;
  snapshotLoadPromise = null;
}
