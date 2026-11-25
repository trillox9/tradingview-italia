# REA Evidence & Blueprint: Italian TradingView Homepage & Markets Overview

> **Target URLs**: `https://it.tradingview.com/` and `https://it.tradingview.com/markets/`
> **Purpose**: Authoritative reverse-engineering specification & evidence report for recreating the Italian TradingView experience inside `/home/nani/varie/Giochi-TikTok/tradingview/`.
> **Evidence Hygiene Notice**: All captured DOM, CSS, accessibility, WebSocket, and JSON payload artifacts are treated strictly as untrusted data. **Observed Facts** (backed by REA Evidence IDs) are explicitly separated from **Inferences** and **Unknowns / Limitations**.

---

## 1. REA Evidence Ledger, Capture Parameters & Limitations

### 1.1 Execution Environment & Tooling Provenance

- **REA Engine**: `rea-agents` v6.10.1 (`scripts/rea.mjs`), `evidence_format: 2`.
- **Tooling Note**: Swarm worker environments do not receive `<mcp_servers>` or the lazy-loaded `call_mcp_tool` declaration; per REA skill recovery rules (`SKILL.md` / `references/connection-and-recovery.md`), all captures were executed through the project's cached `rea-agents` v6.10.1 public launcher (`/home/nani/.npm/_npx/af752b90495482d7/node_modules/rea-agents/scripts/rea.mjs`) using `capture-browser-scenario` in `launch` mode against `/usr/bin/google-chrome` (Chromium `157.0.8103.78`, `process_ownership: "provider-owned"`, `cleanup: "terminated-owned-process"`).
- **Standard Viewport & Locale**: `1440×900` (`device_scale_factor: 1`), `locale: "it-IT"`, `timezone: "Europe/Rome"`, `reduced_motion: "reduce"`, `service_workers: "block"`.
- **Anti-Bot / Access Boundary**: **Zero** CAPTCHAs, Cloudflare Turnstile challenges, anti-bot gates, or login walls were encountered on any public route (`/` or `/markets/`).

### 1.2 Canonical REA Evidence IDs (Observed)

| Capture Alias | Target URL | Parent REA Evidence ID (`capture_browser_scenario`) | Summary View Evidence ID | Completeness | Scope / Key Artifacts Captured |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `home_scroll_light` | `https://it.tradingview.com/` | `ev_cdca6442f4590fc0152c98927f2988ca76d00a28980f952f432b23588eab531e` | `ev_a26d6efa9669113480f08a235fdb1b9d1e8f150851ee5b80b93fc6b2431c0f95` | `incomplete` (`events` budget capped at 16 MiB) | 12-step full-page scroll top-to-footer, 1.21 MB DOM, 93.7 KB accessibility tree (2,198 lines), storage inventory, 166 CSS stylesheets. |
| `home_net_complete` | `https://it.tradingview.com/` | `ev_f3f47e4e83fcdbca928400b72c6bf83cc1eb001d2ba68c07c0cb4bd42d6484ce` | `ev_ce8e97847ff81bf2a74f5dbd05e84a5f3a367c255742a57160e6f6a01d888d0e` | **`complete`** (`dropped: 0`) | 1,463 network events (489 requests, 485 responses, 4 failed beacons) establishing complete origin and endpoint inventory. |
| `markets_initial` | `https://it.tradingview.com/markets/` | `ev_4ee92ebb069871ebb334922a9fd3752bd50883ee8f13347d01d841833cbf03b3` | `ev_931721089f6c61a29e4b52e8e492bdb93772ba5bf498a993f566c74feb579f54` | `incomplete` (`events` budget) | Initial `/markets/` load showing seasonal promo modal overlay, 1.18 MB DOM, 67.4 KB accessibility tree (1,918 lines). |
| `home_ws_probe` | `https://it.tradingview.com/` | `ev_eb5e500a5ba17c5ee0461cc95f18a29c239ad4227eae849be324394ee97fdf7b` | `ev_56825de0eff7df1b2300193930e4dbd21eabe146fd656837f9d355a8be486d6c` | `incomplete` (step 4 failed after clicking `<a href="/chart/">`) | 139 live WebSocket frames (`wss://data.tradingview.com`, `wss://pushstream.tradingview.com`), full quote field list, 72 subscribed symbols. |
| `markets_clean_scroll` | `https://it.tradingview.com/markets/` | `ev_08976afb3690f326735a8404334a38e35235f63804f1df5932a26f49fb128012` | `ev_6bfea8fbd13acc8991e7bd091d5bb6d88b019eba9a871c96fd05cf9648320cc3` | `incomplete` (`events` budget) | Dismissed promo modal via `button "Chiudi"`, scrolled full `/markets/` page, 400 WebSocket frames, 313 subscribed symbols, `scanner.tradingview.com` endpoints. |
| `home_popovers` | `https://it.tradingview.com/` | `ev_e5001cb248ea50c33a9ffb0270bcea7260c01b9f655043f1f82c4e198c34793c` | `ev_54404593d32b30b51fa5a02a640378bf0fdd6153747a4a1983e1196399c58537` | **`complete`** | Opened User menu (`Menù utente`), Language menu (`Apri menu delle lingue`), and Global Search modal (`Cerca (Ctrl+K)`), capturing screenshots + accessibility diffs. |
| `tokens_and_apis` | `https://it.tradingview.com/` + `/markets/` | `ev_f4e61e3b9d684806ea81a840b35a82e9e974d78808368d40a1cfdab305d8f6c8` | `ev_4cc556ee14bfd19a4e39186fc3e9654376b1e95b459f81a9696b6eaca9ecce81` | `incomplete` (`events` budget at 128 MiB) | Captured full 106,146-byte core design-token stylesheet `31427.9c8232e619e36ed4ce6b.css` (192 root palette tokens + 809 light/dark semantic token pairs) + 16 JSON API response payloads. |
| `nav_dropdowns` | `https://it.tradingview.com/markets/` | `ev_9c1d4a4831e33d7f03a0f76e8d1cdcc47912867fe08da553c5b45928ff71c9c0` | `ev_9e741d3809bb521f67910f4fbd1b2b67b1a328757daf5d7ecfd5dbbe69f8adf6` | `incomplete` (step 16 stopped on disabled anonymous `themeSwitcher`) | Opened all 5 top-level nav dropdowns (`Prodotti`, `Community`, `Mercati`, `Broker`, `Altro`) via keyboard `Space` on `.tv-header__main-menu-item__chevron`; verified `aria-disabled="true"` on anonymous EU `Tema scuro` switch. |
| `dark_theme_render` | `https://it.tradingview.com/` + `/markets/` | `ev_f673e18ecd9dd9b48291bb2657ee711d7a8f63cb7ffce6a1b7db2e8484011c07` | `ev_df3a36845f577c36496bf1fd162d2c2e8739c7cede61ba043645e67fb719181f` | **`complete`** | Verified live `html.theme-dark[data-theme="dark"]` rendering across both `/` and `/markets/` via explicit `theme=dark` preference cookie. |

### 1.3 Saved Visual Reference Screenshots

All screenshots are 1440×900 desktop captures saved under `/home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/`:

