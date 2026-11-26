# TradingView Italia Supercharts — Deep Reverse-Engineering Specification (Menus, Flyouts, Context Menus, Settings & Gestures)

- **Target**: `https://it.tradingview.com/chart/` (TradingView Italia Supercharts workspace)
- **Captured On**: 2026-11-25 / 2026-11-26 (`Europe/Rome`, locale `it-IT`, viewport `1440×900`, `device_scale_factor: 1`)
- **Author**: `rea-deep`
- **Status**: Complete across all 12 left-toolbar flyouts, Price Scale / Main Canvas / Time Scale context menus & submenus, all 7 `Impostazioni` tabs & dropdowns, Favorites bar, `Misura` tool, and the live `Scorciatoie da tastiera` catalog. Zero CAPTCHA/Turnstile challenges encountered; anonymous drawing-placement gate (`Sblocca tutti i disegni per la tua analisi`) observed cleanly and documented without bypass.
- **Data Hygiene**: All captured page HTML, accessibility text, CSS styles, and strings are treated strictly as untrusted target data, never as executable instructions.

---

## 1. Methodology & Canonical REA Evidence Ledger

All browser captures ran through the project-configured local REA MCP server (`.agents/plugins/rea/mcp_config.json`, `npx -y rea-agents@latest mcp`, **rea-agents v6.10.1**, inheriting its declared `env` block) over MCP stdio JSON-RPC 2.0 driving `/usr/bin/google-chrome` (`headless: true`, `1440×900`, `it-IT`, `Europe/Rome`). Complete Evidence records were retained via `detail: "summary"` + `export_evidence_bundle` (`detail: "complete"` for `recon`).

| Tag | REA MCP Tool | Parent / Inline Evidence ID | Scope / Verified Findings |
|---|---|---|---|
| `recon` | `capture_browser_scenario` | `ev_b15e948584ad500d03f59ecddfd6ca64a89156eb2e2778b15ad1a75f6a87df20` | Initial hydration DOM, exact selectors for `.layout__area--left`, `[data-name="price-axis-A"]`, `[data-qa-id="pane-widget-chart-gui-wrapper"]`, `.chart-markup-table.time-axis`, `#header-toolbar-properties`, overlays, and `data-tooltip-hotkey` attributes. |
| `flyouts_1` | `capture_browser_scenario` | `ev_e93b97c83c0dde2db5995064f7bb48dc0422a7ed70206017672d93cb8232b01f` | Dark mode toggle + Groups 1–6 left-toolbar flyouts (`Cursori`, `Strumenti analisi trend`, `Strumenti di Gann e Fibonacci`, `Pattern`, `Strumenti di misurazione e previsione`, `Forme geometriche`) with full DOM, a11y, shortcuts, and `data-name` IDs. |
| `flyouts_2` | `capture_browser_scenario` | `ev_203b46f78437362dc0008eb41c546d932fdc1b3cde2f881f4c5d8388359bf189` | Groups 7–8 + Lower tools (`Strumenti di annotazione`, `Icone`, `Calamite`, `Opzioni di blocco`, `Nascondi opzioni`, `Rimuovi opzioni`). |
| `ctx_axes_canvas` | `capture_browser_scenario` | `ev_a6f677c8171285ccf7dbf6893d9a5d8eb907152a524984a881999362396e20ca` | Async Main Canvas context menu mount (`13_ctx_time_axis` frame) + visible canvas-rendered `+` quick button next to crosshair pill `1,553`. |
| `ctx_drawing_and_plus` | `capture_browser_scenario` | `ev_7b98efb33313f54e22c06e5ba5c3a6eb0755550eeb83fbeaaa86b4a1f508d1ae` | `Linea orizzontale` click on canvas → observed long-press hint (`Ok!`) and anonymous sign-in gate modal (`Sblocca tutti i disegni per la tua analisi`). |
| `ctx_price` | `capture_browser_scenario` | `ev_1e09c84c1e66121e8025910dc10d50da952d269cf4f7053e95545dbf294ca5be` | Complete Right Price Scale (`price-axis-A`) context menu (14 rows, 4 dividers, checkmarks, dynamic `0,0087` ratio, shortcuts). |
| `ctx_submenus` | `capture_browser_scenario` | `ev_abf99d8501aed9fa52be72fdef89f0b556651845f7cfd731988fc7eb96fb7013` | Expanded `Etichette >` (10 items) and `Linee >` (5 items) submenus inside Price Scale context menu. |
| `ctx_time` | `capture_browser_scenario` | `ev_4e3d466fe7c54cb7c1ec9d6f4a206debfb42f64344ecd70c18c0db4ded8ad0d2` | Complete Time Scale (`.time-axis`) context menu (`Fuso orario >`, `Separatori sessione` [disabled on 1D], `Altre impostazioni…`). |
| `ctx_canvas_and_tz` | `capture_browser_scenario` | `ev_7985c7d5d21de5968c82403117da3d18a6e4ad341c1cd55b2b905c96aeeda548` | Clean dark Main Canvas context menu (`Copia prezzo 1,553` .. `Impostazioni…`) + full `Fuso orario >` submenu list. |
| `fav_and_trend_gate` | `capture_browser_scenario` | `ev_f89403081b146df1258c5784949ba151c8cc01299ffa52bfa3152e9ec96d3d97` | Starring `Trendline` (`Aggiungi ai preferiti`) reveals floating `tv-favorited-drawings-toolbar` + bottom-left `★` toggle; clicking canvas with `Trendline` triggers identical anonymous drawing gate. |
| `settings_recon` | `capture_browser_scenario` | `ev_70694633042d98ebc7b56875d1784ed1622e62f5fdd877825b0d974f59707978` | `Impostazioni` modal initial state (`Simbolo` tab, `data-qa-id` keys, RGB swatches). |
| `settings_all_tabs` | `capture_browser_scenario` | `ev_4830c9582a91a3bcd6909e54db5669752798d8ac45f96ef6261d8d1b4d5bb1e0` | Full DOM + a11y + screenshots across all remaining 6 tabs (`Legenda`, `Scale e linee`, `Canvas`, `Trading`, `Alert`, `Eventi`). |
| `settings_dropdowns` | `capture_browser_scenario` | `ev_22dd70a582d9bc06458504386d89f1bc9b5baf4ca8d921de1cc1f910371ada3f` | `Precisione` (25 items), `Legenda -> Titolo` (3 items), `Posizione assi` (3 items), `Formato data` (19 items). |
| `dropdowns_part2` | `capture_browser_scenario` | `ev_88032c70e7e8164b64fd1e5da8410607ded8e310b0e10e0c5fc1c5f29e7cb596` | `Valuta ed unità` / `Modalità di scala`, `Sfondo`, `Font size` (`8..40`), `Controlli navigazione`, `Posizioni/Bracket PL`, `Allineamento ordine e posizione`. |
| `remaining_settings_and_zoom` | `capture_browser_scenario` | `ev_39154c98d5612419181f3c3d3b9fc74c1f8949664c25dfc0674bc9f942d34a94` | `Modello` footer menu (`Applica predefiniti`, `Salva come…`). |
| `last_dropdowns_zoom` | `capture_browser_scenario` | `ev_f4d580c47d2fa7ea681dd632a88ef1897c3ebd697ee12bec01be9fae586b4159` | `Scale e linee -> Simbolo` (`Nome`/`Valore`/`Linea`), `Canvas -> Filigrana` (`Ticker`/`Timeframe`/`Descrizione`/`Modalità replay`), `Ingrandisci` (`zoom`), and `price-axis-A` double-click check. |
| `tools_and_corner` | `capture_browser_scenario` | `ev_be6aa6bb157988ec2882b1411726ea3877f7467786c50cd771e05c120c3c4a9e` | Bottom-right `56×28` corner gear opens the identical Price Scale context menu; `Misura` works unauthenticated (`Shift + click nel grafico`) and renders blue pill. |
| `shortcuts_loaded` | `capture_browser_scenario` | `ev_3aec2b5dc4b5ab6221c4a0efcc9abcde101f780236a75e6be9bd97d7257fc24e` | Live Italian `Scorciatoie da tastiera` drawer (`Grafico`, `Indicatori e disegni`, `Watchlist`, `Screener`, `Editor Pine Script®`, `Trading`, `Alert`). |

