import type { LineStyle } from './indicators';

export type ChartPrecisionSetting =
  | 'default'
  | '0'
  | '1'
  | '2'
  | '4'
  | '6'
  | '8';

export type ChartTimezoneSetting =
  | 'Europe/Rome'
  | 'UTC'
  | 'America/New_York'
  | 'Asia/Tokyo';

export type StatusLineTitleMode =
  | 'ticker'
  | 'description'
  | 'ticker_and_description';

export type PriceScalePosition = 'right' | 'left';

export type ChartScaleMode = 'regular' | 'log' | 'percent' | 'indexed100';

export type ChartDateFormat = 'DD MMM' | 'YYYY-MM-DD' | 'DD/MM/YYYY';

export type CanvasGridMode = 'both' | 'vert' | 'horz' | 'none';

export interface ChartSymbolSettings {
  candleUpColor: string;
  candleDownColor: string;
  candleBorderUpColor: string;
  candleBorderDownColor: string;
  candleWickUpColor: string;
  candleWickDownColor: string;
  showBorders: boolean;
  showWicks: boolean;
  colorBarsBasedOnPrevClose: boolean;
  lineColor: string;
  lineWidth: number;
  areaTopColor: string;
  areaBottomColor: string;
  baselineTopColor: string;
  baselineBottomColor: string;
  showLastPriceLine: boolean;
  lastPriceLineStyle: LineStyle;
  precision: ChartPrecisionSetting;
  timezone: ChartTimezoneSetting;
}

export interface ChartStatusLineSettings {
  showLogo: boolean;
  titleMode: StatusLineTitleMode;
  showOpenMarketStatus: boolean;
  showOhlc: boolean;
  showBarChange: boolean;
  showVolume: boolean;
  showBuySellButtons: boolean;
  showIndicatorTitles: boolean;
  showIndicatorArguments: boolean;
  showIndicatorValues: boolean;
  /** Legend background opacity in [0, 1] */
  bgOpacity: number;
}

export interface ChartScalesSettings {
  position: PriceScalePosition;
  mode: ChartScaleMode;
  invertScale: boolean;
  lockPriceToBarRatio: boolean;
  priceToBarRatio: number;
  scalePriceChartOnly: boolean;
  showSymbolNameLabel: boolean;
  showSymbolLastValueLabel: boolean;
  showHighLowLabels: boolean;
  showBidAskLabels: boolean;
  showBidAskLines: boolean;
  showIndicatorNameLabels: boolean;
  showIndicatorValueLabels: boolean;
  showCountdown: boolean;
  showPlusButton: boolean;
  noOverlappingLabels: boolean;
  showCurrencyUnit: boolean;
  dateFormat: ChartDateFormat;
}

export interface ChartCanvasSettings {
  bgType: 'solid' | 'gradient';
  bgColor: string;
  bgGradientEnd: string;
  gridMode: CanvasGridMode;
  vertGridColor: string;
  horzGridColor: string;
  crosshairColor: string;
  crosshairStyle: LineStyle;
  crosshairWidth: number;
  showWatermark: boolean;
  watermarkText: string;
  watermarkColor: string;
  scaleTextColor: string;
  scaleFontSize: number;
  topMarginPct: number;
  bottomMarginPct: number;
  rightMarginBars: number;
}

export interface ChartTradingSettings {
  showBuySellButtons: boolean;
  instantOrderPlacement: boolean;
  showPositions: boolean;
  showOrders: boolean;
  showExecutions: boolean;
  extendLinesLeft: boolean;
}

export interface ChartAlertsSettings {
  showAlertLines: boolean;
  onlyActiveAlerts: boolean;
  alertLineColor: string;
  showToast: boolean;
}

export interface ChartSettings {
  symbol: ChartSymbolSettings;
  statusLine: ChartStatusLineSettings;
  scales: ChartScalesSettings;
  canvas: ChartCanvasSettings;
  trading: ChartTradingSettings;
  alerts: ChartAlertsSettings;
}

export interface ChartSettingsPatch {
  symbol?: Partial<ChartSymbolSettings>;
  statusLine?: Partial<ChartStatusLineSettings>;
  scales?: Partial<ChartScalesSettings>;
  canvas?: Partial<ChartCanvasSettings>;
  trading?: Partial<ChartTradingSettings>;
  alerts?: Partial<ChartAlertsSettings>;
}

