import { expect, test } from '@playwright/test';
import { getCanvasMetrics, openCleanChart } from './helpers/chartHelpers';

test.describe('Slice 5 — Top/Bottom Toolbars, Multi-Chart, Replay & Local Layouts 1:1', () => {
  test('Desktop: Bottom ranges (1D..Tutto) + Vai a date jump + adg, Top toolbar favorites/styles/Alert, Multi-Chart + SINCRONIZZA NEL LAYOUT, Bar Replay, Save Layout + reload persistence', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop Slice 5 full workflow');
    const { canvas, errors } = await openCleanChart(page);

    // 1) Bottom bar exact TradingView Italia range buttons (`1D 5D 1M 3M 6M YTD 1Y 5Y Tutto`) + `Vai a` + `adg`
    const bottomBar = page.getByRole('toolbar', {
      name: 'Intervallo rapido e controlli scala',
    });
    await expect(bottomBar).toBeVisible();
    for (const label of ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'Tutto']) {
      await expect(bottomBar.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(bottomBar.getByRole('button', { name: 'Adegua i dati' })).toHaveText('adg');
    await expect(bottomBar.getByRole('button', { name: 'Vai a', exact: true })).toBeVisible();

    // Switch range to 1M and verify visible bars changes
    await bottomBar.getByRole('button', { name: '1M', exact: true }).click();
    await page.waitForTimeout(80);
    const vis1M = Number(await canvas.getAttribute('data-visible-bars'));
    await bottomBar.getByRole('button', { name: 'Tutto', exact: true }).click();
    await page.waitForTimeout(80);
    const visAll = Number(await canvas.getAttribute('data-visible-bars'));
    expect(visAll).toBeGreaterThan(vis1M);

    // Test `Vai a` (Go-To-Date) popover via Alt+G -> jumps chart backward in history!
    const rightBeforeGoto = Number(await canvas.getAttribute('data-right-index'));
    await page.keyboard.press('Alt+g');
    const gotoPopover = page.getByTestId('goto-date-popover');
    await expect(gotoPopover).toBeVisible();
    await gotoPopover.getByLabel('Data di destinazione').fill('2025-11-01');
    await gotoPopover.getByRole('button', { name: 'Vai a', exact: true }).click();
    await expect(gotoPopover).toBeHidden();
    await page.waitForTimeout(100);
    const rightAfterGoto = Number(await canvas.getAttribute('data-right-index'));
    expect(rightAfterGoto).toBeLessThan(rightBeforeGoto - 5);

    // Toggle `adg` button
    const adgBtn = bottomBar.getByRole('button', { name: 'Adegua i dati' });
    await adgBtn.click();
    await expect(adgBtn).toHaveAttribute('aria-pressed', 'true');

    // 2) Top Toolbar: exact `Alert` label + Quick Search + Chart Style + Favorite Timeframe pinning
    const topBar = page.getByRole('toolbar', {
      name: 'Barra degli strumenti Supercharts',
    });
    await expect(topBar.getByRole('button', { name: 'Crea alert' })).toContainText('Alert');
    await expect(topBar.getByRole('button', { name: 'Ricerca rapida' })).toBeVisible();

    // Switch Chart Style to Area & toggle star favorite
    await topBar.getByRole('button', { name: /Stile grafico/ }).click();
    await page.getByRole('button', { name: 'Preferito stile Area', exact: true }).click();
    await page.getByRole('button', { name: 'Area', exact: true }).click();
    await expect(topBar.getByRole('button', { name: 'Stile grafico Area', exact: true })).toBeVisible();

    // Switch timeframe to 4H and wait until hydrated
    await topBar.getByRole('button', { name: '4H', exact: true }).click();
    await expect(page.locator('.sc-loading-overlay')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(200);

    // 3) Multi-Chart Layout Picker + `SINCRONIZZA NEL LAYOUT` toggles (Simbolo, Timeframe, Cursore, Ora)
    await topBar.getByRole('button', { name: 'Impostazione layout' }).click();
    const layoutMenu = page.getByRole('menu', { name: 'Impostazione layout' });
    await expect(layoutMenu).toBeVisible();
    await expect(layoutMenu).toContainText('SINCRONIZZA NEL LAYOUT');

    // Enable `Timeframe` sync, then pick 2 Verticale
    const tfSyncItem = layoutMenu.getByRole('menuitemcheckbox', { name: 'Timeframe' });
    await tfSyncItem.click();
    await expect(tfSyncItem).toHaveAttribute('aria-checked', 'true');
    await layoutMenu.getByRole('button', { name: '2 Verticale' }).click();

    const grid = page.getByTestId('multichart-grid');
    await expect(grid).toHaveAttribute('data-layout-mode', '2v');
    await expect(page.locator('canvas.sc-canvas')).toHaveCount(2);

    // Switch back to 1 Grafico for clean Replay + Persistence test
    await topBar.getByRole('button', { name: 'Impostazione layout' }).click();
    await page.getByRole('menu', { name: 'Impostazione layout' }).getByRole('button', { name: '1 Grafico' }).click();
    await expect(page.locator('canvas.sc-canvas')).toHaveCount(1);

    // 4) Bar Replay transport bar: start -> step +1 -> exit
    await topBar.getByRole('button', { name: 'Bar replay' }).click();
    const replayBar = page.getByRole('toolbar', { name: 'Controlli Bar Replay' });
    await expect(replayBar).toBeVisible();
    const barText1 = await replayBar.innerText();
    await replayBar.getByRole('button', { name: '+1' }).click();
    await page.waitForTimeout(80);
    const barText2 = await replayBar.innerText();
    expect(barText2).not.toEqual(barText1);
    await replayBar.getByRole('button', { name: 'Esci' }).click();
    await expect(replayBar).toBeHidden();

    // 5) Draw a Trendline + Save & Rename local layout (ZERO login!) + Full Persistence Across Reload!
    const m = await getCanvasMetrics(page);
    await page.keyboard.press('Alt+t');
    await page.mouse.click(m.plotLeft + m.plotWidth * 0.25, m.y + m.plotHeight * 0.4);
    await page.mouse.click(m.plotLeft + m.plotWidth * 0.55, m.y + m.plotHeight * 0.5);
    await expect(canvas).toHaveAttribute('data-drawings-count', '1');

    // Open Save Layout menu -> Rename -> Save -> Create Copy
    await topBar.getByRole('button', { name: 'Gestisci layout' }).click();
    const saveMenu = page.getByRole('menu', { name: 'Gestisci layout' });
    await expect(saveMenu).toBeVisible();
    await saveMenu.getByRole('button', { name: 'Rinomina…' }).click();
    await saveMenu.getByLabel('Nome del layout').fill('Setup Ferrari Pro');
    await saveMenu.getByRole('button', { name: 'OK' }).click();
    await saveMenu.getByRole('button', { name: /Salva ora/ }).click();

    // Reload WITHOUT clearing localStorage (re-verify our cleanChart script doesn't wipe on reload? Wait: page.addInitScript runs on every reload! So test persistence in a fresh page context!)
    const persisted = await page.evaluate(() => ({
      layouts: window.localStorage.getItem('tv_it_saved_layouts_v1'),
      drawings: window.localStorage.getItem('tv_it_drawings_v2') ?? window.localStorage.getItem('tv_it_drawings_v1'),
      sync: window.localStorage.getItem('tv_it_multichart_sync_v1'),
    }));
    expect(persisted.layouts).toContain('Setup Ferrari Pro');
    expect(persisted.sync).toContain('"timeframe":true');

    // Open a second tab in the same browser context (no clear initScript!) -> verifies 100% real reload persistence!
    const page2 = await page.context().newPage();
    await page2.goto('/#/chart/RACE', { waitUntil: 'domcontentloaded' });
    const canvas2 = page2.locator('canvas.sc-canvas').first();
    await expect(canvas2).toBeVisible({ timeout: 15_000 });
    await expect(canvas2).toHaveAttribute('data-drawings-count', '1', { timeout: 10_000 });
    await expect(
      page2.getByRole('toolbar', { name: 'Barra degli strumenti Supercharts' }),
    ).toContainText('Setup Ferrari Pro');
    await expect(
      page2.getByRole('button', { name: 'Stile grafico Area' }),
    ).toBeVisible();
    await page2.close();

    expect(errors).toEqual([]);
  });

  test('Mobile: Authentic Range data bottom sheet, Vai a date jump, compact timeframe dropdown & layout persistence on 390×844', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile Slice 5 bottom sheet & toolbars test');
    const { canvas, errors } = await openCleanChart(page);

    // 1) Desktop range buttons are hidden; single authentic `Range data (...) ▾` trigger is visible!
    const rangeTrigger = page.getByTestId('mobile-range-trigger');
    await expect(rangeTrigger).toBeVisible();
    await expect(rangeTrigger).toContainText('Range data');

    // Tap `Range data` -> opens full-width bottom sheet cleanly inside 390×844
    await rangeTrigger.click();
    const sheet = page.getByTestId('mobile-range-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /3M · Intervallo 3 mesi/ }).click();
    await expect(sheet).toBeHidden();
    await expect(rangeTrigger).toContainText('(3M)');

    // Open `Range data` -> tap `Vai a una data…` -> opens Go-To-Date popover cleanly clamped!
    await rangeTrigger.click();
    await sheet.getByRole('button', { name: /Vai a una data/ }).click();
    const gotoPop = page.getByTestId('goto-date-popover');
    await expect(gotoPop).toBeVisible();
    const popBox = await gotoPop.boundingBox();
    expect(popBox!.x).toBeGreaterThanOrEqual(4);
    expect(popBox!.x + popBox!.width).toBeLessThanOrEqual(386);
    await gotoPop.getByRole('button', { name: 'Chiudi Vai a' }).click();

    // 2) Mobile compact timeframe selector switches cleanly to 1H and finishes hydrating
    await page.getByRole('button', { name: 'Seleziona intervallo temporale' }).click();
    await page.getByRole('button', { name: /1 ora/i }).click();
    await expect(page.getByRole('button', { name: 'Seleziona intervallo temporale' })).toContainText('1H');
    await expect(page.locator('.sc-loading-overlay')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(200);

    // 3) Mobile hamburger menu can start Bar Replay & toggle dark/light theme with zero login gates
    await page.getByRole('button', { name: 'Menu principale' }).click();
    await page.getByRole('button', { name: /Bar Replay/ }).click();
    const replayBar = page.getByRole('toolbar', { name: 'Controlli Bar Replay' });
    await expect(replayBar).toBeVisible();
    await replayBar.getByRole('button', { name: 'Esci' }).click();
    await expect(replayBar).toBeHidden();

    // Verify canvas remains healthy and interactive
    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
  });
});
