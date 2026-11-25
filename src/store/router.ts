import { getSymbolById, getSymbolByTicker } from '../data';

export type AppView =
  | 'home'
  | 'chart'
  | 'markets'
  | 'screener'
  | 'heatmap'
  | 'calendar'
  | 'community';

export interface AppRoute {
  view: AppView;
  /** Canonical ticker or qualified symbol ID when view === 'chart' */
  symbolId?: string;
}

const VALID_VIEWS = new Set<AppView>([
  'home',
  'chart',
  'markets',
  'screener',
  'heatmap',
  'calendar',
  'community',
]);

function normalizeSymbolSegment(raw?: string): string | undefined {
  if (!raw) return undefined;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw if malformed URI encoding
  }
  if (!decoded) return undefined;
  const resolved = getSymbolById(decoded) ?? getSymbolByTicker(decoded);
  return resolved ? resolved.ticker : decoded.toUpperCase();
}

/**
 * Parses a URL hash (e.g. `#/chart/FTSEMIB`, `#/chart/MIL:RACE`, `#/screener`, `#/`)
 * or path string into a typed `AppRoute`.
 */
export function parseRoute(hashOrPath?: string): AppRoute {
  const source =
    hashOrPath !== undefined
      ? hashOrPath
      : typeof window !== 'undefined'
        ? window.location.hash || window.location.pathname
        : '#/';

  const cleaned = source
    .replace(/^#/, '')
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!cleaned || cleaned === 'home') {
    return { view: 'home' };
  }

  const [first, ...rest] = cleaned.split('/');
  const viewCandidate = first.toLowerCase() as AppView;

  if (!VALID_VIEWS.has(viewCandidate)) {
    return { view: 'home' };
  }

  if (viewCandidate === 'chart') {
    const rawSymbol = rest.join('/');
    const symbolId = normalizeSymbolSegment(rawSymbol);
    return symbolId ? { view: 'chart', symbolId } : { view: 'chart' };
  }

  return { view: viewCandidate };
}

/**
 * Formats a typed view + optional symbolId into a canonical URL hash string.
 */
export function buildRouteHash(view: AppView, symbolId?: string): string {
  if (view === 'home') return '#/';
  if (view === 'chart') {
    const normalized = normalizeSymbolSegment(symbolId);
    if (!normalized) return '#/chart';
    // Preserve ':' and '!' cleanly for readable TradingView-style hashes like #/chart/MIL:RACE or #/chart/GC1!
    const safeSegment = encodeURIComponent(normalized)
      .replace(/%3A/gi, ':')
      .replace(/%21/gi, '!');
    return `#/chart/${safeSegment}`;
  }
  return `#/${view}`;
}

/**
 * Navigates to the given view (updating `window.location.hash` when in a browser)
 * and returns the resulting `AppRoute`.
 */
export function navigateTo(view: AppView, symbolId?: string): AppRoute {
  const normalizedSymbol =
    view === 'chart' ? normalizeSymbolSegment(symbolId) : undefined;
  const hash = buildRouteHash(view, normalizedSymbol);

  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }

  return normalizedSymbol ? { view, symbolId: normalizedSymbol } : { view };
}

/**
 * Subscribes to browser hash/history route changes.
 */
export function subscribeRoute(listener: (route: AppRoute) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const onChange = () => {
    listener(parseRoute());
  };
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}
