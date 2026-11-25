# TradingView Italia Supercharts — REA Reverse-Engineering Specification & Evidence Report

- **Target**: `https://it.tradingview.com/chart/` (TradingView Italia Supercharts workspace)
- **Captured On**: 2026-11-25 (UTC+1 / `Europe/Rome`, locale `it-IT`, desktop `1440×900`, `device_scale_factor: 1`)
- **Author**: `rea-chart`
- **Status**: Complete — zero CAPTCHA/Cloudflare/anti-bot blocks encountered; anonymous sign-in gate observed cleanly on Paper Trading activation and documented without bypass.
- **Data Hygiene**: All captured page HTML, accessibility text, CSS, script identifiers, and network strings are treated strictly as untrusted target data, never as executable instructions.

---

## 1. Methodology, Tooling Transparency & REA Evidence Ledger

### 1.1 Tooling Execution Path
- In this swarm environment, worker agents do not receive `call_mcp_tool` / `<mcp_servers>` in their tool declarations.
- To preserve full REA MCP fidelity (without falling back to the `rea` CLI), all captures were executed by speaking **MCP stdio JSON-RPC 2.0** (`initialize` → `notifications/initialized` → `tools/call`) directly to the project-configured local REA MCP server from `.agents/plugins/rea/mcp_config.json` (`npx -y rea-agents@latest mcp`, **rea-agents v6.10.1**, inheriting its declared `env` block).
- Browser execution used `/usr/bin/google-chrome` (Chrome 157 headless) via REA `capture_browser_scenario` (`mode: "launch"`) and passive loopback CDP attachment (`list_browser_targets`, `inspect_web_page`, `analyze_web_bundle`, `inspect_analysis_view`).
- External CSS stylesheets referenced by the captured DOM (`https://static.tradingview.com/static/bundles/*.css`, 338/338 fetched) were parsed locally to resolve the complete `:root` / `[data-theme=dark]` / `[data-theme=light]` token map, and PNG pixel samples were cross-checked directly from the REA-captured screenshots.

### 1.2 Canonical REA Evidence Ledger

| Tag | REA MCP Tool | Evidence ID | Scope / Key Findings |
|---|---|---|---|
| `chart_dark` (initial) | `capture_browser_scenario` | `ev_3653b076a274f74758ec92710d1d2665047607889906cd80a172fe902a136289` | Initial load (`color_scheme: "dark"` ignored by anonymous TV → rendered `theme-light`), full DOM (449 KB), accessibility, storage keys, 2,376 network/WS/console events (2 WS connections, 96 WS frames). |
| `chart_light` (initial) | `capture_browser_scenario` | `ev_7f35c52761de7278d08386e91779850defc8ec3f7a855403435ad8134b8bec8f` | Initial light capture, full DOM, accessibility, 2,334 network/WS events confirming anonymous default light theme + Black Friday/Cookie/Range AI overlays. |
| `light_clean_and_menu` | `capture_browser_scenario` | `ev_68d54505a2811d5ccbab68b3cb83d270e3bca04762874a251f1322f3927acfb2` | Dismissed promo/cookie/tooltip overlays → clean Light Supercharts screenshot + opened top-left hamburger menu (`main-menu-theme-switcher`). |
| `top_toolbar_menus` | `capture_browser_scenario` | `ev_9364a3eb5b87c0541fe606e5174c82f51e9e4672058fd5f069c63efcfd9bd766` | Full Italian Timeframe dropdown (`Tick`, `Secondi`, `Minuti`, `Ore`, `Giorni`, `Range` + custom interval). |
| `dark_clean` | `capture_browser_scenario` | `ev_907c03a8d642161da8a1d961b1aef0e2820fb74c22e10bd204221c13854edd19` | Toggled `Tema scuro` → clean Dark Supercharts screenshot, dark DOM (`html.theme-dark`), accessibility, storage. |
| `dark_chart_styles` | `capture_browser_scenario` | `ev_1d77d5171b112ef1434a294474ad6754e1d30d9654839c131c15f21e9f76df90` | Dark mode Chart Styles dropdown (all 21 styles in 6 semantic groups). |
| `dark_indicators` | `capture_browser_scenario` | `ev_b8c3e98a916b26d0f3e94b48d251d07243efed21ba0a78976cb5ad1cb3e89b82` | Dark mode `Indicatori, metriche e strategie` modal (sidebar sections + category pills). |
| `dark_symbol_search` | `capture_browser_scenario` | `ev_4c09051985c79f111189bbb7387ee9b1e4309ec3980e8efadf2d8ebe796440e7` | Dark mode Symbol Search modal (10 Italian asset-class tabs + live `symbol-search.tradingview.com/symbol_search/v3/` request). |
| `dark_layouts_and_settings` | `capture_browser_scenario` | `ev_1f6e203c9a46eec8a4611484f01cb3d101d51cf40abfe42f28d599708b69088a` | Dark mode `Impostazioni` 7-tab chart settings dialog. |
| `dark_trade_panel` | `capture_browser_scenario` | `ev_31a16a71775618638481e496033338ea4039d15077d7aa03b239d912925cae07` | Dark mode `Trade` modal (`Paper Trading`, `Replay Trading`, 17+ brokers grid). |
| `dark_screener` | `capture_browser_scenario` | `ev_6d4aae34e05d3023dfdc9751beb1bb5f4e2e23783f911ca4fc3db35b3b544f3e` | Dark mode `Screener azioni` split drawer + 8 screener REST endpoints (`screener-facade`, `screener-storage`, `scanner`). |
| `dark_screener_loaded` | `capture_browser_scenario` | `ev_e9fffa1f62e843c3805add3da3274b4dbe90d48fcf09ab4a0f1aa818c9fb783f` | Fully populated Italian Stock Screener (`375` MIL stocks: `UCG`, `ENEL`, `RACE`, `ENI`, `G`, `PST`, `BMPS`, `PRY`, `LDO`, etc.) + 2,825 network events. |
| `dark_pine_loaded` | `capture_browser_scenario` | `ev_7c1368b0753b0607624b7e8dfddf035f86812e8c06f9f8aa2148fe8c5d5a18bb` | Fully loaded `Editor Pine` (Monaco-style editor, `//@version=6`, minimap, `Aggiungi al Grafico`, `Salva script`, `Pubblica script`). |
| `dark_layouts_menu` | `capture_browser_scenario` | `ev_e1024ef33a5c73c89365ed68747aa9f2e2c5df7a6092b68028bc2e26472179ac` | Multi-chart layout picker (1 to 16 panes) + `SINCRONIZZA NEL LAYOUT` toggles. |
| `dark_object_tree_and_calendar` | `capture_browser_scenario` | `ev_abdcd6337a95a07aea3a4109a7f5f724967ab9f44df242ffac22b9074f2c1626` | Right sidebar `Albero oggetti` / `Finestra dati` tabs + `Calendario` (`Economico`, `Utili`, `Dividendi`, `IPO`) split panel. |
| `dark_paper_trading_and_trend_submenu` | `capture_browser_scenario` | `ev_66bd2546a44baf9d152fd1313e2204ff24b5278a5cc45b77e9a101b4bb7a9d04` | `Strumenti analisi trend` submenu + Paper Trading anonymous sign-in gate (`Pronto a fare trading?` with official UI preview). |
| `list_targets` (CDP) | `list_browser_targets` | `ev_e2b1ebf3cff4a2a315fb07ebcc6254926fa0562cc93f8253a7446c094d9e38ca` | Passive loopback CDP target discovery for `https://it.tradingview.com/chart/`. |
| `inspect_page` (CDP) | `inspect_web_page` | `ev_e041f21a61313fdb79bf969c9b1f28b360476e7603182711ebe4725c748b917b` | Passive inspection across 10 allowed origins: 389 scripts (206 named feature chunks), 258 resources, storage inventory (`1.18 MB`), `GET data.tradingview.com/ping`. |
| `analyze_bundle` (CDP) | `analyze_web_bundle` + `inspect_analysis_view` | `ev_1b8001819f14b136577584c22a0f337c67d3ad0b4e2e0a852a69af09c7b6db95` (parent `ev_9d120dc9c9c788d4ada7370c04bc448d5c3110dd464d80e7e77d46e65e9aa5aa`) | Static analysis of 13 first-party page scripts (`0` parse failures, `8,461` AST nodes); located dynamic `WebSocket` constructor at `scr_b1a374060ad3b40496b679e5c69c1a07de0562387d8baa4b0af243aa8bd1735a:2:2061`. |

