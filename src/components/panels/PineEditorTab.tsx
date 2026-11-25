import { useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  LineChart,
  Play,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { PINE_TEMPLATES } from '../../engine';
import { useTradingView } from '../../store';

export function PineEditorTab() {
  const {
    pineCode,
    setPineCode,
    pineResult,
    pineAppliedToChart,
    runPineScript,
    applyPineToChart,
    clearPineFromChart,
    loadPineTemplate,
    setBottomPanel,
  } = useTradingView();

  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = pineCode.split('\n');

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = `${pineCode.slice(0, start)}    ${pineCode.slice(end)}`;
      setPineCode(next);
      requestAnimationFrame(() => {
        target.selectionStart = start + 4;
        target.selectionEnd = start + 4;
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      applyPineToChart();
    }
  };

  const errors =
    pineResult?.diagnostics.filter((d) => d.severity === 'error') ?? [];
  const warnings =
    pineResult?.diagnostics.filter((d) => d.severity === 'warning') ?? [];

  return (
    <div className="tv-panel">
      <div className="tv-drawer-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ color: 'var(--tv-text-heading, #fff)', fontSize: 12.5 }}>
            {pineResult?.scriptName ?? 'Pine Script v5'}
          </strong>

          <select
            className="tv-select-compact"
            aria-label="Carica modello Pine Script"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                loadPineTemplate(e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>
              Modelli Pine...
            </option>
            {PINE_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          <button
            type="button"
            className="tv-btn-sm"
            onClick={() => runPineScript()}
            title="Compila ed esegui lo script"
          >
            <Play size={12} />
            Esegui
          </button>

          <button
            type="button"
            className="tv-btn-sm is-primary"
            onClick={() => applyPineToChart()}
            title="Aggiungi al grafico (Ctrl+Invio)"
          >
            <PlusCircle size={13} />
            Aggiungi al grafico
          </button>

          {pineAppliedToChart && (
            <button
              type="button"
              className="tv-btn-sm is-danger-ghost"
              onClick={clearPineFromChart}
            >
              <Trash2 size={12} />
              Rimuovi dal grafico
            </button>
          )}

          {pineResult?.backtest && (
            <button
              type="button"
              className="tv-btn-sm"
              onClick={() => setBottomPanel('strategy')}
            >
              <LineChart size={12} />
              Apri Tester
            </button>
          )}
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="tv-pine-editor-wrap">
        <div ref={gutterRef} className="tv-pine-gutter" aria-hidden="true">
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        <textarea
          className="tv-pine-textarea"
          spellCheck={false}
          aria-label="Editor di codice Pine Script"
          value={pineCode}
          onChange={(e) => setPineCode(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Console / Diagnostics Footer */}
      <div className="tv-pine-console">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {errors.length > 0 ? (
            <>
              <AlertCircle
                size={14}
                style={{ color: 'var(--tv-down, #f23645)', flexShrink: 0 }}
              />
              <span className="tv-val-down">
                Riga {errors[0].line}: {errors[0].message}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2
                size={14}
                style={{ color: 'var(--tv-up, #22ab94)', flexShrink: 0 }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pineResult?.logs[0] ?? 'Pronto. Premi Ctrl+Invio per applicare sul grafico.'}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {warnings.length > 0 && (
            <span className="tv-badge-pill is-warn">
              {warnings.length} avvisi
            </span>
          )}
          {pineAppliedToChart && (
            <span className="tv-badge-pill is-up">Applicato al grafico</span>
          )}
        </div>
      </div>
    </div>
  );
}
