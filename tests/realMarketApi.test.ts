import { describe, expect, it } from 'vitest';
import snapshotJson from '../public/real-market-snapshot.json';
import {
  MarketFeed,
  SYMBOLS,
  aggregateCandlesByHours,
  aggregateDailyCandles,
  clearRealMarketCaches,
  formatPrice,
  getLoadedSnapshot,
  getSnapshotCandles,
  getSnapshotQuote,
  getSymbolByTicker,
  getSymbolsByAssetClass,
  mergeLatestBarIntoSeries,
  parseBinance24hrTickers,
  parseBinanceKlines,
  parseRealSnapshot,
  parseYahooChartResponse,
  resolveRealCandlesSmart,
  setLoadedSnapshotForTest,
  snapshotEntryToCandles,
  snapshotEntryToQuote,
} from '../src/data';

describe('Expanded Real Market Catalog (160+ instruments)', () => {
  it('contains 200+ instruments with 70+ Binance crypto, 80+ US stocks, and 20 Italian .MI stocks', () => {
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(200);

    const cryptos = getSymbolsByAssetClass('crypto');
    expect(cryptos.length).toBeGreaterThanOrEqual(70);
    expect(cryptos.every((c) => Boolean(c.binanceSymbol) && c.isCrypto)).toBe(true);

    const usStocks = SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'US');
    expect(usStocks.length).toBeGreaterThanOrEqual(80);
    expect(usStocks.every((s) => Boolean(s.yahooSymbol))).toBe(true);

    const itStocks = SYMBOLS.filter((s) => s.assetClass === 'stock' && s.country === 'IT');
    expect(itStocks.length).toBe(20);
    expect(itStocks.every((s) => s.yahooSymbol === `${s.ticker}.MI`)).toBe(true);

    // Check sub-cent meme coin precision
    expect(getSymbolByTicker('PEPEUSDT')?.precision).toBe(8);
    expect(getSymbolByTicker('SHIBUSDT')?.precision).toBe(8);
    expect(getSymbolByTicker('BONKUSDT')?.precision).toBe(8);
    expect(getSymbolByTicker('FLOKIUSDT')?.precision).toBe(8);
  });

  it('formats sub-cent crypto prices accurately without rounding to 0,00', () => {
    const pepe = formatPrice(0.00000348, 8);
    expect(pepe).toContain('00000348');

    const autoSubCent = formatPrice(0.00001234);
    expect(autoSubCent).toContain('00001234');

    const autoLowCent = formatPrice(0.004888);
    expect(autoLowCent).toContain('004888');
  });
});

describe('Binance REST Parsers (realMarketApi.ts)', () => {
  it('parses Binance klines arrays into valid OHLCV candles with Unix seconds', () => {
    const raw = [
      [1764000000000, '60100.50', '60500.00', '59900.25', '60420.10', '1234.56', 1764003599999],
      [1764003600000, '60420.10', '60610.00', '60200.00', '60550.00', '987.65', 1764007199999],
      ['bad', 'NaN', '0', '0', '0', '0'],
    ];
    const candles = parseBinanceKlines(raw);
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      time: 1764000000,
      open: 60100.5,
      high: 60500,
      low: 59900.25,
      close: 60420.1,
      volume: 1234.56,
    });
    expect(candles[1].close).toBe(60550);
  });

  it('parses Binance 24hr tickers including 8-decimal meme coins and sets source=binance', () => {
    const raw = [
      {
        symbol: 'BTCUSDT',
        lastPrice: '60224.75',
        openPrice: '59830.01',
        highPrice: '60800.00',
        lowPrice: '59400.00',
        volume: '25840.5',
        priceChangePercent: '0.66',
        bidPrice: '60224.70',
        askPrice: '60224.80',
      },
      {
        symbol: 'PEPEUSDT',
        lastPrice: '0.00000348',
        openPrice: '0.00000340',
        highPrice: '0.00000360',
        lowPrice: '0.00000335',
        volume: '999999999',
        priceChangePercent: '2.35',
      },
      { symbol: 'UNKNOWNCOINUSDT', lastPrice: '1.0', openPrice: '1.0' },
    ];
    const quotes = parseBinance24hrTickers(raw, undefined, 1764100000000);
    expect(quotes).toHaveLength(2);

    const btc = quotes.find((q) => q.ticker === 'BTCUSDT')!;
    expect(btc.source).toBe('binance');
    expect(btc.price).toBe(60224.75);
    expect(btc.prevClose).toBe(59830.01);
    expect(btc.changePercent).toBe(0.66);

    const pepe = quotes.find((q) => q.ticker === 'PEPEUSDT')!;
    expect(pepe.price).toBe(0.00000348);
    expect(pepe.source).toBe('binance');
  });
});

