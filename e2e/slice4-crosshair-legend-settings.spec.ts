import { expect, test } from '@playwright/test';
import {
  dispatchCanvasTouch,
  getCanvasMetrics,
  openCleanChart,
} from './helpers/chartHelpers';

test.describe('Slice 4 — Crosshair, Legend & Settings 1:1', () => {
  test('Desktop: Crosshair bar-center snap + live OHLC/Vol legend, collapsible legend toggler, Indicator Settings 3 tabs + Annulla rollback, and Chart Settings 5 tabs + navButtonsMode + Annulla rollback', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop crosshair/legend/settings test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // 1) Crosshair X bar-center snap & live OHLC + Vol legend updates
    const ohlcRow = page.getByTestId('ohlc-legend');
    await expect(ohlcRow).toBeVisible();
    await expect(ohlcRow).toContainText('O');
    await expect(ohlcRow).toContainText('H');
    await expect(ohlcRow).toContainText('L');
    await expect(ohlcRow).toContainText('C');

    const yMid = Math.round(m.y + m.plotHeight * 0.45);
    const x1 = Math.round(m.plotLeft + m.plotWidth * 0.35);
    const x2 = Math.round(m.plotLeft + m.plotWidth * 0.65);

    await page.mouse.move(x1, yMid);
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-crosshair-visible', 'true');
    const bar1 = Number(await canvas.getAttribute('data-crosshair-bar'));
    const close1 = await page.getByTestId('ohlc-close').innerText();

    await page.mouse.move(x2, yMid);
    await page.waitForTimeout(80);
    const bar2 = Number(await canvas.getAttribute('data-crosshair-bar'));
    const close2 = await page.getByTestId('ohlc-close').innerText();

    expect(bar2).toBeGreaterThan(bar1 + 5);
    expect(close1).not.toEqual('');
    expect(close2).not.toEqual('');

    // Virtual future whitespace crosshair tracking (past rightmost bar)
    const xFuture = Math.round(m.plotRight - 14);
    await page.mouse.move(xFuture, yMid);
    await page.waitForTimeout(80);
    const barFuture = Number(await canvas.getAttribute('data-crosshair-bar'));
    expect(barFuture).toBeGreaterThan(bar2);

    // 2) Collapsible indicator legend toggler [ ^ ] / [ v N ]
    const indList = page.getByTestId('legend-indicators-list');
    const toggler = page.getByTestId('legend-toggler');
    await expect(indList).toBeVisible();
    await toggler.click();
    await expect(indList).toBeHidden();
    await expect(toggler).toHaveAttribute('aria-expanded', 'false');
    await toggler.click();
    await expect(indList).toBeVisible();

    // 3) Add SMA indicator -> open Indicator Settings (3 tabs Input/Stile/Visibilità) + Annulla rollback
    await page.getByRole('button', { name: 'Indicatori, metriche e strategie' }).click();
    const indModal = page.getByRole('dialog');
    await expect(indModal).toBeVisible();
    await indModal.getByPlaceholder(/Cerca/i).fill('SMA');
    const smaRow = indModal.locator('.tvm-indicator-row').first();
    await expect(smaRow).toBeVisible();
    const addBtn = smaRow.getByRole('button', { name: 'Aggiungi' });
    if (await addBtn.isVisible()) {
      await addBtn.click();
    }
    await indModal.getByRole('button', { name: 'Chiudi' }).click();

    const smaSettingsBtn = page.getByRole('button', { name: /Impostazioni.*SMA/i }).first();
    await expect(smaSettingsBtn).toBeVisible();
    await smaSettingsBtn.click();

    const indSettingsDialog = page.getByRole('dialog', { name: /Impostazioni/i });
    await expect(indSettingsDialog).toBeVisible();
    await expect(indSettingsDialog.getByRole('tab', { name: 'Input' })).toBeVisible();
    await expect(indSettingsDialog.getByRole('tab', { name: 'Stile' })).toBeVisible();
    await expect(indSettingsDialog.getByRole('tab', { name: 'Visibilità' })).toBeVisible();

    // Change length live -> Annulla reverts it!
    const lenInput = indSettingsDialog.locator('input[type="number"]').first();
    const origLen = await lenInput.inputValue();
    await lenInput.fill('55');
    await indSettingsDialog.getByRole('button', { name: 'Annulla' }).click();
    await expect(indSettingsDialog).toBeHidden();

    // Re-open and confirm original length was restored by Annulla!
    await smaSettingsBtn.click();
    await expect(indSettingsDialog.locator('input[type="number"]').first()).toHaveValue(origLen);
    await indSettingsDialog.locator('input[type="number"]').first().fill('50');
    await indSettingsDialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByTestId('legend-indicators-list')).toContainText('50');

    // 4) Chart Settings Modal: 5 clean tabs (zero Trading tab!), navButtonsMode + Annulla rollback
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
    const settingsDialog = page.getByRole('dialog', { name: 'Impostazioni grafico' });
    await expect(settingsDialog).toBeVisible();

    const tabNames = await settingsDialog.getByRole('tab').allInnerTexts();
    expect(tabNames).toEqual(['Simbolo', 'Legenda', 'Scale e linee', 'Canvas', 'Alert']);

    // Test Canvas -> Pulsanti di navigazione = Sempre invisibile -> hides nav controls live!
    await settingsDialog.getByRole('tab', { name: 'Canvas' }).click();
    const navSelect = settingsDialog.getByLabel('Pulsanti di navigazione');
    await navSelect.selectOption('never');
    await expect(page.getByTestId('chart-nav-controls')).toHaveCount(0);

    // Clicking Annulla reverts navButtonsMode cleanly!
    await settingsDialog.getByRole('button', { name: 'Annulla' }).click();
    await expect(settingsDialog).toBeHidden();
    await expect(page.getByTestId('chart-nav-controls')).toHaveCount(1);

    // Re-open, set to Sempre visibile & OK
    await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
    await settingsDialog.getByRole('tab', { name: 'Canvas' }).click();
    await settingsDialog.getByLabel('Pulsanti di navigazione').selectOption('always');
    await settingsDialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByTestId('chart-nav-controls')).toHaveClass(/sc-nav-controls--always/);

    expect(errors).toEqual([]);
  });

  test('Mobile: Compact C-only legend, collapsible legend toggler, long-press inspect mode + Valori visualizzati al tocco prolungato toggle', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile crosshair & legend test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // 1) Compact legend on 390×844 hides verbose O/H/L, keeps C visible
    await expect(page.getByTestId('ohlc-close')).toBeVisible();
    await expect(page.getByTestId('ohlc-open')).toBeHidden();

    // Collapsible indicator legend toggler works cleanly on Mobile
    const indList = page.getByTestId('legend-indicators-list');
    const toggler = page.getByTestId('legend-toggler');
    await expect(indList).toBeVisible();
    await toggler.click();
    await expect(indList).toBeHidden();
    await toggler.click();
    await expect(indList).toBeVisible();

    // 2) Long-press (320ms) activates Mobile Crosshair Inspect Mode, scrub updates bar, lift dismisses cleanly!
    const px = Math.round(m.plotLeft + m.plotWidth * 0.45);
    const py = Math.round(m.y + m.plotHeight * 0.45);
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: px, y: py }]);
    await page.waitForTimeout(320);
    await expect(canvas).toHaveAttribute('data-crosshair-visible', 'true');
    const barHeld = Number(await canvas.getAttribute('data-crosshair-bar'));

    // Scrub right while holding -> bar increases
    await dispatchCanvasTouch(page, 'touchmove', [{ id: 1, x: px + 55, y: py }]);
    await page.waitForTimeout(60);
    const barScrubbed = Number(await canvas.getAttribute('data-crosshair-bar'));
    expect(barScrubbed).toBeGreaterThan(barHeld);

    // Lift finger -> crosshair cleanly dismissed (zero stuck pills!)
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: px + 55, y: py }]);
    await page.waitForTimeout(80);
    await expect(canvas).toHaveAttribute('data-crosshair-visible', 'false');

    // 3) Disable `Valori visualizzati al tocco prolungato` in Group 1 Cursori -> long-press does NOT show crosshair!
    await page.locator('[data-drawing-toggle="true"]').click();
    await page.getByRole('button', { name: /Cursori/ }).click();
    const lpCheckbox = page.getByLabel('Valori visualizzati al tocco prolungato');
    await expect(lpCheckbox).toBeChecked();
    await lpCheckbox.uncheck();
    // Dismiss drawing overlay
    await page.locator('.sc-dt-mobile-backdrop').click({ force: true });

    await dispatchCanvasTouch(page, 'touchstart', [{ id: 2, x: px, y: py }]);
    await page.waitForTimeout(340);
    await expect(canvas).toHaveAttribute('data-crosshair-visible', 'false');
    await dispatchCanvasTouch(page, 'touchend', [{ id: 2, x: px, y: py }]);

    expect(errors).toEqual([]);
  });
});
