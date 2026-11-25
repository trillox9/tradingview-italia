import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WATCHLISTS,
  ECONOMIC_CALENDAR,
  FINANCIAL_NEWS,
  HEATMAP_SECTORS,
  MARKET_IDEAS,
  MarketFeed,
  SYMBOLS,
  buildHeatmapSectors,
  clearCandleCache,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
  generateCandles,
  generateSparkline,
  getCandlesForSymbol,
  getSymbolById,
  getSymbolByTicker,
  getSymbolsByAssetClass,
  searchSymbols,
} from '../src/data';
import { TIMEFRAMES, TIMEFRAME_SECONDS } from '../src/types';

describe('Market Catalog (symbols.ts)', () => {
  const requiredTickers = [
    // Indici
    'FTSEMIB', 'SPX', 'NDX', 'DAX', 'DJI', 'NKY', 'VIX',
    // Azioni Italiane
    'RACE', 'ENI', 'ISP', 'UCG', 'ENEL', 'STLAM', 'LDO',
    // Azioni USA
    'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL',
    // Cripto
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT',
    // Forex
    'EURUSD', 'GBPUSD', 'USDJPY', 'EURGBP', 'USDCHF',
    // Futures
    'GC1!', 'CL1!', 'SI1!', 'NG1!',
    // Obbligazioni & ETF
    'IT10Y', 'US10Y', 'VWCE', 'SWDA', 'SPY',
  ];

  it('contains all required Italian and global instruments with unique IDs and tickers', () => {
    const tickers = new Set(SYMBOLS.map((s) => s.ticker));
    const ids = new Set(SYMBOLS.map((s) => s.id));
    expect(tickers.size).toBe(SYMBOLS.length);
    expect(ids.size).toBe(SYMBOLS.length);

    for (const ticker of requiredTickers) {
      const found = getSymbolByTicker(ticker);
      expect(found, `Missing required symbol ${ticker}`).toBeDefined();
      expect(found!.basePrice).toBeGreaterThan(0);
      expect(found!.prevClose).toBeGreaterThan(0);
      expect(found!.volatility).toBeGreaterThan(0);
    }
  });

  it('supports lookup by qualified ID, case-insensitive ticker, asset class, and search', () => {
    expect(getSymbolByTicker('race')?.id).toBe('MIL:RACE');
    expect(getSymbolByTicker('MIL:RACE')?.ticker).toBe('RACE');
    expect(getSymbolById('BINANCE:BTCUSDT')?.ticker).toBe('BTCUSDT');
    expect(getSymbolsByAssetClass('crypto').length).toBeGreaterThanOrEqual(5);
    expect(getSymbolsByAssetClass('forex').length).toBeGreaterThanOrEqual(5);

    const ferrariHits = searchSymbols('Ferrari');
    expect(ferrariHits.some((s) => s.ticker === 'RACE')).toBe(true);

    const cryptoHits = searchSymbols('bit', 'crypto');
    expect(cryptoHits.some((s) => s.ticker === 'BTCUSDT')).toBe(true);
  });

  it('provides valid default watchlists referencing real catalog tickers', () => {
    expect(DEFAULT_WATCHLISTS.length).toBeGreaterThanOrEqual(5);
    for (const group of DEFAULT_WATCHLISTS) {
      expect(group.symbols.length).toBeGreaterThan(0);
      for (const t of group.symbols) {
        expect(getSymbolByTicker(t)).toBeDefined();
      }
    }
  });

  it('formats prices, percentages, volumes, and market caps cleanly', () => {
    expect(formatPrice(442.8, 2)).toContain('442');
    expect(formatPercent(1.52)).toContain('+');
    expect(formatPercent(-0.85)).toContain('-');
    expect(formatVolume(1_500_000)).toBe('1.50M');
    expect(formatVolume(2_400_000_000)).toBe('2.40B');
    expect(formatMarketCap(3510)).toBe('3.51T');
    expect(formatMarketCap(79.8)).toBe('79.8B');
    expect(formatMarketCap(null)).toBe('—');
  });
});

describe('OHLCV Generator (ohlcvGenerator.ts)', () => {
  it('is strictly deterministic for the same symbol and timeframe', () => {
    const race = getSymbolByTicker('RACE')!;
    const run1 = generateCandles(race, '1D', { count: 150 });
    const run2 = generateCandles(race, '1D', { count: 150 });
    expect(run1).toEqual(run2);
  });

  it('enforces OHLC invariants and proper timestamp spacing across all 8 timeframes', () => {
    const btc = getSymbolByTicker('BTCUSDT')!;
    for (const tf of TIMEFRAMES) {
      const candles = generateCandles(btc, tf, { count: 120 });
      expect(candles).toHaveLength(120);

      const expectedStep = TIMEFRAME_SECONDS[tf];
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        expect(c.low).toBeGreaterThan(0);
        expect(c.open).toBeGreaterThan(0);
        expect(c.close).toBeGreaterThan(0);
        expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
        expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
        expect(c.volume).toBeGreaterThan(0);
        if (i > 0) {
          expect(c.time - candles[i - 1].time).toBe(expectedStep);
        }
      }

      // Final close anchored to symbol.basePrice
      expect(candles[candles.length - 1].close).toBeCloseTo(btc.basePrice, 2);
    }
  });

  it('caches symbol series safely without leaking mutable references', () => {
    clearCandleCache();
    const first = getCandlesForSymbol('FTSEMIB', '1D', 80);
    expect(first).toHaveLength(80);
    const originalClose = first[0].close;
    first[0].close = 999999;

    const second = getCandlesForSymbol('FTSEMIB', '1D', 80);
    expect(second[0].close).toBe(originalClose);
  });

  it('generates compact deterministic sparklines', () => {
    const spark = generateSparkline('UCG', 24);
    expect(spark).toHaveLength(24);
    expect(spark.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  });
});

