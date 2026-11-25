import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import type {
  RatingLabel,
  ScreenerCategory,
  ScreenerQuery,
  ScreenerSortDirection,
  ScreenerSortField,
} from '../../types';
import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
} from '../../data';
import {
  buildScreenerRows,
  filterAndSortScreener,
  getScreenerSectors,
} from '../../engine';
import { useActivePane, useQuotes } from '../../store';

type QuickPresetId =
  | 'all'
  | 'italian'
  | 'top-gainers'
  | 'top-losers'
  | 'oversold'
  | 'crypto';

function ratingBadgeClass(rating: RatingLabel): string {
  if (rating === 'Forte acquisto' || rating === 'Acquisto') return 'is-up';
  if (rating === 'Forte vendita' || rating === 'Vendita') return 'is-down';
  return '';
}

export function ScreenerTab() {
  const { quotes } = useQuotes();
  const { activeSymbol, setSymbol } = useActivePane();

  const [preset, setPreset] = useState<QuickPresetId>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ScreenerCategory>('all');
  const [sector, setSector] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ScreenerSortField>('marketCap');
  const [sortDir, setSortDir] = useState<ScreenerSortDirection>('desc');

  // Compute baseline indicator telemetry once, then overlay live tick prices cheaply
  const baseRows = useMemo(() => buildScreenerRows(), []);
  const sectors = useMemo(() => getScreenerSectors(baseRows), [baseRows]);

  const liveRows = useMemo(() => {
    return baseRows.map((row) => {
      const q = quotes[row.ticker];
      if (!q) return row;
      return {
        ...row,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume,
        relativeVolume:
          row.symbol.avgVolume > 0
            ? Math.round((q.volume / row.symbol.avgVolume) * 100) / 100
            : row.relativeVolume,
      };
    });
  }, [baseRows, quotes]);

  const displayedRows = useMemo(() => {
    const query: ScreenerQuery = {
      category,
      search,
      sector,
      sortBy,
      sortDir,
    };

    if (preset === 'italian') {
      query.category = 'italian';
    } else if (preset === 'crypto') {
      query.category = 'crypto';
    } else if (preset === 'oversold') {
      query.maxRsi = 40;
    }

    return filterAndSortScreener(liveRows, query);
  }, [liveRows, category, search, sector, sortBy, sortDir, preset]);

  const applyPreset = (id: QuickPresetId) => {
    setPreset(id);
    if (id === 'all') {
      setCategory('all');
      setSector('all');
      setSortBy('marketCap');
      setSortDir('desc');
    } else if (id === 'italian') {
      setCategory('italian');
      setSortBy('marketCap');
      setSortDir('desc');
    } else if (id === 'top-gainers') {
      setCategory('all');
      setSortBy('changePercent');
      setSortDir('desc');
    } else if (id === 'top-losers') {
      setCategory('all');
      setSortBy('changePercent');
      setSortDir('asc');
    } else if (id === 'oversold') {
      setCategory('all');
      setSortBy('rsi14');
      setSortDir('asc');
    } else if (id === 'crypto') {
      setCategory('crypto');
      setSortBy('changePercent');
      setSortDir('desc');
    }
  };

  const handleSort = (field: ScreenerSortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: ScreenerSortField }) => {
    if (sortBy !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
    );
  };

  return (
    <div className="tv-panel">
      <div className="tv-drawer-toolbar">
        {/* Preset Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'Tutte'],
              ['italian', 'Italia MIL'],
              ['top-gainers', 'Top rialzi'],
              ['top-losers', 'Top ribassi'],
              ['oversold', 'Ipervenduto RSI'],
              ['crypto', 'Cripto'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tv-chip${preset === id ? ' is-active' : ''}`}
              onClick={() => applyPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', width: 170 }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--tv-text-muted, #707070)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="tv-input-compact"
              style={{ paddingLeft: 26 }}
              placeholder="Cerca ticker o nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="tv-select-compact"
            aria-label="Classe di asset"
            value={category}
            onChange={(e) => {
              setPreset('all');
              setCategory(e.target.value as ScreenerCategory);
            }}
          >
            <option value="all">Tutti gli asset</option>
            <option value="stocks">Azioni</option>
            <option value="italian">Azioni Italia (MIL)</option>
            <option value="us">Azioni USA</option>
            <option value="crypto">Cripto</option>
            <option value="forex">Forex</option>
            <option value="indices">Indici</option>
            <option value="futures">Futures</option>
            <option value="etf">ETF</option>
          </select>

          <select
            className="tv-select-compact"
            aria-label="Settore"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="all">Tutti i settori</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 11, color: 'var(--tv-text-muted, #707070)' }}>
            {displayedRows.length} risultati
          </span>
        </div>
      </div>

      <div className="tv-table-wrap">
        <table className="tv-data-table">
          <thead>
            <tr>
              <th className="is-sortable" onClick={() => handleSort('ticker')}>
                Simbolo
                <SortIcon field="ticker" />
              </th>
              <th className="is-sortable is-num" onClick={() => handleSort('price')}>
                Ultimo
                <SortIcon field="price" />
              </th>
              <th
                className="is-sortable is-num"
                onClick={() => handleSort('changePercent')}
              >
                Var %
                <SortIcon field="changePercent" />
              </th>
              <th className="is-sortable is-num" onClick={() => handleSort('volume')}>
                Volume
                <SortIcon field="volume" />
              </th>
              <th className="is-sortable is-num" onClick={() => handleSort('rsi14')}>
                RSI (14)
                <SortIcon field="rsi14" />
              </th>
              <th
                className="is-sortable"
                onClick={() => handleSort('technicalScore')}
              >
                Rating tecnico
                <SortIcon field="technicalScore" />
              </th>
              <th className="is-sortable is-num" onClick={() => handleSort('marketCap')}>
                Cap.
                <SortIcon field="marketCap" />
              </th>
              <th>Settore</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                  Nessuno strumento corrisponde ai filtri selezionati.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => {
                const isUp = row.changePercent >= 0;
                const isSelected = row.ticker === activeSymbol.ticker;
                return (
                  <tr
                    key={row.ticker}
                    className="is-clickable"
                    style={{
                      background: isSelected
                        ? 'var(--tv-brand-soft, #132042)'
                        : undefined,
                    }}
                    onClick={() => setSymbol(row.ticker)}
                  >
                    <td>
                      <div className="tv-wl-sym-cell">
                        <span
                          className="tv-ticker-badge"
                          style={{ backgroundColor: row.symbol.logoColor }}
                        >
                          {row.symbol.logoText}
                        </span>
                        <div className="tv-wl-sym-meta">
                          <span className="tv-wl-ticker">{row.ticker}</span>
                          <span className="tv-wl-exchange">
                            {row.name} • {row.exchange}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="is-num">
                      <strong>{formatPrice(row.price, row.symbol.precision)}</strong>
                    </td>
                    <td
                      className={`is-num ${isUp ? 'tv-val-up' : 'tv-val-down'}`}
                      style={{ fontWeight: 600 }}
                    >
                      {formatPercent(row.changePercent)}
                    </td>
                    <td className="is-num">{formatVolume(row.volume)}</td>
                    <td className="is-num">
                      {row.rsi14 !== null ? (
                        <span
                          className={
                            row.rsi14 <= 30
                              ? 'tv-val-up'
                              : row.rsi14 >= 70
                                ? 'tv-val-down'
                                : ''
                          }
                        >
                          {row.rsi14.toFixed(1)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        className={`tv-badge-pill ${ratingBadgeClass(row.technicalRating)}`}
                      >
                        {row.technicalRating}
                      </span>
                    </td>
                    <td className="is-num">
                      {formatMarketCap(row.marketCap || null)}
                    </td>
                    <td style={{ color: 'var(--tv-text-secondary, #8c8c8c)' }}>
                      {row.sector}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
