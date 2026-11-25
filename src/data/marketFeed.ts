import {
  TIMEFRAME_SECONDS,
  type Candle,
  type DataSourceKind,
  type QuoteTick,
  type SymbolInfo,
  type Timeframe,
} from '../types';
import { SYMBOLS, getSymbolByTicker } from './symbols';
import { createSeededRng, hashString } from './ohlcvGenerator';
import {
  BINANCE_INTERVAL_MAP,
  BINANCE_WS_BASES,
  fetchBinance24hrTickers,
  isTestEnvironment,
  loadRealSnapshot,
  snapshotEntryToQuote,
} from './realMarketApi';

export type QuoteListener = (
  quotes: Map<string, QuoteTick>,
  changedTickers: string[],
) => void;
export type SymbolQuoteListener = (quote: QuoteTick) => void;
export type CandleUpdateListener = (candle: Candle) => void;

export interface MarketFeedOptions {
  /** Simulation tick interval in milliseconds for non-real fallback symbols (default: 1000ms) */
  intervalMs?: number;
  /** Live Binance WebSocket + REST streaming for crypto pairs (default: true in browser, false in tests) */
  enableLiveCrypto?: boolean;
  /** Initial seed for deterministic simulation ticks */
  seed?: number;
}

interface InternalQuoteState {
  symbol: SymbolInfo;
  quote: QuoteTick;
  momentum: number;
  lastBinanceUpdateMs: number;
}

interface CandleSubscription {
  ticker: string;
  timeframe: Timeframe;
  currentCandle: Candle;
  listeners: Set<CandleUpdateListener>;
  klineWs: WebSocket | null;
}

