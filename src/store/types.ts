import type {
  AlertRule,
  AlertTriggerEvent,
  Candle,
  CanonicalDrawingToolType,
  ChartScaleMode,
  ChartSettings,
  ChartSettingsPatch,
  ChartType,
  DataSourceKind,
  DrawingObject,
  DrawingToolType,
  IndicatorConfig,
  IndicatorSeries,
  PaperAccountState,
  PineExecutionResult,
  PriceScalePosition,
  QuoteTick,
  SymbolInfo,
  TechnicalSummary,
  Timeframe,
  WatchlistGroup,
} from '../types';
import type { CreateAlertRuleParams, PlaceOrderRequest } from '../engine';
import type { AppRoute, AppView } from './router';

export type ThemeMode = 'dark' | 'light';
export type LayoutMode = '1' | '2h' | '2v' | '4';
export type ScaleMode = ChartScaleMode;
export type RangePreset =
  | '1D'
  | '5D'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | '5Y'
  | 'ALL';
export type MagnetMode = 'off' | 'weak' | 'strong';
export type HideMode = 'none' | 'drawings' | 'indicators' | 'positions' | 'all';

export type RightPanelTab =
  | 'watchlist'
  | 'alerts'
  | 'data'
  | 'objectTree'
  | null;

export type BottomPanelTab =
  | 'screener'
  | 'pine'
  | 'strategy'
  | 'trading'
  | 'log'
  | null;

export type ModalName =
  | 'symbolSearch'
  | 'indicators'
  | 'compare'
  | 'alert'
  | 'settings'
  | 'shortcuts'
  | 'snapshot';

export type ModalState = Record<ModalName, boolean>;

export interface ChartPaneState {
  id: string;
  /** Canonical symbol ticker (e.g. "FTSEMIB", "RACE", "BTCUSDT") */
  symbolId: string;
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: IndicatorConfig[];
  compareSymbols: string[];
  scaleMode: ScaleMode;
  autoScale: boolean;
  invertScale: boolean;
  lockPriceToBarRatio: boolean;
  priceScalePosition: PriceScalePosition;
  showVolume: boolean;
  showGrid: boolean;
  showBuySellButtons: boolean;
  countdownVisible: boolean;
  rangePreset: RangePreset;
}

export interface SavedChartLayout {
  id: string;
  name: string;
  updatedAt: number;
  layoutMode: LayoutMode;
  activePaneIndex: number;
  panes: ChartPaneState[];
  chartSettings: ChartSettings;
  drawingsBySymbol: Record<string, DrawingObject[]>;
  pineCode: string;
  pineAppliedToChart: boolean;
}

export interface ReplayState {
  active: boolean;
  /** Inclusive 0-based index of the last revealed candle bar */
  barIndex: number;
  playing: boolean;
  speedMs: number;
}

export interface DrawingSymbolHistory {
  past: DrawingObject[][];
  future: DrawingObject[][];
}

export type ActivityCategory =
  | 'order'
  | 'alert'
  | 'pine'
  | 'symbol'
  | 'drawing'
  | 'system';

export type ActivityLevel = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  category: ActivityCategory;
  level: ActivityLevel;
  title: string;
  detail?: string;
  symbol?: string;
}

export interface QuotesContextValue {
  quotes: Record<string, QuoteTick>;
  liveCryptoEnabled: boolean;
  setLiveCryptoEnabled: (enabled: boolean) => void;
  getQuote: (ticker: string) => QuoteTick | undefined;
}

export interface TradingViewStateContextValue {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Authentic 6-tab Supercharts settings
  chartSettings: ChartSettings;
  updateChartSettings: (patch: ChartSettingsPatch) => void;
  resetChartSettings: () => void;

  // Named Chart Layouts & Salva / Auto-Save Engine
  savedLayouts: SavedChartLayout[];
  activeLayoutId: string;
  activeLayoutName: string;
  autoSave: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  saveCurrentLayout: () => void;
  setAutoSave: (enabled: boolean) => void;
  renameActiveLayout: (name: string) => void;
  duplicateActiveLayout: (name?: string) => void;
  loadSavedLayout: (id: string) => void;
  deleteSavedLayout: (id: string) => void;
  createNewLayout: (name?: string) => void;
  exportLayoutJson: () => string;
  importLayoutJson: (json: string) => { ok: boolean; error?: string };

  // Indicator Settings Modal State
  editingIndicatorId: string | null;
  openIndicatorSettings: (indicatorId: string) => void;
  closeIndicatorSettings: () => void;

  // Routing
  route: AppRoute;
  navigate: (view: AppView, symbolId?: string) => void;
  openSymbolInChart: (symbolId: string) => void;