export const DEFAULT_CHART_SETTINGS_DARK: ChartSettings = {
  symbol: {
    candleUpColor: '#089981',
    candleDownColor: '#F23645',
    candleBorderUpColor: '#089981',
    candleBorderDownColor: '#F23645',
    candleWickUpColor: '#089981',
    candleWickDownColor: '#F23645',
    showBorders: true,
    showWicks: true,
    colorBarsBasedOnPrevClose: false,
    lineColor: '#2962FF',
    lineWidth: 2,
    areaTopColor: 'rgba(41, 98, 255, 0.28)',
    areaBottomColor: 'rgba(41, 98, 255, 0.02)',
    baselineTopColor: 'rgba(8, 153, 129, 0.28)',
    baselineBottomColor: 'rgba(242, 54, 69, 0.28)',
    showLastPriceLine: true,
    lastPriceLineStyle: 'dashed',
    precision: 'default',
    timezone: 'Europe/Rome',
  },
  statusLine: {
    showLogo: true,
    titleMode: 'ticker_and_description',
    showOpenMarketStatus: true,
    showOhlc: true,
    showBarChange: true,
    showVolume: true,
    showBuySellButtons: true,
    showIndicatorTitles: true,
    showIndicatorArguments: true,
    showIndicatorValues: true,
    bgOpacity: 0.55,
  },
  scales: {
    position: 'right',
    mode: 'regular',
    invertScale: false,
    lockPriceToBarRatio: false,
    priceToBarRatio: 1,
    scalePriceChartOnly: false,
    showSymbolNameLabel: false,
    showSymbolLastValueLabel: true,
    showHighLowLabels: false,
    showBidAskLabels: false,
    showBidAskLines: false,
    showIndicatorNameLabels: false,
    showIndicatorValueLabels: true,
    showCountdown: true,
    showPlusButton: true,
    noOverlappingLabels: true,
    showCurrencyUnit: true,
    dateFormat: 'DD MMM',
  },
  canvas: {
    bgType: 'solid',
    bgColor: '#000000',
    bgGradientEnd: '#131722',
    gridMode: 'both',
    vertGridColor: 'rgba(255, 255, 255, 0.06)',
    horzGridColor: 'rgba(255, 255, 255, 0.06)',
    crosshairColor: '#8C8C8C',
    crosshairStyle: 'dashed',
    crosshairWidth: 1,
    showWatermark: true,
    watermarkText: '',
    watermarkColor: 'rgba(255, 255, 255, 0.05)',
    scaleTextColor: '#8C8C8C',
    scaleFontSize: 11,
    topMarginPct: 10,
    bottomMarginPct: 8,
    rightMarginBars: 10,
  },
  trading: {
    showBuySellButtons: true,
    instantOrderPlacement: false,
    showPositions: true,
    showOrders: true,
    showExecutions: true,
    extendLinesLeft: true,
  },
  alerts: {
    showAlertLines: true,
    onlyActiveAlerts: false,
    alertLineColor: '#FF9800',
    showToast: true,
  },
};

export const DEFAULT_CHART_SETTINGS_LIGHT: ChartSettings = {
  ...DEFAULT_CHART_SETTINGS_DARK,
  symbol: { ...DEFAULT_CHART_SETTINGS_DARK.symbol },
  statusLine: { ...DEFAULT_CHART_SETTINGS_DARK.statusLine },
  scales: { ...DEFAULT_CHART_SETTINGS_DARK.scales },
  canvas: {
    ...DEFAULT_CHART_SETTINGS_DARK.canvas,
    bgColor: '#FFFFFF',
    bgGradientEnd: '#F2F5FA',
    vertGridColor: '#F0F3FA',
    horzGridColor: '#F0F3FA',
    crosshairColor: '#787B86',
    watermarkColor: 'rgba(19, 23, 34, 0.05)',
    scaleTextColor: '#707070',
  },
  trading: { ...DEFAULT_CHART_SETTINGS_DARK.trading },
  alerts: { ...DEFAULT_CHART_SETTINGS_DARK.alerts },
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = DEFAULT_CHART_SETTINGS_DARK;

export function getDefaultChartSettings(
  theme: 'dark' | 'light',
): ChartSettings {
  const src =
    theme === 'light'
      ? DEFAULT_CHART_SETTINGS_LIGHT
      : DEFAULT_CHART_SETTINGS_DARK;
  return {
    symbol: { ...src.symbol },
    statusLine: { ...src.statusLine },
    scales: { ...src.scales },
    canvas: { ...src.canvas },
    trading: { ...src.trading },
    alerts: { ...src.alerts },
  };
}

export function mergeChartSettings(
  base: ChartSettings,
  patch: ChartSettingsPatch,
): ChartSettings {
  return {
    symbol: patch.symbol ? { ...base.symbol, ...patch.symbol } : base.symbol,
    statusLine: patch.statusLine
      ? { ...base.statusLine, ...patch.statusLine }
      : base.statusLine,
    scales: patch.scales ? { ...base.scales, ...patch.scales } : base.scales,
    canvas: patch.canvas ? { ...base.canvas, ...patch.canvas } : base.canvas,
    trading: patch.trading
      ? { ...base.trading, ...patch.trading }
      : base.trading,
    alerts: patch.alerts ? { ...base.alerts, ...patch.alerts } : base.alerts,
  };
}
