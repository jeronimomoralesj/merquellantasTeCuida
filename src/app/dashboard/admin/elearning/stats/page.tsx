"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  Search,
  Users,
  CheckCircle2,
  GraduationCap,
  Award,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  X,
  Lock,
  Trophy,
  ClipboardList,
  User as UserIcon,
} from "lucide-react";
import DashboardNavbar from "../../../navbar";

interface GlobalStats {
  totals: {
    courses: number;
    users: number;
    completions: number;
    attempts: number;
    avg_score: number | null;
    blocked: number;
  };
  courses: {
    id: string;
    title: string;
    thumbnail: string | null;
    total_items: number;
    quiz_count: number;
    enrolled: number;
    completed: number;
    completion_rate: number;
    avg_quiz_score: number | null;
    blocked_users: number;
  }[];
}

interface UserRow {
  id: string;
  nombre: string;
  cedula: string;
  cargo_empleado: string | null;
  email: string | null;
  accessible_courses: number;
  completed_courses: number;
  avg_grade: number | null;
  blocked_quizzes: number;
}

interface QuizDetail {
  id: string;
  title: string;
  pass_percent: number;
  attempts_used: number;
  attempts_max: number;
  best_score: number | null;
  passed: boolean;
  blocked: boolean;
  attempts: {
    attempt_number: number;
    score_percent: number;
    passed: boolean;
    submitted_at: string;
  }[];
}

interface CourseDetail {
  id: string;
  title: string;
  thumbnail: string | null;
  total_items: number;
  items_completed: number;
  progress_percent: number;
  completed_at: string | null;
  avg_grade: number | null;
  quizzes: QuizDetail[];
}

interface UserDetail {
  user: {
    id: string;
    nombre: string;
    cedula: string;
    cargo_empleado: string | null;
    email: string | null;
  };
  summary: {
    accessible_courses: number;
    completed_courses: number;
    avg_grade: number | null;
    total_attempts: number;
    blocked_quizzes: number;
  };
  courses: CourseDetail[];
  historical_courses: CourseDetail[];
}