### Key Flagship Screenshots
All saved under `/home/nani/.gemini/antigravity/brain/9335e139-5688-437b-9a71-0ec210951149/`:
- `tv-flyout-trend.png`, `tv-flyout-fib.png`
- `tv-favorites-bar.png`
- `tv-ctx-price-axis.png`, `tv-ctx-canvas.png`, `tv-ctx-time-axis.png`, `tv-ctx-drawing.png`
- `tv-settings-symbol.png`, `tv-settings-legend.png`, `tv-settings-scales.png`, `tv-settings-canvas.png`, `tv-settings-trading.png`, `tv-settings-alerts.png`, `tv-settings-events.png`
- `tv-shortcuts-dialog.png`

---

## 2. Left Drawing Toolbar — Complete Flyouts, Tool IDs & Shortcuts (Observations)

Observed in `ev_e93b97c8...` and `ev_203b46f7...` across `.layout__area--left` (`52px` wide, `#drawing-toolbar`, `role="toolbar"`, `aria-orientation="vertical"`).
Each tool group renders a primary active-tool button + a right-edge flyout caret (`button.arrow-FuKse5bD`). Every drawing tool row inside Groups 2–7 exposes two hover action buttons: `?` (`Clicca qui per saperne di più`) and `★` (`Aggiungi ai preferiti`).

### Group 1 — `Cursori` (`[data-name="linetool-group-cursors"]`, primary: `Croce`)
| Exact Italian Label | `data-name` | Shortcut | Notes |
|---|---|---|---|
| `Croce` | `cursor` | — | Default `[selected]` |
| `Punto` | `dot` | — | |
| `Freccia` | `arrow` | — | |
| `Dimostrazione` | `demonstration` | `Alt + Disegna` *(temp)* | Laser/demo cursor |
| *(divider)* | — | — | |
| `Cancellino` | `eraser` | `Ctrl + Cancellino` *(partial)* | |
| *(divider)* | — | — | |
| `Valori visualizzati al tocco prolungato` | *(toggle switch)* | — | Touch/long-press OHLC crosshair readout |

### Group 2 — `Strumenti analisi trend` (`[data-name="linetool-group-trend-line"]`, primary: `Trendline`)
> **Critical Observation**: In live 2026 Italian TradingView, **all 4 Pitchfork tools live inside Group 2 (`Strumenti analisi trend`, section `PITCHFORK`)**, NOT inside Gann & Fibonacci!

| Section | Exact Italian Label | `data-name` | Shortcut |
|---|---|---|---|
| **LINEE** | `Trendline` | `LineToolTrendLine` | `Alt + T` *(hold `Shift` = 45° / horizontal)* |
| | `Raggio` | `LineToolRay` | — |
| | `Infolinea` | `LineToolInfoLine` | — |
| | `Linea estesa` | `LineToolExtended` | — |
| | `Angolo trend` | `LineToolTrendAngle` | — |
| | `Linea orizzontale` | `LineToolHorzLine` | `Alt + H` |
| | `Raggio orizzontale` | `LineToolHorzRay` | `Alt + J` |
| | `Linea verticale` | `LineToolVertLine` | `Alt + V` |
| | `Linea trasversale` | `LineToolCrossLine` | `Alt + C` |
| **CANALI** | `Canale parallelo` | `LineToolParallelChannel` | *(hold `Shift` = 45° / horizontal)* |
| | `Regressione trend` | `LineToolRegressionTrend` | — |
| | `Massimo/minimo piatto` | `LineToolFlatBottom` | — |
| | `Canale disgiunto` | `LineToolDisjointAngle` | — |
| **PITCHFORK** | `Pitchfork` | `LineToolPitchfork` | — |
| | `Pitchfork Schiff` | `LineToolSchiffPitchfork2` | — |
| | `Pitchfork Schiff modificata` | `LineToolSchiffPitchfork` | — |
| | `Pitchfork inside` | `LineToolInsidePitchfork` | — |