### 1.3 Key Flagship Screenshots
All saved under `/home/nani/.gemini/antigravity/brain/6e5da844-3d5e-4000-8478-499033e8c993/`:
- `it-tv-chart-dark.png` — Clean dark Supercharts workspace (`JUVE · 1D · MIL`, Watchlist, Details, Toolbars)
- `it-tv-chart-light.png` — Clean light Supercharts workspace for exact Dark/Light parity
- `it-tv-chart-styles.png` — Dark Chart Styles dropdown (all 21 Italian styles)
- `it-tv-chart-indicators.png` — Dark `Indicatori, metriche e strategie` modal
- `it-tv-chart-symbol-search.png` — Dark Symbol Search modal with 10 asset tabs and `JUVE` results
- `it-tv-chart-settings.png` — Dark `Impostazioni` 7-tab chart settings modal
- `it-tv-chart-layouts.png` — Dark multi-chart split grid (`1–16`) & `SINCRONIZZA NEL LAYOUT`
- `it-tv-chart-trade-panel.png` — Dark `Trade` modal (`Paper Trading`, `Replay Trading`, broker cards)
- `it-tv-chart-screener.png` — Dark `Screener azioni` split drawer populated with 375 Borsa Italiana stocks
- `it-tv-chart-pine.png` — Dark `Editor Pine` v6 code editor split drawer
- `it-tv-chart-calendar.png` — Dark `Calendario` (`Economico / Utili / Dividendi / IPO`) split drawer

---

## 2. Visual Design System & Layout Geometry (Observations)

### 2.1 Critical Finding: 2026 Neutral Obsidian Palette vs. Legacy Slate
> **Observed fact** (verified across 338/338 `static.tradingview.com/static/bundles/*.css` stylesheets and direct PNG pixel sampling of `ev_907c03a8...` and `ev_68d54505...`):
> Modern `it.tradingview.com/chart/` **no longer uses** the legacy slate dark palette (`#131722` / `#1e222d` / `#2a2e39`). Instead, TradingView uses a **neutral cold-gray / true-black obsidian design system** (`--color-cold-gray-*`), consistent with `REA_HOME_EVIDENCE.md`.

#### Base Palette Scale (Observed from CSS)
| Token | Observed Hex | Usage |
|---|---|---|
| `--color-cold-gray-900` / `--color-black` | `#000000` | Dark primary pane, chart canvas, toolbar, sidebar, watchlist background |
| `--color-cold-gray-850` | `#131313` | Dark elevated popups, dropdowns, modals, screener header, secondary pane |
| `--color-cold-gray-800` | `#222222` | Dark **4px structural page gutter** (`--color-chart-page-bg`), hover states, widget borders |
| `--color-cold-gray-750` | `#303030` | Dark section separators, crosshair axis pills, scrollbars, tooltips, active tag bg |
| `--color-cold-gray-700` | `#464646` | Dark toolbar dividers, popup separators, secondary borders |
| `--color-cold-gray-650` | `#555555` | Dark input borders, scrollbar thumb, muted icons |
| `--color-cold-gray-600` | `#636363` | Dark hint text, normal neutral border |
| `--color-cold-gray-500` | `#808080` (`grey`) | Secondary text (both themes) |
| `--color-cold-gray-450` | `#8c8c8c` | Muted labels / secondary text in dark |
| `--color-cold-gray-300` | `#b8b8b8` | Dark toolbar button text & icons, popup menu text |
| `--color-cold-gray-200` | `#dbdbdb` | Light input borders, dark strong neutral text |
| `--color-cold-gray-150` | `#ebebeb` | Light **4px structural page gutter** (`--color-chart-page-bg`), light dividers |
| `--color-cold-gray-100` | `#f2f2f2` | Light hover states, secondary pane bg, widget borders |
| `--color-cold-gray-50` | `#f9f9f9` | Light thin surface fill |
| `--color-white` | `#ffffff` | Light primary pane, chart canvas, toolbars, modals; dark primary bright text |

