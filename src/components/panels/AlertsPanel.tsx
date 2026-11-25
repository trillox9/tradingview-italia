import { useState } from 'react';
import { Bell, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { formatPrice, getSymbolByTicker } from '../../data';
import { ALERT_CONDITION_LABELS_IT, ALERT_TARGET_LABELS_IT } from '../../engine';
import { useActivePane, useAlerts, useQuotes, useTradingView } from '../../store';

export function AlertsPanel() {
  const { openModal } = useTradingView();
  const { setSymbol } = useActivePane();
  const { quotes } = useQuotes();
  const { alerts, alertLog, toggleAlert, deleteAlert } = useAlerts();

  const [tab, setTab] = useState<'rules' | 'log'>('rules');

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Avvisi</h3>
        <div className="tv-panel-actions">
          <button
            type="button"
            className="tv-btn-sm is-primary"
            onClick={() => openModal('alert')}
          >
            <Plus size={13} />
            Crea avviso
          </button>
        </div>
      </div>

      <div className="tv-panel-tabs">
        <button
          type="button"
          className={`tv-panel-tab${tab === 'rules' ? ' is-active' : ''}`}
          onClick={() => setTab('rules')}
        >
          Avvisi ({alerts.length})
        </button>
        <button
          type="button"
          className={`tv-panel-tab${tab === 'log' ? ' is-active' : ''}`}
          onClick={() => setTab('log')}
        >
          Registro avvisi ({alertLog.length})
        </button>
      </div>

      <div className="tv-panel-body">
        {tab === 'rules' ? (
          alerts.length === 0 ? (
            <div className="tv-empty-state">
              <Bell size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>Nessun avviso configurato.</div>
              <div style={{ marginTop: 4 }}>
                Clicca <strong>Crea avviso</strong> per monitorare prezzi o indicatori in tempo reale.
              </div>
            </div>
          ) : (
            alerts.map((rule) => {
              const sym = getSymbolByTicker(rule.symbol);
              const precision = sym?.precision ?? 2;
              const livePrice = quotes[rule.symbol]?.price;
              const statusClass =
                rule.status === 'active'
                  ? 'is-up'
                  : rule.status === 'triggered'
                    ? 'is-warn'
                    : '';
              const statusLabel =
                rule.status === 'active'
                  ? 'Attivo'
                  : rule.status === 'triggered'
                    ? 'Scattato'
                    : 'In pausa';

              return (
                <div key={rule.id} className="tv-list-card">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSymbol(rule.symbol)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--tv-text-heading, #fff)',
                        fontWeight: 700,
                        fontSize: 12.5,
                        textAlign: 'left',
                      }}
                    >
                      {rule.symbol}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className={`tv-badge-pill ${statusClass}`}>
                        {statusLabel}
                      </span>
                      <button
                        type="button"
                        className="tv-panel-icon-btn"
                        title={rule.status === 'active' ? 'Metti in pausa' : 'Riattiva avviso'}
                        aria-label={rule.status === 'active' ? 'Metti in pausa' : 'Riattiva avviso'}
                        onClick={() => toggleAlert(rule.id)}
                      >
                        {rule.status === 'active' ? (
                          <Pause size={13} />
                        ) : (
                          <Play size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="tv-panel-icon-btn"
                        title="Elimina avviso"
                        aria-label="Elimina avviso"
                        onClick={() => deleteAlert(rule.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--tv-text-primary, #d1d4dc)',
                      marginTop: 4,
                    }}
                  >
                    {ALERT_TARGET_LABELS_IT[rule.target]} •{' '}
                    {ALERT_CONDITION_LABELS_IT[rule.condition]}{' '}
                    <strong className="tv-num">
                      {formatPrice(rule.value, precision)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 5,
                      fontSize: 10.5,
                      color: 'var(--tv-text-muted, #707070)',
                    }}
                  >
                    <span>
                      {rule.triggerOnce ? 'Solo una volta' : 'Ogni volta'}
                      {rule.triggerCount > 0 ? ` • ${rule.triggerCount}x` : ''}
                    </span>
                    {livePrice !== undefined && (
                      <span className="tv-num">
                        Attuale: {formatPrice(livePrice, precision)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : alertLog.length === 0 ? (
          <div className="tv-empty-state">
            Nessun evento nel registro avvisi. Quando un avviso scatta, comparirà qui.
          </div>
        ) : (
          alertLog.map((evt) => {
            const sym = getSymbolByTicker(evt.symbol);
            const precision = sym?.precision ?? 2;
            const timeStr = new Date(evt.triggeredAt).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            return (
              <div
                key={evt.id}
                className="tv-list-card"
                style={{ cursor: 'pointer' }}
                onClick={() => setSymbol(evt.symbol)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ color: 'var(--tv-text-heading, #fff)' }}>
                    {evt.symbol}
                  </strong>
                  <span
                    className="tv-num"
                    style={{ fontSize: 10.5, color: 'var(--tv-text-muted, #707070)' }}
                  >
                    {timeStr}
                  </span>
                </div>
                <div style={{ marginTop: 3, fontSize: 11.5 }}>{evt.message}</div>
                <div
                  className="tv-num"
                  style={{
                    marginTop: 4,
                    fontSize: 10.5,
                    color: 'var(--tv-warning, #ff9800)',
                  }}
                >
                  Valore rilevato: {formatPrice(evt.triggeredValue, precision)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
