import type {
  OrderSide,
  OrderType,
  PaperAccountState,
  PaperOrder,
  PaperPosition,
} from '../types';

export const DEFAULT_PAPER_INITIAL_BALANCE = 100_000;
export const PAPER_MARGIN_RATE = 0.2; // 5x paper buying power (allows trading BTC/indices comfortably)
export const PAPER_TRADING_STORAGE_KEY = 'tv_it_paper_account_v1';

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  /** Optional commission rate (e.g. 0.0005 for 5 bps; default 0) */
  commissionRate?: number;
}

export type PaperTradingAction =
  | {
      type: 'PLACE_ORDER';
      request: PlaceOrderRequest;
      marketPrice: number;
      nowMs?: number;
    }
  | {
      type: 'MARK_TO_MARKET';
      prices: Record<string, number> | Map<string, number>;
      nowMs?: number;
    }
  | {
      type: 'CLOSE_POSITION';
      symbol: string;
      marketPrice: number;
      nowMs?: number;
    }
  | {
      type: 'CANCEL_ORDER';
      orderId: string;
      nowMs?: number;
    }
  | {
      type: 'RESET';
      initialBalance?: number;
      currency?: string;
    };

let orderCounter = 1;
function nextId(prefix: string, nowMs: number): string {
  orderCounter += 1;
  return `${prefix}-${nowMs}-${orderCounter}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createInitialPaperAccount(
  initialBalance = DEFAULT_PAPER_INITIAL_BALANCE,
  currency = 'EUR',
): PaperAccountState {
  return {
    initialBalance,
    balance: initialBalance,
    equity: initialBalance,
    realizedPnl: 0,
    unrealizedPnl: 0,
    marginUsed: 0,
    freeMargin: initialBalance,
    currency,
    positions: [],
    orders: [],
    history: [],
  };
}

function recomputeAccountTotals(state: PaperAccountState): PaperAccountState {
  let unrealizedPnl = 0;
  let marginUsed = 0;

  const updatedPositions = state.positions.map((pos) => {
    const rawPnl =
      pos.side === 'long'
        ? (pos.currentPrice - pos.avgEntryPrice) * pos.quantity
        : (pos.avgEntryPrice - pos.currentPrice) * pos.quantity;
    const costBasis = pos.avgEntryPrice * pos.quantity;
    const pnlPct = costBasis > 0 ? (rawPnl / costBasis) * 100 : 0;
    const marketValue = pos.currentPrice * pos.quantity;

    unrealizedPnl += rawPnl;
    marginUsed += marketValue * PAPER_MARGIN_RATE;

    return {
      ...pos,
      unrealizedPnl: round2(rawPnl),
      unrealizedPnlPercent: round2(pnlPct),
      marketValue: round2(marketValue),
    };
  });

  const equity = round2(state.balance + unrealizedPnl);
  const roundedMargin = round2(marginUsed);

  return {
    ...state,
    balance: round2(state.balance),
    realizedPnl: round2(state.realizedPnl),
    unrealizedPnl: round2(unrealizedPnl),
    equity,
    marginUsed: roundedMargin,
    freeMargin: round2(Math.max(0, equity - roundedMargin)),
    positions: updatedPositions,
  };
}

function shouldTriggerPendingOrder(order: PaperOrder, marketPrice: number): boolean {
  if (order.type === 'limit' && order.limitPrice !== undefined) {
    return order.side === 'buy'
      ? marketPrice <= order.limitPrice
      : marketPrice >= order.limitPrice;
  }
  if (order.type === 'stop' && order.stopPrice !== undefined) {
    return order.side === 'buy'
      ? marketPrice >= order.stopPrice
      : marketPrice <= order.stopPrice;
  }
  return false;
}

function executeFill(
  state: PaperAccountState,
  order: PaperOrder,
  fillPrice: number,
  nowMs: number,
  commissionRate = 0,
): PaperAccountState {
  const symbol = order.symbol.toUpperCase();
  const commission = round2(Math.abs(fillPrice * order.quantity * commissionRate));
  const incomingSide: 'long' | 'short' = order.side === 'buy' ? 'long' : 'short';

  const existingIdx = state.positions.findIndex((p) => p.symbol === symbol);
  const nextPositions = [...state.positions];
  let balance = state.balance - commission;
  let realizedPnlTotal = state.realizedPnl - commission;
  let orderRealizedPnl: number | undefined;

  if (existingIdx === -1) {
    // Open brand new position
    const newPos: PaperPosition = {
      id: nextId('pos', nowMs),
      symbol,
      side: incomingSide,
      quantity: order.quantity,
      avgEntryPrice: fillPrice,
      currentPrice: fillPrice,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      marketValue: round2(fillPrice * order.quantity),
      takeProfit: order.takeProfit,
      stopLoss: order.stopLoss,
      openedAt: nowMs,
    };
    nextPositions.push(newPos);
  } else {
    const existing = nextPositions[existingIdx];

    if (existing.side === incomingSide) {
      // Scale into existing position with weighted average entry price
      const totalQty = existing.quantity + order.quantity;
      const weightedEntry =
        (existing.avgEntryPrice * existing.quantity + fillPrice * order.quantity) /
        totalQty;
      nextPositions[existingIdx] = {
        ...existing,
        quantity: totalQty,
        avgEntryPrice: weightedEntry,
        currentPrice: fillPrice,
        takeProfit: order.takeProfit ?? existing.takeProfit,
        stopLoss: order.stopLoss ?? existing.stopLoss,
      };
    } else {
      // Opposite side: partially reduce, fully close, or flip position
      const closingQty = Math.min(existing.quantity, order.quantity);
      const rawRealized =
        existing.side === 'long'
          ? (fillPrice - existing.avgEntryPrice) * closingQty
          : (existing.avgEntryPrice - fillPrice) * closingQty;

      balance += rawRealized;
      realizedPnlTotal += rawRealized;
      orderRealizedPnl = round2(rawRealized - commission);

      const remainingQty = order.quantity - existing.quantity;
      if (Math.abs(remainingQty) < 1e-10) {
        // Closed completely
        nextPositions.splice(existingIdx, 1);
      } else if (remainingQty < 0) {
        // Reduced existing position
        nextPositions[existingIdx] = {
          ...existing,
          quantity: existing.quantity - order.quantity,
          currentPrice: fillPrice,
        };
      } else {
        // Flipped into opposite side with remaining quantity
        nextPositions[existingIdx] = {
          id: nextId('pos', nowMs),
          symbol,
          side: incomingSide,
          quantity: remainingQty,
          avgEntryPrice: fillPrice,
          currentPrice: fillPrice,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          marketValue: round2(fillPrice * remainingQty),
          takeProfit: order.takeProfit,
          stopLoss: order.stopLoss,
          openedAt: nowMs,
        };
      }
    }
  }

  const filledOrder: PaperOrder = {
    ...order,
    symbol,
    status: 'filled',
    filledPrice: fillPrice,
    filledAt: nowMs,
    commission,
    realizedPnl: orderRealizedPnl,
  };

  return recomputeAccountTotals({
    ...state,
    balance,
    realizedPnl: realizedPnlTotal,
    positions: nextPositions,
    history: [filledOrder, ...state.history],
  });
}

/**
 * Places a Market, Limit, or Stop order on the Paper Trading account.
 */
export function placePaperOrder(
  state: PaperAccountState,
  request: PlaceOrderRequest,
  currentMarketPrice: number,
  nowMs = Date.now(),
): PaperAccountState {
  const symbol = request.symbol.trim().toUpperCase();
  const baseOrder: PaperOrder = {
    id: nextId('ord', nowMs),
    symbol,
    side: request.side,
    type: request.type,
    quantity: request.quantity,
    limitPrice: request.limitPrice,
    stopPrice: request.stopPrice,
    takeProfit: request.takeProfit,
    stopLoss: request.stopLoss,
    status: 'open',
    createdAt: nowMs,
    commission: 0,
  };

  // Validate inputs
  if (!symbol || !Number.isFinite(request.quantity) || request.quantity <= 0) {
    return {
      ...state,
      history: [
        { ...baseOrder, status: 'rejected', rejectReason: 'Quantità non valida' },
        ...state.history,
      ],
    };
  }
  if (!Number.isFinite(currentMarketPrice) || currentMarketPrice <= 0) {
    return {
      ...state,
      history: [
        { ...baseOrder, status: 'rejected', rejectReason: 'Prezzo di mercato non disponibile' },
        ...state.history,
      ],
    };
  }
  if (request.type === 'limit' && (!request.limitPrice || request.limitPrice <= 0)) {
    return {
      ...state,
      history: [
        { ...baseOrder, status: 'rejected', rejectReason: 'Prezzo limite obbligatorio' },
        ...state.history,
      ],
    };
  }
  if (request.type === 'stop' && (!request.stopPrice || request.stopPrice <= 0)) {
    return {
      ...state,
      history: [
        { ...baseOrder, status: 'rejected', rejectReason: 'Prezzo stop obbligatorio' },
        ...state.history,
      ],
    };
  }

  // Check buying power unless order purely reduces an existing opposite position
  const existingPos = state.positions.find((p) => p.symbol === symbol);
  const incomingSide = request.side === 'buy' ? 'long' : 'short';
  const isPurelyReducing =
    existingPos !== undefined &&
    existingPos.side !== incomingSide &&
    request.quantity <= existingPos.quantity;

  const refPrice =
    request.type === 'limit'
      ? (request.limitPrice as number)
      : request.type === 'stop'
        ? (request.stopPrice as number)
        : currentMarketPrice;
  const requiredMargin = refPrice * request.quantity * PAPER_MARGIN_RATE;

  if (!isPurelyReducing && requiredMargin > state.freeMargin) {
    return {
      ...state,
      history: [
        {
          ...baseOrder,
          status: 'rejected',
          rejectReason: 'Margine disponibile insufficiente',
        },
        ...state.history,
      ],
    };
  }

  // Market orders execute immediately
  if (request.type === 'market') {
    return executeFill(
      state,
      baseOrder,
      currentMarketPrice,
      nowMs,
      request.commissionRate ?? 0,
    );
  }

  // Limit / Stop orders execute immediately if already marketable, otherwise rest in open orders
  if (shouldTriggerPendingOrder(baseOrder, currentMarketPrice)) {
    const execPrice =
      request.type === 'limit' ? currentMarketPrice : currentMarketPrice;
    return executeFill(
      state,
      baseOrder,
      execPrice,
      nowMs,
      request.commissionRate ?? 0,
    );
  }

  return {
    ...state,
    orders: [baseOrder, ...state.orders],
  };
}

function lookupPrice(
  prices: Record<string, number> | Map<string, number>,
  symbol: string,
): number | undefined {
  if (prices instanceof Map) {
    return prices.get(symbol) ?? prices.get(symbol.toUpperCase());
  }
  return prices[symbol] ?? prices[symbol.toUpperCase()];
}

/**
 * Updates live P&L on all positions, executes any triggered Limit/Stop orders,
 * and triggers Take-Profit / Stop-Loss brackets automatically.
 */
export function markToMarket(
  state: PaperAccountState,
  prices: Record<string, number> | Map<string, number>,
  nowMs = Date.now(),
): PaperAccountState {
  let nextState = state;

  // 1. Check pending limit/stop orders
  if (nextState.orders.length > 0) {
    const remainingOrders: PaperOrder[] = [];
    const triggeredOrders: Array<{ order: PaperOrder; price: number }> = [];

    for (const order of nextState.orders) {
      const mktPrice = lookupPrice(prices, order.symbol);
      if (
        mktPrice !== undefined &&
        Number.isFinite(mktPrice) &&
        mktPrice > 0 &&
        shouldTriggerPendingOrder(order, mktPrice)
      ) {
        triggeredOrders.push({ order, price: mktPrice });
      } else {
        remainingOrders.push(order);
      }
    }

    if (triggeredOrders.length > 0) {
      nextState = { ...nextState, orders: remainingOrders };
      for (const item of triggeredOrders) {
        nextState = executeFill(nextState, item.order, item.price, nowMs, 0);
      }
    }
  }

  // 2. Check Take-Profit / Stop-Loss brackets on open positions
  const bracketClosures: Array<{ symbol: string; price: number }> = [];
  for (const pos of nextState.positions) {
    const mktPrice = lookupPrice(prices, pos.symbol);
    if (mktPrice === undefined || !Number.isFinite(mktPrice) || mktPrice <= 0) {
      continue;
    }
    const hitTP =
      pos.takeProfit !== undefined &&
      (pos.side === 'long' ? mktPrice >= pos.takeProfit : mktPrice <= pos.takeProfit);
    const hitSL =
      pos.stopLoss !== undefined &&
      (pos.side === 'long' ? mktPrice <= pos.stopLoss : mktPrice >= pos.stopLoss);
    if (hitTP || hitSL) {
      bracketClosures.push({ symbol: pos.symbol, price: mktPrice });
    }
  }

  for (const closure of bracketClosures) {
    nextState = closePaperPosition(nextState, closure.symbol, closure.price, nowMs);
  }

  // 3. Update live prices on remaining open positions
  const updatedPositions = nextState.positions.map((pos) => {
    const mktPrice = lookupPrice(prices, pos.symbol);
    if (mktPrice === undefined || !Number.isFinite(mktPrice) || mktPrice <= 0) {
      return pos;
    }
    return { ...pos, currentPrice: mktPrice };
  });

  return recomputeAccountTotals({
    ...nextState,
    positions: updatedPositions,
  });
}

/** Closes the full open position for `symbol` at `currentPrice` */
export function closePaperPosition(
  state: PaperAccountState,
  symbol: string,
  currentPrice: number,
  nowMs = Date.now(),
): PaperAccountState {
  const sym = symbol.trim().toUpperCase();
  const pos = state.positions.find((p) => p.symbol === sym);
  if (!pos) return state;

  const closingSide: OrderSide = pos.side === 'long' ? 'sell' : 'buy';
  return placePaperOrder(
    state,
    {
      symbol: sym,
      side: closingSide,
      type: 'market',
      quantity: pos.quantity,
    },
    currentPrice,
    nowMs,
  );
}

/** Cancels a pending Limit/Stop order */
export function cancelPaperOrder(
  state: PaperAccountState,
  orderId: string,
): PaperAccountState {
  const idx = state.orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return state;
  const cancelled: PaperOrder = {
    ...state.orders[idx],
    status: 'cancelled',
  };
  const nextOrders = state.orders.filter((o) => o.id !== orderId);
  return {
    ...state,
    orders: nextOrders,
    history: [cancelled, ...state.history],
  };
}

/** Resets the Paper Trading account to fresh initial balance */
export function resetPaperAccount(
  initialBalance = DEFAULT_PAPER_INITIAL_BALANCE,
  currency = 'EUR',
): PaperAccountState {
  return createInitialPaperAccount(initialBalance, currency);
}

/** Pure Redux/useReducer-compatible reducer */
export function paperTradingReducer(
  state: PaperAccountState,
  action: PaperTradingAction,
): PaperAccountState {
  switch (action.type) {
    case 'PLACE_ORDER':
      return placePaperOrder(state, action.request, action.marketPrice, action.nowMs);
    case 'MARK_TO_MARKET':
      return markToMarket(state, action.prices, action.nowMs);
    case 'CLOSE_POSITION':
      return closePaperPosition(state, action.symbol, action.marketPrice, action.nowMs);
    case 'CANCEL_ORDER':
      return cancelPaperOrder(state, action.orderId);
    case 'RESET':
      return resetPaperAccount(action.initialBalance, action.currency);
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

/** Loads persisted Paper Trading state from localStorage safely */
export function loadPaperAccount(storage?: StorageLike): PaperAccountState {
  const store = resolveStorage(storage);
  if (!store) return createInitialPaperAccount();
  try {
    const raw = store.getItem(PAPER_TRADING_STORAGE_KEY);
    if (!raw) return createInitialPaperAccount();
    const parsed = JSON.parse(raw) as Partial<PaperAccountState>;
    if (
      typeof parsed.balance !== 'number' ||
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.orders) ||
      !Array.isArray(parsed.history)
    ) {
      return createInitialPaperAccount();
    }
    return recomputeAccountTotals({
      ...createInitialPaperAccount(parsed.initialBalance ?? DEFAULT_PAPER_INITIAL_BALANCE),
      ...parsed,
    } as PaperAccountState);
  } catch {
    return createInitialPaperAccount();
  }
}

/** Saves Paper Trading state to localStorage safely */
export function savePaperAccount(
  state: PaperAccountState,
  storage?: StorageLike,
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(PAPER_TRADING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
