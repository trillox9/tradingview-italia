import type { Timeframe } from './market';

export type IndicatorType =
  | 'SMA'
  | 'EMA'
  | 'WMA'
  | 'BB'
  | 'VWAP'
  | 'RSI'
  | 'MACD'
  | 'STOCH'
  | 'ATR'
  | 'SUPERTREND'
  | 'ICHIMOKU'
  | 'PIVOT'
  | 'VOLUME';

export type IndicatorPane = 'overlay' | 'separate';

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface IndicatorStyleSpec {
  color: string;
  lineWidth?: number;
  lineStyle?: LineStyle;
  opacity?: number;
}

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  name: string;
  shortName?: string;
  visible: boolean;
  pane: IndicatorPane;
  params: Record<string, number | string>;
  styles: Record<string, IndicatorStyleSpec>;
  /** Optional primary line style override for Indicator Settings Stile tab */
  lineStyle?: LineStyle;
  /** Optional timeframe visibility filter (empty/undefined = visible on all timeframes) */
  visibleTimeframes?: Timeframe[];
}

export interface SeriesPoint {
  /** Unix timestamp in seconds (matches Candle.time) */
  time: number;
  value: number | null;
}

export interface IndicatorPlot {
  key: string;
  label: string;
  kind: 'line' | 'histogram' | 'area' | 'step' | 'dots';
  color: string;
  lineWidth?: number;
  lineStyle?: LineStyle;
  data: SeriesPoint[];
  /** Optional dynamic histogram coloring (e.g. MACD histogram, Volume) */
  colorByValue?: {
    positive: string;
    negative: string;
    positiveFaded?: string;
    negativeFaded?: string;
  };
}

export interface IndicatorBand {
  upperKey: string;
  lowerKey: string;
  fillColor: string;
  bearishFillColor?: string;
}

export interface IndicatorHLine {
  value: number;
  label?: string;
  color: string;
  lineStyle?: LineStyle;
}

export interface IndicatorSeries {
  id: string;
  configId: string;
  type: IndicatorType | 'PINE';
  title: string;
  pane: IndicatorPane;
  plots: IndicatorPlot[];
  bands?: IndicatorBand[];
  hlines?: IndicatorHLine[];
  priceRange?: {
    min: number;
    max: number;
  };
}

export type SignalAction = 'buy' | 'neutral' | 'sell';

export type RatingLabel =
  | 'Forte vendita'
  | 'Vendita'
  | 'Neutrale'
  | 'Acquisto'
  | 'Forte acquisto';

export interface TechnicalIndicatorSignal {
  name: string;
  value: number | null;
  action: SignalAction;
}

export interface TechnicalGroupSummary {
  rating: RatingLabel;
  /** Normalized score from -1 (Forte vendita) to +1 (Forte acquisto) */
  score: number;
  buyCount: number;
  neutralCount: number;
  sellCount: number;
  signals: TechnicalIndicatorSignal[];
}

export interface PivotLevels {
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface PivotPointsResult {
  classic: PivotLevels;
  fibonacci: PivotLevels;
  camarilla: PivotLevels;
  woodie: PivotLevels;
  demark: {
    p: number;
    r1: number;
    s1: number;
  };
}

export interface TechnicalSummary {
  oscillators: TechnicalGroupSummary;
  movingAverages: TechnicalGroupSummary;
  summary: {
    rating: RatingLabel;
    score: number;
    buyCount: number;
    neutralCount: number;
    sellCount: number;
  };
  pivots: PivotPointsResult;
}