  // Multi-chart panes & active series
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  activePaneIndex: number;
  setActivePaneIndex: (index: number) => void;
  panes: ChartPaneState[];
  activePane: ChartPaneState;
  activeSymbol: SymbolInfo;
  candles: Candle[];
  displayedCandles: Candle[];
  paneDataSources: Record<number, DataSourceKind>;
  paneLoading: Record<number, boolean>;
  dataSource: DataSourceKind;
  isLoadingCandles: boolean;
  indicatorSeries: IndicatorSeries[];
  technicalSummary: TechnicalSummary;
  updatePane: (
    paneIndex: number,
    updater:
      | Partial<ChartPaneState>
      | ((prev: ChartPaneState) => ChartPaneState),
  ) => void;
  updateActivePane: (
    updater:
      | Partial<ChartPaneState>
      | ((prev: ChartPaneState) => ChartPaneState),
  ) => void;
  setSymbol: (symbolId: string, paneIndex?: number) => void;
  setTimeframe: (timeframe: Timeframe, paneIndex?: number) => void;
  setChartType: (chartType: ChartType, paneIndex?: number) => void;
  addIndicator: (config: IndicatorConfig, paneIndex?: number) => void;
  updateIndicator: (
    indicatorId: string,
    patch: Partial<IndicatorConfig>,
    paneIndex?: number,
  ) => void;
  removeIndicator: (indicatorId: string, paneIndex?: number) => void;
  clearIndicators: (paneIndex?: number) => void;
  clearAllObjects: (paneIndex?: number) => void;
  toggleIndicatorVisibility: (indicatorId: string, paneIndex?: number) => void;
  addCompareSymbol: (ticker: string, paneIndex?: number) => void;
  removeCompareSymbol: (ticker: string, paneIndex?: number) => void;
  setScaleMode: (mode: ScaleMode, paneIndex?: number) => void;
  toggleAutoScale: (paneIndex?: number) => void;
  toggleInvertScale: (paneIndex?: number) => void;
  toggleLockPriceToBarRatio: (paneIndex?: number) => void;
  setPriceScalePosition: (position: PriceScalePosition, paneIndex?: number) => void;
  setRangePreset: (preset: RangePreset, paneIndex?: number) => void;

  // Bar Replay
  replay: ReplayState;
  startReplay: (barIndex?: number) => void;
  stepReplay: (delta?: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  toggleReplayPlay: () => void;
  setReplaySpeed: (speedMs: number) => void;
  setReplayBarIndex: (barIndex: number) => void;
  exitReplay: () => void;

  // Drawings & Pro Drawing Management
  drawingsBySymbol: Record<string, DrawingObject[]>;
  activeDrawings: DrawingObject[];
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;
  favoriteTools: CanonicalDrawingToolType[];
  toggleFavoriteTool: (tool: DrawingToolType) => void;
  showFavoritesBar: boolean;
  setShowFavoritesBar: (visible: boolean) => void;
  toggleFavoritesBar: () => void;
  magnetMode: MagnetMode;
  setMagnetMode: (mode: MagnetMode) => void;
  stayInDrawingMode: boolean;
  setStayInDrawingMode: (stay: boolean) => void;
  lockDrawings: boolean;
  setLockDrawings: (locked: boolean) => void;
  hideMode: HideMode;
  setHideMode: (mode: HideMode) => void;
  hideDrawings: boolean;
  setHideDrawings: (hidden: boolean) => void;
  selectedDrawingId: string | null;
  setSelectedDrawingId: (id: string | null) => void;
  selectedDrawingSettingsId: string | null;
  selectedDrawingSettingsOpen: boolean;
  openDrawingSettings: (id: string) => void;
  closeDrawingSettings: () => void;
  canUndoDrawing: boolean;
  canRedoDrawing: boolean;
  addDrawing: (drawing: DrawingObject) => void;
  updateDrawing: (
    symbol: string,
    drawingId: string,
    patch: Partial<DrawingObject>,
  ) => void;
  deleteDrawing: (symbol: string, drawingId: string) => void;
  cloneDrawing: (id: string, symbol?: string) => DrawingObject | null;
  bringToFront: (id: string, symbol?: string) => void;
  sendToBack: (id: string, symbol?: string) => void;
  clearDrawings: (symbol?: string) => void;
  undoDrawing: (symbol?: string) => void;
  redoDrawing: (symbol?: string) => void;

  // Watchlists
  watchlists: WatchlistGroup[];
  activeWatchlistId: string;
  activeWatchlist: WatchlistGroup;
  setActiveWatchlistId: (id: string) => void;
  addSymbolToWatchlist: (ticker: string, watchlistId?: string) => void;
  removeSymbolFromWatchlist: (ticker: string, watchlistId?: string) => void;
  createWatchlist: (name: string, symbols?: string[]) => WatchlistGroup;
  deleteWatchlist: (watchlistId: string) => void;

  // Alerts
  alerts: AlertRule[];
  triggeredToasts: AlertTriggerEvent[];
  alertLog: AlertTriggerEvent[];
  createAlert: (params: CreateAlertRuleParams) => AlertRule;
  toggleAlert: (alertId: string) => void;
  deleteAlert: (alertId: string) => void;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;

  // Paper Trading
  paperAccount: PaperAccountState;
  placeOrder: (request: PlaceOrderRequest, marketPriceOverride?: number) => void;
  closePosition: (symbol: string, marketPriceOverride?: number) => void;
  cancelOrder: (orderId: string) => void;
  resetAccount: (initialBalance?: number) => void;

  // Pine Editor & Strategy Tester
  pineCode: string;
  setPineCode: (code: string) => void;
  pineResult: PineExecutionResult | null;
  pineAppliedToChart: boolean;
  runPineScript: (codeOverride?: string) => PineExecutionResult;
  applyPineToChart: (codeOverride?: string) => PineExecutionResult;
  clearPineFromChart: () => void;
  loadPineTemplate: (templateId: string) => void;

  // Workspace UI panels & modals
  rightPanel: RightPanelTab;
  setRightPanel: (panel: RightPanelTab) => void;
  toggleRightPanel: (panel: Exclude<RightPanelTab, null>) => void;
  bottomPanel: BottomPanelTab;
  setBottomPanel: (panel: BottomPanelTab) => void;
  toggleBottomPanel: (panel: Exclude<BottomPanelTab, null>) => void;
  bottomPanelExpanded: boolean;
  setBottomPanelExpanded: (expanded: boolean) => void;
  toggleBottomPanelExpanded: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;
  modals: ModalState;
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  toggleModal: (name: ModalName) => void;
  closeAllModals: () => void;

  // Global Activity Log (Registro)
  activityLog: ActivityLogEntry[];
  appendLog: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  clearActivityLog: () => void;
}

export type TradingViewContextValue = TradingViewStateContextValue &
  QuotesContextValue;
