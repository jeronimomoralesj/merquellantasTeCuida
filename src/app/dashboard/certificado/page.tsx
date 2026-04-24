'use client';

import React from 'react';
import { FileSpreadsheet, AlertTriangle } from 'lucide-react';
import DashboardNavbar from '../navbar';

// Certificate download is temporarily disabled. To re-enable, restore the list
// + download logic from git history and drop the "temporarily unavailable"
// block below.
const CertificadoPage: React.FC = () => {
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
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 mb-3">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-700 font-semibold">
                La descarga del certificado está temporalmente deshabilitada.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Estamos trabajando para habilitarla nuevamente. Si necesitas el certificado
                con urgencia, comunícate con el área de nómina.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CertificadoPage;
