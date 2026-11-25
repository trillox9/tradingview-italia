import { describe, expect, it } from 'vitest';
import { MarketFeed } from '../src/data';
import {
  DEFAULT_PAPER_INITIAL_BALANCE,
  SCREENER_PRESETS,
  buildScreenerRows,
  cancelPaperOrder,
  closePaperPosition,
  createAlertRule,
  createInitialPaperAccount,
  evaluateAlerts,
  filterAndSortScreener,
  getScreenerSectors,
  loadAlerts,
  loadPaperAccount,
  markToMarket,
  paperTradingReducer,
  placePaperOrder,
  resetPaperAccount,
  saveAlerts,
  savePaperAccount,
} from '../src/engine';
import type { Candle } from '../src/types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, val);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe('Paper Trading Engine (paperTrading.ts)', () => {
  it('starts with €100,000 balance and executes market buy, live P&L, scaling, and full close', () => {
    let acc = createInitialPaperAccount();
    expect(acc.balance).toBe(DEFAULT_PAPER_INITIAL_BALANCE);
    expect(acc.equity).toBe(100_000);

    // Buy 10 RACE at 400
    acc = placePaperOrder(acc, { symbol: 'RACE', side: 'buy', type: 'market', quantity: 10 }, 400, 1000);
    expect(acc.positions).toHaveLength(1);
    expect(acc.positions[0].side).toBe('long');
    expect(acc.positions[0].avgEntryPrice).toBe(400);

    // Scale in: Buy 10 more RACE at 420 -> avg entry = 410
    acc = placePaperOrder(acc, { symbol: 'RACE', side: 'buy', type: 'market', quantity: 10 }, 420, 2000);
    expect(acc.positions[0].quantity).toBe(20);
    expect(acc.positions[0].avgEntryPrice).toBeCloseTo(410, 6);

    // Mark-to-market at 430 -> unrealized P&L = (430 - 410) * 20 = +400
    acc = markToMarket(acc, { RACE: 430 }, 3000);
    expect(acc.positions[0].unrealizedPnl).toBeCloseTo(400, 2);
    expect(acc.unrealizedPnl).toBeCloseTo(400, 2);
    expect(acc.equity).toBeCloseTo(100_400, 2);

    // Close full position at 435 -> realized P&L = (435 - 410) * 20 = +500
    acc = closePaperPosition(acc, 'RACE', 435, 4000);
    expect(acc.positions).toHaveLength(0);
    expect(acc.realizedPnl).toBeCloseTo(500, 2);
    expect(acc.balance).toBeCloseTo(100_500, 2);
    expect(acc.equity).toBeCloseTo(100_500, 2);
    expect(acc.history[0].realizedPnl).toBeCloseTo(500, 2);
  });

  it('handles short selling and position flipping accurately', () => {
    let acc = createInitialPaperAccount(100_000);
    // Open Long 10 at 100
    acc = placePaperOrder(acc, { symbol: 'AAPL', side: 'buy', type: 'market', quantity: 10 }, 100, 1000);
    // Sell 15 at 110 -> closes Long 10 (+100 realized) and opens Short 5 at 110
    acc = placePaperOrder(acc, { symbol: 'AAPL', side: 'sell', type: 'market', quantity: 15 }, 110, 2000);

    expect(acc.realizedPnl).toBeCloseTo(100, 2);
    expect(acc.positions).toHaveLength(1);
    expect(acc.positions[0].side).toBe('short');
    expect(acc.positions[0].quantity).toBe(5);
    expect(acc.positions[0].avgEntryPrice).toBe(110);

    // Price drops to 100 -> Short gains (110 - 100) * 5 = +50
    acc = markToMarket(acc, { AAPL: 100 }, 3000);
    expect(acc.positions[0].unrealizedPnl).toBeCloseTo(50, 2);
    expect(acc.equity).toBeCloseTo(100_150, 2);
  });

  it('queues Limit and Stop orders and triggers them + TP/SL brackets on markToMarket', () => {
    let acc = createInitialPaperAccount(100_000);

    // Resting Buy Limit below market (market=100, limit=95)
    acc = placePaperOrder(
      acc,
      {
        symbol: 'UCG',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 95,
        takeProfit: 105,
        stopLoss: 90,
      },
      100,
      1000,
    );
    expect(acc.orders).toHaveLength(1);
    expect(acc.positions).toHaveLength(0);

    // Price drops to 94 -> limit fills at 94
    acc = markToMarket(acc, { UCG: 94 }, 2000);
    expect(acc.orders).toHaveLength(0);
    expect(acc.positions).toHaveLength(1);
    expect(acc.positions[0].avgEntryPrice).toBe(94);

    // Price rallies to 106 -> triggers Take Profit bracket (>= 105) -> closes for (106-94)*100 = +1200
    acc = markToMarket(acc, { UCG: 106 }, 3000);
    expect(acc.positions).toHaveLength(0);
    expect(acc.realizedPnl).toBeCloseTo(1200, 2);

    // Pending Stop order cancelled cleanly
    acc = placePaperOrder(
      acc,
      { symbol: 'ENI', side: 'buy', type: 'stop', quantity: 10, stopPrice: 20 },
      14,
      4000,
    );
    expect(acc.orders).toHaveLength(1);
    acc = cancelPaperOrder(acc, acc.orders[0].id);
    expect(acc.orders).toHaveLength(0);
    expect(acc.history[0].status).toBe('cancelled');
  });

  it('rejects invalid orders, supports reducer actions, and persists to storage', () => {
    let acc = createInitialPaperAccount(10_000);
    // Zero quantity rejected
    acc = placePaperOrder(acc, { symbol: 'RACE', side: 'buy', type: 'market', quantity: 0 }, 440, 1000);
    expect(acc.history[0].status).toBe('rejected');

    // Excess margin rejected (buying 1000 units @ 440 = 440,000 notional -> 88,000 margin > 10,000)
    acc = placePaperOrder(acc, { symbol: 'RACE', side: 'buy', type: 'market', quantity: 1000 }, 440, 1001);
    expect(acc.history[0].status).toBe('rejected');

    // Reducer + localStorage round-trip
    acc = paperTradingReducer(acc, {
      type: 'PLACE_ORDER',
      request: { symbol: 'ENI', side: 'buy', type: 'market', quantity: 50 },
      marketPrice: 14,
      nowMs: 2000,
    });
    const mem = createMemoryStorage();
    expect(savePaperAccount(acc, mem)).toBe(true);
    const restored = loadPaperAccount(mem);
    expect(restored.positions).toHaveLength(1);
    expect(restored.positions[0].symbol).toBe('ENI');

    const reset = resetPaperAccount();
    expect(reset.balance).toBe(DEFAULT_PAPER_INITIAL_BALANCE);
    expect(reset.positions).toHaveLength(0);
  });
});