- [it-tv-home-top.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-top.png) — Homepage top viewport: transparent dark promo header + Hero banner.
- [it-tv-home-markets-dark.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-markets-dark.png) — Dark mode `Panoramica mercato`: FTSE MIB intraday chart + `Indici principali` card.
- [it-tv-home-cards-dark.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-cards-dark.png) — Dark mode 3-column Market Summary cards: Cripto (`TOTAL` + Dominance Bitcoin), Indice Euro (`EXY` + Futures), Curva dei rendimenti USA + Obbligazioni societarie.
- [it-tv-home-markets-light.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-markets-light.png) — Light mode `Panoramica mercato` for direct light/dark comparison.
- [it-tv-home-indicators-dark.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-indicators-dark.png) — Dark mode `Indicatori e strategie` carousel (`Selezione editoriale` / `Popolari`, TV ribbon + `INDICATORE` pill, boost counters).
- [it-tv-home-ideas-light.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-ideas-light.png) — Floating sticky section pill nav (`Azioni Italiane`..`Broker`) + Italian `Idee di trading` 3-card carousel.
- [it-tv-home-search-modal.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-home-search-modal.png) — Global Search modal (`Cerca (Ctrl+K)` -> `Simbolo, ISIN o CUSIP`, tabs, asset-class filter pills).
- [it-tv-nav-dropdowns.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-nav-dropdowns.png) — Open `Prodotti` dropdown menu showing icon rows, uppercase group labels, and chevrons.
- [it-tv-markets-dark.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-markets-dark.png) — Dark mode `/markets/` (`Mercati, ovunque`, `Indici` pill tabs, full-width area chart, chart controls).
- [it-tv-markets-light.png](file:///home/nani/.gemini/antigravity/brain/97f0c6f3-0ae2-4dd1-a9fb-830495016ae5/it-tv-markets-light.png) — Light mode `/markets/` sticky asset pill nav, `Tendenze della community` 5-card strip, `Azioni con volume più elevato` & `Azioni più volatili`.

### 1.4 Unknowns & Limitations

1. **Seasonal Hero Takeover (Observed vs. Evergreen)**: Capture date was during TradingView's Black Friday campaign (`ev_f4e61e3b...`, `/api/v1/offers/` -> `black_friday.show_on_mainpage: true`), so the homepage hero displayed a seasonal `"Black Friday / Fino all'80% di sconto"` cosmic black-hole takeover and the header CTA button showed `"Black Friday / Fino all'80% di sconto"` instead of the evergreen `"Guarda prima / Poi agisci"` hero and `"Inizia"` / `"Inizia gratis"` blue/gradient CTA. Evergreen hero wording is therefore **inferred** (from the footer brand image `img "Look First"` and standard Italian TradingView copy) rather than directly observed in this seasonal window.
2. **Authenticated Experience**: All captures ran unauthenticated (`html.is-not-authenticated.is-not-pro`). Authenticated header controls (notifications bell, profile avatar, watchlist sync, saved chart layouts) were not observed.
3. **Nested Flyout Submenus**: Level-1 dropdown menus (`Prodotti`, `Community`, `Mercati`, `Broker`, `Altro`) were fully observed (`ev_9c1d4a48...`), including markers for level-2 submenus (`Screener menu`, `Calendari menu`, `Nazioni menu`, `Notizie menu`, `Indici menu`, `Azioni menu`, `Cripto menu`, `Futures menu`, `Forex menu`, `Reddito fisso menu`, `ETF menu`, `Economia globale menu`, `Download menu`, `Per le aziende menu`), whose leaf items mirror the Footer link taxonomy (`ev_cdca6442...`) but were not individually expanded via hover.
4. **Mobile Breakpoints**: All captures targeted desktop `1440×900`; mobile drawer navigation (`<=767px` / `<=1019px` breakpoints observed in CSS) was not visually captured.
5. **Network Request Bodies**: `request_body` was left `false` to preserve event budgets; scanner POST filter payloads were observed indirectly via the server's echoed `params` field in `scanner.tradingview.com` responses (`ev_f4e61e3b...`).

---

## 2. Complete Italian Navigation Structure

### 2.1 Top Header Bar (`header` / `.tv-header`)

**Observed Facts** (`ev_cdca6442...`, `ev_e5001cb2...`, `ev_9c1d4a48...`, `ev_f4e61e3b...`):

- **Height & Positioning**: `.tv-header__inner` height = **`64px`**, `position: sticky; top: 0; z-index: 101`, `display: flex; align-items: center`.
- **Adaptive Hero Backdrop**: Over the dark homepage Hero (`.tv-header--promo`), text is `--color-white` (`#FFFFFF`), search pill uses translucent glass (`#0F0F0F73` with `backdrop-filter: blur(12px) saturate(1.4)` and `#FFFFFF1F` border), backed by a `120px` vertical gradient `.tv-header__backdrop: linear-gradient(180deg, #0F0F0F, #0F0F0F00)`. Upon scrolling into the page body, the header adopts the active theme's solid surface (`#FFFFFF` light / `#000000` dark).
- **Skip Link**: First focusable control is `button "Vai al contenuto principale"`.

**Left-to-Right Slot Order**:

| Slot | Control | Exact Italian Label / Accessible Name | Target / Behavior |
| :--- | :--- | :--- | :--- |
| 1 | Brand Logo | `link "Pagina principale TradingView"` (`TV TradingView` wordmark + geometric TV monogram SVG) | Navigates to `/` |
| 2 | Global Search Pill | `button "Cerca"` displaying `🔍 Cerca (Ctrl+K)` | Opens Global Search Modal (`Ctrl+K` / `/` shortcut) |
| 3 | Main Nav (`<nav>`) | `Prodotti`, `Community`, `Mercati`, `Broker`, `Altro` | Each item is `<a href="...">Label<span role="button" aria-label="menu Label">chevron</span></a>`; active route (e.g. `Mercati` on `/markets/`) is styled in `--color-tv-blue-500` (`#2962FF`) |
| 4 | Language Selector | `button "Apri menu delle lingue"` displaying globe SVG + `IT` | Opens 19-language vertical dropdown menu (`Italiano` highlighted in dark pill) |
| 5 | User Menu | `button "Apri menù utente"` displaying outline user-silhouette SVG | Opens `menu "Menù utente"` popover |
| 6 | Primary CTA Pill | Seasonal observed: `Black Friday / Fino all'80% di sconto` (`linear-gradient` coral-red `#FF2E3E` -> orange `#FF9800` skewed pill). Evergreen build recommendation: **`Inizia`** / **`Prova gratis`** in `#2962FF` (or brand gradient). | Navigates to `/pricing/` or `/chart/` |

### 2.2 All 5 Top Navigation Dropdown Menus (Observed `ev_9c1d4a48...`)

Dropdown container styling: rounded popover (`border-radius: 12px`), elevated white (`#FFFFFF`) or dark (`#131313`) surface, subtle shadow `0 0 2px var(--color-other-shadow-m-edge), 0 3px 9px var(--color-other-shadow-m-drop)`, `11px` uppercase muted group headers (`--color-text-secondary`), icon + label rows, right chevron `>` for nested submenus.

1. **`Prodotti`** (`/chart/`):
   - Featured Hero Row: **`Grafici`** — subtitle *"L'unico terminale, per domarli tutti"* (`/chart/`)
   - Group **`STRUMENTI INDIVIDUALI`**:
     - `Screener` (`/screener/`) `>`
     - `Calendari` (`/economic-calendar/`) `>`
     - `Notiziario` (`/news-flow/`)
     - `Portafogli` (`/portfolios/`)
     - `Curve di rendimento` (`/yield-curves/`)
     - `Opzioni` (`/options/`)
     - `Mappe macro` (`/macro-maps/`)
   - Group **`SU DI NOI`**:
     - `Costi` (`/pricing/`)
     - `Caratteristiche` (`/features/`)
     - `Novità` (`/support/whats-new/`)
     - `Dati di mercato` (`/data-coverage/`)

2. **`Community`** (`/ideas/`):
   - Featured Row 1: **`The Leap`** — *"Gareggia per vincere premi in denaro reale"* (`/the-leap/`)
   - Featured Row 2: **`Negozio degli indicatori`** — *"Ottieni script di autori verificati"* (`/scripts/marketplace/`)
   - Group **`CREATO DAI TRADER`**:
     - `Idee di trading` (`/ideas/`)
     - `Indicatori e strategie` (`/scripts/`)
     - `Contest della community` (`/community-competitions/`)
   - Group **`SU DI NOI`**:
     - `La forza della community` (`/social-network/`)

3. **`Mercati`** (`/markets/`):
   - Top Items:
     - `Tutto il mondo` (`/markets/`)
     - `Nazioni` (`/markets/italy/`) `>`
     - `Notizie` (`/news/`) `>`
   - Group **`ATTIVITÀ`**:
     - `Indici` (`/markets/indices/`) `>`
     - `Azioni` (`/markets/stocks-italy/`) `>`
     - `Cripto` (`/markets/cryptocurrencies/`) `>`
     - `Futures` (`/markets/futures/`) `>`
     - `Forex` (`/markets/currencies/`) `>`
     - `Reddito fisso` (`/markets/bonds/`) `>`
     - `ETF` (`/markets/etfs/`) `>`
     - `Economia globale` (`/markets/world-economy/`) `>`

4. **`Broker`** (`/brokers/`):
   - Top Items: `I migliori broker` (`/brokers/`), `Confronta i broker` (`/brokers/compare/`), `Apri un account` (`/brokers/?with_open_account=true`), `Premi` (`/broker-awards/`)
   - Group **`BROKER IN EVIDENZA`**: `OANDA 4.5` (`/broker/OANDA/`), `Capital.com 4.5` (`/broker/Capitalcom/`)
   - Group **`COS'È`**: `Spazio di trading` (`/trading/`)

5. **`Altro`** (`/support/`):
   - Top Items: `Conoscenze di base` (`/support/knowledge-base/`), `Download` (`/desktop/`) `>`, `Per le aziende` (`/free-charting-libraries/`) `>`
   - Group **`SOCIETÀ`**: `Descrizione` (`/about/`), `#TradingView` (`/wall-of-love/`), `Missione spaziale` (`/space-mission/`), `Carriere` (`/careers/`), `Blog/Notizie` (`https://www.tradingview.com/blog/it/`), `Kit multimediale` (`/media-kit/`), `Dichiarazione di accessibilità` (`/accessibility/`)

### 2.3 User Menu, Theme Toggle & Language Selector (Observed `ev_e5001cb2...`, `ev_9c1d4a48...`, `ev_f673e18e...`)

- **User Menu (`Menù utente`)**:
  - `Accedi` (primary blue `#2962FF` text with sign-in icon, followed by horizontal divider)
  - `Aiuto`
  - `Novità`
  - Divider
  - **`Tema scuro`** toggle switch (`input[type="checkbox"][data-name="header-user-menu-switch-theme"]`).
  - *Observed Theme Architecture*: TradingView defaults to `<html class="theme-light" data-theme="light">` even when OS `prefers-color-scheme: dark` is set (`ev_cdca6442...`). For anonymous EU visitors prior to cookie consent, `Tema scuro` has `aria-disabled="true"` (`ev_9c1d4a48...`). Setting cookie `theme=dark` switches the document to `<html class="theme-dark" data-theme="dark">` across `/` and `/markets/` (`ev_f673e18e...`). **Build Recommendation**: Make `Tema scuro` always interactively toggleable in our local clone (defaulting to Dark or Light with `localStorage` persistence, and immediately toggling `data-theme="dark"` / `"light"` on `<html>`).
- **Language Selector (`IT`)**: Lists 19 locales starting with **`Italiano`** (active solid pill), `English`, `English (India)`, `Deutsch`, `Français`, `Español`, `Polski`, `Türkçe`, `Русский`, `Português`, `Bahasa Indonesia`, `Bahasa Melayu`, `ภาษาไทย`, `Tiếng Việt`, `日本語`, `한국어`, `简体中文`, `繁體中文`, `العربية`.

### 2.4 Global Search Modal (`Cerca (Ctrl+K)`) (Observed `ev_e5001cb2...`)

- **Top Floating Pill Bar**: Magnifying glass icon + searchbox placeholder **`Simbolo, ISIN o CUSIP`** + text button **`Cancella`** + close `×` (`button "Chiudi"`).
- **Modal Card Below** (rounded `16px`, backdrop dim):
  - **Primary Underline Tabs**: `Simboli` (active bold bottom bar) | `Idee` | `Script` | `Persone`
  - **Asset-Class Filter Chips**: `Tutto` (active solid pill) | `Azioni` | `Fondi` | `Futures` | `Forex` | `Cripto` | `Indici` | `Obbligazioni` | `Economia` | `Opzioni`
  - **Result Row Layout**: `28px` circular symbol logo | Bold ticker (`NVDA`, `EURUSD`, `BTCUSD`, `FTMIB`) + second line description & uppercase micro asset badge (`STOCK`, `FOREX`, `SPOT CRYPTO`, `FUTURES`, `INDEX`, `FUND ETF`, `COMMODITY CFD`) | Right side: exchange name (`NASDAQ`, `MIL`, `CME`, `ICE`, `Binance`, `TVC`) + optional `+N ⌄` multi-exchange badge + circular exchange/country icon.

---

## 3. Exact Visual Design System (Observed from Production CSS `ev_f4e61e3b...` & `ev_cdca6442...`)

All tokens below were extracted directly from TradingView's production design-system stylesheet `31427.9c8232e619e36ed4ce6b.css` (106,146 bytes) and 162 companion CSS bundles.

### 3.1 Core Palette Scale (`:root`)

| Family | Step 50 | Step 100 | Step 150 | Step 200 | Step 300 | Step 400 | Step 500 | Step 600 | Step 700 | Step 750 | Step 800 | Step 850 | Step 900 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`cold-gray`** | `#F9F9F9` | `#F2F2F2` | `#EBEBEB` | `#DBDBDB` | `#B8B8B8` | `#9C9C9C` | `#808080` (`grey`) | `#636363` | `#464646` | `#303030` | `#222222` | `#131313` | `#000000` |
| **`tv-blue`** | `#E3EFFD` | `#BBD9FB` | — | `#90BFF9` | `#5B9CF6` | `#3179F5` | **`#2962FF`** | `#1E53E5` | `#1848CC` | — | `#143EB2` | — | `#0C3299` |
| **`minty-green`** | `#DAF2EE` | `#ACE5DC` | — | `#70CCBD` | `#42BDA8` | `#22AB94` | **`#089981`** | `#06806B` | `#056656` | — | `#004D40` | — | `#00332A` |
| **`ripe-red`** | `#FFEBEC` | `#FCCBCD` | — | `#FAA1A4` | `#F77C80` | `#F7525F` | **`#F23645`** | `#CC2F3C` | `#B22833` | — | `#991F29` | — | `#801922` |
| **`forest-green`** | `#DAF2E6` | `#ACE5C9` | — | `#70CC9E` | `#42BD7F` | `#22AB67` | `#089950` | `#068043` | `#056636` | — | `#004D27` | — | `#1A3326` |
| **`tan-orange`** | `#FFF3E0` | `#FFE0B2` | — | `#FFCC80` | `#FFB74D` | `#FFA726` | `#FF9800` | `#FB8C00` | `#F57C00` | — | `#EF6C00` | — | `#E65100` |

*Additional accent dark-alpha tints*: `tv-blue-a800: #142E61`, `tv-blue-a900: #132042`; `minty-green-a800: #10443B`, `minty-green-a900: #082621`; `ripe-red-a800: #4D191D`, `ripe-red-a900: #331F20`. Extra cold-gray intermediates: `250: #C9C9C9`, `350: #A8A8A8`, `450: #8C8C8C`, `550: #707070`, `650: #555555`.

### 3.2 Semantic Light vs. Dark Token Matrix (Observed — 809 Paired Tokens)

| Semantic Role | CSS Custom Property | Light Mode (`data-theme="light"`) | Dark Mode (`data-theme="dark"`) |
| :--- | :--- | :--- | :--- |
| Page Canvas BG | `--color-body-bg` | `#FFFFFF` | `#000000` |
| Primary Surface / Popup BG | `--color-bg-primary` / `--color-popup-background` | `#FFFFFF` | `#131313` |
| Secondary Surface BG | `--color-bg-secondary` | `#FFFFFF` | `#000000` |
| Hover Row / Chip Fill | `--color-bg-primary-hover` / `--color-container-fill-primary-neutral-extra-light` | `#F2F2F2` | `#222222` |
| Subtle Surface / Input Pill | `--color-container-fill-primary-neutral-thin` | `#F9F9F9` | `#131313` |
| Active Pill / Secondary Button | `--color-container-fill-primary-neutral-light` | `#EBEBEB` | `#303030` |
| High-Contrast Active Pill (Tabs/Nav) | `--color-container-fill-primary-neutral-heavy` | `#000000` (white text) | `#FFFFFF` (black text) |
| Card Border | `--color-card-border` | `#EBEBEB` | `#464646` (subtle cards also use `#303030`) |
| Card Border (Hover) | `--color-card-border-hover` | `#B8B8B8` | `#636363` |
| Primary Divider / Row Separator | `--color-divider` / `--color-divider-line-primary` | `#EBEBEB` | `#303030` / `#464646` |
| Primary Text | `--color-text-primary` | `#000000` | `#B8B8B8` (headings `#FFFFFF` via `--color-content-secondary-neutral-bold`) |
| Secondary / Muted Text | `--color-text-secondary` | `#707070` | `#8C8C8C` |
| Brand Primary / Accent | `--color-brand` | `#2962FF` (hover `#1E53E5`, active `#1848CC`) | `#2962FF` (hover `#1E53E5`, active `#1848CC`) |
| Hyperlinks ("Vedi tutti...") | `--color-link-primary-default` | `#2962FF` (hover `#1E53E5`) | `#5B9CF6` (hover `#3179F5`) |
| Positive Price / Delta Text | `--color-symbol-change-positive` | `#06806B` | `#22AB94` |
| Positive Solid Badge / Line | `--color-growing` / `--color-container-fill-primary-success` | `#089981` | `#089981` |
| Positive Area Chart Overlay | `--color-overlay-positive-1-normal` -> `extra-light` | `#0899814D` -> `#08998112` | `#22AB944D` -> `#22AB941A` |
| Negative Price / Delta Text | `--color-symbol-change-negative` | `#CC2F3C` | `#F7525F` |
| Negative Solid Badge / Line | `--color-falling` / `--color-container-fill-primary-danger` | `#F23645` | `#F23645` |
| Negative Area Chart Overlay | `--color-overlay-negative-1-normal` -> `extra-light` | `#CC2F3C4D` -> `#CC2F3C12` | `#F236454D` -> `#F236451A` |
| Heatmap Classic (Green / Red) | `--color-heatmap-classic-light-positive-*` / `negative-*` | `+s:#ACE5C9 +m:#42BD7F +l:#089950 +xl:#056636` / `-s:#FCCBCD -m:#F77C80 -l:#F23645 -xl:#B22833` | `+s:#1A3326 +m:#056636 +l:#089950 +xl:#22AB67` / `-s:#801922 -m:#B22833 -l:#F23645 -xl:#F7525F` |
| Tooltip BG / Text | `--color-common-tooltip-bg` / `text` | `#222222` / `#F2F2F2` | `#303030` / `#F2F2F2` |

### 3.3 Typography, Radii, Shadows & Layout Metrics (Observed)

- **Primary UI & Numeric Font Stack**: `-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif` (183 rules; use `font-variant-numeric: tabular-nums` on prices/percentages).
- **Display / Section Heading Font Stack**: `"EuclidCircularSemibold", "Inter", -apple-system, BlinkMacSystemFont, sans-serif` (78 rules — used on Hero H1/H2, `"Mercati, ovunque"`, and major section headers `"Panoramica mercato"`, `"Azioni Italiane"`, `"Cripto"`, etc.).
- **Type Scale (`--ui-lib-typography-*`)**:
  - Caption / Ticker Badge / Meta: `12px / 16px` (`semibold` / `regular`)
  - Body / Table Cell / Nav Item / Pill: `14px / 18px` (medium `500`–`600`)
  - Card Title / Subheading / Price Row: `16px / 24px` (`semibold 600`) and `18px / 24px`
  - Widget Heading / Featured Price: `20px / 30px` -> `24px–28px` bold
  - Major Section H2 (`Panoramica mercato >`, `Azioni Italiane >`): `28px–32px` bold with inline right chevron `>`
  - Page H1 (`Mercati, ovunque ⌄`): `48px–56px` bold centered
- **Border Radii Scale (Observed Frequency)**:
  - Micro badges (`STOCK`, `D`, `INDICATORE`): `4px` (`42` rules)
  - Ticker symbol pills (`FTMIB`, `SPX`, `CL1!`), timeframe tabs (`1D`..`Tutto`), small buttons: `6px` (`33` rules) & `8px` (`21` rules)
  - Idea preview thumbnails, dropdown menus, buttons: `12px` (`17` rules)
  - Major Market Summary cards, Search modal, IPO cards: `16px` (`30` rules)
  - Floating sticky category bar & search pill input: `20px` / `36px` / `40px` (`9999px` pill)
  - Circular logos & carousel arrow buttons: `50%`
- **Shadows (Observed)**:
  - Floating popover / dropdown / floating sticky category bar: `0 0 2px 0 var(--color-other-shadow-m-edge), 0 3px 9px 0 var(--color-other-shadow-m-drop)`
  - Heavy modal / toast: `0 2px 4px var(--color-shadow-primary-neutral-extra-heavy)` (`#0003` light / `#0006` dark)
- **Container Breakpoints**: Adaptive side padding `20px`–`40px`, primary desktop content max-width **`1360px`–`1400px`** (breakpoints observed at `479px`, `767px`, `1019px`, `1200px`, `1600px`, `1919px`).

---

## 4. Homepage (`https://it.tradingview.com/`) Section-by-Section Blueprint

Observed verbatim in top-to-bottom DOM & accessibility order (`ev_cdca6442...`, `ev_f673e18e...`):

### Section 0: Full-Viewport Dark Hero
- **Observed Visual**: Full-bleed dark `#000000` cosmic/brand visual hero (`100vh` / `~836px` below transparent header) with scroll-down chevron `⌄` centered at bottom.
- **Build Recommendation (Evergreen Italian TradingView Hero)**:
  - Dark cinematic gradient/starfield canvas (`#000000` -> `#0D1224` with subtle radial glow), huge display headline **"Guarda prima / Poi agisci."** (*Look first / Then leap*, echoing the footer `"Look First"` artwork), subtitle *"Le migliori operazioni richiedono ricerca, quindi impegno."*
  - Prominent centered Search pill (`Cerca mercati qui` / `Cerca simboli, idee, script...`) + quick-launch ticker pills (`FTMIB`, `RACE`, `BTCUSD`, `EURUSD`, `SPX`, `GC1!`) + primary CTA button **`Esplora i grafici`** (`/chart/`)!

### Section 1: Floating Sticky Category Jump Pill Bar
- **Observed** (`ev_cdca6442...`, `it-tv-home-ideas-light.png`): Centered floating pill (`border-radius: 40px`, shadow + 1px border, sticky below the 64px header while scrolling through vertical sections) containing `role="tablist"` with 6 tabs:
  - **`Azioni Italiane`** | **`Cripto`** | **`Futures`** | **`Forex`** | **`Economia`** | **`Broker`**
  - Active tab renders as a solid high-contrast pill (`#000000` bg / `#FFFFFF` text in light; `#FFFFFF` bg / `#000000` text in dark). Clicking smooth-scrolls to the corresponding `#stocks`, `#crypto`, `#futures`, `#forex`, `#economy`, `#brokers` anchor.

### Section 2: `Panoramica mercato >` (Market Summary Bento Grid)
- **Row 1 — 2-Column Asymmetric Split (`~66%` / `~34%`, gap `20px`, `16px` radius cards with `1px` border)**:
  - **Left Featured Chart Card**:
    - Header: `40px` circular maroon logo + bold **`FTSE MIB`** + `FTMIB` neutral pill badge + market-status dot button (`Mercato chiuso` / `Mercato aperto`)
    - Big live price (`47.249,14` + `EUR` micro unit + `−1,81%` in red/green)
    - Interactive intraday Area Chart (`09:00`–`17:00` bottom axis, right price scale, dynamic green/red stroke + translucent vertical gradient fill). Clicking any index in the right card can switch the featured chart!
  - **Right Card — `Indici principali`**:
    - 6 clickable rows, each with `32px` circular logo, name + delayed orange `D` badge, ticker pill underneath, right-aligned formatted price + unit (`POINT` / `JPY`) + colored % change:
      1. `FTSE Italia All-Share` (`ITLMS`)
      2. `S&P 500` (`SPX`)
      3. `Nasdaq 100` (`NDX`)
      4. `Japan 225` (`NI225`)
      5. `SSE Composite` (`000001`)
      6. `FTSE 100` (`UKX`)
    - Footer link in accent blue: **`Vedi tutti gli indici principali >`** (`/markets/indices/quotes-major/`)
- **Row 2 — 3-Column Equal Bento Grid (`33%` / `33%` / `33%`, gap `20px`, `16px` radius cards)**:
  - **Card 1 — Cripto Overview**:
    - Header: Blue coin icon + **`Capitalizzazione mercato cripto`** + `TOTAL` badge, value (`2,05 T USD`), 1M % change (`−22,99%`), 1-month area sparkline with `"1 mese"` caption
    - Sub-block **`Dominance Bitcoin`**: 3-column legend (`• Bitcoin 59,01%` blue `#2962FF`, `• Ethereum 10,09%` green `#089981`, `• Altri 30,90%` red `#F23645`) over a 3-segment horizontal stacked progress bar
    - 2 live rows: `Bitcoin (BTCUSD)` and `Ethereum (ETHUSD)`
    - Footer link: **`Vedi tutte le criptovalute >`**
  - **Card 2 — Valute & Materie Prime**:
    - Header: Euro badge + **`Indice Euro`** + `EXY` badge, value (`109,88 USD`), 1M % change (`−1,86%`), 1-month area sparkline (`"1 mese"`)
    - 4 live commodity rows with Italian unit suffixes:
      1. `Petrolio greggio leggero` (`CL1!`) — `USD / barile`
      2. `Gas naturale` (`NG1!`) — `USD / milioni di BTU`
      3. `Oro` (`GC1!`) — `USD / oncia troy`
      4. `Rame` (`HG1!`) — `USD / sterlina`
    - Footer link: **`Vedi tutti i futures >`**
  - **Card 3 — Reddito Fisso**:
    - Top sub-block **`Curva dei rendimenti USA >`**: 6-point interactive yield curve line chart (`1M`, `3Y`, `7Y`, `10Y`, `20Y`, `30Y`) in `#2962FF` with dot markers and `%` Y-axis (`4.5%`, `5.0%`)
    - Bottom sub-block **`Obbligazioni societarie con rating investment grade >`**: 3 issuer rows (`Meta Platforms, Inc.`, `Microsoft Corp.`, `Apple, Inc.`) displaying coupon & maturity (`6,55% · 15 nov 2036`), yield `%`, orange G-spread (`135,1 bps`), and a dual-color horizontal bar (`Rendimento dei titoli del Tesoro USA` blue + `G-spread` orange `#FF9800`)
    - Footer link: **`Vedi tutte le obbligazioni >`**

### Section 3: `IPO in evidenza >`
- Horizontal 4-card carousel (`16px` radius bordered cards, right scroll chevron `>`):
  - Shows high-profile upcoming/recent IPOs (`ANT` Anthropic, `OPENAI`, `ANDURIL`, `REVOLUT`, `STRIPE`) with circular logo, ticker + company name, bottom 2–3 column metrics (`Ultimo` / `Borsa`, `Ultima valutazione`, `Cap mercato`) + trailing card **`Vedi altri eventi`**.

### Section 4: `Idee della community >`
- Underline/pill tab bar: **`Selezione editoriale`** (active) | **`Popolari`**
- Horizontal 3-column card carousel (`12px` rounded 16:9 chart preview image, top-left blue `TV` Editor's Pick ribbon bookmark on selected ideas, bottom-left symbol icon + circular green `↗` `Long` or red `↘` `Short` badge, bold title, 3-line Italian analysis excerpt, footer row with `di <autore>` + relative timestamp `Aggiornato 8 ore fa` / `Nov 23`, comment icon + count, outlined rocket boost button `🚀 32`) + footer link **`Vedi tutte le idee selezionate >`**.

### Section 5: `Indicatori e strategie >`
- Pill tab bar: **`Selezione editoriale`** (active) | **`Popolari`**
- Horizontal 3-column card carousel matching Community Ideas geometry, with dark chart preview thumbnails, top-left blue `TV` ribbon, top-right green translucent uppercase pill **`INDICATORE`** (or **`STRATEGIA`**), title, description excerpt, `di <autore>`, comment count, rocket boost button (`🚀 1.5 K`) + footer link **`Vedi tutti gli indicatori e strategie >`**.

### Section 6: `🇮🇹 Azioni Italiane >` (`#stocks`)
1. **`Tendenze della community`**: 5-card horizontal ticker carousel (`16px` bordered cards) featuring `STLAM`, `RACE`, `UCG`, `PRY`, `MONC`, `CPR`, `BAMI`, `BMPS`, `BGN`, `BZU` (circular logo, ticker + `D`, company name, formatted `EUR` price, green/red `%` change).
2. **`Idee di trading >`**: 3-card carousel of Italian equity technical analyses (`MIL:ISP`, `MIL:PRY`, `MIL:ENI`, `MIL:CPR`, `MIL:STLAM`, `MIL:INW`, `MIL:LDO`) + link **`Vedi tutte le idee su azioni >`**.
3. **2×2 Market Movers Grid** (two side-by-side 2-column sections):
   - Row A: **`Azioni con volume più elevato >`** (`Vedi tutti i titoli più scambiati attivamente >`) | **`Azioni più volatili >`** (`Vedi tutti i titoli con le maggiori variazioni di prezzo >`)
   - Row B: **`Azioni in guadagno >`** (`Vedi tutti i titoli con la maggiore crescita giornaliera >`) | **`Azioni in perdita >`** (`Vedi tutte le azioni con il maggior calo giornaliero >`)
   - *Row Visual Style*: Clean divider-separated list rows (6 per column): `32px` logo | Company name + `D` + grey ticker pill (`STLAM`, `PRY`) | Right-aligned price (`3,2370 EUR`) + **solid green `#089981` or red `#F23645` rounded pill percentage badge** (`+3,58%`, `−5,40%`) on Gainers/Losers!
4. **2-Column Calendars**:
   - Left: **`Calendario utili >`** (Columns: `SIMBOLO`, `ATTUALE`, `STIMA`; date badge box `Nov 25` / `Dic 2`, logo, company + ticker, actual vs estimate EPS + link `Vedi tutti gli eventi >`).
   - Right: **`Calendario IPO >`** (Either upcoming Italian IPO list or empty state with telescope illustration, *"Non sono previste IPO in Italia / Non sono previste IPO nei prossimi 30 giorni."* + dark CTA button **`Vedi le IPO in tutto il mondo`**).
5. **`Notizie azioni Italia >`**: 3-column × 4-row news card grid (each card shows related ticker logos, relative time `· Reuters` / `· Borsa&Finanza` / `· Teleborsa`, and 2–3 line Italian headline).

### Section 7: `Cripto >` (`#crypto`)
- **`Tendenze della community`** (crypto ticker strip)
- **`Idee di trading >`** (`Vedi tutte le idee su cripto >`)
- 2-Column Movers: **`Criptovalute in guadagno >`** (`Vedi tutte le monete con la maggiore crescita giornaliera >`) | **`Criptovalute in perdita >`** (`Vedi tutte le monete con il maggior calo giornaliero >`)
- **`Notizie su cripto >`** (Italian crypto headlines from Cointelegraph IT / Reuters / Decrypt).

### Section 8: `Futures e materie prime >` (`#futures`)
- **`Idee di trading >`** (`Vedi tutte le idee sui futures >`)
- 2-Column Movers: **`Futures energetici >`** (`Vedi tutti i futures energetici >`) | **`Futures metalli >`** (`Vedi tutti i futures sui metalli >`)
- **`Notizie sui futures >`**.

### Section 9: `Forex e valute >` (`#forex`)
- **`Idee di trading >`** (`Vedi tutte le idee sul forex >`)
- **`Performance Forex >`**: Horizontal performance comparison strip (`EURUSD`, `JPYUSD`, `GBPUSD`, `AUDUSD`, `CHFUSD`, `CADUSD`, `NZDUSD`, `CNYUSD`) with interactive timeframe pills: **`1D` `1W` `1M` `3M` `6M` `YTD` `1Y` `5Y` `Tutto`** + link **`Vedi tutte i tassi >`** *(exact wording observed on live site)*
- **`Notizie sul forex >`**.

### Section 10: `Economia >` (`#economy`)
- **`Mappa dell'inflazione globale >`**: Choropleth world SVG map (`world.*.svg`, `viewBox="0 0 745 372"`) colored by inflation tier + link **`Vedi le altre tendenze globali >`**.
- **`Calendario economico >`**: Horizontal scrollable event cards showing date (`1 dic • 09:00`), country flag, importance signal bars (`Importanza elevata` / media / bassa), event title (e.g. `PIL Italia`, `IPC Eurozona`, `Decisione tassi BCE`, `PMI Manifatturiero`), and 3-column metrics **`Attuale`** | **`Previsione`** | **`Precedente`** + link **`Vedi tutti gli eventi del mercato >`**.

### Section 11: `Trading e broker >` (`#brokers`)
- Subtitle: *"Fai trading direttamente sui grafici tramite i brokeri supportati, completamente verificati e recensiti dagli utenti."*
- 4-card broker grid (`OANDA`, `easyMarkets`, `FxPro`, `ThinkMarkets`) with badge (`Best 2023` / `Best 2024`), asset tags (`Forex, CFD`), rating (`4.5 • Ottimo` / `4.8 • Eccellente`), `"Valutazione autentica da parte di TradingView"` info tooltip, and **`Apri conto`** button + link **`Vedi tutti i broker >`**.

### Section 12: Multi-Column Footer (`<footer>` / `contentinfo`, Observed `ev_cdca6442...`)
- **Left Brand Column**: `TV TradingView` logo, tagline **`Realizzato da umani`**, 8 social icon buttons (`X`, `Facebook`, `YouTube`, `Instagram`, `LinkedIn`, `Telegram`, `TikTok`, `Reddit`), Language selector button (`🌐 Italiano`), and market-data legal attribution paragraph (*"Dati di mercato selezionati forniti da ICE Data Services... FactSet... Quartr. © 2026 TradingView, Inc."*).
- **4 Link Column Groups** (exact observed Italian headers & items):
  1. **Più che un semplice prodotto**: `Grafici` • **Screener**: `Azioni`, `ETF`, `Obbligazioni`, `Singole cripto`, `Coppie CEX`, `Coppie DEX`, `Pine` • **Heatmap**: `Azioni`, `ETF`, `Singole cripto` • **Calendari**: `Economico`, `Utili`, `Dividendi`, `IPO` • **Altri prodotti**: `Notiziario`, `Portafogli`, `Curve di rendimento`, `Opzioni`, `Mappe macro`, `Pine Script®`, `Server MCP`
  2. **Applicazioni**: `Smartphone`, `Desktop` • **Strumenti e abbonamenti**: `Caratteristiche`, `Costi`, `Dati di mercato`, `Regala abbonamenti` • **Trading**: `Panoramica`, `Broker`, `Confronta broker`, `The Leap` • **Offerte speciali**: `Futures CME Group`, `Futures Eurex`, `Bundle azioni USA`
  3. **Informazioni sulla società**: `Chi siamo`, `Missione spaziale`, `Blog`, `Centro di supporto`, `Carriere`, `Kit multimediale` • **Merchandising**: `I tarocchi per i trader`, `C63 TradeTime` • **Politiche e sicurezza**: `Condizioni d'uso`, `Declinazione di responsabilità`, `Normativa sulla privacy`, `Politica sui cookies`, `Dichiarazione di accessibilità`, `Consigli per la sicurezza`, `Programma bug bounty`, `Pagina di stato`
  4. **Community**: `Social network`, `Muro social`, `Invita un amico`, `Programma creator`, `Regolamento`, `Moderatori` • **Idee**: `Trading`, `Formazione`, `Selezione editoriale` • **Pine Script**: `Indicatori e strategie`, `Maestri`, `Freelancer`, `Marketplace` • **Soluzioni per le aziende**: `Widget`, `Librerie grafiche`, `Lightweight Charts™`, `Grafici avanzati`, `Piattaforma di trading` • **Opportunità di crescita**: `Pubblicità`, `Integrazione broker`, `Programma affiliazione`, `Programma di formazione`
- **Bottom Artwork**: Full-width stylized `"Look First"` / `"Then Leap"` TradingView brand watermark.

---

## 5. Markets Overview Page (`https://it.tradingview.com/markets/`) Blueprint

Observed verbatim in `ev_4ee92ebb...`, `ev_08976afb...`, `ev_f673e18e...`:

- **Centered Hero Title**: **`Mercati, ovunque ⌄`** (H1 with clickable category switcher chevron).
- **Sticky Horizontal Asset Pill Nav** (9 tabs): `Azioni Italiane` | `Azioni da tutto il mondo` | `Cripto` | `Futures` | `Forex` | `Titoli di Stato` | `Obbligazioni societarie` | `ETF` | `Economia`.
- **Reusable "Interactive Showcase Chart" Pattern** (repeated at top of every asset section):
  1. Section H2 with right chevron (e.g., `Indici >`, `🇮🇹 Azioni Italiane >`, `Cripto >`, `Futures e materie prime >`, `Forex e valute >`, `ETF >`, `Economia >`).
  2. Horizontal scrollable **Symbol Selector Pill Strip** (4–6 pill cards, active card filled with `--color-container-fill-primary-neutral-extra-light` `#F2F2F2` / `#222222`; each pill shows circular logo, symbol name + `D`, formatted price + currency/unit, colored % change).
  3. Full-width **Interactive Mini-Superchart** (`~340px` tall) with right price axis, highlighted last-price tag box, bottom time axis, area gradient fill (or candlesticks).
  4. Chart Control Footer Bar:
     - Left timeframe pills: **`1D` `1M` `3M` `1Y` `5Y` `Tutto`** (or `5Y` `10Y` `Tutto` for macro Economy series).
     - Right action buttons: `</>` (embed widget), **Area / Candlestick segmented toggle**, and Fullscreen expand button (`↗` opens full `/chart/`!).
- **Section Inventory on `/markets/`**:
  1. **`Indici`**: Pills (`FTSE MIB`, `FTSE Italia All-Share`, `FTSE Italia All-Share Capped`, `FTSE Italia Mid Cap`) + **`Indici globali`** 5-card strip (`SPX`, `NDX`, `DJI`, `NI225`, `UKX`).
  2. **`Azioni Italiane`**: Pills (`Ferrari`, `Enel`, `Intesa Sanpaolo`, `Eni`) + `Tendenze della community` + 2×2 movers (`Azioni con volume più elevato`, `Azioni più volatili`, `Azioni in guadagno`, `Azioni in perdita`) + `Calendario utili` & `Calendario IPO`.
  3. **`Azioni da tutto il mondo`**: Pills (`Microsoft`, `Saudi Aramco`, `TSMC`, `LVMH`) + `Società più grandi al mondo` + `Con il maggior numero di dipendenti al mondo` + global earnings/IPO calendars.
  4. **`Cripto`**: Pills (`BTCUSD`, `ETHUSD`, `USDTUSD`, `BNBUSD`, `USDCUSD`, `XRPUSD`) + `Tendenze della community` + `Classifica cripto per cap. di mercato`, `Classifica TVL`, `Criptovalute in guadagno`, `Criptovalute in perdita`.
  5. **`Futures e materie prime`**: Pills (`Gas naturale`, `Gas naturale - Prima linea`, `Base power`, `Power peak`) + 2×2 grids (`Futures energetici`, `Futures agricoli`, `Futures metalli`, `Futures su indici`).
  6. **`Forex e valute`**: Pills (`USD su EUR`, `JPY su EUR`, `GBP su EUR`, `CHF su EUR`, `AUD su EUR`, `NZD su EUR`) + `Major` & `Indici valutari`.
  7. **`Titoli di Stato`**: `Curva dei rendimenti` + `Obbligazioni Italia` (BTP) + `Principali obbligazioni a 10 anni`.
  8. **`Obbligazioni societarie`**: `Breve termine`, `Lungo termine`, `Tasso variabile`, `Tasso fisso`.
  9. **`ETF`**: Pills (`SPY`, `IBIT`, `VTI`, `QQQ`) + `Tendenze della community` + `Più scambiate`, `Maggior crescita di AUM`, `Rendimenti più elevati`, `I più alti rendimenti da dividendo`.
  10. **`Economia`**: Pills (`PIL Italia`, `Crescita PIL Italia`, `PIL reale Italia`, `Tasso d'interesse Eurozona`, `Inflazione YoY Italia`, `Disoccupazione Italia`) + **`Heatmap indicatori economici`** + `Mappa dell'inflazione globale` + `Calendario economico`.

---

## 6. Exact Italian Terminology & Formatting Conventions (Observed)

- **Number Formatting (`it-IT`)**: Period `.` for thousands separator, comma `,` for decimal separator, typographic minus sign `−` (`U+2212`) for negatives: e.g. `47.249,14 EUR`, `−1,81%`, `+3,58%`, `2,05 T USD`, `852,00 B USD`, `59,01%`, `135,1 bps`.
- **Market Status & Badges**: `Mercato chiuso` (gray dot/pill), `Mercato aperto` (green dot), `D` (orange delayed-data superscript badge), `Long` / `Short` (circular green `↗` / red `↘` badge), `INDICATORE` / `STRATEGIA` (green pill badge), `Aggiornato 8 ore fa` / `12 ore fa` / `Nov 23`.
- **Standard UI Actions**: `Cerca (Ctrl+K)`, `Simbolo, ISIN o CUSIP`, `Cancella`, `Chiudi`, `Accedi`, `Aiuto`, `Novità`, `Tema scuro`, `Selezione editoriale`, `Popolari`, `Tutto`, `Vedi tutti...`, `Vedi altri eventi`, `Apri conto`, `Non consentire`, `Accetta tutto`, `Gestisci`.
- **Timeframes**: `1D`, `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `5Y`, `10Y`, `Tutto`.

---

## 7. Observed API Origins, Endpoints & Payload Shapes

All origins and payloads below were directly observed in `ev_f3f47e4e...`, `ev_eb5e500a...`, `ev_08976afb...`, and `ev_f4e61e3b...`:

### 7.1 HTTP / REST Endpoints

| Origin & Endpoint | Method | Purpose | Observed Response Payload Shape |
| :--- | :--- | :--- | :--- |
| `https://scanner.tradingview.com/symbol?symbol=<SYM>&fields=...` | `GET` | Multi-horizon symbol performance metrics (`CRYPTOCAP:TOTAL`, `TVC:EXY`, etc.) | Flat JSON object: `{ "change": number, "Perf.5D": number, "Perf.W": number, "Perf.1M": number, "Perf.3M": number, "Perf.6M": number, "Perf.YTD": number, "Perf.Y": number, "Perf.5Y": number, "Perf.10Y": number, "Perf.All": number }` |
| `https://scanner.tradingview.com/{italy\|global\|coin\|bonds\|bond}/scan?label-product={hotlists\|markets-earnings\|calendar-ipo\|bonds-yield-curve}` | `POST` | Screener, movers/hotlists, earnings, IPO, and yield-curve tables | `{ "totalCount": number, "data": [{ "s": "EXCHANGE:SYMBOL", "d": [...] }], "params": { "<market>": { "symbols": ..., "filter": [...] } } }` |
| `https://news-mediator.tradingview.com/public/news-flow/v2/news?filter=lang:it&filter=market:{stock\|crypto\|futures\|forex}&client=overview` | `GET` | Localized Italian financial news feeds | `{ "items": [{ "id": string, "title": string, "published": unixSec, "urgency": number, "paywall": boolean, "storyPath": string, "link"?: string, "provider": { "id": string, "name": string, "logo_id": string }, "relatedSymbols"?: [{ "symbol": string, "logoid": string }] }] }` |
| `https://economic-calendar.tradingview.com/events?from=<ISO>&to=<ISO>&countries=...` | `GET` | Global & Italian economic calendar events | JSON list/envelope of macro events (country, timestamp, importance, title, actual/forecast/previous) |
| `https://it.tradingview.com/api/v1/offers/` | `GET` | Seasonal promotions & banner configuration | `{ "black_friday": { "is_available": bool, "show_popup": bool, "show_on_mainpage": bool, "date_start": ts, "date_end": ts, "products": {...} } }` |
| `https://it.tradingview.com/check_language/` | `POST` | Geo-locale detection | `{ "country_code": "it", "region_code": "", "locale": "it", "is_in_european_union": true }` |
| `https://s3-symbol-logo.tradingview.com/<logoid>.svg` | `GET` | Circular ticker, country, and exchange SVG icons | Static SVG asset (e.g., `leonardo`, `finecobank`, `pirelli-and-c`, `source/MIL`) |
| `https://s3.tradingview.com/...` | `GET` | Community idea & script chart thumbnail snapshots | Static PNG/WebP chart preview images |
| `https://static.tradingview.com/static/bundles/...` | `GET` | Webpack JS/CSS bundles & `world.*.svg` choropleth map | Static assets |

### 7.2 Real-Time WebSocket Protocol (Observed `ev_eb5e500a...`, `ev_08976afb...`)

- **Endpoints**:
  - `wss://data.tradingview.com/socket.io/websocket?from=<route>&date=<ISO>&auth=sessionid`
  - `wss://pushstream.tradingview.com/message-pipe-ws/public`
- **Wire Framing**: Custom length-prefixed frames `~m~<byteLength>~m~<JSON>` (heartbeat packets `~m~<len>~m~~h~<seq>`).
- **Client -> Server RPC Sequence**:
  1. `set_data_quality` (`["low"]`), `set_auth_token` (`["unauthorized_user_token"]`), `set_locale` (`["it", "IT"]`)
  2. `quote_create_session` (`["qs_multiplexer_simple_..."]`) -> `quote_set_fields` (62 fields including `lp`, `ch`, `chp`, `volume`, `short_name`, `description`, `exchange`, `currency_code`, `logoid`, `current_session`, `update_mode`, `pricescale`, `minmov`) -> `quote_add_symbols` / `quote_fast_symbols`
  3. Mini-chart series: `chart_create_session` -> `switch_timezone` -> `resolve_symbol` -> `create_series` -> `modify_series`
- **Server -> Client Streaming Frames**:
  - `qsd` (Quote Symbol Data): `{ "m": "qsd", "p": ["<sessionId>", { "n": "MIL:LDO", "s": "ok", "v": { "lp": 48.96, "ch": ..., "chp": ..., "logo": { "logoid": "leonardo", "style": "single" }, "source2": { "country": "IT", "description": "Euronext Milan" } } }] }`
  - `symbol_resolved`, `timescale_update`, `du` (data update bars), `quote_completed`, `series_completed`.
- **Key Default Italian Homepage Symbols Observed on Wire**: `TVC:FTMIB`, `FTSE:ITLMS`, `SP:SPX`, `NASDAQ:NDX`, `TVC:NI225`, `SSE:000001`, `FTSE:UKX`, `CRYPTOCAP:TOTAL`, `CRYPTOCAP:BTC.D`, `CRYPTOCAP:ETH.D`, `BITSTAMP:BTCUSD`, `BITSTAMP:ETHUSD`, `TVC:EXY`, `NYMEX:CL1!`, `NYMEX:NG1!`, `COMEX:GC1!`, `COMEX:HG1!`, `TVC:US01MY`, `TVC:US03Y`, `TVC:US07Y`, `TVC:US10Y`, `TVC:US20Y`, `TVC:US30Y`, plus Euronext Milan (`MIL:RACE`, `MIL:ENEL`, `MIL:ISP`, `MIL:ENI`, `MIL:UCG`, `MIL:STLAM`, `MIL:PRY`, `MIL:LDO`, `MIL:MONC`, `MIL:FBK`).

---

## 8. Implementation Checklist for the Build Team

1. **Exact Dual Theme Support (`data-theme="dark"` & `"light"`)**: Implement the observed CSS variable layer (`#000000` / `#131313` / `#222222` / `#303030` dark vs `#FFFFFF` / `#F9F9F9` / `#F2F2F2` / `#EBEBEB` light) with exact `#2962FF` brand blue, `#089981` / `#22AB94` green, and `#F23645` / `#F7525F` red.
2. **Sticky 64px Header + Full Italian Navigation**: Include `TV TradingView` brand, `Cerca (Ctrl+K)` trigger opening the full Search Modal (`Simbolo, ISIN o CUSIP`, primary tabs + 10 asset filter chips), all 5 hover/click dropdown menus (`Prodotti`, `Community`, `Mercati`, `Broker`, `Altro`), `IT` language selector, User menu with working `Tema scuro` switch, and primary CTA button.
3. **Homepage Bento Layout + Interactive Mini-Charts**: Render Hero -> Floating 6-tab sticky jump pill -> `Panoramica mercato` (interactive FTSE MIB + Indici principali switcher + 3-col Cripto/Dominance, Indice Euro/Commodities, US Yield Curve/Corporate Bonds) -> `IPO in evidenza` -> `Idee della community` & `Indicatori e strategie` (with `Selezione editoriale`/`Popolari` tabs, `Long`/`Short` & `INDICATORE` badges, boost toggles) -> `Azioni Italiane` (Tendenze, Idee, Volume/Volatili/Guadagno/Perdita with green/red % pills, Calendario utili/IPO, Notizie) -> Cripto, Futures, Forex (with Performance timeframe pills), Economia (inflation map + Calendario economico), Broker, and 4-column Footer.
4. **Dedicated `/markets/` Overview View**: Implement `Mercati, ovunque`, the 9-tab sticky pill bar, and the interactive Showcase Chart component (symbol pill switcher + area/candlestick toggle + `1D`/`1M`/`3M`/`1Y`/`5Y`/`Tutto` timeframes + fullscreen button linking directly into the Supercharts workspace).
5. **Authentic Italian Formatting**: Enforce `it-IT` decimal commas, thousands dots, `−` minus signs, and exact Italian copy across every heading, tab, tooltip, and link.