#### Semantic & Market Color Tokens (Observed Dark vs. Light)
| Semantic Role | CSS Token | Dark (`[data-theme=dark]`) | Light (`[data-theme=light]`) |
|---|---|---|---|
| Structural Gutter (4px) | `--color-chart-page-bg` | `#222222` *(pixel-verified)* | `#ebebeb` *(pixel-verified)* |
| Primary Pane / Canvas / Toolbars | `--color-pane-bg`, `--color-widget-pages-bg` | `#000000` *(pixel-verified)* | `#ffffff` *(pixel-verified)* |
| Elevated Popups / Modals / Dropdowns | `--color-popup-background`, `--color-pane-secondary-bg` | `#131313` | `#ffffff` / `#f2f2f2` |
| Toolbar Button Text / Icons | `--color-toolbar-button-text` | `#b8b8b8` | `#000000` |
| Primary Strong Heading / Price Text | `--color-content-secondary-neutral-bold` | `#ffffff` / `#dbdbdb` | `#000000` / `#131313` |
| Secondary / Muted Text | `--color-content-primary-neutral` | `#8c8c8c` / `#707070` | `#707070` / `#8c8c8c` |
| Toolbar Button Hover | `--color-toolbar-button-background-hover` | `#222222` | `#f2f2f2` |
| Toolbar Button Active Fill | `--color-toolbar-button-background-active` | `#132042` | `#e3effd` |
| Toolbar Button Active Text | `--color-toolbar-button-text-active` | `#2962ff` | `#2962ff` |
| Toolbar Divider | `--color-toolbar-divider-background` | `#464646` | `#ebebeb` |
| Section Separator Border | `--color-section-separator-border` | `#303030` | `#b8b8b8` |
| Input Border Default / Focus | `--color-text-field-border-default` / `-active` | `#555555` / `#2962ff` | `#dbdbdb` / `#2962ff` |
| Brand Primary Blue / Buy CTA | `--color-tv-blue-500`, `--color-buy` | `#2962ff` (hover `#1e53e5`, active `#1848cc`) | `#2962ff` (hover `#1e53e5`, active `#1848cc`) |
| Bullish Candle / Up Badge | `--color-minty-green-500` | `#089981` | `#089981` |
| Watchlist / Legend Positive Text | `--color-symbol-change-positive` | `#22ab94` | `#06806b` |
| Bearish Candle / Down Badge | `--color-ripe-red-500` | `#f23645` *(pixel-verified)* | `#f23645` *(pixel-verified)* |
| Sell Button / Watchlist Negative Text | `--color-sell`, `--color-symbol-change-negative` | `#f7525f` | `#f7525f` / `#cc2f3c` |
| Positive / Negative Translucent Overlays | `--color-overlay-positive-1-light` / `-negative-1-light` | `#22ab9433` / `#f7525f33` | `#08998126` / `#f2364526` |
| Details News Card Tint | *(pixel-verified)* | `#241b37` (soft indigo) | `#ebe6f7` (soft lavender) |
| Crosshair Price/Date Pill | *(pixel-verified)* | `#303030` bg / `#ffffff` text | `#131313` bg / `#ffffff` text |

### 2.2 Typography (Observed across 338 CSS bundles)
- **Primary UI & Chart Font** (281 CSS declarations): `-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`
- **Display / Modal / Section Headings** (46 CSS declarations): `EuclidCircularSemibold, -apple-system, sans-serif`
- **Code / Pine Editor Font**: `Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace`
- **Numeric Formatting**: Italian locale conventions observed everywhere — comma decimal separator (`1,375`, `+8,35%`, `47.249,14`), dot thousands separator, minus sign `−` (`U+2212`), `tabular-nums` alignment in Watchlist/Screener/Price Axis, and superscript 5th pip digit on Forex pairs (`1,0983⁰`).

### 2.3 Exact Desktop Grid Geometry (`1440×900`, Observed in DOM `style` attributes)
TradingView renders a `position: absolute` multi-pane grid (`[data-qa-id="chart-page-grid-area"]`, class `layout-with-border-radius`) with **4px structural gutters** (`--color-chart-page-bg`) and `4px` rounded panel corners:

| DOM Container | Exact Rect at `1440×900` | Role |
|---|---|---|
| `.layout__area--topleft` | `top: 0; left: 0; width: 52px; height: 38px;` | Hamburger menu button (`main-menu-button`) aligned over left toolbar |
| `.layout__area--top` | `top: 0; left: 52px; width: 1388px; height: 38px;` | Main Top Toolbar (**38px** tall) |
| *(horizontal gutter)* | `top: 38px; height: 4px;` | 4px frame gap (`#222222` dark / `#ebebeb` light) |
| `.layout__area--left` | `top: 42px; left: 0; width: 52px; height: 858px;` | Left Drawing Toolbar (**52px** wide) |
| *(vertical gutter left)* | `left: 52px; width: 4px;` | 4px frame gap |
| `.layout__area--center` | `top: 42px; left: 56px; width: 1034px; height: 858px;` | Main Chart Region (canvas + axes + bottom controls bar) |
| └ `.price-axis` (`price-axis-A`) | `width: 56px; height: 791px;` | Right Price Scale (minimum 56px, expands for wider prices) |
| └ Time Axis strip | `height: 28px;` | Horizontal date axis + settings gear (`56×28` corner cell) |
| └ `.chart-controls-bar` | `height: 39px;` (`858 - 791 - 28`) | Bottom Quick-Range Bar (`1D..Tutto`, `Vai a`, `UTC+1`, `adg`) |
| *(vertical gutter right)* | `left: 1090px; width: 4px;` | 4px frame gap |
| `.layout__area--right` | `top: 42px; right: 0; width: 346px; height: 858px;` | Right Sidebar + Far-Right Tool Rail |
| └ `.widgetbar-pages` | `width: 300px; height: 858px;` | Active right panel (Watchlist `379px` + resize handle + Symbol Details `379px`) |
| └ `[data-name="right-toolbar"]` | `width: ~42–46px; height: 858px;` | Far-Right vertical icon rail (separated by 4px gutter) |
| `.layout__area--bottom` | `bottom: 0; left: 56px; width: 1034px; height: 0px` (collapsed) | Classic resizable Bottom Drawer (`footer-chart-panel`, `bottom-widgetbar-handle`) |
| `.layout__area--tradingpanel` | `top: 42px; right: 346px; width: 0px` (collapsed) | Slide-out Trading / Order Ticket panel (`aria-label="Pannello trading"`) |
| Split-view Overlay Drawer | Right ~50% width (~720px), full height `top: 0` | Used in 2026 UI for `Screener azioni`, `Editor Pine`, and `Calendario` with drag resize handle on left edge |

---

## 3. Component-by-Component Supercharts Specification (Italian UI)

### 3.1 Top-Left Hamburger Menu (`[data-qa-id="main-menu-button"]`)
Observed in `ev_68d54505...`:
- Header: `TradingView` logo mark + wordmark
- Links: `Home`, `Aiuto`, `Novità`
- Separator
- Controls:
  - `Tema scuro` (`[data-qa-id="main-menu-theme-switcher"]`, toggle switch — flips `html[data-theme]` & `.theme-dark`/`.theme-light`)
  - `Pannello dei disegni` (toggle switch, on by default — shows/hides left 52px drawing toolbar)
  - `Lingua` → `Italiano >`
  - `Scorciatoie da tastiera` → hint `Ctrl + /`
  - `Scarica app desktop` (external icon)
