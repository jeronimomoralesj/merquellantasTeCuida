"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Heart,
  X,
  Calendar,
  Smile,
  Meh,
  Frown,
  Loader2,
  AlertCircle,
  Download,
  AlertTriangle,
  User,
  Clock,
  MessageSquare,
} from "lucide-react";
import { escapeHtml } from "../../../lib/sanitize";

interface Checkin {
  id: string;
  user_id: string | null;
  cedula: string | null;
  nombre: string;
  cargo: string;
  area: string;
  departamento: string;
  mood: "feliz" | "neutral" | "triste";
  note: string | null;
  help_topic: string | null;
  created_at: string;
}

interface UserSummary {
  user_id: string | null;
  cedula: string | null;
  nombre: string;
  email: string;
  cargo: string;
  area: string;
  departamento: string;
  latest_mood: "feliz" | "neutral" | "triste";
  latest_note: string | null;
  latest_help_topic: string | null;
  latest_at: string;
  checkin_count: number;
  consecutive_triste: number;
}

interface StatsMoodProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function moodIcon(mood: string) {
  if (mood === "feliz") return <Smile className="h-4 w-4 text-green-500" />;
  if (mood === "neutral") return <Meh className="h-4 w-4 text-yellow-500" />;
  if (mood === "triste") return <Frown className="h-4 w-4 text-red-500" />;
  return <Meh className="h-4 w-4 text-gray-500" />;
}

function moodColor(mood: string) {
  if (mood === "feliz") return "text-green-600";
  if (mood === "neutral") return "text-yellow-600";
  if (mood === "triste") return "text-red-600";
  return "text-gray-600";
}

