import type { Candle } from '../../types';
import { formatPercent, formatPrice, formatVolume } from '../../data';
import { useActivePane } from '../../store';

export interface DataWindowPanelProps {
  /** Optional candle hovered by the chart crosshair; defaults to latest displayed candle */
  hoveredCandle?: Candle | null;
  /** Optional bar index hovered by the chart crosshair */
  hoveredCandleIndex?: number | null;
}

export function DataWindowPanel({
  hoveredCandle,
  hoveredCandleIndex,
}: DataWindowPanelProps) {
  const { activePane, activeSymbol, displayedCandles, indicatorSeries } =
    useActivePane();

  const barIndex =
    hoveredCandleIndex !== undefined &&
    hoveredCandleIndex !== null &&
    hoveredCandleIndex >= 0 &&
    hoveredCandleIndex < displayedCandles.length
      ? hoveredCandleIndex
      : hoveredCandle
        ? displayedCandles.findIndex((c) => c.time === hoveredCandle.time)
        : displayedCandles.length - 1;

  const resolvedIndex =
    barIndex >= 0 ? barIndex : Math.max(0, displayedCandles.length - 1);
  const candle = hoveredCandle ?? displayedCandles[resolvedIndex];
  const prevCandle = resolvedIndex > 0 ? displayedCandles[resolvedIndex - 1] : null;

  const change = candle
    ? candle.close - (prevCandle ? prevCandle.close : candle.open)
    : 0;
  const baseRef = prevCandle ? prevCandle.close : candle?.open ?? 1;
  const changePct = baseRef !== 0 ? (change / baseRef) * 100 : 0;
  const isUp = change >= 0;

  const formattedDate = candle
    ? new Date(candle.time * 1000).toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Finestra dati</h3>
        <span className="tv-badge-pill is-brand">{activePane.timeframe}</span>
      </div>

      <div className="tv-panel-body">
        <div className="tv-kv-section">
          <div className="tv-kv-section-title">
            {activeSymbol.ticker} • {activeSymbol.exchange}
          </div>

          <div className="tv-kv-row">
            <span className="tv-kv-key">Data / Ora</span>
            <span className="tv-kv-val">{formattedDate}</span>
          </div>

          {candle ? (
            <>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Apertura</span>
                <span className="tv-kv-val">
                  {formatPrice(candle.open, activeSymbol.precision)}
                </span>
              </div>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Massimo</span>
                <span className="tv-kv-val">
                  {formatPrice(candle.high, activeSymbol.precision)}
                </span>
              </div>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Minimo</span>
                <span className="tv-kv-val">
                  {formatPrice(candle.low, activeSymbol.precision)}
                </span>
              </div>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Chiusura</span>
                <span className={`tv-kv-val ${isUp ? 'tv-val-up' : 'tv-val-down'}`}>
                  {formatPrice(candle.close, activeSymbol.precision)}
                </span>
              </div>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Variazione</span>
                <span className={`tv-kv-val ${isUp ? 'tv-val-up' : 'tv-val-down'}`}>
                  {change > 0 ? '+' : ''}
                  {formatPrice(change, activeSymbol.precision)} ({formatPercent(changePct)})
                </span>
              </div>
              <div className="tv-kv-row">
                <span className="tv-kv-key">Volume</span>
                <span className="tv-kv-val">{formatVolume(candle.volume)}</span>
              </div>
            </>
          ) : (
            <div className="tv-empty-state">Nessun dato disponibile.</div>
          )}
        </div>

        {/* Active Indicators Readout */}
        <div className="tv-kv-section">
          <div className="tv-kv-section-title">
            Indicatori attivi ({indicatorSeries.length})
          </div>

          {indicatorSeries.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--tv-text-muted, #707070)' }}>
              Nessun indicatore applicato al pannello attivo.
            </div>
          ) : (
            indicatorSeries.map((series) => (
              <div key={series.id} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--tv-text-heading, #fff)',
                    marginBottom: 4,
                  }}
                >
                  {series.title}
                </div>
                {series.plots.map((plot) => {
                  const pt = plot.data[resolvedIndex] ?? plot.data[plot.data.length - 1];
                  const val = pt?.value;
                  return (
                    <div key={plot.key} className="tv-kv-row">
                      <span className="tv-kv-key">
                        <span
                          className="tv-color-dot"
                          style={{ backgroundColor: plot.color }}
                        />
                        {plot.label}
                      </span>
                      <span className="tv-kv-val">
                        {val !== null && val !== undefined
                          ? formatPrice(val, activeSymbol.precision)
                          : 'n/d'}
                      </span>
                    </div>
                  );
                })}
                {series.plots.length === 0 &&
                  series.hlines?.slice(0, 5).map((hl, i) => (
                    <div key={`${series.id}-hl-${i}`} className="tv-kv-row">
                      <span className="tv-kv-key">
                        <span
                          className="tv-color-dot"
                          style={{ backgroundColor: hl.color }}
                        />
                        {hl.label ?? 'Livello'}
                      </span>
                      <span className="tv-kv-val">
                        {formatPrice(hl.value, activeSymbol.precision)}
                      </span>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
