export type AssetClass =
  | 'index'
  | 'stock'
  | 'crypto'
  | 'forex'
  | 'futures'
  | 'bond'
  | 'etf';

export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M';

export const TIMEFRAMES: readonly Timeframe[] = [
  '1m',
  '5m',
  '15m',
  '1H',
  '4H',
  '1D',
  '1W',
  '1M',
] as const;

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
};

export const TIMEFRAME_LABELS_IT: Record<Timeframe, string> = {
  '1m': '1 minuto',
  '5m': '5 minuti',
  '15m': '15 minuti',
  '1H': '1 ora',
  '4H': '4 ore',
  '1D': '1 giorno',
  '1W': '1 settimana',
  '1M': '1 mese',
};

export type ChartType =
  | 'candles'
  | 'hollow'
  | 'bars'
  | 'line'
  | 'area'
  | 'baseline'
  | 'heikinAshi';

export type MarketStatus = 'open' | 'closed' | 'pre' | 'post' | '24x7';

export type DataSourceKind = 'binance' | 'yahoo' | 'snapshot' | 'simulated';

export interface SymbolInfo {
  /** Qualified TradingView identifier, e.g. "MIL:RACE" or "BINANCE:BTCUSDT" */
  id: string;
  /** Short ticker symbol, e.g. "RACE", "FTSEMIB", "BTCUSDT" */
  ticker: string;
  /** Exchange code, e.g. "MIL", "NASDAQ", "INDEX", "BINANCE", "FX" */
  exchange: string;
  /** Human-readable Italian / official instrument name */
  name: string;
  /** Concise short label for compact chips/tabs */
  shortName: string;
  /** Longer description shown in search and symbol details */
  description: string;
  assetClass: AssetClass;
  currency: string;
  country: string;
  sector: string;
  /** Reference current/anchor price */
  basePrice: number;
  /** Reference previous session close for daily change calculation */
  prevClose: number;
  /** Decimal places for price formatting */
  precision: number;
  /** Minimum price increment */
  tickSize: number;
  /** Daily base volatility (e.g. 0.015 = 1.5% daily std dev) */
  volatility: number;
  /** Subtle annualized drift bias for realistic simulation */
  drift: number;
  /** Average daily volume */
  avgVolume: number;
  /** Market capitalization in billions (USD/EUR) where applicable */
  marketCap?: number;
  /** Price/Earnings ratio where applicable */
  peRatio?: number;
  /** Dividend yield % where applicable */
  dividendYield?: number;
  /** Equity beta where applicable */
  beta?: number;
  /** Earnings per share where applicable */
  eps?: number;
  /** 52-week high reference */
  high52w: number;
  /** 52-week low reference */
  low52w: number;
  /** Whether the symbol can subscribe to live Binance WS trades */
  isCrypto?: boolean;
  /** Lowercase Binance stream symbol (e.g. "btcusdt") */
  binanceSymbol?: string;
  /** Yahoo Finance v8 chart symbol (e.g. "AAPL", "RACE.MI", "^GSPC", "EURUSD=X", "GC=F") */
  yahooSymbol?: string;
  /** Brand circular badge color */
  logoColor: string;
  /** 1-3 character icon badge label */
  logoText: string;
  marketStatus: MarketStatus;
}

export interface Candle {
  /** Unix timestamp in seconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteTick {
  ticker: string;
  id: string;
  price: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  source: DataSourceKind;
}
