import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Filter,
  LineChart,
  Maximize2,
  Minimize2,
  ScrollText,
  Wallet,
} from 'lucide-react';
import {
  usePaperTrading,
  useTradingView,
  type BottomPanelTab,
} from '../../store';
import { LogTab } from './LogTab';
import { PaperTradingTab } from './PaperTradingTab';
import { PineEditorTab } from './PineEditorTab';
import { ScreenerTab } from './ScreenerTab';
import { StrategyTesterTab } from './StrategyTesterTab';

interface TabDef {
  id: Exclude<BottomPanelTab, null>;
  label: string;
  Icon: typeof Filter;
}

const BOTTOM_TABS: TabDef[] = [
  { id: 'screener', label: 'Screener azioni', Icon: Filter },
  { id: 'pine', label: 'Editor Pine', Icon: Code2 },
  { id: 'strategy', label: 'Tester strategia', Icon: LineChart },
  { id: 'trading', label: 'Pannello di trading', Icon: Wallet },
  { id: 'log', label: 'Registro', Icon: ScrollText },
];

const MIN_HEIGHT = 190;
const MAX_HEIGHT = 580;

export function BottomDrawer() {
  const {
    bottomPanel,
    setBottomPanel,
    toggleBottomPanel,
    bottomPanelExpanded,
    toggleBottomPanelExpanded,
    bottomPanelHeight,
    setBottomPanelHeight,
    pineResult,
    activityLog,
  } = useTradingView();
  const { account } = usePaperTrading();

  const [dragging, setDragging] = useState(false);

  const isOpen = bottomPanel !== null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomPanelHeight;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setBottomPanelHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + delta)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getBadge = (id: Exclude<BottomPanelTab, null>): number | null => {
    if (id === 'trading' && account.positions.length > 0) {
      return account.positions.length;
    }
    if (id === 'strategy' && pineResult?.backtest?.totalTrades) {
      return pineResult.backtest.totalTrades;
    }
    if (id === 'log' && activityLog.length > 0) {
      return activityLog.length;
    }
    return null;
  };

  const contentHeightStyle = bottomPanelExpanded
    ? { height: '56vh' }
    : { height: `${bottomPanelHeight}px` };

  return (
    <section
      className="tv-bottom-drawer"
      aria-label="Pannello inferiore Supercharts"
    >
      {isOpen && (
        <div
          className={`tv-resize-handle-y${dragging ? ' is-dragging' : ''}`}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Ridimensiona pannello inferiore"
          onMouseDown={handleMouseDown}
        />
      )}

      <div className="tv-bottom-bar">
        <div className="tv-bottom-tabs" role="tablist">
          {BOTTOM_TABS.map(({ id, label, Icon }) => {
            const active = bottomPanel === id;
            const badge = getBadge(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`tv-bottom-tab${active ? ' is-active' : ''}`}
                onClick={() => toggleBottomPanel(id)}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span>{label}</span>
                {badge !== null && <span className="tv-tab-count">{badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="tv-panel-actions">
          {isOpen && (
            <button
              type="button"
              className="tv-panel-icon-btn"
              title={bottomPanelExpanded ? 'Ripristina dimensione' : 'Espandi pannello'}
              aria-label={bottomPanelExpanded ? 'Ripristina dimensione' : 'Espandi pannello'}
              onClick={toggleBottomPanelExpanded}
            >
              {bottomPanelExpanded ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          )}

          <button
            type="button"
            className="tv-panel-icon-btn"
            title={isOpen ? 'Comprimi pannello inferiore' : 'Apri pannello inferiore'}
            aria-label={isOpen ? 'Comprimi pannello inferiore' : 'Apri pannello inferiore'}
            onClick={() => setBottomPanel(isOpen ? null : 'trading')}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="tv-bottom-content" style={contentHeightStyle}>
          {bottomPanel === 'screener' && <ScreenerTab />}
          {bottomPanel === 'pine' && <PineEditorTab />}
          {bottomPanel === 'strategy' && <StrategyTesterTab />}
          {bottomPanel === 'trading' && <PaperTradingTab />}
          {bottomPanel === 'log' && <LogTab />}
        </div>
      )}
    </section>
  );
}
