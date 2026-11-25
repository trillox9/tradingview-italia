import type {
  Candle,
  PineBacktestMetrics,
  PineDiagnostic,
  PineEquityPoint,
  PineExecutionResult,
  PineHLineOutput,
  PinePlotOutput,
  PineTrade,
} from '../types';
import {
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  calculateStdDev,
  calculateWMA,
} from './indicators';

export interface PineTemplate {
  id: string;
  name: string;
  description: string;
  isStrategy: boolean;
  code: string;
}

export const PINE_TEMPLATES: PineTemplate[] = [
  {
    id: 'ema-cross-strategy',
    name: 'Strategia Incrocio EMA 9/21',
    description: 'Entra Long su incrocio rialzista EMA 9 > EMA 21 e Short su incrocio ribassista.',
    isStrategy: true,
    code: `//@version=5
strategy("Strategia Incrocio EMA 9/21", overlay=true, initial_capital=100000)

fastLen = input.int(9, "EMA Veloce")
slowLen = input.int(21, "EMA Lenta")

emaFast = ta.ema(close, fastLen)
emaSlow = ta.ema(close, slowLen)

plot(emaFast, title="EMA Veloce", color=color.blue, linewidth=2)
plot(emaSlow, title="EMA Lenta", color=color.orange, linewidth=2)

longCond = ta.crossover(emaFast, emaSlow)
shortCond = ta.crossunder(emaFast, emaSlow)

if longCond
    strategy.entry("Long", strategy.long)

if shortCond
    strategy.entry("Short", strategy.short)`,
  },
  {
    id: 'rsi-mean-reversion',
    name: 'Strategia RSI (14) Ipervenduto/Ipercomprato',
    description: 'Acquista quando RSI(14) risale sopra 30 e vende quando scende sotto 70.',
    isStrategy: true,
    code: `//@version=5
strategy("Strategia RSI 14", overlay=false, initial_capital=100000)

len = input.int(14, "Periodo RSI")
oversold = input.int(30, "Ipervenduto")
overbought = input.int(70, "Ipercomprato")

rsiVal = ta.rsi(close, len)

plot(rsiVal, title="RSI (14)", color=color.purple, linewidth=2)
hline(70, title="Ipercomprato", color=color.red, linestyle=hline.style_dashed)
hline(50, title="Neutrale", color=color.gray, linestyle=hline.style_dotted)
hline(30, title="Ipervenduto", color=color.green, linestyle=hline.style_dashed)

if ta.crossover(rsiVal, oversold)
    strategy.entry("RSI Long", strategy.long)

if ta.crossunder(rsiVal, overbought)
    strategy.entry("RSI Short", strategy.short)`,
  },
  {
    id: 'sma-envelope-indicator',
    name: 'Indicatore Medie SMA 20/50/200',
    description: 'Sovrappone le tre medie mobili istituzionali principali sul grafico.',
    isStrategy: false,
    code: `//@version=5
indicator("Medie Istituzionali SMA", overlay=true)

sma20 = ta.sma(close, 20)
sma50 = ta.sma(close, 50)
sma200 = ta.sma(close, 200)

plot(sma20, title="SMA 20", color=color.blue, linewidth=2)
plot(sma50, title="SMA 50", color=color.orange, linewidth=2)
plot(sma200, title="SMA 200", color=color.red, linewidth=2)`,
  },
  {
    id: 'donchian-breakout',
    name: 'Strategia Breakout 20 Barre',
    description: 'Strategia trend-following su breakout dei massimi e minimi a 20 periodi.',
    isStrategy: true,
    code: `//@version=5
strategy("Breakout Canale 20", overlay=true, initial_capital=100000)

lookback = input.int(20, "Barre")
upper = ta.highest(high, lookback)
lower = ta.lowest(low, lookback)
mid = (upper + lower) / 2

plot(upper, title="Massimo 20", color=color.green, linewidth=1)
plot(mid, title="Mediana", color=color.gray, linewidth=1)
plot(lower, title="Minimo 20", color=color.red, linewidth=1)

if close > upper[1]
    strategy.entry("Breakout Long", strategy.long)

if close < lower[1]
    strategy.entry("Breakout Short", strategy.short)`,
  },
];

const NAMED_COLORS: Record<string, string> = {
  'color.blue': '#2962FF',
  'color.orange': '#FF9800',
  'color.red': '#F23645',
  'color.green': '#089981',
  'color.purple': '#7E57C2',
  'color.yellow': '#FACC15',
  'color.aqua': '#26C6DA',
  'color.teal': '#00897B',
  'color.white': '#FFFFFF',
  'color.gray': '#787B86',
  'color.silver': '#B2B5BE',
  'color.lime': '#4CAF50',
  'color.fuchsia': '#E040FB',
  'color.navy': '#1E3A8A',
};

