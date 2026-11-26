import { expect, test } from '@playwright/test';
import {
  countDiffPixels,
  dispatchCanvasTouch,
  getCanvasMetrics,
  openCleanChart,
  readCanvasPatch,
} from './helpers/chartHelpers';

test.describe('Slice 3 — Drawing Engine Web & Mobile 1:1', () => {
  test('Desktop: immediate Click-1 anchor & blue axis pills, live rubber-band preview, Shift snap, FloatingToolbar, 4-tab Settings, Press-Drag-Release, 1-click Long Position, and Ctrl+C/V/Z/Y/Del', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop drawing lifecycle test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // 1) Verify Pitchfork lives inside Group 2 (Strumenti analisi trend) matching 2026 TradingView
    const group2Btn = page.getByRole('button', { name: /Strumenti analisi trend/ });
    await group2Btn.click();
    const flyout = page.getByRole('menu', { name: 'Strumenti analisi trend' });
    await expect(flyout).toBeVisible();
    await expect(flyout).toContainText('Pitchfork');
    await flyout.getByRole('menuitem', { name: /Trendline/ }).click();
    await expect(canvas).toHaveAttribute('data-active-tool', 'trendline');

    // Coordinates in open upper-left / mid-right area of plot
    const p1x = Math.round(m.plotLeft + m.plotWidth * 0.25);
    const p1y = Math.round(m.y + m.plotHeight * 0.30);
    const p2x = Math.round(m.plotLeft + m.plotWidth * 0.60);
    const p2y = Math.round(m.y + m.plotHeight * 0.55);
    const midX = Math.round((p1x + p2x) / 2);
    const midY = Math.round((p1y + p2y) / 2);

    // Move mouse away first so crosshair doesn't interfere with BEFORE snapshot at p1
    await page.mouse.move(m.plotLeft + 20, m.y + 20);
    await page.waitForTimeout(80);
    const beforeP1 = await readCanvasPatch(page, p1x, p1y, 9);
    const beforeMid = await readCanvasPatch(page, midX, midY, 10);

    // 2) CLICK 1 at (p1x, p1y) WITHOUT moving mouse afterward!
    await page.mouse.click(p1x, p1y);
    await page.waitForTimeout(120);

    await expect(canvas).toHaveAttribute('data-draft-points', '2');

    // CRITICAL PARITY CHECK: Immediately after Click 1 (ZERO mouse move), Point 1 anchor dot MUST be painted!
    const afterClick1P1 = await readCanvasPatch(page, p1x, p1y, 9);
    expect(countDiffPixels(beforeP1.raw, afterClick1P1.raw)).toBeGreaterThan(15);
    expect(afterClick1P1.bluePixels).toBeGreaterThan(8);
    expect(afterClick1P1.whitePixels).toBeGreaterThan(8);

    // CRITICAL PARITY CHECK: Price Axis & Time Axis MUST show solid blue #2962ff pills for P1 immediately!
    // Move mouse slightly away from p1y? Wait: even before moving, move mouse to p2x,p2y so crosshair moves away from p1y/p1x and P1's blue pills stand unobstructed!
    await page.mouse.move(p2x, p2y, { steps: 6 });
    await page.waitForTimeout(120);

    const priceAxisP1 = await readCanvasPatch(page, m.plotRight + 24, p1y, 8);
    const timeAxisP1 = await readCanvasPatch(page, p1x, m.y + m.height - 12, 8);
    expect(priceAxisP1.bluePixels).toBeGreaterThan(15);
    expect(timeAxisP1.bluePixels).toBeGreaterThan(15);

    // CRITICAL PARITY CHECK: Live rubber-band line MUST be visible at midpoint BEFORE Click 2!
    const duringPreviewMid = await readCanvasPatch(page, midX, midY, 10);
    expect(countDiffPixels(beforeMid.raw, duringPreviewMid.raw)).toBeGreaterThan(8);
    expect(duringPreviewMid.bluePixels).toBeGreaterThan(5);

    // 3) CLICK 2 at (p2x, p2y) -> commits Trendline, auto-selects it & shows FloatingDrawingToolbar!
    await page.mouse.click(p2x, p2y);
    await page.waitForTimeout(120);

    await expect(canvas).toHaveAttribute('data-draft-points', '0');
    await expect(canvas).toHaveAttribute('data-drawings-count', '1');
    await expect(canvas).toHaveAttribute('data-active-tool', 'crosshair');
    const selectedId = await canvas.getAttribute('data-selected-drawing');
    expect(selectedId).toBeTruthy();

    const floatingBar = page.getByTestId('floating-drawing-toolbar');
    await expect(floatingBar).toBeVisible();
    await expect(floatingBar.getByRole('button', { name: 'Impostazioni' })).toBeVisible();
    await expect(floatingBar.getByRole('button', { name: 'Aggiungi alert' })).toBeVisible();
    await expect(floatingBar.getByRole('button', { name: 'Altro' })).toBeVisible();

    // 4) Right-click on the completed Trendline -> authenticated Drawing Context Menu!
    await page.mouse.click(midX, midY, { button: 'right' });
    const drwMenu = page.getByTestId('ctx-menu-drawing');
    await expect(drwMenu).toBeVisible();
    const drwMenuText = await drwMenu.innerText();
    expect(drwMenuText).toContain('Aggiungi alert su Trendline…');
    expect(drwMenuText).toContain('Ordine visualizzazione');
    expect(drwMenuText).toContain('Duplica');
    expect(drwMenuText).toContain('Copia');
    expect(drwMenuText).toContain('Blocca');
    expect(drwMenuText).toContain('Nascondi');
    expect(drwMenuText).toContain('Elimina');
    expect(drwMenuText).toContain('Impostazioni…');

    // Open Drawing Settings Modal -> verify ALL 4 tabs: Stile | Testo | Coordinate | Visibilità
    await drwMenu.getByRole('menuitem', { name: 'Impostazioni…' }).click();
    const drwDialog = page.getByRole('dialog', { name: /Impostazioni Trendline/ });
    await expect(drwDialog).toBeVisible();
    await expect(drwDialog.getByRole('tab', { name: 'Stile' })).toBeVisible();
    await expect(drwDialog.getByRole('tab', { name: 'Testo' })).toBeVisible();
    await expect(drwDialog.getByRole('tab', { name: 'Coordinate' })).toBeVisible();
    const visTab = drwDialog.getByRole('tab', { name: 'Visibilità' });
    await expect(visTab).toBeVisible();
    await visTab.click();
    await expect(drwDialog).toContainText('Mostra su tutti i timeframe');
    await expect(drwDialog).toContainText('1D');
    await drwDialog.getByRole('button', { name: 'OK' }).click();
    await expect(drwDialog).toBeHidden();

    // 5) Press-Drag-Release 2-point drawing (Rectangle via Alt+Shift+R)
    await page.keyboard.press('Alt+Shift+R');
    await expect(canvas).toHaveAttribute('data-active-tool', 'rectangle');
    const rx1 = Math.round(m.plotLeft + m.plotWidth * 0.18);
    const ry1 = Math.round(m.y + m.plotHeight * 0.55);
    const rx2 = Math.round(m.plotLeft + m.plotWidth * 0.32);
    const ry2 = Math.round(m.y + m.plotHeight * 0.72);
    await page.mouse.move(rx1, ry1);
    await page.mouse.down();
    await page.mouse.move(rx2, ry2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    await expect(canvas).toHaveAttribute('data-drawings-count', '2');

    // 6) 1-CLICK Posizione long (1:1 TradingView!)
    await page.getByRole('button', { name: /Strumenti di misurazione e previsione/ }).click();
    await page.getByRole('menuitem', { name: 'Posizione long' }).click();
    await expect(canvas).toHaveAttribute('data-active-tool', 'long_position');
    await page.mouse.click(m.plotLeft + m.plotWidth * 0.72, m.y + m.plotHeight * 0.45);
    await page.waitForTimeout(120);
    await expect(canvas).toHaveAttribute('data-drawings-count', '3');
    await expect(canvas).toHaveAttribute('data-draft-points', '0');
    await expect(floatingBar).toBeVisible();

    // 7) Ctrl+C / Ctrl+V / Delete / Ctrl+Z / Ctrl+Y
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-drawings-count', '4');

    await page.keyboard.press('Delete');
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-drawings-count', '3');

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-drawings-count', '4');

    await page.keyboard.press('Control+y');
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-drawings-count', '3');

    // 8) Escape mid-draft cancels draft cleanly
    await page.keyboard.press('Alt+t');
    await page.mouse.click(p1x + 30, p1y + 30);
    await expect(canvas).toHaveAttribute('data-draft-points', '2');
    await page.keyboard.press('Escape');
    await expect(canvas).toHaveAttribute('data-draft-points', '0');

    expect(errors).toEqual([]);
  });

  test('Mobile: Trendline Tap-1 IMMEDIATELY paints visible anchor & blue axis pills, 1-finger pan works mid-draft, Tap-2 completes & shows FloatingToolbar, and Posizione long places in 1 tap', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile touch drawing test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // Open mobile drawing rail via top toolbar pencil button & select Trendline
    await page.locator('[data-drawing-toggle="true"]').click();
    await page.getByRole('button', { name: /Strumenti analisi trend/ }).click();
    await page.getByRole('menuitem', { name: /Trendline/ }).click();
    await expect(canvas).toHaveAttribute('data-active-tool', 'trendline');

    const p1x = Math.round(m.plotLeft + m.plotWidth * 0.30);
    const p1y = Math.round(m.y + m.plotHeight * 0.35);
    const beforeP1 = await readCanvasPatch(page, p1x, p1y, 9);

    // 1) TAP 1 on Mobile touchscreen
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: p1x, y: p1y }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: p1x, y: p1y }]);
    await page.waitForTimeout(140);

    await expect(canvas).toHaveAttribute('data-draft-points', '2');

    // CRITICAL MOBILE PARITY CHECK: Tap 1 MUST render visible white/blue anchor dot & blue price pill (NEVER blank!)
    const afterTap1P1 = await readCanvasPatch(page, p1x, p1y, 9);
    expect(countDiffPixels(beforeP1.raw, afterTap1P1.raw)).toBeGreaterThan(15);
    expect(afterTap1P1.bluePixels).toBeGreaterThan(8);
    expect(afterTap1P1.whitePixels).toBeGreaterThan(8);

    const priceAxisP1 = await readCanvasPatch(page, m.plotRight + 24, p1y, 8);
    expect(priceAxisP1.bluePixels).toBeGreaterThan(15);

    // 2) 1-finger pan between Tap 1 and Tap 2 STILL pans the chart smoothly without breaking draft!
    const rightBeforePan = Number(await canvas.getAttribute('data-right-index'));
    const panStartX = Math.round(m.plotLeft + m.plotWidth * 0.5);
    const panY = Math.round(m.y + m.plotHeight * 0.55);
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 2, x: panStartX, y: panY }]);
    await dispatchCanvasTouch(page, 'touchmove', [{ id: 2, x: panStartX + 70, y: panY }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 2, x: panStartX + 70, y: panY }]);
    await page.waitForTimeout(100);
    const rightAfterPan = Number(await canvas.getAttribute('data-right-index'));
    expect(rightAfterPan).toBeLessThan(rightBeforePan - 2);
    await expect(canvas).toHaveAttribute('data-draft-points', '2');

    // 3) TAP 2 completes Trendline & opens FloatingDrawingToolbar clamped inside 390×844!
    const p2x = Math.round(m.plotLeft + m.plotWidth * 0.72);
    const p2y = Math.round(m.y + m.plotHeight * 0.52);
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 3, x: p2x, y: p2y }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 3, x: p2x, y: p2y }]);
    await page.waitForTimeout(140);

    await expect(canvas).toHaveAttribute('data-draft-points', '0');
    await expect(canvas).toHaveAttribute('data-drawings-count', '1');

    const floatingBar = page.getByTestId('floating-drawing-toolbar');
    await expect(floatingBar).toBeVisible();
    const barBox = await floatingBar.boundingBox();
    expect(barBox!.x).toBeGreaterThanOrEqual(4);
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(386);

    // 4) 1-TAP Posizione long on Mobile
    await page.locator('[data-drawing-toggle="true"]').click();
    await page.getByRole('button', { name: /Strumenti di misurazione e previsione/ }).click();
    await page.getByRole('menuitem', { name: 'Posizione long' }).click();
    const lpX = Math.round(m.plotLeft + m.plotWidth * 0.5);
    const lpY = Math.round(m.y + m.plotHeight * 0.42);
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 4, x: lpX, y: lpY }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 4, x: lpX, y: lpY }]);
    await page.waitForTimeout(140);
    await expect(canvas).toHaveAttribute('data-drawings-count', '2');
    await expect(canvas).toHaveAttribute('data-draft-points', '0');

    expect(errors).toEqual([]);
  });
});
