import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { TradingViewProvider, useActivePane } from './store';
import { ModalHost } from './components/modals';
import { ChartPage } from './pages/ChartPage';

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

function AppRouterShell() {
  const { activeSymbol } = useActivePane();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = `${activeSymbol.ticker} (${activeSymbol.exchange}) — Supercharts`;
  }, [activeSymbol.ticker, activeSymbol.exchange]);

  return (
    <>
      <ChartPage />
      <ModalHost />
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
