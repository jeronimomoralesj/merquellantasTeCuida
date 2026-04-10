"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  Users,
  DollarSign,
  CreditCard,
  Check,
  Clock,
  ShieldAlert,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  X,
  UserPlus,
  Send,
  AlertCircle,
  History,
  Wallet,
  Activity,
  Landmark,
} from "lucide-react";
import DashboardNavbar from "../navbar";
import FondoUserView from "./user-view";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FondoMember {
  id: string;
  user_id: string;
  nombre: string;
  cedula: string;
  frecuencia: "quincenal" | "mensual";
  monto_aporte: number;
}

interface CycleRow {
  user_id: string;
  nombre: string;
  cedula: string;
  frecuencia: "quincenal" | "mensual";
  aporte: number;
  permanente: number;
  social: number;
  actividad: number;
  credito_pago: number;
}

interface CambioRow {
  user_id: string;
  nombre: string;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}

interface Ciclo {
  _id?: string;
  id?: string;
  periodo: string;
  estado: "enviado_admin" | "aprobado" | "rechazado";
  movimientos: CycleRow[];
  movimientos_admin?: CycleRow[] | null;
  cambios_admin?: CambioRow[] | null;
  created_at: string;
}

interface Saldos {
  permanente: number;
  social: number;
  actividad: number;
  intereses: number;
}

interface AporteHistorial {
  _id?: string;
  periodo: string;
  monto_total: number;
  monto_permanente: number;
  monto_social: number;
  fecha_ejecucion: string;
}

interface ActividadHistorial {
  _id?: string;
  tipo: "aporte" | "retiro";
  monto: number;
  descripcion?: string;
  fecha: string;
}

interface Credito {
  _id?: string;
  credito_id?: string;
  valor_prestamo: number;
  saldo_total: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  estado: string;
  pagos?: { numero_cuota: number; fecha_pago: string; monto_total: number; flagged?: boolean }[];
}

