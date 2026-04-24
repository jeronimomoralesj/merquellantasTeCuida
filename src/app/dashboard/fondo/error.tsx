"use client";

// App Router error boundary for /dashboard/fondo. Replaces Next.js's generic
// "Application error" white screen with something the fondo user can act on.
// Added after a report of the Buscar Afiliado tab going blank on an older
// Chrome build — even if we fix the root cause, this keeps the fallback
// useful next time a client exception slips through.
import React, { useEffect } from "react";

export default function FondoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("[fondo] client error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Se produjo un error</h2>
        <p className="text-sm text-gray-600 mb-4">
          Ocurrió un problema al mostrar el panel de Fonalmerque. Puedes intentar de nuevo o recargar la página.
        </p>
        {error?.message && (
          <p className="text-xs text-gray-400 mb-4 break-words font-mono">{error.message}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:bg-[#e68a00]"
          >
            Reintentar
          </button>
          <button
            onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200"
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}
