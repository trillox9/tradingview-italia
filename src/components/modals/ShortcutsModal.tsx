import { useCallback, useMemo, useState } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { useTradingView } from '../../store';

export interface ShortcutsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Ricerca e Navigazione',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Ricerca simboli globale' },
      { keys: ['/'], label: 'Cerca simbolo rapido' },
      { keys: ['?'], label: 'Apri scorciatoie da tastiera' },
      { keys: ['Esc'], label: 'Mirino / Chiudi finestra' },
    ],
  },
  {
    title: 'Timeframe Grafico',
    items: [
      { keys: ['1'], label: 'Timeframe 1 minuto (1m)' },
      { keys: ['2'], label: 'Timeframe 5 minuti (5m)' },
      { keys: ['3'], label: 'Timeframe 15 minuti (15m)' },
      { keys: ['4'], label: 'Timeframe 1 ora (1H)' },
      { keys: ['5'], label: 'Timeframe 4 ore (4H)' },
      { keys: ['6'], label: 'Timeframe 1 giorno (1D)' },
      { keys: ['7'], label: 'Timeframe 1 settimana (1W)' },
      { keys: ['8'], label: 'Timeframe 1 mese (1M)' },
    ],
  },
  {
    title: 'Strumenti di Disegno',
    items: [
      { keys: ['Alt', 'T'], label: 'Linea di tendenza (Trendline)' },
      { keys: ['Alt', 'H'], label: 'Linea orizzontale' },
      { keys: ['Alt', 'F'], label: 'Ritracciamento di Fibonacci' },
      { keys: ['Ctrl', 'Z'], label: 'Annulla ultimo disegno' },
      { keys: ['Ctrl', 'Y'], label: 'Ripeti disegno annullato' },
    ],
  },
  {
    title: 'Azioni e Vista Grafico',
    items: [
      { keys: ['Alt', 'R'], label: 'Reset vista grafico' },
      { keys: ['Alt', 'A'], label: 'Crea nuovo avviso sul simbolo' },
      { keys: ['Alt', 'S'], label: 'Istantanea del grafico (PNG)' },
      { keys: ['↑', '↓'], label: 'Naviga risultati ricerca' },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const { modals, closeModal } = useTradingView();
  const visible = isOpen ?? modals.shortcuts;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('shortcuts');
  }, [closeModal, onClose]);

  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;
    return SHORTCUT_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keys.join(' ').toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  if (!visible) return null;

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Scorciatoie da tastiera"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="tvm-dialog tvm-dialog--lg">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <Keyboard size={19} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div>
              <h2 className="tvm-title">Scorciatoie da tastiera</h2>
              <div className="tvm-subtitle">
                Velocizza la navigazione e l’analisi tecnica su Supercharts
              </div>
            </div>
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

        <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tvm-search-wrap">
            <Search size={16} />
            <input
              type="text"
              className="tvm-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra scorciatoie (es. Trendline, Timeframe, Fibonacci)..."
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="tvm-close-btn"
                style={{ width: 24, height: 24 }}
                onClick={() => setQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {filteredGroups.length === 0 ? (
            <div className="tvp-empty-state">
              <Keyboard size={28} />
              <div>Nessuna scorciatoia trovata per &ldquo;{query}&rdquo;.</div>
            </div>
          ) : (
            <div className="tvm-shortcuts-grid">
              {filteredGroups.map((group) => (
                <div key={group.title} className="tvm-shortcut-group">
                  <div className="tvm-shortcut-group-title">{group.title}</div>
                  {group.items.map((item) => (
                    <div key={`${group.title}-${item.label}`} className="tvm-shortcut-row">
                      <span>{item.label}</span>
                      <span className="tvm-shortcut-keys">
                        {item.keys.map((k, idx) => (
                          <span
                            key={`${item.label}-${k}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {idx > 0 && (
                              <span style={{ color: 'var(--tv-text-muted, #707070)', fontSize: '0.7rem' }}>
                                +
                              </span>
                            )}
                            <kbd className="tvm-kbd">{k}</kbd>
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tvm-footer">
          <span className="tvm-subtitle">
            Su macOS usa <kbd className="tvm-kbd">⌘</kbd> al posto di <kbd className="tvm-kbd">Ctrl</kbd>.
          </span>
          <div className="tvm-footer-actions">
            <button type="button" className="tvm-btn tvm-btn--primary" onClick={handleClose}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShortcutsModal;
