import { useMemo, useState } from 'react';
import { ECONOMIC_CALENDAR } from '../../data';

const COUNTRY_FLAGS: Record<string, string> = {
  IT: '🇮🇹',
  EU: '🇪🇺',
  US: '🇺🇸',
  DE: '🇩🇪',
  GB: '🇬🇧',
  JP: '🇯🇵',
  CN: '🇨🇳',
};

type ImpactFilter = 'all' | 3 | 2 | 1;

export function CalendarPanel() {
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');

  const groupedEvents = useMemo(() => {
    const filtered = ECONOMIC_CALENDAR.filter((evt) =>
      impactFilter === 'all' ? true : evt.impact === impactFilter,
    );
    const groups = new Map<string, typeof filtered>();
    for (const evt of filtered) {
      const list = groups.get(evt.date) ?? [];
      list.push(evt);
      groups.set(evt.date, list);
    }
    return Array.from(groups.entries());
  }, [impactFilter]);

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    return d.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <div className="tv-panel">
      <div className="tv-panel-header">
        <h3 className="tv-panel-title">Calendario economico</h3>
        <span className="tv-badge-pill">CET</span>
      </div>

      <div className="tv-chip-row">
        {(
          [
            ['all', 'Tutti'],
            [3, 'Alto'],
            [2, 'Medio'],
            [1, 'Basso'],
          ] as const
        ).map(([val, label]) => (
          <button
            key={String(val)}
            type="button"
            className={`tv-chip${impactFilter === val ? ' is-active' : ''}`}
            onClick={() => setImpactFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tv-panel-body">
        {groupedEvents.length === 0 ? (
          <div className="tv-empty-state">Nessun evento per il filtro selezionato.</div>
        ) : (
          groupedEvents.map(([date, events]) => (
            <div key={date}>
              <div
                className="tv-wl-group-header"
                style={{ cursor: 'default' }}
              >
                <span>{formatDateHeader(date)}</span>
                <span>{events.length}</span>
              </div>

              {events.map((evt) => {
                const dotClass =
                  evt.impact === 3
                    ? 'is-high'
                    : evt.impact === 2
                      ? 'is-med'
                      : 'is-low';
                return (
                  <div key={evt.id} className="tv-list-card">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>
                          {COUNTRY_FLAGS[evt.country] ?? '🌐'}
                        </span>
                        <span
                          className="tv-num"
                          style={{
                            fontSize: 11,
                            color: 'var(--tv-text-secondary, #8c8c8c)',
                          }}
                        >
                          {evt.time}
                        </span>
                        <span className="tv-badge-pill">{evt.institution}</span>
                      </div>

                      <div
                        className="tv-impact-dots"
                        title={`Impatto ${evt.impact}/3`}
                      >
                        {[1, 2, 3].map((idx) => (
                          <span
                            key={idx}
                            className={`tv-impact-dot${idx <= evt.impact ? ` ${dotClass}` : ''}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--tv-text-heading, #fff)',
                        lineHeight: 1.35,
                      }}
                    >
                      {evt.title}
                    </div>

                    <div className="tv-eco-nums">
                      <div className="tv-eco-col">
                        <span>Attuale</span>
                        <span
                          style={{
                            color: evt.actual
                              ? 'var(--tv-brand-soft-text, #90bff9)'
                              : 'var(--tv-text-muted, #707070)',
                          }}
                        >
                          {evt.actual ?? '—'}
                        </span>
                      </div>
                      <div className="tv-eco-col">
                        <span>Previsto</span>
                        <span>{evt.forecast ?? '—'}</span>
                      </div>
                      <div className="tv-eco-col">
                        <span>Precedente</span>
                        <span>{evt.previous ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