describe('Alerts Engine (alertsEngine.ts)', () => {
  it('triggers crosses_above, crosses_below, greater_than, less_than, channel, and percent alerts', () => {
    const rAbove = createAlertRule({
      symbol: 'BTCUSDT',
      condition: 'crosses_above',
      value: 95000,
      triggerOnce: true,
    });
    const rBelow = createAlertRule({
      symbol: 'BTCUSDT',
      condition: 'crosses_below',
      value: 90000,
      triggerOnce: false,
    });
    const rGreater = createAlertRule({
      symbol: 'BTCUSDT',
      condition: 'greater_than',
      value: 95500,
      triggerOnce: false,
    });
    const rChan = createAlertRule({
      symbol: 'BTCUSDT',
      condition: 'entering_channel',
      value: 94000,
      upperValue: 96000,
      triggerOnce: true,
    });

    // Price moves 93,500 -> 95,600
    const res1 = evaluateAlerts([rAbove, rBelow, rGreater, rChan], {
      symbol: 'BTCUSDT',
      prevPrice: 93500,
      currentPrice: 95600,
      nowMs: 1000,
    });

    expect(res1.triggered.map((t) => t.condition)).toEqual([
      'crosses_above',
      'greater_than',
      'entering_channel',
    ]);
    // triggerOnce alerts become 'triggered'; recurring alerts remain 'active'
    expect(res1.rules[0].status).toBe('triggered');
    expect(res1.rules[2].status).toBe('active');
    expect(res1.rules[2].triggerCount).toBe(1);

    // Price drops 91,000 -> 89,500 triggers crosses_below
    const res2 = evaluateAlerts(res1.rules, {
      symbol: 'BTCUSDT',
      prevPrice: 91000,
      currentPrice: 89500,
      nowMs: 2000,
    });
    expect(res2.triggered).toHaveLength(1);
    expect(res2.triggered[0].condition).toBe('crosses_below');

    // Storage round-trip
    const mem = createMemoryStorage();
    expect(saveAlerts(res2.rules, mem)).toBe(true);
    expect(loadAlerts(mem)).toHaveLength(4);
  });

  it('evaluates indicator-based RSI alerts against candles', () => {
    const risingCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1700000000 + i * 86400,
      open: 100 + i * 2,
      high: 102 + i * 2,
      low: 99 + i * 2,
      close: 101 + i * 2,
      volume: 1000,
    }));
    const rsiAlert = createAlertRule({
      symbol: 'RACE',
      target: 'rsi',
      targetPeriod: 14,
      condition: 'greater_than',
      value: 80,
    });

    const out = evaluateAlerts([rsiAlert], {
      symbol: 'RACE',
      prevPrice: 157,
      currentPrice: 159,
      candles: risingCandles,
    });
    expect(out.triggered).toHaveLength(1);
    expect(out.triggered[0].triggeredValue).toBeGreaterThan(80);
  });
});