type PineValue = number | boolean | string | (number | null)[] | boolean[];

interface PineEnv {
  candles: readonly Candle[];
  vars: Map<string, PineValue>;
  plots: PinePlotOutput[];
  hlines: PineHLineOutput[];
  diagnostics: PineDiagnostic[];
  logs: string[];
  strategyActions: Array<{
    kind: 'entry' | 'close' | 'close_all';
    id: string;
    direction?: 'long' | 'short';
    condition: boolean[];
  }>;
}

function isSeries(v: PineValue): v is (number | null)[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] !== 'boolean');
}

function isBoolSeries(v: PineValue): v is boolean[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'boolean';
}

function toNumSeries(v: PineValue, len: number): (number | null)[] {
  if (Array.isArray(v)) {
    if (v.length === 0) return new Array(len).fill(null);
    if (typeof v[0] === 'boolean') {
      return (v as boolean[]).map((b) => (b ? 1 : 0));
    }
    return v as (number | null)[];
  }
  if (typeof v === 'number') return new Array(len).fill(v);
  if (typeof v === 'boolean') return new Array(len).fill(v ? 1 : 0);
  return new Array(len).fill(null);
}

function toBoolSeries(v: PineValue, len: number): boolean[] {
  if (Array.isArray(v)) {
    if (v.length === 0) return new Array(len).fill(false);
    if (typeof v[0] === 'boolean') return v as boolean[];
    return (v as (number | null)[]).map((x) => x !== null && x !== 0);
  }
  if (typeof v === 'boolean') return new Array(len).fill(v);
  if (typeof v === 'number') return new Array(len).fill(v !== 0);
  return new Array(len).fill(false);
}

function toScalarNumber(v: PineValue, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const p = Number.parseFloat(v);
    if (Number.isFinite(p)) return p;
  }
  if (Array.isArray(v) && v.length > 0) {
    const last = v[v.length - 1];
    if (typeof last === 'number') return last;
  }
  return fallback;
}

function resolveColor(val: PineValue | undefined, fallback = '#2962FF'): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (NAMED_COLORS[trimmed]) return NAMED_COLORS[trimmed];
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  if (/^rgba?\(/i.test(trimmed)) return trimmed;
  return fallback;
}

/** Split function arguments respecting nested parentheses and quotes */
function splitArgs(raw: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let current = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote && raw[i - 1] !== '\\') {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;

    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

/** Parse positional and named (`key=value`) arguments */
function parseCallArgs(
  rawArgs: string,
  env: PineEnv,
  lineNum: number,
): { positional: PineValue[]; named: Record<string, PineValue> } {
  const positional: PineValue[] = [];
  const named: Record<string, PineValue> = {};
  const parts = splitArgs(rawArgs);

  for (const part of parts) {
    // Check for top-level `key=value` (not `==`, `!=`, `<=`, `>=`)
    let eqIdx = -1;
    let depth = 0;
    let inQuote: '"' | "'" | null = null;
    for (let i = 0; i < part.length; i++) {
      const ch = part[i];
      if (inQuote) {
        if (ch === inQuote && part[i - 1] !== '\\') inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (
        ch === '=' &&
        depth === 0 &&
        part[i + 1] !== '=' &&
        part[i - 1] !== '=' &&
        part[i - 1] !== '!' &&
        part[i - 1] !== '<' &&
        part[i - 1] !== '>'
      ) {
        eqIdx = i;
        break;
      }
    }

    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim();
      const valExpr = part.slice(eqIdx + 1).trim();
      named[key] = evaluateExpression(valExpr, env, lineNum);
    } else {
      positional.push(evaluateExpression(part, env, lineNum));
    }
  }

  return { positional, named };
}

function findTopLevelOperator(
  expr: string,
  operators: readonly string[],
  rightToLeft = false,
): { index: number; op: string } | null {
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let found: { index: number; op: string } | null = null;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQuote) {
      if (ch === inQuote && expr[i - 1] !== '\\') inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      depth--;
      continue;
    }
    if (depth !== 0) continue;

    for (const op of operators) {
      if (expr.startsWith(op, i)) {
        // Word operators (`and`, `or`) must have boundaries
        if (/^[a-z]+$/.test(op)) {
          const prev = i > 0 ? expr[i - 1] : ' ';
          const next = i + op.length < expr.length ? expr[i + op.length] : ' ';
          if (/[a-zA-Z0-9_]/.test(prev) || /[a-zA-Z0-9_]/.test(next)) continue;
        }
        // Avoid matching single `+`/`-` as binary if at start or right after another operator
        if ((op === '+' || op === '-') && i === 0) continue;
        if (op === '+' || op === '-') {
          const before = expr.slice(0, i).trimEnd();
          if (
            before.length === 0 ||
            /[+\-*/<>=!(,?]$/.test(before) ||
            /\b(and|or|not)$/.test(before)
          ) {
            continue;
          }
        }
        // Avoid matching `>` or `<` inside `>=`, `<=`
        if ((op === '>' || op === '<') && expr[i + 1] === '=') continue;
        // Avoid matching `=` inside `==`
        if (op === '==' && (expr[i - 1] === '=' || expr[i + 2] === '=')) continue;

        if (!rightToLeft) {
          found = { index: i, op }; // keep rightmost for left-associative parsing
        } else {
          return { index: i, op };
        }
        break;
      }
    }
  }
  return found;
}

