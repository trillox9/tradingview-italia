import type { LineStyle } from './indicators';
import type { Timeframe } from './market';

export type DrawingToolGroup =
  | 'cursors'
  | 'trend_lines'
  | 'gann_fib'
  | 'patterns'
  | 'projection'
  | 'shapes'
  | 'annotations'
  | 'utilities';

export type CursorToolType = 'crosshair' | 'dot' | 'arrow_cursor' | 'eraser';

export type TrendLineToolType =
  | 'trendline'
  | 'ray'
  | 'info_line'
  | 'extended_line'
  | 'trend_angle'
  | 'hline'
  | 'hray'
  | 'vline'
  | 'cross_line'
  | 'channel'
  | 'flat_channel'
  | 'disjoint_channel'
  | 'regression_trend'
  | 'pitchfork'
  | 'schiff_pitchfork';

export type GannFibToolType =
  | 'fib_retracement'
  | 'fib_extension'
  | 'fib_channel'
  | 'fib_time_zone'
  | 'fib_speed_fan'
  | 'fib_circles'
  | 'gann_box'
  | 'gann_fan';

export type PatternToolType =
  | 'xabcd_pattern'
  | 'cypher_pattern'
  | 'head_shoulders'
  | 'elliott_impulse'
  | 'elliott_correction'
  | 'cyclic_lines'
  | 'bars_pattern';

export type ProjectionToolType =
  | 'long_position'
  | 'short_position'
  | 'forecast'
  | 'price_range'
  | 'date_range'
  | 'date_price_range'
  | 'volume_profile_fixed';

export type ShapeToolType =
  | 'brush'
  | 'highlighter'
  | 'arrow_marker'
  | 'arrow_line'
  | 'rectangle'
  | 'rotated_rectangle'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'curve'
  | 'arc';

export type AnnotationToolType =
  | 'text'
  | 'anchored_text'
  | 'note'
  | 'price_note'
  | 'callout'
  | 'price_label'
  | 'flag_mark'
  | 'arrow_up'
  | 'arrow_down';

export type UtilityToolType = 'measure' | 'zoom_box';

export type CanonicalDrawingToolType =
  | CursorToolType
  | TrendLineToolType
  | GannFibToolType
  | PatternToolType
  | ProjectionToolType
  | ShapeToolType
  | AnnotationToolType
  | UtilityToolType;

/** Legacy camelCase aliases preserved for seamless backwards compatibility & persisted localStorage drawings */
export type LegacyDrawingToolAlias =
  | 'cursor'
  | 'extendedLine'
  | 'horizontalLine'
  | 'verticalLine'
  | 'parallelChannel'
  | 'fibRetracement'
  | 'longPosition'
  | 'shortPosition'
  | 'arrow';

export type DrawingToolType = CanonicalDrawingToolType | LegacyDrawingToolAlias;

export type PersistableDrawingType = Exclude<
  DrawingToolType,
  'cursor' | 'crosshair' | 'dot' | 'arrow_cursor' | 'eraser' | 'zoom_box'
>;

export type CanonicalPersistableDrawingType = Exclude<
  CanonicalDrawingToolType,
  CursorToolType | 'zoom_box'
>;

export type DrawingPointCount = 1 | 2 | 3 | 4 | 5 | 6 | 'freehand' | 'multi';

export interface DrawingToolMeta {
  id: CanonicalDrawingToolType;
  group: DrawingToolGroup;
  labelIt: string;
  shortcut?: string;
  pointCount: DrawingPointCount;
  defaultColor: string;
  defaultFillColor?: string;
  defaultLineWidth: number;
  defaultLineStyle: LineStyle;
}

const LEGACY_TOOL_MAP: Record<LegacyDrawingToolAlias, CanonicalDrawingToolType> = {
  cursor: 'arrow_cursor',
  extendedLine: 'extended_line',
  horizontalLine: 'hline',
  verticalLine: 'vline',
  parallelChannel: 'channel',
  fibRetracement: 'fib_retracement',
  longPosition: 'long_position',
  shortPosition: 'short_position',
  arrow: 'arrow_line',
};

export function normalizeDrawingTool(
  tool: DrawingToolType,
): CanonicalDrawingToolType {
  if (tool in LEGACY_TOOL_MAP) {
    return LEGACY_TOOL_MAP[tool as LegacyDrawingToolAlias];
  }
  return tool as CanonicalDrawingToolType;
}

