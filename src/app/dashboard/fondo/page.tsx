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
  Upload,
  FileText,
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

interface CreditPayment {
  cartera_id: string;
  credito_id: string;
  monto: number;
  saldo_total: number;
  cuota_esperada: number;
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
  creditos: CreditPayment[];
  credito_pago_total?: number;
}

interface BudgetAdjustment {
  user_id: string;
  nombre: string;
  total_anterior: number;
  total_nuevo: number;
}

interface Ciclo {
  _id?: string;
  id?: string;
  periodo: string;
  estado: "enviado_admin" | "ajustes_admin" | "aprobado" | "rechazado";
  movimientos: CycleRow[];
  movimientos_admin?: BudgetAdjustment[] | null;
  ajustes_admin_at?: string;
  revision_count?: number;
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
  tasa_interes?: number;
  numero_cuotas?: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  frecuencia_pago?: string;
  fecha_desembolso?: string;
  fecha_cuota_1?: string;
  estado: string;
  pagos?: { numero_cuota: number; fecha_pago: string; monto_total: number; flagged?: boolean; monto_esperado?: number; diferencia?: number }[];
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

interface PdfUploadResult {
  success: boolean;
  total_en_pdf: number;
  actualizados: number;
  no_encontrados: number;
  cedulas_no_encontradas: string[];
  detalle: { cedula: string; name: string; credits: number; savings: boolean; activities: number }[];
}

interface CicloActualData {
  credits: { credit_id: string; interest: number; capital: number; total: number }[];
  savings: { ahorro_permanente: number; ahorro_social: number; total: number } | null;
  activities: { description: string; amount: number }[];
  uploaded_at?: string;
}

function CicloActualTab() {
  const [rows, setRows] = useState<CycleRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState<string>("");
  const [periodoLabel, setPeriodoLabel] = useState<string>("");
  const [existingCiclo, setExistingCiclo] = useState<Ciclo | null>(null);
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({});

  // PDF upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<PdfUploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [cicloActualMap, setCicloActualMap] = useState<Record<string, CicloActualData>>({});
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [manuallyAddedUsers, setManuallyAddedUsers] = useState<Set<string>>(new Set());
  const [showAddUser, setShowAddUser] = useState(false);

  // Compute current periodo (YYYY-MM-A or YYYY-MM-B)
  const computeCurrentPeriodo = () => {
    const now = new Date();
    const day = now.getDate();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const half = day <= 15 ? "A" : "B";
    return `${year}-${month}-${half}`;
  };

  const formatPeriodoLabel = (p: string) => {
    const [y, m, h] = p.split("-");
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const monthLabel = monthNames[parseInt(m) - 1] || m;
    return `${h === "A" ? "1ra quincena" : "2da quincena"} de ${monthLabel} ${y}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const currentPeriodo = computeCurrentPeriodo();
        setPeriodo(currentPeriodo);
        setPeriodoLabel(formatPeriodoLabel(currentPeriodo));

        // Check for existing cycle for this periodo first
        const ciclosRes = await fetch(`/api/fondo/ciclos?periodo=${currentPeriodo}`);
        const ciclos: Ciclo[] = ciclosRes.ok ? await ciclosRes.json() : [];
        const existing = ciclos.find(c => c.estado === "enviado_admin" || c.estado === "ajustes_admin" || c.estado === "aprobado");

        if (existing) {
          setExistingCiclo(existing);
          // If we're in ajustes_admin state, we still need to load and show the rows
          if (existing.estado !== "ajustes_admin") {
            setLoading(false);
            return;
          }
        }

        // Fetch members and active credits
        const [memRes, cartRes] = await Promise.all([
          fetch("/api/fondo/members"),
          fetch("/api/fondo/cartera?estado=activo"),
        ]);
        if (!memRes.ok) throw new Error("Error cargando miembros");
        const data: FondoMember[] = await memRes.json();

        // Group active credits by user
        const creditsByUser = new Map<string, CreditPayment[]>();
        if (cartRes.ok) {
          const credits: Array<{
            _id: string;
            user_id: string;
            credito_id?: string;
            cuotas_restantes: number;
            saldo_total: number;
          }> = await cartRes.json();
          for (const c of credits) {
            if (c.cuotas_restantes <= 0) continue;
            const cuota = Math.round(c.saldo_total / c.cuotas_restantes);
            const arr = creditsByUser.get(c.user_id) || [];
            arr.push({
              cartera_id: c._id,
              credito_id: c.credito_id || c._id.slice(-6),
              monto: cuota,
              saldo_total: c.saldo_total,
              cuota_esperada: cuota,
            });
            creditsByUser.set(c.user_id, arr);
          }
        }

        // If existing is in ajustes_admin, build budget map from admin's adjustments
        if (existing && existing.estado === "ajustes_admin" && existing.movimientos_admin) {
          const bm: Record<string, number> = {};
          for (const adj of existing.movimientos_admin) {
            bm[adj.user_id] = adj.total_nuevo;
          }
          setBudgetMap(bm);
        }

        setRows(
          data.map((m) => {
            const aporte = m.monto_aporte;
            const creditos = creditsByUser.get(m.user_id) || [];
            return {
              user_id: m.user_id,
              nombre: m.nombre,
              cedula: m.cedula,
              frecuencia: m.frecuencia,
              aporte,
              permanente: +(aporte * 0.9).toFixed(0),
              social: +(aporte * 0.1).toFixed(0),
              actividad: 0,
              creditos,
            };
          })
        );
      } catch {
        setError("No se pudieron cargar los miembros del fondo.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch cicloActual data for all members after PDF upload
  const fetchCicloActualData = useCallback(async () => {
    try {
      const res = await fetch("/api/fondo/members?include_ciclo=1");
      if (!res.ok) return;
      const members: { user_id: string; cedula: string; cicloActual?: CicloActualData }[] = await res.json();
      const map: Record<string, CicloActualData> = {};
      for (const m of members) {
        if (m.cicloActual) map[m.user_id] = m.cicloActual;
      }
      setCicloActualMap(map);
    } catch { /* ignore */ }
  }, []);

  // Load cicloActual data on mount
  useEffect(() => { fetchCicloActualData(); }, [fetchCicloActualData]);

  // Auto-fill rows from cicloActual when PDF data arrives
  const [appliedPdfUsers, setAppliedPdfUsers] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (Object.keys(cicloActualMap).length === 0 || rows.length === 0) return;
    let changed = false;
    const newApplied = new Set(appliedPdfUsers);
    const updated = rows.map((row) => {
      if (newApplied.has(row.user_id)) return row;
      const ca = cicloActualMap[row.user_id];
      if (!ca) return row;
      newApplied.add(row.user_id);
      changed = true;
      const aporte = ca.savings ? ca.savings.total : row.aporte;
      const actividad = ca.activities.reduce((sum, a) => sum + a.amount, 0) || row.actividad;
      // Match credit payments by credit_id
      const creditos = row.creditos.map((cr) => {
        const pdfCredit = ca.credits.find((pc) => pc.credit_id === cr.credito_id);
        if (pdfCredit) return { ...cr, monto: pdfCredit.total };
        return cr;
      });
      return {
        ...row,
        aporte,
        permanente: ca.savings ? ca.savings.ahorro_permanente : +(aporte * 0.9).toFixed(0),
        social: ca.savings ? ca.savings.ahorro_social : +(aporte * 0.1).toFixed(0),
        actividad,
        creditos,
      };
    });
    if (changed) {
      setRows(updated);
      setAppliedPdfUsers(newApplied);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloActualMap, rows.length]);

  const handlePdfUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/fondo/upload-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir el PDF");
      setUploadResult(data);
      setAppliedPdfUsers(new Set());
      setPdfUploaded(true);
      setManuallyAddedUsers(new Set());
      await fetchCicloActualData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  };

  const updateRowField = useCallback(
    (idx: number, field: "frecuencia" | "aporte" | "actividad", value: string | number) => {
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
        }
        next[idx] = row;
        return next;
      });
    },
    []
  );

  const updateCreditPayment = useCallback(
    (rowIdx: number, creditIdx: number, value: string) => {
      setRows((prev) => {
        const next = [...prev];
        const row = { ...next[rowIdx] };
        const creditos = [...row.creditos];
        creditos[creditIdx] = { ...creditos[creditIdx], monto: Number(value) || 0 };
        row.creditos = creditos;
        next[rowIdx] = row;
        return next;
      });
    },
    []
  );

  const computeRowTotal = (row: CycleRow): number => {
    const creditTotal = row.creditos.reduce((s, c) => s + (c.monto || 0), 0);
    return (row.aporte || 0) + (row.actividad || 0) + creditTotal;
  };

  // In ajustes_admin mode, only show users who actually have budget adjustments
  // When PDF uploaded, only show users in the PDF + manually added
  const isAjustesMode = existingCiclo?.estado === "ajustes_admin";
  const visibleRows = useMemo(() => {
    if (isAjustesMode) return rows.filter((r) => budgetMap[r.user_id] !== undefined);
    if (pdfUploaded) return rows.filter((r) => cicloActualMap[r.user_id] || manuallyAddedUsers.has(r.user_id));
    return rows;
  }, [rows, isAjustesMode, budgetMap, pdfUploaded, cicloActualMap, manuallyAddedUsers]);

  const filtered = useMemo(
    () => {
      const q = filter.toLowerCase().trim();
      if (!q) return visibleRows;
      return visibleRows.filter((r) =>
        r.nombre.toLowerCase().includes(q) ||
        (r.cedula || "").toLowerCase().includes(q)
      );
    },
    [visibleRows, filter]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      // Add credito_pago_total computed for backwards compat
      const movimientos = rows.map(r => ({
        ...r,
        credito_pago_total: r.creditos.reduce((s, c) => s + (c.monto || 0), 0),
      }));

      const res = await fetch("/api/fondo/ciclos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo, movimientos }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al enviar el ciclo");
      }
      setSuccess(true);
      // Mark cycle as existing now — if we were in ajustes_admin mode this is now aprobado
      const data = await res.json();
      const newEstado = isAjustesMode ? "aprobado" : "enviado_admin";
      setExistingCiclo({ ...existingCiclo, _id: data.id, estado: newEstado, periodo, movimientos: rows, created_at: new Date().toISOString() });
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

  // If a cycle already exists for this period and it's NOT in ajustes_admin state,
  // show a "already submitted" message
  if (existingCiclo && existingCiclo.estado !== "ajustes_admin") {
    const stateLabels: Record<string, { label: string; color: string }> = {
      enviado_admin: { label: "Enviado al administrador", color: "bg-amber-100 text-amber-800 border-amber-300" },
      aprobado: { label: "Aprobado", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
      rechazado: { label: "Rechazado", color: "bg-red-100 text-red-800 border-red-300" },
    };
    const stateInfo = stateLabels[existingCiclo.estado] || { label: existingCiclo.estado, color: "bg-gray-100 text-gray-800" };
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Ciclo ya enviado</h2>
        <p className="text-sm text-gray-600 mb-4">
          Ya existe un ciclo para la <strong>{periodoLabel}</strong>.
        </p>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${stateInfo.color}`}>
          {stateInfo.label}
        </span>
        <p className="text-xs text-gray-500 mt-6">
          El próximo ciclo estará disponible cuando inicie la siguiente quincena.
        </p>
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
            {isAjustesMode && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Ajustes pendientes
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Periodo:{" "}
            <span className="font-semibold text-gray-800">
              {periodoLabel}
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
            {isAjustesMode ? "Aprobar y aplicar" : "Aprobar y Enviar"}
          </button>
        </div>
      </div>

      {isAjustesMode && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <p className="font-semibold mb-1">El administrador ajustó los presupuestos de estos usuarios.</p>
          <p className="text-xs">Solo se muestran los usuarios cuyo presupuesto cambió. Redistribuye el dinero entre las categorías sin sobrepasar el presupuesto. Al aprobar, los movimientos se aplicarán inmediatamente sin pasar por el administrador.</p>
        </div>
      )}

      {/* PDF Upload Section */}
      <div className="mx-5 mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <FileText size={18} className="text-[#ff9900]" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Cargar nómina (PDF)</p>
            <p className="text-xs text-gray-500">Sube el PDF de nómina para actualizar automáticamente los datos del ciclo actual.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:border-[#ff9900]/40 hover:text-[#ff9900] transition-all">
            <Upload size={16} />
            {uploading ? "Procesando..." : "Seleccionar PDF"}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePdfUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {uploading && <div className="animate-spin h-5 w-5 border-2 border-[#ff9900] border-t-transparent rounded-full" />}
        </div>

        {uploadError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {uploadError}
          </div>
        )}

        {uploadResult && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
            <p className="font-semibold text-emerald-800 mb-1">PDF procesado correctamente</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-emerald-700">
              <div>Total en PDF: <span className="font-bold">{uploadResult.total_en_pdf}</span></div>
              <div>Actualizados: <span className="font-bold">{uploadResult.actualizados}</span></div>
              <div>No encontrados: <span className="font-bold">{uploadResult.no_encontrados}</span></div>
            </div>
            {uploadResult.cedulas_no_encontradas.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Cédulas no encontradas: {uploadResult.cedulas_no_encontradas.join(", ")}
              </p>
            )}
            {/* Temporary debug: raw text preview */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r = uploadResult as any;
              if (!r._debug_raw_text_preview) return null;
              return (
                <details className="mt-3">
                  <summary className="text-xs text-gray-500 cursor-pointer font-semibold">Debug: Raw PDF text (click to expand)</summary>
                  <pre className="mt-2 p-2 bg-gray-900 text-green-400 text-[10px] rounded-lg overflow-auto max-h-80 whitespace-pre-wrap">
                    {String(r._debug_raw_text_preview)}
                  </pre>
                  <pre className="mt-1 p-2 bg-gray-900 text-yellow-400 text-[10px] rounded-lg overflow-auto max-h-40 whitespace-pre-wrap">
                    {JSON.stringify(r._debug_parsed_sample, null, 2)}
                  </pre>
                </details>
              );
            })()}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <Check size={16} /> {isAjustesMode ? "Ciclo aprobado y aplicado correctamente." : "Ciclo enviado exitosamente al administrador."}
        </div>
      )}

      {/* Cards-per-user layout (cleaner for the multi-credit case) */}
      <div className="p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No se encontraron miembros.</div>
        )}
        {pdfUploaded && filtered.length > 0 && (
          <p className="text-xs text-gray-500">Mostrando {filtered.length} usuario(s) del PDF{manuallyAddedUsers.size > 0 ? ` + ${manuallyAddedUsers.size} agregado(s)` : ""}</p>
        )}
        {filtered.map((row) => {
          const idx = rows.findIndex((r) => r.user_id === row.user_id);
          const total = computeRowTotal(row);
          const budget = budgetMap[row.user_id];
          const overBudget = budget !== undefined && total > budget;
          return (
            <div
              key={row.user_id}
              className={`rounded-xl border ${overBudget ? "border-red-300 bg-red-50/30" : "border-gray-200 bg-white"} p-4`}
            >
              <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                <div>
                  <p className="font-bold text-gray-900">{row.nombre}</p>
                  <p className="text-xs text-gray-500">CC {row.cedula}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {budget !== undefined && (
                    <div className={`px-3 py-1.5 rounded-lg border text-xs ${overBudget ? "bg-red-100 border-red-300 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                      <span className="font-semibold">Presupuesto admin:</span> {fmt(budget)}
                    </div>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg border text-xs ${overBudget ? "bg-red-100 border-red-300 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                    <span className="font-semibold">Total:</span> {fmt(total)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Frecuencia</label>
                  <select
                    value={row.frecuencia}
                    onChange={(e) => updateRowField(idx, "frecuencia", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Aporte ($) — 90% perm / 10% social</label>
                  <input
                    type="number"
                    min={0}
                    value={row.aporte}
                    onChange={(e) => updateRowField(idx, "aporte", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                  />
                  <p className="text-[9px] text-gray-400 mt-0.5">Permanente: {fmt(row.permanente)} · Social: {fmt(row.social)}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Actividad ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={row.actividad}
                    onChange={(e) => updateRowField(idx, "actividad", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                  />
                </div>
              </div>

              {/* Credits — one input per active loan */}
              {row.creditos.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Créditos activos ({row.creditos.length})
                  </label>
                  <div className="space-y-2">
                    {row.creditos.map((cr, ci) => (
                      <div key={cr.cartera_id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">Crédito {cr.credito_id}</p>
                          <p className="text-[10px] text-gray-500">Saldo: {fmt(cr.saldo_total)} · Cuota esperada: {fmt(cr.cuota_esperada)}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={cr.monto}
                          onChange={(e) => updateCreditPayment(idx, ci, e.target.value)}
                          className="w-32 text-right rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ciclo Actual from PDF */}
              {cicloActualMap[row.user_id] && (() => {
                const ca = cicloActualMap[row.user_id];
                const isExpanded = expandedPdf === row.user_id;
                return (
                  <div className="mt-3 border border-blue-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedPdf(isExpanded ? null : row.user_id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                    >
                      <span className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                        <FileText size={13} />
                        Datos nómina (PDF)
                        <span className="text-[10px] font-normal text-blue-600">
                          — {ca.credits.length} crédito(s), {ca.savings ? "ahorro" : "sin ahorro"}, {ca.activities.length} actividad(es)
                        </span>
                      </span>
                      {isExpanded ? <ChevronDown size={14} className="text-blue-600" /> : <ChevronRight size={14} className="text-blue-600" />}
                    </button>
                    {isExpanded && (
                      <div className="p-3 space-y-3 bg-white">
                        {ca.credits.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Abonos a crédito</p>
                            <div className="space-y-1">
                              {ca.credits.map((cr, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-xs">
                                  <span className="font-semibold text-gray-700">Crédito {cr.credit_id}</span>
                                  <div className="flex gap-4 text-gray-600">
                                    <span>Interés: {fmt(cr.interest)}</span>
                                    <span>Capital: {fmt(cr.capital)}</span>
                                    <span className="font-bold text-gray-900">Total: {fmt(cr.total)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {ca.savings && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Ahorros</p>
                            <div className="flex items-center gap-4 p-2 rounded-lg bg-gray-50 text-xs text-gray-600">
                              <span>Permanente: {fmt(ca.savings.ahorro_permanente)}</span>
                              <span>Social: {fmt(ca.savings.ahorro_social)}</span>
                              <span className="font-bold text-gray-900">Total: {fmt(ca.savings.total)}</span>
                            </div>
                          </div>
                        )}
                        {ca.activities.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Actividades</p>
                            <div className="space-y-1">
                              {ca.activities.map((act, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-xs">
                                  <span className="text-gray-700">{act.description}</span>
                                  <span className="font-bold text-gray-900">{fmt(act.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Add user button (visible after PDF upload) */}
        {pdfUploaded && (
          <div className="mt-2">
            {!showAddUser ? (
              <button
                onClick={() => setShowAddUser(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#ff9900] hover:text-[#ff9900] transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <UserPlus size={16} />
                Agregar usuario no incluido en el PDF
              </button>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Seleccionar usuario</p>
                  <button onClick={() => setShowAddUser(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} className="text-gray-400" /></button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {rows
                    .filter((r) => !cicloActualMap[r.user_id] && !manuallyAddedUsers.has(r.user_id))
                    .map((r) => (
                      <button
                        key={r.user_id}
                        onClick={() => {
                          setManuallyAddedUsers((prev) => new Set(prev).add(r.user_id));
                          setShowAddUser(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm transition-colors"
                      >
                        <span className="font-medium text-gray-900">{r.nombre}</span>
                        <span className="ml-2 text-xs text-gray-500">CC {r.cedula}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
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
                  {(c.revision_count || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                      Revisión {c.revision_count}
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
                  {(() => {
                    const movimientos = c.movimientos || [];
                    const computeTotal = (m: CycleRow): number => {
                      const credTotal = Array.isArray(m.creditos)
                        ? m.creditos.reduce((s, x) => s + (Number(x.monto) || 0), 0)
                        : (m.credito_pago_total || 0);
                      return (Number(m.aporte) || 0) + (Number(m.actividad) || 0) + credTotal;
                    };

                    return (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <th className="px-3 py-2">Nombre</th>
                                <th className="px-3 py-2 text-right">Aporte</th>
                                <th className="px-3 py-2 text-right">Actividad</th>
                                <th className="px-3 py-2 text-right">Créditos</th>
                                <th className="px-3 py-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {movimientos.map((r, i) => {
                                const credTotal = Array.isArray(r.creditos)
                                  ? r.creditos.reduce((s, x) => s + (Number(x.monto) || 0), 0)
                                  : (r.credito_pago_total || 0);
                                return (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium text-gray-900">{r.nombre}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.aporte || 0)}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.actividad || 0)}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{fmt(credTotal)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(computeTotal(r))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {c.estado === "aprobado" && (
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

  const [saving, setSaving] = useState(false);

  /* editable credito_id */
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  const [editCreditIdValue, setEditCreditIdValue] = useState("");

  const handleSaveCreditId = async (carteraId: string) => {
    if (!editCreditIdValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fondo/cartera", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartera_id: carteraId, action: "update_credito_id", credito_id: editCreditIdValue.trim() }),
      });
      if (res.ok) {
        setCreditos(prev => prev.map(c => c._id === carteraId ? { ...c, credito_id: editCreditIdValue.trim() } : c));
        setEditingCreditId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  // Save saldo field
  const handleSaveSaldo = async (field: string, value: number) => {
    if (!selected) return;
    setSaving(true);
    try {
      const userId = selected.user_id || selected.id;
      const res = await fetch("/api/fondo/saldos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, [field]: value }),
      });
      if (res.ok && saldos) {
        const key = field.replace("saldo_", "") as keyof Saldos;
        setSaldos({ ...saldos, [key]: value });
      }
    } finally {
      setSaving(false);
    }
  };

  // Save credit fields
  const handleSaveCreditFields = async (carteraId: string, fields: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/fondo/cartera", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartera_id: carteraId, action: "update_fields", fields }),
      });
      if (res.ok) {
        // Refresh the user profile
        const userId = selected?.user_id || selected?.id;
        if (userId) {
          const sRes = await fetch(`/api/fondo/saldos?user_id=${userId}`);
          if (sRes.ok) {
            const data = await sRes.json();
            if (data.saldos) setSaldos(data.saldos);
            if (Array.isArray(data.cartera)) setCreditos(data.cartera);
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  /* collapsible sections */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    saldos: true,
    aportes: true,
    actividades: false,
    cartera: true,
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
                    {([
                      { label: "Permanente", field: "saldo_permanente", value: saldos.permanente },
                      { label: "Social", field: "saldo_social", value: saldos.social },
                      { label: "Actividad", field: "saldo_actividad", value: saldos.actividad },
                      { label: "Intereses", field: "saldo_intereses", value: saldos.intereses },
                    ] as const).map((s) => (
                      <div
                        key={s.label}
                        className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                      >
                        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">
                          {s.label}
                        </p>
                        <input
                          type="number"
                          defaultValue={s.value}
                          onBlur={(e) => {
                            const v = Number(e.target.value) || 0;
                            if (v !== s.value) handleSaveSaldo(s.field, v);
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-full text-lg font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#ff9900] focus:outline-none transition-colors"
                        />
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
                    {creditos.map((cr, idx) => {
                      const totalCuotas = (cr.numero_cuotas || (cr.cuotas_pagadas + cr.cuotas_restantes));
                      return (
                      <div
                        key={cr._id || idx}
                        className="rounded-xl border border-gray-200 overflow-hidden"
                      >
                        {/* Credit header with editable ID */}
                        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {editingCreditId === cr._id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">ID:</span>
                                <input
                                  type="text"
                                  value={editCreditIdValue}
                                  onChange={(e) => setEditCreditIdValue(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleSaveCreditId(cr._id!)}
                                  className="w-24 px-2 py-1 rounded-lg border border-[#ff9900] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40"
                                  autoFocus
                                />
                                <button onClick={() => handleSaveCreditId(cr._id!)} disabled={saving} className="p-1 rounded-lg bg-[#ff9900] text-white hover:bg-[#e68a00] disabled:opacity-50"><Check size={14} /></button>
                                <button onClick={() => setEditingCreditId(null)} className="p-1 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"><X size={14} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingCreditId(cr._id!); setEditCreditIdValue(cr.credito_id || cr._id || ""); }}
                                className="font-semibold text-gray-900 text-sm hover:text-[#ff9900] transition-colors cursor-pointer"
                                title="Click para editar ID"
                              >
                                Crédito {cr.credito_id || cr._id}
                                <span className="ml-1 text-[10px] text-gray-400">(editar)</span>
                              </button>
                            )}
                          </div>
                          <select
                            defaultValue={cr.estado}
                            onChange={(e) => handleSaveCreditFields(cr._id!, { estado: e.target.value })}
                            className="text-xs font-semibold rounded-full px-2.5 py-0.5 border bg-white focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40"
                          >
                            <option value="activo">activo</option>
                            <option value="pagado">pagado</option>
                            <option value="pendiente">pendiente</option>
                            <option value="rechazado">rechazado</option>
                          </select>
                        </div>

                        {/* Editable credit fields */}
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {([
                            { label: "Valor Préstamo", field: "valor_prestamo", value: cr.valor_prestamo, type: "number" },
                            { label: "Saldo Total", field: "saldo_total", value: cr.saldo_total, type: "number" },
                            { label: "Tasa Interés (%)", field: "tasa_interes", value: cr.tasa_interes ?? 0, type: "number" },
                            { label: "Num. Cuotas", field: "numero_cuotas", value: totalCuotas, type: "number" },
                            { label: "Cuotas Pagadas", field: "cuotas_pagadas", value: cr.cuotas_pagadas, type: "number" },
                            { label: "Cuotas Restantes", field: "", value: cr.cuotas_restantes, type: "readonly" },
                            { label: "Frecuencia", field: "frecuencia_pago", value: cr.frecuencia_pago || "mensual", type: "select" },
                            { label: "Fecha Desembolso", field: "fecha_desembolso", value: cr.fecha_desembolso ? new Date(cr.fecha_desembolso).toISOString().slice(0, 10) : "", type: "date" },
                          ] as const).map((f) => (
                            <div key={f.label}>
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{f.label}</p>
                              {f.type === "readonly" ? (
                                <p className="text-sm font-bold text-gray-900">{f.value}</p>
                              ) : f.type === "select" ? (
                                <select
                                  defaultValue={String(f.value)}
                                  onChange={(e) => handleSaveCreditFields(cr._id!, { [f.field]: e.target.value })}
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40"
                                >
                                  <option value="mensual">Mensual</option>
                                  <option value="quincenal">Quincenal</option>
                                </select>
                              ) : (
                                <input
                                  type={f.type}
                                  defaultValue={f.value}
                                  onBlur={(e) => {
                                    const v = f.type === "date" ? e.target.value : Number(e.target.value) || 0;
                                    if (String(v) !== String(f.value)) handleSaveCreditFields(cr._id!, { [f.field]: v });
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                                  step={f.field === "tasa_interes" ? "0.01" : undefined}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Payment history */}
                        {(cr.pagos ?? []).length > 0 && (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                                <th className="px-4 py-2">Cuota</th>
                                <th className="px-4 py-2">Fecha</th>
                                <th className="px-4 py-2 text-right">Monto</th>
                                <th className="px-4 py-2">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(cr.pagos ?? []).map((p, i) => (
                                <tr key={i} className={`transition-colors ${p.flagged ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                                  <td className="px-4 py-2 text-gray-700 font-medium">#{p.numero_cuota}</td>
                                  <td className="px-4 py-2 text-gray-600">{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-CO") : "—"}</td>
                                  <td className="px-4 py-2 text-right font-mono text-gray-700">{fmt(p.monto_total || 0)}</td>
                                  <td className="px-4 py-2">
                                    {p.flagged ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 font-semibold"><AlertCircle size={14} /> Difiere</span>
                                    ) : (
                                      <span className="text-xs text-green-600 font-semibold">OK</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      );
                    })}
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
  saldo_total: number;
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
  const [manualFrecuencia, setManualFrecuencia] = useState<"mensual" | "quincenal">("mensual");
  const [manualExtraPago, setManualExtraPago] = useState("");
  const [manualCreating, setManualCreating] = useState(false);

  // Bulk credit upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total_en_archivo: number;
    creados: number;
    actualizados: number;
    no_encontrados: number;
    cedulas_no_encontradas: string[];
    detalle: { credit_id: string; cedula: string; name: string; action: string; valor_prestamo?: number; saldo?: number }[];
  } | null>(null);
  const [bulkError, setBulkError] = useState("");

  const handleBulkUpload = async (file: File) => {
    setBulkUploading(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/fondo/credits/bulk-upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir el PDF");
      setBulkResult(data);
      await loadAll();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBulkUploading(false);
    }
  };

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
          frecuencia_pago: manualFrecuencia,
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
            {manualUser && (() => {
              const valor = Number(manualValor) || 0;
              const cuotas = Math.max(1, Math.min(120, Number(manualCuotas) || 0));
              const cuotasComoMeses = manualFrecuencia === "quincenal" ? cuotas / 2 : cuotas;
              const tasa = cuotasComoMeses <= 12 ? 1.0 : cuotasComoMeses <= 24 ? 1.2 : 1.3;
              const tasaPorPeriodo = (manualFrecuencia === "quincenal" ? tasa / 2 : tasa) / 100;
              const showSchedule = valor > 0 && cuotas > 0;

              // Standard amortization
              const cuotaFija = showSchedule
                ? tasaPorPeriodo === 0
                  ? valor / cuotas
                  : valor * (tasaPorPeriodo * Math.pow(1 + tasaPorPeriodo, cuotas)) / (Math.pow(1 + tasaPorPeriodo, cuotas) - 1)
                : 0;

              const extraPago = Number(manualExtraPago) || 0;
              const pagoReal = Math.max(cuotaFija, cuotaFija + extraPago);

              // Build schedule with optional extra payment
              type SchedRow = { num: number; saldoInicial: number; cuota: number; interes: number; capital: number; saldoFinal: number };
              const schedule: SchedRow[] = [];
              if (showSchedule) {
                let balance = valor;
                for (let i = 0; i < cuotas && balance > 0; i++) {
                  const interes = Math.round(balance * tasaPorPeriodo * 100) / 100;
                  let pago = Math.round(pagoReal * 100) / 100;
                  let capital = pago - interes;
                  if (capital > balance || i === cuotas - 1) {
                    capital = Math.round(balance * 100) / 100;
                    pago = capital + interes;
                  }
                  const saldoFinal = Math.max(0, Math.round((balance - capital) * 100) / 100);
                  schedule.push({ num: i + 1, saldoInicial: Math.round(balance * 100) / 100, cuota: pago, interes, capital, saldoFinal });
                  balance = saldoFinal;
                }
              }

              const totalInteres = schedule.reduce((s, r) => s + r.interes, 0);
              const totalAPagar = schedule.reduce((s, r) => s + r.cuota, 0);

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor del préstamo (COP)</label>
                      <input
                        type="number"
                        min={1}
                        value={manualValor}
                        onChange={(e) => setManualValor(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                        placeholder="Ej: 5000000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Número de cuotas (1-120)</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={manualCuotas}
                        onChange={(e) => setManualCuotas(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                        placeholder="Ej: 12"
                      />
                      <p className="text-[9px] text-gray-500 mt-0.5">
                        ≤12m: 1% · ≤24m: 1.2% · &gt;24m: 1.3%
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frecuencia de pago</label>
                      <select
                        value={manualFrecuencia}
                        onChange={(e) => setManualFrecuencia(e.target.value as "mensual" | "quincenal")}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                      >
                        <option value="mensual">Mensual (30 días)</option>
                        <option value="quincenal">Quincenal (15 días)</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary + extra payment */}
                  {showSchedule && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
                      <div>
                        <p className="text-[10px] font-semibold text-orange-700 uppercase">Tasa</p>
                        <p className="text-sm font-bold text-gray-900">{tasa}% mensual</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-orange-700 uppercase">Cuota fija</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(Math.round(cuotaFija))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-orange-700 uppercase">Total intereses</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(Math.round(totalInteres))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-orange-700 uppercase">Total a pagar</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(Math.round(totalAPagar))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-orange-700 uppercase">Cuotas reales</p>
                        <p className="text-sm font-bold text-gray-900">{schedule.length}</p>
                      </div>
                    </div>
                  )}

                  {showSchedule && (
                    <div>
                      <div className="flex items-end gap-3 mb-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Pago extra por cuota (opcional)</label>
                          <input
                            type="number"
                            min={0}
                            value={manualExtraPago}
                            onChange={(e) => setManualExtraPago(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]/40 focus:border-[#ff9900]"
                            placeholder="0"
                          />
                        </div>
                        {extraPago > 0 && (
                          <div className="pb-1 text-xs text-emerald-700 font-semibold">
                            Pago real: {fmt(Math.round(pagoReal))} · Terminas en {schedule.length} cuotas en vez de {cuotas}
                          </div>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2 text-right">Saldo inicial</th>
                              <th className="px-3 py-2 text-right">Cuota</th>
                              <th className="px-3 py-2 text-right">Interés</th>
                              <th className="px-3 py-2 text-right">Capital</th>
                              <th className="px-3 py-2 text-right">Saldo final</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {schedule.map((row) => (
                              <tr key={row.num} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5 font-medium text-gray-700">{row.num}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-600">{fmt(row.saldoInicial)}</td>
                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900">{fmt(row.cuota)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-700">{fmt(row.interes)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-700">{fmt(row.capital)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-500">{fmt(row.saldoFinal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={createManualCredito}
                    disabled={manualCreating || !manualValor}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {manualCreating ? "Creando..." : "Crear crédito"}
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bulk credit upload */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <FileText size={18} className="text-[#ff9900]" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Carga masiva de créditos (PDF)</p>
            <p className="text-xs text-gray-500">Sube el archivo de reporte de créditos (Excel o PDF) para crear o actualizar créditos de todos los usuarios.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 cursor-pointer hover:border-[#ff9900]/40 hover:text-[#ff9900] transition-all">
            <Upload size={16} />
            {bulkUploading ? "Procesando..." : "Seleccionar archivo (Excel/PDF)"}
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="hidden"
              disabled={bulkUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBulkUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {bulkUploading && <div className="animate-spin h-5 w-5 border-2 border-[#ff9900] border-t-transparent rounded-full" />}
        </div>

        {bulkError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {bulkError}
          </div>
        )}

        {bulkResult && (
          <div className="mt-3 space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              <p className="font-semibold text-emerald-800 mb-2">Créditos procesados correctamente</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                  <p className="text-lg font-bold text-gray-900">{bulkResult.total_en_archivo}</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">En PDF</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                  <p className="text-lg font-bold text-emerald-700">{bulkResult.creados}</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Creados</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                  <p className="text-lg font-bold text-blue-700">{bulkResult.actualizados}</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Actualizados</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                  <p className="text-lg font-bold text-amber-700">{bulkResult.no_encontrados}</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">No encontrados</p>
                </div>
              </div>
              {bulkResult.cedulas_no_encontradas.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Cédulas no encontradas: {bulkResult.cedulas_no_encontradas.join(", ")}
                </p>
              )}
            </div>

            {bulkResult.detalle.length > 0 && (
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer font-semibold">Ver detalle ({bulkResult.detalle.length} créditos)</summary>
                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase">
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Cédula</th>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2 text-right">Préstamo</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkResult.detalle.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-mono font-semibold text-gray-700">{d.credit_id}</td>
                          <td className="px-3 py-1.5 text-gray-600">{d.cedula}</td>
                          <td className="px-3 py-1.5 text-gray-600 truncate max-w-[150px]">{d.name}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-700">{d.valor_prestamo ? fmt(d.valor_prestamo) : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-gray-500">{d.saldo ? fmt(d.saldo) : "—"}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${d.action === "creado" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                              {d.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
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
                        {fmt(c.saldo_total)}
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