describe('Yahoo Finance v8 Parser & Aggregators (realMarketApi.ts)', () => {
  it('parses Yahoo Finance v8 chart response cleanly and skips null gaps', () => {
    const aapl = getSymbolByTicker('AAPL')!;
    const mockYahoo = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'AAPL',
              regularMarketPrice: 241.55,
              previousClose: 238.1,
              regularMarketDayHigh: 242.4,
              regularMarketDayLow: 237.8,
              regularMarketVolume: 42150000,
            },
            timestamp: [1763900000, 1763986400, 1764072800],
            indicators: {
              quote: [
                {
                  open: [236.0, null, 238.5],
                  high: [239.0, null, 242.4],
                  low: [235.2, null, 237.8],
                  close: [238.1, null, 241.55],
                  volume: [38000000, null, 42150000],
                },
              ],
            },
          },
        ],
      },
    };

    const { candles, quote } = parseYahooChartResponse(mockYahoo, aapl, undefined, 1764100000000);
    expect(candles).toHaveLength(2);
    expect(candles[1].close).toBe(241.55);
    expect(quote).not.toBeNull();
    expect(quote!.source).toBe('yahoo');
    expect(quote!.price).toBe(241.55);
    expect(quote!.prevClose).toBe(238.1);
    expect(quote!.change).toBeCloseTo(3.45, 2);
  });

  it('aggregates 1H bars into 4H bars and daily bars into 1W/1M bars accurately', () => {
    const hourly = [
      { time: 1764000000, open: 100, high: 103, low: 99, close: 102, volume: 100 },
      { time: 1764003600, open: 102, high: 106, low: 101, close: 105, volume: 200 },
      { time: 1764014400, open: 105, high: 107, low: 104, close: 106, volume: 150 },
    ];
    const h4 = aggregateCandlesByHours(hourly, 4);
    expect(h4).toHaveLength(2);
    expect(h4[0].high).toBe(106);
    expect(h4[0].low).toBe(99);
    expect(h4[0].volume).toBe(300);

    // 10 consecutive days across 2 calendar weeks
    const startSec = Math.floor(Date.UTC(2026, 9, 5, 0, 0, 0) / 1000); // Monday Oct 5, 2026
    const daily = Array.from({ length: 10 }, (_, i) => ({
      time: startSec + i * 86400,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
      volume: 1000,
    }));
    const weekly = aggregateDailyCandles(daily, '1W');
    expect(weekly).toHaveLength(2);
    expect(weekly[0].open).toBe(100);
    expect(weekly[0].volume).toBe(7000);
    expect(weekly[1].volume).toBe(3000);

    const monthly = aggregateDailyCandles(daily, '1M');
    expect(monthly).toHaveLength(1);
    expect(monthly[0].volume).toBe(10000);
  });
});

describe('Real Yahoo Market Snapshot (public/real-market-snapshot.json)', () => {
  it('exists on disk, parses cleanly, hydrates quotes/candles, and blocks simulated random walk', () => {
    const parsed = parseRealSnapshot(snapshotJson);
    expect(parsed).not.toBeNull();
    expect(parsed!.count).toBeGreaterThanOrEqual(135);
    expect(parsed!.symbols.AAPL).toBeDefined();
    expect(parsed!.symbols.RACE).toBeDefined();
    expect(parsed!.symbols.FTSEMIB).toBeDefined();
    expect(parsed!.symbols.EURUSD).toBeDefined();
    expect(parsed!.symbols['GC1!']).toBeDefined();

    // Verify snapshot conversion helpers
    const aaplSym = getSymbolByTicker('AAPL')!;
    const aaplQuote = snapshotEntryToQuote(aaplSym, parsed!.symbols.AAPL);
    expect(aaplQuote.source).toBe('snapshot');
    expect(aaplQuote.price).toBeGreaterThan(50);

    const aaplDaily = snapshotEntryToCandles(parsed!.symbols.AAPL, '1D');
    expect(aaplDaily.length).toBeGreaterThanOrEqual(100);
    expect(aaplDaily.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))).toBe(true);

    const aaplWeekly = snapshotEntryToCandles(parsed!.symbols.AAPL, '1W');
    expect(aaplWeekly.length).toBeGreaterThanOrEqual(20);

    // Seed snapshot cache & verify getters
    setLoadedSnapshotForTest(parsed);
    expect(getLoadedSnapshot()?.count).toBe(parsed!.count);
    expect(getSnapshotQuote('RACE')?.source).toBe('snapshot');
    expect(getSnapshotCandles('RACE', '1D')?.length).toBeGreaterThanOrEqual(100);
    expect(getSnapshotCandles('RACE', '1m')).toBeNull();
    clearRealMarketCaches();

    // Verify MarketFeed NEVER overwrites real quotes with fake random walk during tickOnce()
    const feed = new MarketFeed({ enableLiveCrypto: false, seed: 5 });
    feed.ingestRealQuote(aaplQuote);
    const beforePrice = feed.getQuote('AAPL')!.price;
    const changed = feed.tickOnce(Date.now() + 1000);
    expect(changed).not.toContain('AAPL');
    expect(feed.getQuote('AAPL')!.price).toBe(beforePrice);
    expect(feed.getQuote('AAPL')!.source).toBe('snapshot');
  });
});

