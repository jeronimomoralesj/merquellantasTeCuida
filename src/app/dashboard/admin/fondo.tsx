"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Eye,
  RefreshCw,
} from "lucide-react";

interface Movimiento {
  user_id: string;
  nombre: string;
  cedula: string;
  aporte: number | string;
  actividad: number | string;
  credito_pago: number | string;
  cartera_id: string;
  [key: string]: unknown;
}

interface CambioAdmin {
  user_id: string;
  nombre: string;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}

interface Ciclo {
  _id: string;
  periodo: string;
  tipo: string;
  estado: string;
  movimientos: Movimiento[];
  movimientos_admin: Movimiento[] | null;
  cambios_admin: CambioAdmin[] | null;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
}

interface NotificationState {
  message: string;
  type: "success" | "error" | "info";
}

const EDITABLE_FIELDS: string[] = [
  "nombre",
  "cedula",
  "aporte",
  "actividad",
  "credito_pago",
  "cartera_id",
];

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  cedula: "Cédula",
  aporte: "Aporte",
  actividad: "Actividad",
  credito_pago: "Crédito Pago",
  cartera_id: "Cartera ID",
};

export default function FondoAdminCard() {
  const [pendingCycles, setPendingCycles] = useState<Ciclo[]>([]);
  const [approvedCycles, setApprovedCycles] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPending, setExpandedPending] = useState<Record<string, boolean>>({});
  const [expandedApproved, setExpandedApproved] = useState<Record<string, boolean>>({});
  const [editedMovimientos, setEditedMovimientos] = useState<Record<string, Movimiento[]>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [tab, setTab] = useState<"pendientes" | "aprobados">("pendientes");

  const formatDate = (d: string | undefined): string => {
    if (!d) return "Sin fecha";
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Fecha inválida";
    }
  };

  const formatCurrency = (val: number | string): string => {
    const n = Number(val);
    if (isNaN(n)) return "$0";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
  };

  const fetchCycles = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendRes, apprRes] = await Promise.all([
        fetch("/api/fondo/ciclos?estado=enviado_admin"),
        fetch("/api/fondo/ciclos?estado=aprobado"),
      ]);
      if (!pendRes.ok || !apprRes.ok) throw new Error("Error al cargar ciclos");
      const pending: Ciclo[] = await pendRes.json();
      const approved: Ciclo[] = await apprRes.json();
      setPendingCycles(pending);
      setApprovedCycles(approved);

      // Initialize editable movimientos for pending cycles
      const edits: Record<string, Movimiento[]> = {};
      pending.forEach((c) => {
        edits[c._id] = JSON.parse(JSON.stringify(c.movimientos));
      });
      setEditedMovimientos(edits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleFieldChange = (cycleId: string, rowIdx: number, field: string, value: string) => {
    setEditedMovimientos((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[cycleId] && copy[cycleId][rowIdx]) {
        copy[cycleId][rowIdx][field] = value;
      }
      return copy;
    });
  };

  const exportCSV = (cycleId: string) => {
    const movs = editedMovimientos[cycleId];
    if (!movs || movs.length === 0) return;

    const headers = EDITABLE_FIELDS.join(",");
    const rows = movs.map((m) =>
      EDITABLE_FIELDS.map((f) => {
        const val = String(m[f] ?? "");
        // Escape commas and quotes in CSV
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fondo_ciclo_${cycleId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCSV = (cycleId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split("\n");
        if (lines.length < 2) {
          setNotification({ message: "El archivo CSV está vacío o solo tiene encabezados", type: "error" });
          return;
        }

        // Skip header row
        const dataLines = lines.slice(1);
        const originalMovs = editedMovimientos[cycleId];
        if (!originalMovs) return;

        const parsed: Movimiento[] = dataLines.map((line, i) => {
          // Simple CSV parsing: handle quoted fields
          const fields: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (ch === '"') {
              if (inQuotes && line[c + 1] === '"') {
                current += '"';
                c++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === "," && !inQuotes) {
              fields.push(current.trim());
              current = "";
            } else {
              current += ch;
            }
          }
          fields.push(current.trim());

          const base = originalMovs[i] ? { ...originalMovs[i] } : {
            user_id: "",
            nombre: "",
            cedula: "",
            aporte: 0,
            actividad: 0,
            credito_pago: 0,
            cartera_id: "",
          };

          EDITABLE_FIELDS.forEach((f, idx) => {
            if (idx < fields.length) {
              (base as Record<string, unknown>)[f] = fields[idx];
            }
          });

          return base;
        });

        setEditedMovimientos((prev) => ({ ...prev, [cycleId]: parsed }));
        setNotification({ message: "CSV importado correctamente", type: "success" });
      } catch {
        setNotification({ message: "Error al procesar el archivo CSV", type: "error" });
      }
    };
    reader.readAsText(file);
  };

  const handleAction = async (cycleId: string, action: "aprobar" | "rechazar") => {
    setProcessingId(cycleId);
    try {
      const payload: Record<string, unknown> = { id: cycleId, action };
      if (action === "aprobar") {
        payload.movimientos = editedMovimientos[cycleId];
      }

      const res = await fetch("/api/fondo/ciclos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar");
      }

      setNotification({
        message: action === "aprobar" ? "Ciclo aprobado exitosamente" : "Ciclo rechazado",
        type: action === "aprobar" ? "success" : "info",
      });
      await fetchCycles();
    } catch (err) {
      setNotification({
        message: err instanceof Error ? err.message : "Error al procesar",
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const togglePending = (id: string) => {
    setExpandedPending((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleApproved = (id: string) => {
    setExpandedApproved((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando ciclos del fondo...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={fetchCycles} className="ml-auto text-sm text-blue-600 hover:underline flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 text-sm font-medium ${
            notification.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : notification.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : notification.type === "error" ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab("pendientes")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              tab === "pendientes"
                ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Pendientes ({pendingCycles.length})
            </div>
          </button>
          <button
            onClick={() => setTab("aprobados")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              tab === "aprobados"
                ? "text-green-600 border-b-2 border-green-500 bg-green-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Aprobados ({approvedCycles.length})
            </div>
          </button>
        </div>

        <div className="p-6">
          {/* Pending Cycles */}
          {tab === "pendientes" && (
            <div className="space-y-4">
              {pendingCycles.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay ciclos pendientes por aprobar</p>
                </div>
              ) : (
                pendingCycles.map((cycle) => (
                  <div key={cycle._id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Card Header */}
                    <button
                      onClick={() => togglePending(cycle._id)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Periodo: {cycle.periodo}</p>
                          <p className="text-xs text-gray-500">
                            Enviado {formatDate(cycle.created_at)} &middot; {cycle.movimientos.length} movimientos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">
                          Pendiente
                        </span>
                        {expandedPending[cycle._id] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedPending[cycle._id] && (
                      <div className="p-5 space-y-4">
                        {/* Toolbar */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => exportCSV(cycle._id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Exportar CSV
                          </button>
                          <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                            <Upload className="w-4 h-4" />
                            Importar CSV
                            <input
                              type="file"
                              accept=".csv"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadCSV(cycle._id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {/* Editable Table */}
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                                {EDITABLE_FIELDS.map((f) => (
                                  <th key={f} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    {FIELD_LABELS[f] || f}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(editedMovimientos[cycle._id] || []).map((mov, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                                  {EDITABLE_FIELDS.map((f) => (
                                    <td key={f} className="px-1 py-1">
                                      <input
                                        type="text"
                                        value={String((mov as Record<string, unknown>)[f] ?? "")}
                                        onChange={(e) => handleFieldChange(cycle._id, idx, f as string, e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors bg-white"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => handleAction(cycle._id, "aprobar")}
                            disabled={processingId === cycle._id}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingId === cycle._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleAction(cycle._id, "rechazar")}
                            disabled={processingId === cycle._id}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingId === cycle._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Approved Cycles */}
          {tab === "aprobados" && (
            <div className="space-y-4">
              {approvedCycles.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay ciclos aprobados aún</p>
                </div>
              ) : (
                approvedCycles.map((cycle) => (
                  <div key={cycle._id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleApproved(cycle._id)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Periodo: {cycle.periodo}</p>
                          <p className="text-xs text-gray-500">
                            Aprobado {formatDate(cycle.approved_at || undefined)} &middot; {cycle.movimientos.length} movimientos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200 font-medium">
                          Aprobado
                        </span>
                        {expandedApproved[cycle._id] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {expandedApproved[cycle._id] && (
                      <div className="p-5 space-y-4">
                        {/* Final Movimientos Table (read-only) */}
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                                {EDITABLE_FIELDS.map((f) => (
                                  <th key={f} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    {FIELD_LABELS[f] || f}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(cycle.movimientos_admin || cycle.movimientos).map((mov, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                                  {EDITABLE_FIELDS.map((f) => (
                                    <td key={f} className="px-3 py-2 text-gray-700">
                                      {["aporte", "actividad", "credito_pago"].includes(f)
                                        ? formatCurrency((mov as Record<string, unknown>)[f] as number)
                                        : String((mov as Record<string, unknown>)[f] ?? "-")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Admin Changes */}
                        {cycle.cambios_admin && cycle.cambios_admin.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Cambios realizados por el administrador
                            </h4>
                            <div className="space-y-2">
                              {cycle.cambios_admin.map((cambio, idx) => (
                                <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <p className="text-sm font-medium text-amber-800">{cambio.nombre}</p>
                                  <div className="mt-1 space-y-1">
                                    {Object.entries(cambio.cambios).map(([field, diff]) => (
                                      <p key={field} className="text-xs text-amber-700">
                                        <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{" "}
                                        <span className="line-through text-red-500">{String(diff.antes)}</span>{" "}
                                        <span className="text-green-700 font-semibold">{String(diff.despues)}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!cycle.cambios_admin || cycle.cambios_admin.length === 0) && (
                          <p className="text-sm text-gray-400 italic">Sin cambios del administrador</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
