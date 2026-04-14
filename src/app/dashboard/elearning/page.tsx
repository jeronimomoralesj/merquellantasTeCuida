"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GraduationCap, PlayCircle, CheckCircle2, Loader2, BookOpen, Award, Settings } from "lucide-react";
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

export default function ElearningPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user.rol === "admin";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff9900]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white p-8 sm:p-10 mb-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, #ff9900 0, transparent 50%), radial-gradient(circle at 80% 80%, #ff9900 0, transparent 40%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#ff9900]/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#ff9900]" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
                E-Learning Merquellantas
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
              Aprende, crece y recibe tu <span className="text-[#ff9900]">certificado</span>
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-lg">
              Mira las clases, completa los cursos y obtén tu certificado de participación.
            </p>
            {isAdmin && (
              <a
                href="/dashboard/admin/elearning"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold backdrop-blur-sm border border-white/20 transition"
              >
                <Settings className="w-4 h-4" />
                Gestionar cursos
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aún no hay cursos disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => {
              const progress = c.video_count > 0 ? (c.completed_count / c.video_count) * 100 : 0;
              const complete = c.video_count > 0 && c.completed_count >= c.video_count;
              return (
                <a
                  key={c.id}
                  href={`/dashboard/elearning/${c.id}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all overflow-hidden group"
                >
                  <div className="aspect-video bg-gradient-to-br from-orange-100 to-amber-100 relative flex items-center justify-center">
                    {c.thumbnail ? (
                      <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <PlayCircle className="w-14 h-14 text-[#ff9900] opacity-60" />
                    )}
                    {complete && (
                      <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        Completado
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-[#ff9900] transition-colors">
                      {c.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2rem]">
                      {c.description || "Sin descripción"}
                    </p>
                    <div className="flex items-center justify-between mb-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {c.video_count} {c.video_count === 1 ? "lección" : "lecciones"}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {c.completed_count}/{c.video_count}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${complete ? "bg-emerald-500" : "bg-[#ff9900]"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