describe('Flash-Free Smart Real Candles Resolver & Abort Cancellation (realMarketApi.ts)', () => {
  it('merges only the latest bar without replacing historical series', () => {
    const day1 = Math.floor(Date.UTC(2026, 9, 10, 0, 0, 0) / 1000);
    const day2 = Math.floor(Date.UTC(2026, 9, 11, 0, 0, 0) / 1000);
    const day3 = Math.floor(Date.UTC(2026, 9, 12, 0, 0, 0) / 1000);

    const existing = [
      { time: day1, open: 100, high: 105, low: 98, close: 104, volume: 1000 },
      { time: day2, open: 104, high: 108, low: 103, close: 106, volume: 1200 },
    ];
    // Incoming has slightly altered history on day1 (must be ignored!) + live tail update on day2 + new bar on day3
    const incoming = [
      { time: day1, open: 999, high: 999, low: 999, close: 999, volume: 999 },
      { time: day2 + 3600, open: 104, high: 110, low: 102, close: 109, volume: 1500 },
      { time: day3, open: 109, high: 112, low: 108, close: 111, volume: 900 },
    ];

    const merged = mergeLatestBarIntoSeries(existing, incoming, '1D');
    expect(merged).toHaveLength(3);
    // Historical bar 0 untouched
    expect(merged[0]).toEqual(existing[0]);
    // Day 2 tail patched in place preserving timestamp & expanding range
    expect(merged[1].time).toBe(day2);
    expect(merged[1].high).toBe(110);
    expect(merged[1].low).toBe(102);
    expect(merged[1].close).toBe(109);
    expect(merged[1].volume).toBe(1500);
    // Day 3 appended cleanly
    expect(merged[2]).toEqual(incoming[2]);
  });

  it('resolves live Yahoo directly when fast, or falls back to snapshot with silent tail update when slow', async () => {
    const aapl = getSymbolByTicker('AAPL')!;
    const liveBars = [
      { time: 1764000000, open: 240, high: 245, low: 239, close: 244, volume: 5000 },
    ];
    const snapBars = [
      { time: 1764000000, open: 240, high: 242, low: 239, close: 241, volume: 4000 },
    ];

    // Fast live Yahoo -> returns 'yahoo' immediately without snapshot double-jump
    const fast = await resolveRealCandlesSmart(aapl, '1D', {
      bypassTestGuard: true,
      liveTimeoutMs: 120,
      fetchYahoo: async () => ({ candles: liveBars, quote: null }),
      loadSnapshot: async () => null,
      getSnapCandles: () => snapBars,
    });
    expect(fast?.source).toBe('yahoo');
    expect(fast?.candles[0].close).toBe(244);

    // Slow live Yahoo exceeding snappy budget -> returns real snapshot immediately & fires onLateYahooUpdate later
    let resolveLate!: (v: { candles: typeof liveBars; quote: null }) => void;
    const latePromise = new Promise<{ candles: typeof liveBars; quote: null }>((r) => {
      resolveLate = r;
    });
    let lateReceived: typeof liveBars | null = null;

    const snapped = await resolveRealCandlesSmart(aapl, '1D', {
      bypassTestGuard: true,
      liveTimeoutMs: 15,
      fetchYahoo: () => latePromise,
      loadSnapshot: async () => null,
      getSnapCandles: () => snapBars,
      getSnapQuote: () => null,
      onLateYahooUpdate: (res) => {
        lateReceived = res.candles;
      },
    });
    expect(snapped?.source).toBe('snapshot');
    expect(snapped?.candles[0].close).toBe(241);
    expect(lateReceived).toBeNull();

    // When slow live Yahoo later finishes, silent tail update callback fires
    resolveLate({ candles: liveBars, quote: null });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(lateReceived).toEqual(liveBars);
  });

  it('cancels out-of-order slow fetches via AbortController during rapid symbol switching', async () => {
    const btc = getSymbolByTicker('BTCUSDT')!;
    const aapl = getSymbolByTicker('AAPL')!;
    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    let resolveSlowBtc!: (v: { time: number; open: number; high: number; low: number; close: number; volume: number }[]) => void;
    const slowBtc = new Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]>((r) => {
      resolveSlowBtc = r;
    });

    const p1 = resolveRealCandlesSmart(btc, '15m', {
      bypassTestGuard: true,
      signal: ctrl1.signal,
      fetchBinance: () => slowBtc,
    });

    // User switches rapidly to AAPL before BTC resolves -> abort BTC request
    ctrl1.abort();

    const aaplBars = [
      { time: 1764000000, open: 230, high: 235, low: 229, close: 234, volume: 1000 },
    ];
    const p2 = resolveRealCandlesSmart(aapl, '1D', {
      bypassTestGuard: true,
      signal: ctrl2.signal,
      liveTimeoutMs: 100,
      fetchYahoo: async () => ({ candles: aaplBars, quote: null }),
      loadSnapshot: async () => null,
    });

    // Now the stale BTC promise resolves out of order — must be discarded as null!
    resolveSlowBtc([
      { time: 1764000000, open: 60000, high: 61000, low: 59000, close: 60500, volume: 50 },
    ]);

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBeNull();
    expect(res2?.source).toBe('yahoo');
    expect(res2?.candles[0].close).toBe(234);
  });
});
