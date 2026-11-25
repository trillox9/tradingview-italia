import {
  BarChart3,
  Bell,
  Calendar,
  Flame,
  Keyboard,
  Layers,
  List,
  Newspaper,
} from 'lucide-react';
import { useAlerts, useTradingView, type RightPanelTab } from '../../store';

interface RailItem {
  id: Exclude<RightPanelTab, null>;
  label: string;
  Icon: typeof List;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'watchlist', label: 'Lista titoli e dettagli', Icon: List },
  { id: 'alerts', label: 'Avvisi', Icon: Bell },
  { id: 'data', label: 'Finestra dati', Icon: BarChart3 },
  { id: 'hotlists', label: 'Hotlist', Icon: Flame },
  { id: 'calendar', label: 'Calendario economico', Icon: Calendar },
  { id: 'news', label: 'Notizie', Icon: Newspaper },
  { id: 'objectTree', label: 'Albero degli oggetti', Icon: Layers },
];

export function RightToolRail() {
  const { rightPanel, toggleRightPanel, openModal } = useTradingView();
  const { alerts, triggeredToasts } = useAlerts();

  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const unreadAlertsCount = triggeredToasts.length;

  return (
    <aside
      className="tv-right-rail"
      aria-label="Barra strumenti laterale destra"
    >
      <div className="tv-right-rail-group">
        {RAIL_ITEMS.map(({ id, label, Icon }) => {
          const isActive = rightPanel === id;
          return (
            <button
              key={id}
              type="button"
              className={`tv-right-rail-btn${isActive ? ' is-active' : ''}`}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => toggleRightPanel(id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              {id === 'alerts' && unreadAlertsCount > 0 && (
                <span className="tv-rail-badge" title={`${unreadAlertsCount} avvisi attivati`}>
                  {unreadAlertsCount}
                </span>
              )}
              {id === 'alerts' && unreadAlertsCount === 0 && activeAlertsCount > 0 && (
                <span
                  className="tv-rail-badge is-brand"
                  title={`${activeAlertsCount} avvisi attivi`}
                >
                  {activeAlertsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="tv-right-rail-group">
        <div className="tv-rail-divider" />
        <button
          type="button"
          className="tv-right-rail-btn"
          title="Scorciatoie da tastiera (?)"
          aria-label="Scorciatoie da tastiera"
          onClick={() => openModal('shortcuts')}
        >
          <Keyboard size={17} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