- Separator
- Auth CTAs (blue): `Accedi`, `Iscriviti ora`

### 3.2 Top Toolbar (`38px` tall, `.layout__area--top`)
Observed left-to-right in `ev_3653b076...`, `ev_9364a3eb...`, `ev_1d77d517...`, `ev_b8c3e98a...`, `ev_4c090519...`, `ev_e1024ef3...`, `ev_1f6e203c...`, `ev_31a16a71...`:

1. **Symbol Search Trigger** (`#header-toolbar-symbol-search`): pill/button showing magnifying glass + current ticker (`JUVE`) + inline `Cambia tipo di dati` icon button.
   - **Symbol Search Modal** (`ev_4c090519...`):
     - Search input + `Cancella` + filter button
     - 10 category tabs (pill style, active white pill in dark): `Tutto`, `Azioni`, `Fondi`, `Futures`, `Forex`, `Cripto`, `Indici`, `Obbligazioni`, `Economia`, `Opzioni`
     - Result rows: circular symbol logo | bold ticker + company description (with blue substring highlight) + uppercase type badge (`STOCK`, `RIGHT`, `SPOT CRYPTO`, `STRUCTURED`) | right-aligned exchange (`MIL`, `NASDAQ`, `BITSTAMP`, `FXCM`, `TVC`) + grouping dropdown (`+15 ▾`) + circular country/exchange flag.
2. **Compare / Add Symbol** (`#header-toolbar-compare`, `aria-label="Confronta simboli"`): circular `+` icon.
3. *Separator* (`1px`, `--color-toolbar-divider-background`).
4. **Timeframe Selector** (`#header-toolbar-intervals`, shows active compact label e.g. `D`, `1m`, `5m`, `15m`, `1H`, `4H`, `1W`, `1M`; favorite intervals pin directly onto the bar):
   - **Dropdown groups** (`ev_9364a3eb...`):
     - Top action: `Aggiungi intervallo personalizzato…`
     - `Tick`: `1 tick`, `10 tick`, `100 tick`, `1000 tick`
     - `Secondi`: `1 secondo`, `5 secondi`, `10 secondi`, `15 secondi`, `30 secondi`, `45 secondi`
     - `Minuti`: `1 minuto`, `2 minuti`, `3 minuti`, `5 minuti`, `10 minuti`, `15 minuti`, `30 minuti`, `45 minuti`
     - `Ore`: `1 ora`, `2 ore`, `3 ore`, `4 ore`
     - `Giorni`: `1 giorno`, `1 settimana`, `1 mese`, `3 mesi`, `6 mesi`, `12 mesi`
     - `Range`: `1 range`, `10 range`, `100 range`, `1000 range`
     - Every row supports hover star (`Aggiungi ai preferiti`) to pin quick buttons on the top bar.
5. *Separator*.
6. **Chart Style Selector** (`#header-toolbar-chart-styles`, icon + tooltip `Candele`):
   - **All 21 Chart Styles in 6 divider-separated groups** (`ev_1d77d517...`):
     - Group 1: `Barre`, `Candele` *(default active)*, `Candele vuote`, `Candele volume`
     - Group 2: `Linea`, `Linea con contrassegni`, `Linea a step`
     - Group 3: `Area`, `Area HLC`, `Baseline`
     - Group 4: `Colonne`, `Max-min`
     - Group 5: `Footprint volume`, `Time price opportunity`, `Profilo volume sessione`
     - Group 6: `Heikin Ashi`, `Renko`, `Line Break`, `Kagi`, `Point & Figure`, `Range`
     - Each row has hover `?` (`Clicca qui per saperne di più`) and star (`Aggiungi ai preferiti`).
7. *Separator*.
8. **Indicators & Templates** (`#header-toolbar-indicators`):
   - Main button (`[data-name="open-indicators-dialog"]`): chart icon + label `Indicatori` (tooltip `Indicatori, metriche e strategie`).
   - Adjacent chevron (`[data-qa-id="favorite-indicators-menu-button"]`): `Indicatori preferiti e modelli di indicatori` (Modelli).
   - **Indicators Modal** (`ev_b8c3e98a...`):
     - Title: `Indicatori, metriche e strategie`, Search input placeholder: `Cerca`
     - Left nav groups:
       - `PERSONALE`: `I miei script`, `Acquistato`
       - `INTEGRATO`: `Tecnici` *(default active)*, `Fondamentali`
       - `COMMUNITY`: `Selezione editoriale`, `Top`, `Tendenza`, `Marketplace`
     - Filter pills: `Indicatori` *(active)*, `Strategie`, `Profili`, `Pattern`, `Options`
     - List header: `NOME SCRIPT` (alphabetical technical indicators e.g. `24-hour volume`, `Accumulation/distribution`, `Aroon`, `Auto fib retracement`, `Average directional index`, etc., with `BETA` badges where applicable).
9. *Separator*.
10. **Alert** (`#header-toolbar-alerts`, clock+ icon + `Alert`, tooltip `Crea alert`).
11. **Bar Replay** (`#header-toolbar-replay`, `<<` icon + `Replay`, tooltip `Bar replay`).
12. *Separator*.
13. **Undo / Redo** (`Annulla`, `Ripeti`, curved left/right arrows, disabled when stack empty).
14. **Right-aligned Cluster**:
    - **Layout Split Selector** (`#header-toolbar-layouts`, tooltip `Impostazione layout`):
      - Grid rows (`ev_e1024ef3...`): `1`, `2` (vertical split / horizontal split), `3` (6 presets), `4` (10 presets incl. 2×2), `5`, `6`, `7`, `8`, `9`, `10`, `12`, `14`, `16`.
      - Bottom section `SINCRONIZZA NEL LAYOUT`: toggles `Simbolo`, `Timeframe`, `Cursore` *(on by default)*, `Ora`, `Range data`.
    - **Save / Manage Layout** (`#header-toolbar-save-load`): `Salva` + dropdown chevron (`Gestisci layout`).
    - *Separator*.
    - **Quick Search** (`#header-toolbar-quick-search`, tooltip `Ricerca rapida`).
    - **Chart Settings Gear** (`#header-toolbar-properties`, hexagon gear, tooltip `Impostazioni`):
      - 7-tab dialog (`ev_1f6e203c...`): `Simbolo`, `Legenda`, `Scale e linee`, `Canvas`, `Trading`, `Alert`, `Eventi`.
      - Under `Simbolo`: `CANDELE` (`Colore basato sulla chiusura precedente`, `Corpo` `#089981`/`#f23645`, `Bordi`, `Ombra`), `MODIFICA DEI DATI` (`Adegua i dati a seconda dei dividendi`, `Precisione: Predefinito`, `Fuso orario: (UTC+1) Berlino`), footer `Modello ▾`, `Annulla`, `Ok`.
    - **Fullscreen** (`#header-toolbar-fullscreen`, `Modalità schermo intero`).
    - **Snapshot Camera** (`#header-toolbar-screenshot`, `Fai uno screenshot`).
    - **Publish / Share Idea** (`#header-toolbar-publish-desktop`, lightbulb+ icon, `Condividi la tua idea con la community`).
    - **Trade Pill** (`role="button" name="Trade"`, subtle outlined pill): opens `Fai pratica senza rischi` (`Paper Trading` / `Replay Trading`) + `Fai trading con il tuo broker` (OANDA, easyMarkets, FxPro, ThinkMarkets, Pepperstone, Trade Nation, Tickmill, Capital.com, FOREX.com, etc.) (`ev_31a16a71...`).
    - **Promo CTA Pill** (`Black Friday` solid high-contrast pill — omit or replace with subtle `Aggiorna` / `Pubblica` CTA in our clone).

