# TradingView Italia — Supercharts Pro & Mercati Live

Area di lavoro **Supercharts Pro** 1:1 ispirata a **TradingView Italia** (`it.tradingview.com/chart/`), costruita con **React 19**, **TypeScript 5**, **Vite 6** e un motore grafico **HTML5 Canvas HiDPI** proprietario con **222 strumenti finanziari reali** (Cripto live Binance, Azioni USA NASDAQ/NYSE, Borsa Italiana `.MI`, Indici, Forex, Futures, ETF e Obbligazioni).

- **Demo Live (GitHub Pages)**: [https://trillox9.github.io/tradingview-italia/](https://trillox9.github.io/tradingview-italia/)

## Avvio rapido

```bash
npm install
npm run dev
```

L'applicazione si apre direttamente su **Supercharts Pro** (`http://localhost:5173/#/`), a schermo intero edge-to-edge (tema **Obsidian Dark** & **Crisp Light**, ottimizzata per Desktop e Mobile touch).

### Comandi disponibili

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia il server di sviluppo Vite con proxy locale `/api/yahoo` e HMR |
| `npm run typecheck` | Verifica rigorosa TypeScript (`tsc --noEmit`) |
| `npm test` | Esegue la suite di unit test Vitest (`tests/*.test.ts`, **82 test** offline/deterministici) |
| `npm run fetch:snapshot` | Aggiorna `public/real-market-snapshot.json` con dati reali Yahoo Finance (~180 barre giornaliere per 143 strumenti non-cripto) |
| `npm run build` | Esegue il controllo tipi e crea il bundle statico GitHub Pages in `dist/` (`base: './'`) |
| `npm run preview` | Simula localmente il deploy statico GitHub Pages |

## Supercharts Pro — Funzionalità Principali

- **Landing diretta su Supercharts (`#/`, `#/chart/<SIMBOLO>`) & Persistenza Totale (`Salva`)**:
  - Layout edge-to-edge senza barra icone laterale destra fissa né clutter marketing/community; accesso rapido opzionale a **Lista titoli**, **Avvisi**, **Finestra dati** e **Albero degli oggetti** dalla barra superiore.
  - **Layout Cloud `Salva` (`Ctrl+S`)**: pulsante split nella barra superiore con **Salvataggio automatico** (ON di default), gestione layout multipli con nome (**Rinomina**, **Crea copia**, **Carica**, **Nuovo layout**, **Elimina**), **Esporta / Importa JSON** e persistenza completa al refresh (`panes`, `layoutMode`, simboli, timeframe, stili, indicatori modificati/rimossi, disegni, `chartSettings`, script Pine e preferenze).
  - Layout multi-grafico (`1`, `2h`, `2v`, `4` pannelli con sincronizzazione mirino e dati reali su tutti i pannelli), **Bar Replay**, **Scorciatoie Pro** (`Ctrl+S`, `Ctrl+K`, `/`, `Alt+D`, `Shift+F`, `+`/`-`, `←`/`→`, `Home`/`End`, `Alt+R/I/L/P/T/H/J/V/C/F/A`, `Alt+Shift+R`, `Ctrl+Z/Y`, `Canc`).
- **Fisica Mirino (`Crosshair`) & Gesture 1:1 Mouse/Touch**:
  - **Mirino 1:1**: su Desktop aggancio X preciso al centro candela (anche nello spazio futuro oltre l'ultima barra) con legenda OHLC/indicatori aggiornata live e sincronizzata tra sub-pane e multi-grafico; su Mobile scorrimento pulito senza pill bloccate, pressione prolungata (260ms) per ispezione/scrub live e rilascio pulito.
  - **Navigazione con strumento attivo**: su Mobile è sempre possibile scorrere con 1 dito e fare pinch-zoom a 2 dita anche mentre uno strumento click-to-place è selezionato (tocco fermo per piazzare i punti, pill `Annulla` in basso); su Desktop pan rapido con tasto centrale o `Spazio + trascinamento` e annullamento bozza con tasto destro/`Esc`.
  - **Asse Prezzi** (Destra o Sinistra): rotella e drag verticali scalano **solo l'asse Y** (disattivando `auto` senza alterare lo zoom temporale); doppio click/tap ripristina `auto`.
  - **Canvas principale & Asse Temporale**: zoom esponenziale proporzionale (rotella/trackpad/pinch/`+`/`-`), scorrimento nello spazio futuro (+85%), pulsante flottante **Torna al presente (`>>`)**, **Zoom avanti** (`zoom_box`) + cronologia **Zoom indietro**, e pulsante flottante **`+`** sull'Asse Prezzi.
- **64 Strumenti di Disegno Autentici & Barra Preferiti (`★`)**:
  - 8 gruppi completi con menu flyout a destra della barra sinistra (52px): **Cursori** (4, inclusa **Gomma**), **Linee e Canali** (13, incl. `Trend di regressione` ±2σ e `Angolo di trend`), **Gann e Fibonacci** (10, incl. `Ritracciamento/Estensione/Fusi orari Fibonacci`, `Ventaglio di Gann`, `Forcone` di Andrews e Schiff), **Pattern** (7, incl. `XABCD`, `Testa e Spalle`, `Onde di Elliott`), **Proiezione e Misurazione** (7, incl. `Posizione Long/Short` R:R e **`Profilo volume intervallo fisso`** con POC e Value Area 70%), **Forme geometriche** (12), **Annotazioni** (9) e **Utilità** (`Misura`, `Zoom avanti`).
  - **Barra Preferiti flottante trascinabile (`★`)**, **Barra proprietà disegno flottante** (colore, riempimento, spessore, tratteggio, clona, z-order, blocca, elimina), **Modale Impostazioni disegno** a 3 tab (`Stile / Testo / Coordinate`), **Magnet OHLC** (`Debole`/`Forte`), modalità nascondi selettive e Undo/Redo per simbolo.
- **13 Stili Grafico Autentici**:
  - `Barre`, `Candele`, `Candele vuote`, `Candele con volume`, `Linea`, `Linea con marcatori`, `Linea a gradini`, `Area`, `Area HLC`, `Baseline`, `Colonne`, `Massimo-minimo` e `Heikin Ashi`.
- **4 Menu Contestuali Click Destro + Ingranaggio Scala Prezzi (`⚙`)**:
  - **Scala Prezzi** (con sottomenu `Etichette ▸`, `Linee ▸`, `Regolare / Percentuale / Indicizzato a 100 / Logaritmica`, `Inverti scala`, `Blocca rapporto prezzo/barra`, `Sposta scala a sinistra/destra`), **Canvas principale**, **Asse Temporale** (`Fuso orario ▸`, `Formato data ▸`) e **Oggetto Disegno**.
- **Impostazioni Grafico a 6 Tab con Anteprima Live**:
  - `Simbolo`, `Linea di stato`, `Scale e linee`, `Canvas`, `Trading` e `Avvisi` con aggiornamento immediato sul canvas e rollback completo tramite `Annulla`.
- **Indicatori Tecnici, Impostazioni (`⚙`) & Cassetto Trading Inferiore**:
  - **12+ indicatori puri**: SMA, EMA, WMA, Bande di Bollinger, VWAP, SuperTrend, Ichimoku Cloud, Punti Pivot (Classic/Fibonacci/Camarilla/Woodie/DeMark), RSI(14), MACD(12,26,9), Stocastico(14,3,3), ATR(14), Volume e tachimetro **Analisi tecnica** (`Oscillatori / Sommario / Medie mobili`).
  - **Modale Impostazioni Indicatore (`⚙`)** a 3 tab (`Input`, `Stile`, `Visibilità` per timeframe) con anteprima live, `Predefiniti` e rollback `Annulla`, più divisore ridimensionabile tra grafico principale e sub-pane oscillatori.
  - **Cassetto inferiore**: **Screener** su tutti i 222 strumenti, **Editor Pine Script v5** (interprete sandboxed), **Tester strategia** (KPI + Curva Equity SVG), **Paper Trading** (€100.000 virtuali, Mercato/Limite/Stop, TP/SL, P&L live) e **Registro attività**.
  - Viste dedicate opzionali via hash: **Screener completo** (`#/screener`) e **Mappa di calore** (`#/heatmap`).

## Copertura mercati reali (222 strumenti)

- **78 coppie Cripto Live Binance (USDT)**: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`, `DOGEUSDT`, `ADAUSDT`, `AVAXUSDT`, `LINKUSDT`, `TONUSDT`, `SUIUSDT`, `PEPEUSDT`, `SHIBUSDT`, `BONKUSDT`, `FLOKIUSDT`, `AAVEUSDT`, `TAOUSDT`, `ONDOUSDT`, `HYPEUSDT`, `PAXGUSDT` e molte altre — prezzi live 1s (`!miniTicker@arr`), candele tick-by-tick (`@kline_<tf>`) e storico klines da `data-api.binance.vision` con supporto precisione fino a 8 decimali.
- **95 Azioni USA (NASDAQ / NYSE)**: Big Tech & AI (`AAPL`, `MSFT`, `NVDA`, `AMZN`, `GOOGL`, `META`, `TSLA`, `AVGO`, `AMD`, `PLTR`, `ASML`, `TSM`, `ARM`, `NFLX`, `COIN`, `MSTR`...), Finanza (`JPM`, `GS`, `V`, `MA`, `BRK-B`...), Sanità (`LLY`, `UNH`, `NVO`...), Consumi/Energia/Industria (`WMT`, `COST`, `XOM`, `CAT`, `GE`...).
- **20 Azioni Italiane (Borsa Italiana `.MI`)**: `RACE`, `ENI`, `ISP`, `UCG`, `ENEL`, `STLAM`, `LDO`, `MONC`, `DIA`, `G`, `PRY`, `BMPS`, `BAMI`, `FBK`, `MB`, `PST`, `SRG`, `TRN`, `TEN`, `CPR`.
- **29 Indici, Forex, Futures, ETF & Obbligazioni**: 7 Indici (`FTSEMIB`, `SPX`, `NDX`, `DAX`, `DJI`, `NKY`, `VIX`), 7 Forex (`EURUSD`..`USDCAD`), 5 Futures (`GC1!`, `CL1!`, `SI1!`, `NG1!`, `HG1!`), 8 ETF (`SPY`, `QQQ`, `VOO`, `IWM`, `GLD`, `TLT`, `VWCE`, `SWDA`) e 2 Obbligazioni (`US10Y`, `IT10Y`).

## Struttura del progetto

```text
tradingview/
├── .github/workflows/     # Workflow GitHub Actions per deploy automatico su GitHub Pages
├── docs/                  # Evidenze e specifiche REA di it.tradingview.com/chart/
├── public/
│   └── real-market-snapshot.json  # Snapshot reale Yahoo Finance (143 strumenti non-cripto)
├── scripts/
│   └── fetch-real-snapshot.mjs    # Script aggiornamento snapshot reale Yahoo Finance
├── src/
│   ├── types/             # Tipi mercato (13 chart types), disegni (64 tools) e ChartSettings (6 tab)
│   ├── data/              # Catalogo 222 strumenti, realMarketApi (Binance/Yahoo/Snapshot), MarketFeed live
│   ├── engine/            # Indicatori, geometria disegni Pro (FRVP/Regression/Pitchfork/Gann/Fib), Pine, Paper Trading, Avvisi, Screener
│   ├── store/             # Router Supercharts-first + TradingViewProvider e hook React tipizzati
│   ├── components/        # chart (canvas, 64-tool renderer, flyouts, context menus, floating bars), panels, modals
│   ├── pages/             # ChartPage (Supercharts Pro), ScreenerPage, HeatmapPage
│   └── styles/            # tokens.css, global.css, panels.css, chart.css, drawingTools.css, contextMenus.css, modals.css
└── tests/                 # Suite Vitest (7 file, 82 unit test)
```

## Nota sui dati di mercato

Questa applicazione ha scopo **esclusivamente dimostrativo ed educativo**. Le criptovalute utilizzano direttamente le API pubbliche REST e WebSocket di Binance (`data-api.binance.vision` / `data-stream.binance.vision`). Azioni USA, Azioni Italiane (`.MI`), indici, forex, futures ed ETF caricano immediatamente dati reali dallo snapshot pre-acquisito Yahoo Finance (`public/real-market-snapshot.json`, aggiornato automaticamente dal workflow GitHub Pages) e si aggiornano live tramite API pubbliche Yahoo Finance v8 con fallback automatico silenzioso in caso di ambiente offline. Nessun dato o simulazione Paper Trading costituisce consulenza finanziaria.
