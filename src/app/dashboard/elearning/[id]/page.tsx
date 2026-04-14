"use client";

import { useEffect, useRef, useState, use } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  Award,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import DashboardNavbar from "../../navbar";

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  order: number;
  completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  videos: Video[];
  total_videos: number;
  completed_videos: number;
  is_complete: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  comment: string;
  created_at: string;
  is_own: boolean;
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const { status } = useSession();
  const [course, setCourse] = useState<Course | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showMerquito, setShowMerquito] = useState(false);
  const [courseJustCompleted, setCourseJustCompleted] = useState(false);
  const markedVideos = useRef<Set<string>>(new Set());

  const loadCourse = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/elearning/courses/${courseId}`);
      if (!res.ok) throw new Error("Error al cargar el curso");
      const data: Course = await res.json();
      setCourse(data);
      if (!activeVideoId && data.videos.length > 0) {
        const firstUncompleted = data.videos.find((v) => !v.completed) || data.videos[0];
        setActiveVideoId(firstUncompleted.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, courseId]);

  const activeVideo = course?.videos.find((v) => v.id === activeVideoId) || null;

  // Load comments when video changes
  useEffect(() => {
    if (!activeVideoId) return;
    const loadComments = async () => {
      try {
        const res = await fetch(`/api/elearning/comments?video_id=${activeVideoId}`);
        if (res.ok) setComments(await res.json());
      } catch { /* ignore */ }
    };
    loadComments();
  }, [activeVideoId]);

  const handleVideoEnded = async () => {
    if (!activeVideo || !course) return;
    if (markedVideos.current.has(activeVideo.id)) return;
    markedVideos.current.add(activeVideo.id);

    // Show Merquito celebration
    setShowMerquito(true);
    setTimeout(() => setShowMerquito(false), 3500);

    try {
      const res = await fetch("/api/elearning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: activeVideo.id, course_id: courseId }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadCourse();
        if (data.course_complete) setCourseJustCompleted(true);
      }
    } catch { /* ignore */ }
  };

  const submitComment = async () => {
    if (!activeVideoId || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch("/api/elearning/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: activeVideoId, comment: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        const r = await fetch(`/api/elearning/comments?video_id=${activeVideoId}`);
        if (r.ok) setComments(await r.json());
      }
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;
    const res = await fetch(`/api/elearning/comments?id=${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff9900]" />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <main className="max-w-6xl mx-auto px-4 pt-24">
          <a href="/dashboard/elearning" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#ff9900] mb-4">
            <ArrowLeft className="w-4 h-4" /> Volver a cursos
          </a>
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-red-600">{error || "Curso no encontrado"}</p>
          </div>
        </main>
      </div>
    );
  }

  const progressPct = course.total_videos > 0 ? (course.completed_videos / course.total_videos) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />

      {/* Merquito completion animation overlay */}
      {showMerquito && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="flex flex-col items-center text-center animate-merquitoPop">
            <div className="relative">
              <div className="absolute inset-0 bg-[#ff9900] rounded-full blur-3xl opacity-40 animate-pulse" />
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-[#ff9900] shadow-2xl bg-white">
                <Image
                  src="/merquito.jpeg"
                  alt="Merquito"
                  width={160}
                  height={160}
                  className="object-cover w-full h-full"
                />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-10 h-10 text-yellow-300 animate-spin-slow" />
              <Sparkles className="absolute -bottom-2 -left-2 w-8 h-8 text-yellow-300 animate-spin-slow" />
            </div>
            <h2 className="mt-6 text-3xl font-black text-white drop-shadow-lg">¡Buen trabajo!</h2>
            <p className="mt-1 text-white/90 text-lg font-semibold">Lección completada</p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <a href="/dashboard/elearning" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#ff9900] mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a cursos
        </a>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h1 className="text-2xl font-extrabold text-gray-900">{course.title}</h1>
              {course.description && (
                <p className="text-sm text-gray-500 mt-1">{course.description}</p>
              )}
            </div>
            {course.is_complete && (
              <a
                href={`/dashboard/elearning/${courseId}/certificate`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff9900] text-white font-semibold text-sm hover:bg-[#ffae33] transition shadow"
              >
                <Award className="w-4 h-4" />
                Ver certificado
              </a>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Progreso del curso</span>
              <span>{course.completed_videos}/{course.total_videos} lecciones</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${course.is_complete ? "bg-emerald-500" : "bg-[#ff9900]"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Course complete banner */}
        {courseJustCompleted && (
          <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg flex items-center gap-4">
            <Award className="w-10 h-10 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-lg">¡Felicidades! Completaste el curso</p>
              <p className="text-sm text-white/90">Ya puedes descargar tu certificado</p>
            </div>
            <a
              href={`/dashboard/elearning/${courseId}/certificate`}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition whitespace-nowrap"
            >
              Ver certificado
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video player + details + comments */}
          <div className="lg:col-span-2 space-y-6">
            {activeVideo ? (
              <>
                <div className="bg-black rounded-2xl overflow-hidden shadow-lg">
                  <video
                    key={activeVideo.id}
                    src={activeVideo.video_url}
                    controls
                    controlsList="nodownload"
                    onEnded={handleVideoEnded}
                    className="w-full aspect-video bg-black"
                  />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    {activeVideo.completed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> COMPLETADA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                        <PlayCircle className="w-3 h-3" /> EN CURSO
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{activeVideo.title}</h2>
                  {activeVideo.description && (
                    <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">
                      {activeVideo.description}
                    </p>
                  )}
                </div>

                {/* Comments */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-[#ff9900]" />
                    Comentarios ({comments.length})
                  </h3>
                  <div className="flex gap-2 mb-5">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Deja tu comentario o duda..."
                      rows={2}
                      maxLength={2000}
                      className="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] text-sm resize-none text-gray-900"
                    />
                    <button
                      onClick={submitComment}
                      disabled={commentLoading || !commentText.trim()}
                      className="px-4 rounded-xl bg-[#ff9900] text-white font-semibold hover:bg-[#ffae33] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 self-start h-[68px]"
                    >
                      {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Sé el primero en comentar
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#ff9900] to-[#ff7300] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {c.user_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-sm text-gray-900">{c.user_name}</span>
                              <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                              {c.is_own && (
                                <button
                                  onClick={() => deleteComment(c.id)}
                                  className="ml-auto text-gray-400 hover:text-red-500 transition"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <PlayCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Este curso aún no tiene lecciones.</p>
              </div>
            )}
          </div>

          {/* Video list sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm sticky top-24">
              <h3 className="text-sm font-bold text-gray-900 mb-3 px-2">Lecciones</h3>
              <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                {course.videos.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVideoId(v.id)}
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all ${
                      v.id === activeVideoId
                        ? "bg-[#ff9900]/10 border border-[#ff9900]/30"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {v.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-semibold">LECCIÓN {idx + 1}</p>
                      <p className={`text-sm font-medium line-clamp-2 ${
                        v.id === activeVideoId ? "text-[#ff9900]" : "text-gray-800"
                      }`}>
                        {v.title}
                      </p>
                    </div>
                  </button>
                ))}
                {course.videos.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Sin lecciones aún</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes merquitoPop {
          0% { transform: scale(0.3) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
          80% { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-merquitoPop { animation: merquitoPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
      `}</style>
    </div>
  );
}
