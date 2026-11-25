import { describe, expect, it } from 'vitest';
import type { Candle } from '../src/types';
import { getCandlesForSymbol } from '../src/data';
import { PINE_TEMPLATES, evaluatePineScript } from '../src/engine';

function makeOscillatingCandles(count = 160): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 100 + Math.sin(i / 8) * 18 + i * 0.15;
    const open = base;
    const close = base + Math.cos(i / 8) * 1.4;
    const high = Math.max(open, close) + 1.2;
    const low = Math.min(open, close) - 1.2;
    candles.push({
      time: 1700000000 + i * 86400,
      open,
      high,
      low,
      close,
      volume: 10_000,
    });
  }
  return candles;
}

describe('Pine Script Mini-Evaluator & Strategy Backtester (pineEvaluator.ts)', () => {
  it('executes every built-in Italian Pine template without errors', () => {
    const candles = getCandlesForSymbol('BTCUSDT', '1D', 260);
    for (const tpl of PINE_TEMPLATES) {
      const res = evaluatePineScript(tpl.code, candles);
      expect(res.ok, `Template ${tpl.id} failed: ${JSON.stringify(res.diagnostics)}`).toBe(true);
      expect(res.plots.length).toBeGreaterThan(0);
      expect(res.plots[0].data).toHaveLength(candles.length);

      if (tpl.isStrategy) {
        expect(res.isStrategy).toBe(true);
        expect(res.backtest).not.toBeNull();
        expect(res.backtest!.equityCurve).toHaveLength(candles.length);
        expect(res.backtest!.totalTrades).toBeGreaterThan(0);
        expect(res.backtest!.winRatePercent).toBeGreaterThanOrEqual(0);
        expect(res.backtest!.winRatePercent).toBeLessThanOrEqual(100);
      } else {
        expect(res.isStrategy).toBe(false);
        expect(res.backtest).toBeNull();
      }
    }
  });

  it('evaluates custom indicator with ta.sma, ta.ema, ta.rsi, plot, and hline', () => {
    const candles = makeOscillatingCandles(120);
    const script = `
//@version=5
indicator("Test Indicatore", overlay=false)
r = ta.rsi(close, 14)
s = ta.sma(r, 5)
plot(r, title="RSI", color="#7E57C2", linewidth=2)
plot(s, title="SMA RSI", color=color.orange)
hline(70, title="Sopra", color=color.red, linestyle=hline.style_dashed)
hline(30, title="Sotto", color=color.green, linestyle=hline.style_dotted)
`;
    const res = evaluatePineScript(script, candles);
    expect(res.ok).toBe(true);
    expect(res.scriptName).toBe('Test Indicatore');
    expect(res.overlay).toBe(false);
    expect(res.plots).toHaveLength(2);
    expect(res.plots[0].color).toBe('#7E57C2');
    expect(res.plots[0].pane).toBe('separate');
    expect(res.hlines).toHaveLength(2);
    expect(res.hlines[0].value).toBe(70);
    expect(res.hlines[1].lineStyle).toBe('dotted');
  });

  it('produces accurate trades, win rate, profit factor, and max drawdown on oscillating strategy', () => {
    const candles = makeOscillatingCandles(180);
    const script = `
//@version=5
strategy("Cross Test", overlay=true, initial_capital=50000)
fast = ta.ema(close, 5)
slow = ta.sma(close, 15)
plot(fast, title="Fast", color=color.blue)
plot(slow, title="Slow", color=color.red)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fast, slow)
    strategy.entry("Short", strategy.short)
`;
    const res = evaluatePineScript(script, candles);
    expect(res.ok).toBe(true);
    const bt = res.backtest!;
    expect(bt.initialCapital).toBe(50000);
    expect(bt.totalTrades).toBeGreaterThanOrEqual(4);
    expect(bt.winningTrades + bt.losingTrades).toBe(bt.totalTrades);
    expect(bt.netProfit).toBeCloseTo(bt.finalEquity - bt.initialCapital, 1);
    expect(bt.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(bt.profitFactor).toBeGreaterThanOrEqual(0);
    expect(bt.equityCurve).toHaveLength(candles.length);
  });

  it('reports syntax errors cleanly in diagnostics without throwing', () => {
    const candles = makeOscillatingCandles(40);
    const res = evaluatePineScript('questa non è sintassi pine valida $$$', candles);
    expect(res.ok).toBe(false);
    expect(res.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(res.backtest).toBeNull();
  });
});