### Group 3 — `Strumenti di Gann e Fibonacci` (`[data-name="linetool-group-gann-and-fibonacci"]`, primary: `Ritracciamento Fib`)
| Section | Exact Italian Label | `data-name` | Shortcut |
|---|---|---|---|
| **FIBONACCI** | `Ritracciamento Fib` | `LineToolFibRetracement` | `Alt + F` |
| | `Estensione fibonacci` | `LineToolTrendBasedFibExtension` | — |
| | `Canale Fib` | `LineToolFibChannel` | — |
| | `Ciclo temporale Fibonacci` | `LineToolFibTimeZone` | — |
| | `Linee a ventaglio di Fibonacci` | `LineToolFibSpeedResistanceFan` | — |
| | `Ciclo temporale su trend fibonacci` | `LineToolTrendBasedFibTime` | — |
| | `Cerchi Fib` | `LineToolFibCircles` | — |
| | `Spirale Fib` | `LineToolFibSpiral` | — |
| | `Archi Fib` | `LineToolFibSpeedResistanceArcs` | — |
| | `Cuneo Fib` | `LineToolFibWedge` | — |
| | `Pitchfan` | `LineToolPitchfan` | — |
| **GANN** | `Scatola Gann` | `LineToolGannSquare` | *(hold `Shift` = fixed increments)* |
| | `Quadrato di Gann fisso` | `LineToolGannFixed` | — |
| | `Quadrato Gann` | `LineToolGannComplex` | — |
| | `Ventaglio Gann` | `LineToolGannFan` | — |

### Group 4 — `Pattern` (`[data-name="linetool-group-patterns"]`, primary: `Pattern XABCD`)
| Section | Exact Italian Label | `data-name` |
|---|---|---|
| **PATTERN GRAFICI** | `Pattern XABCD` | `LineTool5PointsPattern` |
| | `Cypher pattern` | `LineToolCypherPattern` |
| | `Testa e spalle` | `LineToolHeadAndShoulders` |
| | `Pattern ABCD` | `LineToolABCD` |
| | `Pattern triangolo` | `LineToolTrianglePattern` |
| | `Pattern three drives` | `LineToolThreeDrivers` |
| **ONDE DI ELLIOTT** | `Onda impulsiva di Elliott (1·2·3·4·5)` | `LineToolElliottImpulse` |
| | `Correzione onde di Elliott (A·B·C)` | `LineToolElliottCorrection` |
| | `Onda triangolare di Elliott (A·B·C·D·E)` | `LineToolElliottTriangle` |
| | `Onda combinata doppia di Elliott (W·X·Y)` | `LineToolElliottDoubleCombo` |
| | `Onda tripla combinata di Elliott (W·X·Y·X·Z)` | `LineToolElliottTripleCombo` |
| **CICLI** | `Linee cicliche` | `LineToolCircleLines` |
| | `Cicli temporali` | `LineToolTimeCycles` |
| | `Curva sinusoidale` | `LineToolSineLine` |

### Group 5 — `Strumenti di misurazione e previsione` (`[data-name="linetool-group-prediction-and-measurement"]`, primary: `Posizione long`)
| Section | Exact Italian Label | `data-name` |
|---|---|---|
| **PREVISIONI** | `Posizione long` | `LineToolRiskRewardLong` |
| | `Posizione short` | `LineToolRiskRewardShort` |
| | `Previsione posizione` | `LineToolPrediction` |
| | `Pattern a barre` | `LineToolBarsPattern` |
| | `Barre fantasma` | `LineToolGhostFeed` |
| | `Settore` | `LineToolProjection` |
| **BASATO SUL VOLUME** | `VWAP ancorato` | `LineToolAnchoredVWAP` |
| | `Profilo volume ad intervallo fisso` | `LineToolFixedRangeVolumeProfile` |
| | `Profilo volume ancorato` | `LineToolAnchoredVolumeProfile` |
| **MISURATORI** | `Range prezzo` | `LineToolPriceRange` |
| | `Range data` | `LineToolDateRange` |
| | `Range data e prezzo` | `LineToolDateAndPriceRange` |

### Group 6 — `Forme geometriche` (`[data-name="linetool-group-geometric-shapes"]`, primary: `Pennello`)
| Section | Exact Italian Label | `data-name` | Shortcut |
|---|---|---|---|
| **SPAZZOLE** | `Pennello` | `LineToolBrush` | — |
| | `Evidenziatore` | `LineToolHighlighter` | — |
| **FRECCE** | `Freccia` | `LineToolArrowMarker` | *(marker icon)* |
| | `Freccia` | `LineToolArrow` | *(line arrow icon)* |
| | `Freccia su` | `LineToolArrowMarkUp` | — |
| | `Freccia giù` | `LineToolArrowMarkDown` | — |
| **FORME** | `Rettangolo` | `LineToolRectangle` | `Alt + Shift + R` *(hold `Shift` = Square)* |
| | `Rettangolo ruotato` | `LineToolRotatedRectangle` | — |
| | `Percorso` | `LineToolPath` | — |
| | `Cerchio` | `LineToolCircle` | — |
| | `Ellisse` | `LineToolEllipse` | *(hold `Shift` = Circle)* |
| | `Polilinea` | `LineToolPolyline` | — |
| | `Triangolo` | `LineToolTriangle` | — |
| | `Arco` | `LineToolArc` | — |
| | `Curva` | `LineToolBezierQuadro` | — |
| | `Curva doppia` | `LineToolBezierCubic` | — |

### Group 7 — `Strumenti di annotazione` (`[data-name="linetool-group-annotation"]`, primary: `Testo`)
| Section | Exact Italian Label | `data-name` | Notes |
|---|---|---|---|
| **TESTO E NOTE** | `Testo` | `LineToolText` | On-chart text box |
| | `Nota` | `LineToolTextNote` | Anchored / floating text note |
| | `Nota di prezzo` | `LineToolPriceNote` | Price-pinned note callout |
| | `Spilla` | `LineToolNote` | Pin marker note (`T` / pin icon) |
| | `Tabella` | `LineToolTable` | `Tab` / `Shift + Tab` navigates cells |
| | `Annuncio` | `LineToolCallout` | Speech-bubble callout |
| | `Commento` | `LineToolComment` | Speech-bubble comment |
| | `Etichetta prezzo` | `LineToolPriceLabel` | Price-tag badge |
| | `Segnale` | `LineToolSignpost` | Star signpost marker |
| | `Bandiera` | `LineToolFlagMark` | Flag marker |
| **CONTENUTO** | `Immagine` | `LineToolImage` | Embedded chart image |
| | `Post` | `LineToolTweet` | X/Tweet post embed |
| | `Idea` | `LineToolIdea` | TradingView Idea link |