function stripOuterParens(expr: string): string {
  let s = expr.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let inQuote: '"' | "'" | null = null;
    let closesAtEnd = true;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuote) {
        if (ch === inQuote && s[i - 1] !== '\\') inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i < s.length - 1) {
          closesAtEnd = false;
          break;
        }
      }
    }
    if (closesAtEnd) {
      s = s.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return s;
}

function calculateHighest(values: readonly (number | null)[], period: number): (number | null)[] {
  const n = values.length;
  const p = Math.max(1, Math.floor(period));
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let maxVal = -Infinity;
    let valid = false;
    for (let j = i - p + 1; j <= i; j++) {
      const v = values[j];
      if (v !== null && Number.isFinite(v)) {
        if (v > maxVal) maxVal = v;
        valid = true;
      }
    }
    out[i] = valid ? maxVal : null;
  }
  return out;
}

function calculateLowest(values: readonly (number | null)[], period: number): (number | null)[] {
  const n = values.length;
  const p = Math.max(1, Math.floor(period));
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let minVal = Infinity;
    let valid = false;
    for (let j = i - p + 1; j <= i; j++) {
      const v = values[j];
      if (v !== null && Number.isFinite(v)) {
        if (v < minVal) minVal = v;
        valid = true;
      }
    }
    out[i] = valid ? minVal : null;
  }
  return out;
}