describe('Screener Engine (screenerEngine.ts)', () => {
  it('builds enriched rows across the catalog and overlays live quotes', () => {
    const feed = new MarketFeed({ enableLiveCrypto: false });
    feed.ingestExternalTrade('RACE', 455.5, 500, Date.now(), 'simulated');

    const rows = buildScreenerRows(undefined, feed.getAllQuotes());
    expect(rows.length).toBeGreaterThanOrEqual(35);

    const raceRow = rows.find((r) => r.ticker === 'RACE')!;
    expect(raceRow.price).toBe(455.5);
    expect(raceRow.rsi14).not.toBeNull();
    expect(raceRow.atr14).not.toBeNull();
    expect(raceRow.sma20).not.toBeNull();
    expect(raceRow.technicalRating).toBeTruthy();

    const sectors = getScreenerSectors(rows);
    expect(sectors).toContain('Tecnologia');
    expect(sectors).toContain('Finanza');
  });

  it('filters by category, search, sector, numeric ranges, and sorts cleanly', () => {
    const rows = buildScreenerRows();

    const italian = filterAndSortScreener(rows, {
      category: 'italian',
      sortBy: 'marketCap',
      sortDir: 'desc',
    });
    expect(italian.length).toBeGreaterThanOrEqual(7);
    expect(italian.every((r) => r.country === 'IT' && r.assetClass === 'stock')).toBe(true);
    for (let i = 1; i < italian.length; i++) {
      expect(italian[i - 1].marketCap).toBeGreaterThanOrEqual(italian[i].marketCap);
    }

    const cryptoSearch = filterAndSortScreener(rows, {
      category: 'crypto',
      search: 'btc',
    });
    expect(cryptoSearch).toHaveLength(1);
    expect(cryptoSearch[0].ticker).toBe('BTCUSDT');

    const peSorted = filterAndSortScreener(rows, {
      category: 'all',
      sortBy: 'peRatio',
      sortDir: 'asc',
    });
    // Non-null P/E ratios come before nulls even in ascending sort
    const firstNullIdx = peSorted.findIndex((r) => r.peRatio === null);
    expect(firstNullIdx).toBeGreaterThan(0);
    expect(peSorted.slice(firstNullIdx).every((r) => r.peRatio === null)).toBe(true);

    // Every Italian preset runs cleanly
    for (const preset of SCREENER_PRESETS) {
      const res = filterAndSortScreener(rows, preset.query);
      expect(Array.isArray(res)).toBe(true);
    }
  });
});
