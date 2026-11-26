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
    title: 'Layout, Ricerca e Finestre',
    items: [
      { keys: ['Ctrl', 'S'], label: 'Salva layout grafico' },
      { keys: ['Ctrl', 'K'], label: 'Ricerca simboli globale' },
      { keys: ['/'], label: 'Ricerca simboli rapida' },
      { keys: ['Alt', 'G'], label: 'Vai a una data specifica' },
      { keys: ['Shift', 'F'], label: 'Schermo intero' },
      { keys: ['?'], label: 'Scorciatoie da tastiera' },
      { keys: ['Esc'], label: 'Croce / Annulla / Chiudi finestra' },
    ],
  },
  {
    title: 'Zoom, Assi e Navigazione',
    items: [
      { keys: ['Rotella'], label: 'Zoom ancorato al bordo destro' },
      { keys: ['Ctrl', 'Rotella'], label: 'Zoom ancorato al cursore' },
      { keys: ['Shift', 'Rotella'], label: 'Scorri orizzontalmente il grafico' },
      { keys: ['Ctrl', '↑', '↓'], label: 'Zoom avanti / indietro' },
      { keys: ['←', '→'], label: 'Scorri barre (Shift / Ctrl per scorrere veloce)' },
      { keys: ['Alt', 'Shift', '←', '→'], label: 'Vai all’inizio / torna al presente' },
      { keys: ['Home', 'End'], label: 'Inizio storico / Ultima barra' },
      { keys: ['Rotella Asse Prezzi'], label: 'Zoom verticale (disattiva Auto)' },
      { keys: ['Doppio clic Asse'], label: 'Ripristina scala automatica (Auto)' },
      { keys: ['Alt', 'R'], label: 'Reimposta la visualizzazione del grafico' },
      { keys: ['Alt', 'I'], label: 'Inverti asse prezzi' },
      { keys: ['Alt', 'L'], label: 'Scala logaritmica' },
      { keys: ['Alt', 'P'], label: 'Scala percentuale (%)' },
    ],
  },
  {
    title: 'Strumenti di Disegno e Misura',
    items: [
      { keys: ['Shift', 'Clic'], label: 'Misura rapida sul grafico' },
      { keys: ['Shift', 'Disegna'], label: 'Vincola angolo 45° / quadrato / cerchio' },
      { keys: ['Ctrl', 'Drag'], label: 'Duplica disegno trascinando' },
      { keys: ['Ctrl', 'C', 'V'], label: 'Copia e incolla disegno' },
      { keys: ['Ctrl'], label: 'Magnete debole temporaneo (tieni premuto)' },
      { keys: ['Alt', 'T'], label: 'Trendline' },
      { keys: ['Alt', 'H'], label: 'Linea orizzontale' },
      { keys: ['Alt', 'V'], label: 'Linea verticale' },
      { keys: ['Alt', 'J'], label: 'Raggio orizzontale' },
      { keys: ['Alt', 'C'], label: 'Linea trasversale' },
      { keys: ['Alt', 'F'], label: 'Ritracciamento Fib' },
      { keys: ['Alt', 'Shift', 'R'], label: 'Rettangolo' },
      { keys: ['Ctrl', 'Z'], label: 'Annulla ultimo disegno' },
      { keys: ['Ctrl', 'Y'], label: 'Ripeti disegno annullato' },
      { keys: ['Canc'], label: 'Elimina disegno selezionato' },
    ],
  },
  {
    title: 'Alert, Istantanea e Timeframe',
    items: [
      { keys: ['Alt', 'A'], label: 'Crea nuovo alert sul simbolo' },
      { keys: ['Alt', 'S'], label: 'Istantanea del grafico (PNG)' },
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
                Layout, zoom, gestures assi, strumenti di disegno e comandi rapidi Supercharts
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
              placeholder="Filtra scorciatoie (es. Salva, Zoom, Calamita, Misura, Fibonacci)..."
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