function evaluateCall(
  fnName: string,
  rawArgs: string,
  env: PineEnv,
  lineNum: number,
): PineValue {
  const len = env.candles.length;
  const { positional, named } = parseCallArgs(rawArgs, env, lineNum);

  switch (fnName) {
    case 'input.int':
    case 'input.float':
    case 'input':
      return positional[0] ?? named.defval ?? 0;

    case 'input.source':
      return positional[0] ?? named.defval ?? env.vars.get('close') ?? [];

    case 'ta.sma': {
      const src = toNumSeries(positional[0] ?? named.source ?? env.vars.get('close')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? named.length ?? 14, 14)));
      return calculateSMA(src, period);
    }

    case 'ta.ema': {
      const src = toNumSeries(positional[0] ?? named.source ?? env.vars.get('close')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? named.length ?? 14, 14)));
      return calculateEMA(src, period);
    }

    case 'ta.wma': {
      const src = toNumSeries(positional[0] ?? named.source ?? env.vars.get('close')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? named.length ?? 14, 14)));
      return calculateWMA(src, period);
    }

    case 'ta.rsi': {
      const src = toNumSeries(positional[0] ?? named.source ?? env.vars.get('close')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? named.length ?? 14, 14)));
      const numericSrc = src.map((v) => v ?? 0);
      return calculateRSI(numericSrc, period);
    }

    case 'ta.atr': {
      const period = Math.max(1, Math.round(toScalarNumber(positional[0] ?? named.length ?? 14, 14)));
      return calculateATR(env.candles, period);
    }

    case 'ta.stdev': {
      const src = toNumSeries(positional[0] ?? env.vars.get('close')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? 20, 20)));
      return calculateStdDev(src, period);
    }

    case 'ta.highest': {
      const src = toNumSeries(positional[0] ?? env.vars.get('high')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? 14, 14)));
      return calculateHighest(src, period);
    }

    case 'ta.lowest': {
      const src = toNumSeries(positional[0] ?? env.vars.get('low')!, len);
      const period = Math.max(1, Math.round(toScalarNumber(positional[1] ?? 14, 14)));
      return calculateLowest(src, period);
    }

    case 'ta.crossover': {
      const a = toNumSeries(positional[0] ?? 0, len);
      const b = toNumSeries(positional[1] ?? 0, len);
      const out: boolean[] = new Array(len).fill(false);
      for (let i = 1; i < len; i++) {
        const a0 = a[i - 1];
        const b0 = b[i - 1];
        const a1 = a[i];
        const b1 = b[i];
        if (a0 !== null && b0 !== null && a1 !== null && b1 !== null) {
          out[i] = a0 <= b0 && a1 > b1;
        }
      }
      return out;
    }

    case 'ta.crossunder': {
      const a = toNumSeries(positional[0] ?? 0, len);
      const b = toNumSeries(positional[1] ?? 0, len);
      const out: boolean[] = new Array(len).fill(false);
      for (let i = 1; i < len; i++) {
        const a0 = a[i - 1];
        const b0 = b[i - 1];
        const a1 = a[i];
        const b1 = b[i];
        if (a0 !== null && b0 !== null && a1 !== null && b1 !== null) {
          out[i] = a0 >= b0 && a1 < b1;
        }
      }
      return out;
    }

    case 'math.abs':
    case 'math.sqrt':
    case 'math.round': {
      const v = positional[0] ?? 0;
      const fn =
        fnName === 'math.abs'
          ? Math.abs
          : fnName === 'math.sqrt'
            ? (x: number) => (x >= 0 ? Math.sqrt(x) : Number.NaN)
            : Math.round;
      if (typeof v === 'number') return fn(v);
      return toNumSeries(v, len).map((x) => (x === null ? null : fn(x)));
    }

    case 'math.max':
    case 'math.min': {
      const a = positional[0] ?? 0;
      const b = positional[1] ?? 0;
      const cmp = fnName === 'math.max' ? Math.max : Math.min;
      if (typeof a === 'number' && typeof b === 'number') return cmp(a, b);
      const sa = toNumSeries(a, len);
      const sb = toNumSeries(b, len);
      return sa.map((va, i) =>
        va !== null && sb[i] !== null ? cmp(va, sb[i] as number) : null,
      );
    }

    case 'color.new': {
      return resolveColor(positional[0], '#2962FF');
    }

    default:
      env.diagnostics.push({
        line: lineNum,
        severity: 'warning',
        message: `Funzione non riconosciuta: ${fnName}`,
      });
      return 0;
  }
}

