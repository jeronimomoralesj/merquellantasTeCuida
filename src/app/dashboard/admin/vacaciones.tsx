'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Umbrella,
  Search,
  RefreshCcw,
  AlertTriangle,
  Loader2,
  Clock,
  Download,
  Users as UsersIcon,
  TrendingUp,
} from 'lucide-react';

interface VacationRow {
  cedula: string;
  nombre: string;
  email: string | null;
  cargo: string | null;
  area: string | null;
  departamento: string | null;
  fecha_ingreso: string | null;
  days: number | null;
  as_of_date: string | null;
  scraped_at: string | null;
  last_adjusted_at: string | null;
  source: string | null;
  stale: boolean;
  missing: boolean;
}

interface VacationsAll {
  totals: {
    users: number;
    with_balance: number;
    missing: number;
    stale: number;
    total_days: number;
    avg_days: number | null;
    latest_scraped_at: string | null;
  };
  rows: VacationRow[];
}

type SortKey = 'nombre' | 'days' | 'area' | 'as_of_date';

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function fmtDays(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(n % 1 === 0 ? 0 : 2);
}

export default function VacacionesAdmin() {
  const [data, setData] = useState<VacationsAll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'stale' | 'missing' | 'with'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vacations/all');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setData(await res.json());
    } catch (e) {
      console.error(e);
      setError('Error al cargar saldos de vacaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let filtered = data.rows;
    if (filter === 'stale') filtered = filtered.filter((r) => r.stale && !r.missing);
    else if (filter === 'missing') filtered = filtered.filter((r) => r.missing);
    else if (filter === 'with') filtered = filtered.filter((r) => typeof r.days === 'number');
    if (q) {
      filtered = filtered.filter((r) =>
        `${r.nombre} ${r.cedula} ${r.area ?? ''} ${r.cargo ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'nombre') {
        av = a.nombre.toLowerCase();
        bv = b.nombre.toLowerCase();
      } else if (sortKey === 'days') {
        av = a.days ?? -Infinity;
        bv = b.days ?? -Infinity;
      } else if (sortKey === 'area') {
        av = (a.area || '').toLowerCase();
        bv = (b.area || '').toLowerCase();
      } else if (sortKey === 'as_of_date') {
        av = a.as_of_date || '';
        bv = b.as_of_date || '';
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [data, search, filter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'days' ? 'desc' : 'asc');
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const header = [
      'Cédula',
      'Nombre',
      'Correo',
      'Cargo',
      'Área',
      'Departamento',
      'Días disponibles',
      'Fecha de corte',
      'Última sincronización',
      'Origen',
      'Estado',
    ];
    const quote = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.cedula,
          r.nombre,
          r.email ?? '',
          r.cargo ?? '',
          r.area ?? '',
          r.departamento ?? '',
          r.days ?? '',
          r.as_of_date ?? '',
          r.scraped_at ?? '',
          r.source ?? '',
          r.missing ? 'Sin registro' : r.stale ? 'Desactualizado' : 'OK',
        ]
          .map(quote)
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vacaciones_saldos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Hero header */}
      <div className="relative p-5 sm:p-6 bg-black text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle at 90% 30%, #10b981 0, transparent 50%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Umbrella className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Saldos de vacaciones</h2>
              <p className="text-xs text-white/60">
                Última sincronización:{' '}
                {data?.totals.latest_scraped_at
                  ? fmtDateTime(data.totals.latest_scraped_at)
                  : 'sin datos aún'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportCsv}
              disabled={loading || !data}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 active:scale-95 transition-all border border-white/20 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refrescar
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-gray-50 border-b border-gray-100">
        <StatCard
          icon={<UsersIcon className="h-4 w-4" />}
          label="Con saldo"
          value={data ? `${data.totals.with_balance}/${data.totals.users}` : '—'}
          tone="emerald"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Promedio por empleado"
          value={data?.totals.avg_days != null ? `${data.totals.avg_days}` : '—'}
          tone="blue"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Desactualizados"
          value={data ? String(data.totals.stale) : '—'}
          tone="amber"
          onClick={() => setFilter(filter === 'stale' ? 'all' : 'stale')}
          active={filter === 'stale'}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Sin registro"
          value={data ? String(data.totals.missing) : '—'}
          tone="red"
          onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
          active={filter === 'missing'}
        />
      </div>

      {/* Search */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-white flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula, área..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando saldos...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-red-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              Sin resultados para este filtro.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500">
                  <SortableTh active={sortKey === 'nombre'} dir={sortDir} onClick={() => toggleSort('nombre')}>
                    Empleado
                  </SortableTh>
                  <SortableTh active={sortKey === 'area'} dir={sortDir} onClick={() => toggleSort('area')}>
                    Área / Cargo
                  </SortableTh>
                  <SortableTh active={sortKey === 'days'} dir={sortDir} onClick={() => toggleSort('days')} align="right">
                    Días disponibles
                  </SortableTh>
                  <SortableTh active={sortKey === 'as_of_date'} dir={sortDir} onClick={() => toggleSort('as_of_date')}>
                    Corte
                  </SortableTh>
                  <th className="px-4 py-3 text-left font-bold">Sincronización</th>
                  <th className="px-4 py-3 text-left font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.cedula} className="hover:bg-emerald-50/30">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900 truncate max-w-[240px]">{r.nombre}</p>
                      <p className="text-xs text-gray-500 font-mono">CC {r.cedula}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{r.area || '—'}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{r.cargo || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.days == null ? (
                        <span className="text-gray-400 italic">sin datos</span>
                      ) : (
                        <div className="inline-flex items-baseline gap-1">
                          <span
                            className={`text-xl font-extrabold ${
                              r.days >= 15
                                ? 'text-emerald-600'
                                : r.days >= 5
                                ? 'text-emerald-500'
                                : r.days >= 1
                                ? 'text-amber-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {fmtDays(r.days)}
                          </span>
                          <span className="text-[11px] text-gray-500">días</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {fmtDate(r.as_of_date)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {fmtDateTime(r.scraped_at)}
                      {r.source && (
                        <p className="text-[10px] text-gray-400">{r.source}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.missing ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3 w-3" /> Sin registro
                        </span>
                      ) : r.stale ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase">
                          <Clock className="h-3 w-3" /> Desactualizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-2 text-[11px] text-gray-400 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span>
            {rows.length} {rows.length === 1 ? 'empleado' : 'empleados'}
            {data && rows.length !== data.rows.length ? ` de ${data.rows.length} total` : ''}
          </span>
          <span>Los datos provienen del scrape mensual de Heinsohn.</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'emerald' | 'blue' | 'amber' | 'red';
  onClick?: () => void;
  active?: boolean;
}) {
  const palettes = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  } as const;
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left p-3 rounded-xl border ${palettes[tone]} ${
        onClick ? 'hover:shadow-sm active:scale-[0.99] transition' : ''
      } ${active ? 'ring-2 ring-offset-1 ring-current' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold opacity-80 mb-1">
        {icon} {label}
      </div>
      <p className="text-xl font-extrabold leading-none">{value}</p>
    </Wrapper>
  );
}

function SortableTh({
  children,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  children: React.ReactNode;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th className={`px-4 py-3 font-bold ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-gray-800 ${
          active ? 'text-gray-800' : ''
        }`}
      >
        {children}
        {active && <span className="text-[8px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}
