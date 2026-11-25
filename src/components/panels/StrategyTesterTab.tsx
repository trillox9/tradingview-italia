import { useState } from 'react';
import { Code2, Play } from 'lucide-react';
import type { PineEquityPoint } from '../../types';
import { formatPercent, formatPrice } from '../../data';
import { PINE_TEMPLATES } from '../../engine';
import { useActivePane, useTradingView } from '../../store';

function EquityCurveSvg({
  points,
  initialCapital,
}: {
  points: PineEquityPoint[];
  initialCapital: number;
}) {
  if (points.length < 2) {
    return (
      <div className="tv-empty-state">
        Dati curva equity insufficienti per il grafico.
      </div>
    );
  }

  const width = 680;
  const height = 148;
  const padX = 12;
  const padY = 14;

  const equities = points.map((p) => p.equity);
  const minVal = Math.min(initialCapital, ...equities);
  const maxVal = Math.max(initialCapital, ...equities);
  const span = Math.max(1, maxVal - minVal);

  const toX = (i: number) =>
    padX + (i / (points.length - 1)) * (width - padX * 2);
  const toY = (v: number) =>
    padY + (1 - (v - minVal) / span) * (height - padY * 2);

  const linePoints = points
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.equity).toFixed(1)}`)
    .join(' ');
  const baseY = toY(initialCapital);
  const lastEquity = points[points.length - 1].equity;
  const isProfit = lastEquity >= initialCapital;
  const strokeColor = isProfit ? '#089981' : '#f23645';

  const areaPath = `M ${toX(0).toFixed(1)},${baseY.toFixed(1)} L ${linePoints.replace(/ /g, ' L ')} L ${toX(points.length - 1).toFixed(1)},${baseY.toFixed(1)} Z`;

  return (
    <div className="tv-equity-wrap">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--tv-text-secondary, #8c8c8c)',
        }}
      >
        <span>Curva Equity (EUR)</span>
        <span className="tv-num">
          Min {formatPrice(minVal, 0)} € • Max {formatPrice(maxVal, 0)} €
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="136"
        preserveAspectRatio="none"
        role="img"
        aria-label="Curva Equity del Tester Strategia"
      >
        <defs>
          <linearGradient id="tvEquityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Initial capital baseline */}
        <line
          x1={padX}
          y1={baseY}
          x2={width - padX}
          y2={baseY}
          stroke="var(--tv-toolbar-border, #303030)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />

        <path d={areaPath} fill="url(#tvEquityFill)" />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          points={linePoints}
        />
      </svg>
    </div>
  );
}

export function StrategyTesterTab() {
  const {
    pineResult,
    loadPineTemplate,
    applyPineToChart,
    setBottomPanel,
  } = useTradingView();
  const { activeSymbol, activePane } = useActivePane();

  const [subTab, setSubTab] = useState<'overview' | 'trades'>('overview');
  const bt = pineResult?.backtest ?? null;

  if (!bt) {
    return (
      <div className="tv-panel">
        <div className="tv-empty-state" style={{ paddingTop: 34 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-heading, #fff)' }}>
            Nessuna strategia Pine attiva
          </div>
          <p style={{ margin: '6px 0 12px' }}>
            Lo script corrente è un indicatore o contiene errori. Carica una strategia per avviare il backtest su{' '}
            <strong>{activeSymbol.ticker}</strong>.
          </p>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button
              type="button"
              className="tv-btn-sm is-primary"
              onClick={() => {
                loadPineTemplate(PINE_TEMPLATES[0].id);
                applyPineToChart(PINE_TEMPLATES[0].code);
              }}
            >
              <Play size={12} />
              Carica Strategia EMA 9/21
            </button>
            <button
              type="button"
              className="tv-btn-sm"
              onClick={() => setBottomPanel('pine')}
            >
              <Code2 size={12} />
              Apri Editor Pine
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isNetPositive = bt.netProfit >= 0;

  return (
    <div className="tv-panel">
      <div className="tv-drawer-toolbar" style={{ padding: '6px 12px' }}>
        <strong style={{ color: 'var(--tv-text-heading, #fff)', fontSize: 12.5 }}>
          {pineResult?.scriptName}
        </strong>
        <span className="tv-badge-pill is-brand">
          {activeSymbol.ticker} • {activePane.timeframe}
        </span>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button
            type="button"
            className={`tv-chip${subTab === 'overview' ? ' is-active' : ''}`}
            onClick={() => setSubTab('overview')}
          >
            Panoramica
          </button>
          <button
            type="button"
            className={`tv-chip${subTab === 'trades' ? ' is-active' : ''}`}
            onClick={() => setSubTab('trades')}
          >
            Lista operazioni ({bt.totalTrades})
          </button>
        </div>
      </div>

      {/* 5-KPI Strip */}
      <div className="tv-kpi-strip">
        <div className="tv-kpi-card">
          <span className="tv-kpi-label">Profitto netto</span>
          <span className={`tv-kpi-value ${isNetPositive ? 'tv-val-up' : 'tv-val-down'}`}>
            {bt.netProfit > 0 ? '+' : ''}
            {formatPrice(bt.netProfit, 2)} €
          </span>
          <span className={`tv-kpi-sub ${isNetPositive ? 'tv-val-up' : 'tv-val-down'}`}>
            {formatPercent(bt.netProfitPercent)}
          </span>
        </div>

        <div className="tv-kpi-card">
          <span className="tv-kpi-label">Operazioni chiuse</span>
          <span className="tv-kpi-value">{bt.totalTrades}</span>
          <span className="tv-kpi-sub tv-val-neutral">
            {bt.winningTrades} V / {bt.losingTrades} P
          </span>
        </div>

        <div className="tv-kpi-card">
          <span className="tv-kpi-label">Percentuale profittevole</span>
          <span className="tv-kpi-value">{bt.winRatePercent.toFixed(1)}%</span>
          <span className="tv-kpi-sub tv-val-neutral">
            Media: {formatPrice(bt.avgTradePnl, 2)} €
          </span>
        </div>

        <div className="tv-kpi-card">
          <span className="tv-kpi-label">Profit factor</span>
          <span
            className={`tv-kpi-value ${bt.profitFactor >= 1 ? 'tv-val-up' : 'tv-val-down'}`}
          >
            {bt.profitFactor.toFixed(2)}
          </span>
          <span className="tv-kpi-sub tv-val-neutral">
            Sharpe: {bt.sharpeRatio.toFixed(2)}
          </span>
        </div>

        <div className="tv-kpi-card">
          <span className="tv-kpi-label">Drawdown massimo</span>
          <span className="tv-kpi-value tv-val-down">
            -{formatPrice(bt.maxDrawdown, 2)} €
          </span>
          <span className="tv-kpi-sub tv-val-down">
            -{bt.maxDrawdownPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {subTab === 'overview' ? (
        <EquityCurveSvg
          points={bt.equityCurve}
          initialCapital={bt.initialCapital}
        />
      ) : (
        <div className="tv-table-wrap">
          <table className="tv-data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tipo</th>
                <th>Segnale</th>
                <th className="is-num">Ingresso</th>
                <th className="is-num">Uscita</th>
                <th className="is-num">P&amp;L (€)</th>
                <th className="is-num">P&amp;L %</th>
                <th className="is-num">Barre</th>
              </tr>
            </thead>
            <tbody>
              {bt.trades.map((tr) => {
                const win = tr.pnl >= 0;
                return (
                  <tr key={tr.id}>
                    <td className="tv-num">{tr.id}</td>
                    <td>
                      <span
                        className={`tv-badge-pill ${tr.side === 'long' ? 'is-up' : 'is-down'}`}
                      >
                        {tr.side === 'long' ? 'LONG' : 'SHORT'}
                      </span>
                    </td>
                    <td>{tr.entryId}</td>
                    <td className="is-num">
                      {formatPrice(tr.entryPrice, activeSymbol.precision)}
                    </td>
                    <td className="is-num">
                      {formatPrice(tr.exitPrice, activeSymbol.precision)}
                    </td>
                    <td
                      className={`is-num ${win ? 'tv-val-up' : 'tv-val-down'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {tr.pnl > 0 ? '+' : ''}
                      {formatPrice(tr.pnl, 2)} €
                    </td>
                    <td className={`is-num ${win ? 'tv-val-up' : 'tv-val-down'}`}>
                      {formatPercent(tr.pnlPercent)}
                    </td>
                    <td className="is-num">{tr.barsHeld}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