export default function AdminElearningStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.user.rol !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  // Load global stats
  useEffect(() => {
    if (status !== "authenticated" || session?.user.rol !== "admin") return;
    (async () => {
      setLoadingGlobal(true);
      try {
        const res = await fetch("/api/elearning/admin/stats");
        if (res.ok) setGlobalStats(await res.json());
      } finally {
        setLoadingGlobal(false);
      }
    })();
  }, [status, session]);

  // Load users (debounced on query)
  useEffect(() => {
    if (status !== "authenticated" || session?.user.rol !== "admin") return;
    const t = setTimeout(async () => {
      setUsersLoading(true);
      try {
        const url = query.trim().length >= 2
          ? `/api/elearning/admin/users?q=${encodeURIComponent(query.trim())}`
          : "/api/elearning/admin/users";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } finally {
        setUsersLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, status, session]);

  // Load user detail when opening drawer
  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return;
    }
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/elearning/admin/users/${selectedUserId}`);
        if (res.ok) setUserDetail(await res.json());
        else setUserDetail(null);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [selectedUserId]);

  const unblockQuiz = async (quizId: string, quizTitle: string) => {
    if (!selectedUserId) return;
    if (
      !confirm(
        `Desbloquear el quiz "${quizTitle}"? Se eliminarán los intentos fallidos y el usuario podrá volver a intentarlo.`
      )
    ) {
      return;
    }
    setUnblocking(quizId);
    try {
      const res = await fetch(
        `/api/elearning/admin/users/${selectedUserId}/unblock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quiz_id: quizId }),
        }
      );
      if (res.ok) {
        // Refresh detail + users list + global stats
        const [d, u, g] = await Promise.all([
          fetch(`/api/elearning/admin/users/${selectedUserId}`).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch(
            query.trim().length >= 2
              ? `/api/elearning/admin/users?q=${encodeURIComponent(query.trim())}`
              : "/api/elearning/admin/users"
          ).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/elearning/admin/stats").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (d) setUserDetail(d);
        if (u) setUsers(u.users || []);
        if (g) setGlobalStats(g);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "No se pudo desbloquear el quiz");
      }
    } finally {
      setUnblocking(null);
    }
  };

  const filteredSorted = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.blocked_quizzes !== b.blocked_quizzes)
        return b.blocked_quizzes - a.blocked_quizzes;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [users]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f4a900]" />
      </div>
    );
  }
  if (session?.user.rol !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f4a900]/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#f4a900]" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                Estadísticas de E-Learning
              </h1>
              <p className="text-sm text-gray-500">
                Progreso por usuario, calificaciones y desbloqueos
              </p>
            </div>
          </div>
          <a
            href="/dashboard/admin/elearning"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Volver a cursos
          </a>
        </div>

        {/* Global totals */}
        {loadingGlobal ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#f4a900]" />
          </div>
        ) : globalStats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard
                icon={GraduationCap}
                label="Cursos"
                value={globalStats.totals.courses}
                color="orange"
              />
              <StatCard
                icon={Users}
                label="Usuarios"
                value={globalStats.totals.users}
                color="blue"
              />
              <StatCard
                icon={CheckCircle2}
                label="Completados"
                value={globalStats.totals.completions}
                color="green"
              />
              <StatCard
                icon={ClipboardList}
                label="Intentos"
                value={globalStats.totals.attempts}
                color="purple"
              />
              <StatCard
                icon={Trophy}
                label="Nota promedio"
                value={
                  globalStats.totals.avg_score !== null
                    ? `${globalStats.totals.avg_score}%`
                    : "—"
                }
                color="amber"
              />
              <StatCard
                icon={Lock}
                label="Bloqueados"
                value={globalStats.totals.blocked}
                color="red"
              />
            </div>

            {/* Per-course table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                  Por curso
                </h2>
                <span className="text-xs text-gray-400">
                  {globalStats.courses.length}{" "}
                  {globalStats.courses.length === 1 ? "curso" : "cursos"}
                </span>
              </div>
              {globalStats.courses.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  No hay cursos aún.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Curso
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Inscritos
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Completados
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Tasa
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          Nota prom.
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Bloqueados
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {globalStats.courses.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">
                              {c.title}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {c.total_items} ítems · {c.quiz_count} quizzes
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {c.enrolled}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {c.completed}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                c.completion_rate >= 70
                                  ? "bg-green-100 text-green-700"
                                  : c.completion_rate >= 30
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {c.completion_rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">
                            {c.avg_quiz_score !== null
                              ? `${c.avg_quiz_score}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.blocked_users > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                <Lock className="w-3 h-3" />
                                {c.blocked_users}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Users list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
              Usuarios
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, cédula o cargo"
                className="pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40 focus:border-[#f4a900] w-72 max-w-full"
              />
            </div>
          </div>
          {usersLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#f4a900]" />
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              No hay usuarios para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Cargo
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Cursos
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Nota prom.
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Bloqueos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSorted.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className="hover:bg-orange-50/40 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{u.nombre}</div>
                        <div className="text-[11px] text-gray-400">{u.cedula}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {u.cargo_empleado || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        <span className="font-semibold text-gray-800">
                          {u.completed_courses}
                        </span>
                        <span className="text-gray-400">
                          {" / "}
                          {u.accessible_courses}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {u.avg_grade !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              u.avg_grade >= 70
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {u.avg_grade}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.blocked_quizzes > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <Lock className="w-3 h-3" />
                            {u.blocked_quizzes}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* User detail drawer */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedUserId(null)}
          />
          <div className="w-full max-w-2xl bg-gray-50 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#f4a900]/20 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-[#f4a900]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {userDetail?.user.nombre || "Cargando..."}
                  </h3>
                  {userDetail?.user.cargo_empleado && (
                    <p className="text-xs text-gray-500">
                      {userDetail.user.cargo_empleado}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {detailLoading || !userDetail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#f4a900]" />
                </div>
              ) : (
                <>
                  {/* User info */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="Cédula" value={userDetail.user.cedula} />
                      <InfoField
                        label="Email"
                        value={userDetail.user.email || "—"}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <SmallStat
                      label="Cursos disponibles"
                      value={userDetail.summary.accessible_courses}
                    />
                    <SmallStat
                      label="Completados"
                      value={userDetail.summary.completed_courses}
                    />
                    <SmallStat
                      label="Nota promedio"
                      value={
                        userDetail.summary.avg_grade !== null
                          ? `${userDetail.summary.avg_grade}%`
                          : "—"
                      }
                    />
                    <SmallStat
                      label="Quizzes bloqueados"
                      value={userDetail.summary.blocked_quizzes}
                      warn={userDetail.summary.blocked_quizzes > 0}
                    />
                  </div>

                  {/* Courses */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Cursos asignados
                    </h4>
                    {userDetail.courses.length === 0 ? (
                      <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400 border border-gray-100">
                        Sin cursos asignados.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userDetail.courses.map((c) => (
                          <CourseDetailCard
                            key={c.id}
                            course={c}
                            onUnblock={unblockQuiz}
                            unblockingId={unblocking}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {userDetail.historical_courses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Actividad histórica (sin acceso actual)
                      </h4>
                      <div className="space-y-3">
                        {userDetail.historical_courses.map((c) => (
                          <CourseDetailCard
                            key={c.id}
                            course={c}
                            onUnblock={unblockQuiz}
                            unblockingId={unblocking}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: "orange" | "blue" | "green" | "purple" | "amber" | "red";
}) {
  const colors: Record<string, string> = {
    orange: "bg-orange-50 text-[#f4a900]",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-3 ${
        warn ? "border-red-200 bg-red-50/50" : "border-gray-100"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
        {label}
      </p>
      <p
        className={`text-lg font-bold ${warn ? "text-red-700" : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
        {label}
      </p>
      <p className="text-sm text-gray-800 break-all">{value}</p>
    </div>
  );
}

function CourseDetailCard({
  course,
  onUnblock,
  unblockingId,
}: {
  course: CourseDetail;
  onUnblock: (quizId: string, quizTitle: string) => void;
  unblockingId: string | null;
}) {
  const completed = !!course.completed_at;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h5 className="font-semibold text-gray-900 text-sm">{course.title}</h5>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {completed ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Completado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {course.progress_percent}% progreso
                </span>
              )}
              {course.avg_grade !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Award className="w-3 h-3" />
                  Nota {course.avg_grade}%
                </span>
              )}
              <span className="text-[11px] text-gray-400">
                {course.items_completed}/{course.total_items} ítems
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${completed ? "bg-green-500" : "bg-[#f4a900]"}`}
            style={{ width: `${course.progress_percent}%` }}
          />
        </div>
      </div>
      {course.quizzes.length > 0 && (
        <div className="divide-y divide-gray-50">
          {course.quizzes.map((q) => (
            <div key={q.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">
                    {q.title}
                  </span>
                  {q.passed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      Aprobado
                    </span>
                  ) : q.blocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                      <Lock className="w-2.5 h-2.5" /> Bloqueado
                    </span>
                  ) : q.attempts_used > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      <AlertTriangle className="w-2.5 h-2.5" /> En curso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      Sin intentos
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Intentos: {q.attempts_used}/{q.attempts_max} · Mejor nota:{" "}
                  {q.best_score !== null ? `${q.best_score}%` : "—"} · Requerido:{" "}
                  {q.pass_percent}%
                </div>
                {q.attempts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.attempts.map((a) => (
                      <span
                        key={a.attempt_number}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          a.passed
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                        title={new Date(a.submitted_at).toLocaleString("es-ES")}
                      >
                        #{a.attempt_number}: {a.score_percent}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {q.blocked && (
                <button
                  onClick={() => onUnblock(q.id, q.title)}
                  disabled={unblockingId === q.id}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f4a900] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow"
                >
                  {unblockingId === q.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Desbloquear
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
