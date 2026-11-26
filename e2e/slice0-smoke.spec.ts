import { expect, test } from '@playwright/test';
import { getCanvasMetrics, openCleanChart } from './helpers/chartHelpers';

test.describe('Slice 0 — Clean Scope & Edge-to-Edge Supercharts Smoke', () => {
  test('loads pure Supercharts workspace with zero community, news, trade, right-rail, or login gates', async ({
    page,
  }, testInfo) => {
    const { errors } = await openCleanChart(page, '#/chart/RACE');

    // Edge-to-edge canvas renders with substantial area
    const metrics = await getCanvasMetrics(page);
    const vp = page.viewportSize()!;
    expect(metrics.width).toBeGreaterThan(vp.width * 0.75);
    expect(metrics.height).toBeGreaterThan(vp.height * 0.7);

    // Zero unwanted right-rail, right sidebar, bottom drawer, or Trade/Buy/Sell UI
    await expect(page.locator('.tv-right-sidebar')).toHaveCount(0);
    await expect(page.locator('.tv-bottom-drawer')).toHaveCount(0);
    await expect(page.locator('.sc-trade-pill')).toHaveCount(0);
    await expect(page.locator('.sc-buysell-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trade', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lista titoli' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Albero degli oggetti' })).toHaveCount(0);

    // Zero login/registration gates or community/news links in main UI
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/Registrati gratis|Sblocca tutti i disegni|Pronto a fare trading/i);
    expect(bodyText).not.toMatch(/Community|Notizie|Pannello di trading|Screener azioni/i);

    // Open hamburger menu -> verify zero community/watchlist/screener/heatmap entries
    await page.getByRole('button', { name: 'Menu principale' }).click();
    const menuText = await page.locator('[role="menu"]').first().innerText();
    expect(menuText).toContain('Tema scuro');
    expect(menuText).toContain('Pannello disegni');
    expect(menuText).not.toMatch(/Lista titoli|Albero degli oggetti|Finestra dati|Screener|Mappa di calore|Community|Notizie/i);
    await page.keyboard.press('Escape');

    // Open Chart Settings -> verify zero Trading tab
    if (testInfo.project.name === 'desktop') {
      await page.getByRole('button', { name: 'Impostazioni', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Impostazioni grafico' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Simbolo' })).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Legenda' })).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Scale e linee' })).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Canvas' })).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Alert' })).toBeVisible();
      await expect(dialog.getByRole('tab', { name: 'Trading' })).toHaveCount(0);
      await page.keyboard.press('Escape');
    }

    expect(errors).toEqual([]);
  });
});
