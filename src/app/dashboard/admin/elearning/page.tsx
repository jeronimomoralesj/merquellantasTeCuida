"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  ArrowLeft,
  PlayCircle,
  X,
  Upload,
  Save,
  Image as ImageIconLucide,
  FileText,
  FileIcon,
  Shield,
  Users,
  User as UserIcon,
  Search,
  CheckCircle2,
  GripVertical,
  BarChart3,
} from "lucide-react";
import DashboardNavbar from "../../navbar";
import { uploadFileChunked } from "../../../../lib/uploadChunked";
import { categoryFromMime, type LessonFile } from "../../../../lib/lesson-files";

type AudienceType = "all" | "cargos" | "users";

interface Audience {
  type: AudienceType;
  cargos?: string[];
  user_ids?: string[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  video_count: number;
  created_at: string;
  audience?: Audience;
}

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  files?: LessonFile[];
  order: number;
}

interface CourseDetailItem {
  type: "video" | "quiz";
  id: string;
  title: string;
  description: string;
  order: number;
  // video
  video_url?: string | null;
  files?: LessonFile[];
  // quiz
  time_limit_minutes?: number;
  pass_percent?: number;
  max_attempts?: number;
  questions_count?: number;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  videos: Video[];
  items: CourseDetailItem[];
  audience?: Audience;
}

interface QuizQuestion {
  question: string;
  options: { text: string; is_correct: boolean }[];
}

interface UserSearchResult {
  id: string;
  nombre: string;
  cedula: string;
  cargo_empleado: string | null;
}

