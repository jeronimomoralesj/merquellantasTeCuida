'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, UserCheck, X, Users as UsersIcon } from 'lucide-react';

interface JefeOption {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  area: string;
  departamento: string;
}

interface JefeSelectorProps {
  value: JefeOption | null;
  onChange: (jefe: JefeOption | null) => void;
  /** Show a red border + message when true. */
  error?: string | null;
}

/**
 * Searchable picker for the employee's immediate supervisor.
 *
 * Queries /api/users/search (authenticated, any role) and debounces so we don't hit
 * the endpoint on every keystroke. The picked supervisor's id is what downstream
 * forms submit; the server resolves the email address at send time.
 */
export default function JefeSelector({ value, onChange, error }: JefeSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JefeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch — only hit the API once the user stops typing for 200ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setResults((data.results as JefeOption[]) ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (j: JefeOption) => {
    onChange(j);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange(null);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      {value ? (
        <div
          className={`flex items-center justify-between px-4 py-3 border rounded-lg bg-emerald-50 ${
            error ? 'border-red-300' : 'border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{value.nombre}</p>
              <p className="text-xs text-gray-500 truncate">
                {value.cargo || '—'} · CC {value.cedula}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-white"
            title="Cambiar jefe"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div
            className={`relative rounded-lg border transition-all ${
              error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white focus-within:border-[#f4a900] focus-within:ring-2 focus-within:ring-[#f4a900]'
            }`}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder="Buscar por nombre, apellido o cédula..."
              className="w-full pl-10 pr-3 py-3 bg-transparent focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 rounded-lg"
            />
          </div>

          {open && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-4 flex items-center justify-center text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando...
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  <UsersIcon className="h-5 w-5 mx-auto mb-1 text-gray-300" />
                  {query ? 'Sin coincidencias.' : 'Escribe el nombre o cédula del jefe.'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => pick(r)}
                        className="w-full text-left px-4 py-3 hover:bg-[#f4a900]/5 focus:bg-[#f4a900]/5 focus:outline-none"
                      >
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.nombre}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.cargo || '—'}
                          {r.cedula && ` · CC ${r.cedula}`}
                          {r.area && ` · ${r.area}`}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export type { JefeOption };
