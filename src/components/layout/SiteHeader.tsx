import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  Code2,
  Compass,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Keyboard,
  LayoutGrid,
  LineChart,
  Moon,
  Newspaper,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { useTradingView } from '../../store';
import type { AppView } from '../../store';

export interface SiteHeaderProps {
  /** When true (HomePage), renders transparent dark glass over the hero and turns solid on scroll */
  transparentOverHero?: boolean;
}

type NavMenuKey = 'prodotti' | 'community' | 'mercati' | 'broker' | 'altro' | 'lang' | 'user' | null;

const LANGUAGES = [
  { code: 'IT', label: 'Italiano', active: true },
  { code: 'EN', label: 'English' },
  { code: 'DE', label: 'Deutsch' },
  { code: 'FR', label: 'Français' },
  { code: 'ES', label: 'Español' },
  { code: 'PT', label: 'Português' },
  { code: 'JP', label: '日本語' },
];

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  transparentOverHero = false,
}) => {
  const {
    theme,
    toggleTheme,
    route,
    navigate,
    openSymbolInChart,
    setBottomPanel,
    openModal,
  } = useTradingView();

  const [openMenu, setOpenMenu] = useState<NavMenuKey>(null);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!transparentOverHero) {
      setScrolledPastHero(true);
      return;
    }
    const handleScroll = () => {
      setScrolledPastHero(window.scrollY > 56);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [transparentOverHero]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = (key: NavMenuKey) => {
    clearCloseTimer();
    setOpenMenu(key);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 140);
  };

  const go = (view: AppView, symbolId?: string) => {
    setOpenMenu(null);
    navigate(view, symbolId);
  };

  const goChartWithBottomTab = (tab: 'pine' | 'trading' | 'screener') => {
    setOpenMenu(null);
    setBottomPanel(tab);
    navigate('chart');
  };

  const goMarketsAnchor = (anchorId?: string) => {
    setOpenMenu(null);
    if (route.view !== 'markets') {
      navigate('markets');
    }
    if (anchorId) {
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const isOverHero = transparentOverHero && !scrolledPastHero;

  return (
    <header
      ref={headerRef}
      className={`tv-site-header${isOverHero ? ' is-over-hero' : ''}`}
      data-testid="site-header"
    >
      <div className="tv-site-header__inner">
        <div className="tv-site-header__left">
          {/* Brand Logo */}
          <button
            type="button"
            className="tv-brand-logo"
            aria-label="Pagina principale TradingView"
            onClick={() => go('home')}
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

          {/* Search Pill Trigger */}
          <button
            type="button"
            className="tv-header-search-btn"
            aria-label="Cerca"
            onClick={() => {
              setOpenMenu(null);
              openModal('symbolSearch');
            }}
          >
            <Search size={15} />
            <span>Cerca (Ctrl+K)</span>
          </button>

          {/* 5 Top-Level Italian Navigation Menus */}
          <nav className="tv-header-nav" aria-label="Navigazione principale">
            {/* 1. PRODOTTI */}
            <div
              className="tv-header-nav__item"
              onMouseEnter={() => handleMouseEnter('prodotti')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`tv-header-nav__trigger${
                  openMenu === 'prodotti' ? ' is-open' : ''
                }${
                  route.view === 'chart' ||
                  route.view === 'screener' ||
                  route.view === 'heatmap' ||
                  route.view === 'calendar'
                    ? ' is-active'
                    : ''
                }`}
                aria-expanded={openMenu === 'prodotti'}
                onClick={() => {
                  clearCloseTimer();
                  setOpenMenu('prodotti');
                }}
              >
                Prodotti
                <ChevronDown size={14} />
              </button>

              {openMenu === 'prodotti' && (
                <div className="tv-nav-dropdown" role="menu">
                  <button
                    type="button"
                    className="tv-nav-dropdown__hero-item"
                    role="menuitem"
                    onClick={() => go('chart')}
                  >
                    <LineChart size={20} color="#2962FF" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div className="tv-nav-dropdown__hero-title">Supercharts</div>
                      <div className="tv-nav-dropdown__hero-sub">
                        L’unico terminale, per domarli tutti
                      </div>
                    </div>
                  </button>

                  <div className="tv-dropdown-group">Strumenti individuali</div>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('screener')}
                  >
                    <Filter size={16} />
                    <span>Screener</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('heatmap')}
                  >
                    <LayoutGrid size={16} />
                    <span>Mappe di calore</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('calendar')}
                  >
                    <Calendar size={16} />
                    <span>Calendario economico</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => goMarketsAnchor('markets-news')}
                  >
                    <Newspaper size={16} />
                    <span>Notizie</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => goChartWithBottomTab('pine')}
                  >
                    <Code2 size={16} />
                    <span>Editor Pine</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. COMMUNITY */}
            <div
              className="tv-header-nav__item"
              onMouseEnter={() => handleMouseEnter('community')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`tv-header-nav__trigger${
                  openMenu === 'community' ? ' is-open' : ''
                }${route.view === 'community' ? ' is-active' : ''}`}
                aria-expanded={openMenu === 'community'}
                onClick={() => {
                  clearCloseTimer();
                  setOpenMenu('community');
                }}
              >
                Community
                <ChevronDown size={14} />
              </button>

              {openMenu === 'community' && (
                <div className="tv-nav-dropdown" role="menu">
                  <div className="tv-dropdown-group">Creato dai trader</div>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('community')}
                  >
                    <Flame size={16} />
                    <span>Idee di trading</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('community')}
                  >
                    <Activity size={16} />
                    <span>Indicatori e strategie</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => goChartWithBottomTab('pine')}
                  >
                    <Code2 size={16} />
                    <span>Script Pine</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. MERCATI */}
            <div
              className="tv-header-nav__item"
              onMouseEnter={() => handleMouseEnter('mercati')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`tv-header-nav__trigger${
                  openMenu === 'mercati' ? ' is-open' : ''
                }${route.view === 'markets' ? ' is-active' : ''}`}
                aria-expanded={openMenu === 'mercati'}
                onClick={() => {
                  clearCloseTimer();
                  setOpenMenu('mercati');
                }}
              >
                Mercati
                <ChevronDown size={14} />
              </button>

              {openMenu === 'mercati' && (
                <div className="tv-nav-dropdown" role="menu">
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => go('markets')}
                  >
                    <Globe size={16} />
                    <span>Panoramica mercati</span>
                  </button>
                  <div className="tv-dropdown-group">Attività</div>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => goMarketsAnchor('markets-showcase')}
                  >
                    <TrendingUp size={16} />
                    <span>Indici</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => goMarketsAnchor('markets-italy')}
                  >
                    <BarChart3 size={16} />
                    <span>Azioni Italiane</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openSymbolInChart('BTCUSDT');
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Cripto</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openSymbolInChart('GC1!');
                    }}
                  >
                    <Compass size={16} />
                    <span>Futures</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openSymbolInChart('EURUSD');
                    }}
                  >
                    <Globe size={16} />
                    <span>Forex</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openSymbolInChart('IT10Y');
                    }}
                  >
                    <BookOpen size={16} />
                    <span>Obbligazioni</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openSymbolInChart('VWCE');
                    }}
                  >
                    <LayoutGrid size={16} />
                    <span>ETF</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. BROKER */}
            <div
              className="tv-header-nav__item"
              onMouseEnter={() => handleMouseEnter('broker')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`tv-header-nav__trigger${openMenu === 'broker' ? ' is-open' : ''}`}
                aria-expanded={openMenu === 'broker'}
                onClick={() => {
                  clearCloseTimer();
                  setOpenMenu('broker');
                }}
              >
                Broker
                <ChevronDown size={14} />
              </button>

              {openMenu === 'broker' && (
                <div className="tv-nav-dropdown" role="menu">
                  <button
                    type="button"
                    className="tv-nav-dropdown__hero-item"
                    role="menuitem"
                    onClick={() => goChartWithBottomTab('trading')}
                  >
                    <Wallet size={20} color="#089981" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div className="tv-nav-dropdown__hero-title">Paper Trading</div>
                      <div className="tv-nav-dropdown__hero-sub">
                        Simulatore integrato con €100.000 virtuali
                      </div>
                    </div>
                  </button>
                  <div className="tv-dropdown-sep" />
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      if (route.view !== 'home') {
                        navigate('home');
                      }
                      window.setTimeout(() => {
                        document
                          .getElementById('home-brokers')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }, 80);
                    }}
                  >
                    <Award size={16} />
                    <span>Confronto broker</span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. ALTRO */}
            <div
              className="tv-header-nav__item"
              onMouseEnter={() => handleMouseEnter('altro')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                className={`tv-header-nav__trigger${openMenu === 'altro' ? ' is-open' : ''}`}
                aria-expanded={openMenu === 'altro'}
                onClick={() => {
                  clearCloseTimer();
                  setOpenMenu('altro');
                }}
              >
                Altro
                <ChevronDown size={14} />
              </button>

              {openMenu === 'altro' && (
                <div className="tv-nav-dropdown" role="menu">
                  <div className="tv-dropdown-group">Risorse</div>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      openModal('shortcuts');
                    }}
                  >
                    <Keyboard size={16} />
                    <span>Scorciatoie da tastiera</span>
                  </button>
                  <button
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenu(null);
                      document
                        .getElementById('site-footer')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <BookOpen size={16} />
                    <span>Analisi REA</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right Utility Controls */}
        <div className="tv-site-header__right">
          {/* Theme Toggle */}
          <button
            type="button"
            className="tv-header-icon-btn"
            aria-label={theme === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
            title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Language Selector IT */}
          <div className="tv-header-nav__item tv-header-lang-wrap">
            <button
              type="button"
              className="tv-header-icon-btn"
              aria-label="Apri menu delle lingue"
              aria-expanded={openMenu === 'lang'}
              onClick={() => setOpenMenu((prev) => (prev === 'lang' ? null : 'lang'))}
            >
              <Globe size={17} />
              <span>IT</span>
            </button>

            {openMenu === 'lang' && (
              <div className="tv-nav-dropdown tv-nav-dropdown--right" role="menu">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    className="tv-dropdown-item"
                    role="menuitem"
                    style={
                      lang.active
                        ? {
                            backgroundColor: 'var(--tv-bg-contrast)',
                            color: 'var(--tv-text-contrast)',
                            fontWeight: 600,
                          }
                        : undefined
                    }
                    onClick={() => setOpenMenu(null)}
                  >
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Menu Popover (Menù utente with working Tema scuro switch) */}
          <div className="tv-header-nav__item">
            <button
              type="button"
              className="tv-header-icon-btn"
              aria-label="Apri menù utente"
              aria-expanded={openMenu === 'user'}
              onClick={() => setOpenMenu((prev) => (prev === 'user' ? null : 'user'))}
            >
              <User size={18} />
            </button>

            {openMenu === 'user' && (
              <div className="tv-nav-dropdown tv-nav-dropdown--right" role="menu">
                <button
                  type="button"
                  className="tv-dropdown-item"
                  role="menuitem"
                  style={{ color: 'var(--tv-brand)', fontWeight: 600 }}
                  onClick={() => goChartWithBottomTab('trading')}
                >
                  <Wallet size={16} />
                  <span>Paper Trading (€100K)</span>
                </button>
                <div className="tv-dropdown-sep" />
                <button
                  type="button"
                  className="tv-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    openModal('shortcuts');
                  }}
                >
                  <HelpCircle size={16} />
                  <span>Aiuto e scorciatoie</span>
                </button>
                <button
                  type="button"
                  className="tv-dropdown-item"
                  role="menuitem"
                  onClick={() => go('community')}
                >
                  <Sparkles size={16} />
                  <span>Novità community</span>
                </button>
                <div className="tv-dropdown-sep" />
                <button
                  type="button"
                  className="tv-dropdown-item"
                  role="menuitemcheckbox"
                  aria-checked={theme === 'dark'}
                  onClick={toggleTheme}
                >
                  <span>Tema scuro</span>
                  <span
                    className={`tv-theme-switch${theme === 'dark' ? ' is-on' : ''}`}
                    aria-hidden="true"
                  >
                    <span className="tv-theme-switch__thumb" />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Primary CTA Pill */}
          <button
            type="button"
            className="tv-header-cta"
            onClick={() => go('chart')}
          >
            <span className="tv-header-cta__full">Apri Supercharts</span>
            <span className="tv-header-cta__short">Grafici</span>
          </button>
        </div>
      </div>
    </header>
  );
};
