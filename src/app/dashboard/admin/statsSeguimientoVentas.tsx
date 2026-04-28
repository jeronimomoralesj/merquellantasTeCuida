"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SalesAlert {
  documentId: number;
  employeeId: number;
  employee: string;
  group: string;
  position: string;
  alert: string;
  line: string;
  commitments: number;
  sales: number;
  date: string;
  name: string;
}

interface StatsSeguimientoVentasProps {
  isOpen: boolean;
  onClose: () => void;
}

type AlertKey = "ROJO" | "AMARILLO" | "VERDE" | "OTRO";

const ORDER: AlertKey[] = ["ROJO", "AMARILLO", "VERDE", "OTRO"];

const COLORS: Record<AlertKey, string> = {
  ROJO: "#ef4444",
  AMARILLO: "#f59e0b",
  VERDE: "#10b981",
  OTRO: "#9ca3af",
};

const BG: Record<AlertKey, string> = {
  ROJO: "bg-red-50 border-red-200 text-red-700",
  AMARILLO: "bg-yellow-50 border-yellow-200 text-yellow-700",
  VERDE: "bg-green-50 border-green-200 text-green-700",
  OTRO: "bg-gray-50 border-gray-200 text-gray-700",
};

function normalizeAlert(raw: string): AlertKey {
  const v = (raw || "").trim().toUpperCase();
  if (v === "ROJO") return "ROJO";
  if (v === "AMARILLO") return "AMARILLO";
  if (v === "VERDE") return "VERDE";
  return "OTRO";
}

function formatNumber(n: number): string {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

export default function StatsSeguimientoVentas({
  isOpen,
  onClose,
}: StatsSeguimientoVentasProps) {
  const [data, setData] = useState<SalesAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/sales-alerts", { cache: "no-store" });
        if (!res.ok) throw new Error("Error al cargar el reporte");
        const json = (await res.json()) as SalesAlert[];
        if (!cancelled) setData(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("No se pudo cargar el seguimiento de ventas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const ai = ORDER.indexOf(normalizeAlert(a.alert));
      const bi = ORDER.indexOf(normalizeAlert(b.alert));
      if (ai !== bi) return ai - bi;
      return (a.employee || "").localeCompare(b.employee || "");
    });
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<AlertKey, number> = {
      ROJO: 0,
      AMARILLO: 0,
      VERDE: 0,
      OTRO: 0,
    };
    for (const item of data) c[normalizeAlert(item.alert)] += 1;
    return c;
  }, [data]);

  const chartData = ORDER
    .map((k) => ({ name: k, value: counts[k], color: COLORS[k] }))
    .filter((d) => d.value > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 mr-3 text-[#f4a900]" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Seguimiento de Ventas
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Total registros: {data.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Cargando reporte...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="ml-3 text-red-600">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  label="Rojo"
                  value={counts.ROJO}
                  color="text-red-700"
                  bg="bg-red-50 border-red-200"
                  icon={<AlertCircle className="h-7 w-7 text-red-500" />}
                />
                <SummaryCard
                  label="Amarillo"
                  value={counts.AMARILLO}
                  color="text-yellow-700"
                  bg="bg-yellow-50 border-yellow-200"
                  icon={<AlertTriangle className="h-7 w-7 text-yellow-500" />}
                />
                <SummaryCard
                  label="Verde"
                  value={counts.VERDE}
                  color="text-green-700"
                  bg="bg-green-50 border-green-200"
                  icon={<CheckCircle className="h-7 w-7 text-green-500" />}
                />
                <SummaryCard
                  label="Total"
                  value={data.length}
                  color="text-gray-800"
                  bg="bg-gray-50 border-gray-200"
                  icon={<TrendingUp className="h-7 w-7 text-[#f4a900]" />}
                />
              </div>

              {/* Doughnut */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Distribución por estado
                </h3>
                {chartData.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Sin datos para graficar
                  </p>
                ) : (
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={2}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            value,
                            name,
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                  Listado por alerta
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Alerta</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Empleado</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Cargo</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Grupo</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Línea</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Compromiso</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Ventas</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Cumpl. %</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Periodo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row) => {
                        const key = normalizeAlert(row.alert);
                        const pct =
                          row.commitments > 0
                            ? (row.sales / row.commitments) * 100
                            : 0;
                        return (
                          <tr
                            key={`${row.documentId}-${row.employeeId}-${row.line}`}
                            className="border-b border-gray-100 hover:bg-white"
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${BG[key]}`}
                              >
                                {key}
                              </span>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 font-medium">
                              {(row.employee || "").trim()}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.position}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.group}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.line}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-right">
                              {formatNumber(row.commitments)}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-right">
                              {formatNumber(row.sales)}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-right">
                              {pct.toFixed(1)}%
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-500">
                              {row.name}
                            </td>
                          </tr>
                        );
                      })}
                      {sorted.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="py-6 text-center text-gray-500"
                          >
                            Sin registros
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`p-4 rounded-xl border ${bg}`}>
      <div className="flex items-center">
        {icon}
        <div className="ml-3">
          <p className={`text-sm font-medium ${color}`}>{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
