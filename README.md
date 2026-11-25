# TradingView Italia — Piattaforma Grafici & Mercati Live

Applicazione web completa ispirata a **TradingView Italia** (`it.tradingview.com`), costruita con **React 19**, **TypeScript 5**, **Vite 6** e un motore grafico **HTML5 Canvas HiDPI** proprietario con **222 strumenti finanziari reali** (Cripto live Binance, Azioni USA NASDAQ/NYSE, Borsa Italiana `.MI`, Indici, Forex, Futures, ETF e Obbligazioni).

- **Demo Live (GitHub Pages)**: [https://trillox9.github.io/tradingview-italia/](https://trillox9.github.io/tradingview-italia/)

## Avvio rapido

```bash
npm install
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173/`.

### Comandi disponibili

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia il server di sviluppo Vite con proxy locale `/api/yahoo` e HMR |
| `npm run typecheck` | Verifica rigorosa TypeScript (`tsc --noEmit`) |
| `npm test` | Esegue la suite di unit test Vitest (`tests/*.test.ts`, 66 test offline/deterministici) |
| `npm run fetch:snapshot` | Aggiorna `public/real-market-snapshot.json` con dati reali Yahoo Finance (~180 barre giornaliere per 143 strumenti non-cripto) |
| `npm run build` | Esegue il controllo tipi e crea il bundle statico GitHub Pages in `dist/` (`base: './'`) |
| `npm run preview` | Simula localmente il deploy statico GitHub Pages |

## Copertura mercati reali (222 strumenti)

- **78 coppie Cripto Live Binance (USDT)**: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`, `DOGEUSDT`, `ADAUSDT`, `AVAXUSDT`, `LINKUSDT`, `TONUSDT`, `SUIUSDT`, `PEPEUSDT`, `SHIBUSDT`, `BONKUSDT`, `FLOKIUSDT`, `AAVEUSDT`, `TAOUSDT`, `ONDOUSDT`, `HYPEUSDT`, `PAXGUSDT` e molte altre — con prezzi live 1s (`!miniTicker@arr`), candele live tick-by-tick (`@kline_<tf>`) e storico klines diretto da `data-api.binance.vision` + supporto precisione 6–8 decimali.
- **95 Azioni USA (NASDAQ / NYSE)**: Big Tech & AI (`AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `META`, `TSLA`, `AVGO`, `AMD`, `PLTR`, `ASML`, `TSM`, `ARM`, `NFLX`, `COIN`, `MSTR`...), Finanza (`JPM`, `GS`, `V`, `MA`, `BRK-B`...), Sanità (`LLY`, `UNH`, `NVO`...), Consumi/Energia/Industria (`WMT`, `COST`, `XOM`, `CAT`, `GE`...).
- **20 Azioni Italiane (Borsa Italiana `.MI`)**: `RACE`, `ENI`, `ISP`, `UCG`, `ENEL`, `STLAM`, `LDO`, `MONC`, `DIA`, `G`, `PRY`, `BMPS`, `BAMI`, `FBK`, `MB`, `PST`, `SRG`, `TRN`, `TEN`, `CPR`.
- **29 Indici, Forex, Futures, ETF & Obbligazioni**: 7 Indici (`FTSEMIB`, `SPX`, `NDX`, `DAX`, `DJI`, `NKY`, `VIX`), 7 Forex (`EURUSD`..`USDCAD`), 5 Futures (`GC1!`, `CL1!`, `SI1!`, `NG1!`, `HG1!`), 8 ETF (`SPY`, `QQQ`, `VOO`, `IWM`, `GLD`, `TLT`, `VWCE`, `SWDA`) e 2 Obbligazioni (`US10Y`, `IT10Y`).

## Funzionalità implementate