### Group 8 — `Icone` (`[data-name="linetool-group-font-icons"]`, primary: `Icona`)
- 3 bottom mode tabs: **`Emoji`**, **`Sticker`**, **`Icone`** (`09` / `11_flyout_icons.png`).
- Under `Emoji`: 8 top category icons (`smile e persone`, animals/nature, food/drink, activities, travel/places, objects, symbols, flags) over a virtualized `38×38` grid (Twemoji 13.0.1 assets).

### Standalone Lower Tools, Utility Flyouts & Favorites (`★`)
1. `Range AI` (`[data-name="ai-copilot-area"]`) — AI Copilot range selection button.
2. `Misura` (`[data-name="measure"]`, hotkey **`Shift + click nel grafico`**) — **Works without sign-in** (`ev_be6aa6bb...`). Renders a `#2962ff` translucent selection box + solid `#2962ff` floating summary badge (`0,000 (0,00%) 0 / 0 barre, / Vol 360,08 K`) and `#2962ff` price/date axis pills.
3. `Ingrandisci` (`[data-name="zoom"]`) — Box zoom-in (`Zoom out` button appears beneath when zoomed in).
4. *(Divider)*
5. **Magnet** (`[data-name="magnet-button"]`, hotkey **`Ctrl`** temporary toggle):
   - Primary button tooltip: `La modalità magnete aggancia i disegni posizionati vicino alle barre dei prezzi al valore OHLC più vicino`
   - Flyout **`Calamite`**:
     - `Magnete debole` (`weakMagnet`)
     - `magnete forte` (`strongMagnet`) *(exact lowercase `m` observed in live DOM/a11y)*
     - *(divider)*
     - `Aggancia agli indicatori` *(toggle switch, disabled when no eligible indicator)*
