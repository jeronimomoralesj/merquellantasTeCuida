'use client';

import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import DashboardNavbar from '../navbar';

interface YearEntry {
  year: number;
  updated_at: string | null;
}

const CertificadoPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState<YearEntry[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/certificados/me');
        if (!res.ok) {
          setYears([]);
          return;
        }
        const data = await res.json();
        setYears(data.years ?? []);
      } catch {
        setYears([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function download(year: number) {
    setDownloading(year);
    try {
      const res = await fetch(`/api/certificados/download?year=${year}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'No se pudo descargar el certificado.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado_ingresos_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="" />
      <main className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-black text-white shadow-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 10% 20%, #f4a900 0, transparent 45%), radial-gradient(circle at 90% 90%, #f4a900 0, transparent 35%)',
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#f4a900] to-transparent" />
            <div className="relative p-6 sm:p-8 lg:p-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4a900]/15 text-[#f4a900] text-xs font-semibold uppercase tracking-wider border border-[#f4a900]/30">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Documentos tributarios
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
                Certificado de <span className="text-[#f4a900]">ingresos y retenciones</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/70">
                Descarga tu certificado oficial en formato 220 del DIAN para declaración de renta.
              </p>
            </div>
          </section>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Mis certificados disponibles</h2>
              <p className="text-xs text-gray-500 mt-1">
                Cada certificado corresponde al año inmediatamente anterior al actual.
              </p>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
              </div>
            ) : years.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 mb-3">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-700 font-semibold">
                  Aún no hay certificados cargados para tu cédula.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Los certificados del año gravable deben quedar cargados por talento humano antes del
                  30 de marzo del año siguiente. Si ya pasó esta fecha y no ves el tuyo, por favor
                  comunícate con el área de nómina.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {years.map((y) => (
                  <li key={y.year} className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-bold text-gray-900">
                        Año gravable {y.year}
                      </p>
                      {y.updated_at && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Última actualización: {new Date(y.updated_at).toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => download(y.year)}
                      disabled={downloading === y.year}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow"
                    >
                      {downloading === y.year ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Descargar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CertificadoPage;
