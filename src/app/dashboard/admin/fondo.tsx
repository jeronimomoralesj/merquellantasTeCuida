"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  RefreshCw,
  DollarSign,
} from "lucide-react";

interface CreditPayment {
  cartera_id: string;
  credito_id: string;
  monto: number;
}

interface Movimiento {
  user_id: string;
  nombre: string;
  cedula: string;
  aporte: number;
  actividad: number;
  creditos?: CreditPayment[];
  credito_pago_total?: number;
  // Legacy field for old cycles
  credito_pago?: number;
}

interface BudgetAdjustment {
  user_id: string;
  nombre: string;
  total_anterior: number;
  total_nuevo: number;
}

interface Ciclo {
  _id: string;
  periodo: string;
  estado: string;
  movimientos: Movimiento[];
  movimientos_admin: BudgetAdjustment[] | null;
  created_at: string;
  approved_at: string | null;
  revision_count?: number;
}

interface NotificationState {
  message: string;
  type: "success" | "error" | "info";
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n || 0);

const formatPeriodoLabel = (periodo: string): string => {
  const parts = periodo.split("-");
  if (parts.length < 3) return periodo;
  const [y, m, h] = parts;
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${h === "A" ? "1ra quincena" : "2da quincena"} de ${monthNames[parseInt(m) - 1] || m} ${y}`;
};

// Compute total for a movement
function computeMovTotal(m: Movimiento): number {
  let creditTotal = 0;
  if (Array.isArray(m.creditos)) {
    creditTotal = m.creditos.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  } else if (typeof m.credito_pago_total === "number") {
    creditTotal = m.credito_pago_total;
  } else if (typeof m.credito_pago === "number") {
    creditTotal = m.credito_pago;
  }
  return (Number(m.aporte) || 0) + (Number(m.actividad) || 0) + creditTotal;
}

export default function FondoAdminCard() {
  const [pendingCycles, setPendingCycles] = useState<Ciclo[]>([]);
  const [approvedCycles, setApprovedCycles] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adjustments, setAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [activeTab, setActiveTab] = useState<"pendientes" | "aprobados">("pendientes");

  const showNotification = (message: string, type: NotificationState["type"]) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch("/api/fondo/ciclos?estado=enviado_admin"),
        fetch("/api/fondo/ciclos?estado=aprobado"),
      ]);
      const pending: Ciclo[] = pRes.ok ? await pRes.json() : [];
      const approved: Ciclo[] = aRes.ok ? await aRes.json() : [];
      setPendingCycles(pending);
      setApprovedCycles(approved);

      // Initialize adjustments map: cycleId → {user_id: total}
      const adj: Record<string, Record<string, number>> = {};
      for (const c of pending) {
        const cycleAdj: Record<string, number> = {};
        for (const m of c.movimientos) {
          cycleAdj[m.user_id] = computeMovTotal(m);
        }
        adj[c._id] = cycleAdj;
      }
      setAdjustments(adj);
    } catch {
      setError("Error al cargar los ciclos del fondo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const updateAdjustment = (cycleId: string, userId: string, value: string) => {
    setAdjustments((prev) => ({
      ...prev,
      [cycleId]: {
        ...prev[cycleId],
        [userId]: Number(value) || 0,
      },
    }));
  };

  // Compare current adjustments to original totals
  const hasChanges = (cycle: Ciclo): boolean => {
    const adj = adjustments[cycle._id];
    if (!adj) return false;
    for (const m of cycle.movimientos) {
      const original = computeMovTotal(m);
      if ((adj[m.user_id] ?? original) !== original) return true;
    }
    return false;
  };

  const handleApprove = async (cycle: Ciclo) => {
    setProcessing(cycle._id);
    try {
      const changed = hasChanges(cycle);

      if (!changed) {
        // No changes — apply directly
        const res = await fetch("/api/fondo/ciclos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cycle._id, action: "aprobar" }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error");
        showNotification("Ciclo aprobado y aplicado correctamente", "success");
      } else {
        // Send back to fondo with the new budgets
        const adj = adjustments[cycle._id] || {};
        const budget_adjustments: BudgetAdjustment[] = cycle.movimientos.map((m) => ({
          user_id: m.user_id,
          nombre: m.nombre,
          total_anterior: computeMovTotal(m),
          total_nuevo: adj[m.user_id] ?? computeMovTotal(m),
        }));

        const res = await fetch("/api/fondo/ciclos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cycle._id, action: "ajustes", budget_adjustments }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error");
        showNotification("Ajustes enviados al fondo para redistribución", "info");
      }

      await fetchCycles();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (cycle: Ciclo) => {
    const motivo = prompt("Motivo del rechazo (opcional):") || "";
    setProcessing(cycle._id);
    try {
      const res = await fetch("/api/fondo/ciclos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle._id, action: "rechazar", motivo_rechazo: motivo }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      showNotification("Ciclo rechazado", "success");
      await fetchCycles();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setProcessing(null);
    }
  };

  const renderCycleTable = (cycle: Ciclo, isApproved: boolean = false) => {
    const adj = adjustments[cycle._id] || {};
    const totalCiclo = cycle.movimientos.reduce((s, m) => s + computeMovTotal(m), 0);
    const totalAdjusted = cycle.movimientos.reduce((s, m) => s + (adj[m.user_id] ?? computeMovTotal(m)), 0);

    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Cédula</th>
              <th className="px-4 py-3 text-right">Total propuesto</th>
              {!isApproved && <th className="px-4 py-3 text-right">Total ajustado</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cycle.movimientos.map((m) => {
              const propuesto = computeMovTotal(m);
              const ajustado = adj[m.user_id] ?? propuesto;
              const changed = ajustado !== propuesto;
              return (
                <tr key={m.user_id} className={changed ? "bg-amber-50/50" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {m.nombre}
                    {changed && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 uppercase">
                        Modificado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.cedula}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(propuesto)}</td>
                  {!isApproved && (
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={ajustado}
                        onChange={(e) => updateAdjustment(cycle._id, m.user_id, e.target.value)}
                        className={`w-32 text-right rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                          changed
                            ? "border-amber-300 bg-white focus:ring-amber-300/40"
                            : "border-gray-200 focus:ring-blue-300/40"
                        }`}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={2} className="px-4 py-3 text-gray-900">Total del ciclo</td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(totalCiclo)}</td>
              {!isApproved && (
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {fmt(totalAdjusted)}
                  {totalAdjusted !== totalCiclo && (
                    <span className={`ml-2 text-xs font-semibold ${totalAdjusted < totalCiclo ? "text-emerald-600" : "text-red-600"}`}>
                      ({totalAdjusted > totalCiclo ? "+" : ""}{fmt(totalAdjusted - totalCiclo)})
                    </span>
                  )}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-purple-500" />
            Fondo de Empleados
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando ciclos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />

      <div className="p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-purple-500" />
            Fondo de Empleados
          </h2>
          <button
            onClick={fetchCycles}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {notification && (
          <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
            notification.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
            notification.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
            "bg-blue-50 border-blue-200 text-blue-800"
          }`}>
            {notification.type === "success" ? <CheckCircle size={16} /> : notification.type === "error" ? <XCircle size={16} /> : <AlertCircle size={16} />}
            {notification.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("pendientes")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "pendientes" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Pendientes ({pendingCycles.length})
          </button>
          <button
            onClick={() => setActiveTab("aprobados")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "aprobados" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Aprobados ({approvedCycles.length})
          </button>
        </div>

        {/* Cycles list */}
        <div className="space-y-3">
          {activeTab === "pendientes" && pendingCycles.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No hay ciclos pendientes de aprobación.
            </div>
          )}
          {activeTab === "aprobados" && approvedCycles.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              No hay ciclos aprobados.
            </div>
          )}

          {(activeTab === "pendientes" ? pendingCycles : approvedCycles).map((cycle) => {
            const isOpen = !!expanded[cycle._id];
            const totalCiclo = cycle.movimientos.reduce((s, m) => s + computeMovTotal(m), 0);
            const isApproved = activeTab === "aprobados";
            const changed = !isApproved && hasChanges(cycle);

            return (
              <div key={cycle._id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [cycle._id]: !prev[cycle._id] }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{formatPeriodoLabel(cycle.periodo)}</p>
                      <p className="text-xs text-gray-500">
                        {cycle.movimientos.length} usuarios · Total: <strong>{fmt(totalCiclo)}</strong>
                      </p>
                    </div>
                    {cycle.revision_count && cycle.revision_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        Revisión {cycle.revision_count}
                      </span>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="p-4 bg-gray-50/50 border-t border-gray-200 space-y-4">
                    {!isApproved && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                        <p className="font-semibold mb-1">Solo se muestra el total por usuario.</p>
                        <p>Si necesitas reducir o aumentar el presupuesto de algún usuario, ajusta el total en la columna de la derecha. Si haces cambios, el ciclo regresará al fondo para que redistribuya el dinero entre las categorías.</p>
                      </div>
                    )}

                    {renderCycleTable(cycle, isApproved)}

                    {!isApproved && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleReject(cycle)}
                          disabled={processing === cycle._id}
                          className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-sm hover:bg-red-200 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          <XCircle size={16} /> Rechazar
                        </button>
                        <button
                          onClick={() => handleApprove(cycle)}
                          disabled={processing === cycle._id}
                          className={`px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2 ${
                            changed
                              ? "bg-amber-500 text-white hover:bg-amber-600"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {processing === cycle._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle size={16} />}
                          {changed ? "Enviar ajustes al fondo" : "Aprobar (sin cambios)"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