export default function StatsMood({ isOpen, onClose }: StatsMoodProps) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [days, setDays] = useState<number>(90);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/users/mood/stats?days=${days}`);
      if (!res.ok) throw new Error("Error cargando estadísticas");
      const data = await res.json();
      setCheckins((data.checkins as Checkin[]) ?? []);
      setUserSummaries((data.userSummaries as UserSummary[]) ?? []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar los datos de estado de ánimo");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // --- Derived stats -------------------------------------------------------
  const overall = useMemo(() => {
    const out = { feliz: 0, neutral: 0, triste: 0, total: checkins.length };
    for (const c of checkins) out[c.mood] += 1;
    return out;
  }, [checkins]);

  const monthly = useMemo(() => {
    const m: Record<string, { feliz: number; neutral: number; triste: number; total: number }> = {};
    for (const c of checkins) {
      const d = new Date(c.created_at);
      const name = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (!m[name]) m[name] = { feliz: 0, neutral: 0, triste: 0, total: 0 };
      m[name][c.mood] += 1;
      m[name].total += 1;
    }
    return m;
  }, [checkins]);

  const consecutiveTriste = useMemo(
    () => userSummaries.filter((u) => u.consecutive_triste >= 3).sort(
      (a, b) => b.consecutive_triste - a.consecutive_triste,
    ),
    [userSummaries],
  );

  const recentNotes = useMemo(
    () => checkins.filter((c) => c.note && c.note.trim().length > 0).slice(0, 50),
    [checkins],
  );

  // --- Export --------------------------------------------------------------
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const w = window.open("", "_blank");
      if (!w) return;

      const html = `
        <!DOCTYPE html><html><head><title>Estadísticas de Estado de Ánimo</title>
        <style>
          body{font-family:Arial,sans-serif;margin:20px;font-size:12px}
          h1,h2{color:#333}
          table{width:100%;border-collapse:collapse;margin-bottom:30px}
          th,td{border:1px solid #ddd;padding:8px;text-align:left}
          th{background:#f5f5f5;font-weight:bold}
          .summary{background:#f9f9f9;padding:15px;margin-bottom:20px}
          .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:20px}
          .stat-card{background:#f8f9fa;padding:15px;border-radius:8px;border:1px solid #e9ecef}
          .alert{background:#fef2f2;border:1px solid #fecaca;padding:15px;margin-bottom:20px;border-radius:8px}
          .note{background:#fffbeb;border-left:4px solid #f4a900;padding:8px 12px;margin:4px 0;font-size:11px}
          @media print{body{margin:0}}
        </style></head><body>
          <h1>😊 Estadísticas de Estado de Ánimo (últimos ${days} días)</h1>
          <div class="summary">
            <p><strong>Total check-ins:</strong> ${overall.total}</p>
            <p><strong>Usuarios únicos:</strong> ${userSummaries.length}</p>
            <p><strong>Generado:</strong> ${new Date().toLocaleString("es-ES")}</p>
          </div>

          ${consecutiveTriste.length > 0 ? `
            <div class="alert">
              <h2>⚠️ Usuarios con ${3}+ días tristes consecutivos</h2>
              <table>
                <thead><tr><th>Nombre</th><th>Cédula</th><th>Cargo</th><th>Días</th><th>Última nota</th></tr></thead>
                <tbody>
                  ${consecutiveTriste.map(u => `
                    <tr>
                      <td>${escapeHtml(u.nombre)}</td>
                      <td>${escapeHtml(u.cedula || "")}</td>
                      <td>${escapeHtml(u.cargo || "")}</td>
                      <td style="color:#dc2626;font-weight:bold">${u.consecutive_triste}</td>
                      <td>${escapeHtml(u.latest_note || "")}</td>
                    </tr>`).join("")}
                </tbody>
              </table>
            </div>` : ""}

          <h2>📊 Resumen general</h2>
          <div class="stats-grid">
            <div class="stat-card"><h3>😊 Feliz</h3>
              <p style="font-size:24px;font-weight:bold;color:#10b981">${overall.feliz}</p>
              <p>${overall.total > 0 ? ((overall.feliz/overall.total)*100).toFixed(1) : 0}%</p></div>
            <div class="stat-card"><h3>😐 Neutral</h3>
              <p style="font-size:24px;font-weight:bold;color:#f59e0b">${overall.neutral}</p>
              <p>${overall.total > 0 ? ((overall.neutral/overall.total)*100).toFixed(1) : 0}%</p></div>
            <div class="stat-card"><h3>😢 Triste</h3>
              <p style="font-size:24px;font-weight:bold;color:#ef4444">${overall.triste}</p>
              <p>${overall.total > 0 ? ((overall.triste/overall.total)*100).toFixed(1) : 0}%</p></div>
          </div>

          <h2>📅 Por mes</h2>
          <table>
            <thead><tr><th>Mes</th><th>Feliz</th><th>Neutral</th><th>Triste</th><th>Total</th></tr></thead>
            <tbody>
              ${Object.entries(monthly).map(([m,s]) => `
                <tr>
                  <td><strong>${escapeHtml(m)}</strong></td>
                  <td style="color:#10b981">${s.feliz}</td>
                  <td style="color:#f59e0b">${s.neutral}</td>
                  <td style="color:#ef4444">${s.triste}</td>
                  <td>${s.total}</td>
                </tr>`).join("")}
            </tbody>
          </table>

          ${recentNotes.length > 0 ? `
            <h2>📝 Últimas notas de empleados</h2>
            ${recentNotes.map(c => `
              <div class="note">
                <strong>${escapeHtml(c.nombre)}</strong> — ${new Date(c.created_at).toLocaleString("es-ES")}
                · <em style="text-transform:capitalize">${escapeHtml(c.mood)}</em>
                <div>${escapeHtml(c.note || "")}</div>
              </div>`).join("")}
          ` : ""}
        </body></html>`;

      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.print(); w.close(); }, 800);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-purple-50">
          <div className="flex items-center">
            <Heart className="h-6 w-6 mr-3 text-pink-500" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estadísticas de estado de ánimo</h2>
              <p className="text-sm text-gray-600 mt-1">
                {overall.total} check-ins · {userSummaries.length} usuarios
                {consecutiveTriste.length > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    · {consecutiveTriste.length} alertas activas
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={180}>Últimos 180 días</option>
              <option value={365}>Último año</option>
            </select>
            <button
              onClick={exportToPDF}
              disabled={exporting || loading}
              className="flex items-center px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exportando..." : "Exportar PDF"}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Cargando estadísticas...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="ml-3 text-red-600">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {consecutiveTriste.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-center mb-4">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                    <h3 className="text-base sm:text-lg font-semibold text-red-800">
                      Alertas — 3+ días tristes consecutivos
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {consecutiveTriste.map((u) => (
                      <div key={u.user_id || u.cedula || u.nombre} className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start">
                            <User className="h-4 w-4 mr-2 mt-1 text-gray-500 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">{u.nombre}</p>
                              <p className="text-sm text-gray-600">
                                {u.cargo || "—"} · {u.cedula || "—"}
                              </p>
                              {u.latest_note && (
                                <p className="text-xs text-gray-700 mt-1 bg-gray-50 border-l-2 border-red-300 px-2 py-1 rounded">
                                  <span className="font-semibold">Última nota:</span> {u.latest_note}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-red-600">
                              {u.consecutive_triste} días consecutivos
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(u.latest_at).toLocaleDateString("es-ES")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Summary icon={<Smile className="h-8 w-8 text-green-500" />} label="Feliz" value={overall.feliz} total={overall.total} tone="green" />
                <Summary icon={<Meh className="h-8 w-8 text-yellow-500" />} label="Neutral" value={overall.neutral} total={overall.total} tone="yellow" />
                <Summary icon={<Frown className="h-8 w-8 text-red-500" />} label="Triste" value={overall.triste} total={overall.total} tone="red" />
              </div>

              {recentNotes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-center mb-4">
                    <MessageSquare className="h-5 w-5 mr-2 text-amber-600" />
                    <h3 className="text-base sm:text-lg font-semibold text-amber-900">
                      Notas de empleados ({recentNotes.length})
                    </h3>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recentNotes.map((c) => (
                      <div key={c.id} className="bg-white rounded-lg p-3 border border-amber-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {moodIcon(c.mood)}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.nombre}</p>
                              <p className="text-[11px] text-gray-500">
                                {c.cargo || "—"} · {new Date(c.created_at).toLocaleString("es-ES")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{c.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="h-5 w-5 mr-2 text-purple-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Por mes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Mes</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Feliz</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Neutral</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Triste</th>
                        <th className="text-left py-2 px-2 font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthly).map(([month, s]) => (
                        <tr key={month} className="border-b border-gray-100 hover:bg-white">
                          <td className="py-2 px-2 font-medium text-gray-900">{month}</td>
                          <td className="py-2 px-2 text-green-600 font-medium">{s.feliz}</td>
                          <td className="py-2 px-2 text-yellow-600 font-medium">{s.neutral}</td>
                          <td className="py-2 px-2 text-red-600 font-medium">{s.triste}</td>
                          <td className="py-2 px-2 text-gray-600">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <User className="h-5 w-5 mr-2 text-blue-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Último estado por usuario</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {userSummaries.map((u) => (
                    <div key={u.user_id || u.cedula || u.nombre} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{u.cargo || "—"}</p>
                          <p className="text-xs text-gray-400">{u.cedula || ""}</p>
                        </div>
                        <div className="flex items-center ml-2">
                          {moodIcon(u.latest_mood)}
                          <span className={`ml-1 text-xs font-medium capitalize ${moodColor(u.latest_mood)}`}>
                            {u.latest_mood}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(u.latest_at).toLocaleDateString("es-ES")}
                        <span className="ml-auto text-gray-400">{u.checkin_count} check-ins</span>
                      </div>
                      {u.latest_note && (
                        <p className="text-[11px] text-gray-600 mt-1.5 italic border-l-2 border-gray-200 pl-2 line-clamp-2">
                          “{u.latest_note}”
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ icon, label, value, total, tone }: {
  icon: React.ReactNode; label: string; value: number; total: number; tone: "green" | "yellow" | "red";
}) {
  const palette = {
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
  } as const;
  return (
    <div className={`p-4 rounded-xl border ${palette[tone]}`}>
      <div className="flex items-center">
        {icon}
        <div className="ml-3">
          <p className={`text-sm font-medium ${palette[tone].split(" ")[2]}`}>{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs">
            {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