export function isCursorOrUtilityTool(tool: DrawingToolType): boolean {
  const norm = normalizeDrawingTool(tool);
  return (
    norm === 'crosshair' ||
    norm === 'dot' ||
    norm === 'arrow_cursor' ||
    norm === 'eraser' ||
    norm === 'zoom_box'
  );
}

/** Single source of truth for all 64 TradingView Left-Toolbar tools */
export const DRAWING_TOOL_REGISTRY: Record<
  CanonicalDrawingToolType,
  DrawingToolMeta
> = {
  // ---- Group 1: Cursori (4) ----
  crosshair: {
    id: 'crosshair',
    group: 'cursors',
    labelIt: 'Croce',
    shortcut: 'Esc',
    pointCount: 1,
    defaultColor: '#8C8C8C',
    defaultLineWidth: 1,
    defaultLineStyle: 'dashed',
  },
  dot: {
    id: 'dot',
    group: 'cursors',
    labelIt: 'Punto',
    pointCount: 1,
    defaultColor: '#8C8C8C',
    defaultLineWidth: 1,
    defaultLineStyle: 'solid',
  },
  arrow_cursor: {
    id: 'arrow_cursor',
    group: 'cursors',
    labelIt: 'Freccia',
    pointCount: 1,
    defaultColor: '#8C8C8C',
    defaultLineWidth: 1,
    defaultLineStyle: 'solid',
  },
  eraser: {
    id: 'eraser',
    group: 'cursors',
    labelIt: 'Cancellino',
    pointCount: 1,
    defaultColor: '#F23645',
    defaultLineWidth: 1,
    defaultLineStyle: 'solid',
  },

  // ---- Group 2: Strumenti analisi trend (15) ----
  trendline: {
    id: 'trendline',
    group: 'trend_lines',
    labelIt: 'Trendline',
    shortcut: 'Alt+T',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  ray: {
    id: 'ray',
    group: 'trend_lines',
    labelIt: 'Raggio',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  info_line: {
    id: 'info_line',
    group: 'trend_lines',
    labelIt: 'Infolinea',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  extended_line: {
    id: 'extended_line',
    group: 'trend_lines',
    labelIt: 'Linea estesa',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  trend_angle: {
    id: 'trend_angle',
    group: 'trend_lines',
    labelIt: 'Angolo di trend',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  hline: {
    id: 'hline',
    group: 'trend_lines',
    labelIt: 'Linea orizzontale',
    shortcut: 'Alt+H',
    pointCount: 1,
    defaultColor: '#2962FF',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  hray: {
    id: 'hray',
    group: 'trend_lines',
    labelIt: 'Raggio orizzontale',
    shortcut: 'Alt+J',
    pointCount: 1,
    defaultColor: '#2962FF',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  vline: {
    id: 'vline',
    group: 'trend_lines',
    labelIt: 'Linea verticale',
    shortcut: 'Alt+V',
    pointCount: 1,
    defaultColor: '#2962FF',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  cross_line: {
    id: 'cross_line',
    group: 'trend_lines',
    labelIt: 'Linea trasversale',
    shortcut: 'Alt+C',
    pointCount: 1,
    defaultColor: '#2962FF',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'dashed',
  },
  channel: {
    id: 'channel',
    group: 'trend_lines',
    labelIt: 'Canale parallelo',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.14)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  flat_channel: {
    id: 'flat_channel',
    group: 'trend_lines',
    labelIt: 'Canale piatto sopra/sotto',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.14)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  disjoint_channel: {
    id: 'disjoint_channel',
    group: 'trend_lines',
    labelIt: 'Canale disgiunto',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.14)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  regression_trend: {
    id: 'regression_trend',
    group: 'trend_lines',
    labelIt: 'Trend di regressione',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.12)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },

  // ---- Group 3: Strumenti di Gann e Fibonacci (8) ----
  fib_retracement: {
    id: 'fib_retracement',
    group: 'gann_fib',
    labelIt: 'Ritracciamento Fib',
    shortcut: 'Alt+F',
    pointCount: 2,
    defaultColor: '#787B86',
    defaultFillColor: 'rgba(41, 98, 255, 0.08)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  fib_extension: {
    id: 'fib_extension',
    group: 'gann_fib',
    labelIt: 'Estensione di Fibonacci basata sul trend',
    pointCount: 3,
    defaultColor: '#FF9800',
    defaultFillColor: 'rgba(255, 152, 0, 0.08)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  fib_channel: {
    id: 'fib_channel',
    group: 'gann_fib',
    labelIt: 'Canale di Fibonacci',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.08)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  fib_time_zone: {
    id: 'fib_time_zone',
    group: 'gann_fib',
    labelIt: 'Zone temporali di Fibonacci',
    pointCount: 2,
    defaultColor: '#7E57C2',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'dashed',
  },
  fib_speed_fan: {
    id: 'fib_speed_fan',
    group: 'gann_fib',
    labelIt: 'Ventaglio resistenza/velocità Fib',
    pointCount: 2,
    defaultColor: '#26C6DA',
    defaultFillColor: 'rgba(38, 198, 218, 0.08)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  fib_circles: {
    id: 'fib_circles',
    group: 'gann_fib',
    labelIt: 'Cerchi di Fibonacci',
    pointCount: 2,
    defaultColor: '#AB47BC',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  gann_box: {
    id: 'gann_box',
    group: 'gann_fib',
    labelIt: 'Scatola di Gann',
    pointCount: 2,
    defaultColor: '#FF9800',
    defaultFillColor: 'rgba(255, 152, 0, 0.08)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  gann_fan: {
    id: 'gann_fan',
    group: 'gann_fib',
    labelIt: 'Ventaglio di Gann',
    pointCount: 2,
    defaultColor: '#089981',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  pitchfork: {
    id: 'pitchfork',
    group: 'trend_lines',
    labelIt: 'Pitchfork',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.10)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  schiff_pitchfork: {
    id: 'schiff_pitchfork',
    group: 'trend_lines',
    labelIt: 'Pitchfork di Schiff',
    pointCount: 3,
    defaultColor: '#7E57C2',
    defaultFillColor: 'rgba(126, 87, 194, 0.10)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },

  // ---- Group 4: Pattern (7) ----
  xabcd_pattern: {
    id: 'xabcd_pattern',
    group: 'patterns',
    labelIt: 'Pattern XABCD',
    pointCount: 5,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.18)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  cypher_pattern: {
    id: 'cypher_pattern',
    group: 'patterns',
    labelIt: 'Pattern Cypher',
    pointCount: 5,
    defaultColor: '#7E57C2',
    defaultFillColor: 'rgba(126, 87, 194, 0.18)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  head_shoulders: {
    id: 'head_shoulders',
    group: 'patterns',
    labelIt: 'Testa e spalle',
    pointCount: 6,
    defaultColor: '#089981',
    defaultFillColor: 'rgba(8, 153, 129, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  elliott_impulse: {
    id: 'elliott_impulse',
    group: 'patterns',
    labelIt: 'Onda impulsiva di Elliott (12345)',
    pointCount: 6,
    defaultColor: '#2962FF',
    defaultLineWidth: 1.8,
    defaultLineStyle: 'solid',
  },
  elliott_correction: {
    id: 'elliott_correction',
    group: 'patterns',
    labelIt: 'Onda correttiva di Elliott (ABC)',
    pointCount: 4,
    defaultColor: '#FF9800',
    defaultLineWidth: 1.8,
    defaultLineStyle: 'solid',
  },
  cyclic_lines: {
    id: 'cyclic_lines',
    group: 'patterns',
    labelIt: 'Linee cicliche',
    pointCount: 2,
    defaultColor: '#26C6DA',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'dashed',
  },
  bars_pattern: {
    id: 'bars_pattern',
    group: 'patterns',
    labelIt: 'Pattern di barre',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.14)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },

  // ---- Group 5: Previsione e misurazione (7) ----
  long_position: {
    id: 'long_position',
    group: 'projection',
    labelIt: 'Posizione long',
    pointCount: 1,
    defaultColor: '#089981',
    defaultFillColor: 'rgba(8, 153, 129, 0.22)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  short_position: {
    id: 'short_position',
    group: 'projection',
    labelIt: 'Posizione short',
    pointCount: 1,
    defaultColor: '#F23645',
    defaultFillColor: 'rgba(242, 54, 69, 0.22)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  forecast: {
    id: 'forecast',
    group: 'projection',
    labelIt: 'Previsione',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'dashed',
  },
  price_range: {
    id: 'price_range',
    group: 'projection',
    labelIt: 'Intervallo di prezzi',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  date_range: {
    id: 'date_range',
    group: 'projection',
    labelIt: 'Intervallo di date',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  date_price_range: {
    id: 'date_price_range',
    group: 'projection',
    labelIt: 'Intervallo date e prezzi',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  volume_profile_fixed: {
    id: 'volume_profile_fixed',
    group: 'projection',
    labelIt: 'Profilo volume intervallo fisso',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.28)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },

  // ---- Group 6: Forme geometriche (12) ----
  brush: {
    id: 'brush',
    group: 'shapes',
    labelIt: 'Pennello',
    pointCount: 'freehand',
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  highlighter: {
    id: 'highlighter',
    group: 'shapes',
    labelIt: 'Evidenziatore',
    pointCount: 'freehand',
    defaultColor: 'rgba(255, 193, 7, 0.55)',
    defaultLineWidth: 14,
    defaultLineStyle: 'solid',
  },
  arrow_marker: {
    id: 'arrow_marker',
    group: 'shapes',
    labelIt: 'Marcatore freccia',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 3,
    defaultLineStyle: 'solid',
  },
  arrow_line: {
    id: 'arrow_line',
    group: 'shapes',
    labelIt: 'Freccia',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  rectangle: {
    id: 'rectangle',
    group: 'shapes',
    labelIt: 'Rettangolo',
    shortcut: 'Alt+Shift+R',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  rotated_rectangle: {
    id: 'rotated_rectangle',
    group: 'shapes',
    labelIt: 'Rettangolo ruotato',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  path: {
    id: 'path',
    group: 'shapes',
    labelIt: 'Percorso',
    pointCount: 'multi',
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  circle: {
    id: 'circle',
    group: 'shapes',
    labelIt: 'Cerchio',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  ellipse: {
    id: 'ellipse',
    group: 'shapes',
    labelIt: 'Ellisse',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  triangle: {
    id: 'triangle',
    group: 'shapes',
    labelIt: 'Triangolo',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.16)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  curve: {
    id: 'curve',
    group: 'shapes',
    labelIt: 'Curva',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  arc: {
    id: 'arc',
    group: 'shapes',
    labelIt: 'Arco',
    pointCount: 3,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.14)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },

  // ---- Group 7: Annotazioni (9) ----
  text: {
    id: 'text',
    group: 'annotations',
    labelIt: 'Testo',
    pointCount: 1,
    defaultColor: '#D1D4DC',
    defaultLineWidth: 1,
    defaultLineStyle: 'solid',
  },
  anchored_text: {
    id: 'anchored_text',
    group: 'annotations',
    labelIt: 'Testo ancorato',
    pointCount: 1,
    defaultColor: '#D1D4DC',
    defaultLineWidth: 1,
    defaultLineStyle: 'solid',
  },
  note: {
    id: 'note',
    group: 'annotations',
    labelIt: 'Nota',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.18)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  price_note: {
    id: 'price_note',
    group: 'annotations',
    labelIt: 'Nota di prezzo',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.22)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  callout: {
    id: 'callout',
    group: 'annotations',
    labelIt: 'Fumetto',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.20)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  price_label: {
    id: 'price_label',
    group: 'annotations',
    labelIt: 'Etichetta prezzo',
    pointCount: 1,
    defaultColor: '#2962FF',
    defaultFillColor: '#2962FF',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  flag_mark: {
    id: 'flag_mark',
    group: 'annotations',
    labelIt: 'Bandiera',
    pointCount: 1,
    defaultColor: '#F23645',
    defaultFillColor: '#F23645',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'solid',
  },
  arrow_up: {
    id: 'arrow_up',
    group: 'annotations',
    labelIt: 'Freccia su',
    pointCount: 1,
    defaultColor: '#089981',
    defaultFillColor: '#089981',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },
  arrow_down: {
    id: 'arrow_down',
    group: 'annotations',
    labelIt: 'Freccia giù',
    pointCount: 1,
    defaultColor: '#F23645',
    defaultFillColor: '#F23645',
    defaultLineWidth: 2,
    defaultLineStyle: 'solid',
  },

  // ---- Standalone Utilities (2) ----
  measure: {
    id: 'measure',
    group: 'utilities',
    labelIt: 'Misura',
    shortcut: 'Shift+Click',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.18)',
    defaultLineWidth: 1.5,
    defaultLineStyle: 'dashed',
  },
  zoom_box: {
    id: 'zoom_box',
    group: 'utilities',
    labelIt: 'Zoom avanti',
    pointCount: 2,
    defaultColor: '#2962FF',
    defaultFillColor: 'rgba(41, 98, 255, 0.15)',
    defaultLineWidth: 1,
    defaultLineStyle: 'dashed',
  },
};

export interface DrawingToolGroupDef {
  id: DrawingToolGroup;
  labelIt: string;
  tools: CanonicalDrawingToolType[];
}

export const DRAWING_TOOL_GROUPS: readonly DrawingToolGroupDef[] = [
  {
    id: 'cursors',
    labelIt: 'Cursori',
    tools: ['crosshair', 'dot', 'arrow_cursor', 'eraser'],
  },
  {
    id: 'trend_lines',
    labelIt: 'Strumenti analisi trend',
    tools: [
      'trendline',
      'ray',
      'info_line',
      'extended_line',
      'trend_angle',
      'hline',
      'hray',
      'vline',
      'cross_line',
      'channel',
      'flat_channel',
      'disjoint_channel',
      'regression_trend',
      'pitchfork',
      'schiff_pitchfork',
    ],
  },
  {
    id: 'gann_fib',
    labelIt: 'Strumenti di Gann e Fibonacci',
    tools: [
      'fib_retracement',
      'fib_extension',
      'fib_channel',
      'fib_time_zone',
      'fib_speed_fan',
      'fib_circles',
      'gann_box',
      'gann_fan',
    ],
  },
  {
    id: 'patterns',
    labelIt: 'Pattern',
    tools: [
      'xabcd_pattern',
      'cypher_pattern',
      'head_shoulders',
      'elliott_impulse',
      'elliott_correction',
      'cyclic_lines',
      'bars_pattern',
    ],
  },
  {
    id: 'projection',
    labelIt: 'Strumenti di previsione e misurazione',
    tools: [
      'long_position',
      'short_position',
      'forecast',
      'price_range',
      'date_range',
      'date_price_range',
      'volume_profile_fixed',
    ],
  },
  {
    id: 'shapes',
    labelIt: 'Forme geometriche',
    tools: [
      'brush',
      'highlighter',
      'arrow_marker',
      'arrow_line',
      'rectangle',
      'rotated_rectangle',
      'path',
      'circle',
      'ellipse',
      'triangle',
      'curve',
      'arc',
    ],
  },
  {
    id: 'annotations',
    labelIt: 'Annotazioni',
    tools: [
      'text',
      'anchored_text',
      'note',
      'price_note',
      'callout',
      'price_label',
      'flag_mark',
      'arrow_up',
      'arrow_down',
    ],
  },
  {
    id: 'utilities',
    labelIt: 'Utilità',
    tools: ['measure', 'zoom_box'],
  },
] as const;

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
  fontBold?: boolean;
  fontItalic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
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
  label?: string;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  zIndex?: number;
  extendLeft?: boolean;
  extendRight?: boolean;
  showMiddleLine?: boolean;
  showPriceLabels?: boolean;
  showPercentLabels?: boolean;
  showStats?: boolean;
  inverted?: boolean;
  /** Custom Fibonacci ratios for fib_retracement / fib_extension / fib_channel */
  fibLevels?: number[];
  /** Optional timeframe visibility filter (empty/undefined = visible on all timeframes) */
  visibleTimeframes?: Timeframe[];
  /** Explicit stop price for long_position / short_position */
  stopPrice?: number;
  /** Explicit target price for long_position / short_position */
  targetPrice?: number;
  /** Optional position sizing metadata */
  accountSize?: number;
  riskPercent?: number;
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

export interface LinearRegressionResult {
  startIdx: number;
  endIdx: number;
  slope: number;
  intercept: number;
  stdDev: number;
  pearsonR: number;
  midStartPrice: number;
  midEndPrice: number;
  upperStartPrice: number;
  upperEndPrice: number;
  lowerStartPrice: number;
  lowerEndPrice: number;
}

export interface TrendAngleResult {
  angleDegrees: number;
  distancePx: number;
  dx: number;
  dy: number;
}

export interface PitchforkGeometry {
  variant: 'andrews' | 'schiff';
  medianOrigin: ScreenPoint;
  medianThrough: ScreenPoint;
  upperOrigin: ScreenPoint;
  upperThrough: ScreenPoint;
  lowerOrigin: ScreenPoint;
  lowerThrough: ScreenPoint;
}

export interface FibTimeZoneLine {
  fibNumber: number;
  barIndex: number;
}

export interface GannFanRay {
  label: string;
  ratio: number;
  origin: ScreenPoint;
  through: ScreenPoint;
  color: string;
}

export interface VolumeProfileBin {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  ratioToMax: number;
  inValueArea: boolean;
}

export interface FixedRangeVolumeProfileResult {
  startIdx: number;
  endIdx: number;
  minPrice: number;
  maxPrice: number;
  totalVolume: number;
  pocPrice: number;
  pocBinIndex: number;
  vahPrice: number;
  valPrice: number;
  bins: VolumeProfileBin[];
}
