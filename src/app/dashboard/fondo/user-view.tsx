"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Landmark,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CalendarDays,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  Flag,
  Receipt,
  BarChart3,
  RefreshCw,
  X,
  Users,
  Shield,
  Sparkles,
  Target,
  MessageCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface Saldos {
  permanente: number;
  social: number;
  actividad: number;
  intereses: number;
  total_aportes: number;
}

interface Retiro {
  elegible: boolean;
  anos_afiliacion: number;
  max_retiro_anual: number;
}

interface Aporte {
  _id: string;
  periodo: string;
  monto_total: number;
  monto_permanente: number;
  monto_social: number;
  frecuencia: string;
  fecha_ejecucion: string;
}

interface Actividad {
  _id: string;
  tipo: "aporte" | "retiro";
  monto: number;
  fecha: string;
  periodo: string;
  descripcion?: string;
}

interface Pago {
  numero_cuota: number;
  fecha_pago: string;
  monto_total: number;
  monto_esperado: number;
  diferencia: number;
  flagged: boolean;
}

interface Credito {
  _id: string;
  credito_id?: string;
  valor_prestamo: number;
  tasa_interes: number;
  fecha_desembolso: string | null;
  fecha_solicitud?: string;
  numero_cuotas: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  saldo_total: number;
  saldo_capital: number;
  saldo_interes: number;
  estado: string;
  motivo_solicitud?: string | null;
  motivo_respuesta?: string | null;
  pagos: Pago[];
}

interface RetiroSolicitud {
  _id: string;
  monto: number;
  motivo?: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_solicitud: string;
  motivo_respuesta?: string | null;
}

interface FondoData {
  member: Record<string, unknown> | null;
  saldos: Saldos;
  retiro: Retiro;
  interest_alert: boolean;
  aportes: Aporte[];
  actividad: Actividad[];
  cartera: Credito[];
  retiros?: RetiroSolicitud[];
}

type TabKey = "estado" | "actividades" | "cartera";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