const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_DOC_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function AdminElearningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Course form
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Audience picker
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceCargos, setAudienceCargos] = useState<string[]>([]);
  const [audienceUsers, setAudienceUsers] = useState<UserSearchResult[]>([]);
  const [availableCargos, setAvailableCargos] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);

  // Lesson form
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [existingFiles, setExistingFiles] = useState<LessonFile[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [videoError, setVideoError] = useState<string | null>(null);

  // Quiz form
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizTimeLimit, setQuizTimeLimit] = useState(10);
  const [quizPassPercent, setQuizPassPercent] = useState(70);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Drag and drop reorder
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const persistOrder = async (newItems: CourseDetailItem[]) => {
    if (!selectedCourse) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/elearning/courses/${selectedCourse.id}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: newItems.map((it) => ({ type: it.type, id: it.id })),
        }),
      });
      if (res.ok) {
        await loadCourseDetail(selectedCourse.id);
      }
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!draggedId || !selectedCourse || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const items = [...(selectedCourse.items || [])];
    const fromIdx = items.findIndex((it) => it.id === draggedId);
    const toIdx = items.findIndex((it) => it.id === targetId);
    if (fromIdx < 0 || toIdx < 0) {
      setDraggedId(null);
      return;
    }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    setSelectedCourse({ ...selectedCourse, items });
    setDraggedId(null);
    persistOrder(items);
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user.rol !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/elearning/courses");
      if (res.ok) setCourses(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const loadCourseDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/elearning/courses/${id}`);
      if (res.ok) setSelectedCourse(await res.json());
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user.rol === "admin") loadCourses();
  }, [status, session]);

  useEffect(() => {
    if (selectedCourseId) loadCourseDetail(selectedCourseId);
    else setSelectedCourse(null);
  }, [selectedCourseId]);

  // Load audience options lazily when course form opens
  useEffect(() => {
    if (!showCourseForm) return;
    (async () => {
      const res = await fetch("/api/elearning/audience-options");
      if (res.ok) {
        const data = await res.json();
        setAvailableCargos(data.cargos || []);
      }
    })();
  }, [showCourseForm]);

  // User search (debounced)
  useEffect(() => {
    if (!showCourseForm || audienceType !== "users") return;
    if (userQuery.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/elearning/audience-options?q=${encodeURIComponent(userQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setUserSearchResults(data.users || []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery, audienceType, showCourseForm]);

  const openNewCourse = () => {
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setCoverFile(null);
    setCoverUrl(null);
    setAudienceType("all");
    setAudienceCargos([]);
    setAudienceUsers([]);
    setUserQuery("");
    setUserSearchResults([]);
    setCourseError(null);
    setShowCourseForm(true);
  };

  const openEditCourse = async (c: Course | CourseDetail) => {
    setEditingCourseId(c.id);
    setCourseTitle(c.title);
    setCourseDescription(c.description);
    setCoverFile(null);
    setCoverUrl(c.thumbnail);
    const aud = c.audience || { type: "all" };
    setAudienceType(aud.type);
    setAudienceCargos(aud.cargos || []);
    setUserQuery("");
    setUserSearchResults([]);
    setCourseError(null);

    // Hydrate selected users
    if (aud.type === "users" && aud.user_ids && aud.user_ids.length > 0) {
      const res = await fetch("/api/elearning/users-by-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: aud.user_ids }),
      });
      if (res.ok) setAudienceUsers(await res.json());
    } else {
      setAudienceUsers([]);
    }
    setShowCourseForm(true);
  };

  const buildAudiencePayload = (): Audience => {
    if (audienceType === "cargos") return { type: "cargos", cargos: audienceCargos };
    if (audienceType === "users") return { type: "users", user_ids: audienceUsers.map((u) => u.id) };
    return { type: "all" };
  };

  const saveCourse = async () => {
    if (!courseTitle.trim()) return;
    setSavingCourse(true);
    setCourseError(null);
    try {
      let thumbnail = coverUrl;
      if (coverFile) {
        if (coverFile.size > MAX_FILE_SIZE) {
          setCourseError("La portada no debe superar 50MB");
          setSavingCourse(false);
          return;
        }
        const up = await uploadFileChunked(coverFile, { folder: "elearning" });
        thumbnail = up.url;
      }

      const audience = buildAudiencePayload();

      if (editingCourseId) {
        const res = await fetch(`/api/elearning/courses/${editingCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription, thumbnail, audience }),
        });
        if (!res.ok) throw new Error("No se pudo guardar");
      } else {
        const res = await fetch("/api/elearning/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription, thumbnail, audience }),
        });
        if (!res.ok) throw new Error("No se pudo crear");
      }
      setShowCourseForm(false);
      await loadCourses();
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingCourse(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("¿Eliminar este curso y todas sus lecciones y quizzes? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/elearning/courses/${id}`, { method: "DELETE" });
    if (selectedCourseId === id) setSelectedCourseId(null);
    await loadCourses();
  };

  // --- Lesson handlers ---
  const openNewVideo = () => {
    setEditingVideoId(null);
    setVideoTitle("");
    setVideoDescription("");
    setExistingFiles([]);
    setNewFiles([]);
    setVideoError(null);
    setShowVideoForm(true);
  };

  const openEditVideo = (v: Video) => {
    setEditingVideoId(v.id);
    setVideoTitle(v.title);
    setVideoDescription(v.description);
    const files: LessonFile[] = v.files && v.files.length > 0
      ? v.files
      : (v.video_url
          ? [{ url: v.video_url, name: "video", mime_type: "video/mp4", size: 0, category: "video" }]
          : []);
    setExistingFiles(files);
    setNewFiles([]);
    setVideoError(null);
    setShowVideoForm(true);
  };

  const removeExistingFile = (idx: number) => setExistingFiles((prev) => prev.filter((_, i) => i !== idx));
  const removeNewFile = (idx: number) => setNewFiles((prev) => prev.filter((_, i) => i !== idx));

  const onAddFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setNewFiles((prev) => {
      const total = existingFiles.length + prev.length + incoming.length;
      if (total > 5) {
        setVideoError(`Máximo 5 archivos (actual: ${existingFiles.length + prev.length})`);
        const room = Math.max(0, 5 - existingFiles.length - prev.length);
        return [...prev, ...incoming.slice(0, room)];
      }
      setVideoError(null);
      return [...prev, ...incoming];
    });
  };

  const saveVideo = async () => {
    if (!videoTitle.trim()) {
      setVideoError("El título es requerido");
      return;
    }
    if (!selectedCourse) return;

    const totalFiles = existingFiles.length + newFiles.length;
    if (totalFiles > 5) {
      setVideoError("Máximo 5 archivos");
      return;
    }
    for (const f of newFiles) {
      if (f.size > MAX_FILE_SIZE) {
        setVideoError(`${f.name} supera 50MB`);
        return;
      }
    }

    setUploading(true);
    setVideoError(null);
    try {
      const uploaded: LessonFile[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        setUploadProgress(`Subiendo ${i + 1}/${newFiles.length}: ${f.name}`);
        const res = await uploadFileChunked(f, { folder: "elearning" });
        uploaded.push({
          url: res.url,
          name: f.name,
          mime_type: f.type || "application/octet-stream",
          size: f.size,
          category: categoryFromMime(f.type || ""),
        });
      }
      const combined = [...existingFiles, ...uploaded];

      setUploadProgress("Guardando lección...");
      if (editingVideoId) {
        const res = await fetch(`/api/elearning/videos/${editingVideoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: videoTitle, description: videoDescription, files: combined }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al guardar");
        }
      } else {
        const res = await fetch("/api/elearning/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: selectedCourse.id,
            title: videoTitle,
            description: videoDescription,
            files: combined,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al crear");
        }
      }
      setShowVideoForm(false);
      await loadCourseDetail(selectedCourse.id);
      await loadCourses();
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const deleteVideo = async (id: string) => {
    if (!confirm("¿Eliminar esta lección?")) return;
    await fetch(`/api/elearning/videos/${id}`, { method: "DELETE" });
    if (selectedCourseId) await loadCourseDetail(selectedCourseId);
    await loadCourses();
  };

  // --- Quiz handlers ---
  const openNewQuiz = () => {
    setEditingQuizId(null);
    setQuizTitle("");
    setQuizDescription("");
    setQuizTimeLimit(10);
    setQuizPassPercent(70);
    setQuizQuestions([
      {
        question: "",
        options: [
          { text: "", is_correct: true },
          { text: "", is_correct: false },
        ],
      },
    ]);
    setQuizError(null);
    setShowQuizForm(true);
  };

  const openEditQuiz = async (quizId: string) => {
    setQuizError(null);
    const res = await fetch(`/api/elearning/quizzes/${quizId}`);
    if (!res.ok) return;
    const q = await res.json();
    setEditingQuizId(quizId);
    setQuizTitle(q.title);
    setQuizDescription(q.description || "");
    setQuizTimeLimit(q.time_limit_minutes);
    setQuizPassPercent(q.pass_percent);
    setQuizQuestions(
      (q.questions || []).map((qq: { question: string; options: { text: string; is_correct?: boolean }[] }) => ({
        question: qq.question,
        options: qq.options.map((o) => ({ text: o.text, is_correct: !!o.is_correct })),
      }))
    );
    setShowQuizForm(true);
  };

  const addQuestion = () => {
    if (quizQuestions.length >= 50) return;
    setQuizQuestions((prev) => [
      ...prev,
      {
        question: "",
        options: [
          { text: "", is_correct: true },
          { text: "", is_correct: false },
        ],
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuizQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: "question", value: string) => {
    setQuizQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  const addOption = (qIdx: number) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx && q.options.length < 6
          ? { ...q, options: [...q.options, { text: "", is_correct: false }] }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx && q.options.length > 2
          ? { ...q, options: q.options.filter((_, j) => j !== oIdx) }
          : q
      )
    );
  };

  const updateOption = (qIdx: number, oIdx: number, field: "text" | "is_correct", value: string | boolean) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.map((o, j) => {
          if (j !== oIdx) return field === "is_correct" && value ? { ...o, is_correct: false } : o;
          return { ...o, [field]: value } as { text: string; is_correct: boolean };
        });
        return { ...q, options };
      })
    );
  };

  const saveQuiz = async () => {
    if (!quizTitle.trim()) {
      setQuizError("El título es requerido");
      return;
    }
    if (!selectedCourse) return;
    if (quizQuestions.length === 0) {
      setQuizError("Agrega al menos una pregunta");
      return;
    }
    for (const q of quizQuestions) {
      if (!q.question.trim()) {
        setQuizError("Todas las preguntas deben tener texto");
        return;
      }
      if (q.options.some((o) => !o.text.trim())) {
        setQuizError("Todas las opciones deben tener texto");
        return;
      }
      if (!q.options.some((o) => o.is_correct)) {
        setQuizError("Cada pregunta necesita al menos una respuesta correcta");
        return;
      }
    }

    setSavingQuiz(true);
    setQuizError(null);
    try {
      if (editingQuizId) {
        const res = await fetch(`/api/elearning/quizzes/${editingQuizId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: quizTitle,
            description: quizDescription,
            time_limit_minutes: quizTimeLimit,
            pass_percent: quizPassPercent,
            questions: quizQuestions,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al guardar");
        }
      } else {
        const res = await fetch("/api/elearning/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: selectedCourse.id,
            title: quizTitle,
            description: quizDescription,
            time_limit_minutes: quizTimeLimit,
            pass_percent: quizPassPercent,
            questions: quizQuestions,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al crear");
        }
      }
      setShowQuizForm(false);
      await loadCourseDetail(selectedCourse.id);
      await loadCourses();
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingQuiz(false);
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm("¿Eliminar este quiz?")) return;
    await fetch(`/api/elearning/quizzes/${quizId}`, { method: "DELETE" });
    if (selectedCourseId) await loadCourseDetail(selectedCourseId);
    await loadCourses();
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar activePage="elearning" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#f4a900]" />
        </div>
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
              <GraduationCap className="w-5 h-5 text-[#f4a900]" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">E-Learning</h1>
              <p className="text-sm text-gray-500">Gestiona cursos, lecciones y quizzes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/admin/elearning/stats"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              <BarChart3 className="w-4 h-4" />
              Estadísticas
            </a>
            <a
              href="/dashboard/elearning"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Ver como usuario
            </a>
            <button
              onClick={openNewCourse}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:opacity-90 shadow"
            >
              <Plus className="w-4 h-4" />
              Nuevo curso
            </button>
          </div>
        </div>

        {!selectedCourseId ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-gray-100">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aún no has creado ningún curso.</p>
              </div>
            ) : (
              courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <button onClick={() => setSelectedCourseId(c.id)} className="block w-full text-left">
                    <div className="aspect-video bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden">
                      {c.thumbnail ? (
                        <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <PlayCircle className="w-12 h-12 text-[#f4a900] opacity-50" />
                        </div>
                      )}
                      <AudienceBadge audience={c.audience} />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-1">{c.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2 min-h-[2rem]">
                        {c.description || "Sin descripción"}
                      </p>
                      <span className="text-xs text-[#f4a900] font-semibold inline-flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {c.video_count} {c.video_count === 1 ? "elemento" : "elementos"}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center justify-end gap-1 p-2 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={() => openEditCourse(c)} className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-[#f4a900]" title="Editar">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteCourse(c.id)} className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-red-600" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <button onClick={() => setSelectedCourseId(null)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#f4a900] mb-4">
              <ArrowLeft className="w-4 h-4" /> Todos los cursos
            </button>

            {loadingDetail || !selectedCourse ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#f4a900]" />
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
                  {selectedCourse.thumbnail && (
                    <div className="aspect-[4/1] bg-gray-100 relative overflow-hidden">
                      <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-gray-900">{selectedCourse.title}</h2>
                      {selectedCourse.description && (
                        <p className="text-sm text-gray-500 mt-1">{selectedCourse.description}</p>
                      )}
                      <div className="mt-2">
                        <AudienceInline audience={selectedCourse.audience} />
                      </div>
                    </div>
                    <button
                      onClick={() => openEditCourse(selectedCourse)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                    >
                      <Edit3 className="w-4 h-4" /> Editar curso
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">Contenido ({selectedCourse.items?.length ?? 0})</h3>
                    {(selectedCourse.items?.length ?? 0) > 1 && (
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        · arrastra para reordenar
                      </span>
                    )}
                    {savingOrder && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#f4a900]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Guardando orden...
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={openNewQuiz}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#f4a900] text-[#f4a900] font-semibold text-sm hover:bg-orange-50"
                    >
                      <Shield className="w-4 h-4" /> Nuevo quiz
                    </button>
                    <button
                      onClick={openNewVideo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:opacity-90 shadow"
                    >
                      <Plus className="w-4 h-4" /> Nueva lección
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(selectedCourse.items || []).length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                      <PlayCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Agrega lecciones o quizzes al curso.</p>
                    </div>
                  ) : (
                    (selectedCourse.items || []).map((it, idx) => (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedId(it.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (draggedId && draggedId !== it.id) setDragOverId(it.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === it.id) setDragOverId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDrop(it.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        className={`bg-white rounded-xl border p-4 flex items-center gap-4 shadow-sm transition cursor-grab active:cursor-grabbing ${
                          draggedId === it.id
                            ? "opacity-40 border-[#f4a900]"
                            : dragOverId === it.id
                            ? "border-[#f4a900] border-2 -translate-y-0.5 shadow-md"
                            : "border-gray-100"
                        }`}
                      >
                        <div className="text-gray-300 hover:text-[#f4a900] flex-shrink-0">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          it.type === "quiz" ? "bg-[#f4a900] text-white" : "bg-[#f4a900]/10 text-[#f4a900]"
                        }`}>
                          {it.type === "quiz" ? <Shield className="w-5 h-5" /> : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              it.type === "quiz" ? "bg-[#f4a900]/15 text-[#f4a900]" : "bg-gray-100 text-gray-600"
                            }`}>
                              {it.type === "quiz" ? "QUIZ" : `LECCIÓN ${idx + 1}`}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 truncate">{it.title}</p>
                          {it.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{it.description}</p>
                          )}
                          {it.type === "quiz" && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {it.questions_count} preguntas · {it.time_limit_minutes} min · Aprobar {it.pass_percent}%
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() =>
                              it.type === "quiz"
                                ? openEditQuiz(it.id)
                                : openEditVideo(selectedCourse.videos.find((v) => v.id === it.id) || (it as unknown as Video))
                            }
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#f4a900]"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => (it.type === "quiz" ? deleteQuiz(it.id) : deleteVideo(it.id))}
                            className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Course form modal */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCourseId ? "Editar curso" : "Nuevo curso"}
              </h3>
              <button onClick={() => setShowCourseForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Cover */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Portada</label>
                <div className="mt-2">
                  {coverFile ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <img src={URL.createObjectURL(coverFile)} alt="preview" className="w-full aspect-video object-cover" />
                      <button
                        onClick={() => setCoverFile(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : coverUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <img src={coverUrl} alt="cover" className="w-full aspect-video object-cover" />
                      <button
                        onClick={() => setCoverUrl(null)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#f4a900] hover:bg-orange-50/40 transition">
                      <ImageIconLucide className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 font-medium">Agregar portada</p>
                      <p className="text-xs text-gray-400">JPG, PNG, WEBP</p>
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_MIMES.join(",")}
                        onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Título</label>
                <input
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Ej: Seguridad en el trabajo"
                  maxLength={200}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-[#f4a900] text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-[#f4a900] resize-y text-gray-900"
                />
              </div>

              {/* Audience */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
                  ¿Quién puede ver este curso?
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <AudienceRadio
                    active={audienceType === "all"}
                    onClick={() => setAudienceType("all")}
                    icon={<Users className="w-4 h-4" />}
                    label="Todos"
                  />
                  <AudienceRadio
                    active={audienceType === "cargos"}
                    onClick={() => setAudienceType("cargos")}
                    icon={<Shield className="w-4 h-4" />}
                    label="Por cargo"
                  />
                  <AudienceRadio
                    active={audienceType === "users"}
                    onClick={() => setAudienceType("users")}
                    icon={<UserIcon className="w-4 h-4" />}
                    label="Usuarios"
                  />
                </div>

                {audienceType === "cargos" && (
                  <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                    {availableCargos.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No hay cargos registrados</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableCargos.map((c) => {
                          const active = audienceCargos.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setAudienceCargos((prev) =>
                                  active ? prev.filter((x) => x !== c) : [...prev, c]
                                )
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                active
                                  ? "bg-[#f4a900] text-white border-[#f4a900]"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-[#f4a900]"
                              }`}
                            >
                              {active && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {audienceCargos.length === 0 && (
                      <p className="text-xs text-red-600 mt-2">Selecciona al menos un cargo</p>
                    )}
                  </div>
                )}

                {audienceType === "users" && (
                  <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Buscar usuario por nombre o cédula..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-sm"
                      />
                    </div>
                    {userSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1 border-t border-gray-100 pt-2">
                        {userSearchResults.map((u) => {
                          const already = audienceUsers.some((x) => x.id === u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              disabled={already}
                              onClick={() => {
                                setAudienceUsers((prev) => [...prev, u]);
                                setUserQuery("");
                                setUserSearchResults([]);
                              }}
                              className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#f4a900]/10 text-[#f4a900] flex items-center justify-center text-xs font-bold">
                                {u.nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{u.nombre}</p>
                                <p className="text-xs text-gray-500">CC {u.cedula}{u.cargo_empleado ? ` · ${u.cargo_empleado}` : ""}</p>
                              </div>
                              {already ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4 text-[#f4a900]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {audienceUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {audienceUsers.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f4a900]/10 text-[#f4a900] text-xs font-medium"
                          >
                            {u.nombre}
                            <button
                              type="button"
                              onClick={() => setAudienceUsers((prev) => prev.filter((x) => x.id !== u.id))}
                              className="hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {audienceUsers.length === 0 && (
                      <p className="text-xs text-gray-500 text-center">Busca y agrega usuarios específicos</p>
                    )}
                  </div>
                )}
              </div>

              {courseError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{courseError}</div>
              )}
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
              <button
                onClick={() => setShowCourseForm(false)}
                disabled={savingCourse}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveCourse}
                disabled={savingCourse || !courseTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#f4a900] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {savingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson form modal */}
      {showVideoForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVideoId ? "Editar lección" : "Nueva lección"}
              </h3>
              <button onClick={() => setShowVideoForm(false)} className="p-2 hover:bg-gray-100 rounded-full" disabled={uploading}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Título</label>
                <input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] resize-y text-gray-900"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Archivos ({existingFiles.length + newFiles.length}/5)
                  </label>
                  <p className="text-xs text-gray-400">Opcional. Máx 5, 50MB c/u.</p>
                </div>
                <div className="space-y-2 mb-3">
                  {existingFiles.map((f, i) => (
                    <FileRow key={`e-${i}`} name={f.name} mime={f.mime_type} size={f.size} existing onRemove={() => removeExistingFile(i)} disabled={uploading} />
                  ))}
                  {newFiles.map((f, i) => (
                    <FileRow key={`n-${i}`} name={f.name} mime={f.type} size={f.size} onRemove={() => removeNewFile(i)} disabled={uploading} />
                  ))}
                </div>
                {existingFiles.length + newFiles.length < 5 && (
                  <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#f4a900] hover:bg-orange-50/40 transition">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <p className="text-sm text-gray-600 font-medium">Agregar archivos</p>
                    <p className="text-xs text-gray-400 mt-1">Video, PDF, DOCX, XLSX o imágenes</p>
                    <input
                      type="file"
                      multiple
                      accept={[...ALLOWED_VIDEO_MIMES, ...ALLOWED_DOC_MIMES, ...ALLOWED_IMAGE_MIMES].join(",")}
                      onChange={(e) => {
                        onAddFiles(e.target.files);
                        e.currentTarget.value = "";
                      }}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {uploading && uploadProgress && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress}
                </div>
              )}
              {videoError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{videoError}</div>
              )}
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
              <button onClick={() => setShowVideoForm(false)} disabled={uploading} className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={saveVideo}
                disabled={uploading || !videoTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#f4a900] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar lección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz form modal */}
      {showQuizForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#f4a900]" />
                <h3 className="text-lg font-bold text-gray-900">
                  {editingQuizId ? "Editar quiz" : "Nuevo quiz"}
                </h3>
              </div>
              <button onClick={() => setShowQuizForm(false)} className="p-2 hover:bg-gray-100 rounded-full" disabled={savingQuiz}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Título</label>
                <input
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Ej: Evaluación módulo 1"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] resize-y text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tiempo límite (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={quizTimeLimit}
                    onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Nota mínima (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quizPassPercent}
                    onChange={(e) => setQuizPassPercent(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-gray-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Preguntas ({quizQuestions.length})</label>
                  <button
                    type="button"
                    onClick={addQuestion}
                    disabled={quizQuestions.length >= 50}
                    className="px-3 py-1.5 rounded-lg bg-[#f4a900] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar pregunta
                  </button>
                </div>
                <div className="space-y-3">
                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pregunta {qIdx + 1}</p>
                        {quizQuestions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(qIdx)} className="text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        value={q.question}
                        onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
                        placeholder="Escribe la pregunta..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-sm text-gray-900 mb-2"
                      />
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                        Opciones (marca la(s) correcta(s))
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((o, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={o.is_correct}
                              onChange={() => updateOption(qIdx, oIdx, "is_correct", true)}
                              className="accent-emerald-500 w-4 h-4 flex-shrink-0"
                              title="Marcar como correcta"
                            />
                            <input
                              value={o.text}
                              onChange={(e) => updateOption(qIdx, oIdx, "text", e.target.value)}
                              placeholder={`Opción ${oIdx + 1}`}
                              className={`flex-1 px-2.5 py-1.5 rounded-lg border text-sm text-gray-900 ${
                                o.is_correct ? "border-emerald-400 bg-emerald-50" : "border-gray-300 bg-white"
                              }`}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(qIdx, oIdx)}
                                className="text-gray-400 hover:text-red-600 flex-shrink-0"
                                title="Eliminar opción"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {q.options.length < 6 && (
                        <button
                          type="button"
                          onClick={() => addOption(qIdx)}
                          className="mt-2 text-xs text-[#f4a900] font-semibold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Agregar opción
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {quizError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{quizError}</div>
              )}
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
              <button onClick={() => setShowQuizForm(false)} disabled={savingQuiz} className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={saveQuiz}
                disabled={savingQuiz || !quizTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#f4a900] text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {savingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudienceBadge({ audience }: { audience?: Audience }) {
  if (!audience || audience.type === "all") return null;
  const label = audience.type === "cargos"
    ? `${audience.cargos?.length || 0} cargo${(audience.cargos?.length || 0) === 1 ? "" : "s"}`
    : `${audience.user_ids?.length || 0} usuario${(audience.user_ids?.length || 0) === 1 ? "" : "s"}`;
  return (
    <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold">
      <Shield className="w-3 h-3" /> {label}
    </span>
  );
}

function AudienceInline({ audience }: { audience?: Audience }) {
  if (!audience || audience.type === "all") {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Users className="w-3.5 h-3.5" /> Visible para todos</span>;
  }
  if (audience.type === "cargos") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#f4a900] font-semibold">
        <Shield className="w-3.5 h-3.5" /> Solo {audience.cargos?.length || 0} cargo{(audience.cargos?.length || 0) === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#f4a900] font-semibold">
      <UserIcon className="w-3.5 h-3.5" /> {audience.user_ids?.length || 0} usuario{(audience.user_ids?.length || 0) === 1 ? "" : "s"} específico{(audience.user_ids?.length || 0) === 1 ? "" : "s"}
    </span>
  );
}

function AudienceRadio({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition ${
        active
          ? "border-[#f4a900] bg-orange-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className={active ? "text-[#f4a900]" : "text-gray-500"}>{icon}</div>
      <span className={`text-xs font-semibold ${active ? "text-[#f4a900]" : "text-gray-600"}`}>{label}</span>
    </button>
  );
}

function FileRow({
  name,
  mime,
  size,
  existing,
  onRemove,
  disabled,
}: {
  name: string;
  mime: string;
  size: number;
  existing?: boolean;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const cat = categoryFromMime(mime);
  const icon = cat === "video" ? (
    <PlayCircle className="w-5 h-5" />
  ) : cat === "document" ? (
    <FileText className="w-5 h-5" />
  ) : cat === "image" ? (
    <ImageIconLucide className="w-5 h-5" />
  ) : (
    <FileIcon className="w-5 h-5" />
  );
  const color = cat === "video"
    ? "bg-orange-50 text-[#f4a900]"
    : cat === "document"
    ? "bg-red-50 text-red-600"
    : cat === "image"
    ? "bg-emerald-50 text-emerald-600"
    : "bg-gray-100 text-gray-600";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500">
          {size > 0 && (
            <>
              {size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`}
              {" · "}
            </>
          )}
          {mime || "archivo"}
          {existing && " · ya guardado"}
        </p>
      </div>
      <button type="button" onClick={onRemove} disabled={disabled} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
