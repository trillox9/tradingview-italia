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
