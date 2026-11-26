import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CHART_DATE_FORMAT_OPTIONS,
  CHART_TIMEZONE_OPTIONS,
  DRAWING_TOOL_REGISTRY,
  normalizeDrawingTool,
} from '../../types';
import { formatPrice } from '../../data';
import {
  createPastedDrawing,
  getCopiedDrawing,
  setCopiedDrawing,
} from '../../engine';
import {
  resolveSymbolInfo,
  useActivePane,
  useAlerts,
  useDrawings,
  useQuotes,
  useTradingView,
} from '../../store';
import '../../styles/contextMenus.css';

export type ChartContextMenuTarget =
  | 'price_axis'
  | 'canvas'
  | 'time_axis'
  | 'drawing'
  | 'price_plus';

export interface ChartContextMenuState {
  target: ChartContextMenuTarget;
  clientX: number;
  clientY: number;
  price?: number;
  barIndex?: number;
  timestamp?: number;
  drawingId?: string;
  paneIndex?: number;
  priceToBarRatio?: number;
}

export interface ChartContextMenuProps {
  menu: ChartContextMenuState | null;
  onClose: () => void;
  onResetPriceScale?: () => void;
  onResetTimeScale?: () => void;
  onResetChartView?: () => void;
  onNotify?: (message: string) => void;
}

type SubmenuId =
  | 'labels'
  | 'lines'
  | 'theme'
  | 'timezone'
  | 'dateFormat'
  | 'order';

function CheckGlyph({ checked }: { checked: boolean; radio?: boolean }) {
  if (!checked) return null;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="2.5,7.3 5.5,10.2 11.5,3.8" />
    </svg>
  );
}

function SubChevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3.5,2 6.5,5 3.5,8" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" />
    </svg>
  );
}

function formatRatioItalian(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '1,0000';
  if (ratio >= 100) return ratio.toFixed(2).replace('.', ',');
  if (ratio >= 1) return ratio.toFixed(3).replace('.', ',');
  return ratio.toFixed(4).replace('.', ',');
}

