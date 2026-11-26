import { expect, test } from '@playwright/test';
import {
  dispatchCanvasTouch,
  getCanvasMetrics,
  openCleanChart,
} from './helpers/chartHelpers';

test.describe('Slice 1 — Viewport, Zoom, Pan & Axes 1:1 (Desktop + Mobile)', () => {
  test('Desktop: plain wheel anchors right edge, Ctrl+wheel anchors cursor, Shift+wheel pans, and axis drags/dblclick match TradingView 1:1', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop pointer/wheel physics');
    const { canvas, errors } = await openCleanChart(page, '#/chart/RACE');
    const m = await getCanvasMetrics(page);

    const readVp = async () => ({
      visibleBars: Number(await canvas.getAttribute('data-visible-bars')),
      rightIndex: Number(await canvas.getAttribute('data-right-index')),
      barSpacing: Number(await canvas.getAttribute('data-bar-spacing')),
      autoScale: (await canvas.getAttribute('data-auto-scale')) === 'true',
    });

    const base = await readVp();
    expect(base.autoScale).toBe(true);
    expect(base.barSpacing).toBeGreaterThan(4);

    // 1) Plain wheel ZOOM IN at LEFT side (x = 30%): barSpacing INCREASES and rightIndex STAYS PINNED!
    const x30 = m.plotLeft + m.plotWidth * 0.3;
    const midY = m.y + m.plotHeight * 0.5;
    await page.mouse.move(x30, midY);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(120);
    const afterPlainZoom = await readVp();
    expect(afterPlainZoom.visibleBars).toBeLessThan(base.visibleBars * 0.8);
    expect(afterPlainZoom.barSpacing).toBeGreaterThan(base.barSpacing * 1.2);
    expect(Math.abs(afterPlainZoom.rightIndex - base.rightIndex)).toBeLessThan(0.5);

    // Reset with Alt+R
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(150);
    const afterReset = await readVp();

    // 2) Ctrl + wheel ZOOM IN at x = 30%: EXACT bar under cursor x30 stays pinned!
    const anchorRatio = (x30 - m.plotLeft) / m.plotWidth;
    const barAtCursorBefore =
      afterReset.rightIndex - afterReset.visibleBars * (1 - anchorRatio);

    await page.mouse.move(x30, midY);
    await page.keyboard.down('Control');
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(25);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(120);
    const afterCtrlZoom = await readVp();
    const barAtCursorAfter =
      afterCtrlZoom.rightIndex - afterCtrlZoom.visibleBars * (1 - anchorRatio);

    expect(afterCtrlZoom.visibleBars).toBeLessThan(afterReset.visibleBars * 0.8);
    expect(Math.abs(barAtCursorAfter - barAtCursorBefore)).toBeLessThan(0.35);
    expect(Math.abs(afterCtrlZoom.rightIndex - afterReset.rightIndex)).toBeGreaterThan(5);

    // 3) Shift + wheel DOWN -> scrolls LEFT into history WITHOUT changing visibleBars!
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(120);
    const preShift = await readVp();
    await page.mouse.move(m.plotLeft + m.plotWidth * 0.5, midY);
    await page.keyboard.down('Shift');
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(25);
    }
    await page.keyboard.up('Shift');
    await page.waitForTimeout(120);
    const afterShift = await readVp();
    expect(Math.abs(afterShift.visibleBars - preShift.visibleBars)).toBeLessThan(0.1);
    expect(afterShift.rightIndex).toBeLessThan(preShift.rightIndex - 5);

    // 4) Time-Axis drag RIGHT zooms OUT (barSpacing decreases, more visibleBars); double-click resets!
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(120);
    const preTimeDrag = await readVp();
    const tx = m.plotLeft + m.plotWidth * 0.5;
    const ty = m.y + m.plotHeight + 14;
    await page.mouse.move(tx, ty);
    await page.mouse.down();
    await page.mouse.move(tx + 140, ty, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const afterTimeDragRight = await readVp();
    expect(afterTimeDragRight.visibleBars).toBeGreaterThan(preTimeDrag.visibleBars * 1.2);
    expect(afterTimeDragRight.barSpacing).toBeLessThan(preTimeDrag.barSpacing * 0.85);
    expect(Math.abs(afterTimeDragRight.rightIndex - preTimeDrag.rightIndex)).toBeLessThan(0.5);

    await page.mouse.dblclick(tx, ty);
    await page.waitForTimeout(150);
    const afterTimeDblClick = await readVp();
    expect(Math.abs(afterTimeDblClick.visibleBars - preTimeDrag.visibleBars)).toBeLessThan(5);

    // 5) Price-Axis drag disables autoScale; wheel on Price Axis keeps visibleBars untouched; dblclick restores autoScale!
    const px = m.plotRight + 28;
    const py = m.y + m.plotHeight * 0.5;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px, py + 100, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const afterPriceDrag = await readVp();
    expect(afterPriceDrag.autoScale).toBe(false);
    expect(Math.abs(afterPriceDrag.visibleBars - afterTimeDblClick.visibleBars)).toBeLessThan(0.5);

    await page.mouse.dblclick(px, py);
    await page.waitForTimeout(150);
    expect((await readVp()).autoScale).toBe(true);

    // 6) Dragging left freely scrolls into future whitespace past latest bar + Jump-to-realtime button appears when scrolled into history
    await page.mouse.move(m.plotLeft + m.plotWidth * 0.6, midY);
    await page.mouse.down();
    await page.mouse.move(m.plotLeft + m.plotWidth * 0.6 + 320, midY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    await expect(page.getByRole('button', { name: 'Torna al presente' })).toBeVisible();
    await page.getByRole('button', { name: 'Torna al presente' }).click();
    await page.waitForTimeout(150);
    await expect(page.getByRole('button', { name: 'Torna al presente' })).toHaveCount(0);

    // 7) Keyboard Ctrl+ArrowUp zooms in, Ctrl+ArrowDown zooms out
    const preKey = await readVp();
    await page.keyboard.press('Control+ArrowUp');
    await page.waitForTimeout(100);
    expect((await readVp()).visibleBars).toBeLessThan(preKey.visibleBars);

    expect(errors).toEqual([]);
  });

  test('Mobile: readable proportional barSpacing, 1-finger pan without stuck crosshair, 2-finger pinch zoom, and price-axis drag + double-tap reset', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile touch viewport physics');
    const { canvas, errors } = await openCleanChart(page, '#/chart/RACE');
    const m = await getCanvasMetrics(page);

    const readVp = async () => ({
      visibleBars: Number(await canvas.getAttribute('data-visible-bars')),
      rightIndex: Number(await canvas.getAttribute('data-right-index')),
      barSpacing: Number(await canvas.getAttribute('data-bar-spacing')),
      autoScale: (await canvas.getAttribute('data-auto-scale')) === 'true',
      crosshairVisible: (await canvas.getAttribute('data-crosshair-visible')) === 'true',
    });

    const base = await readVp();
    // On 390px mobile, candles MUST remain readable (~5-12px/bar, NOT 120 tiny squished bars!)
    expect(base.barSpacing).toBeGreaterThanOrEqual(4.5);
    expect(base.visibleBars).toBeLessThan(85);

    // 1) 1-finger pan into history -> rightIndex decreases, crosshair stays OFF!
    const startX = m.plotLeft + m.plotWidth * 0.4;
    const midY = m.y + m.plotHeight * 0.5;
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: startX, y: midY }]);
    for (let step = 1; step <= 6; step++) {
      await dispatchCanvasTouch(page, 'touchmove', [
        { id: 1, x: startX + step * 25, y: midY },
      ]);
      await page.waitForTimeout(20);
    }
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: startX + 150, y: midY }]);
    await page.waitForTimeout(120);

    const afterPan = await readVp();
    expect(afterPan.rightIndex).toBeLessThan(base.rightIndex - 10);
    expect(afterPan.crosshairVisible).toBe(false);

    // 2) 2-finger pinch OUT (spread fingers apart) -> zooms IN (fewer visibleBars)!
    const cx = m.plotLeft + m.plotWidth * 0.5;
    await dispatchCanvasTouch(page, 'touchstart', [
      { id: 1, x: cx - 35, y: midY },
      { id: 2, x: cx + 35, y: midY },
    ]);
    await dispatchCanvasTouch(page, 'touchmove', [
      { id: 1, x: cx - 95, y: midY },
      { id: 2, x: cx + 95, y: midY },
    ]);
    await dispatchCanvasTouch(page, 'touchend', [
      { id: 1, x: cx - 95, y: midY },
      { id: 2, x: cx + 95, y: midY },
    ]);
    await page.waitForTimeout(150);

    const afterPinch = await readVp();
    expect(afterPinch.visibleBars).toBeLessThan(afterPan.visibleBars * 0.7);
    expect(afterPinch.crosshairVisible).toBe(false);

    // 3) Price-axis touch drag disables autoScale; double-tap restores autoScale!
    const px = m.plotRight + 24;
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: px, y: midY }]);
    await dispatchCanvasTouch(page, 'touchmove', [{ id: 1, x: px, y: midY + 80 }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: px, y: midY + 80 }]);
    await page.waitForTimeout(120);
    expect((await readVp()).autoScale).toBe(false);

    // Double-tap on price axis
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: px, y: midY }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: px, y: midY }]);
    await page.waitForTimeout(80);
    await dispatchCanvasTouch(page, 'touchstart', [{ id: 1, x: px, y: midY }]);
    await dispatchCanvasTouch(page, 'touchend', [{ id: 1, x: px, y: midY }]);
    await page.waitForTimeout(150);
    expect((await readVp()).autoScale).toBe(true);

    expect(errors).toEqual([]);
  });
});
