export interface WatchlistGroup {
  id: string;
  name: string;
  color?: string;
  /** List of ticker symbols (e.g. ["FTSEMIB", "RACE", "BTCUSDT"]) */
  symbols: string[];
  collapsed?: boolean;
}

export type AlertCondition =
  | 'crosses_above'
  | 'crosses_below'
  | 'greater_than'
  | 'less_than'
  | 'entering_channel'
  | 'exiting_channel'
  | 'percent_up'
  | 'percent_down';

export type AlertTarget = 'price' | 'rsi' | 'sma' | 'ema' | 'macd';

export type AlertStatus = 'active' | 'triggered' | 'paused' | 'expired';

export interface AlertRule {
  id: string;
  name: string;
  symbol: string;
  target: AlertTarget;
  targetPeriod?: number;
  condition: AlertCondition;
  /** Primary threshold value (or lower bound for channel conditions) */
  value: number;
  /** Upper bound for channel conditions */
  upperValue?: number;
  triggerOnce: boolean;
  status: AlertStatus;
  message: string;
  createdAt: number;
  lastTriggeredAt?: number;
  triggerCount: number;
}

export interface AlertTriggerEvent {
  id: string;
  alertId: string;
  alertName: string;
  symbol: string;
  target: AlertTarget;
  condition: AlertCondition;
  triggeredValue: number;
  thresholdValue: number;
  message: string;
  triggeredAt: number;
}

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected';

export interface PaperOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  filledPrice?: number;
  status: OrderStatus;
  createdAt: number;
  filledAt?: number;
  commission: number;
  realizedPnl?: number;
  rejectReason?: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marketValue: number;
  takeProfit?: number;
  stopLoss?: number;
  openedAt: number;
}

export interface PaperAccountState {
  initialBalance: number;
  /** Cash balance including realized P&L */
  balance: number;
  /** Total account equity (balance + unrealizedPnl) */
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  marginUsed: number;
  freeMargin: number;
  currency: string;
  positions: PaperPosition[];
  /** Pending open limit/stop orders */
  orders: PaperOrder[];
  /** Executed / cancelled / rejected order log (newest first) */
  history: PaperOrder[];
}

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

export interface ScreenerQuery {
  category?: ScreenerCategory;
  search?: string;
  sector?: string;
  country?: string;
  rating?: string;
  minPrice?: number;
  maxPrice?: number;
  minChangePercent?: number;
  maxChangePercent?: number;
  minRsi?: number;
  maxRsi?: number;
  minMarketCap?: number;
  minVolume?: number;
  sortBy?: ScreenerSortField;
  sortDir?: 'asc' | 'desc';
}

export interface ScreenerRow {
  symbol: import('./market').SymbolInfo;
  ticker: string;
  name: string;
  exchange: string;
  assetClass: import('./market').AssetClass;
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
  technicalRating: import('./indicators').RatingLabel;
  technicalScore: number;
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
  data: Array<{ time: number; value: number | null }>;
}

export interface PineHLineOutput {
  value: number;
  title: string;
  color: string;
  lineStyle: import('./indicators').LineStyle;
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
