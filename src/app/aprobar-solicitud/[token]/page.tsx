'use client';

import React, { useEffect, useRef, useState } from 'react';
import { use } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  FileText,
  User as UserIcon,
  AlertTriangle,
  Info,
  CornerUpRight,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-react';

interface JefeOption {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  area: string;
  departamento: string;
}

interface Solicitud {
  id: string;
  tipo: 'permiso' | 'vacaciones' | 'incapacidad';
  nombre: string;
  cedula: string;
  estado: string;
  description: string | null;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias_vacaciones: number | null;
  tiempo_inicio: string | null;
  tiempo_fin: string | null;
  document_url: string | null;
  document_name: string | null;
  document_urls: { url: string; name: string }[];
  approver_nombre: string | null;
  motivo_respuesta: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type Status = 'loading' | 'ready' | 'decided' | 'expired' | 'not_found' | 'error' | 'forwarded';

export default function AprobarSolicitudPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [status, setStatus] = useState<Status>('loading');
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [motivo, setMotivo] = useState('');
  const [deciding, setDeciding] = useState<null | 'aprobado' | 'rechazado'>(null);
  const [decisionResult, setDecisionResult] = useState<'aprobado' | 'rechazado' | null>(null);

  // Forward-to-correct-jefe flow
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState<JefeOption | null>(null);
  const [forwardNote, setForwardNote] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [forwardedToName, setForwardedToName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/solicitudes/by-token/${token}`);
        if (res.status === 404) { setStatus('not_found'); return; }
        if (res.status === 410) { setStatus('expired'); return; }
        if (!res.ok) { setStatus('error'); return; }
        const data = await res.json();
        if (data.status === 'decided') {
          setStatus('decided');
          setSolicitud(data.solicitud);
          return;
        }
        setStatus('ready');
        setSolicitud(data.solicitud);
      } catch {
        setStatus('error');
      }
    })();
  }, [token]);

  const forwardRequest = async () => {
    if (!forwardTo || forwarding) return;
    setForwarding(true);
    try {
      const res = await fetch(`/api/solicitudes/by-token/${token}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toApproverId: forwardTo.id, note: forwardNote.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'No se pudo remitir la solicitud.');
        return;
      }
      const data = await res.json();
      setForwardedToName(data.new_approver_nombre || forwardTo.nombre);
      setStatus('forwarded');
      setShowForward(false);
    } finally {
      setForwarding(false);
    }
  };

  const decide = async (estado: 'aprobado' | 'rechazado') => {
    if (deciding) return;
    setDeciding(estado);
    try {
      const res = await fetch(`/api/solicitudes/by-token/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, motivoRespuesta: motivo.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'No se pudo registrar la decisión.');
        setDeciding(null);
        return;
      }
      setDecisionResult(estado);
      setStatus('decided');
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Brand header */}
        <header className="text-center mb-8">
          <img
            src="https://www.merquellantas.com/assets/images/logo/Logo-Merquellantas.png"
            alt="Merquellantas"
            className="h-10 mx-auto"
          />
          <p className="mt-3 text-sm text-gray-500">Aprobación de solicitud</p>
        </header>

        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
            <Loader2 className="h-8 w-8 animate-spin text-[#f4a900] mx-auto mb-3" />
            <p className="text-gray-600">Cargando solicitud...</p>
          </div>
        )}

        {status === 'not_found' && (
          <ErrorCard
            icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
            title="Enlace no válido"
            body="No encontramos una solicitud con este enlace. Puede que el link esté mal copiado o que la solicitud haya sido eliminada."
          />
        )}
        {status === 'expired' && (
          <ErrorCard
            icon={<Clock className="h-8 w-8 text-amber-500" />}
            title="Enlace vencido"
            body="Este enlace ya no es válido. Pídele al empleado que vuelva a enviar la solicitud para recibir un nuevo enlace."
          />
        )}
        {status === 'error' && (
          <ErrorCard
            icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
            title="Hubo un problema"
            body="No pudimos cargar los datos. Intenta abrir el enlace de nuevo en unos minutos."
          />
        )}

        {status === 'decided' && solicitud && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <DecidedBanner
              estado={(decisionResult ?? (solicitud.estado as 'aprobado' | 'rechazado')) || 'aprobado'}
            />
            <div className="p-6">
              <SolicitudSummary s={solicitud} />
              {solicitud.motivo_respuesta && (
                <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Motivo de la respuesta
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{solicitud.motivo_respuesta}</p>
                </div>
              )}
              <p className="mt-6 text-xs text-gray-500 text-center">
                Gracias por gestionar esta solicitud. Puedes cerrar esta pestaña.
              </p>
            </div>
          </div>
        )}

        {status === 'ready' && solicitud && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-black to-gray-900 text-white p-5 sm:p-6 relative overflow-hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{ backgroundImage: 'radial-gradient(circle at 90% 30%, #f4a900 0, transparent 50%)' }}
              />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-extrabold text-lg">Solicitud de {solicitud.tipo}</h1>
                  {solicitud.approver_nombre && (
                    <p className="text-xs text-white/70">
                      Hola {solicitud.approver_nombre}, esta solicitud te fue designada como jefe inmediato.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <SolicitudSummary s={solicitud} />

              <div className="mt-6">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
                  Motivo de la respuesta (opcional)
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Puedes dejar un comentario visible para el empleado..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-transparent text-sm resize-none text-gray-900 placeholder:text-gray-400"
                />
                <div className="text-right text-[10px] text-gray-400 mt-0.5">
                  {motivo.length}/1000
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  disabled={!!deciding}
                  onClick={() => decide('rechazado')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-red-300 text-red-700 font-bold hover:bg-red-50 active:scale-95 transition disabled:opacity-50"
                >
                  {deciding === 'rechazado' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-5 w-5" />}
                  Rechazar
                </button>
                <button
                  disabled={!!deciding}
                  onClick={() => decide('aprobado')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#f4a900] text-black font-bold hover:opacity-90 active:scale-95 transition disabled:opacity-50 shadow"
                >
                  {deciding === 'aprobado' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Aprobar
                </button>
              </div>

              <p className="mt-4 text-[11px] text-gray-500 text-center">
                Este enlace es de un solo uso. Una vez decidas, no podrá usarse de nuevo.
              </p>

              {/* Mis-designated? Remit to the correct supervisor. */}
              <div className="mt-6 pt-5 border-t border-dashed border-gray-200">
                <p className="text-xs text-gray-600 text-center">
                  Si tú no eres el jefe inmediato y crees que esto fue un error,{' '}
                  <button
                    type="button"
                    onClick={() => setShowForward(true)}
                    className="inline-flex items-center gap-1 font-semibold text-[#b47e00] hover:text-[#f4a900] underline underline-offset-2"
                  >
                    <CornerUpRight className="h-3.5 w-3.5" />
                    remitir al jefe correcto
                  </button>
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'forwarded' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                  <CornerUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-extrabold text-lg">Solicitud remitida</h1>
                  <p className="text-xs opacity-90">
                    Se reenvió a {forwardedToName ?? 'la persona seleccionada'}.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 text-sm text-gray-700 leading-relaxed">
              Listo — esta solicitud ya no aparecerá en tu bandeja. La persona que
              indicaste recibirá un correo con un nuevo enlace para revisarla. Tu
              enlace anterior quedó inactivo automáticamente.
              <p className="mt-4 text-xs text-gray-500 text-center">
                Puedes cerrar esta pestaña.
              </p>
            </div>
          </div>
        )}

        {showForward && solicitud && (
          <ForwardModal
            token={token}
            currentApproverName={solicitud.approver_nombre}
            value={forwardTo}
            onChange={setForwardTo}
            note={forwardNote}
            onNoteChange={setForwardNote}
            onClose={() => {
              if (forwarding) return;
              setShowForward(false);
              setForwardTo(null);
              setForwardNote('');
            }}
            onSubmit={forwardRequest}
            loading={forwarding}
          />
        )}

        <p className="mt-8 text-center text-[11px] text-gray-400">
          Sistema de Bienestar · Merquellantas
        </p>
      </div>
    </div>
  );
}

/**
 * Searchable picker + form that lives inside the approval page so the jefe can
 * forward the request to the correct supervisor without ever signing in.
 */
function ForwardModal({
  token,
  currentApproverName,
  value,
  onChange,
  note,
  onNoteChange,
  onClose,
  onSubmit,
  loading,
}: {
  token: string;
  currentApproverName: string | null;
  value: JefeOption | null;
  onChange: (j: JefeOption | null) => void;
  note: string;
  onNoteChange: (n: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JefeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value) return; // once picked, stop hitting the API
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/solicitudes/by-token/${token}/users?q=${encodeURIComponent(query)}&limit=20`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults((data.results as JefeOption[]) ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md text-gray-900 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-black to-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
              <CornerUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base">Remitir al jefe correcto</h2>
              <p className="text-xs text-white/70">
                {currentApproverName
                  ? `Originalmente asignada a ${currentApproverName}.`
                  : 'Elige a la persona correcta.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {value ? (
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{value.nombre}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {value.cargo || '—'} · CC {value.cedula}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setListOpen(true);
                }}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-800 hover:bg-white"
                title="Cambiar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
                Buscar jefe
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setListOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setListOpen(true);
                  }}
                  placeholder="Nombre, apellido o cédula..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f4a900]"
                />
              </div>
              {listOpen && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200">
                  {searching ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                    </div>
                  ) : results.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-500">
                      Sin coincidencias.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onChange(r);
                              setListOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#f4a900]/5 focus:bg-[#f4a900]/5 focus:outline-none"
                          >
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {r.nombre}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
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
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
              Nota (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Cuéntale al nuevo jefe por qué le remites la solicitud..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400 resize-none"
            />
            <div className="text-right text-[10px] text-gray-400 mt-0.5">
              {note.length}/500
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={!value || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Remitir y notificar
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
        {icon}
      </div>
      <h2 className="font-bold text-gray-900 text-lg mb-2">{title}</h2>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

function DecidedBanner({ estado }: { estado: 'aprobado' | 'rechazado' }) {
  const isApproved = estado === 'aprobado';
  return (
    <div
      className={`p-5 text-white ${
        isApproved ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
          {isApproved ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </div>
        <div>
          <h1 className="font-extrabold text-lg">
            Solicitud {isApproved ? 'aprobada' : 'rechazada'}
          </h1>
          <p className="text-xs opacity-90">Gracias por gestionar esta solicitud.</p>
        </div>
      </div>
    </div>
  );
}

function SolicitudSummary({ s }: { s: Solicitud }) {
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  return (
    <div className="space-y-4">
      <Field icon={<UserIcon className="h-4 w-4" />} label="Solicitante">
        <p className="font-semibold text-gray-900">{s.nombre}</p>
        <p className="text-xs text-gray-500">CC {s.cedula}</p>
      </Field>

      {s.tipo === 'permiso' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field icon={<Calendar className="h-4 w-4" />} label="Fecha">
            <p className="text-sm text-gray-900">{formatDate(s.fecha)}</p>
          </Field>
          <Field icon={<Clock className="h-4 w-4" />} label="Desde">
            <p className="text-sm text-gray-900">{s.tiempo_inicio || '—'}</p>
          </Field>
          <Field icon={<Clock className="h-4 w-4" />} label="Hasta">
            <p className="text-sm text-gray-900">{s.tiempo_fin || '—'}</p>
          </Field>
        </div>
      )}

      {s.tipo === 'vacaciones' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field icon={<Calendar className="h-4 w-4" />} label="Inicio">
            <p className="text-sm text-gray-900">{formatDate(s.fecha_inicio)}</p>
          </Field>
          <Field icon={<Calendar className="h-4 w-4" />} label="Fin">
            <p className="text-sm text-gray-900">{formatDate(s.fecha_fin)}</p>
          </Field>
          <Field icon={<Clock className="h-4 w-4" />} label="Días">
            <p className="text-sm text-gray-900 font-semibold">
              {s.dias_vacaciones ?? '—'} {s.dias_vacaciones === 1 ? 'día' : 'días'}
            </p>
          </Field>
        </div>
      )}

      {s.description && (
        <Field icon={<Info className="h-4 w-4" />} label="Motivo del empleado">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.description}</p>
        </Field>
      )}

      {s.document_urls && s.document_urls.length > 0 && (
        <Field icon={<FileText className="h-4 w-4" />} label="Adjuntos">
          <ul className="space-y-1">
            {s.document_urls.map((d, i) => (
              <li key={i}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-[#b47e00] hover:text-[#f4a900] underline break-all"
                >
                  {d.name || `Adjunto ${i + 1}`}
                </a>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-1">
        <span className="text-[#f4a900]">{icon}</span>
        {label}
      </p>
      {children}
    </div>
  );
}