### 3.3 Left Drawing Toolbar (`52px` wide, `.layout__area--left`)
Observed top-to-bottom in `ev_3653b076...`, `ev_907c03a8...`, `ev_66bd2546...` (each tool group has a main icon button + right hover caret opening its flyout submenu):

| # | `data-name` / Group | Primary Button (Italian) | Submenu Tooltip (Italian) | Observed Sub-tools / Notes |
|---|---|---|---|---|
| 1 | `linetool-group-cursors` | `Croce` | `Cursori` | Crosshair (`[pressed]` default), Dot, Arrow, Eraser |
| 2 | `linetool-group-trend-line` | `Trendline` | `Strumenti analisi trend` | `Linee`: `Trendline (Alt+T)`, `Raggio`, `Infolinea`, `Linea estesa`, `Angolo trend`, `Linea orizzontale (Alt+H)`, `Raggio orizzontale (Alt+J)`, Canali (`ev_66bd2546...`) |
| 3 | `linetool-group-gann-and-fibonacci` | `Ritracciamento Fib` | `Strumenti di Gann e Fibonacci` | Fib Retracement, Fib Extension, Pitchfork, Gann Fan |
| 4 | `linetool-group-patterns` | `Pattern XABCD` | `Pattern` | XABCD, Cypher, Testa e Spalle, Onde di Elliott |
| 5 | `linetool-group-prediction-and-measurement` | `Posizione long` | `Strumenti di misurazione e previsione` | Posizione long, Posizione short, Previsione, Intervallo di prezzi/date |
| 6 | `linetool-group-geometric-shapes` | `Pennello` | `Forme geometriche` | Pennello, Evidenziatore, Rettangolo, Ellisse, Triangolo, Percorso |
| 7 | `linetool-group-annotation` | `Testo` | `Strumenti di annotazione` | Testo, Nota, Callout, Etichetta prezzo, Freccia |
| 8 | `linetool-group-font-icons` | `Icona` | `Icone` | Emoji / sticker markers |
| — | *Divider* | | | |
| 9 | `ai-copilot-area` | `Range AI` | — | New 2026 range selection tool (optional in clone) |
| 10 | `measure` | `Misura` | — | Ruler (price delta, %, bars, time span) |
| 11 | `zoom` | `Ingrandisci` | — | Box zoom-in (`Zoom out` appears when zoomed) |
| — | *Divider* | | | |
| 12 | `magnet-button` | `Modalità magnete` (OHLC snap) | `Calamite` | Weak / Strong OHLC magnet |
| 13 | `drawginmode` | `Continua a disegnare` | — | Stay in drawing mode toggle |
| 14 | `lock-all` | `Blocca disegni e indicatori` | `Opzioni di blocco` | Lock all drawings |
| 15 | `hide-all` | `Nascondi tutti gli strumenti di disegno` | `Nascondi opzioni` | Hide drawings / indicators / positions |
| 16 | `removeAllDrawingTools` | `Rimuovi oggetti` | `Rimuovi opzioni` | Remove drawings / indicators / all |

### 3.4 Main Chart Canvas (`region "Grafico #1"`, `.layout__area--center`)
Observed in `ev_907c03a8...` and `ev_68d54505...`:
- **Top-Left Series Legend Row** (`[data-qa-id="legend-series-item"]`):
  - Circular symbol logo + bold clickable title (`Juventus Football Club S.p.A.`) · clickable timeframe (`1D`) · exchange (`MIL`)
  - Status pills: `[• Closed]` (neutral gray pill) + `[15 min delayed]` (warm amber pill; or green dot `Mercato aperto` when open)
  - Live OHLCV values in exact Italian prefix format:
    `O - Aper. 1,885  H - Max. 1,907  L - Min. 1,790  C - Chius. 1,797  −0,088 (−4,68%)`
    (values colored `#22ab94` on bullish bar or `#f7525f` on bearish bar; hover crosshair updates OHLCV dynamically to hovered bar!)
- **Buy / Sell Quick Order Buttons** (`[data-name="buy-sell-buttons"]`, directly under title):
  - Red outlined pill (`VENDI`): `1,373` (bold) above `VENDI` (9px uppercase), border/text `#f7525f`, translucent red tint
  - Centered spread readout: `0,075` (11px muted)
  - Blue outlined pill (`COMPRA`): `1,448` (bold) above `COMPRA` (9px uppercase), border/text `#2962ff`, translucent blue tint
- **Active Indicators Legend Rows** (`[data-qa-id="legend-source-item"]`):
  - Each row shows indicator short title (`Vol`, `SMA 20`, `RSI 14`) + current value (`3,28 M`, colored to match bar/series)
  - Hover action buttons: `Nascondi` (eye), `Impostazioni` (gear), `Elimina` (trash), `Più opzioni` (`...`)
  - Collapse chevron button below (`[data-qa-id="legend-toggler"]`, `Nascondi legenda indicatore`)
