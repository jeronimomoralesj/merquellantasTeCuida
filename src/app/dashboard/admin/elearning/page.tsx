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
} from "lucide-react";
import DashboardNavbar from "../../navbar";
import { uploadFileChunked } from "../../../../lib/uploadChunked";
import { categoryFromMime, type LessonFile } from "../../../../lib/lesson-files";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  video_count: number;
  created_at: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  files?: LessonFile[];
  order: number;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  videos: Video[];
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

  const openNewCourse = () => {
    setEditingCourseId(null);
    setCourseTitle("");
    setCourseDescription("");
    setCoverFile(null);
    setCoverUrl(null);
    setCourseError(null);
    setShowCourseForm(true);
  };

  const openEditCourse = (c: Course | CourseDetail) => {
    setEditingCourseId(c.id);
    setCourseTitle(c.title);
    setCourseDescription(c.description);
    setCoverFile(null);
    setCoverUrl(c.thumbnail);
    setCourseError(null);
    setShowCourseForm(true);
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

      if (editingCourseId) {
        const res = await fetch(`/api/elearning/courses/${editingCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription, thumbnail }),
        });
        if (!res.ok) throw new Error("No se pudo guardar");
      } else {
        const res = await fetch("/api/elearning/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription, thumbnail }),
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
    if (!confirm("¿Eliminar este curso y todas sus lecciones? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/elearning/courses/${id}`, { method: "DELETE" });
    if (selectedCourseId === id) setSelectedCourseId(null);
    await loadCourses();
  };

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
    // Backfill files array if legacy
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

  const removeExistingFile = (idx: number) => {
    setExistingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNewFile = (idx: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onAddFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setNewFiles((prev) => {
      const total = existingFiles.length + prev.length + incoming.length;
      if (total > 5) {
        setVideoError(`Máximo 5 archivos por lección (actual: ${existingFiles.length + prev.length})`);
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

    // Size check
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
          body: JSON.stringify({
            title: videoTitle,
            description: videoDescription,
            files: combined,
          }),
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

  if (session?.user.rol !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="elearning" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff9900]/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#ff9900]" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">E-Learning</h1>
              <p className="text-sm text-gray-500">Gestiona cursos y lecciones</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/elearning"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Ver como usuario
            </a>
            <button
              onClick={openNewCourse}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff9900] text-white font-semibold text-sm hover:bg-[#ffae33] shadow"
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
                  <button
                    onClick={() => setSelectedCourseId(c.id)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-video bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden">
                      {c.thumbnail ? (
                        <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <PlayCircle className="w-12 h-12 text-[#ff9900] opacity-50" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-1">{c.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2 min-h-[2rem]">
                        {c.description || "Sin descripción"}
                      </p>
                      <span className="text-xs text-[#ff9900] font-semibold inline-flex items-center gap-1">
                        <PlayCircle className="w-3.5 h-3.5" />
                        {c.video_count} {c.video_count === 1 ? "lección" : "lecciones"}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center justify-end gap-1 p-2 border-t border-gray-100 bg-gray-50/50">
                    <button
                      onClick={() => openEditCourse(c)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-[#ff9900]"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-white hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setSelectedCourseId(null)}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#ff9900] mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Todos los cursos
            </button>

            {loadingDetail || !selectedCourse ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#ff9900]" />
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
                    </div>
                    <button
                      onClick={() => openEditCourse(selectedCourse)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                    >
                      <Edit3 className="w-4 h-4" /> Editar curso
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Lecciones ({selectedCourse.videos.length})</h3>
                  <button
                    onClick={openNewVideo}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff9900] text-white font-semibold text-sm hover:bg-[#ffae33] shadow"
                  >
                    <Plus className="w-4 h-4" /> Nueva lección
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedCourse.videos.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                      <PlayCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Aún no has agregado lecciones.</p>
                    </div>
                  ) : (
                    selectedCourse.videos.map((v, idx) => {
                      const files = v.files && v.files.length > 0 ? v.files : [];
                      return (
                        <div
                          key={v.id}
                          className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#ff9900]/10 flex items-center justify-center text-[#ff9900] font-bold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">{v.title}</p>
                            {v.description && (
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{v.description}</p>
                            )}
                            {files.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1">
                                {files.length} {files.length === 1 ? "archivo" : "archivos"}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => openEditVideo(v)}
                              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#ff9900]"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteVideo(v.id)}
                              className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCourseId ? "Editar curso" : "Nuevo curso"}
              </h3>
              <button onClick={() => setShowCourseForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Cover image */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Portada del curso
                </label>
                <div className="mt-2">
                  {coverFile ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      <img
                        src={URL.createObjectURL(coverFile)}
                        alt="preview"
                        className="w-full aspect-video object-cover"
                      />
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
                    <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#ff9900] hover:bg-orange-50/40 transition">
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
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="De qué trata el curso..."
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] resize-y text-gray-900"
                />
              </div>
              {courseError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {courseError}
                </div>
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
                className="px-5 py-2 rounded-xl bg-[#ff9900] text-white font-semibold hover:bg-[#ffae33] disabled:opacity-50 flex items-center gap-2"
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
                  placeholder="Ej: Introducción al curso"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Explica qué se aprende en esta lección..."
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] resize-y text-gray-900"
                />
              </div>

              {/* Files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Archivos ({existingFiles.length + newFiles.length}/5)
                  </label>
                  <p className="text-xs text-gray-400">Opcional. Máx 5 archivos, 50MB c/u.</p>
                </div>

                <div className="space-y-2 mb-3">
                  {existingFiles.map((f, i) => (
                    <FileRow
                      key={`e-${i}`}
                      name={f.name}
                      mime={f.mime_type}
                      size={f.size}
                      existing
                      onRemove={() => removeExistingFile(i)}
                      disabled={uploading}
                    />
                  ))}
                  {newFiles.map((f, i) => (
                    <FileRow
                      key={`n-${i}`}
                      name={f.name}
                      mime={f.type}
                      size={f.size}
                      onRemove={() => removeNewFile(i)}
                      disabled={uploading}
                    />
                  ))}
                </div>

                {existingFiles.length + newFiles.length < 5 && (
                  <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#ff9900] hover:bg-orange-50/40 transition">
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <p className="text-sm text-gray-600 font-medium">Agregar archivos</p>
                    <p className="text-xs text-gray-400 mt-1">Video (MP4/WebM/MOV), PDF, DOCX, XLSX o imágenes</p>
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
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  {videoError}
                </div>
              )}
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-2 border-t border-gray-200">
              <button
                onClick={() => setShowVideoForm(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveVideo}
                disabled={uploading || !videoTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#ff9900] text-white font-semibold hover:bg-[#ffae33] disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar lección
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
    ? "bg-orange-50 text-[#ff9900]"
    : cat === "document"
    ? "bg-red-50 text-red-600"
    : cat === "image"
    ? "bg-emerald-50 text-emerald-600"
    : "bg-gray-100 text-gray-600";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500">
          {size > 0 && (
            <>
              {size < 1024 * 1024
                ? `${(size / 1024).toFixed(0)} KB`
                : `${(size / 1024 / 1024).toFixed(1)} MB`}
              {" · "}
            </>
          )}
          {mime || "archivo"}
          {existing && " · ya guardado"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
