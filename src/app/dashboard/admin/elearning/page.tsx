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
} from "lucide-react";
import DashboardNavbar from "../../navbar";
import { uploadFileChunked } from "../../../../lib/uploadChunked";

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
  order: number;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  videos: Video[];
}

export default function AdminElearningPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New/edit course modal
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  // New/edit video modal
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
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
    setShowCourseForm(true);
  };

  const openEditCourse = (c: Course | CourseDetail) => {
    setEditingCourseId(c.id);
    setCourseTitle(c.title);
    setCourseDescription(c.description);
    setShowCourseForm(true);
  };

  const saveCourse = async () => {
    if (!courseTitle.trim()) return;
    setSavingCourse(true);
    try {
      if (editingCourseId) {
        await fetch(`/api/elearning/courses/${editingCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription }),
        });
      } else {
        await fetch("/api/elearning/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: courseTitle, description: courseDescription }),
        });
      }
      setShowCourseForm(false);
      await loadCourses();
      if (selectedCourseId) await loadCourseDetail(selectedCourseId);
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
    setVideoFile(null);
    setVideoUrl("");
    setVideoError(null);
    setShowVideoForm(true);
  };

  const openEditVideo = (v: Video) => {
    setEditingVideoId(v.id);
    setVideoTitle(v.title);
    setVideoDescription(v.description);
    setVideoFile(null);
    setVideoUrl(v.video_url);
    setVideoError(null);
    setShowVideoForm(true);
  };

  const saveVideo = async () => {
    if (!videoTitle.trim()) {
      setVideoError("El título es requerido");
      return;
    }
    if (!selectedCourse) return;

    setUploading(true);
    setVideoError(null);

    try {
      let finalUrl = videoUrl;

      if (videoFile) {
        if (videoFile.size > 50 * 1024 * 1024) {
          setVideoError("El video no debe superar 50MB");
          setUploading(false);
          return;
        }
        const upData = await uploadFileChunked(videoFile, { folder: "elearning" });
        finalUrl = upData.url;
      }

      if (!finalUrl) {
        setVideoError("Debes subir un video");
        setUploading(false);
        return;
      }

      if (editingVideoId) {
        await fetch(`/api/elearning/videos/${editingVideoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: videoTitle,
            description: videoDescription,
            video_url: finalUrl,
          }),
        });
      } else {
        await fetch("/api/elearning/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: selectedCourse.id,
            title: videoTitle,
            description: videoDescription,
            video_url: finalUrl,
          }),
        });
      }
      setShowVideoForm(false);
      await loadCourseDetail(selectedCourse.id);
      await loadCourses();
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Error");
    } finally {
      setUploading(false);
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
          <div className="space-y-3">
            {courses.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aún no has creado ningún curso.</p>
              </div>
            ) : (
              courses.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition"
                >
                  <button
                    onClick={() => setSelectedCourseId(c.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <h3 className="font-bold text-gray-900 text-base mb-1">{c.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                      {c.description || "Sin descripción"}
                    </p>
                    <span className="text-xs text-[#ff9900] font-semibold inline-flex items-center gap-1">
                      <PlayCircle className="w-3.5 h-3.5" />
                      {c.video_count} {c.video_count === 1 ? "lección" : "lecciones"}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditCourse(c)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#ff9900]"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id)}
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
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-5 flex items-start justify-between gap-4">
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
                    selectedCourse.videos.map((v, idx) => (
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCourseId ? "Editar curso" : "Nuevo curso"}
              </h3>
              <button onClick={() => setShowCourseForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
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
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowCourseForm(false)}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
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

      {/* Video form modal */}
      {showVideoForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVideoId ? "Editar lección" : "Nueva lección"}
              </h3>
              <button onClick={() => setShowVideoForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
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
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Archivo de video {editingVideoId && "(opcional — deja vacío para mantener el actual)"}
                </label>
                <p className="text-xs text-gray-400 mt-1 mb-2">Máx 50MB. Formatos: MP4, WebM, MOV.</p>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#ff9900] file:text-white hover:file:bg-[#ffae33]"
                />
                {videoFile && (
                  <p className="text-xs text-gray-600 mt-2">
                    {videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                )}
                {editingVideoId && videoUrl && !videoFile && (
                  <p className="text-xs text-gray-500 mt-2">Video actual conservado.</p>
                )}
              </div>
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
                    <Upload className="w-4 h-4" />
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
