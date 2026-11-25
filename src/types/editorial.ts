import type { AssetClass, SymbolInfo, Timeframe } from './market';
import type { RatingLabel, SeriesPoint } from './indicators';

export type ScreenerCategory =
  | 'all'
  | 'stocks'
  | 'italian'
  | 'us'
  | 'crypto'
  | 'forex'
  | 'indices'
  | 'futures'
  | 'bonds'
  | 'etf';

export interface ScreenerRow {
  symbol: SymbolInfo;
  ticker: string;
  name: string;
  exchange: string;
  assetClass: AssetClass;
  sector: string;
  country: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  relativeVolume: number;
  marketCap: number;
  peRatio: number | null;
  dividendYield: number | null;
  rsi14: number | null;
  atr14: number | null;
  sma20: number | null;
  sma50: number | null;
  high52w: number;
  low52w: number;
  technicalRating: RatingLabel;
  technicalScore: number;
}

export type ScreenerSortField =
  | 'ticker'
  | 'name'
  | 'price'
  | 'changePercent'
  | 'volume'
  | 'relativeVolume'
  | 'marketCap'
  | 'peRatio'
  | 'dividendYield'
  | 'rsi14'
  | 'technicalScore';

export type ScreenerSortDirection = 'asc' | 'desc';

export interface ScreenerQuery {
  category?: ScreenerCategory;
  search?: string;
  sector?: string;
  country?: string;
  rating?: RatingLabel | 'all';
  minPrice?: number;
  maxPrice?: number;
  minChangePercent?: number;
  maxChangePercent?: number;
  minRsi?: number;
  maxRsi?: number;
  minMarketCap?: number;
  minVolume?: number;
  sortBy?: ScreenerSortField;
  sortDir?: ScreenerSortDirection;
}

export interface MarketIdea {
  id: string;
  title: string;
  author: string;
  authorBadge?: 'PRO' | 'PRO+' | 'PREMIUM' | 'MOD' | 'WIZARD';
  authorAvatarColor: string;
  symbol: string;
  exchange: string;
  timeframe: Timeframe;
  direction: 'LONG' | 'SHORT' | 'NEUTRALE';
  likes: number;
  comments: number;
  publishedAt: string;
  publishedAgo: string;
  summary: string;
  tags: string[];
  chartSeed: number;
  category: 'azioni' | 'cripto' | 'forex' | 'indici' | 'materie-prime';
  isEditorsPick?: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  publishedAgo: string;
  summary: string;
  relatedTickers: string[];
  category: 'mercati' | 'macro' | 'azioni' | 'cripto' | 'forex' | 'materie-prime';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  countryName: string;
  currency: string;
  institution: string;
  title: string;
  impact: 1 | 2 | 3;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit?: string;
  category: 'tassi' | 'inflazione' | 'pil' | 'lavoro' | 'pmi' | 'bilancia';
}

export interface HeatmapStock {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  marketCap: number;
  price: number;
  changePercent: number;
  volume: number;
}

export interface HeatmapSector {
  id: string;
  name: string;
  avgChangePercent: number;
  totalMarketCap: number;
  stocks: HeatmapStock[];
}

export interface PineDiagnostic {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface PinePlotOutput {
  id: string;
  title: string;
  color: string;
  lineWidth: number;
  pane: 'overlay' | 'separate';
  data: SeriesPoint[];
}

export interface PineHLineOutput {
  value: number;
  title: string;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export interface PineTrade {
  id: number;
  entryId: string;
  side: 'long' | 'short';
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  barsHeld: number;
}

export interface PineEquityPoint {
  time: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface PineBacktestMetrics {
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgTradePnl: number;
  avgBarsInTrade: number;
  sharpeRatio: number;
  trades: PineTrade[];
  equityCurve: PineEquityPoint[];
}

export interface PineExecutionResult {
  ok: boolean;
  scriptName: string;
  isStrategy: boolean;
  overlay: boolean;
  plots: PinePlotOutput[];
  hlines: PineHLineOutput[];
  backtest: PineBacktestMetrics | null;
  diagnostics: PineDiagnostic[];
  logs: string[];
}
