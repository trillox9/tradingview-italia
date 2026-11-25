import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  formatPercent,
  formatPrice,
  generateSparkline,
} from '../../data';
import { useActivePane, useQuotes, useTradingView } from '../../store';

export interface SnapshotModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function findLargestChartCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvases = Array.from(document.querySelectorAll('canvas')).filter(
    (c) => c.width > 120 && c.height > 80 && c.offsetParent !== null,
  );
  if (canvases.length === 0) return null;
  return canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

function renderSummaryCardDataUrl(params: {
  ticker: string;
  name: string;
  exchange: string;
  timeframe: string;
  priceText: string;
  currency: string;
  deltaText: string;
  isUp: boolean;
  rating: string;
  logoColor: string;
  logoText: string;
  sparkline: number[];
  isDark: boolean;
}): string {
  const w = 960;
  const h = 520;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = params.isDark ? '#000000' : '#ffffff';
  const cardBg = params.isDark ? '#131313' : '#f8f9fc';
  const border = params.isDark ? '#303030' : '#ebebeb';
  const textMain = params.isDark ? '#ffffff' : '#000000';
  const textMuted = params.isDark ? '#8c8c8c' : '#707070';
  const accent = params.isUp ? '#089981' : '#f23645';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = params.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let x = 60; x < w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 60; y < h; y += 65) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Header badge
  ctx.fillStyle = params.logoColor;
  ctx.beginPath();
  ctx.arc(62, 66, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(params.logoText, 62, 66);

  ctx.textAlign = 'left';
  ctx.fillStyle = textMain;
  ctx.font = 'bold 26px Inter, sans-serif';
  ctx.fillText(`${params.ticker} · ${params.timeframe}`, 102, 58);

  ctx.fillStyle = textMuted;
  ctx.font = '500 15px Inter, sans-serif';
  ctx.fillText(`${params.name} (${params.exchange})`, 102, 82);

  // Price right
  ctx.textAlign = 'right';
  ctx.fillStyle = textMain;
  ctx.font = 'bold 30px Inter, sans-serif';
  ctx.fillText(`${params.priceText} ${params.currency}`, w - 42, 58);

  ctx.fillStyle = accent;
  ctx.font = 'bold 17px Inter, sans-serif';
  ctx.fillText(`${params.deltaText}  •  ${params.rating}`, w - 42, 84);

  // Sparkline plot area
  const padX = 44;
  const padY = 128;
  const plotW = w - padX * 2;
  const plotH = 310;

  ctx.fillStyle = cardBg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(padX, padY, plotW, plotH, 12);
  ctx.fill();
  ctx.stroke();

  const pts = params.sparkline;
  if (pts.length >= 2) {
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const innerPad = 24;

    const getX = (i: number) =>
      padX + innerPad + (i / (pts.length - 1)) * (plotW - innerPad * 2);
    const getY = (v: number) =>
      padY + plotH - innerPad - ((v - min) / range) * (plotH - innerPad * 2);

    const grad = ctx.createLinearGradient(0, padY, 0, padY + plotH);
    grad.addColorStop(
      0,
      params.isUp ? 'rgba(8, 153, 129, 0.34)' : 'rgba(242, 54, 69, 0.34)',
    );
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), padY + plotH - innerPad);
    pts.forEach((v, i) => ctx.lineTo(getX(i), getY(v)));
    ctx.lineTo(getX(pts.length - 1), padY + plotH - innerPad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((v, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(v));
      else ctx.lineTo(getX(i), getY(v));
    });
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Footer watermark
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2962ff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('TV  TradingView Italia', 44, h - 32);

  ctx.textAlign = 'right';
  ctx.fillStyle = textMuted;
  ctx.font = '500 13px Inter, sans-serif';
  ctx.fillText(
    `Istantanea generata il ${new Date().toLocaleString('it-IT')}`,
    w - 44,
    h - 32,
  );

  return canvas.toDataURL('image/png');
}

