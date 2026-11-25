import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BellPlus, CheckCircle2, X } from 'lucide-react';
import type { AlertCondition, AlertTarget } from '../../types';
import { ALERT_TARGET_LABELS_IT } from '../../engine';
import { formatPercent, formatPrice } from '../../data';
import { useActivePane, useAlerts, useQuotes, useTradingView } from '../../store';

export interface CreateAlertModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type UiAlertCondition =
  | 'crossing'
  | 'crosses_above'
  | 'crosses_below'
  | 'greater_than'
  | 'less_than';

const UI_CONDITION_OPTIONS: { value: UiAlertCondition; label: string }[] = [
  { value: 'crossing', label: 'Incrocio' },
  { value: 'crosses_above', label: "Incrocio verso l'alto" },
  { value: 'crosses_below', label: 'Incrocio verso il basso' },
  { value: 'greater_than', label: 'Maggiore di' },
  { value: 'less_than', label: 'Minore di' },
];

export function CreateAlertModal({ isOpen, onClose }: CreateAlertModalProps) {
  const { modals, closeModal, setRightPanel } = useTradingView();
  const { activeSymbol } = useActivePane();
  const { quotes } = useQuotes();
  const { createAlert } = useAlerts();

  const visible = isOpen ?? modals.alert;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('alert');
  }, [closeModal, onClose]);

  const liveQuote = quotes[activeSymbol.ticker];
  const currentPrice = liveQuote?.price ?? activeSymbol.basePrice;
  const deltaPercent =
    liveQuote?.changePercent ??
    ((activeSymbol.basePrice - activeSymbol.prevClose) / activeSymbol.prevClose) *
      100;

  const [target, setTarget] = useState<AlertTarget>('price');
  const [condition, setCondition] = useState<UiAlertCondition>('crossing');
  const [valueStr, setValueStr] = useState<string>('');
  const [triggerOnce, setTriggerOnce] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  // Pre-fill target value whenever modal opens or symbol changes
  useEffect(() => {
    if (!visible) return;
    setTarget('price');
    setCondition('crossing');
    setValueStr(currentPrice.toFixed(activeSymbol.precision));
    setTriggerOnce(true);
    setName('');
    setMessage('');
    setError(null);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, activeSymbol.ticker]);

  const handleTargetChange = (nextTarget: AlertTarget) => {
    setTarget(nextTarget);
    if (nextTarget === 'rsi') {
      setValueStr('70');
    } else if (nextTarget === 'macd') {
      setValueStr('0');
    } else {
      setValueStr(currentPrice.toFixed(activeSymbol.precision));
    }
  };

  const applyPriceOffset = (pctOffset: number) => {
    const nextVal = currentPrice * (1 + pctOffset / 100);
    setValueStr(nextVal.toFixed(activeSymbol.precision));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numericVal = Number.parseFloat(valueStr.replace(',', '.'));
    if (!Number.isFinite(numericVal)) {
      setError('Inserisci un valore numerico valido.');
      return;
    }

    const resolvedCondition: AlertCondition =
      condition === 'crossing'
        ? numericVal >= currentPrice
          ? 'crosses_above'
          : 'crosses_below'
        : condition;

    const condText =
      UI_CONDITION_OPTIONS.find((o) => o.value === condition)?.label ?? 'Incrocio';

    createAlert({
      symbol: activeSymbol.ticker,
      target,
      condition: resolvedCondition,
      value: numericVal,
      triggerOnce,
      name:
        name.trim() ||
        `${activeSymbol.ticker} ${ALERT_TARGET_LABELS_IT[target]} ${condText} ${numericVal}`,
      message:
        message.trim() ||
        `Avviso ${activeSymbol.ticker}: ${ALERT_TARGET_LABELS_IT[target]} ${condText.toLowerCase()} ${numericVal}`,
    });

    setSaved(true);
    setRightPanel('alerts');
    window.setTimeout(() => {
      handleClose();
    }, 350);
  };

  if (!visible) return null;

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Crea avviso su ${activeSymbol.ticker}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <form className="tvm-dialog tvm-dialog--sm" onSubmit={handleSubmit}>
        <div className="tvm-header">
          <div className="tvm-title-group">
            <BellPlus size={19} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <h2 className="tvm-title">Crea avviso su {activeSymbol.ticker}</h2>
          </div>
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Live symbol banner */}
          <div className="tvm-alert-quote-banner" style={{ marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="tvm-avatar"
                style={{ backgroundColor: activeSymbol.logoColor }}
              >
                {activeSymbol.logoText}
              </span>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--tv-text-heading, #fff)' }}>
                  {activeSymbol.ticker}{' '}
                  <span className="tvm-asset-tag">{activeSymbol.exchange}</span>
                </div>
                <div className="tvm-subtitle">{activeSymbol.name}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tvm-symbol-price">
                {formatPrice(currentPrice, activeSymbol.precision)}{' '}
                <span style={{ fontSize: '0.7rem', color: 'var(--tv-text-muted, #8c8c8c)' }}>
                  {activeSymbol.currency}
                </span>
              </div>
              <div
                className={`tvm-symbol-delta ${
                  deltaPercent >= 0 ? 'tvm-delta-up' : 'tvm-delta-down'
                }`}
              >
                {formatPercent(deltaPercent)}
              </div>
            </div>
          </div>

          <div className="tvm-form-grid">
            <div className="tvm-field">
              <label className="tvm-label" htmlFor="alert-target-select">
                Sorgente
              </label>
              <select
                id="alert-target-select"
                className="tvm-select"
                value={target}
                onChange={(e) => handleTargetChange(e.target.value as AlertTarget)}
              >
                {(Object.keys(ALERT_TARGET_LABELS_IT) as AlertTarget[]).map((key) => (
                  <option key={key} value={key}>
                    {ALERT_TARGET_LABELS_IT[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="tvm-field">
              <label className="tvm-label" htmlFor="alert-condition-select">
                Condizione
              </label>
              <select
                id="alert-condition-select"
                className="tvm-select"
                value={condition}
                onChange={(e) => setCondition(e.target.value as UiAlertCondition)}
              >
                {UI_CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tvm-field">
            <label className="tvm-label" htmlFor="alert-value-input">
              Valore soglia ({target === 'price' ? activeSymbol.currency : target.toUpperCase()})
            </label>
            <input
              id="alert-value-input"
              type="text"
              inputMode="decimal"
              className="tvm-input tv-num"
              value={valueStr}
              onChange={(e) => {
                setValueStr(e.target.value);
                setError(null);
              }}
              placeholder={currentPrice.toFixed(activeSymbol.precision)}
              autoFocus
            />
            {target === 'price' && (
              <div className="tvm-quick-offsets">
                {[-3, -1, 0, 1, 3].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className="tvm-offset-btn"
                    onClick={() => applyPriceOffset(pct)}
                  >
                    {pct === 0 ? 'Attuale' : `${pct > 0 ? '+' : ''}${pct}%`}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <span style={{ fontSize: '0.75rem', color: 'var(--tv-down, #f7525f)' }}>
                {error}
              </span>
            )}
          </div>

          <div className="tvm-field">
            <span className="tvm-label">Frequenza attivazione</span>
            <div className="tvm-segmented-group" role="radiogroup" aria-label="Frequenza attivazione">
              <button
                type="button"
                role="radio"
                aria-checked={triggerOnce}
                className={`tvm-segmented-option ${triggerOnce ? 'is-active' : ''}`}
                onClick={() => setTriggerOnce(true)}
              >
                Solo una volta
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!triggerOnce}
                className={`tvm-segmented-option ${!triggerOnce ? 'is-active' : ''}`}
                onClick={() => setTriggerOnce(false)}
              >
                Ogni volta
              </button>
            </div>
          </div>

          <div className="tvm-field">
            <label className="tvm-label" htmlFor="alert-name-input">
              Nome avviso (opzionale)
            </label>
            <input
              id="alert-name-input"
              type="text"
              className="tvm-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${activeSymbol.ticker} breakout livello chiave`}
            />
          </div>

          <div className="tvm-field">
            <label className="tvm-label" htmlFor="alert-msg-input">
              Messaggio notifica
            </label>
            <textarea
              id="alert-msg-input"
              className="tvm-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Avviso su ${activeSymbol.ticker}: prezzo ha raggiunto ${valueStr || formatPrice(currentPrice, activeSymbol.precision)}`}
            />
          </div>
        </div>

        <div className="tvm-footer">
          {saved ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--tv-up, #22ab94)',
              }}
            >
              <CheckCircle2 size={16} /> Avviso creato!
            </span>
          ) : (
            <span className="tvm-subtitle">Notifica toast in tempo reale attiva</span>
          )}
          <div className="tvm-footer-actions">
            <button type="button" className="tvm-btn tvm-btn--secondary" onClick={handleClose}>
              Annulla
            </button>
            <button type="submit" className="tvm-btn tvm-btn--primary">
              <BellPlus size={15} />
              Crea avviso
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreateAlertModal;