/** Recursive safe expression evaluator (no eval/Function) */
function evaluateExpression(
  rawExpr: string,
  env: PineEnv,
  lineNum: number,
): PineValue {
  const expr = stripOuterParens(rawExpr);
  const len = env.candles.length;

  if (!expr) return 0;

  // String literal
  if (
    (expr.startsWith('"') && expr.endsWith('"')) ||
    (expr.startsWith("'") && expr.endsWith("'"))
  ) {
    return expr.slice(1, -1);
  }

  // Boolean / color / strategy constants
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (expr === 'na') return new Array(len).fill(null);
  if (expr in NAMED_COLORS) return NAMED_COLORS[expr];
  if (expr === 'strategy.long') return 'long';
  if (expr === 'strategy.short') return 'short';
  if (expr === 'hline.style_dashed') return 'dashed';
  if (expr === 'hline.style_dotted') return 'dotted';
  if (expr === 'hline.style_solid') return 'solid';

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return Number.parseFloat(expr);
  }

  // Ternary operator: `cond ? a : b`
  const qMatch = findTopLevelOperator(expr, ['?'], true);
  if (qMatch) {
    const rest = expr.slice(qMatch.index + 1);
    const colonMatch = findTopLevelOperator(rest, [':'], true);
    if (colonMatch) {
      const cond = toBoolSeries(
        evaluateExpression(expr.slice(0, qMatch.index), env, lineNum),
        len,
      );
      const truthy = toNumSeries(
        evaluateExpression(rest.slice(0, colonMatch.index), env, lineNum),
        len,
      );
      const falsy = toNumSeries(
        evaluateExpression(rest.slice(colonMatch.index + 1), env, lineNum),
        len,
      );
      return cond.map((c, i) => (c ? truthy[i] : falsy[i]));
    }
  }

  // Logical OR
  const orMatch = findTopLevelOperator(expr, ['or']);
  if (orMatch) {
    const l = toBoolSeries(evaluateExpression(expr.slice(0, orMatch.index), env, lineNum), len);
    const r = toBoolSeries(evaluateExpression(expr.slice(orMatch.index + 2), env, lineNum), len);
    return l.map((lv, i) => lv || r[i]);
  }

  // Logical AND
  const andMatch = findTopLevelOperator(expr, ['and']);
  if (andMatch) {
    const l = toBoolSeries(evaluateExpression(expr.slice(0, andMatch.index), env, lineNum), len);
    const r = toBoolSeries(evaluateExpression(expr.slice(andMatch.index + 3), env, lineNum), len);
    return l.map((lv, i) => lv && r[i]);
  }

  // Comparisons
  const cmpMatch = findTopLevelOperator(expr, ['>=', '<=', '==', '!=', '>', '<']);
  if (cmpMatch) {
    const leftVal = evaluateExpression(expr.slice(0, cmpMatch.index), env, lineNum);
    const rightVal = evaluateExpression(
      expr.slice(cmpMatch.index + cmpMatch.op.length),
      env,
      lineNum,
    );
    const l = toNumSeries(leftVal, len);
    const r = toNumSeries(rightVal, len);
    return l.map((lv, i) => {
      const rv = r[i];
      if (lv === null || rv === null) return false;
      switch (cmpMatch.op) {
        case '>':
          return lv > rv;
        case '<':
          return lv < rv;
        case '>=':
          return lv >= rv;
        case '<=':
          return lv <= rv;
        case '==':
          return lv === rv;
        case '!=':
          return lv !== rv;
        default:
          return false;
      }
    });
  }

  // Additive (`+`, `-`)
  const addMatch = findTopLevelOperator(expr, ['+', '-']);
  if (addMatch) {
    const leftVal = evaluateExpression(expr.slice(0, addMatch.index), env, lineNum);
    const rightVal = evaluateExpression(expr.slice(addMatch.index + 1), env, lineNum);
    if (typeof leftVal === 'number' && typeof rightVal === 'number') {
      return addMatch.op === '+' ? leftVal + rightVal : leftVal - rightVal;
    }
    const l = toNumSeries(leftVal, len);
    const r = toNumSeries(rightVal, len);
    return l.map((lv, i) => {
      const rv = r[i];
      if (lv === null || rv === null) return null;
      return addMatch.op === '+' ? lv + rv : lv - rv;
    });
  }

  // Multiplicative (`*`, `/`)
  const mulMatch = findTopLevelOperator(expr, ['*', '/']);
  if (mulMatch) {
    const leftVal = evaluateExpression(expr.slice(0, mulMatch.index), env, lineNum);
    const rightVal = evaluateExpression(expr.slice(mulMatch.index + 1), env, lineNum);
    if (typeof leftVal === 'number' && typeof rightVal === 'number') {
      return mulMatch.op === '*'
        ? leftVal * rightVal
        : rightVal !== 0
          ? leftVal / rightVal
          : 0;
    }
    const l = toNumSeries(leftVal, len);
    const r = toNumSeries(rightVal, len);
    return l.map((lv, i) => {
      const rv = r[i];
      if (lv === null || rv === null) return null;
      if (mulMatch.op === '*') return lv * rv;
      return rv !== 0 ? lv / rv : null;
    });
  }

  // Unary `not` or `-`
  if (expr.startsWith('not ')) {
    const inner = toBoolSeries(evaluateExpression(expr.slice(4), env, lineNum), len);
    return inner.map((b) => !b);
  }
  if (expr.startsWith('-')) {
    const inner = evaluateExpression(expr.slice(1), env, lineNum);
    if (typeof inner === 'number') return -inner;
    return toNumSeries(inner, len).map((v) => (v === null ? null : -v));
  }

  // Historical lookback indexing: `series[offset]`
  const indexMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/.exec(expr);
  if (indexMatch) {
    const varName = indexMatch[1];
    const offset = Number.parseInt(indexMatch[2], 10);
    const base = env.vars.get(varName);
    if (base !== undefined) {
      if (isBoolSeries(base)) {
        return base.map((_, i) => (i >= offset ? base[i - offset] : false));
      }
      const series = toNumSeries(base, len);
      return series.map((_, i) => (i >= offset ? series[i - offset] : null));
    }
  }

  // Function call: `namespace.fn(...)` or `fn(...)`
  const callMatch = /^([a-zA-Z_][a-zA-Z0-9_.]*)\s*\((.*)\)$/.exec(expr);
  if (callMatch) {
    return evaluateCall(callMatch[1], callMatch[2], env, lineNum);
  }

  // Variable lookup
  if (env.vars.has(expr)) {
    return env.vars.get(expr)!;
  }

  env.diagnostics.push({
    line: lineNum,
    severity: 'warning',
    message: `Identificatore non definito: "${expr}"`,
  });
  return 0;
}

