'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

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

type Status = 'loading' | 'ready' | 'decided' | 'expired' | 'not_found' | 'error';

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
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-gray-400">
          Sistema de Bienestar · Merquellantas
        </p>
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