interface SearchUser {
  id: string;
  user_id?: string;
  nombre: string;
  cedula: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    enviado_admin: "bg-yellow-100 text-yellow-800 border-yellow-300",
    aprobado: "bg-green-100 text-green-800 border-green-300",
    rechazado: "bg-red-100 text-red-800 border-red-300",
  };
  const labels: Record<string, string> = {
    enviado_admin: "Enviado",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        map[estado] ?? "bg-gray-100 text-gray-800 border-gray-300"
      }`}
    >
      {labels[estado] ?? estado}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type TabId = "ciclo" | "solicitudes" | "historial" | "buscar" | "nuevo" | "csv";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "ciclo", label: "Ciclo Actual", icon: <DollarSign size={16} /> },
  { id: "solicitudes", label: "Solicitudes", icon: <CreditCard size={16} /> },
  { id: "historial", label: "Historial Ciclos", icon: <History size={16} /> },
  { id: "buscar", label: "Buscar Afiliado", icon: <Search size={16} /> },
  { id: "nuevo", label: "Nuevo Afiliado", icon: <UserPlus size={16} /> },
  { id: "csv", label: "Cargar CSV", icon: <Wallet size={16} /> },
];

/* ================================================================== */
/*  MAIN PAGE                                                          */
/* ================================================================== */

export default function FondoPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>("ciclo");

  /* ---- auth gate ---- */

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#ff9900] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Non-fondo users see their own fondo data (read-only user view)
  if (session.user.rol !== "fondo") {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <DashboardNavbar activePage="fondo" />
        <div className="pt-20 text-gray-900">
          <FondoUserView />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <DashboardNavbar activePage="fondo" />

      <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 text-gray-900">
        <div className="max-w-7xl mx-auto text-gray-900">
          {/* HERO */}
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-black text-white shadow-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 12% 20%, #ff9900 0, transparent 45%), radial-gradient(circle at 88% 90%, #ff9900 0, transparent 35%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff9900] to-transparent" />

            <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff9900]/15 text-[#ff9900] text-xs font-semibold uppercase tracking-wider border border-[#ff9900]/30">
                  <Landmark className="h-3.5 w-3.5" /> Fondo de Empleados
                </span>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
                  Panel del <span className="text-[#ff9900]">Fondo</span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-white/70">
                  Gestiona ciclos, aportes y afiliados del fondo de empleados.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: DollarSign, label: "Aportes" },
                  { icon: Users, label: "Afiliados" },
                  { icon: CreditCard, label: "Cartera" },
                  { icon: Activity, label: "Actividad" },
                ].map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80"
                  >
                    <c.icon className="h-3.5 w-3.5 text-[#ff9900]" />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === t.id
                    ? "bg-[#ff9900] text-white shadow-md shadow-[#ff9900]/25"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#ff9900]/40 hover:text-[#ff9900]"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "ciclo" && <CicloActualTab />}
          {activeTab === "solicitudes" && <SolicitudesTab />}
          {activeTab === "historial" && <HistorialTab />}
          {activeTab === "buscar" && <BuscarAfiliadoTab />}
          {activeTab === "nuevo" && <NuevoAfiliadoTab />}
          {activeTab === "csv" && <CargarCsvTab />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CICLO ACTUAL TAB                                                   */
/* ================================================================== */

function CicloActualTab() {
  const [members, setMembers] = useState<FondoMember[]>([]);
  const [rows, setRows] = useState<CycleRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Fetch members AND all active credits in parallel
        const [memRes, cartRes] = await Promise.all([
          fetch("/api/fondo/members"),
          fetch("/api/fondo/cartera?estado=activo"),
        ]);
        if (!memRes.ok) throw new Error("Error cargando miembros");
        const data: FondoMember[] = await memRes.json();
        setMembers(data);

        // Build map: user_id → total expected payment for this period
        // For each active credit, calculate cuota = (valor + total_interes) / numero_cuotas
        // Sum across all active credits for that user
        const debtByUser = new Map<string, number>();
        if (cartRes.ok) {
          const credits: Array<{
            user_id: string;
            valor_prestamo: number;
            tasa_interes: number;
            numero_cuotas: number;
            cuotas_restantes: number;
            saldo_total: number;
            frecuencia_pago?: string;
          }> = await cartRes.json();

          for (const c of credits) {
            if (c.cuotas_restantes <= 0) continue;
            // Cuota per period = saldo_total / cuotas_restantes (auto-adjusts to over/under payments)
            const cuota = Math.round(c.saldo_total / c.cuotas_restantes);
            debtByUser.set(c.user_id, (debtByUser.get(c.user_id) || 0) + cuota);
          }
        }

        setRows(
          data.map((m) => ({
            user_id: m.user_id,
            nombre: m.nombre,
            cedula: m.cedula,
            frecuencia: m.frecuencia,
            aporte: m.monto_aporte,
            permanente: +(m.monto_aporte * 0.9).toFixed(0),
            social: +(m.monto_aporte * 0.1).toFixed(0),
            actividad: 0,
            credito_pago: debtByUser.get(m.user_id) || 0,
          }))
        );
      } catch {
        setError("No se pudieron cargar los miembros del fondo.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateRow = useCallback(
    (idx: number, field: keyof CycleRow, value: string | number) => {
      setRows((prev) => {
        const next = [...prev];
        const row = { ...next[idx] };
        if (field === "frecuencia") {
          row.frecuencia = value as "quincenal" | "mensual";
        } else if (field === "aporte") {
          const n = Number(value) || 0;
          row.aporte = n;
          row.permanente = +(n * 0.9).toFixed(0);
          row.social = +(n * 0.1).toFixed(0);
        } else if (field === "actividad") {
          row.actividad = Number(value) || 0;
        } else if (field === "credito_pago") {
          row.credito_pago = Number(value) || 0;
        }
        next[idx] = row;
        return next;
      });
    },
    []
  );

  const filtered = useMemo(
    () => {
      const q = filter.toLowerCase().trim();
      if (!q) return rows;
      return rows.filter((r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.cedula || '').toLowerCase().includes(q)
      );
    },
    [rows, filter]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/fondo/ciclos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: currentPeriod(), movimientos: rows }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al enviar el ciclo");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-[#ff9900] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-[#ff9900]" />
            Ciclo Actual
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Periodo:{" "}
            <span className="font-semibold text-gray-800">
              {currentPeriod()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Filtrar por nombre o cédula..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900] w-56"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff9900] text-white font-semibold text-sm shadow-md shadow-[#ff9900]/25 hover:bg-[#e68a00] disabled:opacity-50 transition-all"
          >
            {submitting ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send size={16} />
            )}
            Aprobar y Enviar
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <Check size={16} /> Ciclo enviado exitosamente al administrador.
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cedula</th>
              <th className="px-4 py-3">Frecuencia</th>
              <th className="px-4 py-3 text-right">Aporte ($)</th>
              <th className="px-4 py-3 text-right">Permanente (90%)</th>
              <th className="px-4 py-3 text-right">Social (10%)</th>
              <th className="px-4 py-3 text-right">Actividad ($)</th>
              <th className="px-4 py-3 text-right">Crédito Pago ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((row) => {
              const idx = rows.findIndex((r) => r.user_id === row.user_id);
              return (
                <tr
                  key={row.user_id}
                  className="hover:bg-[#ff9900]/[0.03] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.cedula}</td>
                  <td className="px-4 py-3">
                    <select
                      value={row.frecuencia}
                      onChange={(e) =>
                        updateRow(idx, "frecuencia", e.target.value)
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900] bg-white"
                    >
                      <option value="quincenal">Quincenal (cada 15 dias)</option>
                      <option value="mensual">Mensual (cada mes)</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={row.aporte}
                      onChange={(e) =>
                        updateRow(idx, "aporte", e.target.value)
                      }
                      className="w-28 text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono">
                    {fmt(row.permanente)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 font-mono">
                    {fmt(row.social)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={row.actividad}
                      onChange={(e) =>
                        updateRow(idx, "actividad", e.target.value)
                      }
                      className="w-28 text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={row.credito_pago}
                      onChange={(e) =>
                        updateRow(idx, "credito_pago", e.target.value)
                      }
                      className="w-28 text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  No se encontraron miembros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HISTORIAL CICLOS TAB                                               */
/* ================================================================== */

function HistorialTab() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/fondo/ciclos");
        if (!res.ok) throw new Error("Error cargando ciclos");
        const data: Ciclo[] = await res.json();
        setCiclos(data);
      } catch {
        setError("No se pudieron cargar los ciclos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-[#ff9900] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <History size={20} className="text-[#ff9900]" />
          Historial de Ciclos
        </h2>
      </div>

      {ciclos.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400">
          No hay ciclos registrados.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {ciclos.map((c) => (
            <div key={(c._id || c.id) as string}>
              <button
                onClick={() => {
                  const cid = (c._id || c.id) as string;
                  setExpanded(expanded === cid ? null : cid);
                }}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-900">
                    {c.periodo}
                  </span>
                  {estadoBadge(c.estado)}
                  {c.cambios_admin && c.cambios_admin.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      <AlertCircle size={12} />
                      {c.cambios_admin.length} cambio{c.cambios_admin.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  <span className="text-xs">
                    {new Date(c.created_at).toLocaleDateString("es-CO")}
                  </span>
                  {expanded === (c._id || c.id) ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </div>
              </button>

              {expanded === (c._id || c.id) && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Build a map of changes by user_id for fast lookup */}
                  {(() => {
                    const cambiosMap = new Map<string, CambioRow>();
                    if (c.cambios_admin) {
                      for (const cambio of c.cambios_admin) {
                        cambiosMap.set(cambio.user_id, cambio);
                      }
                    }

                    // Use admin version if approved, otherwise the original proposal
                    const displayRows = c.movimientos_admin || c.movimientos || [];
                    const originalRows = c.movimientos || [];

                    return (
                      <>
                        {/* Legend */}
                        {cambiosMap.size > 0 && (
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="text-gray-500 font-semibold">Leyenda:</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                              <span className="text-gray-600">Modificado por admin</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-gray-400 line-through">propuesto</span>
                              <span>→</span>
                              <span className="text-emerald-700 font-semibold">real</span>
                            </span>
                          </div>
                        )}

                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <th className="px-3 py-2">Nombre</th>
                                <th className="px-3 py-2 text-right">Aporte</th>
                                <th className="px-3 py-2 text-right">Permanente</th>
                                <th className="px-3 py-2 text-right">Social</th>
                                <th className="px-3 py-2 text-right">Actividad</th>
                                <th className="px-3 py-2 text-right">Crédito Pago</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {displayRows.map((r, i) => {
                                const cambio = cambiosMap.get(r.user_id);
                                const original = originalRows[i];
                                const modified = !!cambio;
                                const renderCell = (field: string, value: number) => {
                                  const wasChanged = cambio?.cambios?.[field];
                                  if (!wasChanged || !original) {
                                    return <span className="text-gray-600">{fmt(value)}</span>;
                                  }
                                  const before = (original as unknown as Record<string, number>)[field];
                                  return (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className="text-gray-400 line-through text-xs">{fmt(before || 0)}</span>
                                      <span className="text-emerald-700 font-semibold">{fmt(value)}</span>
                                    </div>
                                  );
                                };
                                return (
                                  <tr
                                    key={i}
                                    className={`transition-colors ${
                                      modified
                                        ? "bg-amber-50 hover:bg-amber-100"
                                        : "hover:bg-gray-50"
                                    }`}
                                  >
                                    <td className="px-3 py-2 font-medium text-gray-900">
                                      {r.nombre}
                                      {modified && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-900 uppercase">
                                          Modificado
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right">{renderCell("aporte", r.aporte)}</td>
                                    <td className="px-3 py-2 text-right">{renderCell("permanente", r.permanente)}</td>
                                    <td className="px-3 py-2 text-right">{renderCell("social", r.social)}</td>
                                    <td className="px-3 py-2 text-right">{renderCell("actividad", r.actividad)}</td>
                                    <td className="px-3 py-2 text-right">{renderCell("credito_pago", r.credito_pago)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {cambiosMap.size === 0 && c.estado === "aprobado" && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
                            <Check size={16} />
                            Aprobado sin cambios por el administrador.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  BUSCAR AFILIADO TAB                                                */
/* ================================================================== */

function BuscarAfiliadoTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchUser | null>(null);

  /* profile data */
  const [saldos, setSaldos] = useState<Saldos | null>(null);
  const [aportes, setAportes] = useState<AporteHistorial[]>([]);
  const [actividades, setActividades] = useState<ActividadHistorial[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  /* collapsible sections */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    saldos: true,
    aportes: true,
    actividades: false,
    cartera: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setResults([]);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/fondo/members?search=${encodeURIComponent(query.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectUser = async (user: SearchUser) => {
    setSelected(user);
    setLoadingProfile(true);
    setSaldos(null);
    setAportes([]);
    setActividades([]);
    setCreditos([]);
    try {
      // The /api/fondo/saldos endpoint expects the USER id (not member id).
      // SearchUser.id from /api/fondo/members?search comes back as the member's _id,
      // but the result also has user_id. From /api/fondo/members?search_users it's the user's _id.
      const userId = user.user_id || user.id;
      const sRes = await fetch(`/api/fondo/saldos?user_id=${userId}`);
      if (sRes.ok) {
        const data = await sRes.json();
        if (data.saldos) setSaldos(data.saldos);
        if (Array.isArray(data.aportes)) setAportes(data.aportes);
        if (Array.isArray(data.actividad)) setActividades(data.actividad);
        if (Array.isArray(data.cartera)) setCreditos(data.cartera);
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Search size={20} className="text-[#ff9900]" />
          Buscar Afiliado
        </h2>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o cédula..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff9900] text-white font-semibold text-sm shadow-md shadow-[#ff9900]/25 hover:bg-[#e68a00] disabled:opacity-50 transition-all"
          >
            {searching ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Search size={16} />
            )}
            Buscar
          </button>
        </div>

        {/* Results */}
        {!selected && results.length > 0 && (
          <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#ff9900]/[0.04] transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-gray-900">{u.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">CC: {u.cedula || '—'}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {!selected && searching && (
          <div className="mt-4 p-6 rounded-xl border border-gray-200 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-[#ff9900] border-t-transparent rounded-full" />
            Buscando...
          </div>
        )}

        {/* Empty state after a search */}
        {!selected && !searching && searched && results.length === 0 && (
          <div className="mt-4 p-6 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500">
            No se encontraron afiliados con ese criterio.
            <br />
            <span className="text-xs text-gray-400">Solo se buscan usuarios afiliados al fondo. Para crear una nueva afiliación usa la pestaña &quot;Nuevo Afiliado&quot;.</span>
          </div>
        )}
      </div>

      {/* Profile */}
      {selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {selected.nombre}{" "}
              <span className="text-sm font-normal text-gray-500">
                CC: {selected.cedula}
              </span>
            </h3>
            <button
              onClick={() => {
                setSelected(null);
                setSaldos(null);
                setAportes([]);
                setActividades([]);
                setCreditos([]);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {loadingProfile ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-[#ff9900] border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Saldos */}
              <CollapsibleSection
                title="Saldos"
                icon={<Wallet size={18} className="text-[#ff9900]" />}
                open={openSections.saldos}
                onToggle={() => toggleSection("saldos")}
              >
                {saldos ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Permanente", value: saldos.permanente },
                      { label: "Social", value: saldos.social },
                      { label: "Actividad", value: saldos.actividad },
                      { label: "Intereses", value: saldos.intereses },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                      >
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                          {s.label}
                        </p>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          {fmt(s.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    No se encontraron saldos.
                  </p>
                )}
              </CollapsibleSection>

              {/* Estado de Cuenta (Aportes) */}
              <CollapsibleSection
                title="Estado de Cuenta"
                icon={<DollarSign size={18} className="text-[#ff9900]" />}
                open={openSections.aportes}
                onToggle={() => toggleSection("aportes")}
              >
                {aportes.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="px-3 py-2">Periodo</th>
                          <th className="px-3 py-2 text-right">Aporte</th>
                          <th className="px-3 py-2 text-right">Permanente</th>
                          <th className="px-3 py-2 text-right">Social</th>
                          <th className="px-3 py-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {aportes.map((a, i) => (
                          <tr
                            key={i}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {a.periodo}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {fmt(a.monto_total || 0)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {fmt(a.monto_permanente || 0)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {fmt(a.monto_social || 0)}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              {a.fecha_ejecucion ? new Date(a.fecha_ejecucion).toLocaleDateString("es-CO") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Sin historial de aportes.
                  </p>
                )}
              </CollapsibleSection>

              {/* Actividades */}
              <CollapsibleSection
                title="Actividades"
                icon={<Activity size={18} className="text-[#ff9900]" />}
                open={openSections.actividades}
                onToggle={() => toggleSection("actividades")}
              >
                {actividades.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2">Descripcion</th>
                          <th className="px-3 py-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {actividades.map((a, i) => (
                          <tr
                            key={a._id || i}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  a.tipo === "aporte"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {a.tipo === "aporte" ? "Aporte" : "Retiro"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">
                              {fmt(a.monto || 0)}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {a.descripcion || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              {a.fecha ? new Date(a.fecha).toLocaleDateString("es-CO") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Sin actividades registradas.
                  </p>
                )}
              </CollapsibleSection>

              {/* Cartera / Creditos */}
              <CollapsibleSection
                title="Cartera"
                icon={<CreditCard size={18} className="text-[#ff9900]" />}
                open={openSections.cartera}
                onToggle={() => toggleSection("cartera")}
              >
                {creditos.length > 0 ? (
                  <div className="space-y-4">
                    {creditos.map((cr, idx) => (
                      <div
                        key={cr._id || idx}
                        className="rounded-xl border border-gray-200 overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-gray-900 text-sm">
                              Crédito {cr.credito_id || cr._id}
                            </span>
                            <span className="ml-3 text-xs text-gray-500">
                              Total: {fmt(cr.valor_prestamo || 0)} | Saldo: {fmt(cr.saldo_total || 0)} | Cuotas: {cr.cuotas_pagadas || 0}/{(cr.cuotas_pagadas || 0) + (cr.cuotas_restantes || 0)}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              cr.estado === "activo"
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-gray-100 text-gray-800 border-gray-300"
                            }`}
                          >
                            {cr.estado}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <th className="px-4 py-2">Cuota</th>
                              <th className="px-4 py-2">Fecha</th>
                              <th className="px-4 py-2 text-right">Monto</th>
                              <th className="px-4 py-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(cr.pagos ?? []).map((p, i) => (
                              <tr
                                key={i}
                                className={`transition-colors ${
                                  p.flagged ? "bg-yellow-50" : "hover:bg-gray-50"
                                }`}
                              >
                                <td className="px-4 py-2 text-gray-700 font-medium">
                                  #{p.numero_cuota}
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-CO") : "—"}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-gray-700">
                                  {fmt(p.monto_total || 0)}
                                </td>
                                <td className="px-4 py-2">
                                  {p.flagged ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 font-semibold">
                                      <AlertCircle size={14} /> Difiere
                                    </span>
                                  ) : (
                                    <span className="text-xs text-green-600 font-semibold">OK</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Sin creditos registrados.
                  </p>
                )}
              </CollapsibleSection>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NUEVO AFILIADO TAB                                                 */
