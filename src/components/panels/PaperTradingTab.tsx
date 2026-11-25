import { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { OrderSide, OrderType } from '../../types';
import { formatPercent, formatPrice, getSymbolByTicker } from '../../data';
import { useActivePane, usePaperTrading, useQuotes } from '../../store';

export function PaperTradingTab() {
  const { activeSymbol, setSymbol } = useActivePane();
  const { quotes } = useQuotes();
  const { account, placeOrder, closePosition, cancelOrder, resetAccount } =
    usePaperTrading();

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState<string>('10');
  const [triggerPrice, setTriggerPrice] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [subTab, setSubTab] = useState<'positions' | 'orders' | 'history'>(
    'positions',
  );

  const liveQuote = quotes[activeSymbol.ticker];
  const livePrice = liveQuote?.price ?? activeSymbol.basePrice;
  const bid = liveQuote?.bid ?? livePrice;
  const ask = liveQuote?.ask ?? livePrice;

  // Reset limit/stop input when symbol changes
  useEffect(() => {
    setTriggerPrice(livePrice.toFixed(activeSymbol.precision));
    setTakeProfit('');
    setStopLoss('');
    // Sensible default quantity for expensive symbols like BTC/FTSEMIB
    if (activeSymbol.basePrice > 10_000) {
      setQuantity('0.5');
    } else if (activeSymbol.basePrice > 500) {
      setQuantity('5');
    } else {
      setQuantity('10');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol.ticker]);

  const parsedQty = Number.parseFloat(quantity);
  const parsedTrigger = Number.parseFloat(triggerPrice);
  const parsedTP = Number.parseFloat(takeProfit);
  const parsedSL = Number.parseFloat(stopLoss);

  const execRefPrice =
    orderType === 'market'
      ? side === 'buy'
        ? ask
        : bid
      : Number.isFinite(parsedTrigger)
        ? parsedTrigger
        : livePrice;

  const estimatedNotional =
    Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty * execRefPrice : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) return;

    placeOrder(
      {
        symbol: activeSymbol.ticker,
        side,
        type: orderType,
        quantity: parsedQty,
        limitPrice: orderType === 'limit' ? parsedTrigger : undefined,
        stopPrice: orderType === 'stop' ? parsedTrigger : undefined,
        takeProfit: Number.isFinite(parsedTP) && parsedTP > 0 ? parsedTP : undefined,
        stopLoss: Number.isFinite(parsedSL) && parsedSL > 0 ? parsedSL : undefined,
      },
      orderType === 'market' ? (side === 'buy' ? ask : bid) : livePrice,
    );
  };

  return (
    <div className="tv-panel">
      {/* Paper Trading Account Strip */}
      <div className="tv-paper-header">
        <div className="tv-paper-stats">
          <span className="tv-badge-pill is-brand" style={{ fontSize: 11 }}>
            Paper Trading
          </span>

          <div className="tv-paper-stat">
            <span className="tv-paper-stat-label">Saldo</span>
            <span className="tv-paper-stat-val">
              {formatPrice(account.balance, 2)} €
            </span>
          </div>

          <div className="tv-paper-stat">
            <span className="tv-paper-stat-label">Equity</span>
            <span className="tv-paper-stat-val">
              {formatPrice(account.equity, 2)} €
            </span>
          </div>

          <div className="tv-paper-stat">
            <span className="tv-paper-stat-label">P&amp;L aperto</span>
            <span
              className={`tv-paper-stat-val ${account.unrealizedPnl >= 0 ? 'tv-val-up' : 'tv-val-down'}`}
            >
              {account.unrealizedPnl > 0 ? '+' : ''}
              {formatPrice(account.unrealizedPnl, 2)} €
            </span>
          </div>

          <div className="tv-paper-stat">
            <span className="tv-paper-stat-label">P&amp;L realizzato</span>
            <span
              className={`tv-paper-stat-val ${account.realizedPnl >= 0 ? 'tv-val-up' : 'tv-val-down'}`}
            >
              {account.realizedPnl > 0 ? '+' : ''}
              {formatPrice(account.realizedPnl, 2)} €
            </span>
          </div>

          <div className="tv-paper-stat">
            <span className="tv-paper-stat-label">Margine libero</span>
            <span className="tv-paper-stat-val">
              {formatPrice(account.freeMargin, 2)} €
            </span>
          </div>
        </div>

        <button
          type="button"
          className="tv-btn-sm"
          title="Ripristina saldo Paper Trading a 100.000 €"
          onClick={() => resetAccount()}
        >
          <RotateCcw size={12} />
          Ripristina conto
        </button>
      </div>

      {/* Main Split: Left Order Ticket / Right Positions+Orders+History */}
      <div className="tv-paper-body">
        <form className="tv-order-ticket" onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ color: 'var(--tv-text-heading, #fff)', fontSize: 12.5 }}>
              {activeSymbol.ticker} • {activeSymbol.exchange}
            </strong>
            <span className="tv-num" style={{ fontSize: 11.5, fontWeight: 600 }}>
              {formatPrice(livePrice, activeSymbol.precision)} {activeSymbol.currency}
            </span>
          </div>

          {/* Big Sell / Buy Side Buttons */}
          <div className="tv-side-toggle">
            <button
              type="button"
              className={`tv-side-btn is-sell${side === 'sell' ? ' is-active' : ''}`}
              onClick={() => setSide('sell')}
            >
              <span style={{ fontSize: 10, textTransform: 'uppercase' }}>Vendi</span>
              <span className="tv-num" style={{ fontSize: 12.5 }}>
                {formatPrice(bid, activeSymbol.precision)}
              </span>
            </button>
            <button
              type="button"
              className={`tv-side-btn is-buy${side === 'buy' ? ' is-active' : ''}`}
              onClick={() => setSide('buy')}
            >
              <span style={{ fontSize: 10, textTransform: 'uppercase' }}>Acquista</span>
              <span className="tv-num" style={{ fontSize: 12.5 }}>
                {formatPrice(ask, activeSymbol.precision)}
              </span>
            </button>
          </div>

          {/* Order Type: Mercato / Limite / Stop */}
          <div className="tv-order-type-row">
            {(
              [
                ['market', 'Mercato'],
                ['limit', 'Limite'],
                ['stop', 'Stop'],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                className={`tv-order-type-btn${orderType === t ? ' is-active' : ''}`}
                onClick={() => {
                  setOrderType(t);
                  if (t !== 'market' && !triggerPrice) {
                    setTriggerPrice(livePrice.toFixed(activeSymbol.precision));
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quantity & Conditional Price */}
          <div className="tv-form-grid-2">
            <label className="tv-field-label">
              Quantità
              <input
                type="number"
                step="any"
                min="0.01"
                className="tv-input-compact tv-num"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            {orderType !== 'market' ? (
              <label className="tv-field-label">
                {orderType === 'limit' ? 'Prezzo limite' : 'Prezzo stop'}
                <input
                  type="number"
                  step="any"
                  className="tv-input-compact tv-num"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                />
              </label>
            ) : (
              <div className="tv-field-label">
                Controvalore stimato
                <div
                  className="tv-input-compact tv-num"
                  style={{ opacity: 0.85, cursor: 'default' }}
                >
                  {formatPrice(estimatedNotional, 2)} €
                </div>
              </div>
            )}
          </div>

          {/* Optional Bracket TP / SL */}
          <div className="tv-form-grid-2">
            <label className="tv-field-label">
              Take Profit (opz.)
              <input
                type="number"
                step="any"
                placeholder="Prezzo TP"
                className="tv-input-compact tv-num"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </label>
            <label className="tv-field-label">
              Stop Loss (opz.)
              <input
                type="number"
                step="any"
                placeholder="Prezzo SL"
                className="tv-input-compact tv-num"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className={`tv-btn-sm ${side === 'buy' ? 'is-primary' : 'is-danger'}`}
            style={{ width: '100%', padding: '8px 10px' }}
          >
            {side === 'buy' ? 'Acquista' : 'Vendi'} {quantity || '0'} {activeSymbol.ticker}{' '}
            {orderType === 'market'
              ? 'a Mercato'
              : orderType === 'limit'
                ? 'Limite'
                : 'Stop'}
          </button>
        </form>

        {/* Right Side: Positions / Orders / History */}
        <div className="tv-panel">
          <div className="tv-panel-tabs">
            <button
              type="button"
              className={`tv-panel-tab${subTab === 'positions' ? ' is-active' : ''}`}
              onClick={() => setSubTab('positions')}
            >
              Posizioni ({account.positions.length})
            </button>
            <button
              type="button"
              className={`tv-panel-tab${subTab === 'orders' ? ' is-active' : ''}`}
              onClick={() => setSubTab('orders')}
            >
              Ordini ({account.orders.length})
            </button>
            <button
              type="button"
              className={`tv-panel-tab${subTab === 'history' ? ' is-active' : ''}`}
              onClick={() => setSubTab('history')}
            >
              Storico ({account.history.length})
            </button>
          </div>

          <div className="tv-table-wrap">
            {subTab === 'positions' && (
              <table className="tv-data-table">
                <thead>
                  <tr>
                    <th>Simbolo</th>
                    <th>Lato</th>
                    <th className="is-num">Qtà</th>
                    <th className="is-num">Prezzo medio</th>
                    <th className="is-num">Ultimo</th>
                    <th className="is-num">P&amp;L aperto</th>
                    <th className="is-num">TP / SL</th>
                    <th className="is-num">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {account.positions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                        Nessuna posizione aperta. Inserisci un ordine a sinistra per iniziare.
                      </td>
                    </tr>
                  ) : (
                    account.positions.map((pos) => {
                      const sym = getSymbolByTicker(pos.symbol);
                      const prec = sym?.precision ?? 2;
                      const isUp = pos.unrealizedPnl >= 0;
                      return (
                        <tr key={pos.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSymbol(pos.symbol)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                cursor: 'pointer',
                                color: 'var(--tv-text-heading, #fff)',
                                fontWeight: 700,
                              }}
                            >
                              {pos.symbol}
                            </button>
                          </td>
                          <td>
                            <span
                              className={`tv-badge-pill ${pos.side === 'long' ? 'is-up' : 'is-down'}`}
                            >
                              {pos.side === 'long' ? 'LONG' : 'SHORT'}
                            </span>
                          </td>
                          <td className="is-num">{pos.quantity}</td>
                          <td className="is-num">
                            {formatPrice(pos.avgEntryPrice, prec)}
                          </td>
                          <td className="is-num">
                            {formatPrice(pos.currentPrice, prec)}
                          </td>
                          <td
                            className={`is-num ${isUp ? 'tv-val-up' : 'tv-val-down'}`}
                            style={{ fontWeight: 600 }}
                          >
                            {pos.unrealizedPnl > 0 ? '+' : ''}
                            {formatPrice(pos.unrealizedPnl, 2)} € (
                            {formatPercent(pos.unrealizedPnlPercent)})
                          </td>
                          <td className="is-num" style={{ fontSize: 11 }}>
                            {pos.takeProfit ? formatPrice(pos.takeProfit, prec) : '—'} /{' '}
                            {pos.stopLoss ? formatPrice(pos.stopLoss, prec) : '—'}
                          </td>
                          <td className="is-num">
                            <button
                              type="button"
                              className="tv-btn-sm is-danger-ghost"
                              style={{ padding: '3px 8px' }}
                              onClick={() => closePosition(pos.symbol)}
                            >
                              Chiudi
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {subTab === 'orders' && (
              <table className="tv-data-table">
                <thead>
                  <tr>
                    <th>Simbolo</th>
                    <th>Lato</th>
                    <th>Tipo</th>
                    <th className="is-num">Qtà</th>
                    <th className="is-num">Prezzo target</th>
                    <th className="is-num">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {account.orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                        Nessun ordine pendente (Limite o Stop).
                      </td>
                    </tr>
                  ) : (
                    account.orders.map((ord) => {
                      const prec = getSymbolByTicker(ord.symbol)?.precision ?? 2;
                      return (
                        <tr key={ord.id}>
                          <td>
                            <strong>{ord.symbol}</strong>
                          </td>
                          <td>
                            <span
                              className={`tv-badge-pill ${ord.side === 'buy' ? 'is-up' : 'is-down'}`}
                            >
                              {ord.side === 'buy' ? 'ACQUISTO' : 'VENDITA'}
                            </span>
                          </td>
                          <td style={{ textTransform: 'uppercase' }}>{ord.type}</td>
                          <td className="is-num">{ord.quantity}</td>
                          <td className="is-num">
                            {formatPrice(
                              ord.limitPrice ?? ord.stopPrice ?? 0,
                              prec,
                            )}
                          </td>
                          <td className="is-num">
                            <button
                              type="button"
                              className="tv-btn-sm is-danger-ghost"
                              style={{ padding: '3px 7px' }}
                              onClick={() => cancelOrder(ord.id)}
                            >
                              <X size={12} />
                              Annulla
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {subTab === 'history' && (
              <table className="tv-data-table">
                <thead>
                  <tr>
                    <th>Ora</th>
                    <th>Simbolo</th>
                    <th>Lato</th>
                    <th>Tipo</th>
                    <th className="is-num">Qtà</th>
                    <th className="is-num">Prezzo</th>
                    <th className="is-num">P&amp;L real.</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {account.history.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                        Nessun ordine nello storico.
                      </td>
                    </tr>
                  ) : (
                    account.history.map((ord) => {
                      const prec = getSymbolByTicker(ord.symbol)?.precision ?? 2;
                      const ts = new Date(
                        ord.filledAt ?? ord.createdAt,
                      ).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const statusClass =
                        ord.status === 'filled'
                          ? 'is-up'
                          : ord.status === 'rejected'
                            ? 'is-down'
                            : '';
                      const statusLabel =
                        ord.status === 'filled'
                          ? 'Eseguito'
                          : ord.status === 'cancelled'
                            ? 'Annullato'
                            : 'Rifiutato';
                      return (
                        <tr key={ord.id}>
                          <td className="tv-num">{ts}</td>
                          <td>
                            <strong>{ord.symbol}</strong>
                          </td>
                          <td>
                            <span
                              className={`tv-badge-pill ${ord.side === 'buy' ? 'is-up' : 'is-down'}`}
                            >
                              {ord.side === 'buy' ? 'ACQ' : 'VEN'}
                            </span>
                          </td>
                          <td style={{ textTransform: 'uppercase' }}>{ord.type}</td>
                          <td className="is-num">{ord.quantity}</td>
                          <td className="is-num">
                            {ord.filledPrice !== undefined
                              ? formatPrice(ord.filledPrice, prec)
                              : '—'}
                          </td>
                          <td
                            className={`is-num ${
                              ord.realizedPnl === undefined
                                ? ''
                                : ord.realizedPnl >= 0
                                  ? 'tv-val-up'
                                  : 'tv-val-down'
                            }`}
                          >
                            {ord.realizedPnl !== undefined
                              ? `${ord.realizedPnl > 0 ? '+' : ''}${formatPrice(ord.realizedPnl, 2)} €`
                              : '—'}
                          </td>
                          <td>
                            <span
                              className={`tv-badge-pill ${statusClass}`}
                              title={ord.rejectReason}
                            >
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
