import React from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { useTradingView } from '../../store';

export const SiteFooter: React.FC = () => {
  const { theme, toggleTheme, navigate, openSymbolInChart, setBottomPanel, openModal } =
    useTradingView();

  const openChartTab = (tab: 'pine' | 'trading' | 'screener') => {
    setBottomPanel(tab);
    navigate('chart');
  };

  return (
    <footer id="site-footer" className="tv-site-footer" role="contentinfo">
      <div className="tv-container">
        <div className="tv-footer-grid">
          {/* Column 0: Brand & Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button
              type="button"
              className="tv-brand-logo"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => navigate('home')}
            >
              <svg
                width="30"
                height="22"
                viewBox="0 0 36 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M14 22H7V11H0V4h14v18z" fill="currentColor" />
                <path d="M28 22h-8l7.5-18h8L28 22z" fill="currentColor" />
                <circle cx="20" cy="8" r="4" fill="#2962FF" />
              </svg>
              <span>TradingView</span>
            </button>

            <p className="tv-text-secondary" style={{ fontSize: 13 }}>
              Realizzato da umani — Guarda prima, poi agisci.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="tv-btn tv-btn-secondary tv-btn-sm"
                style={{ cursor: 'default' }}
              >
                <Globe size={14} />
                Italiano
              </span>
              <button
                type="button"
                className="tv-btn tv-btn-secondary tv-btn-sm"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
              </button>
            </div>
          </div>

          {/* Column 1: Prodotti */}
          <div>
            <div className="tv-footer-col__title">Prodotti</div>
            <ul className="tv-footer-col__list">
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('chart')}
                >
                  Supercharts
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('screener')}
                >
                  Screener Azioni &amp; Cripto
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('heatmap')}
                >
                  Heatmap Azioni
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('calendar')}
                >
                  Calendario economico
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openChartTab('pine')}
                >
                  Pine Script® Editor
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openChartTab('trading')}
                >
                  Paper Trading
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Azienda */}
          <div>
            <div className="tv-footer-col__title">Azienda</div>
            <ul className="tv-footer-col__list">
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('markets')}
                >
                  Panoramica mercati
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openSymbolInChart('FTSEMIB')}
                >
                  Borsa Italiana (FTSE MIB)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openModal('shortcuts')}
                >
                  Centro di supporto &amp; scorciatoie
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('home')}
                >
                  Condizioni d’uso e privacy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('home')}
                >
                  Dichiarazione di accessibilità
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Community */}
          <div>
            <div className="tv-footer-col__title">Community</div>
            <ul className="tv-footer-col__list">
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('community')}
                >
                  Idee di trading
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('community')}
                >
                  Selezione editoriale
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('community')}
                >
                  Indicatori e strategie
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openChartTab('pine')}
                >
                  Tester strategia Pine
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('community')}
                >
                  Regolamento &amp; Moderatori
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Per le aziende */}
          <div>
            <div className="tv-footer-col__title">Per le aziende</div>
            <ul className="tv-footer-col__list">
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('chart')}
                >
                  Widget e Librerie grafiche
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('chart')}
                >
                  Grafici avanzati
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => openChartTab('trading')}
                >
                  Integrazione broker
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('markets')}
                >
                  Dati di mercato
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="tv-footer-col__link"
                  onClick={() => navigate('home')}
                >
                  Programma di formazione
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="tv-footer-bottom">
          <p className="tv-text-muted" style={{ fontSize: 12, maxWidth: 840, lineHeight: 1.5 }}>
            Avvertenza: questa applicazione è una ricostruzione interattiva basata su analisi REA
            di <code style={{ fontFamily: 'var(--tv-font-mono)' }}>it.tradingview.com</code>. Le
            78 coppie cripto trasmettono quotazioni e candele in tempo reale tramite API/WebSocket
            pubblici Binance, mentre azioni USA, Borsa Italiana, indici, forex, futures ed ETF
            utilizzano dati pubblici Yahoo Finance e snapshot di mercato pre-caricato (con fallback
            automatico a simulazione offline) esclusivamente a scopo dimostrativo e didattico — non
            costituisce consulenza finanziaria.
          </p>
          <span className="tv-text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            © 2026 TradingView Italia — Ricostruzione REA
          </span>
        </div>

        <div className="tv-footer-watermark" aria-hidden="true">
          LOOK FIRST / THEN LEAP
        </div>
      </div>
    </footer>
  );
};
