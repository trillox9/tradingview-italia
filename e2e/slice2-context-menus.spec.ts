import { expect, test } from '@playwright/test';
import {
  dispatchCanvasTouch,
  getCanvasMetrics,
  openCleanChart,
} from './helpers/chartHelpers';

test.describe('Slice 2 — Context Menus, Submenus & Price + 1:1', () => {
  test('Desktop: Price Axis right-click menu matches exact TradingView Italia items, submenus, toggles & Altre impostazioni deep-link', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop right-click context menu test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // Right-click on the Price Axis
    const pxX = m.plotRight + 24;
    const pxY = m.y + m.plotHeight * 0.45;
    await page.mouse.click(pxX, pxY, { button: 'right' });

    const menu = page.getByTestId('ctx-menu-price_axis');
    await expect(menu).toBeVisible();

    const menuText = await menu.innerText();

    // Verify exact TradingView Italia labels
    expect(menuText).toContain('Ripristina scala prezzi');
    expect(menuText).toContain('Auto (adatta dati a schermo)');
    expect(menuText).toContain('Blocca rapporto prezzo/barra');
    expect(menuText).toContain('Utilizza solo scala del prezzo');
    expect(menuText).toContain('Inverti asse');
    expect(menuText).toContain('Regolare');
    expect(menuText).toContain('Percentuale');
    expect(menuText).toContain('Indicizzata a base 100');
    expect(menuText).toContain('Logaritmica');
    expect(menuText).toContain('Sposta asse a sinistra');
    expect(menuText).toContain('Etichette');
    expect(menuText).toContain('Linee');
    expect(menuText).toContain('Pulsante "+"');
    expect(menuText).toContain('Altre impostazioni…');

    // Verify NO forbidden Trading/Community/ObjectTree items
    expect(menuText).not.toMatch(/Vendi limite|Compra limite|Albero oggetti|Finestra dati|Posizioni sul grafico|Ordini sul grafico/i);

    // Dynamic price-to-bar ratio badge (Italian decimal comma)
    const lockItem = menu.getByRole('menuitemcheckbox', {
      name: /Blocca rapporto prezzo\/barra/,
    });
    await expect(lockItem).toContainText(/\d+,\d{2,4}/);

    // Hover Etichette -> opens submenu cleanly inside viewport
    await menu.getByRole('menuitem', { name: 'Etichette' }).hover();
    const labelsSub = page.getByTestId('ctx-submenu-labels');
    await expect(labelsSub).toBeVisible();
    await expect(labelsSub).toContainText('Valori prezzo max e min');
    await expect(labelsSub).toContainText('Conto alla rovescia alla chiusura barra');
    const subBox = await labelsSub.boundingBox();
    expect(subBox!.x).toBeGreaterThanOrEqual(4);
    expect(subBox!.x + subBox!.width).toBeLessThanOrEqual(1436);

    // Toggle High/Low labels
    const hlLabelItem = labelsSub.getByRole('menuitemcheckbox', {
      name: 'Valori prezzo max e min',
    });
    await expect(hlLabelItem).toHaveAttribute('aria-checked', 'false');
    await hlLabelItem.click();
    await expect(hlLabelItem).toHaveAttribute('aria-checked', 'true');

    // Hover Linee -> verify zero Trading entries & toggle High/Low lines
    await menu.getByRole('menuitem', { name: 'Linee' }).hover();
    const linesSub = page.getByTestId('ctx-submenu-lines');
    await expect(linesSub).toBeVisible();
    const linesText = await linesSub.innerText();
    expect(linesText).toContain('Linea quotazioni');
    expect(linesText).toContain('Linee prezzo max e min');
    expect(linesText).toContain('Linee Bid e Ask');
    expect(linesText).toContain('Linee alert');
    expect(linesText).not.toMatch(/Posizioni|Ordini/i);

    // Switch to Log scale from Price Axis menu
    await menu.getByRole('menuitemradio', { name: /Logaritmica/ }).click();
    await expect(menu).toBeHidden();
    await expect(canvas).toHaveAttribute('data-scale-mode', 'log');

    // Re-open via bottom-right corner gear button and move price axis to left
    await page.getByRole('button', { name: 'Impostazioni scala prezzi' }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Sposta asse a sinistra' }).click();
    await expect(canvas).toHaveAttribute('data-price-scale-pos', 'left');

    // Re-open via corner gear and click `Altre impostazioni…` -> opens `Scale e linee` tab directly!
    await page.getByRole('button', { name: 'Impostazioni scala prezzi' }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Altre impostazioni…' }).click();
    const settingsDialog = page.getByRole('dialog', { name: 'Impostazioni grafico' });
    await expect(settingsDialog).toBeVisible();
    await expect(
      settingsDialog.getByRole('tab', { name: 'Scale e linee' }),
    ).toHaveAttribute('aria-selected', 'true');
    await settingsDialog.getByRole('button', { name: 'Chiudi' }).click();
    await expect(settingsDialog).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Desktop: Main Canvas right-click, Time Axis right-click, and Price Axis + quick menu', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop main/time/+ context menus');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // 1) Main Canvas right-click
    const cx = m.plotLeft + m.plotWidth * 0.5;
    const cy = m.y + m.plotHeight * 0.45;
    await page.mouse.click(cx, cy, { button: 'right' });

    const canvasMenu = page.getByTestId('ctx-menu-canvas');
    await expect(canvasMenu).toBeVisible();
    const canvasText = await canvasMenu.innerText();
    expect(canvasText).toContain('Reimposta la visualizzazione del grafico');
    expect(canvasText).toContain('Copia prezzo');
    expect(canvasText).toContain('Incolla');
    expect(canvasText).toContain('Aggiungi alert su');
    expect(canvasText).toContain('Disegna linea orizzontale');
    expect(canvasText).toContain('Nascondi disegni');
    expect(canvasText).toContain('Tema colore');
    expect(canvasText).toContain('Impostazioni…');
    expect(canvasText).not.toMatch(/Vendi limite|Compra limite|Albero oggetti|Finestra dati/i);

    // Place horizontal line directly from Main Canvas menu -> drawings count becomes 1
    await canvasMenu.getByRole('menuitem', { name: /Disegna linea orizzontale/ }).click();
    await expect(canvasMenu).toBeHidden();
    await expect(canvas).toHaveAttribute('data-drawings-count', '1');

    // 2) Time Axis right-click -> 12 timezones + 4 date formats
    const taX = m.plotLeft + m.plotWidth * 0.4;
    const taY = m.y + m.height - 12;
    await page.mouse.click(taX, taY, { button: 'right' });
    const timeMenu = page.getByTestId('ctx-menu-time_axis');
    await expect(timeMenu).toBeVisible();
    await timeMenu.getByRole('menuitem', { name: 'Fuso orario' }).hover();
    const tzSub = page.getByTestId('ctx-submenu-timezone');
    await expect(tzSub).toBeVisible();
    expect(await tzSub.getByRole('menuitemradio').count()).toBe(12);
    await tzSub.getByRole('menuitemradio', { name: /New York/ }).click();
    await expect(timeMenu).toBeHidden();

    // Verify Date Format submenu has 4 formats including MM/GG/AAAA
    await page.mouse.click(taX, taY, { button: 'right' });
    await expect(timeMenu).toBeVisible();
    await timeMenu.getByRole('menuitem', { name: 'Formato data' }).hover();
    const dfSub = page.getByTestId('ctx-submenu-dateFormat');
    await expect(dfSub).toBeVisible();
    expect(await dfSub.getByRole('menuitemradio').count()).toBe(4);
    await dfSub.getByRole('menuitemradio', { name: 'MM/GG/AAAA' }).click();
    await expect(timeMenu).toBeHidden();

    // 3) Hover over main plot so floating `+` button renders on Price Axis left edge, then click `+`
    const hoverY = m.y + m.plotHeight * 0.35;
    await page.mouse.move(cx, hoverY);
    await page.waitForTimeout(120);
    // `+` button is drawn at priceAxisLeft + 2 = plotRight + 2 (wait: let's click right on plotRight edge)
    const plusClickX = await page.evaluate(() => {
      const c = document.querySelector('canvas.sc-canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      // Scan horizontally near the price axis boundary for the floating '+' button center
      return r.right - 64;
    });
    // Move slightly onto the '+' area and verify cursor becomes pointer, or scan around plotRight - 10 .. plotRight + 8
    let openedPlus = false;
    for (const dx of [-10, -4, 0, 4, -14, -18]) {
      const testX = m.plotRight + dx;
      await page.mouse.move(cx, hoverY);
      await page.waitForTimeout(40);
      await page.mouse.move(testX, hoverY);
      await page.waitForTimeout(40);
      const cursor = await canvas.evaluate((el) => getComputedStyle(el).cursor);
      if (cursor === 'pointer') {
        await page.mouse.click(testX, hoverY);
        openedPlus = true;
        break;
      }
    }
    expect(plusClickX).toBeGreaterThan(0);
    expect(openedPlus).toBe(true);

    const plusMenu = page.getByTestId('ctx-menu-price_plus');
    await expect(plusMenu).toBeVisible();
    const plusText = await plusMenu.innerText();
    expect(plusText).toContain('Aggiungi alert su');
    expect(plusText).toContain('Disegna linea orizzontale');
    expect(plusText).toContain('Copia prezzo');
    expect(plusText).not.toMatch(/Compra Limite|Vendi Limite/i);

    await plusMenu.getByRole('menuitem', { name: /Aggiungi alert su/ }).click();
    await expect(plusMenu).toBeHidden();
    await expect(page.getByRole('status')).toContainText(/Alert creato/);

    expect(errors).toEqual([]);
  });

  test('Mobile: Price Axis long-press & corner gear open clamped context menu + submenus inside 390×844 viewport', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile touch context menu test');
    const { canvas, errors } = await openCleanChart(page);
    const m = await getCanvasMetrics(page);

    // 1) Long-press on Price Axis (hold > 550ms) -> opens Price Axis context menu
    const pxX = m.plotRight + 24;
    const pxY = m.y + m.plotHeight * 0.45;
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: pxX, y: pxY }]);
    await page.waitForTimeout(650);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: pxX, y: pxY }]);

    const menu = page.getByTestId('ctx-menu-price_axis');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(4);
    expect(box!.x + box!.width).toBeLessThanOrEqual(386);
    expect(box!.y + box!.height).toBeLessThanOrEqual(840);

    // Tap Etichette submenu on Mobile -> opens cleanly clamped inside 390px
    await menu.getByRole('menuitem', { name: 'Etichette' }).click();
    const labelsSub = page.getByTestId('ctx-submenu-labels');
    await expect(labelsSub).toBeVisible();
    const subBox = await labelsSub.boundingBox();
    expect(subBox!.x).toBeGreaterThanOrEqual(4);
    expect(subBox!.x + subBox!.width).toBeLessThanOrEqual(386);

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // 2) Corner gear button works on Mobile and toggles Inverti asse
    await page.getByRole('button', { name: 'Impostazioni scala prezzi' }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitemcheckbox', { name: /Inverti asse/ }).click();
    await expect(canvas).toHaveAttribute('data-invert-scale', 'true');

    expect(errors).toEqual([]);
  });
});