/* ================================================================== */

function NuevoAfiliadoTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [montoAporte, setMontoAporte] = useState("");
  const [frecuencia, setFrecuencia] = useState<"quincenal" | "mensual">(
    "quincenal"
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/fondo/members?search_users=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedUser || !montoAporte) return;
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/fondo/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.id,
          monto_aporte: Number(montoAporte),
          frecuencia,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al crear afiliado");
      }
      setSuccess(true);
      setSelectedUser(null);
      setMontoAporte("");
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <UserPlus size={20} className="text-[#ff9900]" />
          Nuevo Afiliado
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Busca un usuario existente y enrollalo en el fondo de empleados.
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <Check size={16} /> Afiliado creado exitosamente.
          </div>
        )}

        {/* Step 1: Search user */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            1. Buscar Usuario
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all"
            >
              {searching ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Search size={16} />
              )}
              Buscar
            </button>
          </div>

          {searchResults.length > 0 && !selectedUser && (
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#ff9900]/[0.04] transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900">{u.nombre}</p>
                    <p className="text-xs text-gray-500">CC: {u.cedula}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-[#ff9900]/[0.06] border border-[#ff9900]/20">
              <Users size={18} className="text-[#ff9900]" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">
                  {selectedUser.nombre}
                </p>
                <p className="text-xs text-gray-500">
                  CC: {selectedUser.cedula}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg hover:bg-white text-gray-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Configure */}
        {selectedUser && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              2. Configurar Aporte
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Monto del Aporte ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={montoAporte}
                  onChange={(e) => setMontoAporte(e.target.value)}
                  placeholder="Ej: 100000"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Frecuencia
                </label>
                <select
                  value={frecuencia}
                  onChange={(e) =>
                    setFrecuencia(
                      e.target.value as "quincenal" | "mensual"
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900] bg-white"
                >
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !montoAporte}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff9900] text-white font-semibold text-sm shadow-md shadow-[#ff9900]/25 hover:bg-[#e68a00] disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <UserPlus size={16} />
              )}
              Crear Afiliado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Collapsible Section                                                */
/* ================================================================== */

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="flex items-center gap-2 font-bold text-gray-900">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown size={18} className="text-gray-400" />
        ) : (
          <ChevronRight size={18} className="text-gray-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

/* ================================================================== */
/*  CARGAR CSV TAB                                                     */
/* ================================================================== */

interface CsvUploadResult {
  total_procesados: number;
  actualizados: number;
  creados: number;
  no_encontrados: number;
  errores: { cedula: string; razon: string }[];
}

function CargarCsvTab() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CsvUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/fondo/upload-csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al procesar el archivo");
      } else {
        setResult(data);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#ff9900]" />
          Cargar Saldos desde CSV
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Sube un archivo CSV con los saldos acumulados de los afiliados. Se conectará por <strong>CEDULA</strong> y se actualizará el campo <strong>ACUMULADO</strong> (90% permanente, 10% social).
        </p>
      </div>

      {/* Format info */}
      <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          Formato del archivo
        </p>
        <ul className="text-blue-800 space-y-1 list-disc list-inside text-xs">
          <li>Separador: <code className="bg-white px-1.5 py-0.5 rounded">;</code> (punto y coma)</li>
          <li>Codificación: UTF-8</li>
          <li>Columnas requeridas: <code className="bg-white px-1.5 py-0.5 rounded">CEDULA</code>, <code className="bg-white px-1.5 py-0.5 rounded">ACUMULADO</code></li>
          <li>Otras columnas son opcionales (NOMBRE, AHORROS, CARTERA, etc.) y serán ignoradas por ahora</li>
          <li>Si el usuario ya está afiliado, se actualizan sus saldos. Si no, se crea su afiliación.</li>
        </ul>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#ff9900] transition-colors">
        <input
          type="file"
          id="csv-file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <label htmlFor="csv-file" className="cursor-pointer flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#ff9900]/10 rounded-2xl flex items-center justify-center">
            <Wallet className="h-8 w-8 text-[#ff9900]" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{file ? file.name : "Selecciona un archivo CSV"}</p>
            <p className="text-xs text-gray-500 mt-1">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Click para seleccionar"}</p>
          </div>
        </label>
      </div>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#ff9900] text-black font-bold rounded-xl hover:bg-[#ffae33] active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#ff9900]/30"
      >
        {uploading ? (
          <>
            <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
            Procesando...
          </>
        ) : (
          <>
            <Send className="h-5 w-5" />
            Cargar y Procesar
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-700 font-semibold uppercase">Procesados</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{result.total_procesados}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-xs text-emerald-700 font-semibold uppercase">Actualizados</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{result.actualizados}</p>
            </div>
            <div className="bg-[#ff9900]/10 border border-[#ff9900]/30 rounded-xl p-4 text-center">
              <p className="text-xs text-[#ff9900] font-semibold uppercase">Creados</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">{result.creados}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-xs text-red-700 font-semibold uppercase">No encontrados</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{result.no_encontrados}</p>
            </div>
          </div>

          {result.errores && result.errores.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                Cédulas no encontradas {result.errores.length >= 50 && "(primeras 50)"}
              </p>
              <div className="max-h-60 overflow-y-auto bg-white rounded-lg border border-amber-200">
                <ul className="text-xs divide-y divide-amber-100">
                  {result.errores.map((e, i) => (
                    <li key={i} className="px-3 py-2">
                      <span className="font-mono font-bold text-gray-700">{e.cedula}</span>
                      <span className="text-gray-500 ml-2">— {e.razon}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  SOLICITUDES TAB — pending credit requests + retiros                */
/* ================================================================== */

interface PendingCredito {
  _id: string;
  user_id: string;
  valor_prestamo: number;
  numero_cuotas: number;
  tasa_interes: number;
  motivo_solicitud?: string | null;
  fecha_solicitud: string;
  estado: string;
}

interface PendingRetiro {
  _id: string;
  user_id: string;
  nombre: string;
  cedula: string;
  monto: number;
  motivo?: string | null;
  fecha_solicitud: string;
  estado: string;
}

interface UserLite {
  _id: string;
  nombre: string;
  cedula: string;
}

function SolicitudesTab() {
  const [pendingCreditos, setPendingCreditos] = useState<PendingCredito[]>([]);
  const [pendingRetiros, setPendingRetiros] = useState<PendingRetiro[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserLite>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Manual creation form
  const [showManual, setShowManual] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<UserLite[]>([]);
  const [manualUser, setManualUser] = useState<UserLite | null>(null);
  const [manualValor, setManualValor] = useState("");
  const [manualCuotas, setManualCuotas] = useState("12");
  const [manualCreating, setManualCreating] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, rRes, uRes] = await Promise.all([
        fetch("/api/fondo/cartera?estado=pendiente"),
        fetch("/api/fondo/retiros?estado=pendiente"),
        fetch("/api/fondo/members"),
      ]);

      const credArr: PendingCredito[] = cRes.ok ? await cRes.json() : [];
      const retArr: PendingRetiro[] = rRes.ok ? await rRes.json() : [];
      const members: { user_id: string; nombre: string; cedula: string }[] = uRes.ok ? await uRes.json() : [];

      setPendingCreditos(credArr);
      setPendingRetiros(retArr);

      // Build user lookup
      const map: Record<string, UserLite> = {};
      for (const m of members) {
        map[m.user_id] = { _id: m.user_id, nombre: m.nombre, cedula: m.cedula };
      }
      setUserMap(map);
    } catch {
      setError("Error al cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAprobarCredito = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/fondo/cartera", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartera_id: id, action: "aprobar" }),
      });
      if (res.ok) await loadAll();
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazarCredito = async (id: string) => {
    const motivo = prompt("Motivo del rechazo (opcional):") || "";
    setProcessingId(id);
    try {
      const res = await fetch("/api/fondo/cartera", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartera_id: id, action: "rechazar", motivo_respuesta: motivo }),
      });
      if (res.ok) await loadAll();
    } finally {
      setProcessingId(null);
    }
  };

  const handleAprobarRetiro = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/fondo/retiros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "aprobar" }),
      });
      if (res.ok) await loadAll();
    } finally {
      setProcessingId(null);
    }
  };

  const handleRechazarRetiro = async (id: string) => {
    const motivo = prompt("Motivo del rechazo (opcional):") || "";
    setProcessingId(id);
    try {
      const res = await fetch("/api/fondo/retiros", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "rechazar", motivo_respuesta: motivo }),
      });
      if (res.ok) await loadAll();
    } finally {
      setProcessingId(null);
    }
  };

  const searchManualUser = async () => {
    if (!manualSearch.trim()) return;
    try {
      const res = await fetch(`/api/fondo/members?search_users=${encodeURIComponent(manualSearch.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setManualResults(Array.isArray(data) ? data.map((u: { id: string; nombre: string; cedula: string }) => ({ _id: u.id, nombre: u.nombre, cedula: u.cedula })) : []);
      }
    } catch {
      // ignore
    }
  };

  const createManualCredito = async () => {
    if (!manualUser || !manualValor) return;
    setManualCreating(true);
    try {
      const res = await fetch("/api/fondo/cartera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: manualUser._id,
          valor_prestamo: Number(manualValor),
          numero_cuotas: Number(manualCuotas),
        }),
      });
      if (res.ok) {
        setShowManual(false);
        setManualUser(null);
        setManualValor("");
        setManualSearch("");
        setManualResults([]);
        await loadAll();
      }
    } finally {
      setManualCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-[#ff9900] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Manual creation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={20} className="text-[#ff9900]" />
            Crear crédito manual
          </h2>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="text-sm font-semibold text-[#ff9900] hover:text-orange-700"
          >
            {showManual ? "Cerrar" : "Crear nuevo"}
          </button>
        </div>
        {showManual && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar usuario por nombre o cédula..."
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchManualUser()}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
              />
              <button
                onClick={searchManualUser}
                className="px-4 py-2.5 rounded-xl bg-[#ff9900] text-black font-semibold text-sm hover:bg-[#ffae33]"
              >
                Buscar
              </button>
            </div>
            {manualResults.length > 0 && !manualUser && (
              <div className="border border-gray-200 rounded-xl divide-y max-h-48 overflow-y-auto">
                {manualResults.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => { setManualUser(u); setManualResults([]); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm"
                  >
                    <div className="font-medium text-gray-900">{u.nombre}</div>
                    <div className="text-xs text-gray-500">CC: {u.cedula}</div>
                  </button>
                ))}
              </div>
            )}
            {manualUser && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">{manualUser.nombre}</span>
                  <span className="ml-2 text-gray-500">CC: {manualUser.cedula}</span>
                </div>
                <button onClick={() => setManualUser(null)} className="text-xs text-gray-500 hover:text-gray-700">Cambiar</button>
              </div>
            )}
            {manualUser && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor del préstamo</label>
                  <input
                    type="number"
                    min={1}
                    value={manualValor}
                    onChange={(e) => setManualValor(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número de cuotas</label>
                  <select
                    value={manualCuotas}
                    onChange={(e) => setManualCuotas(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                  >
                    <option value="6">6 (1%)</option>
                    <option value="12">12 (1%)</option>
                    <option value="18">18 (1.2%)</option>
                    <option value="24">24 (1.2%)</option>
                    <option value="36">36 (1.3%)</option>
                    <option value="48">48 (1.3%)</option>
                    <option value="60">60 (1.3%)</option>
                  </select>
                </div>
              </div>
            )}
            {manualUser && (
              <button
                onClick={createManualCredito}
                disabled={manualCreating || !manualValor}
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {manualCreating ? "Creando..." : "Crear crédito"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pending credit requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={20} className="text-[#ff9900]" />
            Solicitudes de Crédito ({pendingCreditos.length})
          </h2>
        </div>
        {pendingCreditos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No hay solicitudes de crédito pendientes.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingCreditos.map((c) => {
              const u = userMap[c.user_id];
              return (
                <div key={c._id} className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{u?.nombre || "Usuario no encontrado"}</p>
                      {u && <p className="text-xs text-gray-500">CC: {u.cedula}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(c.fecha_solicitud).toLocaleDateString("es-CO")}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Valor</p>
                      <p className="font-semibold text-gray-900">{fmt(c.valor_prestamo)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cuotas</p>
                      <p className="font-semibold text-gray-900">{c.numero_cuotas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tasa</p>
                      <p className="font-semibold text-gray-900">{c.tasa_interes}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total a pagar</p>
                      <p className="font-semibold text-gray-900">
                        {fmt(c.valor_prestamo + (c.valor_prestamo * (c.tasa_interes / 100) * c.numero_cuotas))}
                      </p>
                    </div>
                  </div>
                  {c.motivo_solicitud && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                      <span className="font-semibold text-xs uppercase text-gray-500">Motivo: </span>
                      {c.motivo_solicitud}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAprobarCredito(c._id)}
                      disabled={processingId === c._id}
                      className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Check size={16} /> Aprobar
                    </button>
                    <button
                      onClick={() => handleRechazarCredito(c._id)}
                      disabled={processingId === c._id}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-sm hover:bg-red-200 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <X size={16} /> Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending retiros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wallet size={20} className="text-emerald-600" />
            Solicitudes de Retiro ({pendingRetiros.length})
          </h2>
        </div>
        {pendingRetiros.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No hay solicitudes de retiro pendientes.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingRetiros.map((r) => (
              <div key={r._id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{r.nombre}</p>
                    <p className="text-xs text-gray-500">CC: {r.cedula}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.fecha_solicitud).toLocaleDateString("es-CO")}</span>
                </div>
                <div className="mb-3">
                  <p className="text-xs text-gray-500">Monto a retirar</p>
                  <p className="text-2xl font-bold text-emerald-700">{fmt(r.monto)}</p>
                </div>
                {r.motivo && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                    <span className="font-semibold text-xs uppercase text-gray-500">Motivo: </span>
                    {r.motivo}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAprobarRetiro(r._id)}
                    disabled={processingId === r._id}
                    className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Check size={16} /> Aprobar
                  </button>
                  <button
                    onClick={() => handleRechazarRetiro(r._id)}
                    disabled={processingId === r._id}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-100 text-red-700 font-semibold text-sm hover:bg-red-200 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <X size={16} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
