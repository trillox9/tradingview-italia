import type {
  AlertCondition,
  AlertRule,
  AlertTarget,
  AlertTriggerEvent,
  Candle,
} from '../types';
import {
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from './indicators';
import type { StorageLike } from './paperTrading';

export const ALERTS_STORAGE_KEY = 'tv_it_alerts_v1';

export const ALERT_CONDITION_LABELS_IT: Record<AlertCondition, string> = {
  crosses_above: 'Incrocio verso l’alto',
  crosses_below: 'Incrocio verso il basso',
  greater_than: 'Maggiore di',
  less_than: 'Minore di',
  entering_channel: 'Entrata nel canale',
  exiting_channel: 'Uscita dal canale',
  percent_up: 'Salita % superiore a',
  percent_down: 'Discesa % superiore a',
};

export const ALERT_TARGET_LABELS_IT: Record<AlertTarget, string> = {
  price: 'Prezzo',
  rsi: 'RSI (14)',
  sma: 'SMA (20)',
  ema: 'EMA (20)',
  macd: 'MACD',
};

export interface CreateAlertRuleParams {
  symbol: string;
  condition: AlertCondition;
  value: number;
  upperValue?: number;
  target?: AlertTarget;
  targetPeriod?: number;
  name?: string;
  message?: string;
  triggerOnce?: boolean;
  nowMs?: number;
}

let alertSeq = 1;

export function createAlertRule(params: CreateAlertRuleParams): AlertRule {
  const nowMs = params.nowMs ?? Date.now();
  const symbol = params.symbol.trim().toUpperCase();
  const target = params.target ?? 'price';
  const condLabel = ALERT_CONDITION_LABELS_IT[params.condition];
  const targetLabel = ALERT_TARGET_LABELS_IT[target];
  alertSeq += 1;

  return {
    id: `alert-${nowMs}-${alertSeq}`,
    name: params.name?.trim() || `${symbol} ${targetLabel} ${condLabel} ${params.value}`,
    symbol,
    target,
    targetPeriod: params.targetPeriod,
    condition: params.condition,
    value: params.value,
    upperValue: params.upperValue,
    triggerOnce: params.triggerOnce ?? true,
    status: 'active',
    message:
      params.message?.trim() ||
      `Alert attivato su ${symbol}: ${targetLabel} ${condLabel.toLowerCase()} ${params.value}`,
    createdAt: nowMs,
    triggerCount: 0,
  };
}

export interface AlertEvaluationContext {
  symbol: string;
  prevPrice: number;
  currentPrice: number;
  /** Optional candles for indicator-based alerts (RSI, SMA, EMA, MACD) */
  candles?: readonly Candle[];
  nowMs?: number;
}

export interface AlertEvaluationOutput {
  rules: AlertRule[];
  triggered: AlertTriggerEvent[];
}

function resolveTargetValues(
  rule: AlertRule,
  ctx: AlertEvaluationContext,
): { prev: number; current: number } | null {
  if (rule.target === 'price') {
    return { prev: ctx.prevPrice, current: ctx.currentPrice };
  }

  const candles = ctx.candles;
  if (!candles || candles.length < 2) return null;

  const closes = candles.map((c) => c.close);
  let series: (number | null)[] = [];

  switch (rule.target) {
    case 'rsi':
      series = calculateRSI(closes, rule.targetPeriod ?? 14);
      break;
    case 'sma':
      series = calculateSMA(closes, rule.targetPeriod ?? 20);
      break;
    case 'ema':
      series = calculateEMA(closes, rule.targetPeriod ?? 20);
      break;
    case 'macd':
      series = calculateMACD(closes).macd;
      break;
  }

  const current = series[series.length - 1];
  const prev = series[series.length - 2];
  if (current === null || prev === null) return null;
  return { prev, current };
}

function matchesCondition(
  rule: AlertRule,
  prev: number,
  current: number,
): boolean {
  switch (rule.condition) {
    case 'crosses_above':
      return prev <= rule.value && current > rule.value;
    case 'crosses_below':
      return prev >= rule.value && current < rule.value;
    case 'greater_than':
      return current > rule.value;
    case 'less_than':
      return current < rule.value;
    case 'entering_channel': {
      const low = Math.min(rule.value, rule.upperValue ?? rule.value);
      const high = Math.max(rule.value, rule.upperValue ?? rule.value);
      const wasInside = prev >= low && prev <= high;
      const isInside = current >= low && current <= high;
      return !wasInside && isInside;
    }
    case 'exiting_channel': {
      const low = Math.min(rule.value, rule.upperValue ?? rule.value);
      const high = Math.max(rule.value, rule.upperValue ?? rule.value);
      const wasInside = prev >= low && prev <= high;
      const isInside = current >= low && current <= high;
      return wasInside && !isInside;
    }
    case 'percent_up': {
      if (prev <= 0) return false;
      const pct = ((current - prev) / prev) * 100;
      return pct >= Math.abs(rule.value);
    }
    case 'percent_down': {
      if (prev <= 0) return false;
      const pct = ((current - prev) / prev) * 100;
      return pct <= -Math.abs(rule.value);
    }
  }
}

/**
 * Pure alert evaluator: checks active alerts matching `ctx.symbol`,
 * returning updated rules and any newly triggered events.
 */
export function evaluateAlerts(
  rules: readonly AlertRule[],
  ctx: AlertEvaluationContext,
): AlertEvaluationOutput {
  const sym = ctx.symbol.trim().toUpperCase();
  const nowMs = ctx.nowMs ?? Date.now();
  const triggered: AlertTriggerEvent[] = [];

  const nextRules = rules.map((rule) => {
    if (rule.status !== 'active' || rule.symbol !== sym) {
      return rule;
    }

    const vals = resolveTargetValues(rule, ctx);
    if (!vals) return rule;

    if (!matchesCondition(rule, vals.prev, vals.current)) {
      return rule;
    }

    alertSeq += 1;
    triggered.push({
      id: `trig-${nowMs}-${alertSeq}`,
      alertId: rule.id,
      alertName: rule.name,
      symbol: rule.symbol,
      target: rule.target,
      condition: rule.condition,
      triggeredValue: vals.current,
      thresholdValue: rule.value,
      message: rule.message,
      triggeredAt: nowMs,
    });

    return {
      ...rule,
      status: rule.triggerOnce ? ('triggered' as const) : ('active' as const),
      lastTriggeredAt: nowMs,
      triggerCount: rule.triggerCount + 1,
    };
  });

  return { rules: nextRules, triggered };
}

export function loadAlerts(storage?: StorageLike): AlertRule[] {
  const store =
    storage ??
    (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? globalThis.localStorage
      : null);
  if (!store) return [];
  try {
    const raw = store.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertRule[]) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(rules: readonly AlertRule[], storage?: StorageLike): boolean {
  const store =
    storage ??
    (typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? globalThis.localStorage
      : null);
  if (!store) return false;
  try {
    store.setItem(ALERTS_STORAGE_KEY, JSON.stringify(rules));
    return true;
  } catch {
    return false;
  }
}