- **Canvas Visual Details**:
  - Subtle dotted horizontal & vertical gridlines (low-contrast `#1a1a1a` dark / `#f0f0f0` light)
  - Bullish candles `#089981` (body, border, wick); Bearish candles `#f23645` (body, border, wick)
  - Bottom volume histogram overlay (~18% pane height) with translucent `#089981` / `#f23645` bars
  - Dashed crosshair (`#707070` / `#8c8c8c`) with `#303030` axis pill labels (`1,888` on right price axis + circular `+` quick-alert trigger; `mar 26 Mag '26` on bottom time axis)
  - Dotted horizontal last-price line extending across chart + solid colored last-price badge on price axis (`1,375` in `#089981` green or `#f23645` red) + optional countdown timer line underneath on intraday timeframes + `3,28 M` volume badge on axis
  - Bottom-axis corporate event badges (`E` Earnings square, `S` Split/News circle)
  - Hover-revealed floating bottom-center navigation toolbar (`Controlli navigazione`): `Rimpicciolisci`, `Ingrandisci`, `Scorri verso sinistra`, `Scorri verso destra`, `Reimposta la visualizzazione del grafico`, `Scorri fino all'ultima barra`
  - Bottom-right price-axis controls: `Auto (adatta dati a schermo)` (`auto`), `Logaritmica` (`log`), `Percentuale` (`%`), plus settings gear icon in the `56×28` bottom-right corner cell.
- **Bottom Quick-Range & Timezone Bar** (`.chart-controls-bar`, `39px` tall):
  - Left: `1D` (`1m→1D`), `5D` (`5m→5D`), `1M` (`30m→1M`), `3M` (`1H→3M`), `6M` (`2H→6M`), `YTD` (`1D→YTD`), `1Y` (`1D→1Y`), `5Y` (`1W→5Y`), `Tutto` (`1M→All`) + divider + calendar `Vai a` (`go-to-date`)
  - Right: live clock `20:44:08 UTC+1` (`time-zone-menu`) + divider + `adg` (`Adegua i dati a seconda dei dividendi`), `%`, `log`, `auto`.

### 3.5 Right Sidebar (`300px`) & Far-Right Tool Rail (`42–46px`)
Observed in `ev_907c03a8...`, `ev_abdcd633...`, `ev_e9fffa1f...`, `ev_7c1368b0...`:

#### Far-Right Tool Rail (`[data-name="right-toolbar"]`, top-to-bottom)
1. **Top Workspace Icons**:
   - `Watchlist, dettagli e notizie` (`base`) — active by default
   - `Alert` (`alerts`) — Manage alerts & triggered log
   - `Albero oggetti e finestra dati` (`object_tree`) — dual-tab sidebar: `Albero oggetti` (series/indicators/drawings tree + group/clone/move) & `Finestra dati` (live OHLCV + indicator numeric readout under crosshair)
2. *Separator*
3. **Analysis & Tool Icons**:
   - `AI Copilot` (`copilot-dialog-button`)
   - `Screener` (`screener-dialog-button`) — opens `Screener azioni` split panel
   - `Screener Pine` (`pine-screener-dialog-button`)
   - `Editor Pine` (`pine-dialog-button`) — opens `Editor Pine` split panel
   - `Calendari` (`calendar-dialog-button`) — opens `Calendario` (`Economico`, `Utili`, `Dividendi`, `IPO`)
   - `Community` (`community-hub-button`) — Community ideas & scripts
   - `Notifiche` (`notifications-button`)
   - `Chat` (`chats-button`)
   - `Prodotti` (`products-button`, 3×3 grid pill)
4. *Bottom Separator*
5. `Aiuto` (`help-button`, `?` circle)

#### Watchlist (`Lista titoli`, top half of `300px` right sidebar, ~`379px` height)
- Header: `Watchlist ▾` selector + `+` (`Aggiungi simbolo`), expand (`Visualizzazione avanzata`), `...` (`Impostazioni`)
- Sortable Columns: `Simbolo` | `Ultimo` | `Var` | `Var%`
- Default Italian Watchlist Groups & Tickers (observed live):
  - **Indici** (unlabeled top section): `FTMIB` (`TVC`), `SPX` (`TVC`), `DXY` (`TVC`), `UKX` (`TVC`), `DEU40` (`TVC`)
  - **FOREX** (collapsible header): `EURUSD`, `EURGBP`, `USDJPY`, `GBPUSD` (`FXCM`, with superscript 5th pip digit)
  - **AZIONI**: `ENI` (`MIL`, `D` amber delayed badge), `ISP` (`MIL`, `D`), `TSLA` (`NASDAQ`), `AAPL` (`NASDAQ`)
  - **FUTURES**: `GOLD` (`TVC`), `USOIL` (`TVC`)
  - **CRIPTO**: `BTCUSD`, `ETHUSD`, `BTCEUR` (`BITSTAMP`)
- Row polish: circular 18–20px symbol logo, market status dot (`Mercato aperto` / `Mercato chiuso`), flash highlight on tick, HTML hover tooltip showing full description + exchange + `Tempo reale` / `In differita` + market state.

#### Symbol Details Card (bottom half of `300px` right sidebar, vertically scrollable)
Observed section order for `MIL:JUVE`:
1. **Header**: Logo + `JUVE` + `Metriche` button + add-note button + `...` settings
2. **Identity**: Full name link (`Juventus Football Club S.p.A.`) · `MIL`, Sector (`Servizi al consumatore`) · Industry (`Intrattenimento/spettacolo`)
3. **Price Hero**: `1,375` (24px bold) + `D` / `EUR` + `+0,106` `+8,35%` (green/red) + `Mercato chiuso` + `Ultimo aggiornamento il 17:55 GMT+1`
4. **Volume Bar**: `Volume 3,28 M` vs `Volume medio (30D) 1,25 M` with horizontal two-tone progress bar (blue fill + teal/gray baseline)
5. **Notizie Card**: Rounded tinted card (`#241b37` dark / `#ebe6f7` light), purple `Notizie · 8 ott` label, headline, `Altri eventi >`
6. **Statistiche chiave**: `Capitalizzazione di mercato`, `Rendimento da dividendi (indicato)`, `Rapporto Prezzo/Utili (TTM)`, `EPS base (TTM)`
7. **EPS**: Mini scatter/bar (`Attuale` vs `Stima`, `Maggiori informazioni`)
8. **Dividendi**: Yield / payout summary
9. **Conto economico**: `Annuale` / `Semestrale` toggle + grouped bar/line (`Ricavi`, `Utile netto`, `Margine netto %`, `Più dati finanziari`)
10. **Performance**: 6-tile grid (`1W`, `1M`, `3M`, `6M`, `YTD`, `1Y` in green/red pill cards)
11. **Stagionalità**: Multi-year overlay (`2026`, `2025`, `2024`, `Più stagionali`)
12. **Tecnici**: Semi-circular speedometer gauge (`Forte vendita` → `Vendita` → `Neutro` → `Compra` → `Forte acquisto`) + `Dettagli tecnici`
13. **Rating analisti**: Gauge + `Target di prezzo ad 1 anno` + `Vedi previsione`
14. **Profilo**: `Sito Web`, `Dipendenti (FY)`, `ISIN`, `CUSIP`, `FIGI`, `Codice CFI`, company description paragraph.

