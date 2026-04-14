"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  GraduationCap,
  PlayCircle,
  CheckCircle2,
  Loader2,
  BookOpen,
  Award,
  Settings,
  Search,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import DashboardNavbar from "../navbar";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  video_count: number;
  completed_count: number;
  created_at: string;
}

type Filter = "all" | "in_progress" | "completed" | "new";

export default function ElearningPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user.rol === "admin";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/elearning/courses");
        if (!res.ok) throw new Error("Error al cargar cursos");
        setCourses(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status]);

  const { inProgress, notStarted, completed } = useMemo(() => {
    const a: Course[] = [];
    const b: Course[] = [];
    const c: Course[] = [];
    for (const course of courses) {
      if (course.video_count > 0 && course.completed_count >= course.video_count) c.push(course);
      else if (course.completed_count > 0) a.push(course);
      else b.push(course);
    }
    return { inProgress: a, notStarted: b, completed: c };
  }, [courses]);

  const filtered = useMemo(() => {
    let base = courses;
    if (filter === "in_progress") base = inProgress;
    else if (filter === "completed") base = completed;
    else if (filter === "new") base = notStarted;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      base = base.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      );
    }
    return base;
  }, [courses, filter, inProgress, completed, notStarted, search]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <div className="max-w-6xl mx-auto px-4 pt-28 pb-16">
          <div className="h-48 bg-gradient-to-r from-gray-200 to-gray-100 rounded-3xl animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                <div className="aspect-video bg-gray-100 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                  <div className="h-1.5 bg-gray-100 rounded-full animate-pulse w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCompleted = completed.length;
  const totalInProgress = inProgress.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-16">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-black text-white p-6 sm:p-10 mb-8 shadow-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 30%, #f4a900 0, transparent 55%), radial-gradient(circle at 85% 70%, #f4a900 0, transparent 45%)",
            }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#f4a900]/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
                  <Sparkles className="w-3.5 h-3.5 text-[#f4a900]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">E-Learning Merquellantas</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-2">
                  Hola, <span className="text-[#f4a900]">{session?.user.nombre?.split(" ")[0] || "compañero"}</span>.
                </h1>
                <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
                  ¿Listo para seguir <span className="text-[#f4a900]">aprendiendo</span>?
                </h2>
                <p className="text-sm sm:text-base text-white/70 max-w-md">
                  Avanza por los cursos a tu ritmo, completa los quizzes y descarga tu certificado al final.
                </p>
                {isAdmin && (
                  <a
                    href="/dashboard/admin/elearning"
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold backdrop-blur-sm border border-white/20 transition"
                  >
                    <Settings className="w-4 h-4" />
                    Gestionar cursos
                  </a>
                )}
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 sm:max-w-md w-full sm:w-auto">
                <StatPill label="Cursos" value={courses.length} icon={<BookOpen className="w-4 h-4" />} />
                <StatPill label="En progreso" value={totalInProgress} icon={<PlayCircle className="w-4 h-4" />} />
                <StatPill label="Completados" value={totalCompleted} icon={<Award className="w-4 h-4" />} />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-6">{error}</div>
        )}

        {/* Continue learning shelf */}
        {inProgress.length > 0 && filter === "all" && !search.trim() && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-[#f4a900]" />
                  Continuar aprendiendo
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Retoma donde lo dejaste</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto scroll-smooth pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
              {inProgress.map((c) => (
                <ContinueCard key={c.id} course={c} />
              ))}
            </div>
          </section>
        )}

        {/* Filters + search */}
        <section className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Todos los cursos</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cursos..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-[#f4a900]"
              />
            </div>
            <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-semibold overflow-x-auto">
              <FilterChip label="Todos" value="all" current={filter} onClick={setFilter} />
              <FilterChip label="En curso" value="in_progress" current={filter} onClick={setFilter} count={inProgress.length} />
              <FilterChip label="Nuevos" value="new" current={filter} onClick={setFilter} count={notStarted.length} />
              <FilterChip label="Completados" value="completed" current={filter} onClick={setFilter} count={completed.length} />
            </div>
          </div>
        </section>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center border border-gray-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No encontramos cursos</p>
            <p className="text-xs text-gray-500 mt-1">
              {search ? "Prueba con otra búsqueda." : "Aún no hay cursos disponibles para ti."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatPill({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-3 border border-white/15">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70 mb-1">
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 sm:hidden">{label}</p>
    </div>
  );
}

function FilterChip({
  label,
  value,
  current,
  onClick,
  count,
}: {
  label: string;
  value: Filter;
  current: Filter;
  onClick: (v: Filter) => void;
  count?: number;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-[#f4a900]/15 text-[#f4a900]" : "bg-gray-200 text-gray-600"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ContinueCard({ course }: { course: Course }) {
  const progress = course.video_count > 0 ? (course.completed_count / course.video_count) * 100 : 0;
  return (
    <a
      href={`/dashboard/elearning/${course.id}`}
      className="relative flex-shrink-0 w-[280px] sm:w-[340px] snap-start group rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all"
    >
      <div className="aspect-[16/10] relative">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-200 to-amber-300 flex items-center justify-center">
            <PlayCircle className="w-14 h-14 text-white/80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#f4a900] mb-1">Continuar</p>
          <h3 className="font-bold text-base line-clamp-1">{course.title}</h3>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-white/80">
            <span>{course.completed_count}/{course.video_count} completadas</span>
            <span>·</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#f4a900] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-[#f4a900] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </a>
  );
}

function CourseCard({ course }: { course: Course }) {
  const progress = course.video_count > 0 ? (course.completed_count / course.video_count) * 100 : 0;
  const complete = course.video_count > 0 && course.completed_count >= course.video_count;
  const notStarted = course.completed_count === 0;

  return (
    <a
      href={`/dashboard/elearning/${course.id}`}
      className="bg-white rounded-2xl overflow-hidden group flex flex-col border border-gray-100 hover:border-[#f4a900]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      <div className="aspect-video bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircle className="w-16 h-16 text-[#f4a900] opacity-60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {complete && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-md">
            <Award className="w-3 h-3" />
            Completado
          </div>
        )}
        {notStarted && !complete && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-gray-700 text-[10px] font-bold shadow-md">
            <Sparkles className="w-3 h-3 text-[#f4a900]" />
            Nuevo
          </div>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-900 text-base mb-1.5 line-clamp-2 group-hover:text-[#f4a900] transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 min-h-[2rem]">
          {course.description || "Sin descripción"}
        </p>
        <div className="mt-auto">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {course.video_count} {course.video_count === 1 ? "elemento" : "elementos"}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
              <CheckCircle2 className={`w-3.5 h-3.5 ${complete ? "text-emerald-500" : "text-gray-400"}`} />
              {course.completed_count}/{course.video_count}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${complete ? "bg-emerald-500" : "bg-[#f4a900]"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </a>
  );
}
