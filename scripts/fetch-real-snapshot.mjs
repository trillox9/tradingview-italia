#!/usr/bin/env node
/**
 * Fetches REAL daily OHLCV candles (~180 bars) and live quote metadata from
 * Yahoo Finance (query2.finance.yahoo.com) for all non-crypto instruments
 * defined in src/data/symbols.ts, saving a compact static snapshot to
 * public/real-market-snapshot.json so GitHub Pages renders 100% real prices
 * and real historical candles immediately on first paint.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SYMBOLS_PATH = path.join(ROOT, 'src', 'data', 'symbols.ts');
const OUT_PATH = path.join(ROOT, 'public', 'real-market-snapshot.json');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_BARS = 180;
const CONCURRENCY = 5;
const DELAY_MS = 140;

/** Extract all non-crypto (ticker, yahooSymbol, precision) entries directly from src/data/symbols.ts */
function extractYahooTargets(source) {
  const targets = new Map();

  // 1. Explicit object blocks containing `ticker: '...'` and `yahooSymbol: '...'`
  const objRegex = /\{[^{}]*?ticker:\s*'([^']+)'[^{}]*?yahooSymbol:\s*'([^']+)'[^{}]*?\}/gs;
  for (const m of source.matchAll(objRegex)) {
    const block = m[0];
    const ticker = m[1];
    const yahooSymbol = m[2];
    const precMatch = /precision:\s*(\d+)/.exec(block);
    const precision = precMatch ? Number(precMatch[1]) : 2;
    targets.set(ticker, { ticker, yahooSymbol, precision });
  }

  // 2. ITALIAN_STOCKS tuple entries: ['RACE', 'Ferrari ...', ..., precision?, ...]
  const itSectionMatch = /const ITALIAN_STOCKS[\s\S]*?\)\s*\.map\(makeItalianStock\)/;
  if (itSectionMatch.test(source)) {
    const section = itSectionMatch.exec(source)[0];
    const rowRe = /\[\s*'([A-Z0-9-]+)'\s*,[^\]]+\]/g;
    for (const m of section.matchAll(rowRe)) {
      const ticker = m[1];
      targets.set(ticker, { ticker, yahooSymbol: `${ticker}.MI`, precision: 3 });
    }
  }

  // 3. US_STOCKS tuple entries: ['AAPL', 'NASDAQ' | 'NYSE', ...]
  const usSectionMatch = /const US_STOCKS[\s\S]*?\)\s*\.map\(makeUsStock\)/;
  if (usSectionMatch.test(source)) {
    const section = usSectionMatch.exec(source)[0];
    const rowRe = /\[\s*'([A-Z0-9-]+)'\s*,\s*'(?:NASDAQ|NYSE)'/g;
    for (const m of section.matchAll(rowRe)) {
      const ticker = m[1];
      targets.set(ticker, { ticker, yahooSymbol: ticker, precision: 2 });
    }
  }

  return Array.from(targets.values());
}