export function SnapshotModal({ isOpen, onClose }: SnapshotModalProps) {
  const { modals, closeModal, theme, openSymbolInChart } = useTradingView();
  const { activePane, activeSymbol, technicalSummary } = useActivePane();
  const { quotes } = useQuotes();

  const visible = isOpen ?? modals.snapshot;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else closeModal('snapshot');
  }, [closeModal, onClose]);

  const [dataUrl, setDataUrl] = useState<string>('');
  const [fromLiveCanvas, setFromLiveCanvas] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  const live = quotes[activeSymbol.ticker];
  const price = live?.price ?? activeSymbol.basePrice;
  const deltaPercent =
    live?.changePercent ??
    ((activeSymbol.basePrice - activeSymbol.prevClose) / activeSymbol.prevClose) *
      100;

  const captureSnapshot = useCallback(() => {
    const liveCanvas = findLargestChartCanvas();
    if (liveCanvas) {
      try {
        const w = liveCanvas.width;
        const h = liveCanvas.height;
        const headerH = 44;
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h + headerH;
        const ctx = out.getContext('2d');
        if (ctx) {
          ctx.fillStyle = theme === 'dark' ? '#000000' : '#ffffff';
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(liveCanvas, 0, headerH);

          // Top attribution ribbon
          ctx.fillStyle = theme === 'dark' ? '#131313' : '#f2f2f2';
          ctx.fillRect(0, 0, out.width, headerH);
          ctx.fillStyle = '#2962ff';
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.fillText('TV TradingView Italia', 16, 27);
          ctx.fillStyle = theme === 'dark' ? '#e5e7eb' : '#000000';
          ctx.font = '600 14px Inter, sans-serif';
          ctx.fillText(
            `${activeSymbol.id} · ${activePane.timeframe} · ${formatPrice(price, activeSymbol.precision)} ${activeSymbol.currency} (${formatPercent(deltaPercent)})`,
            184,
            27,
          );
          setDataUrl(out.toDataURL('image/png'));
          setFromLiveCanvas(true);
          return;
        }
      } catch {
        // Fallback to generated summary card
      }
    }

    const spark = generateSparkline(activeSymbol, 48);
    const url = renderSummaryCardDataUrl({
      ticker: activeSymbol.ticker,
      name: activeSymbol.name,
      exchange: activeSymbol.exchange,
      timeframe: activePane.timeframe,
      priceText: formatPrice(price, activeSymbol.precision),
      currency: activeSymbol.currency,
      deltaText: formatPercent(deltaPercent),
      isUp: deltaPercent >= 0,
      rating: technicalSummary.summary.rating,
      logoColor: activeSymbol.logoColor,
      logoText: activeSymbol.logoText,
      sparkline: spark,
      isDark: theme === 'dark',
    });
    setDataUrl(url);
    setFromLiveCanvas(false);
  }, [
    activePane.timeframe,
    activeSymbol,
    deltaPercent,
    price,
    technicalSummary.summary.rating,
    theme,
  ]);

  useEffect(() => {
    if (!visible) return;
    setCopiedLink(false);
    setCopiedSummary(false);
    captureSnapshot();
  }, [visible, captureSnapshot]);

  if (!visible) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#/chart/${encodeURIComponent(activeSymbol.ticker)}`
      : `#/chart/${activeSymbol.ticker}`;

  const summaryText = `${activeSymbol.ticker} (${activeSymbol.exchange}) — ${formatPrice(price, activeSymbol.precision)} ${activeSymbol.currency} (${formatPercent(deltaPercent)}) | Timeframe ${activePane.timeframe} | Analisi tecnica: ${technicalSummary.summary.rating} | ${shareUrl}`;

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `tradingview-${activeSymbol.ticker.toLowerCase()}-${activePane.timeframe}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      setCopiedSummary(true);
    }
  };

  return (
    <div
      className="tvm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Istantanea del grafico"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="tvm-dialog tvm-dialog--lg">
        <div className="tvm-header">
          <div className="tvm-title-group">
            <Camera size={19} style={{ color: 'var(--tv-brand, #2962ff)' }} />
            <div>
              <h2 className="tvm-title">Istantanea del grafico</h2>
              <div className="tvm-subtitle">
                {fromLiveCanvas
                  ? `Cattura diretta dal canvas Supercharts (${activeSymbol.ticker} · ${activePane.timeframe})`
                  : `Scheda riepilogativa ${activeSymbol.ticker} (${activeSymbol.name})`}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tvm-close-btn"
            aria-label="Chiudi"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="tvm-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="tvm-snapshot-preview">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`Istantanea grafico ${activeSymbol.ticker}`}
              />
            ) : (
              <div className="tvp-empty-state">Generazione istantanea in corso...</div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              backgroundColor: 'var(--tv-bg-primary, #131313)',
              border: '1px solid var(--tv-border, #303030)',
            }}
          >
            <Link2 size={15} style={{ color: 'var(--tv-text-secondary, #8c8c8c)', flexShrink: 0 }} />
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="tvm-search-input tv-mono"
              style={{ fontSize: '0.78rem' }}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Link condivisibile grafico"
            />
            <button
              type="button"
              className="tvm-btn tvm-btn--sm tvm-btn--secondary"
              onClick={handleCopyLink}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? 'Copiato!' : 'Copia link'}
            </button>
          </div>
        </div>

        <div className="tvm-footer">
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="tvm-btn tvm-btn--ghost"
              onClick={captureSnapshot}
            >
              <RefreshCw size={14} />
              Aggiorna
            </button>
            {!fromLiveCanvas && (
              <button
                type="button"
                className="tvm-btn tvm-btn--ghost"
                onClick={() => {
                  openSymbolInChart(activeSymbol.ticker);
                  handleClose();
                }}
              >
                <ExternalLink size={14} />
                Apri su Supercharts
              </button>
            )}
          </div>

          <div className="tvm-footer-actions">
            <button
              type="button"
              className="tvm-btn tvm-btn--secondary"
              onClick={handleCopySummary}
            >
              {copiedSummary ? <Check size={15} /> : <Copy size={15} />}
              {copiedSummary ? 'Riepilogo copiato' : 'Copia riepilogo'}
            </button>
            <button
              type="button"
              className="tvm-btn tvm-btn--primary"
              onClick={handleDownload}
              disabled={!dataUrl}
            >
              <Download size={15} />
              Scarica immagine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SnapshotModal;
