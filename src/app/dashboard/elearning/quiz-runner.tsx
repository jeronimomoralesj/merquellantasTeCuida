"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Award,
  RotateCcw,
} from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: { text: string }[];
}

interface QuizData {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  pass_percent: number;
  max_attempts: number;
  questions_count: number;
  questions: QuizQuestion[];
}

interface AttemptsInfo {
  attempts_used: number;
  attempts_remaining: number;
  best_score: number;
  passed: boolean;
}

interface QuizRunnerProps {
  quizId: string;
  onPassed: () => void;
}

export default function QuizRunner({ quizId, onPassed }: QuizRunnerProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [info, setInfo] = useState<AttemptsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; passed: boolean; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, aRes] = await Promise.all([
        fetch(`/api/elearning/quizzes/${quizId}`),
        fetch(`/api/elearning/quizzes/${quizId}/attempt`),
      ]);
      if (!qRes.ok) throw new Error("Error al cargar quiz");
      if (!aRes.ok) throw new Error("Error al cargar intentos");
      setQuiz(await qRes.json());
      setInfo(await aRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  // Timer
  useEffect(() => {
    if (!started || result) return;
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, timeLeft, result]);

  // Disable copy / context menu / paste-keyboard-shortcuts while quiz is active
  useEffect(() => {
    if (!started || result) return;
    const stop = (e: Event) => e.preventDefault();
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "a", "x", "p", "s", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("selectstart", stop);
    document.addEventListener("dragstart", stop);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("selectstart", stop);
      document.removeEventListener("dragstart", stop);
      document.removeEventListener("keydown", key);
    };
  }, [started, result]);

  const startQuiz = () => {
    if (!quiz) return;
    startedAtRef.current = new Date().toISOString();
    setTimeLeft(quiz.time_limit_minutes * 60);
    setAnswers({});
    setStarted(true);
    setResult(null);
  };

  const submit = async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/elearning/quizzes/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          started_at: startedAtRef.current,
          answers: Object.entries(answers).map(([question_id, selected_index]) => ({
            question_id,
            selected_index,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setResult({
        score: data.score_percent,
        passed: data.passed,
        remaining: data.attempts_remaining,
      });
      setStarted(false);
      await load();
      if (data.passed) onPassed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStarted(false);
    } finally {
      setSubmitting(false);
    }
  };

  const answered = Object.keys(answers).length;
  const total = quiz?.questions.length ?? 0;

  const timeDisplay = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#f4a900]" />
      </div>
    );
  }

  if (!quiz || !info) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 bg-red-50/30 p-6 text-sm text-red-700">
        {error || "Quiz no disponible"}
      </div>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className={`rounded-2xl border p-8 text-center shadow-sm ${result.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${result.passed ? "bg-emerald-500" : "bg-red-500"} text-white shadow-lg`}>
          {result.passed ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
        </div>
        <h2 className={`text-2xl font-extrabold mb-1 ${result.passed ? "text-emerald-700" : "text-red-700"}`}>
          {result.passed ? "¡Aprobado!" : "No aprobado"}
        </h2>
        <p className="text-5xl font-black my-4 text-gray-900">{result.score}%</p>
        <p className="text-sm text-gray-600 mb-1">Nota mínima requerida: <strong>{quiz.pass_percent}%</strong></p>
        {!result.passed && (
          <p className="text-sm text-gray-600">
            Intentos restantes: <strong>{result.remaining}</strong>
          </p>
        )}
        {result.passed ? (
          <div className="mt-5 inline-flex items-center gap-2 text-emerald-700 text-sm font-semibold">
            <Award className="w-4 h-4" />
            Puedes continuar con la siguiente lección
          </div>
        ) : result.remaining > 0 ? (
          <button
            onClick={() => {
              setResult(null);
              startQuiz();
            }}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:opacity-90 shadow"
          >
            <RotateCcw className="w-4 h-4" />
            Intentar de nuevo
          </button>
        ) : (
          <div className="mt-5 p-4 rounded-xl bg-white border border-red-200 text-sm text-red-700">
            Has agotado los {quiz.max_attempts} intentos. El equipo de bienestar ha sido notificado.
          </div>
        )}
      </div>
    );
  }

  // Started — quiz in progress
  if (started) {
    const timeWarn = timeLeft <= 60;
    return (
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden quiz-noselect"
        style={{ userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none" } as React.CSSProperties}
      >
        <div className={`flex items-center justify-between gap-3 p-4 border-b ${timeWarn ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${timeWarn ? "text-red-600" : "text-[#f4a900]"}`} />
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{quiz.title}</span>
          </div>
          <div className={`flex items-center gap-2 font-mono text-sm font-bold ${timeWarn ? "text-red-600" : "text-gray-900"}`}>
            <Clock className="w-4 h-4" />
            {timeDisplay}
          </div>
        </div>
        <div className="p-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          Este quiz no permite copiar o pegar el contenido.
        </div>
        <div className="p-6 space-y-6">
          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Pregunta {idx + 1} de {quiz.questions.length}
              </p>
              <h4 className="font-semibold text-gray-900 mb-3 leading-relaxed">{q.question}</h4>
              <div className="space-y-2">
                {q.options.map((o, i) => {
                  const checked = answers[q.id] === i;
                  return (
                    <label
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        checked
                          ? "border-[#f4a900] bg-orange-50/50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={checked}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                        className="mt-0.5 accent-[#f4a900] w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-800 leading-relaxed">{o.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            Respondidas: <strong>{answered}</strong>/<strong>{total}</strong>
          </p>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-[#f4a900] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 shadow flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Enviar respuestas
          </button>
        </div>
      </div>
    );
  }

  // Intro / start screen
  const noAttemptsLeft = info.attempts_remaining <= 0 && !info.passed;

  return (
    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-[#f4a900] text-white flex items-center justify-center shadow">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#f4a900]">Quiz</p>
            <h2 className="text-xl font-extrabold text-gray-900">{quiz.title}</h2>
          </div>
        </div>
        {quiz.description && (
          <p className="text-sm text-gray-700 leading-relaxed mb-5">{quiz.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <InfoTile label="Preguntas" value={`${quiz.questions.length}`} />
          <InfoTile label="Tiempo" value={`${quiz.time_limit_minutes} min`} />
          <InfoTile label="Aprobación" value={`${quiz.pass_percent}%`} />
          <InfoTile label="Intentos" value={`${info.attempts_remaining}/${quiz.max_attempts}`} />
        </div>

        {info.passed && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-100 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Ya aprobaste este quiz ({info.best_score}%).
          </div>
        )}

        {noAttemptsLeft && (
          <div className="mb-4 p-4 rounded-xl bg-red-100 border border-red-200 text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Agotaste todos tus intentos. Mejor puntaje: {info.best_score}%.
          </div>
        )}

        <div className="p-3 rounded-xl bg-white/70 border border-orange-200 text-xs text-gray-700 mb-5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Reglas del quiz
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-gray-600">
            <li>Tienes {quiz.time_limit_minutes} minutos. Si se agota, se envía automáticamente.</li>
            <li>Máximo {quiz.max_attempts} intentos. Si reprobás todos, se notifica al equipo de bienestar.</li>
            <li>No se permite copiar, pegar o seleccionar texto durante el quiz.</li>
          </ul>
        </div>

        {!info.passed && !noAttemptsLeft && (
          <button
            onClick={startQuiz}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#f4a900] text-white font-bold text-sm hover:opacity-90 shadow flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {info.attempts_used > 0 ? "Intentar de nuevo" : "Comenzar quiz"}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/80 rounded-xl border border-orange-100 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
      <p className="text-base font-bold text-gray-900">{value}</p>
    </div>
  );
}
