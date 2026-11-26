import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { TradingViewProvider, useActivePane, useTradingView } from './store';
import { ModalHost } from './components/modals';
import { AlertToastStack } from './components/panels';
import { ChartPage } from './pages/ChartPage';
import { HeatmapPage } from './pages/HeatmapPage';
import { ScreenerPage } from './pages/ScreenerPage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Errore imprevisto durante il rendering.',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error details rendered cleanly in the Italian fallback UI
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    if (typeof window !== 'undefined') {
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '24px',
            backgroundColor: 'var(--tv-body-bg, #000000)',
            color: 'var(--tv-text-primary, #dbdbdb)',
            fontFamily: "var(--tv-font-sans, 'Inter', sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              borderRadius: '12px',
              backgroundColor: 'var(--tv-bg-primary, #131313)',
              border: '1px solid var(--tv-border, #303030)',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                margin: '0 0 10px',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--tv-text-heading, #ffffff)',
              }}
            >
              Si è verificato un errore nell’applicazione
            </h1>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                color: 'var(--tv-text-secondary, #8c8c8c)',
              }}
            >
              {this.state.message}
            </p>
            <button
              type="button"
              className="tv-btn tv-btn-primary"
              onClick={this.handleReload}
            >
              Ricarica Supercharts
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

/**
 * Minimal Supercharts utility header shown only when user explicitly opens
 * `#/screener` or `#/heatmap` directly via hash URL.
 */
function ToolViewShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { navigate, theme, toggleTheme } = useTradingView();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--tv-body-bg, #000000)',
        color: 'var(--tv-text-primary, #d1d4dc)',
      }}
    >
      <header
        style={{
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          backgroundColor: 'var(--tv-toolbar-bg, #000000)',
          borderBottom: '1px solid var(--tv-toolbar-border, #303030)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="tv-btn-sm"
            onClick={() => navigate('chart')}
          >
            <ArrowLeft size={14} />
            <span>Torna ai Supercharts</span>
          </button>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--tv-text-heading, #ffffff)',
            }}
          >
            {title}
          </span>
        </div>

        <button
          type="button"
          className="tv-panel-icon-btn"
          title={theme === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
          aria-label="Cambia tema"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function AppRouterShell() {
  const { route } = useTradingView();
  const { activeSymbol } = useActivePane();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [route.view]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    switch (route.view) {
      case 'screener':
        document.title = 'Screener Mercati — Supercharts | TradingView';
        break;
      case 'heatmap':
        document.title = 'Mappa di calore — Supercharts | TradingView';
        break;
      default:
        document.title = `${activeSymbol.ticker} (${activeSymbol.exchange}) — Supercharts | TradingView`;
        break;
    }
  }, [route.view, activeSymbol.ticker, activeSymbol.exchange]);

  const isToolSubView = route.view === 'screener' || route.view === 'heatmap';

  const renderView = () => {
    if (route.view === 'screener') {
      return (
        <ToolViewShell title="Screener Azioni, Cripto & Forex">
          <ScreenerPage />
        </ToolViewShell>
      );
    }
    if (route.view === 'heatmap') {
      return (
        <ToolViewShell title="Mappa di calore dei mercati">
          <HeatmapPage />
        </ToolViewShell>
      );
    }
    // Full-viewport 100vh Supercharts Pro workspace (default for #/, #/chart/..., and all other paths)
    return <ChartPage />;
  };

  return (
    <>
      {renderView()}
      {/* Global Modals (Ctrl+K, ?, Indicatori, Confronta, Avvisi, Impostazioni, Istantanea) */}
      <ModalHost />
      {/* Alert Toasts on standalone tool sub-views (ChartPage mounts AlertToastStack internally) */}
      {isToolSubView && <AlertToastStack />}
    </>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <TradingViewProvider>
        <AppRouterShell />
      </TradingViewProvider>
    </AppErrorBoundary>
  );
}

export default App;