function runBacktest(
  candles: readonly Candle[],
  actions: PineEnv['strategyActions'],
  initialCapital: number,
): PineBacktestMetrics {
  const n = candles.length;
  let cash = initialCapital;
  let positionSide: 'long' | 'short' | null = null;
  let positionQty = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let entryBar = 0;
  let entryId = '';

  const trades: PineTrade[] = [];
  const equityCurve: PineEquityPoint[] = [];
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  const closeCurrentPosition = (barIdx: number, exitPrice: number) => {
    if (!positionSide || positionQty <= 0) return;
    const pnl =
      positionSide === 'long'
        ? (exitPrice - entryPrice) * positionQty
        : (entryPrice - exitPrice) * positionQty;
    const entryNotional = entryPrice * positionQty;
    const pnlPercent = entryNotional > 0 ? (pnl / entryNotional) * 100 : 0;
    cash += pnl;

    trades.push({
      id: trades.length + 1,
      entryId,
      side: positionSide,
      entryTime,
      entryPrice,
      exitTime: candles[barIdx].time,
      exitPrice,
      quantity: positionQty,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      barsHeld: Math.max(1, barIdx - entryBar),
    });

    positionSide = null;
    positionQty = 0;
    entryPrice = 0;
  };

  for (let i = 0; i < n; i++) {
    const c = candles[i];

    for (const act of actions) {
      if (!act.condition[i]) continue;
      if (act.kind === 'close_all') {
        closeCurrentPosition(i, c.close);
      } else if (act.kind === 'close') {
        if (positionSide && (!act.id || act.id === entryId)) {
          closeCurrentPosition(i, c.close);
        }
      } else if (act.kind === 'entry' && act.direction) {
        if (positionSide === act.direction) continue;
        // Close opposite position if flipping
        if (positionSide && positionSide !== act.direction) {
          closeCurrentPosition(i, c.close);
        }
        // Allocate 95% of current equity per trade for clean realistic sizing
        const alloc = Math.max(0, cash * 0.95);
        if (alloc > 0 && c.close > 0) {
          positionSide = act.direction;
          positionQty = alloc / c.close;
          entryPrice = c.close;
          entryTime = c.time;
          entryBar = i;
          entryId = act.id || (act.direction === 'long' ? 'Long' : 'Short');
        }
      }
    }

    const unrealized =
      positionSide === 'long'
        ? (c.close - entryPrice) * positionQty
        : positionSide === 'short'
          ? (entryPrice - c.close) * positionQty
          : 0;
    const equity = cash + unrealized;
    if (equity > peakEquity) peakEquity = equity;
    const dd = Math.max(0, peakEquity - equity);
    const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    equityCurve.push({
      time: c.time,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(dd * 100) / 100,
      drawdownPercent: Math.round(ddPct * 100) / 100,
    });
  }

  // Mark-to-market close any open position on the last bar so final stats reflect realized + open
  if (n > 0 && positionSide) {
    closeCurrentPosition(n - 1, candles[n - 1].close);
  }

  const finalEquity = Math.round(cash * 100) / 100;
  const netProfit = Math.round((finalEquity - initialCapital) * 100) / 100;
  const netProfitPercent =
    initialCapital > 0
      ? Math.round((netProfit / initialCapital) * 10000) / 100
      : 0;

  let winningTrades = 0;
  let losingTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalBars = 0;

  for (const t of trades) {
    totalBars += t.barsHeld;
    if (t.pnl >= 0) {
      winningTrades++;
      grossProfit += t.pnl;
    } else {
      losingTrades++;
      grossLoss += Math.abs(t.pnl);
    }
  }

  const totalTrades = trades.length;
  const winRatePercent =
    totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 10000) / 100 : 0;
  const profitFactor =
    grossLoss > 0
      ? Math.round((grossProfit / grossLoss) * 100) / 100
      : grossProfit > 0
        ? 99.99
        : 0;
  const avgTradePnl =
    totalTrades > 0 ? Math.round((netProfit / totalTrades) * 100) / 100 : 0;
  const avgBarsInTrade =
    totalTrades > 0 ? Math.round((totalBars / totalTrades) * 10) / 10 : 0;

  // Approximate annualized Sharpe ratio from equity curve returns
  let sharpeRatio = 0;
  if (equityCurve.length > 2) {
    const rets: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      if (prev > 0) rets.push((equityCurve[i].equity - prev) / prev);
    }
    if (rets.length > 1) {
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance =
        rets.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / rets.length;
      const std = Math.sqrt(variance);
      if (std > 1e-9) {
        sharpeRatio = Math.round((mean / std) * Math.sqrt(252) * 100) / 100;
      }
    }
  }

  return {
    initialCapital,
    finalEquity,
    netProfit,
    netProfitPercent,
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePercent,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    avgTradePnl,
    avgBarsInTrade,
    sharpeRatio,
    trades,
    equityCurve,
  };
}

