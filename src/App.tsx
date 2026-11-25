import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { TradingViewProvider, useActivePane, useTradingView } from './store';
import { SiteFooter, SiteHeader } from './components/layout';
import { ModalHost } from './components/modals';
import { AlertToastStack } from './components/panels';
import { HomePage } from './pages/HomePage';
import { MarketsPage } from './pages/MarketsPage';
import { ChartPage } from './pages/ChartPage';
import { HeatmapPage } from './pages/HeatmapPage';
import { ScreenerPage } from './pages/ScreenerPage';
import { CalendarPage } from './pages/CalendarPage';
import { CommunityPage } from './pages/CommunityPage';

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
              Ricarica TradingView Italia
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--tv-body-bg)',
      }}
    >
      <SiteHeader />
      <div style={{ flex: 1 }}>{children}</div>
      <SiteFooter />
    </div>
  );
}

function AppRouterShell() {
  const { route } = useTradingView();
  const { activeSymbol } = useActivePane();

  // Reset scroll position when switching top-level views
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [route.view]);

  // Keep browser tab title synchronized with the active Italian view
  useEffect(() => {
    if (typeof document === 'undefined') return;
    switch (route.view) {
      case 'chart':
        document.title = `${activeSymbol.ticker} (${activeSymbol.exchange}) — Supercharts | TradingView`;
        break;
      case 'markets':
        document.title = 'Mercati, ovunque — TradingView Italia';
        break;
      case 'screener':
        document.title = 'Screener Azioni, Cripto & Forex — TradingView Italia';
        break;
      case 'heatmap':
        document.title = 'Mappa di calore dei mercati — TradingView Italia';
        break;
      case 'calendar':
        document.title = 'Calendario economico — TradingView Italia';
        break;
      case 'community':
        document.title = 'Idee della community e Script — TradingView Italia';
        break;
      case 'home':
      default:
        document.title = 'TradingView — Monitora tutti i mercati';
        break;
    }
  }, [route.view, activeSymbol.ticker, activeSymbol.exchange]);

  const renderView = () => {
    switch (route.view) {
      case 'home':
        // HomePage includes its own transparentOverHero SiteHeader & SiteFooter
        return <HomePage />;
      case 'markets':
        // MarketsPage includes its own SiteHeader & SiteFooter
        return <MarketsPage />;
      case 'chart':
        // Full-viewport 100vh Supercharts workspace (includes AlertToastStack)
        return <ChartPage />;
      case 'heatmap':
        return (
          <PortalShell>
            <HeatmapPage />
          </PortalShell>
        );
      case 'screener':
        return (
          <PortalShell>
            <ScreenerPage />
          </PortalShell>
        );
      case 'calendar':
        return (
          <PortalShell>
            <CalendarPage />
          </PortalShell>
        );
      case 'community':
        return (
          <PortalShell>
            <CommunityPage />
          </PortalShell>
        );
      default:
        return <HomePage />;
    }
  };

  return (
    <>
      {renderView()}
      {/* Global Modals (Ctrl+K, ?, Indicatori, Confronta, Avvisi, Impostazioni, Istantanea) */}
      <ModalHost />
      {/* Alert Toasts on non-chart pages (ChartPage mounts AlertToastStack internally) */}
      {route.view !== 'chart' && <AlertToastStack />}
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