6. **Stay in Drawing Mode** (`[data-name="drawginmode"]` — note TradingView's own typo `drawginmode` in `data-name`): `Continua a disegnare`.
7. **Lock** (`[data-name="lock-all"]`, primary: `Blocca disegni e indicatori`, flyout **`Opzioni di blocco`**):
   - `Blocca disegni` (`lock-drawing-tools`)
   - `Blocca indicatori` (`lock-indicators`)
   - `Blocca tutto` (`lock-all`)
8. **Hide** (`[data-name="hide-all"]`, primary: `Nascondi tutti gli strumenti di disegno`, hotkey **`Ctrl + Alt + H`**, flyout **`Nascondi opzioni`**):
   - `Nascondi disegni` (`hide-drawing-tools`)
   - `Nascondi indicatori` (`hide-indicators`)
   - `Nascondi posizioni e ordini` (`hide-positions-and-orders`)
   - `Nascondi tutto` (`hide-all`)
9. **Remove** (`[data-name="removeAllDrawingTools"]`, primary: `Rimuovi oggetti`, flyout **`Rimuovi opzioni`**):
   - `Rimuovi <N> disegni` (`remove-drawing-tools`)
   - `Rimuovi <N> indicatore/i` (`remove-studies`)
   - `Rimuovi <N> disegni e <N> indicatore/i` (`remove-all`)
   - *(divider)*
   - `Rimuovi sempre i disegni bloccati` *(toggle switch)*
10. **Favorites Star (`★`) Behavior** (`ev_f8940308...`, `tv-favorites-bar.png`):
    - Starring any tool (`button[aria-label="Aggiungi ai preferiti"]`) immediately spawns:
      1. A **bottom-left `★` toggle button** at the base of the left drawing toolbar (white active star outline inside dark rounded square) to show/hide the bar.
      2. A **draggable floating `tv-favorited-drawings-toolbar`** (`::` grip handle + starred tool buttons `[data-name="FavoriteToolbarLineToolTrendLine"]`, etc.).

---

## 3. Right-Click Context Menus & Submenus (Observations)

### 3.1 Right-Click on Price Scale (`Asse prezzi`, `[data-name="price-axis-A"]`) & Bottom-Right `56×28` Corner Gear
Observed identically in `ev_1e09c84c...` (right-click `price-axis-A`), `ev_abf99d85...` (submenus), and `ev_be6aa6bb...` (left-click bottom-right `56×28` gear icon):

| Order | Italian Label | Type / State | Shortcut / Readout |
|---|---|---|---|
| 1 | `Auto (adatta dati a schermo)` | Checkable `[✓]` | — |
| 2 | `Blocca rapporto prezzo/barra` | Checkable `[ ]` | Dynamic ratio e.g. `0,0087` |
| 3 | `Utilizza solo scala del prezzo` | Checkable `[ ]` | — |
| 4 | `Inverti asse` | Checkable `[ ]` | `Alt + I` |
| — | *Divider* | | |
| 5 | `Regolare` | Radio/Check `[✓]` | — |
| 6 | `Percentuale` | Radio/Check `[ ]` | `Alt + P` |
| 7 | `Indicizzata a base 100` | Radio/Check `[ ]` | — |
| 8 | `Logaritmica` | Radio/Check `[ ]` | `Alt + L` |
| — | *Divider* | | |
| 9 | `Sposta asse a sinistra` | Action *(flips to right when left)* | — |
| — | *Divider* | | |
| 10 | `Etichette` | **Submenu `>`** | *(see below)* |
| 11 | `Linee` | **Submenu `>`** | *(see below)* |
| 12 | `Pulsante "+"` | Checkable `[✓]` | — |
| — | *Divider* | | |
| 13 | `Altre impostazioni…` | Action (gear icon) | Opens `Impostazioni` (`Scale e linee`) |

#### Submenu `Etichette >` (`ev_abf99d85...`)
1. `[ ] Etichetta nome simbolo`
2. `[✓] Etichetta ultimo valore simbolo`
3. `[ ] Etichetta ultima chiusura giornaliera simbolo` *(disabled on 1D)*
4. `[✓] Etichetta prezzo pre/post e durante il mercato notturno`
5. `[ ] Etichette prezzo max e min`
6. `[ ] Etichette bid e ask`
7. `[ ] Etichette nome indicatori e finanziari`
8. `[✓] Etichette valore indicatori e finanziari`
9. `[✓] Conto alla rovescia`
10. *(divider)*
11. `[✓] Nessuna etichetta sovrapposta`

#### Submenu `Linee >` (`ev_abf99d85...`)
1. `[✓] Linea quotazioni`
2. `[ ] Linea ultima chiusura giornaliera` *(disabled on 1D)*
3. `[✓] Linea prezzo pre/post e durante il mercato notturno`
4. `[ ] Linee prezzo max e min`
5. `[ ] Linee bid e ask`

### 3.2 Right-Click on Main Chart Canvas (`[data-qa-id="pane-widget-chart-gui-wrapper"]`)
Observed in `ev_7985c7d5...` and `ev_a6f677c8...` (`tv-ctx-canvas.png`):

| Order | Italian Label (live interpolated example at price `1,553`) | Shortcut | Notes |
|---|---|---|---|
| 1 | `Copia prezzo 1,553` | — | Copies hovered Y price |
| 2 | `Incolla` | `Ctrl + V` | Enabled when drawing/object copied |
| — | *Divider* | | |
| 3 | `Aggiungi alert su JUVE a 1,553…` | `Alt + A` | Clock+ icon |
| 4 | `Vendi 1 JUVE @ 1,553 (limite)` | `Alt + Shift + S` | Above-market Sell Limit (flips to Buy Limit below last price) |
| 5 | `Compra 1 JUVE @ 1,553 (stop)` | — | Above-market Buy Stop (flips to Sell Stop below last price) |
| 6 | `Aggiungi ordine su JUVE a 1,553…` | `Shift + T` | `data-action-name="trade-new-order"` |
| — | *Divider* | | |
| 7 | `Blocca cursore verticale di tempo` | — | Pins vertical time crosshair line |
| — | *Divider* | | |
| 8 | `Vista tabella` | — | Table view toggle |
| 9 | `Albero oggetti` | — | Opens Object Tree right panel |
| — | *Divider* | | |
| 10 | `Rimuovi 1 indicatore` | — | Dynamic count (`Rimuovi N indicatori`) |
| — | *Divider* | | |
| 11 | `Impostazioni…` | — | Gear icon; opens Chart Settings modal |

### 3.3 Right-Click on Time Scale (`Asse temporale`, `.chart-markup-table.time-axis`)
Observed in `ev_4e3d466f...` and `ev_7985c7d5...` (`tv-ctx-time-axis.png`):

| Order | Italian Label | Type / State | Notes |
|---|---|---|---|
| 1 | `Fuso orario` | **Submenu `>`** | `UTC`, `Borsa`, plus 80+ regional offsets (`(UTC-10) Honolulu` … `(UTC+1) Berlino [✓]` … `(UTC+1) Roma` … `(UTC+13:45) Isole Chatham`) |
| 2 | `Separatori sessione` | Checkable | Disabled on `1D`/higher timeframes; enabled on intraday |
| — | *Divider* | | |
| 3 | `Altre impostazioni…` | Action (gear icon) | Opens `Impostazioni` (`Scale e linee` / `Asse temporale`) |

### 3.4 Price Axis `+` Button & Anonymous Drawing Gate
- **Price Axis `+` Button**: Observed visually rendered on `<canvas>` right next to the crosshair price pill (`1,553` in `tv-ctx-canvas.png`; `1,998` in `tv-favorites-bar.png`) whenever `Pulsante "+"` (`addPlusButton`) is enabled. Clicking it requires canvas coordinate targeting; see Unknowns (§6).
- **Drawing Placement & Context Menu / Floating Toolbar Gate** (`ev_7b98efb3...`, `ev_f8940308...`, `tv-ctx-drawing.png`):
  - Selecting `Linea orizzontale` or `Trendline` and clicking the chart canvas as an unauthenticated user immediately opens the modal:
    - Title: **`Sblocca tutti i disegni per la tua analisi`**
    - Body: `Iscriviti gratuitamente per accedere a [linea orizzontale / trendline] e a tutti gli altri strumenti di disegno. Individua tendenze e pattern, evidenzia i livelli di prezzo chiave e molto altro ancora.`
    - Primary CTA: `Registrati gratis` + link `Per saperne di più su questa funzionalità`.
  - Per strict non-bypass rules, login was NOT bypassed; therefore live DOM capture of the selected-drawing Context Menu and Floating Drawing Toolbar remains in Unknowns (§6).

---

## 4. `Impostazioni` (Chart Settings Modal) — Complete 7-Tab Specification (Observations)

Opened via `#header-toolbar-properties` (`ev_70694633...`, `ev_4830c958...`, `ev_22dd70a5...`, `ev_88032c70...`, `ev_39154c98...`, `ev_f4d580c4...`).
- **Header**: `Impostazioni` + close `×` (`[data-qa-id="close"]`, aria-label `Chiudere menù`).
- **Footer** (persistent across all tabs): `Modello ▾` (`Applica predefiniti`, `Salva come…`), `Annulla`, `Ok` (`[data-qa-id="submit-button"]`).
- **Exact 7 Tab IDs & Italian Titles**:
  1. `#symbol` — **`Simbolo`**
  2. `#legend` — **`Legenda`** *(Note: 2026 live Italian UI calls this `Legenda`, not `Linea di stato`)*
  3. `#scales` — **`Scale e linee`**
  4. `#canvas` — **`Canvas`**
  5. `#trading` — **`Trading`**
  6. `#alerts` — **`Alert`** *(Note: 2026 live Italian UI calls this `Alert`, not `Avvisi`)*
  7. `#events` — **`Eventi`**

### Tab 1: `Simbolo` (`#symbol`)
- **CANDELE** (`generalSymbolStylesGroup`, adapts to active Chart Style):
  - `[ ] Colore basato sulla chiusura precedente` (`mainSeriesSymbolCandleStyleBarColorsOnPrevClose`)
  - `[✓] Corpo` (`mainSeriesSymbolcandleCandlesColor`): `#089981` (`rgb(8, 153, 129)`) / `#f23645` (`rgb(242, 54, 69)`)
  - `[✓] Bordi` (`mainSeriesSymbolcandleBordersColor`): `#089981` / `#f23645`
  - `[✓] Ombra` (`mainSeriesSymbolcandleWickColors`): `#089981` / `#f23645`
- **MODIFICA DEI DATI** (`dataModififcationGroup`):
  - `[ ] Adegua i dati a seconda dei dividendi` (`candleSymbolDividendsAdjustment`) + `?` help link
  - `Precisione` (`candleSymbolMinTick`): combobox default `Predefinito` — **25 options**: `Predefinito`, `Intero`, `1 decimale` .. `15 decimali`, `1/2`, `1/4`, `1/8`, `1/16`, `1/32`, `1/64`, `1/128`, `1/320`
  - `Fuso orario` (`candleSymbolTimezone`): combobox default `(UTC+1) Berlino` (same city timezone catalog as Time Scale menu)

### Tab 2: `Legenda` (`#legend`)
- **STRUMENTO** (`seriesLegendVisibilityGroup`):
  - `[✓] Logo` (`showLogo`)
  - `[✓] Titolo` (`symbolTextSource`): combobox default `Nome` — options: **`Nome`**, **`Simbolo`**, **`Simbolo e nome`**
  - `[✓] Valori del grafico` (`ohlcTitle`)
  - `[✓] Variazione barre` (`barChange`)
  - `[ ] Volume` (`barVolume`)
  - `[ ] Variazione sul giorno precedente` (`lastDayChange`)
  - `[✓] Pulsanti compra/vendi` (`tradingSellBuyPanel`) — subtext: `Visualizza i pulsanti di acquisto e vendita direttamente sul grafico`
- **INDICATORI** (`studiesLegendVisibilityGroup`):
  - `[✓] Titoli` (`studyTitles`)
  - `[✓] Input` (`studyArguments`)
  - `[✓] Valori` (`studyValues`)
  - `[✓] Sfondo` (`legendBgTransparency`) — paired with horizontal transparency slider

### Tab 3: `Scale e linee` (`#scales`)
- **ASSE DEL PREZZO** (`scalesPriceScaleGroup`):
  - `Valuta ed unità` (`scalesCurrencyUnit`): `Visibile al passaggio del mouse` | `Sempre visibile` | `Sempre invisibile`
  - `Modalità di scala (A e L)` (`autoLogButtonsVisibility`): `Visibile al passaggio del mouse` | `Sempre visibile` | `Sempre invisibile`
  - `[ ] Blocca rapporto prezzo/barra` (`lockScale`) + numeric input (e.g. `0.0086885`)
  - `Posizione assi` (`scalesPlacement`): `Sinistra` | `Destra` | `Auto` *(default)*
- **ETICHETTE E LINEE DI PREZZO** (`scalesLabelsLineGroup`):
  - `[✓] Nessuna etichetta sovrapposta` (`noOverlappingLabels`)
  - `[✓] Pulsante "+"` (`addPlusButton`) + `?` help link
  - `[✓] Conto alla rovescia` (`countdown`, disabled when timeframe >= 1D)
  - `Simbolo`: mode button `Valore , Linea` (`[ ] Nome`, `[✓] Valore`, `[✓] Linea`) + combined color/thickness button + axis-mode combobox (`Valore asse`)
  - `Indicatori e dati finanziari`: mode button `Valore`
  - `Pre/post/mercato notturno`: mode button `Valore , Linea` + 3 color pickers (`rgb(251, 140, 0)`, `rgb(41, 98, 255)`, `rgb(142, 36, 170)`)
  - `Massimo e minimo`: mode button `Nascondi` + color/thickness picker (disabled when hidden)
  - `Bid e Ask`: mode button `Nascondi` + 2 color pickers (`rgb(41, 98, 255)`, `rgb(247, 82, 95)`, disabled when hidden)
- **ASSE TEMPORALE** (`scalesTimeScaleGroup`):
  - `[✓] Giorno della settimana sulle etichette` (`showWeekdayOnTimeScaleLabels`)
  - `Formato data` (`dateFormat`): default `lun 29 Set '97` — **19 Italian formats**: `lun Q3 '97`, `lun Q3 1997`, `lun 29 Set '97`, `lun Set '97`, `lun Set 29, 1997`, `lun Set 29, 1997`, `lun Set 1997`, `lun Set 29`, `lun 29 Set`, `lun 1997-09-29`, `lun 97-09-29`, `lun 97/09/29`, `lun 1997/09/29`, `lun 29-09-1997`, `lun 29-09-97`, `lun 29/09/97`, `lun 29/09/1997`, `lun 09/29/97`, `lun 09/29/1997`
  - `Formato orario` (`timeHoursFormat`): default `24 ore`
  - `[ ] Salva la posizione del bordo sinistro del grafico quando si cambia intervallo` (`saveLeftChartEdge`)
  - `[ ] Consenti lo zoom indietro esteso` (`extendedZoomOut`)

### Tab 4: `Canvas` (`#canvas`)
- **STILI BASE DEL GRAFICO** (`chartBasicStylesAppearanceGroup`):
  - `Sfondo` (`chartBackground`): `Tinta unita` *(default `#000000` dark)* | `Gradiente` (2 color pickers)
  - `[✓] Linee della griglia verticali` (`vertGridLines`): color + line-style picker (`rgba(242, 242, 242, 0.2)`, dotted)
  - `[✓] Linee della griglia orizzontali` (`horzGridLines`): color + line-style picker (`rgba(242, 242, 242, 0.2)`, dotted)
  - `Cursore` (`crossHair`): color + line-style/width picker (`rgb(156, 156, 156)`, dashed)
  - `Filigrana` (`watermark`): multi-check menu **`Ticker`**, **`Timeframe`**, **`Descrizione`**, **`Modalità replay`** `[✓]` + color picker (`rgba(80, 83, 94, 0.3)`)
- **ASSI** (`scalesAppearanceGroup`):
  - `Testo` (`scalesText`): color picker (`rgb(184, 184, 184)` = `#b8b8b8`) + font-size combobox default `12` — **13 sizes**: `8`, `10`, `11`, `12`, `14`, `16`, `18`, `20`, `22`, `24`, `28`, `32`, `40`
  - `Linee` (`scalesLine`): color picker (`rgba(242, 242, 242, 0)`)
- **PULSANTI** (`buttonsAppearanceGroup`):
  - `Controlli navigazione` (`navButtons`): `Visibile al passaggio del mouse` | `Sempre visibile` | `Sempre invisibile`
  - `Pannello` (`paneButtons`): `Visibile al passaggio del mouse` | `Sempre visibile` | `Sempre invisibile`
- **MARGINI** (`marginsAppearanceGroup`):
  - `Sopra` (`paneTopMargin`): `10` `%`
  - `Sotto` (`paneBottomMargin`): `8` `%`
  - `Destra` (`paneRightMargin`): `10` `barre`

### Tab 5: `Trading` (`#trading`)
- **GENERALE** (`generalVisibilityGroup`):
  - `[✓] Pulsanti compra/vendi` (`tradingSellBuyPanel`)
  - `[ ] Trading con un clic` (`tradingConfirmEnabled`) — `Effettua, modifica o annulla ordini, oppure chiudi posizioni all’istante senza conferma`
  - `[ ] Suono di esecuzione` (`tradingSoundVolume`) + volume slider + melody combobox (`Sveglia`)
  - `[ ] Mostra solo le notifiche di rifiuto` (`tradingNotifications`)
- **STILE** (`appearanceVisibilityGroup`):
  - `[✓] Posizioni e ordini` (`tradingPositionsAndOrders`)
  - `[✓] Pulsante di inverti posizione` (`reverseButton`)
  - `Controlli sul trading` (`closeAndDragHandleVisibility`): `Visibile al passaggio del mouse`
  - `[✓] Progetto ordine per ordini a mercato` (`marketProjectOrderVisibility`)
  - `[✓] Valore di profitto e perdita` (`positionAndBracketsPL`)
  - `[✓] Posizioni` (`positionPL`): **`Liquidità`** | **`Tick`** | **`%`**
  - `[✓] Bracket` (`bracketsPLDisplay`): **`Liquidità`** | **`Tick`** | **`%`**
  - `[✓] Contrassegni delle esecuzioni` (`tradingExecutions`)
  - `[ ] Etichette delle esecuzioni` (`tradingExecutionsLables`)
  - `[✓] Linee di prezzo estese su tutta la larghezza del grafico` (`extendLeftTradingLine`)
  - `Allineamento ordine e posizione` (`positionAlign`): **`Sinistra`** | **`Centro`** | **`Destra`** *(default)*
  - `[ ] Ordini, esecuzioni e posizioni nelle istantanee dei grafici` (`visibilityOnScreenshotTitle`)

### Tab 6: `Alert` (`#alerts`)
- **VISIBILITÀ DELLA LINEA DEL GRAFICO** (`alertsLinesGroup`):
  - `[✓] Linee alert` (`colorAlertsLine`) + color/line-style swatch
  - `[✓] Solo alert attivi` (`showActiveOnly`)
- **NOTIFICHE** (`alertsNotificationGroup`):
  - `[✓] Volume alert` (`alertVolume`) + volume slider
  - `[✓] Nascondi automaticamente i toast` (`hideToasts`) + `?` help link

### Tab 7: `Eventi` (`#events`)
- **EVENTI** (`eventsGroup`):
  - `[ ] Idee` (`ideasFilter`) + combobox (`Tutte le idee`, disabled until checked) + `?` help link
  - `[✓] Dividendi` (`symbolDividends`)
  - `[✓] Frazionamenti` (`symbolSplits`)
  - `[✓] Utili` (`earnings`)
  - `[ ] Separatori utili` (`earningsBreaks`)
  - `[✓] Ultime notizie` (`lastNews`)
  - `[ ] Notifica delle notizie` (`notificationAboutNews`)

---

## 5. Observed Gestures & Official Italian Shortcuts (`Scorciatoie da tastiera`)

Extracted directly from the live `Scorciatoie da tastiera` drawer (`ev_3aec2b5d...`) and toolbar `data-tooltip-hotkey` attributes (`ev_b15e9485...`):

| Surface / Context | Gesture / Shortcut | Official Italian Label |
|---|---|---|
| **Main Canvas (Wheel / Scroll)** | `Ctrl + Rotella del mouse` *(or plain wheel on chart)* | `Zoom con focus` |
| | `Shift + Rotella del mouse` | `Sposta grafico a sinistra/destra` |
| **Main Canvas (Navigation & Layout)** | `Freccia sx` / `Freccia dx` | `Sposta il grafico 1 barra a sinistra` / `a destra` |
| | `Ctrl + Freccia sx` / `Freccia dx` | `Muovi veloce a sinistra` / `a destra` |
| | `Ctrl + Freccia su` / `Freccia giù` | `Ingrandisci` / `Rimpicciolisci` |
| | `Alt + Shift + Freccia sx` / `dx` | `Sposta grafico sulla prima barra` / `sull'ultima barra` |
| | `Alt + R` | `Reimposta la visualizzazione del grafico` |
| | `DoppioClick` (pane / separator) | `Seleziona/Deseleziona ingrandimento riquadro` / `Reimposta griglia layout` |
| | `Ctrl + DoppioClick` | `Pulsante comprimi pannello` |
| | `Shift + trascina` (multi-chart border) | `Modifica i bordi nel multi grafico` |
| **Price Scale & Time Scale** | `Alt + I` | `Inverti asse della serie` |
| | `Alt + L` | `Attiva/disattiva scala logaritmica` |
| | `Alt + P` | `Attiva/disattiva scala percentuale` |
| | `Alt + G` | `Vai alla data` |
| | `Double-click` on `price-axis-A` | Confirmed no error; leaves Auto scale (`A`) active (`ev_f4d580c4...`) |
| **Drawing & Measurement Gestures** | `Tieni premuto Shift + Click` | `Strumento di misurazione` (`Misura`) |
| | `Tieni premuto Alt + Disegna` | `Disegna con il cursore Dimostrazione` |
| | `Ctrl + Muovi un punto` | `Abilita/disabilita temporaneamente la modalità magnete` |
| | `Ctrl + trascina` | `Duplica uno strumento di disegno` |
| | `trascina + Shift` | `Muovi uno strumento di disegno orizzontalmente o verticalmente` |
| | `Trendline o canale + Shift` | `Angolo a 45 gradi o orizzontale` |
| | `Rettangolo + Shift` / `Ellisse + Shift` | `Quadrato` / `Cerchio` |
| | `Scatola Gann` + `Tieni premuto Shift` | `Scatola Gann con incrementi fissi` |
| | `Tieni premuto Ctrl + Click` | `Selezione multipla disegni` |
| | `Frecce direzionali` (`sx/dx/su/giù`) | `Sposta il disegno` (1 px / 1 barra) |
| | `Ctrl + C` / `Ctrl + V` | `Copia oggetto selezionato` / `Incolla oggetto` |
| | `Elimina` / `Backspace` / `Click con rotella` | `Rimuovi oggetto` |
| | `Ctrl + Z` / `Ctrl + Y` | `Annulla` / `Ripeti` |
| | `Ctrl + Alt + H` | `Nascondi tutti gli strumenti di disegno` |
| | `Ctrl + Cancellino` | `Cancellato parzialmente` |
| **Quick Modals & Actions** | `Ctrl + K` / `/` / `Alt + D` / `Alt + A` | `Ricerca rapida` / `Apri gli indicatori` / `Finestra dati` / `Aggiungi alert` |
| | `Shift + T` / `Shift + B` / `Shift + S` | `Ticket ordine` / `Acquisto` / `Vendita` (`Shift + Alt + B/S` = Limit) |
| | `Alt + Ctrl` | `Mostra il pulsante Più sul cursore` (`+` on price axis) |
| | `Shift + F` / `Ctrl + S` / `Alt + S` | `Schermo intero` / `Salva layout` / `Copia link immagine` |

---

## 6. Evidence Hygiene: Observations vs. Inferences vs. Unknowns

### 6.1 Observations (Directly Verified via REA)
- Complete exact Italian labels, `data-name` identifiers, sections, and shortcuts across all 12 left-toolbar flyouts, 3 lower utilities, and the draggable `★` Favorites toolbar.
- Exact items, checkmarks, dividers, shortcuts, and submenus (`Etichette >`, `Linee >`, `Fuso orario >`) for Price Scale, Main Canvas, Time Scale, and the `56×28` bottom-right corner gear.
- Exact 7 tabs of `Impostazioni` (`Simbolo`, `Legenda`, `Scale e linee`, `Canvas`, `Trading`, `Alert`, `Eventi`), defaults, color swatches, and dropdown option sets.
- Official Italian `Scorciatoie da tastiera` gesture & shortcut catalog and unauthenticated `Misura` tool behavior.
- Observed anonymous sign-in gate (`Sblocca tutti i disegni per la tua analisi`) blocking actual canvas placement of `Linea orizzontale` and `Trendline`.

### 6.2 Inferences (Bounded Engineering Guidance for Our Clone)
- **Axis Drag / Wheel Gesture Standard**: While `Scorciatoie da tastiera` documents canvas wheel (`Ctrl + Rotella` / `Shift + Rotella`) and drag/modifier gestures, standard Supercharts pointer interactions on `.price-axis` (vertical drag = price zoom, double-click = Auto scale reset, wheel = vertical scale zoom) and `.time-axis` (horizontal drag = bar spacing zoom, double-click = reset bar spacing) complement the verified `Ctrl+Scroll` / `Shift+Scroll` canvas gestures and `A` / `L` / `%` scale toggles.
- **Italian Naming Alignment**: Our clone should prefer live-verified `Legenda` (or clearly alias `Linea di stato`), `Alert`, `Linea trasversale` (`Alt+C`), `Raggio` / `Raggio orizzontale` (`Alt+J`), `Spilla`, `Annuncio`, `Segnale`, and place `Pitchfork` variants inside Group 2 (`Strumenti analisi trend`) for 1:1 fidelity with 2026 `it.tradingview.com/chart/`.

### 6.3 Unknowns & Limitations
- **Drawing Context Menu & Floating Drawing Toolbar (Auth-Gated)**: Because anonymous users on `https://it.tradingview.com/chart/` are blocked by `Sblocca tutti i disegni per la tua analisi` when placing `Linea orizzontale` (`ev_7b98efb3...`) or `Trendline` (`ev_f8940308...`), the live DOM of a selected drawing's Context Menu (`Clona`, `Copia`, `Ordine visivo`, `Impostazioni…`, `Nascondi`, `Blocca`, `Rimuovi`) and Floating Drawing Toolbar was **not observed** directly in this unauthenticated pass.
- **Price Axis `+` Quick Menu (Canvas Hitbox)**: Visually observed rendered on `<canvas>` when hovering the chart (`ev_a6f677c8...`, `ev_f8940308...`), and controlled by `Pulsante "+"` (`addPlusButton`) + `Alt + Ctrl`, but its popup menu items (`Aggiungi alert…`, `Vendi limite`, `Compra stop`, `Disegna linea orizzontale`) were not triggered via `capture_browser_scenario` because the `+` button has no standalone DOM locator.
- **Unexpanded Sub-Dropdowns in `Impostazioni`**: `Scale e linee -> Indicatori e dati finanziari`, `Massimo e minimo`, `Bid e Ask`, `Simbolo -> Valore asse` (`Valore asse` click dismissed the prior open menu in `ev_f4d580c4...`), `Scale e linee -> Formato orario`, `Trading -> Suono di esecuzione` melody list, `Trading -> Controlli sul trading`, and `Eventi -> Idee` filter dropdown remain unexpanded in live captures (observed only in their default closed state).
- **Direct Playwright Drag/Wheel Simulation**: `capture_browser_scenario` exposes click/double-click/press/fill/select actions without raw `mouse.wheel` or pointer-drag primitives; axis drag/wheel behaviors beyond `Scorciatoie da tastiera` and `dblclick_price_axis` remain inferred from standard TradingView behavior rather than directly driven by pointer events.
