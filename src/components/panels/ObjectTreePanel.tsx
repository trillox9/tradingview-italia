import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Settings,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  DRAWING_TOOL_REGISTRY,
  normalizeDrawingTool,
  type DrawingToolType,
} from '../../types';
import { useActivePane, useDrawings, useTradingView } from '../../store';

function getDrawingLabelIt(type: DrawingToolType): string {
  const canonical = normalizeDrawingTool(type);
  return DRAWING_TOOL_REGISTRY[canonical]?.labelIt ?? type;
}

export function ObjectTreePanel() {
  const { openModal, pineAppliedToChart, pineResult, clearPineFromChart } =
    useTradingView();
  const {
    activePane,
    activeSymbol,
    toggleIndicatorVisibility,
    removeIndicator,
    clearAllObjects,
  } = useActivePane();
  const {
    drawings,
    selectedDrawingId,
    setSelectedDrawingId,
    updateDrawing,
    deleteDrawing,
    cloneDrawing,
    bringToFront,
    sendToBack,
    openDrawingSettings,
    clearDrawings,
  } = useDrawings();

  const totalObjects =
    activePane.indicators.length +
    (pineAppliedToChart ? 1 : 0) +
    drawings.length;

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Albero degli oggetti</h3>
        <div className="tv-panel-actions">
          {totalObjects > 0 && (
            <button
              type="button"
              className="tv-panel-icon-btn"
              title="Rimuovi tutti gli indicatori e disegni"
              aria-label="Rimuovi tutti gli oggetti"
              onClick={() => clearAllObjects()}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button"
            className="tv-panel-icon-btn"
            title="Aggiungi indicatore"
            aria-label="Aggiungi indicatore"
            onClick={() => openModal('indicators')}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="tv-panel-body">
        {/* Primary Series */}
        <div className="tv-kv-section">
          <div className="tv-kv-section-title">Serie principale</div>
          <div className="tv-kv-row">
            <span className="tv-kv-key">
              <span
                className="tv-color-dot"
                style={{ backgroundColor: activeSymbol.logoColor }}
              />
              <strong style={{ color: 'var(--tv-text-heading, #fff)' }}>
                {activeSymbol.ticker}
              </strong>
              <span>({activePane.timeframe})</span>
            </span>
            <span className="tv-badge-pill">{activeSymbol.exchange}</span>
          </div>
        </div>

        {/* Active Indicators */}
        <div className="tv-kv-section">
          <div className="tv-kv-section-title">
            Indicatori ({activePane.indicators.length + (pineAppliedToChart ? 1 : 0)})
          </div>

          {activePane.indicators.length === 0 && !pineAppliedToChart ? (
            <div style={{ fontSize: 11.5, color: 'var(--tv-text-muted, #707070)' }}>
              Nessun indicatore attivo su questo grafico.
            </div>
          ) : (
            <>
              {activePane.indicators.map((ind) => {
                const primaryColor =
                  Object.values(ind.styles)[0]?.color ?? '#2962FF';
                return (
                  <div key={ind.id} className="tv-kv-row">
                    <span
                      className="tv-kv-key"
                      style={{ opacity: ind.visible ? 1 : 0.45 }}
                    >
                      <span
                        className="tv-color-dot"
                        style={{ backgroundColor: primaryColor }}
                      />
                      {ind.name}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button
                        type="button"
                        className="tv-panel-icon-btn"
                        title={ind.visible ? 'Nascondi' : 'Mostra'}
                        aria-label={ind.visible ? 'Nascondi indicatore' : 'Mostra indicatore'}
                        onClick={() => toggleIndicatorVisibility(ind.id)}
                      >
                        {ind.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        type="button"
                        className="tv-panel-icon-btn"
                        title="Rimuovi indicatore"
                        aria-label="Rimuovi indicatore"
                        onClick={() => removeIndicator(ind.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {pineAppliedToChart && pineResult && (
                <div className="tv-kv-row">
                  <span className="tv-kv-key">
                    <span
                      className="tv-color-dot"
                      style={{ backgroundColor: '#7E57C2' }}
                    />
                    {pineResult.scriptName} (Pine)
                  </span>
                  <button
                    type="button"
                    className="tv-panel-icon-btn"
                    title="Rimuovi script Pine dal grafico"
                    aria-label="Rimuovi script Pine dal grafico"
                    onClick={clearPineFromChart}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Per-symbol Drawings */}
        <div className="tv-kv-section">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div className="tv-kv-section-title" style={{ marginBottom: 0 }}>
              Disegni su {activeSymbol.ticker} ({drawings.length})
            </div>
            {drawings.length > 0 && (
              <button
                type="button"
                className="tv-btn-sm is-danger-ghost"
                style={{ padding: '2px 6px', fontSize: 10.5 }}
                onClick={() => clearDrawings(activeSymbol.ticker)}
              >
                Rimuovi tutti
              </button>
            )}
          </div>

          {drawings.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--tv-text-muted, #707070)' }}>
              Nessun disegno presente su {activeSymbol.ticker}. Usa la barra sinistra per tracciare linee, Fibonacci o pattern.
            </div>
          ) : (
            drawings.map((drw, idx) => {
              const isSelected = drw.id === selectedDrawingId;
              const label =
                drw.text?.trim() || `${getDrawingLabelIt(drw.type)} #${idx + 1}`;
              return (
                <div
                  key={drw.id}
                  className="tv-kv-row"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: isSelected
                      ? 'var(--tv-brand-soft, #132042)'
                      : undefined,
                  }}
                  onClick={() => setSelectedDrawingId(drw.id)}
                >
                  <span
                    className="tv-kv-key"
                    style={{ opacity: drw.visible ? 1 : 0.45 }}
                    title={label}
                  >
                    <span
                      className="tv-color-dot"
                      style={{ backgroundColor: drw.style.color }}
                    />
                    {label}
                  </span>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title="Impostazioni disegno"
                      aria-label="Impostazioni disegno"
                      onClick={() => openDrawingSettings(drw.id)}
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title="Clona disegno"
                      aria-label="Clona disegno"
                      onClick={() => cloneDrawing(drw.id, activeSymbol.ticker)}
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title="Porta in primo piano"
                      aria-label="Porta in primo piano"
                      onClick={() => bringToFront(drw.id, activeSymbol.ticker)}
                    >
                      <ArrowUpToLine size={12} />
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title="Porta in secondo piano"
                      aria-label="Porta in secondo piano"
                      onClick={() => sendToBack(drw.id, activeSymbol.ticker)}
                    >
                      <ArrowDownToLine size={12} />
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title={drw.visible ? 'Nascondi disegno' : 'Mostra disegno'}
                      onClick={() =>
                        updateDrawing(activeSymbol.ticker, drw.id, {
                          visible: !drw.visible,
                        })
                      }
                    >
                      {drw.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title={drw.locked ? 'Sblocca disegno' : 'Blocca disegno'}
                      onClick={() =>
                        updateDrawing(activeSymbol.ticker, drw.id, {
                          locked: !drw.locked,
                        })
                      }
                    >
                      {drw.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button
                      type="button"
                      className="tv-panel-icon-btn"
                      title="Elimina disegno"
                      onClick={() => deleteDrawing(activeSymbol.ticker, drw.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