function FondoIncentiveLanding() {
  const [stats, setStats] = useState<{
    total_afiliados: number;
    promedio_ahorro: number;
    total_ahorrado: number;
    creditos_activos: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/fondo/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  const benefits = [
    {
      icon: PiggyBank,
      title: "Ahorro programado",
      desc: "Tu ahorro se descuenta automaticamente de tu nomina. Sin esfuerzo, tu plata crece cada quincena.",
    },
    {
      icon: CreditCard,
      title: "Creditos con tasas bajas",
      desc: "Accede a creditos desde el 1% mensual, mucho mas bajo que cualquier banco o tarjeta de credito.",
    },
    {
      icon: Users,
      title: "Una comunidad que crece",
      desc: "Mas de 66 companeros ya hacen parte de Fonalmerque. Entre mas somos, mas beneficios podemos ofrecer.",
    },
    {
      icon: TrendingUp,
      title: "Rendimientos anuales",
      desc: "Cada noviembre recibes intereses sobre tu ahorro permanente. Tu plata trabaja por ti.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white p-8 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #f4a900 0, transparent 50%), radial-gradient(circle at 80% 80%, #f4a900 0, transparent 40%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#f4a900]/20 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-[#f4a900]" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#f4a900]">
              Fonalmerque
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
            Tus companeros ya estan{" "}
            <span className="text-[#f4a900]">ahorrando</span>
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-lg">
            Fonalmerque te ayuda a ahorrar sin pensarlo,
            acceder a creditos con tasas muy bajas y tener un respaldo financiero real.
          </p>
        </div>
      </div>

      {/* Live stat */}
      {stats && stats.total_afiliados > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-[#f4a900]" />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-gray-900">{stats.total_afiliados}+</p>
            <p className="text-sm font-semibold text-gray-500">Afiliados activos en Merquellantas</p>
          </div>
        </div>
      )}

      {/* Social proof */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-[#f4a900] mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold text-gray-900 text-sm mb-1">Historias reales de tus companeros</p>
            <p className="text-xs text-gray-500">Casos anonimos de afiliados a Fonalmerque</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white/80 rounded-xl p-4 border border-orange-100">
            <p className="text-sm text-gray-700 italic leading-relaxed">
              &ldquo;Llevo 2 anos ahorrando en Fonalmerque y ya tengo mas de $4 millones
              ahorrados. Lo mejor es que ni lo siento porque se descuenta directo de la
              nomina. Cuando necesite un prestamo para una emergencia, me lo aprobaron
              en dias y la tasa fue mucho mas baja que la del banco.&rdquo;
            </p>
            <p className="text-[10px] text-gray-400 mt-2 font-semibold uppercase tracking-wider">
              — Colaborador anonimo, area operativa
            </p>
          </div>
          <div className="bg-white/80 rounded-xl p-4 border border-orange-100">
            <p className="text-sm text-gray-700 italic leading-relaxed">
              &ldquo;Pedi un credito para la matricula de mi hijo y me salio al 1% mensual.
              En el banco me pedian casi el triple. Fonalmerque me ha ayudado a planificar
              mejor mis finanzas.&rdquo;
            </p>
            <p className="text-[10px] text-gray-400 mt-2 font-semibold uppercase tracking-wider">
              — Colaborador anonimo, area administrativa
            </p>
          </div>
        </div>
      </div>

      {/* Benefits grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#f4a900]" />
          Beneficios de Fonalmerque
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5 text-[#f4a900]" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{b.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-orange-300 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
          <Landmark className="w-7 h-7 text-[#f4a900]" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Quieres afiliarte?</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
          Comunicate con el area de bienestar o con el administrador de Fonalmerque.
          La afiliacion es rapida y tu ahorro empieza desde la siguiente nomina.
        </p>
        <a
          href={`https://wa.me/573102262977?text=${encodeURIComponent("Estoy interesado en entrar al fondo")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-white font-semibold text-sm shadow-md shadow-[#f4a900]/25 hover:bg-[#e09c00] transition"
        >
          <MessageCircle className="w-4 h-4" />
          Habla con Bienestar para afiliarte
        </a>
      </div>
    </div>
  );
}

export default function FondoUserView() {
  const { data: session } = useSession();
  const [data, setData] = useState<FondoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("estado");
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [reinvestAmount, setReinvestAmount] = useState("");

  // Request modals
  const [showCreditoForm, setShowCreditoForm] = useState(false);
  const [showRetiroForm, setShowRetiroForm] = useState(false);
  const [creditoValor, setCreditoValor] = useState("");
  const [creditoCuotas, setCreditoCuotas] = useState("12");
  const [creditoFrecuencia, setCreditoFrecuencia] = useState<"quincenal" | "mensual">("mensual");
  const [creditoMotivo, setCreditoMotivo] = useState("");
  const [retiroMonto, setRetiroMonto] = useState("");
  const [retiroMotivo, setRetiroMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (d: string | undefined): string => {
    if (!d) return "Sin fecha";
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Fecha invalida";
    }
  };

  const formatShortDate = (d: string | undefined | null): string => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fondo/saldos");
      if (!res.ok) {
        if (res.status === 401) throw new Error("NO_AUTH");
        throw new Error("Error al cargar datos de Fonalmerque");
      }
      const json: FondoData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCredit = (id: string) => {
    setExpandedCredits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando tu Fonalmerque...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    if (error === "NO_AUTH") {
      return (
        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Sesion expirada</h2>
            <p className="text-sm text-gray-500">Por favor inicia sesion nuevamente.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Error</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Not a fondo member — show incentive landing page
  if (!data?.member) {
    return <FondoIncentiveLanding />;
  }

  const { saldos, retiro, interest_alert, aportes, actividad, cartera } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi Fonalmerque</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bienvenido, {session?.user?.nombre || "Usuario"}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-orange-500 transition-colors rounded-lg hover:bg-orange-50"
          title="Actualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* November Interest Alert */}
      {interest_alert && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 text-sm">Reinversion de intereses - Noviembre</h3>
              <p className="text-xs text-amber-700 mt-1">
                Es momento de decidir cuanto de tus intereses deseas reinvertir en Fonalmerque. Ingresa el monto que deseas reinvertir.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="relative flex-1 max-w-xs">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                  <input
                    type="number"
                    placeholder="Monto a reinvertir"
                    value={reinvestAmount}
                    onChange={(e) => setReinvestAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
                <button className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Aporte Permanente</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(saldos.permanente)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Aporte Social</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(saldos.social)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Actividad</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(saldos.actividad)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Intereses</span>
          </div>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(saldos.intereses)}</p>
        </div>
      </div>

      {/* Total Aportes Highlighted Card */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-6 text-white shadow-lg shadow-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-100">Total Aportes</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(saldos.total_aportes)}</p>
          </div>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <PiggyBank className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Action buttons: request loan + request withdrawal (if eligible) */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowCreditoForm(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f4a900] text-black font-bold hover:bg-[#f4a900] transition shadow-lg shadow-[#f4a900]/20"
        >
          <CreditCard className="w-5 h-5" />
          Solicitar Crédito
        </button>
        {retiro.elegible && (
          <button
            onClick={() => setShowRetiroForm(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200"
          >
            <ArrowDownCircle className="w-5 h-5" />
            Solicitar Retiro
          </button>
        )}
      </div>

      {/* Pending requests notice */}
      {data.retiros && data.retiros.filter(r => r.estado === 'pendiente').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 text-sm">Solicitud de retiro pendiente</h3>
              {data.retiros.filter(r => r.estado === 'pendiente').map(r => (
                <p key={r._id} className="text-xs text-amber-700 mt-1">
                  Has solicitado retirar {formatCurrency(r.monto)} el {formatDate(r.fecha_solicitud)}.
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            { key: "estado" as TabKey, label: "Estado de Cuenta", icon: Receipt },
            { key: "actividades" as TabKey, label: "Actividades", icon: BarChart3 },
            { key: "cartera" as TabKey, label: "Cartera", icon: CreditCard },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === key
                  ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Estado de Cuenta Tab */}
          {activeTab === "estado" && (
            <div>
              {aportes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Receipt className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay aportes registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Periodo</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Permanente</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Social</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {aportes.map((a) => (
                        <tr key={a._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-3 text-gray-700 font-medium">{a.periodo}</td>
                          <td className="px-3 py-3 text-right text-gray-800 font-semibold">{formatCurrency(a.monto_total)}</td>
                          <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCurrency(a.monto_permanente)}</td>
                          <td className="px-3 py-3 text-right text-gray-600 hidden sm:table-cell">{formatCurrency(a.monto_social)}</td>
                          <td className="px-3 py-3 text-right text-gray-500 text-xs">{formatShortDate(a.fecha_ejecucion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actividades Tab */}
          {activeTab === "actividades" && (
            <div>
              {actividad.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay actividades registradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Descripcion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {actividad.map((a) => (
                        <tr key={a._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-3 text-gray-600 text-xs">{formatShortDate(a.fecha)}</td>
                          <td className="px-3 py-3">
                            {a.tipo === "aporte" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                                <ArrowUpCircle className="w-3 h-3" />
                                Aporte
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                                <ArrowDownCircle className="w-3 h-3" />
                                Retiro
                              </span>
                            )}
                          </td>
                          <td className={`px-3 py-3 text-right font-semibold ${a.tipo === "aporte" ? "text-green-700" : "text-red-600"}`}>
                            {a.tipo === "retiro" ? "-" : ""}{formatCurrency(a.monto)}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs hidden sm:table-cell">
                            {a.descripcion || a.periodo || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Cartera Tab */}
          {activeTab === "cartera" && (
            <div>
              {cartera.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No tienes creditos activos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartera.map((credit) => (
                    <div key={credit._id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Credit Header */}
                      <button
                        onClick={() => toggleCredit(credit._id)}
                        className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            credit.estado === "activo" ? "bg-blue-100" : "bg-green-100"
                          }`}>
                            <CreditCard className={`w-5 h-5 ${credit.estado === "activo" ? "text-blue-600" : "text-green-600"}`} />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-800 text-sm">
                              Credito {credit.credito_id || credit._id.slice(-6)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(credit.valor_prestamo)} &middot; {credit.tasa_interes}% &middot;{" "}
                              {credit.cuotas_pagadas}/{credit.cuotas_pagadas + credit.cuotas_restantes} cuotas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
                            credit.estado === "activo"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : credit.estado === "pendiente"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : credit.estado === "rechazado"
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : "bg-green-100 text-green-700 border-green-200"
                          }`}>
                            {credit.estado === "activo"
                              ? "Activo"
                              : credit.estado === "pendiente"
                                ? "Pendiente de aprobación"
                                : credit.estado === "rechazado"
                                  ? "Rechazado"
                                  : "Pagado"}
                          </span>
                          {expandedCredits[credit._id] ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedCredits[credit._id] && (
                        <div className="p-5 space-y-5">
                          {credit.estado === "pendiente" && (
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Tu solicitud está esperando aprobación de Fonalmerque. Te notificaremos cuando haya una respuesta.
                            </div>
                          )}
                          {credit.estado === "rechazado" && credit.motivo_respuesta && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                              <p className="font-semibold mb-1">Motivo del rechazo:</p>
                              <p>{credit.motivo_respuesta}</p>
                            </div>
                          )}
                          {credit.motivo_solicitud && (
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
                              <p className="font-semibold mb-1 text-gray-500 uppercase tracking-wider text-[10px]">Motivo de la solicitud</p>
                              <p>{credit.motivo_solicitud}</p>
                            </div>
                          )}

                          {/* Credit Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Valor Prestamo</p>
                              <p className="text-sm font-semibold text-gray-800">{formatCurrency(credit.valor_prestamo)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Tasa Interes</p>
                              <p className="text-sm font-semibold text-gray-800">{credit.tasa_interes}%</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Fecha Desembolso</p>
                              <p className="text-sm font-semibold text-gray-800">
                                {credit.fecha_desembolso ? formatShortDate(credit.fecha_desembolso) : "Pendiente"}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Cuotas Pagadas</p>
                              <p className="text-sm font-semibold text-gray-800">{credit.cuotas_pagadas}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Cuotas Restantes</p>
                              <p className="text-sm font-semibold text-gray-800">{credit.cuotas_restantes}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Saldo Total</p>
                              <p className="text-sm font-bold text-orange-600">{formatCurrency(credit.saldo_total)}</p>
                            </div>
                          </div>

                          {/* Payment History */}
                          {credit.pagos && credit.pagos.length > 0 ? (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <CalendarDays className="w-4 h-4" />
                                Historial de Pagos
                              </h4>
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cuota</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagado</th>
                                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Esperado</th>
                                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Diferencia</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {credit.pagos.map((pago, idx) => (
                                      <tr
                                        key={idx}
                                        className={`transition-colors ${pago.flagged ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                                      >
                                        <td className="px-3 py-2.5 text-gray-700 font-medium">#{pago.numero_cuota}</td>
                                        <td className="px-3 py-2.5 text-gray-600 text-xs">{formatShortDate(pago.fecha_pago)}</td>
                                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(pago.monto_total)}</td>
                                        <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">{formatCurrency(pago.monto_esperado)}</td>
                                        <td className={`px-3 py-2.5 text-right font-medium hidden sm:table-cell ${
                                          pago.diferencia > 0 ? "text-green-600" : pago.diferencia < 0 ? "text-red-600" : "text-gray-500"
                                        }`}>
                                          {pago.diferencia > 0 ? "+" : ""}{formatCurrency(pago.diferencia)}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {pago.flagged && (
                                            <span title="Pago con diferencia significativa"><Flag className="w-4 h-4 text-red-500 mx-auto" /></span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Sin pagos registrados</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help / Contact */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
        <span>Tienes preguntas?</span>
        <a
          href={`https://wa.me/573102262977?text=${encodeURIComponent("Necesito ayuda con: ")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[#f4a900] hover:text-[#e09c00] transition"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          +57 310 2262977
        </a>
      </div>

      {/* Solicitar Crédito Modal */}
      {showCreditoForm && (() => {
        const valor = Number(creditoValor) || 0;
        const cuotas = Math.max(1, Math.min(120, Number(creditoCuotas) || 0));
        const cuotasComoMeses = creditoFrecuencia === "quincenal" ? cuotas / 2 : cuotas;
        const tasa = cuotasComoMeses <= 12 ? 1.0 : cuotasComoMeses <= 24 ? 1.2 : 1.3;
        const tasaPorPeriodo = (creditoFrecuencia === "quincenal" ? tasa / 2 : tasa) / 100;
        const showSchedule = valor > 0 && cuotas > 0;

        // Standard amortization: fixed payment = P * r(1+r)^n / ((1+r)^n - 1)
        const cuotaFija = showSchedule
          ? tasaPorPeriodo === 0
            ? valor / cuotas
            : valor * (tasaPorPeriodo * Math.pow(1 + tasaPorPeriodo, cuotas)) / (Math.pow(1 + tasaPorPeriodo, cuotas) - 1)
          : 0;

        // Build amortization schedule
        const today = new Date();
        const daysBetween = creditoFrecuencia === "quincenal" ? 15 : 30;
        const schedule: { num: number; fecha: Date; saldoInicial: number; cuota: number; interes: number; capital: number; saldoFinal: number }[] = [];
        if (showSchedule) {
          let balance = valor;
          for (let i = 0; i < cuotas; i++) {
            const fecha = new Date(today);
            fecha.setDate(fecha.getDate() + daysBetween * (i + 1));
            const interes = Math.round(balance * tasaPorPeriodo * 100) / 100;
            let pago = Math.round(cuotaFija * 100) / 100;
            let capital = pago - interes;
            // Final period: adjust so balance hits exactly 0
            if (i === cuotas - 1 || capital > balance) {
              capital = Math.round(balance * 100) / 100;
              pago = capital + interes;
            }
            const saldoFinal = Math.max(0, Math.round((balance - capital) * 100) / 100);
            schedule.push({ num: i + 1, fecha, saldoInicial: Math.round(balance * 100) / 100, cuota: pago, interes, capital, saldoFinal });
            balance = saldoFinal;
          }
        }

        const totalInteres = schedule.reduce((sum, r) => sum + r.interes, 0);
        const totalAPagar = schedule.reduce((sum, r) => sum + r.cuota, 0);

        return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#f4a900]" />
                Solicitar Crédito
              </h3>
              <button
                onClick={() => { setShowCreditoForm(false); setFormError(null); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor del préstamo (COP)</label>
                  <input
                    type="number"
                    min={1}
                    value={creditoValor}
                    onChange={(e) => setCreditoValor(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40 focus:border-[#f4a900]"
                    placeholder="Ej: 5000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de cuotas (1-120)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={creditoCuotas}
                    onChange={(e) => setCreditoCuotas(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40 focus:border-[#f4a900]"
                    placeholder="Ej: 15"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    ≤12 meses: 1% mensual · ≤24: 1.2% · &gt;24: 1.3%
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frecuencia de pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreditoFrecuencia("quincenal")}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                      creditoFrecuencia === "quincenal"
                        ? "border-[#f4a900] bg-orange-50 text-orange-900"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Cada 15 días
                    <span className="block text-[10px] font-normal text-gray-500 mt-0.5">Quincenal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditoFrecuencia("mensual")}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                      creditoFrecuencia === "mensual"
                        ? "border-[#f4a900] bg-orange-50 text-orange-900"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Cada 30 días
                    <span className="block text-[10px] font-normal text-gray-500 mt-0.5">Mensual</span>
                  </button>
                </div>
              </div>

              {/* Summary */}
              {showSchedule && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
                  <div>
                    <p className="text-[10px] font-semibold text-orange-700 uppercase">Tasa</p>
                    <p className="text-sm font-bold text-gray-900">{tasa}% mensual</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-700 uppercase">Cuota fija</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Math.round(cuotaFija * 100) / 100)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-700 uppercase">Total intereses</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Math.round(totalInteres * 100) / 100)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-orange-700 uppercase">Total a pagar</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(Math.round(totalAPagar * 100) / 100)}</p>
                  </div>
                </div>
              )}

              {/* Payment schedule */}
              {showSchedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tabla de pagos proyectada</label>
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
                            <td className="px-3 py-1.5 text-right font-mono text-gray-600">{formatCurrency(row.saldoInicial)}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900">{formatCurrency(row.cuota)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-gray-700">{formatCurrency(row.interes)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-gray-700">{formatCurrency(row.capital)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-gray-500">{formatCurrency(row.saldoFinal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  rows={3}
                  value={creditoMotivo}
                  onChange={(e) => setCreditoMotivo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40 focus:border-[#f4a900] resize-y"
                  placeholder="¿Para qué necesitas el crédito?"
                />
              </div>
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreditoForm(false); setFormError(null); }}
                className="px-4 py-2 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setSubmitting(true);
                  setFormError(null);
                  try {
                    const res = await fetch('/api/fondo/cartera', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        valor_prestamo: Number(creditoValor),
                        numero_cuotas: Number(creditoCuotas),
                        frecuencia_pago: creditoFrecuencia,
                        motivo_solicitud: creditoMotivo || null,
                      }),
                    });
                    if (!res.ok) {
                      const d = await res.json();
                      throw new Error(d.error || 'Error');
                    }
                    setShowCreditoForm(false);
                    setCreditoValor("");
                    setCreditoCuotas("12");
                    setCreditoFrecuencia("mensual");
                    setCreditoMotivo("");
                    fetchData();
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : 'Error');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !creditoValor || Number(creditoValor) <= 0}
                className="px-5 py-2 rounded-xl bg-[#f4a900] text-black font-bold hover:bg-[#f4a900] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Solicitar Retiro Modal */}
      {showRetiroForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                Solicitar Retiro
              </h3>
              <button
                onClick={() => { setShowRetiroForm(false); setFormError(null); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a retirar (COP)</label>
                <input
                  type="number"
                  min={1}
                  max={retiro.max_retiro_anual}
                  value={retiroMonto}
                  onChange={(e) => setRetiroMonto(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                  placeholder="Ej: 1000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  rows={3}
                  value={retiroMotivo}
                  onChange={(e) => setRetiroMotivo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-y"
                  placeholder="¿Por qué necesitas retirar?"
                />
              </div>
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowRetiroForm(false); setFormError(null); }}
                className="px-4 py-2 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setSubmitting(true);
                  setFormError(null);
                  try {
                    const res = await fetch('/api/fondo/retiros', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        monto: Number(retiroMonto),
                        motivo: retiroMotivo || null,
                      }),
                    });
                    if (!res.ok) {
                      const d = await res.json();
                      throw new Error(d.error || 'Error');
                    }
                    setShowRetiroForm(false);
                    setRetiroMonto("");
                    setRetiroMotivo("");
                    fetchData();
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : 'Error');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !retiroMonto || Number(retiroMonto) <= 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