function roundPrice(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function buildInitialQuote(symbol: SymbolInfo, nowMs: number): QuoteTick {
  const price = roundPrice(symbol.basePrice, symbol.precision);
  const prevClose = roundPrice(symbol.prevClose, symbol.precision);
  const change = roundPrice(price - prevClose, symbol.precision);
  const changePercent =
    prevClose !== 0
      ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
      : 0;
  const spread = Math.max(
    symbol.tickSize,
    roundPrice(price * 0.00015, symbol.precision),
  );
  const intradayRange = price * symbol.volatility * 0.45;

  return {
    ticker: symbol.ticker,
    id: symbol.id,
    price,
    open: roundPrice((price + prevClose) / 2, symbol.precision),
    high: roundPrice(
      Math.max(price, prevClose) + intradayRange * 0.5,
      symbol.precision,
    ),
    low: roundPrice(
      Math.max(symbol.tickSize, Math.min(price, prevClose) - intradayRange * 0.45),
      symbol.precision,
    ),
    prevClose,
    change,
    changePercent,
    volume: Math.round(symbol.avgVolume * 0.62),
    bid: roundPrice(
      Math.max(symbol.tickSize, price - spread / 2),
      symbol.precision,
    ),
    ask: roundPrice(price + spread / 2, symbol.precision),
    timestamp: nowMs,
    source: 'simulated',
  };
}

/**
 * Hybrid real-time MarketFeed:
 * - Crypto (78 Binance USDT pairs): Real Binance Vision REST 24hr batch + live
 *   `!miniTicker@arr` WebSocket + dedicated active-symbol `@kline_<tf>` WebSocket.
 * - Stocks, Indices, Forex, Futures, ETFs: Real Yahoo Finance static snapshot
 *   hydrated on boot + live Yahoo Finance updates via `ingestRealQuote`.
 * - NEVER overwrites real `'binance'`, `'yahoo'`, or `'snapshot'` quotes with
 *   fake random-walk simulation!
 */
export class MarketFeed {
  private readonly states = new Map<string, InternalQuoteState>();
  private readonly globalListeners = new Set<QuoteListener>();
  private readonly symbolListeners = new Map<string, Set<SymbolQuoteListener>>();
  private readonly candleSubs = new Map<string, CandleSubscription>();
  private readonly rng: () => number;

  private intervalMs: number;
  private enableLiveCrypto: boolean;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private binanceWs: WebSocket | null = null;
  private binanceWsBaseIdx = 0;
  private binanceDisabledByFailure = false;
  private running = false;
  private bootstrapped = false;

  constructor(options: MarketFeedOptions = {}) {
    this.intervalMs = Math.max(250, options.intervalMs ?? 1000);
    const canStreamInBrowser =
      !isTestEnvironment() &&
      typeof window !== 'undefined' &&
      typeof WebSocket !== 'undefined';
    this.enableLiveCrypto = options.enableLiveCrypto ?? canStreamInBrowser;
    this.rng = createSeededRng(
      options.seed ?? hashString('tradingview-italia-feed'),
    );

    const nowMs = Date.now();
    for (const symbol of SYMBOLS) {
      this.states.set(symbol.ticker, {
        symbol,
        quote: buildInitialQuote(symbol, nowMs),
        momentum: 0,
        lastBinanceUpdateMs: 0,
      });
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isLiveCryptoEnabled(): boolean {
    return this.enableLiveCrypto && !this.binanceDisabledByFailure;
  }

  public setLiveCryptoEnabled(enabled: boolean): void {
    this.enableLiveCrypto = enabled;
    if (!enabled) {
      this.closeBinanceWs();
      for (const sub of this.candleSubs.values()) {
        this.closeKlineWs(sub);
      }
    } else if (this.running) {
      this.binanceDisabledByFailure = false;
      this.connectBinanceWs();
      for (const sub of this.candleSubs.values()) {
        this.connectKlineWs(sub);
      }
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    this.timerId = setInterval(() => {
      this.tickOnce();
    }, this.intervalMs);

    if (!isTestEnvironment()) {
      void this.bootstrapRealMarketData();
      if (this.enableLiveCrypto && !this.binanceDisabledByFailure) {
        this.connectBinanceWs();
      }
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.closeBinanceWs();
    for (const sub of this.candleSubs.values()) {
      this.closeKlineWs(sub);
    }
  }

  /** Bootstraps real Yahoo snapshot quotes + real Binance 24hr batch quotes */
  private async bootstrapRealMarketData(): Promise<void> {
    if (this.bootstrapped || isTestEnvironment()) return;
    this.bootstrapped = true;

    const cryptoTickers = SYMBOLS.filter((s) => s.isCrypto).map((s) => s.ticker);

    const [snapshot, binanceQuotes] = await Promise.all([
      loadRealSnapshot().catch(() => null),
      this.enableLiveCrypto
        ? fetchBinance24hrTickers(cryptoTickers).catch(() => [])
        : Promise.resolve([]),
    ]);

    const batch: QuoteTick[] = [];

    if (snapshot) {
      for (const [ticker, entry] of Object.entries(snapshot.symbols)) {
        const sym = getSymbolByTicker(ticker);
        if (!sym) continue;
        // Don't overwrite a fresher live Yahoo quote if one already arrived
        const current = this.states.get(sym.ticker);
        if (current && current.quote.source === 'yahoo') continue;
        batch.push(snapshotEntryToQuote(sym, entry));
      }
    }

    if (binanceQuotes.length > 0) {
      batch.push(...binanceQuotes);
    }

    if (batch.length > 0) {
      this.ingestRealQuotes(batch);
    }
  }

  public getQuote(ticker: string): QuoteTick | undefined {
    const sym = getSymbolByTicker(ticker);
    if (!sym) return undefined;
    const state = this.states.get(sym.ticker);
    return state ? { ...state.quote } : undefined;
  }

  public getAllQuotes(): Map<string, QuoteTick> {
    const result = new Map<string, QuoteTick>();
    for (const [ticker, state] of this.states) {
      result.set(ticker, { ...state.quote });
    }
    return result;
  }

  public subscribeQuotes(listener: QuoteListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  public subscribeSymbol(
    ticker: string,
    listener: SymbolQuoteListener,
  ): () => void {
    const sym = getSymbolByTicker(ticker);
    const key = sym?.ticker ?? ticker.toUpperCase();
    let set = this.symbolListeners.get(key);
    if (!set) {
      set = new Set();
      this.symbolListeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.symbolListeners.delete(key);
      }
    };
  }

  /**
   * Subscribe to live candle updates for a symbol + timeframe.
   * For Binance crypto pairs in browser mode, opens a live `@kline_<tf>` stream
   * so candlesticks animate tick-by-tick straight from Binance.
   */
  public subscribeCandle(
    ticker: string,
    timeframe: Timeframe,
    seedCandle: Candle,
    listener: CandleUpdateListener,
  ): () => void {
    const sym = getSymbolByTicker(ticker);
    const normalizedTicker = sym?.ticker ?? ticker.toUpperCase();
    const key = `${normalizedTicker}|${timeframe}`;

    let sub = this.candleSubs.get(key);
    if (!sub) {
      sub = {
        ticker: normalizedTicker,
        timeframe,
        currentCandle: { ...seedCandle },
        listeners: new Set(),
        klineWs: null,
      };
      this.candleSubs.set(key, sub);
      if (this.enableLiveCrypto && !isTestEnvironment()) {
        this.connectKlineWs(sub);
      }
    } else {
      sub.currentCandle = { ...seedCandle };
    }
    sub.listeners.add(listener);

    return () => {
      sub?.listeners.delete(listener);
      if (sub && sub.listeners.size === 0) {
        this.closeKlineWs(sub);
        this.candleSubs.delete(key);
      }
    };
  }

  /**
   * Ingests a full real QuoteTick (from Binance REST/WS, Yahoo live, or Yahoo snapshot)
   * without running any simulated drift over it.
   */
  public ingestRealQuote(quote: QuoteTick): boolean {
    const sym = getSymbolByTicker(quote.ticker);
    if (!sym || !Number.isFinite(quote.price) || quote.price <= 0) return false;
    const state = this.states.get(sym.ticker);
    if (!state) return false;

    state.quote = { ...quote, ticker: sym.ticker, id: sym.id };
    if (quote.source === 'binance') {
      state.lastBinanceUpdateMs = quote.timestamp;
    }
    this.emitUpdates([sym.ticker]);
    return true;
  }

  /** Batch-ingests multiple real quotes and emits a single consolidated update */
  public ingestRealQuotes(quotes: readonly QuoteTick[]): string[] {
    const changed: string[] = [];
    for (const quote of quotes) {
      const sym = getSymbolByTicker(quote.ticker);
      if (!sym || !Number.isFinite(quote.price) || quote.price <= 0) continue;
      const state = this.states.get(sym.ticker);
      if (!state) continue;

      state.quote = { ...quote, ticker: sym.ticker, id: sym.id };
      if (quote.source === 'binance') {
        state.lastBinanceUpdateMs = quote.timestamp;
      }
      changed.push(sym.ticker);
    }

    if (changed.length > 0) {
      this.emitUpdates(changed);
    }
    return changed;
  }

  /**
   * Advance one simulation step ONLY for symbols whose source is still `'simulated'`.
   * NEVER overwrites real `'binance'`, `'yahoo'`, or `'snapshot'` quotes!
   */
  public tickOnce(nowMs = Date.now()): string[] {
    const changed: string[] = [];

    for (const [ticker, state] of this.states) {
      // Never inject synthetic random walk over any real market quote
      if (state.quote.source !== 'simulated') {
        continue;
      }

      const isWatched =
        this.symbolListeners.has(ticker) || this.hasCandleSubForTicker(ticker);
      if (!isWatched && this.rng() > 0.35) {
        continue;
      }

      const { symbol, quote } = state;
      const tickVol = (symbol.volatility / Math.sqrt(23400)) * 1.45;
      const noise = (this.rng() + this.rng() + this.rng() - 1.5) * 1.25;
      const anchorPull =
        ((symbol.basePrice - quote.price) / symbol.basePrice) * 0.015;
      state.momentum = state.momentum * 0.6 + noise * tickVol * 0.4;

      const deltaRatio = state.momentum + noise * tickVol + anchorPull;
      const nextRaw = Math.max(symbol.tickSize, quote.price * (1 + deltaRatio));
      const nextPrice = roundPrice(nextRaw, symbol.precision);

      const volumeDelta = Math.max(
        1,
        Math.round((symbol.avgVolume / 23400) * (0.4 + this.rng() * 1.4)),
      );

      this.applyPriceUpdate(state, nextPrice, volumeDelta, nowMs, 'simulated');
      changed.push(ticker);
    }

    if (changed.length > 0) {
      this.emitUpdates(changed);
    }

    return changed;
  }

  /** External single-trade price injection (used by tests or external handlers) */
  public ingestExternalTrade(
    ticker: string,
    price: number,
    volumeDelta: number,
    nowMs = Date.now(),
    source: DataSourceKind = 'binance',
  ): boolean {
    const sym = getSymbolByTicker(ticker);
    if (!sym || !Number.isFinite(price) || price <= 0) return false;
    const state = this.states.get(sym.ticker);
    if (!state) return false;

    const rounded = roundPrice(price, sym.precision);
    if (source === 'binance') {
      state.lastBinanceUpdateMs = nowMs;
    }
    this.applyPriceUpdate(state, rounded, Math.max(0, volumeDelta), nowMs, source);
    this.emitUpdates([sym.ticker]);
    return true;
  }

  private applyPriceUpdate(
    state: InternalQuoteState,
    nextPrice: number,
    volumeDelta: number,
    nowMs: number,
    source: DataSourceKind,
  ): void {
    const { symbol, quote } = state;
    const spread = Math.max(
      symbol.tickSize,
      roundPrice(nextPrice * 0.00015, symbol.precision),
    );
    const change = roundPrice(nextPrice - quote.prevClose, symbol.precision);
    const changePercent =
      quote.prevClose !== 0
        ? Math.round(((nextPrice - quote.prevClose) / quote.prevClose) * 10000) /
          100
        : 0;

    state.quote = {
      ...quote,
      price: nextPrice,
      high: Math.max(quote.high, nextPrice),
      low: Math.min(quote.low, nextPrice),
      change,
      changePercent,
      volume: Math.round(quote.volume + volumeDelta),
      bid: roundPrice(
        Math.max(symbol.tickSize, nextPrice - spread / 2),
        symbol.precision,
      ),
      ask: roundPrice(nextPrice + spread / 2, symbol.precision),
      timestamp: nowMs,
      source,
    };

    this.updateCandleSubscriptions(symbol.ticker, nextPrice, volumeDelta, nowMs);
  }

  private updateCandleSubscriptions(
    ticker: string,
    price: number,
    volumeDelta: number,
    nowMs: number,
  ): void {
    const nowSec = Math.floor(nowMs / 1000);
    for (const sub of this.candleSubs.values()) {
      if (sub.ticker !== ticker) continue;
      // When a real Binance kline WS is active for this subscription, let kline frames drive candles directly
      if (sub.klineWs && sub.klineWs.readyState === WebSocket.OPEN) continue;

      const step = TIMEFRAME_SECONDS[sub.timeframe];
      const current = sub.currentCandle;
      const barEnd = current.time + step;

      if (nowSec >= barEnd && nowSec - current.time < step * 100) {
        const alignedTime = Math.floor(nowSec / step) * step;
        sub.currentCandle = {
          time: alignedTime,
          open: current.close,
          high: Math.max(current.close, price),
          low: Math.min(current.close, price),
          close: price,
          volume: Math.max(1, Math.round(volumeDelta)),
        };
      } else {
        sub.currentCandle = {
          ...current,
          high: Math.max(current.high, price),
          low: Math.min(current.low, price),
          close: price,
          volume: Math.round(current.volume + volumeDelta),
        };
      }

      const copy = { ...sub.currentCandle };
      for (const listener of sub.listeners) {
        listener(copy);
      }
    }
  }

  private emitUpdates(changedTickers: string[]): void {
    for (const ticker of changedTickers) {
      const state = this.states.get(ticker);
      if (!state) continue;
      const listeners = this.symbolListeners.get(ticker);
      if (listeners && listeners.size > 0) {
        const snapshot = { ...state.quote };
        for (const fn of listeners) {
          fn(snapshot);
        }
      }
    }

    if (this.globalListeners.size > 0) {
      const map = this.getAllQuotes();
      for (const fn of this.globalListeners) {
        fn(map, changedTickers);
      }
    }
  }

  private hasCandleSubForTicker(ticker: string): boolean {
    for (const sub of this.candleSubs.values()) {
      if (sub.ticker === ticker) return true;
    }
    return false;
  }

  /**
   * Connects to Binance's all-market `!miniTicker@arr` stream on `data-stream.binance.vision`
   * (fallback: `stream.binance.com:9443`) to stream live 1s real prices, 24h open, high, low & volume
   * for all 78 catalog crypto pairs in one lightweight socket.
   */
  private connectBinanceWs(): void {
    if (this.binanceWs || typeof WebSocket === 'undefined') return;
    const base = BINANCE_WS_BASES[this.binanceWsBaseIdx % BINANCE_WS_BASES.length];
    const url = `${base}/ws/!miniTicker@arr`;

    try {
      const ws = new WebSocket(url);
      this.binanceWs = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const arr = JSON.parse(String(event.data));
          if (!Array.isArray(arr)) return;
          const nowMs = Date.now();
          const batch: QuoteTick[] = [];

          for (const frame of arr) {
            if (!frame || typeof frame !== 'object') continue;
            const s = (frame as { s?: string }).s;
            if (!s) continue;
            const state = this.states.get(s);
            if (!state || !state.symbol.isCrypto) continue;

            const price = Number.parseFloat(String((frame as { c?: string }).c ?? ''));
            const open = Number.parseFloat(String((frame as { o?: string }).o ?? ''));
            const high = Number.parseFloat(String((frame as { h?: string }).h ?? ''));
            const low = Number.parseFloat(String((frame as { l?: string }).l ?? ''));
            const vol = Number.parseFloat(String((frame as { v?: string }).v ?? '0'));
            if (!Number.isFinite(price) || price <= 0) continue;

            const sym = state.symbol;
            const prevClose = Number.isFinite(open) && open > 0 ? roundPrice(open, sym.precision) : state.quote.prevClose;
            const roundedPrice = roundPrice(price, sym.precision);
            const change = roundPrice(roundedPrice - prevClose, sym.precision);
            const changePercent =
              prevClose > 0
                ? Math.round(((roundedPrice - prevClose) / prevClose) * 10000) / 100
                : 0;
            const spread = Math.max(
              sym.tickSize,
              roundPrice(roundedPrice * 0.00012, sym.precision),
            );

            batch.push({
              ticker: sym.ticker,
              id: sym.id,
              price: roundedPrice,
              open: prevClose,
              high: Number.isFinite(high) && high > 0 ? roundPrice(Math.max(high, roundedPrice), sym.precision) : roundedPrice,
              low: Number.isFinite(low) && low > 0 ? roundPrice(Math.min(low, roundedPrice), sym.precision) : roundedPrice,
              prevClose,
              change,
              changePercent,
              volume: Number.isFinite(vol) && vol >= 0 ? Math.round(vol) : state.quote.volume,
              bid: roundPrice(Math.max(sym.tickSize, roundedPrice - spread / 2), sym.precision),
              ask: roundPrice(roundedPrice + spread / 2, sym.precision),
              timestamp: nowMs,
              source: 'binance',
            });
          }

          if (batch.length > 0) {
            this.ingestRealQuotes(batch);
          }
        } catch {
          // Ignore malformed WS frame silently
        }
      };

      ws.onerror = () => {
        this.closeBinanceWs();
        if (this.binanceWsBaseIdx + 1 < BINANCE_WS_BASES.length) {
          this.binanceWsBaseIdx += 1;
          if (this.running && this.enableLiveCrypto) {
            this.connectBinanceWs();
          }
        } else {
          this.binanceDisabledByFailure = true;
        }
      };

      ws.onclose = () => {
        if (this.binanceWs === ws) {
          this.binanceWs = null;
        }
      };
    } catch {
      this.binanceDisabledByFailure = true;
      this.binanceWs = null;
    }
  }

  /** Connects a dedicated live `<sym>@kline_<tf>` WebSocket for the active crypto chart */
  private connectKlineWs(sub: CandleSubscription): void {
    if (sub.klineWs || typeof WebSocket === 'undefined') return;
    const sym = getSymbolByTicker(sub.ticker);
    if (!sym || !sym.isCrypto || !sym.binanceSymbol) return;

    const interval = BINANCE_INTERVAL_MAP[sub.timeframe];
    const base = BINANCE_WS_BASES[this.binanceWsBaseIdx % BINANCE_WS_BASES.length];
    const url = `${base}/ws/${sym.binanceSymbol}@kline_${interval}`;

    try {
      const ws = new WebSocket(url);
      sub.klineWs = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            k?: { t: number; o: string; h: string; l: string; c: string; v: string };
          };
          const k = payload.k;
          if (!k) return;
          const open = Number.parseFloat(k.o);
          const high = Number.parseFloat(k.h);
          const low = Number.parseFloat(k.l);
          const close = Number.parseFloat(k.c);
          const volume = Number.parseFloat(k.v);
          if (!Number.isFinite(close) || close <= 0) return;

          const liveCandle: Candle = {
            time: Math.floor(k.t / 1000),
            open,
            high: Math.max(high, open, close),
            low: Math.min(low, open, close),
            close,
            volume: Number.isFinite(volume) && volume >= 0 ? volume : 0,
          };

          sub.currentCandle = liveCandle;
          for (const listener of sub.listeners) {
            listener({ ...liveCandle });
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        this.closeKlineWs(sub);
      };

      ws.onclose = () => {
        if (sub.klineWs === ws) {
          sub.klineWs = null;
        }
      };
    } catch {
      sub.klineWs = null;
    }
  }

  private closeKlineWs(sub: CandleSubscription): void {
    if (sub.klineWs) {
      try {
        sub.klineWs.onopen = null;
        sub.klineWs.onmessage = null;
        sub.klineWs.onerror = null;
        sub.klineWs.onclose = null;
        sub.klineWs.close();
      } catch {
        // Ignore
      }
      sub.klineWs = null;
    }
  }

  private closeBinanceWs(): void {
    if (this.binanceWs) {
      try {
        this.binanceWs.onopen = null;
        this.binanceWs.onmessage = null;
        this.binanceWs.onerror = null;
        this.binanceWs.onclose = null;
        this.binanceWs.close();
      } catch {
        // Ignore close errors
      }
      this.binanceWs = null;
    }
  }
}

export const marketFeed = new MarketFeed();