### 3.6 Drawer Architecture: Screener, Pine Editor, Strategy Tester, Paper Trading & Registro
- **Observed 2026 Layout Behavior**:
  - Clicking `Screener` (`ev_e9fffa1f...`), `Editor Pine` (`ev_7c1368b0...`), or `Calendari` (`ev_abdcd633...`) in the right rail opens a resizable **right-half split drawer** (`Sposta in split-view`, `Riduci pannello`, `Chiudi`).
  - `layout__area--bottom` (`#footer-chart-panel`, `toggle-visibility-button`, `toggle-maximize-button`) remains in the DOM for the classic horizontal **Bottom Drawer** (and hosts Paper Trading / Strategy Tester / Pine / Screener when docked at the bottom).
  - **Screener azioni** (`ev_e9fffa1f...`): Header `Screener azioni ▾`, sub-title `Tutte le azioni ▾`, preset pills (`T` Tutte le azioni, `I` I più capitalizzati, `M` Maggiori utili netti, etc.), `IA` + `Filtri` + `Panoramica ▾` + refresh/expand buttons, table columns `Simbolo (375) | Prezzo | Var % | Vol | Vol rel | Cap. mercato ↓ | P/E | EPS dil TTM | EPS diluito crescita TTM YoY | Rendimento div % TTM | Settore | Rating analisti`.
  - **Editor Pine** (`ev_7c1368b0...`): Header `Editor Pine`, toolbar `Script senza titolo ▾` + `Aggiungi al Grafico` (play) + `Salva script` (cloud) + `Pubblica script` + `...`, syntax-highlighted monospace editor (`//@version=6`, line numbers, minimap), bottom status bar (`Console` icon, `Linea 1, Col 1`, `Pine Script® v6`).
  - **Paper Trading & Bottom Trading Panel** (`ev_66bd2546...`): Anonymous activation presents the sign-in modal (`Pronto a fare trading?` → `Registrati gratis`); its embedded official product preview confirms the authenticated layout:
    - Bottom drawer summary bar: `Paper Trading ▾` | `Saldo` | `Equity` | `P&L realizzato` | `P&L non realizzato`
    - Bottom drawer tabs: `Posizioni` | `Ordini` | `Storico ordini` | `Storico saldo` | `Registro attività` | `Storico operazioni`
    - Right-side Order Ticket (`Order | DOM`): `Vendi` / `Compra` dual tabs, `Market | Limit | Stop`, `Prezzo`, `Quantità / Margine`, `Take Profit / Stop Loss`, primary blue/red submit CTA.

---

## 4. Network Architecture, API Origins, WebSockets & Bundles (Observations)

### 4.1 Observed API Origins & HTTP Endpoints (`ev_3653b076...`, `ev_4c090519...`, `ev_6d4aae34...`, `ev_e041f21a...`)

| Origin | Method & Endpoint | Observed Purpose |
|---|---|---|
| `https://it.tradingview.com` | `GET /chart/` | Supercharts HTML shell & inline bootstrap config (`lang="it"`) |
| `https://it.tradingview.com` | `GET /api/v1/study-templates` | Saved indicator templates (`200`) |
| `https://it.tradingview.com` | `GET /api/v1/brokers/trading_panel` | Broker directory & ratings for `Trade` dialog (`200`) |
| `https://it.tradingview.com` | `GET /api/v1/offers/`, `GET /market/shopconf/` | Subscription/offer banners (`200`) |
| `https://it.tradingview.com` | `POST /check_language/` | Locale verification (`200`) |
| `https://symbol-search.tradingview.com` | `GET /symbol_search/v3/?text=JUVE&hl=1&exchange=&lang=it&domain=production&enable_grouping=true&sort_by_country=IT&promo=true` | Live incremental Symbol Search across all asset classes (`200`) |
| `https://scanner.tradingview.com` | `GET /symbol?symbol=MIL:JUVE&fields=price_52_week_high,price_52_week_low,sector,country,market,Perf.W,Perf.1M,Perf.3M,Perf.6M,Perf.Y,Perf.YTD,Recommend.All,average_volume_10d_calc,average_volume_30d_calc,...` | Symbol Details key metrics, 52w range, performance & technical recommendation (`200`) |
| `https://scanner.tradingview.com` | `POST /italy/metainfo?label-product=popup-screener-stock` | Italian market screener metadata (`200`) |
| `https://scanner.tradingview.com` | `GET /enum/ordered?id=index,country,exchange,industry,sector,analyst_rating,technical_rating,...&lang=it` | Localized Italian enum labels for screener filters (`200`) |
| `https://scanner-backend.tradingview.com` | `GET /enum/ordered?id=metrics_full_name,metrics&lang=it` | Localized metric names (`200`) |
| `https://screener-facade.tradingview.com` | `GET /screener-facade/api/v1/columns?version=66` (`+/params`, `+/filters`) | Screener column & filter schemas (`200`) |
| `https://screener-facade.tradingview.com` | `POST /screener-facade/api/v1/standalone-screener/scan?screener_key=stock&version=66` | Live stock screener query & pagination (`200`) |
| `https://screener-storage.tradingview.com` | `GET /screener-storage/api/v2/screens/recent/` & `/favorites/?screener_key=stock` | Preset & favorite screens (`200`) |
| `https://news-mediator.tradingview.com` | `GET /public/news-flow/v2/news?filter=lang:it&filter=symbol:MIL:JUVE&client=detail\|chart` | Localized symbol news feed (`200`) |
| `https://news-mediator.tradingview.com` | `GET /public/doc-screener/v1/events?filter=event_type:earnings_call&filter=symbol:MIL:JUVE` | Earnings / corporate events on chart axis (`200`) |
| `https://notifications.tradingview.com` | `GET /news/channel/live-events` | Live news/event notification channel (`200`) |
| `https://data.tradingview.com` | `GET /ping` | Datafeed connectivity health ping (`200`) |
| `https://s3.tradingview.com` | `GET /conversions_it.json` | Italian unit/currency conversions (`200`) |
| `https://s3-symbol-logo.tradingview.com` | `GET /...svg` | Vector circular ticker/exchange/country logos (`200`) |
| `https://static.tradingview.com` | `GET /static/bundles/<name>.<hash>.(js\|css)` | 389 webpack-style modular JS chunks + 338 CSS bundles |