/**
 * Evaluates a lightweight Pine Script v5 script against OHLCV candles,
 * producing chart plots, horizontal lines, diagnostics, and full strategy backtest metrics.
 */
export function evaluatePineScript(
  code: string,
  candles: readonly Candle[],
): PineExecutionResult {
  const len = candles.length;
  const vars = new Map<string, PineValue>();
  vars.set('open', candles.map((c) => c.open));
  vars.set('high', candles.map((c) => c.high));
  vars.set('low', candles.map((c) => c.low));
  vars.set('close', candles.map((c) => c.close));
  vars.set('volume', candles.map((c) => c.volume));
  vars.set('hl2', candles.map((c) => (c.high + c.low) / 2));
  vars.set('hlc3', candles.map((c) => (c.high + c.low + c.close) / 3));
  vars.set('ohlc4', candles.map((c) => (c.open + c.high + c.low + c.close) / 4));
  vars.set('bar_index', candles.map((_, i) => i));

  const env: PineEnv = {
    candles,
    vars,
    plots: [],
    hlines: [],
    diagnostics: [],
    logs: [],
    strategyActions: [],
  };

  let scriptName = 'Script Pine Senza Titolo';
  let isStrategy = false;
  let overlay = true;
  let initialCapital = 100_000;

  const rawLines = code.split(/\r?\n/);
  let activeIfCondition: boolean[] | null = null;
  let activeIfIndent = -1;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNum = idx + 1;
    const raw = rawLines[idx];

    // Strip `//` comments outside quotes
    let inQuote: '"' | "'" | null = null;
    let stripped = raw;
    for (let i = 0; i < raw.length - 1; i++) {
      const ch = raw[i];
      if (inQuote) {
        if (ch === inQuote && raw[i - 1] !== '\\') inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === '/' && raw[i + 1] === '/') {
        stripped = raw.slice(0, i);
        break;
      }
    }

    const indent = stripped.search(/\S/);
    const line = stripped.trim();
    if (!line) continue;

    // Exit active `if` block when indentation returns to same or lower level
    if (activeIfCondition !== null && indent <= activeIfIndent) {
      activeIfCondition = null;
      activeIfIndent = -1;
    }

    // Header declaration: indicator(...) or strategy(...)
    const headerMatch = /^(indicator|strategy)\s*\((.*)\)$/.exec(line);
    if (headerMatch) {
      isStrategy = headerMatch[1] === 'strategy';
      const parsed = parseCallArgs(headerMatch[2], env, lineNum);
      if (typeof parsed.positional[0] === 'string') {
        scriptName = parsed.positional[0];
      } else if (typeof parsed.named.title === 'string') {
        scriptName = parsed.named.title;
      }
      if (typeof parsed.named.overlay === 'boolean') {
        overlay = parsed.named.overlay;
      }
      if (parsed.named.initial_capital !== undefined) {
        initialCapital = Math.max(100, toScalarNumber(parsed.named.initial_capital, 100_000));
      }
      continue;
    }

    // `if <cond>` block opener
    if (line.startsWith('if ') || line.startsWith('if(')) {
      const condExpr = line.slice(2).trim();
      const condVal = evaluateExpression(condExpr, env, lineNum);
      activeIfCondition = toBoolSeries(condVal, len);
      activeIfIndent = indent;
      continue;
    }

    // `plot(...)`
    const plotMatch = /^plot\s*\((.*)\)$/.exec(line);
    if (plotMatch) {
      const parsed = parseCallArgs(plotMatch[1], env, lineNum);
      const series = toNumSeries(parsed.positional[0] ?? parsed.named.series ?? 0, len);
      const title =
        typeof parsed.named.title === 'string'
          ? parsed.named.title
          : typeof parsed.positional[1] === 'string'
            ? parsed.positional[1]
            : `Plot ${env.plots.length + 1}`;
      const color = resolveColor(parsed.named.color ?? parsed.positional[2], '#2962FF');
      const lineWidth = Math.max(
        1,
        Math.min(5, toScalarNumber(parsed.named.linewidth ?? 2, 2)),
      );
      env.plots.push({
        id: `pine-plot-${env.plots.length + 1}`,
        title,
        color,
        lineWidth,
        pane: overlay ? 'overlay' : 'separate',
        data: candles.map((c, i) => ({ time: c.time, value: series[i] ?? null })),
      });
      continue;
    }

    // `hline(...)`
    const hlineMatch = /^hline\s*\((.*)\)$/.exec(line);
    if (hlineMatch) {
      const parsed = parseCallArgs(hlineMatch[1], env, lineNum);
      const value = toScalarNumber(parsed.positional[0] ?? parsed.named.price ?? 0, 0);
      const title =
        typeof parsed.named.title === 'string'
          ? parsed.named.title
          : typeof parsed.positional[1] === 'string'
            ? parsed.positional[1]
            : `${value}`;
      const color = resolveColor(parsed.named.color ?? parsed.positional[2], '#787B86');
      const styleRaw = parsed.named.linestyle;
      const lineStyle =
        styleRaw === 'solid' || styleRaw === 'dashed' || styleRaw === 'dotted'
          ? styleRaw
          : 'dashed';
      env.hlines.push({ value, title, color, lineStyle });
      continue;
    }

    // `strategy.entry(...)`
    const entryMatch = /^strategy\.entry\s*\((.*)\)$/.exec(line);
    if (entryMatch) {
      isStrategy = true;
      const parsed = parseCallArgs(entryMatch[1], env, lineNum);
      const entryId =
        typeof parsed.positional[0] === 'string'
          ? parsed.positional[0]
          : typeof parsed.named.id === 'string'
            ? parsed.named.id
            : 'Entry';
      const dirRaw = parsed.positional[1] ?? parsed.named.direction;
      const direction: 'long' | 'short' = dirRaw === 'short' ? 'short' : 'long';
      const whenCond =
        parsed.named.when !== undefined
          ? toBoolSeries(parsed.named.when, len)
          : activeIfCondition ?? new Array(len).fill(true);

      env.strategyActions.push({
        kind: 'entry',
        id: entryId,
        direction,
        condition: whenCond,
      });
      continue;
    }

    // `strategy.close(...)` / `strategy.close_all()`
    const closeMatch = /^strategy\.(close|close_all)\s*\((.*)\)$/.exec(line);
    if (closeMatch) {
      isStrategy = true;
      const parsed = parseCallArgs(closeMatch[2], env, lineNum);
      const targetId =
        typeof parsed.positional[0] === 'string'
          ? parsed.positional[0]
          : typeof parsed.named.id === 'string'
            ? parsed.named.id
            : '';
      const whenCond =
        parsed.named.when !== undefined
          ? toBoolSeries(parsed.named.when, len)
          : activeIfCondition ?? new Array(len).fill(true);
      env.strategyActions.push({
        kind: closeMatch[1] === 'close_all' ? 'close_all' : 'close',
        id: targetId,
        condition: whenCond,
      });
      continue;
    }

    // Variable assignment: `foo = expr` or `var foo = expr` or `foo := expr`
    const assignMatch = /^(?:var\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*:?=\s*(.+)$/.exec(line);
    if (assignMatch) {
      const varName = assignMatch[1];
      const rhs = assignMatch[2];
      const val = evaluateExpression(rhs, env, lineNum);
      env.vars.set(varName, isSeries(val) || isBoolSeries(val) ? val : val);
      continue;
    }

    env.diagnostics.push({
      line: lineNum,
      severity: 'error',
      message: `Sintassi Pine non supportata: "${line}"`,
    });
  }

  const hasErrors = env.diagnostics.some((d) => d.severity === 'error');
  const backtest =
    isStrategy && !hasErrors
      ? runBacktest(candles, env.strategyActions, initialCapital)
      : null;

  env.logs.push(
    `Compilazione completata: "${scriptName}" (${env.plots.length} serie, ${env.hlines.length} linee orizzontali${backtest ? `, ${backtest.totalTrades} operazioni` : ''}).`,
  );

  return {
    ok: !hasErrors,
    scriptName,
    isStrategy,
    overlay,
    plots: env.plots,
    hlines: env.hlines,
    backtest,
    diagnostics: env.diagnostics,
    logs: env.logs,
  };
}
