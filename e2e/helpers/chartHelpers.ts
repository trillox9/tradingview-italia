import { expect, type Page } from '@playwright/test';

export interface CanvasMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  priceAxisWidth: number;
  timeAxisHeight: number;
  plotLeft: number;
  plotRight: number;
  plotWidth: number;
  plotHeight: number;
}

/**
 * Navigates to the local Supercharts workspace with clean localStorage and waits
 * for the primary `<canvas>` to hydrate and render real candle pixels.
 */
export async function openCleanChart(page: Page, hash = '#/chart/RACE') {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore harmless offline external API network errors in headless test env
      if (
        !text.includes('Failed to fetch') &&
        !text.includes('ERR_FAILED') &&
        !text.includes('ERR_NAME_NOT_RESOLVED') &&
        !text.includes('WebSocket')
      ) {
        errors.push(`console.error: ${text}`);
      }
    }
  });

  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas.sc-canvas').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Wait until canvas has drawn non-uniform candle pixels (hydrated from snapshot/fallback)
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas.sc-canvas') as HTMLCanvasElement | null;
    if (!c || c.width < 100 || c.height < 100) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, Math.min(c.width, 600), Math.min(c.height, 400)).data;
    let greenOrRed = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if ((g > 110 && g > r + 40) || (r > 180 && r > g + 80)) {
        greenOrRed++;
        if (greenOrRed > 20) return true;
      }
    }
    return false;
  }, { timeout: 15_000 });

  await page.waitForTimeout(200);
  return { canvas, errors };
}

export async function getCanvasMetrics(page: Page): Promise<CanvasMetrics> {
  const rect = await page.locator('canvas.sc-canvas').first().boundingBox();
  if (!rect) throw new Error('Primary chart canvas bounding box not found');
  const priceAxisWidth = 58;
  const timeAxisHeight = 28;
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    priceAxisWidth,
    timeAxisHeight,
    plotLeft: rect.x,
    plotRight: rect.x + rect.width - priceAxisWidth,
    plotWidth: rect.width - priceAxisWidth,
    plotHeight: rect.height - timeAxisHeight,
  };
}

/**
 * Captures a rectangular pixel region (CSS coords relative to viewport) from the primary canvas.
 */
export async function readCanvasPatch(
  page: Page,
  viewportX: number,
  viewportY: number,
  halfSize = 10,
): Promise<{
  total: number;
  changedFromBg: number;
  bluePixels: number;
  whitePixels: number;
  raw: number[];
}> {
  return page.evaluate(
    ({ vx, vy, hs }) => {
      const c = document.querySelector('canvas.sc-canvas') as HTMLCanvasElement | null;
      if (!c) throw new Error('canvas not found');
      const r = c.getBoundingClientRect();
      const dpr = c.width / Math.max(1, r.width);
      const cx = Math.round((vx - r.left) * dpr);
      const cy = Math.round((vy - r.top) * dpr);
      const rad = Math.max(1, Math.round(hs * dpr));
      const x0 = Math.max(0, cx - rad);
      const y0 = Math.max(0, cy - rad);
      const w = Math.min(c.width - x0, rad * 2 + 1);
      const h = Math.min(c.height - y0, rad * 2 + 1);
      const ctx = c.getContext('2d')!;
      const img = ctx.getImageData(x0, y0, w, h).data;
      let changedFromBg = 0;
      let bluePixels = 0;
      let whitePixels = 0;
      const raw: number[] = [];
      for (let i = 0; i < img.length; i += 4) {
        const R = img[i];
        const G = img[i + 1];
        const B = img[i + 2];
        const A = img[i + 3];
        raw.push(R, G, B, A);
        if (R > 18 || G > 18 || B > 18) changedFromBg++;
        if (B > 170 && R < 110 && G < 150) bluePixels++;
        if (R > 220 && G > 220 && B > 220) whitePixels++;
      }
      return { total: w * h, changedFromBg, bluePixels, whitePixels, raw };
    },
    { vx: viewportX, vy: viewportY, hs: halfSize },
  );
}

/**
 * Counts how many pixels differ between two `readCanvasPatch` snapshots.
 */
export function countDiffPixels(a: number[], b: number[], threshold = 24): number {
  const len = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    if (dr + dg + db > threshold) diff++;
  }
  return diff;
}

/**
 * Dispatches real TouchEvents on the chart canvas (for Mobile E2E tests).
 */
export async function dispatchCanvasTouch(
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ id?: number; x: number; y: number }>,
) {
  await page.evaluate(
    ({ type, points }) => {
      const c = document.querySelector('canvas.sc-canvas') as HTMLCanvasElement | null;
      if (!c) throw new Error('canvas not found');
      const touches = points.map((pt, idx) =>
        new Touch({
          identifier: pt.id ?? idx + 1,
          target: c,
          clientX: pt.x,
          clientY: pt.y,
          pageX: pt.x,
          pageY: pt.y,
          screenX: pt.x,
          screenY: pt.y,
          radiusX: 4,
          radiusY: 4,
          force: 1,
        }),
      );
      const ev = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : touches,
        targetTouches: type === 'touchend' ? [] : touches,
        changedTouches: touches,
      });
      c.dispatchEvent(ev);
    },
    { type, points },
  );
}
