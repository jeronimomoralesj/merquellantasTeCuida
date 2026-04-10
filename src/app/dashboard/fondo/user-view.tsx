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
  fecha_desembolso: string;
  numero_cuotas: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  saldo_total: number;
  saldo_capital: number;
  saldo_interes: number;
  estado: string;
  pagos: Pago[];
}

interface FondoData {
  member: Record<string, unknown> | null;
  saldos: Saldos;
  retiro: Retiro;
  interest_alert: boolean;
  aportes: Aporte[];
  actividad: Actividad[];
  cartera: Credito[];
}

type TabKey = "estado" | "actividades" | "cartera";

export default function FondoUserView() {
  const { data: session } = useSession();
  const [data, setData] = useState<FondoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("estado");
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [reinvestAmount, setReinvestAmount] = useState("");

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

  const formatShortDate = (d: string | undefined): string => {
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
        throw new Error("Error al cargar datos del fondo");
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
          <p className="text-gray-500 text-sm">Cargando tu fondo...</p>
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

  // Not a fondo member
  if (!data?.member) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <PiggyBank className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No estas afiliado al fondo</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Actualmente no tienes una cuenta activa en el fondo de empleados. Si deseas afiliarte, comunicate con el area de bienestar.
          </p>
        </div>
      </div>
    );
  }

  const { saldos, retiro, interest_alert, aportes, actividad, cartera } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi Fondo</h1>
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
                Es momento de decidir cuanto de tus intereses deseas reinvertir en el fondo. Ingresa el monto que deseas reinvertir.
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

      {/* Retirement Info */}
      {retiro.elegible ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 text-sm">Elegible para retiro</h3>
              <p className="text-xs text-green-700 mt-1">
                Llevas {retiro.anos_afiliacion} anos afiliado. Puedes retirar hasta{" "}
                <span className="font-bold">{formatCurrency(retiro.max_retiro_anual)}</span> este ano.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 text-sm">Retiro aun no disponible</h3>
              <p className="text-xs text-blue-700 mt-1">
                Elegible para retiro despues de 3 anos ({3 - retiro.anos_afiliacion} anos restantes).
                Llevas {retiro.anos_afiliacion} {retiro.anos_afiliacion === 1 ? "ano" : "anos"} afiliado.
              </p>
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
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            credit.estado === "activo"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-green-100 text-green-700 border border-green-200"
                          }`}>
                            {credit.estado === "activo" ? "Activo" : "Pagado"}
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
                              <p className="text-sm font-semibold text-gray-800">{formatShortDate(credit.fecha_desembolso)}</p>
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
    </div>
  );
}