function roundTo(val, decimals) {
  if (!Number.isFinite(val)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const YAHOO_ALIASES = {
  'FTSEMIB.MI': ['FTSEMIB.MI', '^FTSEMIB'],
  'SWDA.MI': ['SWDA.MI', 'IWDA.AS', 'SWDA.L'],
};

async function fetchSingleYahoo(yahooSymbol, attempt = 0) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=1d&range=1y&includePrePost=false`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,*/*',
      },
    });
    clearTimeout(timer);

    if (res.status === 429 && attempt < 3) {
      await sleep(700 * (attempt + 1));
      return fetchSingleYahoo(yahooSymbol, attempt + 1);
    }
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp) || result.timestamp.length < 5) {
      return null;
    }
    return result;
  } catch {
    if (attempt < 2) {
      await sleep(500 * (attempt + 1));
      return fetchSingleYahoo(yahooSymbol, attempt + 1);
    }
    return null;
  }
}

async function fetchTarget({ ticker, yahooSymbol, precision }) {
  const candidates = YAHOO_ALIASES[yahooSymbol] ?? [yahooSymbol];
  let result = null;

  for (const sym of candidates) {
    result = await fetchSingleYahoo(sym);
    if (result) break;
  }
  if (!result) return null;

  const meta = result.meta ?? {};
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  const dec = Math.max(2, Math.min(5, precision));
  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
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
    const ro = roundTo(o, dec);
    const rc = roundTo(c, dec);
    const rh = Math.max(roundTo(h, dec), ro, rc);
    const rl = Math.min(roundTo(l, dec), ro, rc);
    const rv = Number.isFinite(volumes[i]) && volumes[i] >= 0 ? Math.round(volumes[i]) : 0;
    candles.push([t, ro, rh, rl, rc, rv]);
  }

  if (candles.length < 5) return null;
  const trimmed = candles.slice(-MAX_BARS);
  const last = trimmed[trimmed.length - 1];
  const prev = trimmed[trimmed.length - 2];

  const price = roundTo(
    Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0
      ? meta.regularMarketPrice
      : last[4],
    dec,
  );
  const prevClose = roundTo(
    Number.isFinite(meta.previousClose) && meta.previousClose > 0
      ? meta.previousClose
      : Number.isFinite(meta.chartPreviousClose) && meta.chartPreviousClose > 0
        ? prev[4]
        : prev[4],
    dec,
  );
  const open = roundTo(last[1], dec);
  const high = roundTo(
    Number.isFinite(meta.regularMarketDayHigh) && meta.regularMarketDayHigh > 0
      ? meta.regularMarketDayHigh
      : Math.max(last[2], price),
    dec,
  );
  const low = roundTo(
    Number.isFinite(meta.regularMarketDayLow) && meta.regularMarketDayLow > 0
      ? meta.regularMarketDayLow
      : Math.min(last[3], price),
    dec,
  );
  const volume =
    Number.isFinite(meta.regularMarketVolume) && meta.regularMarketVolume > 0
      ? Math.round(meta.regularMarketVolume)
      : last[5];

  let high52w = Number.isFinite(meta.fiftyTwoWeekHigh) ? meta.fiftyTwoWeekHigh : 0;
  let low52w = Number.isFinite(meta.fiftyTwoWeekLow) ? meta.fiftyTwoWeekLow : Infinity;
  if (!high52w || !Number.isFinite(low52w) || low52w === Infinity) {
    for (const bar of candles) {
      if (bar[2] > high52w) high52w = bar[2];
      if (bar[3] < low52w) low52w = bar[3];
    }
  }

  return {
    ticker,
    entry: {
      q: [
        price,
        prevClose,
        open,
        high,
        low,
        volume,
        roundTo(high52w, dec),
        roundTo(low52w, dec),
      ],
      c: trimmed,
    },
  };
}

async function main() {
  const source = fs.readFileSync(SYMBOLS_PATH, 'utf8');
  const targets = extractYahooTargets(source);
  console.log(`Fetching real Yahoo Finance snapshot for ${targets.length} non-crypto instruments...`);

  const symbolsOut = {};
  const failed = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const idx = cursor++;
      const target = targets[idx];
      const res = await fetchTarget(target);
      if (res) {
        symbolsOut[res.ticker] = res.entry;
      } else {
        failed.push(`${target.ticker}(${target.yahooSymbol})`);
      }
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const payload = {
    generatedAt: Date.now(),
    source: 'yahoo',
    count: Object.keys(symbolsOut).length,
    symbols: symbolsOut,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const jsonText = JSON.stringify(payload);
  fs.writeFileSync(OUT_PATH, jsonText, 'utf8');

  const sizeKB = (Buffer.byteLength(jsonText, 'utf8') / 1024).toFixed(1);
  console.log(
    `Saved ${OUT_PATH}: ${payload.count}/${targets.length} symbols (${sizeKB} KB).`,
  );
  if (failed.length > 0) {
    console.log(`Failed (${failed.length}): ${failed.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
