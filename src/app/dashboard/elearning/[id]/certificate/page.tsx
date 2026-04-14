"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Download, Award, Loader2 } from "lucide-react";

interface CertData {
  course_title: string;
  user_name: string;
  completed_at: string;
}

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const { status } = useSession();
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = async () => {
      try {
        const res = await fetch(`/api/elearning/certificate/${courseId}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al cargar certificado");
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, courseId]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f4a900]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error || "Certificado no disponible"}</p>
          <a
            href={`/dashboard/elearning/${courseId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al curso
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 print:py-0 print:px-0 print:bg-white">
      {/* Action bar (hidden on print) */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <a
          href={`/dashboard/elearning/${courseId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al curso
        </a>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:bg-[#f4a900] shadow"
        >
          <Download className="w-4 h-4" />
          Descargar / Imprimir
        </button>
      </div>

      {/* Certificate */}
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden print:shadow-none print:rounded-none print:max-w-none">
        <div className="relative aspect-[1.414/1] bg-white p-8 sm:p-14">
          {/* Decorative border */}
          <div className="absolute inset-4 border-[3px] border-[#f4a900] rounded pointer-events-none" />
          <div className="absolute inset-6 border border-[#f4a900]/40 rounded pointer-events-none" />

          {/* Corner ornaments */}
          <div className="absolute top-4 left-4 w-16 h-16 border-t-[6px] border-l-[6px] border-[#f4a900] rounded-tl pointer-events-none" />
          <div className="absolute top-4 right-4 w-16 h-16 border-t-[6px] border-r-[6px] border-[#f4a900] rounded-tr pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-16 h-16 border-b-[6px] border-l-[6px] border-[#f4a900] rounded-bl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-16 h-16 border-b-[6px] border-r-[6px] border-[#f4a900] rounded-br pointer-events-none" />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-between text-center">
            {/* Logo */}
            <div className="flex flex-col items-center">
              <img
                src="https://www.merquellantas.com/assets/images/logo/Logo-Merquellantas.png"
                alt="Merquellantas"
                className="h-16 sm:h-20 w-auto mb-4"
              />
              <div className="flex items-center gap-2">
                <div className="h-px w-12 bg-[#f4a900]" />
                <Award className="w-6 h-6 text-[#f4a900]" />
                <div className="h-px w-12 bg-[#f4a900]" />
              </div>
            </div>

            {/* Title */}
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <p className="text-xs sm:text-sm uppercase tracking-[0.35em] text-gray-500 mb-3">
                Certificado de participación
              </p>
              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-gray-900 mb-6 tracking-wide">
                ¡Felicidades!
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-2">Se otorga el presente certificado a</p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#f4a900] my-3 px-6 border-b-2 border-[#f4a900]/40 pb-2">
                {data.user_name}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mt-4 max-w-2xl leading-relaxed">
                Por haber completado satisfactoriamente el curso
              </p>
              <p className="mt-3 text-lg sm:text-2xl font-semibold text-gray-800 italic max-w-3xl">
                “{data.course_title}”
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-end justify-between w-full gap-6 pt-4">
              <div className="text-center">
                <div className="h-px w-40 bg-gray-400 mb-1" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">Fecha</p>
                <p className="text-sm font-semibold text-gray-800">{formatDate(data.completed_at)}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-4 border-[#f4a900] flex items-center justify-center bg-white">
                  <Award className="w-8 h-8 text-[#f4a900]" />
                </div>
                <p className="text-[10px] font-bold text-[#f4a900] mt-1 uppercase tracking-wider">Merquellantas</p>
              </div>
              <div className="text-center">
                <div className="h-px w-40 bg-gray-400 mb-1" />
                <p className="text-xs text-gray-500 uppercase tracking-wider">Emitido por</p>
                <p className="text-sm font-semibold text-gray-800">Merquellantas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
