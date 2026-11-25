import { BellRing, X } from 'lucide-react';
import { formatPrice, getSymbolByTicker } from '../../data';
import { useActivePane, useAlerts } from '../../store';

export function AlertToastStack() {
  const { triggeredToasts, dismissToast } = useAlerts();
  const { setSymbol } = useActivePane();

  if (triggeredToasts.length === 0) {
    return null;
  }

  return (
    <div
      className="tv-toast-stack"
      role="region"
      aria-live="polite"
      aria-label="Notifiche avvisi di mercato"
    >
      {triggeredToasts.map((toast) => {
        const sym = getSymbolByTicker(toast.symbol);
        const precision = sym?.precision ?? 2;
        return (
          <div key={toast.id} className="tv-alert-toast">
            <BellRing
              size={16}
              style={{
                color: 'var(--tv-warning, #ff9800)',
                marginTop: 2,
                flexShrink: 0,
              }}
            />

            <div className="tv-alert-toast-body">
              <div className="tv-alert-toast-title">
                <button
                  type="button"
                  onClick={() => setSymbol(toast.symbol)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--tv-link, #5b9cf6)',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {toast.symbol}
                </button>
                <span className="tv-num" style={{ fontSize: 11 }}>
                  {formatPrice(toast.triggeredValue, precision)}
                </span>
              </div>
              <div className="tv-alert-toast-msg">{toast.message}</div>
            </div>

            <button
              type="button"
              className="tv-panel-icon-btn"
              aria-label="Chiudi notifica"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
