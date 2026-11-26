# TradingView Italia Supercharts — Behavioral Parity & Interaction Physics Specification

- **Target**: `https://it.tradingview.com/chart/` (TradingView Italia Supercharts)
- **Method**: Live headless Chrome (`1440×900` desktop & `390×844` `hasTouch: true` mobile emulation, `it-IT`, `Europe/Rome`) driven via Playwright + REA MCP CDP (`list_browser_targets`, `capture_web_screenshot`, `inspect_web_page`) plus prior REA `capture_browser_scenario` captures from [REA_SUPERCHARTS_DEEP.md](file:///home/nani/varie/Giochi-TikTok/tradingview/docs/REA_SUPERCHARTS_DEEP.md).
- **Evidence IDs**:
  - `ev_84d69051d5ab0be22b86d55ea64b14149a84b9d497ebbb085ced2c04c77314c4` (`capture_web_screenshot`) / `ev_ddc5dbe73261a8facbd03da08d895ccb9dcf8739cc5f1d78c2a4e041a36a58eb` (`inspect_web_page`) — Desktop `Salva` split button & `Gestisci layout` dropdown
  - `ev_8ed85dd7a9d84295f07c725b1d76e9cbde9fafad5bc9939ea5537ef7b6c82bf3` / `ev_5272858a19ec09ffe0f871e2f0032d9c4cd847cbacf575b15fbe714154ad0551` — Desktop crosshair (`Mirino`) X-snap, Y-free tracking, axis pills, and live OHLC+Vol legend update
  - `ev_e34967c7c21d037e7f9aeff1cbe00f10c8972aca2fa703d99cffd373fc850308` / `ev_5713f4dd5e67d6554b0419630846c93d986f1fdfad7225b3a6dc24a9d2370045` — `Vol` Indicator Settings (`Input`, `Stile`, `Visibilità`)
  - `ev_4d4a5622c63bbc869f9dfcf2fa66a2a57dc4d886c652c49153221be06eda149b` / `ev_0bb081bbd2d4409d6a3fcdfc24f1a81ae3f1166196824b9a210515e11fdeadaa` — Future whitespace scrolling past latest bar (`2027` / `Feb`), zoom tooltip & long-press tip
  - `ev_737acaa27ec14198ad2263f7d64faec93e232a8c1ed081399a295b4580fb8b03` / `ev_ed1a4479d19ceee6ee6b490f2f99945e33108c0c43f86a74fd51b4c69b77b957` — Mobile `390×844` touch chrome, compact legend (`C - Chius.`), `Range data` sheet
  - `ev_26c1ed63bf241ea9a66314e641be05b5b448099d82d4354c079d07b6d0fdd4d0` / `ev_150acf2d0739b8862916172ce91e7474ab232edf774a6c80501c48a9d3cc59d5` — Mobile `390×844` long-press crosshair inspect mode (`gio 03 Dic '26`, `1,307`)

---

## 1. Top Toolbar `Salva` (Save Layout) Control & Dropdown

- **Container**: `#header-toolbar-save-load` (`.wrap-S_Zv8xTq`) positioned right next to the Multi-Chart `Impostazione layout` button.
- **Split Control Structure**:
  1. **Primary Save Button** (`[data-qa-id="save-load-button"]`):
     - `aria-label` / `data-tooltip`: **`Salva tutti i grafici per tutti i simboli e gli intervalli del layout`**
     - Hotkey attribute (`data-tooltip-hotkey`): **`Ctrl + S`**
     - Display: `Salva` (or saved layout name when a named cloud layout is active, alongside dirty/cloud status).
  2. **Layout Caret Button** (`[data-name="save-load-menu"]`, `aria-label="Gestisci layout"`):
     - Opens dropdown menu directly beneath `#header-toolbar-save-load`.
- **Observed Anonymous Menu Rows** (`ev_84d69051...`, [tv-save-dropdown.png](file:///home/nani/.gemini/antigravity/brain/9335e139-5688-437b-9a71-0ec210951149/tv-save-dropdown.png)):
  1. `Salva layout` — shortcut **`Ctrl + S`**
  2. `Scarica i dati del grafico…` *(download arrow icon)*
  3. *(divider)*
  4. `Crea nuovo layout…` *(`+` icon)*
  5. *(divider)*
  6. `Apri layout…` *(folder icon)* — shortcut **`Dot`** (`.`)
- **Clone Specification Note**: Unauthenticated visitors do not receive authenticated cloud-layout switches (`Salvataggio automatico`, `Rinomina…`, `Crea una copia…`). For our local offline-first Supercharts Pro workspace, pairing TradingView's split `Salva` cloud button + `Ctrl+S` with `Salva ora (Ctrl+S)`, `Salvataggio automatico` switch, `Rinomina…`, `Crea una copia…`, `Nuovo layout`, `I tuoi layout` switcher, and `Esporta / Importa JSON` delivers complete local persistence without sign-in gating.

---

## 2. Crosshair (`Mirino`) Interaction Physics — Desktop vs Mobile

### 2.1 Desktop (`1440×900`) Empirical Measurements (`ev_8ed85dd7...`)

Measured directly on `pane-top-canvas` across `2px` pointer increments (`mouseX = 532..556`, `mouseY = 356..360`):

| Pointer Local `(X, Y)` | Rendered Crosshair `(X, Y)` | Live OHLC + Vol Legend |
|---|---|---|
| `(532, 356)` | `(533, 356)` | `O 1,872 H 1,881 L 1,842 C 1,844 (−1,63%)` / `Vol 588,76 K` |
| `(534, 358)` | `(533, 358)` | *(same bar)* |
| `(536, 360)` | `(539, 360)` | `O 1,844 H 1,856 L 1,838 C 1,838 (−0,29%)` / `Vol 375 K` |
| `(538, 356)` | `(539, 356)` | *(same bar)* |
| `(540, 358)` | `(539, 358)` | *(same bar)* |
| `(542, 360)` | `(545, 360)` | `O 1,840 H 1,872 L 1,836 C 1,854 (+0,88%)` / `Vol 626,05 K` |
| `(548..552)` | `(551, ...)` | `O 1,867 H 1,869 L 1,840 C 1,840 (−0,78%)` / `Vol 380,02 K` |
| `(554..556)` | `(557, ...)` | `O 1,862 H 1,862 L 1,813 C 1,813 (−1,47%)` / `Vol 603,38 K` |

**Verified Parity Rules**:
1. **X-Axis Strict Bar-Center Snap**: The vertical dashed crosshair line snaps strictly to discrete candle-center X coordinates (`533, 539, 545, 551, 557` — exact `6.0px` bar spacing), **including virtual future bar slots** past the rightmost candle (`gio 03 Dic '26` verified in `tv-behavior-mobile-longpress-held.png`).
2. **Y-Axis Free Continuous Tracking**: The horizontal dashed line follows cursor `Y` pixel-for-pixel (`356 -> 358 -> 360`) without snapping.
3. **Axis Pills & `+` Button**:
   - Bottom Time Axis Pill: dark rounded pill (`mer 02 Set '26`, Italian weekday + day + month + `'YY`).
   - Right Price Axis Pill + Floating `+`: dark rounded pill (`1,610`, Italian decimal comma) with circular `( + )` quick-action trigger anchored right beside the price scale.
4. **Live Legend Updates**: Hovering updates BOTH the candle OHLC header (`O - Aper. / H - Max. / L - Min. / C - Chius.`) and indicator legend values (`Vol`) to the exact snapped bar; moving out of the plot restores resting latest-bar values.

### 2.2 Mobile (`390×844`, `hasTouch: true`) Touch Crosshair Physics (`ev_26c1ed63...`)

Verified via real CDP `Input.dispatchTouchEvent` sequences:
1. **Quick Tap (`60ms`)**: Crosshair stays **OFF** (`activeCols: []`, `activeRows: []`).
2. **1-Finger Touch Pan (`touchStart -> touchMove x8 -> touchEnd`)**: Chart pans cleanly across bars and future whitespace; crosshair remains **OFF** both during and after `touchend` — **zero frozen pills or stuck dashed lines**.
3. **Long-Press Crosshair Inspect Mode**: Confirmed explicitly by TradingView's live onboarding tooltip **`"Tieni premuto per visualizzare i valori dettagliati del grafico"`** (`ev_4d4a5622...`) and Cursors setting `Valori visualizzati al tocco prolungato`:
   - Holding stationary ~`250–650ms` activates the snapped crosshair (`+` price pill `1,307`, date pill `gio 03 Dic '26` even in future whitespace!).
   - Sliding finger while held scrubs cleanly from candle to candle updating legend values live.
   - Single tap (`afterTapDismiss`) dismisses the inspect crosshair cleanly (`activeCols: []`, `activeRows: []`).

---

## 3. Indicator Legend & Indicator Settings (`Impostazioni`)

- **Desktop Legend Row (`[data-qa-id="legend-source-item"]`)**:
  - Resting state shows indicator name + live value(s) (`Vol 682,1 K`).
  - Hover state draws a subtle border pill around the row (`tv-behavior-legend-hover.png`) revealing inline action buttons (`28×22px`):
    1. **`Nascondi`** (`[data-qa-id="legend-show-hide-action"]` — Eye icon)
    2. **`Impostazioni`** (`[data-qa-id="legend-settings-action"]` — Gear icon)
    3. **`Elimina`** (`[data-qa-id="legend-delete-action"]` — Trash icon)
    4. **`Altro`** (`[data-qa-id="legend-more-action"]` — `Più opzioni per <name>`)
- **Mobile `390×844` Legend (`tv-behavior-mobile-initial.png`)**:
  - Header compacts OHLC to **`C - Chius. 1,320 −0,055 (−4,00%)`** so it fits without multi-line wrap.
  - `[ ^ ]` (`[data-qa-id="legend-toggler"]`) collapses/expands indicator rows cleanly; inline action buttons remain concealed on small mobile screens until expanded/tapped.
- **Indicator `Impostazioni` Modal (`Vol` verified in `ev_e34967c7...`, `tv-behavior-vol-tab-0/1/2.png`)**:
  - **Header**: Indicator title (`Vol`), Pin button (`Aggancia a destra`), Close `×` (`Chiudere menù`).
  - **3 Italian Tabs**:
    1. **`Input`**: Parameter controls (`Periodo MA`, `Colore basato sulla chiusura precedente`, etc.).
    2. **`Stile`**: Plot toggles + color/opacity/style pickers (`Volume` `In crescita`/`In caduta`, `Volume MA`, `VALORI DI OUTPUT`: `Precisione`, `Etichette sull'asse verticale`, `Valori in legenda`, `VALORI DI INPUT`: `Input nella riga di stato`).
    3. **`Visibilità`**: Timeframe visibility toggles & range sliders (`Tick`, `Secondi 1..59`, `Minuti 1..59`, `Ore 1..24`, `Giorni 1..366`, `Settimane 1..52`, `Mesi 1..12`, `Ranges`).
  - **Footer**: `Predefiniti ▾`, `Annulla`, `Ok`.

---

## 4. Zoom, Hover Navigation Controls & Future Whitespace Scrolling

- **Wheel Zoom & Toast Behavior (`ev_4d4a5622...`)**:
  - Smooth proportional wheel zooming over the main chart adjusts bar width cleanly around the anchor point; live toast explicitly notes **`"Tieni premuto Ctrl per mantenere la posizione durante lo zoom"`**.
  - Modifying zoom/scroll automatically unhides `Reimposta la visualizzazione del grafico (Alt+R)` inside `[data-qa-id="control-bar"]`.
- **Bottom-Center Hover Navigation Bar (`[data-qa-id="control-bar"]`, `Controlli navigazione`)**:
  - Uses `.controlBarConcealed-B8ZDLI98` (fades in smoothly at `opacity: 1` when hovering the lower chart area, `tv-behavior-nav-controls.png`).
  - Exact Italian buttons & shortcuts:
    1. **`Rimpicciolisci`** (`[data-qa-id="control-bar-zoom-out-button"]`, `Ctrl + Down`)
    2. **`Ingrandisci`** (`[data-qa-id="control-bar-zoom-in-button"]`, `Ctrl + Up`)
    3. **`Scorri verso sinistra`** (`[data-qa-id="control-bar-scroll-left-button"]`, `Left Arrow`)
    4. **`Scorri verso destra`** (`[data-qa-id="control-bar-scroll-right-button"]`, `Right Arrow`)
    5. **`Reimposta la visualizzazione del grafico`** (`[data-qa-id="control-bar-reset-scale-button"]`, `Alt + R`, revealed when view differs from default)
    6. **Jump to Realtime (`>>`)** (`[data-qa-id="control-bar-back-to-realtime-button"]`, `Scorri fino all'ultima barra`, `Alt + Shift + Right`, positioned bottom-right above time axis when panned left into history).
- **Future Whitespace Scrolling (`ev_4d4a5622...`)**:
  - Dragging the canvas leftward freely scrolls past the last live bar into empty future date columns (`2027` / `Feb` rendered along the time axis), and crosshair X-snap + date pills continue working across future empty bar slots.
- **Mobile Bottom Bar (`390×844`)**:
  - Replaces the desktop range buttons (`1D 5D 1M 3M 6M YTD 1Y 5Y Tutto`) with a single **`Range data ▾`** button (`data-name="date-ranges-menu"`) opening a full-width mobile bottom sheet (`Timeframe 1 minuto a 1 giorno` .. `Timeframe 1 mese a Tutti i dati` + `Vai a…`), plus live clock (`12:31:14 UTC+1`) and `adg` / scale corner gear (`⚙`).