function MenuItem({
  label,
  shortcut,
  title,
  checked,
  radio,
  icon,
  disabled,
  danger,
  hasSubmenu,
  submenuOpen,
  onClick,
  onOpenSubmenu,
}: {
  label: string;
  shortcut?: string;
  title?: string;
  checked?: boolean;
  radio?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  hasSubmenu?: boolean;
  submenuOpen?: boolean;
  onClick?: (anchorEl: HTMLElement) => void;
  onOpenSubmenu?: (anchorEl: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      role={
        checked !== undefined
          ? radio
            ? 'menuitemradio'
            : 'menuitemcheckbox'
          : 'menuitem'
      }
      aria-checked={checked}
      aria-haspopup={hasSubmenu ? 'menu' : undefined}
      aria-expanded={hasSubmenu ? submenuOpen : undefined}
      disabled={disabled}
      className={[
        'sc-ctx-item',
        checked ? 'sc-ctx-item--active' : '',
        danger ? 'sc-ctx-item--danger' : '',
        submenuOpen ? 'sc-ctx-item--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={(e) => {
        if (hasSubmenu && onOpenSubmenu) {
          onOpenSubmenu(e.currentTarget);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (hasSubmenu && onOpenSubmenu) {
          onOpenSubmenu(e.currentTarget);
          return;
        }
        onClick?.(e.currentTarget);
      }}
    >
      <span className="sc-ctx-item-left">
        <span className="sc-ctx-check-slot">
          {checked !== undefined ? (
            <CheckGlyph checked={checked} radio={radio} />
          ) : icon ? (
            <span className="sc-ctx-icon-slot">{icon}</span>
          ) : null}
        </span>
        <span className="sc-ctx-label">{label}</span>
      </span>

      {(shortcut || hasSubmenu) && (
        <span className="sc-ctx-item-right">
          {shortcut && <span className="sc-ctx-kbd">{shortcut}</span>}
          {hasSubmenu && (
            <span className="sc-ctx-chevron">
              <SubChevron />
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export function ChartContextMenu({
  menu,
  onClose,
  onResetPriceScale,
  onResetTimeScale,
  onResetChartView,
  onNotify,
}: ChartContextMenuProps) {
  const {
    theme,
    setTheme,
    chartSettings,
    updateChartSettings,
    openModal,
    appendLog,
  } = useTradingView();

  const {
    activePaneIndex,
    panes,
    activePane,
    setScaleMode,
    toggleAutoScale,
    toggleInvertScale,
    toggleLockPriceToBarRatio,
    setPriceScalePosition,
    clearIndicators,
  } = useActivePane();

  const {
    drawingsBySymbol,
    hideDrawings,
    setHideDrawings,
    lockDrawings,
    addDrawing,
    updateDrawing,
    deleteDrawing,
    cloneDrawing,
    bringToFront,
    sendToBack,
    clearDrawings,
    openDrawingSettings,
    setSelectedDrawingId,
  } = useDrawings();

  const { quotes } = useQuotes();
  const { createAlert } = useAlerts();

  const menuRef = useRef<HTMLDivElement | null>(null);
  const subMenuRef = useRef<HTMLDivElement | null>(null);
  const subAnchorRef = useRef<HTMLElement | null>(null);
  const closeSubTimerRef = useRef<number | null>(null);

  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  }>({ left: 16, top: 48, maxHeight: 600 });

  const [openSubmenu, setOpenSubmenu] = useState<SubmenuId | null>(null);
  const [subCoords, setSubCoords] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  }>({ left: 260, top: 48, maxHeight: 500 });

  const targetPaneIdx = menu?.paneIndex ?? activePaneIndex;
  const targetPane = panes[targetPaneIdx] ?? activePane;
  const targetSymbol = useMemo(
    () => resolveSymbolInfo(targetPane.symbolId),
    [targetPane.symbolId],
  );
  const targetDrawings = drawingsBySymbol[targetSymbol.ticker] ?? [];
  const targetDrawing = useMemo(
    () =>
      menu?.drawingId
        ? targetDrawings.find((d) => d.id === menu.drawingId) ?? null
        : null,
    [menu?.drawingId, targetDrawings],
  );
  const targetDrawingMeta = targetDrawing
    ? DRAWING_TOOL_REGISTRY[normalizeDrawingTool(targetDrawing.type)]
    : null;

  const resolvedPrecision = useMemo(() => {
    const p = chartSettings.symbol.precision;
    if (p !== 'default') {
      const parsed = Number(p);
      if (Number.isFinite(parsed)) return parsed;
    }
    return targetSymbol.precision;
  }, [chartSettings.symbol.precision, targetSymbol.precision]);

  const livePrice = quotes[targetSymbol.ticker]?.price ?? targetSymbol.basePrice;
  const cursorPrice =
    menu?.price !== undefined && Number.isFinite(menu.price)
      ? menu.price
      : livePrice;
  const formattedPrice = formatPrice(cursorPrice, resolvedPrecision);

  const ratioValue =
    menu?.priceToBarRatio && Number.isFinite(menu.priceToBarRatio)
      ? menu.priceToBarRatio
      : chartSettings.scales.priceToBarRatio;
  const formattedRatio = formatRatioItalian(ratioValue);

  const effectiveInvert =
    targetPane.invertScale ?? chartSettings.scales.invertScale;
  const effectiveLockRatio =
    targetPane.lockPriceToBarRatio ?? chartSettings.scales.lockPriceToBarRatio;
  const effectivePriceScalePos =
    targetPane.priceScalePosition ?? chartSettings.scales.position;

  const copiedDrawing = getCopiedDrawing();

  const cancelSubClose = useCallback(() => {
    if (closeSubTimerRef.current !== null) {
      window.clearTimeout(closeSubTimerRef.current);
      closeSubTimerRef.current = null;
    }
  }, []);

  const scheduleSubClose = useCallback(() => {
    cancelSubClose();
    closeSubTimerRef.current = window.setTimeout(() => {
      setOpenSubmenu(null);
    }, 140);
  }, [cancelSubClose]);

  useEffect(() => {
    setOpenSubmenu(null);
    cancelSubClose();
  }, [cancelSubClose, menu]);

  // Clamp main context menu cleanly inside viewport (flips left on right-side clicks!)
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const clampMain = () => {
      if (!menuRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = menuRef.current.getBoundingClientRect();

      let left = menu.clientX;
      if (left + rect.width > vw - 8) {
        left = menu.clientX - rect.width;
      }
      left = Math.max(8, Math.min(vw - rect.width - 8, left));

      let top = menu.clientY;
      if (top + rect.height > vh - 8) {
        top = Math.max(8, vh - rect.height - 8);
      }

      setCoords({
        left: Math.round(left),
        top: Math.round(top),
        maxHeight: Math.max(160, vh - 16),
      });
    };

    clampMain();
    window.addEventListener('resize', clampMain);
    return () => window.removeEventListener('resize', clampMain);
  }, [menu]);

  // Clamp nested submenu cleanly inside viewport (flips left when near right edge or mobile!)
  useLayoutEffect(() => {
    if (!openSubmenu || !subMenuRef.current || !subAnchorRef.current) return;
    const clampSub = () => {
      if (!subMenuRef.current || !subAnchorRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const anchor = subAnchorRef.current.getBoundingClientRect();
      const subRect = subMenuRef.current.getBoundingClientRect();

      let left = anchor.right - 2;
      if (left + subRect.width > vw - 8) {
        left = anchor.left - subRect.width + 2;
      }
      if (left < 8) {
        left = Math.max(8, vw - subRect.width - 8);
      }

      let top = anchor.top - 4;
      if (top + subRect.height > vh - 8) {
        top = Math.max(8, vh - subRect.height - 8);
      }

      setSubCoords({
        left: Math.round(left),
        top: Math.round(top),
        maxHeight: Math.max(160, vh - 16),
      });
    };

    clampSub();
    window.addEventListener('resize', clampSub);
    return () => window.removeEventListener('resize', clampSub);
  }, [openSubmenu]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t) || subMenuRef.current?.contains(t)) {
        return;
      }
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (openSubmenu) setOpenSubmenu(null);
        else onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menu, onClose, openSubmenu]);

  if (!menu) return null;

  const openSub = (id: SubmenuId, anchorEl: HTMLElement) => {
    cancelSubClose();
    subAnchorRef.current = anchorEl;
    setOpenSubmenu(id);
  };

  const clearNonSubHover = () => {
    scheduleSubClose();
  };

  const notify = (msg: string) => {
    onNotify?.(msg);
  };

  const openSettingsAtTab = (
    tab: 'symbol' | 'statusLine' | 'scales' | 'canvas' | 'alerts',
  ) => {
    window.dispatchEvent(
      new CustomEvent('tv-open-settings-tab', { detail: { tab } }),
    );
    openModal('settings');
    onClose();
  };

  const handleCopyPrice = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(formattedPrice);
      }
    } catch {
      // ignore clipboard errors in restricted environments
    }
    appendLog({
      category: 'system',
      level: 'info',
      title: `Prezzo copiato: ${formattedPrice}`,
      symbol: targetSymbol.ticker,
    });
    notify(`Prezzo ${formattedPrice} copiato negli appunti`);
    onClose();
  };

  const handleCreateAlertAtPrice = (customName?: string) => {
    const condition = cursorPrice >= livePrice ? 'crosses_above' : 'crosses_below';
    createAlert({
      symbol: targetSymbol.ticker,
      target: 'price',
      condition,
      value: cursorPrice,
      name: customName ?? `${targetSymbol.ticker} @ ${formattedPrice}`,
      message: `Alert ${targetSymbol.ticker} raggiunto livello ${formattedPrice}`,
    });
    notify(`Alert creato su ${targetSymbol.ticker} a ${formattedPrice}`);
    onClose();
  };

  const handlePlaceHorizontalLine = () => {
    const meta = DRAWING_TOOL_REGISTRY.hline;
    const nowSec = menu.timestamp ?? Math.floor(Date.now() / 1000);
    addDrawing({
      id: `drw-hline-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      symbol: targetSymbol.ticker,
      timeframe: targetPane.timeframe,
      type: 'hline',
      points: [{ time: nowSec, price: cursorPrice }],
      style: {
        color: meta.defaultColor,
        lineWidth: meta.defaultLineWidth,
        lineStyle: meta.defaultLineStyle,
      },
      locked: false,
      visible: true,
      createdAt: Date.now(),
      showPriceLabels: true,
    });
    notify(`Linea orizzontale aggiunta a ${formattedPrice}`);
    onClose();
  };

  const handlePasteDrawing = () => {
    const src = getCopiedDrawing();
    if (!src) return;
    const anchor = src.points[0];
    const priceOffset =
      anchor && Number.isFinite(cursorPrice) ? cursorPrice - anchor.price : 0;
    const timeOffset =
      anchor && menu.timestamp !== undefined ? menu.timestamp - anchor.time : 0;
    const pasted = createPastedDrawing(
      src,
      targetSymbol.ticker,
      targetPane.timeframe,
      priceOffset,
      timeOffset,
    );
    addDrawing(pasted);
    setSelectedDrawingId(pasted.id);
    notify('Disegno incollato');
    onClose();
  };

  const hasVerticalGrid =
    chartSettings.canvas.gridMode === 'both' ||
    chartSettings.canvas.gridMode === 'vert';

  const toggleVerticalGrid = () => {
    const curr = chartSettings.canvas.gridMode;
    const next =
      curr === 'both'
        ? 'horz'
        : curr === 'vert'
          ? 'none'
          : curr === 'horz'
            ? 'both'
            : 'vert';
    updateChartSettings({ canvas: { gridMode: next } });
    onClose();
  };

  const drawingsCount = targetDrawings.length;
  const indicatorsCount = targetPane.indicators.length;

  return (
    <>
      <div
        ref={menuRef}
        className="sc-ctx-menu"
        role="menu"
        data-testid={`ctx-menu-${menu.target}`}
        aria-label={`Menu contestuale ${menu.target}`}
        style={{
          left: coords.left,
          top: coords.top,
          maxHeight: coords.maxHeight,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* ======================== 1. PRICE AXIS MENU (1:1 TradingView Italia) ======================== */}
        {menu.target === 'price_axis' && (
          <>
            <div
              onMouseEnter={clearNonSubHover}
              onMouseLeave={cancelSubClose}
            >
              <MenuItem
                label="Ripristina scala prezzi"
                shortcut="Alt + R"
                onClick={() => {
                  onResetPriceScale?.();
                  if (!onResetPriceScale) {
                    if (!targetPane.autoScale) toggleAutoScale(targetPaneIdx);
                    if (effectiveInvert) toggleInvertScale(targetPaneIdx);
                    if (effectiveLockRatio) {
                      toggleLockPriceToBarRatio(targetPaneIdx);
                    }
                  }
                  onClose();
                }}
              />
              <MenuItem
                label="Auto (adatta dati a schermo)"
                checked={targetPane.autoScale}
                onClick={() => {
                  toggleAutoScale(targetPaneIdx);
                  onClose();
                }}
              />
              <MenuItem
                label="Blocca rapporto prezzo/barra"
                shortcut={formattedRatio}
                checked={effectiveLockRatio}
                onClick={() => {
                  if (!effectiveLockRatio && ratioValue > 0) {
                    updateChartSettings({
                      scales: { priceToBarRatio: Number(ratioValue.toFixed(6)) },
                    });
                  }
                  toggleLockPriceToBarRatio(targetPaneIdx);
                  onClose();
                }}
              />
              <MenuItem
                label="Utilizza solo scala del prezzo"
                checked={chartSettings.scales.scalePriceChartOnly}
                onClick={() => {
                  updateChartSettings({
                    scales: {
                      scalePriceChartOnly:
                        !chartSettings.scales.scalePriceChartOnly,
                    },
                  });
                  onClose();
                }}
              />
              <MenuItem
                label="Inverti asse"
                shortcut="Alt + I"
                checked={effectiveInvert}
                onClick={() => {
                  toggleInvertScale(targetPaneIdx);
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label="Regolare"
                radio
                checked={targetPane.scaleMode === 'regular'}
                onClick={() => {
                  setScaleMode('regular', targetPaneIdx);
                  onClose();
                }}
              />
              <MenuItem
                label="Percentuale"
                shortcut="Alt + P"
                radio
                checked={targetPane.scaleMode === 'percent'}
                onClick={() => {
                  setScaleMode('percent', targetPaneIdx);
                  onClose();
                }}
              />
              <MenuItem
                label="Indicizzata a base 100"
                radio
                checked={targetPane.scaleMode === 'indexed100'}
                onClick={() => {
                  setScaleMode('indexed100', targetPaneIdx);
                  onClose();
                }}
              />
              <MenuItem
                label="Logaritmica"
                shortcut="Alt + L"
                radio
                checked={targetPane.scaleMode === 'log'}
                onClick={() => {
                  setScaleMode('log', targetPaneIdx);
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label={
                  effectivePriceScalePos === 'right'
                    ? 'Sposta asse a sinistra'
                    : 'Sposta asse a destra'
                }
                onClick={() => {
                  setPriceScalePosition(
                    effectivePriceScalePos === 'right' ? 'left' : 'right',
                    targetPaneIdx,
                  );
                  onClose();
                }}
              />
            </div>

            <div className="sc-ctx-sep" />

            <MenuItem
              label="Etichette"
              hasSubmenu
              submenuOpen={openSubmenu === 'labels'}
              onOpenSubmenu={(el) => openSub('labels', el)}
            />
            <MenuItem
              label="Linee"
              hasSubmenu
              submenuOpen={openSubmenu === 'lines'}
              onOpenSubmenu={(el) => openSub('lines', el)}
            />

            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label='Pulsante "+"'
                checked={chartSettings.scales.showPlusButton}
                onClick={() => {
                  updateChartSettings({
                    scales: { showPlusButton: !chartSettings.scales.showPlusButton },
                  });
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label="Altre impostazioni…"
                icon={<GearGlyph />}
                onClick={() => openSettingsAtTab('scales')}
              />
            </div>
          </>
        )}

        {/* ======================== 2. MAIN CANVAS MENU (1:1 TradingView Italia) ======================== */}
        {menu.target === 'canvas' && (
          <>
            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label="Reimposta la visualizzazione del grafico"
                shortcut="Alt + R"
                onClick={() => {
                  onResetChartView?.();
                  onResetPriceScale?.();
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label={`Copia prezzo ${formattedPrice}`}
                onClick={handleCopyPrice}
              />
              <MenuItem
                label="Incolla"
                shortcut="Ctrl + V"
                disabled={!copiedDrawing}
                onClick={handlePasteDrawing}
              />
              <MenuItem
                label={`Aggiungi alert su ${targetSymbol.ticker} a ${formattedPrice}`}
                shortcut="Alt + A"
                onClick={() => handleCreateAlertAtPrice()}
              />
              <MenuItem
                label={`Disegna linea orizzontale a ${formattedPrice}`}
                onClick={handlePlaceHorizontalLine}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label="Nascondi disegni"
                shortcut="Ctrl + Alt + H"
                checked={hideDrawings}
                onClick={() => {
                  setHideDrawings(!hideDrawings);
                  onClose();
                }}
              />
              <MenuItem
                label={
                  drawingsCount === 1
                    ? 'Rimuovi 1 disegno'
                    : `Rimuovi ${drawingsCount} disegni`
                }
                disabled={drawingsCount === 0}
                onClick={() => {
                  clearDrawings(targetSymbol.ticker);
                  onClose();
                }}
              />
              <MenuItem
                label={
                  indicatorsCount === 1
                    ? 'Rimuovi 1 indicatore'
                    : `Rimuovi ${indicatorsCount} indicatori`
                }
                disabled={indicatorsCount === 0}
                onClick={() => {
                  clearIndicators(targetPaneIdx);
                  onClose();
                }}
              />
            </div>

            <MenuItem
              label="Tema colore"
              hasSubmenu
              submenuOpen={openSubmenu === 'theme'}
              onOpenSubmenu={(el) => openSub('theme', el)}
            />

            <div onMouseEnter={clearNonSubHover}>
              <div className="sc-ctx-sep" />
              <MenuItem
                label="Impostazioni…"
                icon={<GearGlyph />}
                onClick={() => openSettingsAtTab('canvas')}
              />
            </div>
          </>
        )}

        {/* ======================== 3. TIME AXIS MENU ======================== */}
        {menu.target === 'time_axis' && (
          <>
            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label="Ripristina scala temporale"
                onClick={() => {
                  onResetTimeScale?.();
                  if (!onResetTimeScale) onResetChartView?.();
                  onClose();
                }}
              />
            </div>

            <MenuItem
              label="Fuso orario"
              hasSubmenu
              submenuOpen={openSubmenu === 'timezone'}
              onOpenSubmenu={(el) => openSub('timezone', el)}
            />
            <MenuItem
              label="Formato data"
              hasSubmenu
              submenuOpen={openSubmenu === 'dateFormat'}
              onOpenSubmenu={(el) => openSub('dateFormat', el)}
            />

            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label="Linee della griglia verticali"
                checked={hasVerticalGrid}
                onClick={toggleVerticalGrid}
              />
              <div className="sc-ctx-sep" />
              <MenuItem
                label="Altre impostazioni…"
                icon={<GearGlyph />}
                onClick={() => openSettingsAtTab('scales')}
              />
            </div>
          </>
        )}

        {/* ======================== 4. DRAWING OBJECT MENU (1:1 TradingView Authenticated) ======================== */}
        {menu.target === 'drawing' && (
          <>
            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label={`Aggiungi alert su ${targetDrawingMeta?.labelIt ?? 'disegno'}…`}
                shortcut="Alt + A"
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) {
                    handleCreateAlertAtPrice(
                      `${targetSymbol.ticker} · ${targetDrawingMeta?.labelIt ?? 'Disegno'} @ ${formattedPrice}`,
                    );
                  }
                }}
              />
            </div>

            <MenuItem
              label="Ordine visualizzazione"
              hasSubmenu
              disabled={!targetDrawing}
              submenuOpen={openSubmenu === 'order'}
              onOpenSubmenu={(el) => openSub('order', el)}
            />

            <div onMouseEnter={clearNonSubHover}>
              <MenuItem
                label="Duplica"
                shortcut="Ctrl + Drag"
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) {
                    cloneDrawing(targetDrawing.id, targetSymbol.ticker);
                  }
                  onClose();
                }}
              />
              <MenuItem
                label="Copia"
                shortcut="Ctrl + C"
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) {
                    setCopiedDrawing(targetDrawing);
                    notify('Disegno copiato');
                  }
                  onClose();
                }}
              />
              <MenuItem
                label={targetDrawing?.locked ? 'Sblocca' : 'Blocca'}
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) {
                    updateDrawing(targetSymbol.ticker, targetDrawing.id, {
                      locked: !targetDrawing.locked,
                    });
                  }
                  onClose();
                }}
              />
              <MenuItem
                label={targetDrawing?.visible === false ? 'Mostra' : 'Nascondi'}
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) {
                    updateDrawing(targetSymbol.ticker, targetDrawing.id, {
                      visible: !targetDrawing.visible,
                    });
                  }
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label="Elimina"
                shortcut="Canc"
                danger
                disabled={!targetDrawing || Boolean(targetDrawing.locked || lockDrawings)}
                title={
                  targetDrawing?.locked || lockDrawings
                    ? 'Sblocca il disegno prima di eliminarlo'
                    : undefined
                }
                onClick={() => {
                  if (!targetDrawing || targetDrawing.locked || lockDrawings) return;
                  deleteDrawing(targetSymbol.ticker, targetDrawing.id);
                  onClose();
                }}
              />

              <div className="sc-ctx-sep" />

              <MenuItem
                label="Impostazioni…"
                icon={<GearGlyph />}
                disabled={!targetDrawing}
                onClick={() => {
                  if (targetDrawing) openDrawingSettings(targetDrawing.id);
                  onClose();
                }}
              />
            </div>
          </>
        )}

        {/* ======================== 5. PRICE AXIS (+) QUICK MENU ======================== */}
        {menu.target === 'price_plus' && (
          <>
            <div className="sc-ctx-header">
              <span>{targetSymbol.ticker}</span>
              <span>{formattedPrice}</span>
            </div>
            <MenuItem
              label={`Aggiungi alert su ${targetSymbol.ticker} a ${formattedPrice}`}
              shortcut="Alt + A"
              onClick={() => handleCreateAlertAtPrice()}
            />
            <MenuItem
              label={`Disegna linea orizzontale a ${formattedPrice}`}
              onClick={handlePlaceHorizontalLine}
            />
            <div className="sc-ctx-sep" />
            <MenuItem
              label={`Copia prezzo ${formattedPrice}`}
              onClick={handleCopyPrice}
            />
          </>
        )}
      </div>

      {/* ======================== NESTED SUBMENUS ======================== */}
      {openSubmenu && (
        <div
          ref={subMenuRef}
          className="sc-ctx-submenu"
          role="menu"
          data-testid={`ctx-submenu-${openSubmenu}`}
          style={{
            left: subCoords.left,
            top: subCoords.top,
            maxHeight: subCoords.maxHeight,
          }}
          onMouseEnter={cancelSubClose}
          onMouseLeave={scheduleSubClose}
          onContextMenu={(e) => e.preventDefault()}
        >
          {openSubmenu === 'labels' && (
            <>
              <MenuItem
                label="Etichetta nome simbolo"
                checked={chartSettings.scales.showSymbolNameLabel}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showSymbolNameLabel:
                        !chartSettings.scales.showSymbolNameLabel,
                    },
                  })
                }
              />
              <MenuItem
                label="Ultimo valore simbolo"
                checked={chartSettings.scales.showSymbolLastValueLabel}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showSymbolLastValueLabel:
                        !chartSettings.scales.showSymbolLastValueLabel,
                    },
                  })
                }
              />
              <MenuItem
                label="Valori prezzo max e min"
                checked={chartSettings.scales.showHighLowLabels}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showHighLowLabels: !chartSettings.scales.showHighLowLabels,
                    },
                  })
                }
              />
              <MenuItem
                label="Etichette Bid e Ask"
                checked={chartSettings.scales.showBidAskLabels}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showBidAskLabels: !chartSettings.scales.showBidAskLabels,
                    },
                  })
                }
              />
              <MenuItem
                label="Nome indicatori"
                checked={chartSettings.scales.showIndicatorNameLabels}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showIndicatorNameLabels:
                        !chartSettings.scales.showIndicatorNameLabels,
                    },
                  })
                }
              />
              <MenuItem
                label="Valore indicatori"
                checked={chartSettings.scales.showIndicatorValueLabels}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showIndicatorValueLabels:
                        !chartSettings.scales.showIndicatorValueLabels,
                    },
                  })
                }
              />
              <MenuItem
                label="Conto alla rovescia alla chiusura barra"
                checked={chartSettings.scales.showCountdown}
                onClick={() =>
                  updateChartSettings({
                    scales: { showCountdown: !chartSettings.scales.showCountdown },
                  })
                }
              />
              <div className="sc-ctx-sep" />
              <MenuItem
                label="Nessuna etichetta sovrapposta"
                checked={chartSettings.scales.noOverlappingLabels}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      noOverlappingLabels:
                        !chartSettings.scales.noOverlappingLabels,
                    },
                  })
                }
              />
              <MenuItem
                label="Valuta e unità"
                checked={chartSettings.scales.showCurrencyUnit}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showCurrencyUnit: !chartSettings.scales.showCurrencyUnit,
                    },
                  })
                }
              />
            </>
          )}

          {openSubmenu === 'lines' && (
            <>
              <MenuItem
                label="Linea quotazioni"
                checked={chartSettings.symbol.showLastPriceLine}
                onClick={() =>
                  updateChartSettings({
                    symbol: {
                      showLastPriceLine: !chartSettings.symbol.showLastPriceLine,
                    },
                  })
                }
              />
              <MenuItem
                label="Linee prezzo max e min"
                checked={Boolean(chartSettings.scales.showHighLowLines)}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showHighLowLines: !chartSettings.scales.showHighLowLines,
                    },
                  })
                }
              />
              <MenuItem
                label="Linee Bid e Ask"
                checked={chartSettings.scales.showBidAskLines}
                onClick={() =>
                  updateChartSettings({
                    scales: {
                      showBidAskLines: !chartSettings.scales.showBidAskLines,
                    },
                  })
                }
              />
              <MenuItem
                label="Linee alert"
                checked={chartSettings.alerts.showAlertLines}
                onClick={() =>
                  updateChartSettings({
                    alerts: {
                      showAlertLines: !chartSettings.alerts.showAlertLines,
                    },
                  })
                }
              />
            </>
          )}

          {openSubmenu === 'theme' && (
            <>
              <MenuItem
                label="Scuro"
                radio
                checked={theme === 'dark'}
                onClick={() => {
                  setTheme('dark');
                  onClose();
                }}
              />
              <MenuItem
                label="Chiaro"
                radio
                checked={theme === 'light'}
                onClick={() => {
                  setTheme('light');
                  onClose();
                }}
              />
            </>
          )}

          {openSubmenu === 'timezone' &&
            CHART_TIMEZONE_OPTIONS.map((tz) => (
              <MenuItem
                key={tz.value}
                label={tz.label}
                radio
                checked={chartSettings.symbol.timezone === tz.value}
                onClick={() => {
                  updateChartSettings({ symbol: { timezone: tz.value } });
                  onClose();
                }}
              />
            ))}

          {openSubmenu === 'dateFormat' &&
            CHART_DATE_FORMAT_OPTIONS.map((df) => (
              <MenuItem
                key={df.value}
                label={df.label}
                radio
                checked={chartSettings.scales.dateFormat === df.value}
                onClick={() => {
                  updateChartSettings({ scales: { dateFormat: df.value } });
                  onClose();
                }}
              />
            ))}

          {openSubmenu === 'order' && targetDrawing && (
            <>
              <MenuItem
                label="Porta in primo piano"
                onClick={() => {
                  bringToFront(targetDrawing.id, targetSymbol.ticker);
                  onClose();
                }}
              />
              <MenuItem
                label="Sposta in secondo piano"
                onClick={() => {
                  sendToBack(targetDrawing.id, targetSymbol.ticker);
                  onClose();
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

export default ChartContextMenu;