- **Homepage & Portale Mercati (`#/`, `#/markets`)**: Header sticky italiano con mega-menu, ricerca globale (`Ctrl+K`), Panoramica mercato con grafici interattivi, tabelle dedicate per Azioni Italiane, Azioni USA e Cripto Live Binance, idee della community, notizie e calendario macro.
- **Supercharts HiDPI (`#/chart/<SIMBOLO>`)**:
  - Motore HTML5 Canvas con pan fluido, zoom ruota ancorato al cursore, drag assi prezzo/tempo, scale `Regolare / Logaritmica / Percentuale`, auto-larghezza asse prezzi per monete sub-cent, badge provenienza live (`LIVE BINANCE`, `LIVE YAHOO`, `DATI REALI`, `SIMULATO`) e countdown barra live.
  - Layout multi-grafico (`1`, `2h`, `2v`, `4` pannelli indipendenti) e 7 stili di serie (`Candele`, `Candele vuote`, `Barre`, `Linea`, `Area`, `Baseline`, `Heikin-Ashi`).
  - **12+ indicatori tecnici puri**: SMA, EMA, WMA, Bande di Bollinger, VWAP, SuperTrend, Ichimoku Cloud, Punti Pivot (Classic/Fibonacci/Camarilla/Woodie/DeMark), RSI(14), MACD(12,26,9), Stocastico(14,3,3), ATR(14) e Volume, con sub-pane dedicati e tachimetro **Analisi tecnica** (`Oscillatori / Sommario / Medie mobili`).
  - **Strumenti di disegno interattivi**: Trendline, Semiretta, Linea estesa, Linea orizzontale/verticale, Canale parallelo, Ritracciamento Fibonacci, Rettangolo, Ellisse, Pennello, Testo, Righello Misura, Box Posizione Long/Short (R:R), Magnet OHLC, blocco/nascondi, drag e Undo/Redo per simbolo.
  - **Bar Replay**: taglio storico su barra selezionata con controlli Play/Pausa, passo singolo e velocità.
- **Pannelli Laterali e Cassetto Inferiore**:
  - **Destra**: Watchlist live + Dettagli simbolo e gauge Analisi tecnica, Avvisi live con toast, Finestra dati sincronizzata al crosshair, Hotlist, Calendario economico, Notizie e Albero degli oggetti.
  - **Inferiore**: **Screener** su tutti i 222 strumenti, **Editor Pine Script v5** (mini-interprete sandboxed), **Tester strategia** (KPI + Curva Equity SVG + lista operazioni), **Paper Trading** (€100.000 virtuali, ordini Mercato/Limite/Stop, TP/SL, P&L live) e **Registro attività**.
- **Pagine dedicate**: **Mappa di calore** treemap squarified (`#/heatmap`), **Screener completo** (`#/screener`), **Calendario economico** (`#/calendar`) e **Community & Script** (`#/community`).

## Struttura del progetto

```text
tradingview/
├── .github/workflows/     # Workflow GitHub Actions per deploy automatico su GitHub Pages
├── docs/                  # Evidenze e specifiche REA di it.tradingview.com
│   ├── REA_HOME_EVIDENCE.md
│   └── REA_CHART_EVIDENCE.md
├── public/
│   └── real-market-snapshot.json  # Snapshot reale Yahoo Finance (143 strumenti non-cripto)
├── scripts/
│   └── fetch-real-snapshot.mjs    # Script aggiornamento snapshot reale Yahoo Finance
├── src/
│   ├── types/             # Interfacce TypeScript di dominio & provenienza dati
│   ├── data/              # Catalogo 222 strumenti, realMarketApi (Binance/Yahoo/Snapshot), MarketFeed live, OHLCV & dati editoriali IT
│   ├── engine/            # Indicatori, geometria disegni, Pine evaluator, Paper Trading, Avvisi, Screener
│   ├── store/             # Router hash + TradingViewProvider e hook React tipizzati
│   ├── components/        # layout, home, chart, panels, modals
│   ├── pages/             # Home, Markets, Chart, Heatmap, Screener, Calendar, Community
│   └── styles/            # tokens.css, global.css, home.css, panels.css, chart.css, modals.css
└── tests/                 # Suite Vitest (7 file, 66 unit test)
```

## Riferimenti REA & Design System

L'architettura visuale, i token cromatici Light/Dark, la terminologia italiana e le interazioni sono documentati nei report REA del progetto:

- `docs/REA_HOME_EVIDENCE.md` — Analisi della homepage italiana e della panoramica `/markets/`
- `docs/REA_CHART_EVIDENCE.md` — Analisi dell'area di lavoro Supercharts `/chart/`

## Nota sui dati di mercato

Questa applicazione ha scopo **esclusivamente dimostrativo ed educativo**. Le criptovalute utilizzano direttamente le API pubbliche REST e WebSocket di Binance (`data-api.binance.vision` / `data-stream.binance.vision`). Azioni USA, Azioni Italiane (`.MI`), indici, forex, futures ed ETF caricano immediatamente dati reali dallo snapshot pre-acquisito Yahoo Finance (`public/real-market-snapshot.json`, aggiornato automaticamente dal workflow GitHub Pages) e si aggiornano live tramite API pubbliche Yahoo Finance v8 con fallback automatico silenzioso in caso di ambiente offline. Nessun dato o simulazione Paper Trading costituisce consulenza finanziaria.
