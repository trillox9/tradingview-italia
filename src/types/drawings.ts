import type { LineStyle } from './indicators';
import type { Timeframe } from './market';

export type DrawingToolType =
  | 'cursor'
  | 'crosshair'
  | 'trendline'
  | 'ray'
  | 'extendedLine'
  | 'horizontalLine'
  | 'verticalLine'
  | 'parallelChannel'
  | 'fibRetracement'
  | 'rectangle'
  | 'ellipse'
  | 'brush'
  | 'text'
  | 'callout'
  | 'longPosition'
  | 'shortPosition'
  | 'measure'
  | 'arrow';

export type PersistableDrawingType = Exclude<
  DrawingToolType,
  'cursor' | 'crosshair'
>;

export interface DrawingPoint {
  /** Unix timestamp in seconds */
  time: number;
  /** Price level */
  price: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  fillColor?: string;
  fillOpacity?: number;
  fontSize?: number;
  showLabels?: boolean;
}

export interface DrawingObject {
  id: string;
  symbol: string;
  timeframe?: Timeframe;
  type: PersistableDrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  text?: string;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  /** Custom Fibonacci ratios for fibRetracement */
  fibLevels?: number[];
  /** Explicit stop price for longPosition / shortPosition */
  stopPrice?: number;
  /** Explicit target price for longPosition / shortPosition */
  targetPrice?: number;
}

export interface FibLevelLine {
  ratio: number;
  label: string;
  price: number;
  color: string;
}

export interface MeasureResult {
  startPrice: number;
  endPrice: number;
  priceDelta: number;
  percentDelta: number;
  bars: number;
  timeSpanSeconds: number;
  isPositive: boolean;
}

export interface PositionMetrics {
  side: 'long' | 'short';
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  riskAmount: number;
  rewardAmount: number;
  riskPercent: number;
  rewardPercent: number;
  riskRewardRatio: number;
}