describe('MarketFeed Live Simulator (marketFeed.ts)', () => {
  it('initializes quotes for all catalog symbols and ticks watched tickers smoothly', () => {
    const feed = new MarketFeed({ enableLiveCrypto: false, seed: 42 });
    const initial = feed.getQuote('RACE');
    expect(initial).toBeDefined();
    expect(initial!.price).toBeCloseTo(442.8, 2);

    const updates: number[] = [];
    const unsub = feed.subscribeSymbol('RACE', (q) => updates.push(q.price));

    const changed = feed.tickOnce(Date.now() + 1000);
    expect(changed).toContain('RACE');
    expect(updates.length).toBe(1);

    const after = feed.getQuote('RACE')!;
    expect(after.high).toBeGreaterThanOrEqual(after.price);
    expect(after.low).toBeLessThanOrEqual(after.price);
    expect(after.ask).toBeGreaterThanOrEqual(after.bid);

    unsub();
    feed.stop();
  });

  it('updates subscribed candles in-place and rolls over to new bar on timeframe boundary', () => {
    const feed = new MarketFeed({ enableLiveCrypto: false, seed: 99 });
    const baseTime = 1700000040; // aligned to 60s
    const seedCandle = {
      time: baseTime,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 500,
    };

    const received: Array<{ time: number; close: number; high: number }> = [];
    const unsub = feed.subscribeCandle('RACE', '1m', seedCandle, (c) => {
      received.push({ time: c.time, close: c.close, high: c.high });
    });

    // Same bar (+10s)
    feed.ingestExternalTrade('RACE', 102.5, 50, (baseTime + 10) * 1000, 'simulated');
    expect(received[0].time).toBe(baseTime);
    expect(received[0].close).toBe(102.5);
    expect(received[0].high).toBe(102.5);

    // Next minute bar (+65s)
    feed.ingestExternalTrade('RACE', 103.0, 25, (baseTime + 65) * 1000, 'simulated');
    expect(received[1].time).toBe(baseTime + 60);
    expect(received[1].close).toBe(103.0);

    unsub();
  });

  it('defaults enableLiveCrypto to false so crypto quotes remain coherent with historical candles', () => {
    const defaultFeed = new MarketFeed({ seed: 11 });
    expect(defaultFeed.isLiveCryptoEnabled()).toBe(false);
    const btc = defaultFeed.getQuote('BTCUSDT')!;
    expect(Math.abs(btc.changePercent)).toBeLessThan(10);
  });

  it('ingests external Binance crypto trades and marks source as binance', () => {
    const feed = new MarketFeed({ enableLiveCrypto: false });
    const ok = feed.ingestExternalTrade('BTCUSDT', 95123.45, 12, Date.now(), 'binance');
    expect(ok).toBe(true);
    const q = feed.getQuote('BTCUSDT')!;
    expect(q.price).toBe(95123.45);
    expect(q.source).toBe('binance');
  });
});

describe('Italian Editorial Datasets (editorialData.ts)', () => {
  it('provides rich Italian ideas, financial news, economic calendar, and sector heatmaps', () => {
    expect(MARKET_IDEAS.length).toBeGreaterThanOrEqual(10);
    expect(FINANCIAL_NEWS.length).toBeGreaterThanOrEqual(12);
    expect(ECONOMIC_CALENDAR.length).toBeGreaterThanOrEqual(15);

    for (const idea of MARKET_IDEAS) {
      expect(getSymbolByTicker(idea.symbol)).toBeDefined();
      expect(['LONG', 'SHORT', 'NEUTRALE']).toContain(idea.direction);
      expect(idea.summary.length).toBeGreaterThan(20);
    }

    const sectorNames = HEATMAP_SECTORS.map((s) => s.name);
    expect(sectorNames).toEqual([
      'Tecnologia',
      'Finanza',
      'Energia',
      'Automotive',
      'Lusso',
      'Sanità',
    ]);
    for (const sector of HEATMAP_SECTORS) {
      expect(sector.stocks.length).toBeGreaterThan(0);
      expect(sector.totalMarketCap).toBeGreaterThan(0);
    }

    // Live quote overlay on heatmap
    const feed = new MarketFeed({ enableLiveCrypto: false });
    feed.ingestExternalTrade('RACE', 460.0, 100, Date.now(), 'simulated');
    const liveSectors = buildHeatmapSectors(feed.getAllQuotes());
    const lusso = liveSectors.find((s) => s.name === 'Lusso')!;
    const raceTile = lusso.stocks.find((s) => s.ticker === 'RACE')!;
    expect(raceTile.price).toBe(460.0);
  });
});
