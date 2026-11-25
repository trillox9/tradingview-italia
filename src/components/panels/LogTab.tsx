import { useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  Briefcase,
  Code2,
  Compass,
  PenTool,
  Trash2,
} from 'lucide-react';
import { useTradingView, type ActivityCategory } from '../../store';

const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; Icon: typeof Activity }
> = {
  order: { label: 'Ordini', Icon: Briefcase },
  alert: { label: 'Avvisi', Icon: Bell },
  pine: { label: 'Pine', Icon: Code2 },
  symbol: { label: 'Simboli', Icon: Compass },
  drawing: { label: 'Disegni', Icon: PenTool },
  system: { label: 'Sistema', Icon: Activity },
};

export function LogTab() {
  const { activityLog, clearActivityLog } = useTradingView();
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');

  const entries = useMemo(() => {
    if (filter === 'all') return activityLog;
    return activityLog.filter((e) => e.category === filter);
  }, [activityLog, filter]);

  return (
    <div className="tv-panel">
      <div className="tv-drawer-toolbar" style={{ padding: '6px 12px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`tv-chip${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tutti ({activityLog.length})
          </button>
          {(Object.keys(CATEGORY_META) as ActivityCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`tv-chip${filter === cat ? ' is-active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="tv-btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={clearActivityLog}
        >
          <Trash2 size={12} />
          Pulisci registro
        </button>
      </div>

      <div className="tv-panel-body">
        {entries.length === 0 ? (
          <div className="tv-empty-state">Nessuna voce nel registro attività.</div>
        ) : (
          entries.map((entry) => {
            const { label, Icon } = CATEGORY_META[entry.category];
            const timeStr = new Date(entry.timestamp).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const levelClass =
              entry.level === 'success'
                ? 'is-up'
                : entry.level === 'error'
                  ? 'is-down'
                  : entry.level === 'warning'
                    ? 'is-warn'
                    : 'is-brand';

            return (
              <div
                key={entry.id}
                className="tv-list-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '7px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Icon
                    size={14}
                    style={{ color: 'var(--tv-text-secondary, #8c8c8c)', flexShrink: 0 }}
                  />
                  <span className={`tv-badge-pill ${levelClass}`}>{label}</span>
                  <strong
                    style={{
                      color: 'var(--tv-text-heading, #fff)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {entry.title}
                  </strong>
                  {entry.detail && (
                    <span
                      style={{
                        color: 'var(--tv-text-secondary, #8c8c8c)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      — {entry.detail}
                    </span>
                  )}
                </div>

                <span
                  className="tv-num"
                  style={{
                    fontSize: 11,
                    color: 'var(--tv-text-muted, #707070)',
                    flexShrink: 0,
                  }}
                >
                  {timeStr}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
