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
  FileText,
  ImageIcon,
  FileIcon,
  Download,
  Lock,
  Shield,
  X,
  ListOrdered,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import DashboardNavbar from "../../navbar";
import VideoPlayer from "../video-player";
import QuizRunner from "../quiz-runner";

interface LessonFile {
  url: string;
  name: string;
  mime_type: string;
  size: number;
  category: "video" | "document" | "image" | "other";
}

type VideoItem = {
  type: "video";
  id: string;
  title: string;
  description: string;
  video_url: string | null;
  files: LessonFile[];
  order: number;
  completed: boolean;
  locked: boolean;
};

type QuizItem = {
  type: "quiz";
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  pass_percent: number;
  max_attempts: number;
  questions_count: number;
  order: number;
  completed: boolean;
  locked: boolean;
  attempts_used: number;
  best_score: number;
};

type Item = VideoItem | QuizItem;

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  items: Item[];
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

type Tab = "description" | "resources" | "comments";

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const { status } = useSession();
  const [course, setCourse] = useState<Course | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showMerquito, setShowMerquito] = useState(false);
  const [courseJustCompleted, setCourseJustCompleted] = useState(false);
  const [tab, setTab] = useState<Tab>("description");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const marked = useRef<Set<string>>(new Set());

  const loadCourse = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/elearning/courses/${courseId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al cargar el curso");
      }
      const data: Course = await res.json();
      setCourse(data);
      const currentItem = data.items.find((it) => !it.locked);
      if (currentItem) {
        setActiveItemId(currentItem.id);
      } else if (data.items.length > 0) {
        setActiveItemId(data.items[data.items.length - 1].id);
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

  const activeItem = course?.items.find((it) => it.id === activeItemId) || null;
  const activeVideo = activeItem?.type === "video" ? activeItem : null;
  const activeQuiz = activeItem?.type === "quiz" ? activeItem : null;
  const currentIdx = course?.items.findIndex((it) => it.id === activeItemId) ?? -1;

  useEffect(() => {
    if (!activeItemId || !activeVideo) {
      setComments([]);
      return;
    }
    const loadComments = async () => {
      try {
        const res = await fetch(`/api/elearning/comments?video_id=${activeItemId}`);
        if (res.ok) setComments(await res.json());
      } catch { /* ignore */ }
    };
    loadComments();
    setTab("description");
  }, [activeItemId, activeVideo]);

  const markItemComplete = async (item: Item) => {
    if (!course) return;
    if (marked.current.has(item.id)) return;
    marked.current.add(item.id);

    setShowMerquito(true);
    setTimeout(() => setShowMerquito(false), 3500);

    try {
      const res = await fetch("/api/elearning/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          course_id: courseId,
          item_type: item.type,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadCourse();
        if (data.course_complete) setCourseJustCompleted(true);
      }
    } catch { /* ignore */ }
  };

  const handleVideoEnded = () => {
    if (activeVideo) markItemComplete(activeVideo);
  };

  const handleQuizPassed = async () => {
    setShowMerquito(true);
    setTimeout(() => setShowMerquito(false), 3500);
    const res = await fetch(`/api/elearning/courses/${courseId}`);
    if (res.ok) {
      const data: Course = await res.json();
      setCourse(data);
      const next = data.items.find((it) => !it.locked);
      if (next) setActiveItemId(next.id);
      if (data.is_complete) setCourseJustCompleted(true);
    }
  };

  const submitComment = async () => {
    if (!activeItemId || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch("/api/elearning/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: activeItemId, comment: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        const r = await fetch(`/api/elearning/comments?video_id=${activeItemId}`);
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
        <div className="max-w-7xl mx-auto px-4 pt-28 pb-16 space-y-6">
          <div className="h-48 bg-gray-200 rounded-3xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="aspect-video bg-gray-200 rounded-2xl animate-pulse" />
              <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
            <div className="bg-gray-100 rounded-2xl animate-pulse h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <main className="max-w-6xl mx-auto px-4 pt-24">
          <a href="/dashboard/elearning" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#f4a900] mb-4">
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
  const currentLabel = activeItem
    ? `${activeItem.type === "quiz" ? "Quiz" : "Lección"} ${currentIdx + 1} de ${course.items.length}`
    : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />

      {/* Merquito overlay */}
      {showMerquito && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="flex flex-col items-center text-center animate-merquitoPop">
            <div className="relative">
              <div className="absolute inset-0 bg-[#f4a900] rounded-full blur-3xl opacity-40 animate-pulse" />
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-[#f4a900] shadow-2xl bg-white">
                <Image src="/merquito.jpeg" alt="Merquito" width={160} height={160} className="object-cover w-full h-full" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-10 h-10 text-yellow-300 animate-spin-slow" />
              <Sparkles className="absolute -bottom-2 -left-2 w-8 h-8 text-yellow-300 animate-spin-slow" />
            </div>
            <h2 className="mt-6 text-3xl font-black text-white drop-shadow-lg">¡Buen trabajo!</h2>
            <p className="mt-1 text-white/90 text-lg font-semibold">Lección completada</p>
          </div>
        </div>
      )}

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-black text-white pt-20 sm:pt-24 pb-10 sm:pb-16 mb-6">
        {course.thumbnail ? (
          <>
            <img src={course.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-gray-900/80 to-gray-900" />
          </>
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, #f4a900 0, transparent 50%), radial-gradient(circle at 80% 80%, #f4a900 0, transparent 40%)",
            }}
          />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <a
            href="/dashboard/elearning"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white mb-5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Todos los cursos
          </a>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
                <BookOpen className="w-3.5 h-3.5 text-[#f4a900]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Curso</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-2">{course.title}</h1>
              {course.description && (
                <p className="text-sm sm:text-base text-white/70 max-w-2xl">{course.description}</p>
              )}
              <div className="mt-5 max-w-lg">
                <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
                  <span className="font-semibold">Tu progreso</span>
                  <span>{course.completed_videos}/{course.total_videos} · {Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${course.is_complete ? "bg-emerald-400" : "bg-[#f4a900]"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
            {course.is_complete && (
              <a
                href={`/dashboard/elearning/${courseId}/certificate`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f4a900] text-white font-bold text-sm hover:opacity-90 shadow-lg"
              >
                <Award className="w-4 h-4" />
                Ver certificado
              </a>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Mobile curriculum trigger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden w-full mb-4 px-4 py-3 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-between font-semibold text-gray-800"
        >
          <span className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#f4a900]" />
            Contenido del curso ({course.items.length})
          </span>
          <span className="text-xs text-gray-500">{course.completed_videos}/{course.total_videos}</span>
        </button>

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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main */}
          <div className="space-y-5 min-w-0">
            {activeItem ? (
              activeItem.locked ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Contenido bloqueado</h3>
                  <p className="text-sm text-gray-500">Completa las lecciones anteriores para desbloquear este contenido.</p>
                </div>
              ) : activeVideo ? (
                <>
                  {activeVideo.video_url ? (
                    <VideoPlayer
                      key={activeVideo.id}
                      src={activeVideo.video_url}
                      onEnded={handleVideoEnded}
                      poster={course.thumbnail || undefined}
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
                      <div className="w-24 h-24 rounded-full bg-[#f4a900]/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-12 h-12 text-[#f4a900]" />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#f4a900] mb-1">Lección de lectura</p>
                        <p className="text-sm text-gray-700">Cuando termines, marca esta lección como completada para avanzar.</p>
                      </div>
                    </div>
                  )}

                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#f4a900] mb-1">{currentLabel}</p>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{activeVideo.title}</h2>
                    </div>
                    {activeVideo.completed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        <PlayCircle className="w-3.5 h-3.5" /> En curso
                      </span>
                    )}
                  </div>

                  {!activeVideo.video_url && !activeVideo.completed && (
                    <button
                      onClick={() => markItemComplete(activeVideo)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:opacity-90 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marcar como completada
                    </button>
                  )}

                  {/* Tabs */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center border-b border-gray-100 px-2 sm:px-4 overflow-x-auto">
                      <TabButton active={tab === "description"} onClick={() => setTab("description")} icon={<BookOpen className="w-4 h-4" />}>
                        Descripción
                      </TabButton>
                      <TabButton
                        active={tab === "resources"}
                        onClick={() => setTab("resources")}
                        icon={<FileText className="w-4 h-4" />}
                        badge={activeVideo.files.filter((f) => f.url !== activeVideo.video_url).length}
                      >
                        Recursos
                      </TabButton>
                      <TabButton active={tab === "comments"} onClick={() => setTab("comments")} icon={<MessageSquare className="w-4 h-4" />} badge={comments.length}>
                        Comentarios
                      </TabButton>
                    </div>

                    <div className="p-5 sm:p-6">
                      {tab === "description" && (
                        activeVideo.description ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{activeVideo.description}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Sin descripción para esta lección.</p>
                        )
                      )}

                      {tab === "resources" && (
                        activeVideo.files.filter((f) => f.url !== activeVideo.video_url).length === 0 ? (
                          <p className="text-sm text-gray-400 italic">Esta lección no tiene recursos adicionales.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeVideo.files
                              .filter((f) => f.url !== activeVideo.video_url)
                              .map((f, i) => (
                                <ResourceItem key={i} file={f} />
                              ))}
                          </div>
                        )
                      )}

                      {tab === "comments" && (
                        <div>
                          <div className="flex gap-2 mb-5">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Deja tu comentario o duda..."
                              rows={2}
                              maxLength={2000}
                              className="flex-1 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-[#f4a900] text-sm resize-none text-gray-900"
                            />
                            <button
                              onClick={submitComment}
                              disabled={commentLoading || !commentText.trim()}
                              className="px-4 rounded-xl bg-[#f4a900] text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 self-start h-[68px]"
                            >
                              {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </div>
                          {comments.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">Sé el primero en comentar</p>
                          ) : (
                            <div className="space-y-4">
                              {comments.map((c) => (
                                <div key={c.id} className="flex gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f4a900] to-[#d68900] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    {c.user_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-semibold text-sm text-gray-900">{c.user_name}</span>
                                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                                      {c.is_own && (
                                        <button onClick={() => deleteComment(c.id)} className="ml-auto text-gray-400 hover:text-red-500 transition" title="Eliminar">
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
                      )}
                    </div>
                  </div>
                </>
              ) : activeQuiz ? (
                <>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#f4a900] mb-1">{currentLabel}</p>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{activeQuiz.title}</h2>
                    </div>
                  </div>
                  <QuizRunner quizId={activeQuiz.id} onPassed={handleQuizPassed} />
                </>
              ) : null
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <PlayCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Este curso aún no tiene contenido.</p>
              </div>
            )}
          </div>

          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Curriculum
                course={course}
                activeItemId={activeItemId}
                onSelect={(id) => setActiveItemId(id)}
              />
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-[#f4a900]" />
                Contenido del curso
              </h3>
              <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <Curriculum
                course={course}
                activeItemId={activeItemId}
                onSelect={(id) => {
                  setActiveItemId(id);
                  setDrawerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

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
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-merquitoPop { animation: merquitoPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .quiz-noselect, .quiz-noselect * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
      `}</style>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition ${
        active ? "text-[#f4a900]" : "text-gray-500 hover:text-gray-800"
      }`}
    >
      {icon}
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-[#f4a900] text-white" : "bg-gray-200 text-gray-600"}`}>
          {badge}
        </span>
      )}
      {active && <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#f4a900] rounded-t-full" />}
    </button>
  );
}

function Curriculum({
  course,
  activeItemId,
  onSelect,
}: {
  course: Course;
  activeItemId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const progressPct = course.total_videos > 0 ? (course.completed_videos / course.total_videos) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full p-4 border-b border-gray-100 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition lg:cursor-default"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#f4a900]/15 text-[#f4a900] flex items-center justify-center flex-shrink-0">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-bold text-gray-900">Contenido del curso</p>
            <p className="text-xs text-gray-500">
              {course.items.length} {course.items.length === 1 ? "elemento" : "elementos"} · {course.completed_videos} completados
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 lg:hidden transition ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="p-3">
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full ${course.is_complete ? "bg-emerald-500" : "bg-[#f4a900]"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className={`space-y-1 max-h-[65vh] overflow-y-auto pr-1 ${expanded ? "block" : "hidden lg:block"}`}>
          {course.items.map((it, idx) => {
            const isActive = it.id === activeItemId;
            const isQuiz = it.type === "quiz";
            return (
              <button
                key={it.id}
                onClick={() => !it.locked && onSelect(it.id)}
                disabled={it.locked}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all group ${
                  isActive
                    ? "bg-[#f4a900]/10 border border-[#f4a900]/30 shadow-sm"
                    : it.locked
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  it.locked
                    ? "bg-gray-100 text-gray-400"
                    : it.completed
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-[#f4a900] text-white"
                    : isQuiz
                    ? "bg-[#f4a900]/15 text-[#f4a900]"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {it.locked ? (
                    <Lock className="w-4 h-4" />
                  ) : it.completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isQuiz ? (
                    <Shield className="w-4 h-4" />
                  ) : isActive ? (
                    <PlayCircle className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isActive ? "text-[#f4a900]" : "text-gray-400"
                  }`}>
                    {isQuiz ? "Quiz" : `Lección ${idx + 1}`}
                  </p>
                  <p className={`text-sm font-medium line-clamp-2 leading-snug ${
                    isActive ? "text-gray-900" : it.completed ? "text-gray-700" : "text-gray-800"
                  }`}>
                    {it.title}
                  </p>
                  {isQuiz && !it.locked && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {it.time_limit_minutes} min · Aprobar {it.pass_percent}%
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {course.items.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Sin contenido aún</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ file }: { file: LessonFile }) {
  const formatSize = (n: number) => {
    if (!n) return "";
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const icon = file.category === "document" ? (
    <FileText className="w-5 h-5" />
  ) : file.category === "image" ? (
    <ImageIcon className="w-5 h-5" />
  ) : file.category === "video" ? (
    <PlayCircle className="w-5 h-5" />
  ) : (
    <FileIcon className="w-5 h-5" />
  );

  const colorClass = file.category === "document"
    ? "bg-red-50 text-red-600"
    : file.category === "image"
    ? "bg-emerald-50 text-emerald-600"
    : file.category === "video"
    ? "bg-orange-50 text-[#f4a900]"
    : "bg-gray-100 text-gray-600";

  return (
    <a
      href={`${file.url}?download=1`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#f4a900]/40 hover:bg-orange-50/30 transition group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{formatSize(file.size)} · {file.mime_type}</p>
      </div>
      <Download className="w-4 h-4 text-gray-400 group-hover:text-[#f4a900] flex-shrink-0" />
    </a>
  );
}
