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

const MONTHS_ES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

function previousPeriodLabel(): string {
  const now = new Date();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const year =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return `${MONTHS_ES[month]} ${year}`;
}

function matchesPreviousPeriod(name: string): boolean {
  const target = previousPeriodLabel();
  const normalized = (name || "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === target;
}

interface EmployeeRow {
  employeeId: number;
  employee: string;
  group: string;
  position: string;
  lines: string[];
  commitments: number;
  sales: number;
  worstAlert: AlertKey;
}

const WORST_ORDER: Record<AlertKey, number> = {
  ROJO: 0,
  AMARILLO: 1,
  VERDE: 2,
  OTRO: 3,
};

function aggregateByEmployee(rows: SalesAlert[]): EmployeeRow[] {
  const map = new Map<number, EmployeeRow>();
  for (const r of rows) {
    const key = r.employeeId;
    const alert = normalizeAlert(r.alert);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        employeeId: r.employeeId,
        employee: (r.employee || "").trim(),
        group: r.group,
        position: r.position,
        lines: [r.line],
        commitments: r.commitments || 0,
        sales: r.sales || 0,
        worstAlert: alert,
      });
    } else {
      existing.commitments += r.commitments || 0;
      existing.sales += r.sales || 0;
      if (!existing.lines.includes(r.line)) existing.lines.push(r.line);
      if (WORST_ORDER[alert] < WORST_ORDER[existing.worstAlert]) {
        existing.worstAlert = alert;
      }
    }
  }
  return [...map.values()];
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
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          if (payload && typeof payload === "object") {
            console.error("sales-alerts proxy detail", payload);
          }
          const detail =
            payload && typeof payload === "object"
              ? `${payload.error ?? "Error"}${
                  payload.status ? ` (HTTP ${payload.status})` : ""
                }${
                  payload.body
                    ? ` — ${String(payload.body).slice(0, 200)}`
                    : ""
                } [revisa la consola para detalles]`
              : `HTTP ${res.status}`;
          throw new Error(detail);
        }
        if (!cancelled) setData(Array.isArray(payload) ? payload : []);
      } catch (err) {
        console.error(err);
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el seguimiento de ventas"
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const periodLabel = previousPeriodLabel();

  const periodData = useMemo(
    () => data.filter((item) => matchesPreviousPeriod(item.name)),
    [data]
  );

  const sorted = useMemo(() => {
    const aggregated = aggregateByEmployee(periodData);
    return aggregated.sort((a, b) => {
      const ai = ORDER.indexOf(a.worstAlert);
      const bi = ORDER.indexOf(b.worstAlert);
      if (ai !== bi) return ai - bi;
      return (a.employee || "").localeCompare(b.employee || "");
    });
  }, [periodData]);

  const counts = useMemo(() => {
    const c: Record<AlertKey, number> = {
      ROJO: 0,
      AMARILLO: 0,
      VERDE: 0,
      OTRO: 0,
    };
    for (const row of sorted) c[row.worstAlert] += 1;
    return c;
  }, [sorted]);

  const chartData = ORDER
    .map((k) => ({ name: k, value: counts[k], color: COLORS[k] }))
    .filter((d) => d.value > 0);

  const totalForChart = chartData.reduce((s, d) => s + d.value, 0);

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
                Periodo: <span className="font-semibold">{periodLabel}</span>{" "}
                · {sorted.length} vendedores · {periodData.length} líneas
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
                  label="Vendedores"
                  value={sorted.length}
                  color="text-gray-800"
                  bg="bg-gray-50 border-gray-200"
                  icon={<TrendingUp className="h-7 w-7 text-[#f4a900]" />}
                />
              </div>

              {/* Doughnut */}
              <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    Distribución por estado
                  </h3>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {periodLabel}
                  </span>
                </div>

                {chartData.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-12">
                    Sin datos para {periodLabel}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="relative w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            {chartData.map((entry) => (
                              <linearGradient
                                key={`g-${entry.name}`}
                                id={`grad-${entry.name}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={entry.color}
                                  stopOpacity={1}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={entry.color}
                                  stopOpacity={0.7}
                                />
                              </linearGradient>
                            ))}
                          </defs>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={85}
                            outerRadius={130}
                            paddingAngle={3}
                            cornerRadius={6}
                            stroke="#fff"
                            strokeWidth={2}
                            startAngle={90}
                            endAngle={-270}
                            isAnimationActive
                          >
                            {chartData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={`url(#grad-${entry.name})`}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              const pct =
                                totalForChart > 0
                                  ? ((value / totalForChart) * 100).toFixed(1)
                                  : "0";
                              return [`${value} (${pct}%)`, name];
                            }}
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                          {totalForChart}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-gray-500 mt-1">
                          Vendedores
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {chartData.map((entry) => {
                        const pct =
                          totalForChart > 0
                            ? (entry.value / totalForChart) * 100
                            : 0;
                        return (
                          <div
                            key={entry.name}
                            className="flex items-center gap-3"
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ background: entry.color }}
                            />
                            <span className="text-sm font-semibold text-gray-700 w-20">
                              {entry.name}
                            </span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: entry.color,
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-900 w-12 text-right">
                              {entry.value}
                            </span>
                            <span className="text-xs text-gray-500 w-12 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Líneas</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Compromiso</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Ventas</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Cumpl. %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row) => {
                        const pct =
                          row.commitments > 0
                            ? (row.sales / row.commitments) * 100
                            : 0;
                        return (
                          <tr
                            key={row.employeeId}
                            className="border-b border-gray-100 hover:bg-white"
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${BG[row.worstAlert]}`}
                              >
                                {row.worstAlert}
                              </span>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 font-medium">
                              {row.employee}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.position}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.group}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                              {row.lines.join(", ")}
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
                          </tr>
                        );
                      })}
                      {sorted.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-6 text-center text-gray-500"
                          >
                            Sin registros para {periodLabel}
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