### 4.2 Observed Real-Time WebSockets (`ev_3653b076...`, `ev_7f35c527...`, `ev_1b800181...`)
1. **Market Data & Chart Series Stream**:
   - `wss://data.tradingview.com/socket.io/websocket?from=chart%2F&date=2026-11-25T20%3A38%3A20&type=chart&auth=sessionid`
   - Observed 74 outbound frames + 22 inbound frames within 7s on initial load (carries session setup, OHLCV historical bar series, symbol resolution, and Watchlist real-time quote subscriptions).
   - Static bundle analysis (`ev_1b800181...`) confirms the WebSocket URL is constructed dynamically at runtime (`call:WebSocket` in `scr_b1a374060ad3b40496b679e5c69c1a07de0562387d8baa4b0af243aa8bd1735a:2:2061`).
2. **Public Push Notifications / Live Events Stream**:
   - `wss://pushstream.tradingview.com/message-pipe-ws/public`

### 4.3 Client Bundle & Persistence Architecture (`ev_e041f21a...`, `ev_3653b076...`)
- **Modular Feature Chunks** (206 named bundles out of 389 total scripts): `drawing-toolbar`, `full-toolset`, `floating-toolbars`, `footer-widget`, `footer-widget-tab-model`, `backtesting-widget-controller`, `backtesting-widget-tab-model`, `alerts-widget-impl`, `alerts-manage-widget-impl`, `alerts-log-widget-impl`, `details-scanner-client`, `details-seasonals`, `symbol-search-dialog`, `screener-dialog`, `advanced-chart-lollipops`.
- **Client Persistence Keys**:
  - `localStorage`: `tradingview.editchart.model.symbol`, `tradingview.editchart.model.interval`, `tradingview.editchart.model.style`, `tradingview.widgetbar.layout-settings`, `tradingview.trading.orderWidgetMode.`, `tradingview.toggle_delete_locked_linetools`.
  - `sessionStorage`: `ChartDrawingToolbarWidget.visible`, `ChartFavoriteDrawingToolbarWidget.visible`, `symbol-lists.activeList`, `widget.watchlist.columns-percentages`, `widget.watchlist.table-view`, `widget.watchlist.logo-enabled`, `chart.bottom-widgetbar`, `bottom_last_edited_script`, `trading.tradingPanelVisible`, `trading.tradingPanelActivePage`, `trading.panelWidth`, `chartPageGrid.panelsState`, `chartPageGrid.sizesState`.

---

## 5. Evidence Hygiene: Observations vs. Inferences vs. Unknowns & Build Guidance

### 5.1 Observations (Directly Verified by REA Evidence)
- Exact CSS variables, dark/light hex palette (`#000000` / `#131313` / `#222222` / `#303030` / `#464646` dark vs. `#ffffff` / `#f2f2f2` / `#ebebeb` light; `#2962ff` blue; `#089981`/`#22ab94` green; `#f23645`/`#f7525f` red), font stacks, and 4px gutter geometry.
- Exact pixel dimensions of all Supercharts grid regions at `1440×900`.
- Complete Italian UI copy for Top Toolbar, Hamburger Menu, all 21 Chart Styles, all Timeframe groups, Indicators modal, Symbol Search modal, Settings 7-tab dialog, all 16 Left Drawing Toolbar groups, Main Chart Legend & Buy/Sell buttons, Right Rail (13 icons), Watchlist (5 default Italian groups), Symbol Details (14 sections), Screener (`375` MIL stocks), Pine Editor v6, Layouts (`1–16` + sync switches), Object Tree/Data Window, and Economic Calendar.
- All observed REST endpoints, WebSocket URLs, storage keys, and 389 loaded JS chunks.

### 5.2 Inferences (Bounded Engineering Recommendations for Our Clone)
- **Dual-Drawer Ergonomics Aligned with `src/store/TradingViewContext.tsx`**: While live 2026 TradingView opens `Screener`, `Editor Pine`, and `Calendario` in a right split-view drawer and gates live `Paper Trading` behind sign-in, our local `tradingview/` app should keep the **classic resizable Bottom Drawer** (`Screener azioni`, `Editor Pine`, `Tester strategia`, `Pannello di trading` [ungated Paper Trading €100.000!], `Registro`) directly accessible from the bottom bar AND toggleable from both the `Trade` top-right pill and the Right Rail icons (`Screener`, `Editor Pine`, `Calendari`, `Alert`, `Finestra dati`, `Albero oggetti`, `Watchlist`). This matches `src/store/`'s `rightPanel` and `bottomPanel` state cleanly while preserving 100% authentic Italian Supercharts chrome and visual density.
- **Dark Default + Seamless Light Switch**: Even though anonymous `it.tradingview.com/chart/` initially loads Light until `Tema scuro` is toggled, defaulting our app to Dark (`#000000` panes / `#222222` 4px gutters / `#131313` popups) with an instant `Tema scuro` toggle in the top-left hamburger menu delivers the iconic Supercharts workspace immediately while supporting both REA-verified palettes verbatim.
- **Chart Canvas Rendering**: Live TradingView renders candles, gridlines, crosshair, axes, and drawing objects onto stacked HiDPI HTML5 `<canvas>` layers (`pane-canvas`, `price-axis-A`) for 60fps pan/zoom/crosshair performance; our chart canvas component should follow the same HiDPI `<canvas>` architecture with CSS-synced theme tokens.

### 5.3 Unknowns & Limitations
- **Authenticated-only flows**: Paper Trading execution, Strategy Tester live report tables, saved cloud chart layouts, and creating persisted server-side alerts require TradingView authentication (`ev_66bd2546...` observed sign-in prompt `Pronto a fare trading?`). Exact live authenticated DOM for those views remains unobserved; Paper Trading tabs/fields above are derived from TradingView's own embedded product preview and standard Supercharts conventions.
- **Network budget omissions**: In initial captures (`ev_3653b076...`, `ev_7f35c527...`), 14 and 43 late events hit REA's `max-total-event-allocation-bytes` cap; `ev_4c090519...` and `ev_e9fffa1f...` recorded `0` dropped events.
- **WebSocket payload decoding**: `capture_browser_scenario` records WebSocket URLs and frame counts/sizes without decoding binary/framed payload contents; `inspect_web_page` (`ev_e041f21a...`) attached after initial WS handshake (`prior_activity_available: false`), so wire-level WS schemas were not captured in this pass.
- **Third-party bundle static analysis**: `analyze_web_bundle` across all 389 `static.tradingview.com` chunks exceeded a 50s total script-analysis budget (`provider_timeout`); first-party analysis on `https://it.tradingview.com` completed cleanly (`ev_1b800181...`, 13 scripts, 0 parse failures).
