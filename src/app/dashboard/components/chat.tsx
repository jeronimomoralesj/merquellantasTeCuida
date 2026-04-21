"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MessageCircle,
  X,
  Send,
  MessageSquare,
  ChevronRight,
  RotateCcw,
  Palmtree,
  HeartPlus,
  Landmark,
  FileSpreadsheet,
  GraduationCap,
  FileText,
  HelpCircle,
} from "lucide-react";

type Mood = "feliz" | "neutral" | "triste";
type Role = "user" | "bot";

interface ChatMessage {
  role: Role;
  content: string;
}

type Phase =
  | "ask_mood"
  | "ask_note"
  | "ask_topic"
  | "ask_help_type"
  | "walkthrough"
  | "done";

interface HelpTopic {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Steps shown when the user picks "necesito ayuda entendiendo cómo usarlo". */
  walkthrough: string[];
}

// Keep this list in sync with what the dashboard actually offers. Each entry drives
// both the bubble label and, if the user asks for help, the in-chat walkthrough.
const HELP_TOPICS: HelpTopic[] = [
  {
    id: "permiso",
    label: "Pedir un permiso",
    href: "/dashboard/solicitud?tipo=permiso",
    icon: Palmtree,
    walkthrough: [
      "Estás en el módulo de solicitudes. Arriba verás pestañas: Permiso, Vacaciones e Incapacidad. Selecciona \"Permiso\".",
      "Escribe el motivo del permiso en la caja de descripción.",
      "Elige la fecha y marca la hora de inicio y fin del permiso.",
      "En la sección \"Jefe inmediato\" busca por nombre o cédula a la persona que debe aprobar el permiso. Esa persona recibirá un correo con un enlace único para aprobar o rechazar.",
      "Adjunta el soporte (opcional) y haz clic en \"Enviar solicitud\". La respuesta del jefe aparecerá aquí en el dashboard.",
    ],
  },
  {
    id: "vacaciones",
    label: "Solicitar vacaciones",
    href: "/dashboard/solicitud?tipo=vacaciones",
    icon: Palmtree,
    walkthrough: [
      "Estás en el módulo de solicitudes. Selecciona la pestaña \"Vacaciones\".",
      "Revisa tu saldo de días disponibles — aparece en la tarjeta superior del dashboard principal.",
      "Elige la fecha de inicio y la fecha de regreso. El sistema calcula los días automáticamente.",
      "Busca y selecciona a tu jefe inmediato. Le llegará un correo con un enlace para aprobar o rechazar la solicitud; tú verás la respuesta aquí en cuanto decida.",
      "Adjunta el documento de soporte y haz clic en \"Enviar solicitud\".",
    ],
  },
  {
    id: "cesantias",
    label: "Solicitar cesantías",
    href: "/dashboard/cesantias",
    icon: HeartPlus,
    walkthrough: [
      "Estás en el módulo de Cesantías.",
      "Elige la categoría (vivienda, educación, calamidad u otra según aplique).",
      "Describe el motivo de la solicitud en el cuadro de texto.",
      "Sube el soporte en PDF o imagen (ej. cotización, factura, contrato).",
      "Envía la solicitud. Recibirás respuesta de Talento Humano en tu dashboard.",
    ],
  },
  {
    id: "fondo",
    label: "Ver mi Fonalmerque",
    href: "/dashboard/fondo",
    icon: Landmark,
    walkthrough: [
      "Estás en el módulo del Fonalmerque.",
      "En la parte superior ves tu saldo de aportes y de cartera.",
      "Más abajo encontrarás el historial de movimientos y la actividad reciente.",
      "Si quieres afiliarte o solicitar ayuda, usa los botones de WhatsApp al final.",
    ],
  },
  {
    id: "certificado",
    label: "Descargar certificado de ingresos y retenciones",
    href: "/dashboard/certificado",
    icon: FileSpreadsheet,
    walkthrough: [
      "Estás en el módulo del Certificado de Ingresos y Retenciones.",
      "Verás una lista con el año o años gravables para los que hay certificado disponible.",
      "Haz clic en \"Descargar\" al lado del año que necesitas.",
      "El archivo se descarga en formato PDF (DIAN Formato 220), listo para tu declaración de renta.",
      "Si el certificado aún no aparece, talento humano lo publicará antes del 30 de marzo.",
    ],
  },
  {
    id: "documentos",
    label: "Ver documentos",
    href: "/dashboard/documents",
    icon: FileText,
    walkthrough: [
      "Estás en la biblioteca de documentos corporativos.",
      "Usa el buscador o los filtros por categoría para encontrar lo que necesites.",
      "Haz clic en un documento para descargarlo o abrirlo.",
    ],
  },
  {
    id: "elearning",
    label: "Entrar a E-Learning",
    href: "/dashboard/elearning",
    icon: GraduationCap,
    walkthrough: [
      "Estás en E-Learning. Verás las capacitaciones asignadas a ti.",
      "Haz clic en un curso para abrirlo y ver sus videos y materiales.",
      "Al terminar los videos, presenta el quiz para aprobar y liberar tu certificado.",
      "Tu progreso se guarda automáticamente: puedes cerrar y continuar después.",
    ],
  },
  {
    id: "pqrsf",
    label: "Enviar PQRSF",
    href: "/dashboard/pqrsf",
    icon: HelpCircle,
    walkthrough: [
      "Estás en el buzón de PQRSF (Preguntas, Quejas, Reclamos, Sugerencias, Felicitaciones).",
      "Elige el tipo de mensaje que quieres enviar.",
      "Escribe tu mensaje. Puedes marcar \"anónimo\" si prefieres no identificarte.",
      "Envía. Talento Humano recibirá tu mensaje y responderá si dejas tus datos.",
    ],
  },
];

const TOPIC_BY_ID: Record<string, HelpTopic> = Object.fromEntries(
  HELP_TOPICS.map((t) => [t.id, t]),
);

// Storage key for cross-page walkthrough persistence.
const STATE_KEY = "bienestar_chat_state_v2";

interface PersistedState {
  phase: Phase;
  mood: Mood | null;
  messages: ChatMessage[];
  topicId: string | null;
  walkStep: number;
}

function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function saveState(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}

function clearState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

export default function BienestarChat() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ask_mood");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [walkStep, setWalkStep] = useState(0);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const userName = session?.user?.nombre || "";
  const maxChars = 500;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Persist across client-side navigations so walkthroughs survive router.push ---
  useEffect(() => {
    const restored = loadState();
    if (restored) {
      setPhase(restored.phase);
      setMood(restored.mood);
      setMessages(restored.messages);
      setTopicId(restored.topicId);
      setWalkStep(restored.walkStep);
      // If we were mid-walkthrough, auto-open the chat on the new page.
      if (restored.phase === "walkthrough") setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    // Only persist once the user is actually engaged — avoid writing an empty default
    // and masking freshly-restored state in other tabs.
    if (phase === "ask_mood" && messages.length === 0) return;
    saveState({ phase, mood, messages, topicId, walkStep });
  }, [phase, mood, messages, topicId, walkStep]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, walkStep]);

  useEffect(() => {
    if (isOpen && phase === "ask_note" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, phase]);

  // --- Helpers -------------------------------------------------------------
  const pushBot = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "bot", content }]);
  }, []);

  const pushUser = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
  }, []);

  const storeMood = useCallback(
    async (selectedMood: Mood): Promise<boolean> => {
      // Waits for the PUT to complete — the old fire-and-forget version lost writes
      // when the user closed the chat or navigated before the request flushed.
      try {
        const res = await fetch("/api/users/mood", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood: selectedMood }),
        });
        return res.ok;
      } catch (e) {
        console.error("Error storing mood:", e);
        return false;
      }
    },
    [],
  );

  const patchMood = useCallback(
    async (patch: { note?: string; helpTopic?: string }) => {
      try {
        await fetch("/api/users/mood", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } catch (e) {
        console.error("Error patching mood:", e);
      }
    },
    [],
  );

  const sendSadMoodAlert = useCallback(async () => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [
            "marcelagonzalez@merquellantas.com",
            "saludocupacional@merquellantas.com",
            "dptodelagente@merquellantas.com",
          ],
          subject: "Alerta de bienestar - usuario triste",
          html: `
            <h2>Alerta de bienestar</h2>
            <p><strong>Usuario:</strong> ${userName}</p>
            <p><strong>Estado de ánimo:</strong> Triste</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-CO")}</p>
            <p>Sistema de Bienestar — Merquellantas</p>
          `,
        }),
      });
    } catch (e) {
      console.error("Error sending email alert", e);
    }
  }, [userName]);

  // --- Flow actions --------------------------------------------------------
  const handlePickMood = async (selectedMood: Mood) => {
    if (saving) return;
    // Guard against very early clicks where the session hasn't hydrated yet.
    if (sessionStatus !== "authenticated" || !session?.user?.id) {
      pushBot("Un segundo, estamos preparando tu sesión...");
      return;
    }

    setSaving(true);
    setMood(selectedMood);

    pushUser(`Me siento ${selectedMood} ${selectedMood === "feliz" ? "😊" : selectedMood === "neutral" ? "😐" : "😢"}`);

    const ok = await storeMood(selectedMood);
    if (!ok) {
      pushBot("No pude registrar tu estado de ánimo. Intenta de nuevo en un momento.");
      setSaving(false);
      // Roll back so the user can retry.
      setMood(null);
      return;
    }

    if (selectedMood === "triste") {
      // Fire-and-forget — don't block the UX waiting for the email server.
      sendSadMoodAlert();
    }

    setPhase("ask_note");
    setTimeout(() => {
      pushBot(
        "Gracias por contarnos 💛. ¿Hay algo que te gustaría compartir con nosotros? Puedes escribirlo abajo o saltar este paso.",
      );
    }, 200);
    setSaving(false);
  };

  const handleSubmitNote = async () => {
    const text = input.trim();
    if (saving) return;
    setSaving(true);

    if (text) {
      pushUser(text);
      await patchMood({ note: text });
      setInput("");
    } else {
      pushUser("(Prefiero no compartir nada ahora)");
    }

    setPhase("ask_topic");
    setTimeout(() => {
      pushBot("¿Con qué te puedo ayudar hoy? Elige una opción o cierra el chat si no necesitas nada más.");
    }, 200);
    setSaving(false);
  };

  const handlePickTopic = async (topic: HelpTopic) => {
    setTopicId(topic.id);
    pushUser(topic.label);
    await patchMood({ helpTopic: topic.id });
    setPhase("ask_help_type");
    setTimeout(() => {
      pushBot(
        `Perfecto. ¿Prefieres que te lleve directo o que te explique cómo usar "${topic.label}"?`,
      );
    }, 200);
  };

  const handleHelpType = (type: "go" | "explain") => {
    const topic = topicId ? TOPIC_BY_ID[topicId] : null;
    if (!topic) {
      setPhase("done");
      return;
    }

    if (type === "go") {
      pushUser("Necesito ayuda yendo");
      pushBot(`Te llevo a ${topic.label.toLowerCase()}. ¡Éxitos!`);
      setPhase("done");
      // Persist "done" so the chat doesn't re-open on the destination page.
      saveState({ phase: "done", mood, messages, topicId, walkStep: 0 });
      setTimeout(() => {
        setIsOpen(false);
        router.push(topic.href);
      }, 400);
      return;
    }

    // Explain mode: navigate but keep the chat open and walk through.
    pushUser("Necesito ayuda entendiendo cómo usarlo");
    setWalkStep(0);
    setPhase("walkthrough");
    const firstStep = topic.walkthrough[0] ?? "Te llevo a la página.";
    pushBot(`Te llevo a "${topic.label}" y te guío paso a paso.`);
    setTimeout(() => pushBot(`Paso 1. ${firstStep}`), 200);

    // Persist and then navigate. The layout-level mount keeps the chat alive.
    saveState({
      phase: "walkthrough",
      mood,
      messages: [
        ...messages,
        { role: "user", content: "Necesito ayuda entendiendo cómo usarlo" },
        { role: "bot", content: `Te llevo a "${topic.label}" y te guío paso a paso.` },
        { role: "bot", content: `Paso 1. ${firstStep}` },
      ],
      topicId: topic.id,
      walkStep: 0,
    });
    setTimeout(() => router.push(topic.href), 300);
  };

  const handleNextStep = () => {
    if (!topicId) return;
    const topic = TOPIC_BY_ID[topicId];
    if (!topic) return;
    const next = walkStep + 1;
    if (next >= topic.walkthrough.length) {
      pushBot("¡Eso es todo! Si necesitas algo más, puedes reiniciar la conversación. 👏");
      setPhase("done");
      return;
    }
    setWalkStep(next);
    pushBot(`Paso ${next + 1}. ${topic.walkthrough[next]}`);
  };

  const restart = () => {
    setMessages([]);
    setMood(null);
    setTopicId(null);
    setWalkStep(0);
    setPhase("ask_mood");
    setInput("");
    clearState();
  };

  const goToPqrsf = () => {
    clearState();
    setIsOpen(false);
    router.push("/dashboard/pqrsf");
  };

  // Hide widget entirely when not authenticated — we have no user context to talk to.
  if (sessionStatus !== "authenticated" || !session?.user) return null;

  const topic = topicId ? TOPIC_BY_ID[topicId] : null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-[#f4a900] text-black shadow-2xl ring-2 ring-black hover:bg-[#f4a900] active:scale-95 transition-all"
        aria-label="Abrir chat de bienestar"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[22rem] sm:w-96 h-[34rem] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="relative p-4 bg-black text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage: "radial-gradient(circle at 90% 30%, #f4a900 0, transparent 50%)",
              }}
            />
            <div className="relative flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg">Chat Bienestar</h3>
                <p className="text-xs text-white/70">Estamos aquí para ti</p>
              </div>
              <div className="flex items-center gap-2">
                {phase !== "ask_mood" && (
                  <button
                    onClick={restart}
                    className="text-white/60 hover:text-white p-1"
                    title="Reiniciar conversación"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white"
                  aria-label="Cerrar chat"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          {phase === "ask_mood" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <p className="text-center mb-6 text-gray-700 font-medium">
                Hola {userName ? userName.split(" ")[0] : "Usuario"}, ¿cómo te sientes hoy?
              </p>
              <div className="flex justify-center gap-6">
                {[
                  { mood: "feliz" as Mood, emoji: "😊", label: "Feliz" },
                  { mood: "neutral" as Mood, emoji: "😐", label: "Neutral" },
                  { mood: "triste" as Mood, emoji: "😢", label: "Triste" },
                ].map((m) => (
                  <button
                    key={m.mood}
                    onClick={() => handlePickMood(m.mood)}
                    disabled={saving}
                    className="flex flex-col items-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <div className="text-5xl mb-2">{m.emoji}</div>
                    <span className="text-sm text-gray-600 font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
              {saving && (
                <p className="text-xs text-gray-400 mt-4">Guardando...</p>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#f4a900] text-black rounded-br-none font-medium"
                          : "bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Topic bubbles */}
                {phase === "ask_topic" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {HELP_TOPICS.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handlePickTopic(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#f4a900] text-[#b47e00] text-xs font-semibold hover:bg-[#f4a900] hover:text-black active:scale-95 transition-all"
                        >
                          <Icon size={14} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Help type bubbles */}
                {phase === "ask_help_type" && topic && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => handleHelpType("go")}
                      className="inline-flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow"
                    >
                      Necesito ayuda yendo
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => handleHelpType("explain")}
                      className="inline-flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      Necesito ayuda entendiendo cómo usarlo
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* Walkthrough controls */}
                {phase === "walkthrough" && topic && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={handleNextStep}
                      className="inline-flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow"
                    >
                      {walkStep + 1 >= topic.walkthrough.length ? "Terminar guía" : "Siguiente paso"}
                      <ChevronRight size={16} />
                    </button>
                    <div className="text-[11px] text-gray-400 text-center">
                      Paso {Math.min(walkStep + 1, topic.walkthrough.length)} de {topic.walkthrough.length}
                    </div>
                  </div>
                )}

                {/* Done footer */}
                {phase === "done" && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 rounded-2xl bg-black text-white relative overflow-hidden">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 100% 0%, #f4a900 0, transparent 50%)",
                        }}
                      />
                      <div className="relative">
                        <p className="text-sm font-bold mb-1">¿Tienes quejas o ideas?</p>
                        <p className="text-xs text-white/70 mb-3">
                          Cuéntanos en el buzón de PQRSF; lo leeremos con atención.
                        </p>
                        <button
                          onClick={goToPqrsf}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f4a900] text-black text-sm font-bold hover:bg-[#f4a900] active:scale-95 transition-all"
                        >
                          <MessageSquare size={16} /> Ir a PQRSF
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={restart}
                      className="w-full text-xs text-gray-500 hover:text-[#f4a900] underline"
                    >
                      Iniciar otra conversación
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Note input (only during the "ask_note" phase) */}
              {phase === "ask_note" && (
                <div className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex items-center">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitNote();
                        }
                      }}
                      placeholder="Escribe lo que quieras compartir..."
                      className="text-black flex-1 px-4 py-2 bg-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#f4a900] resize-none max-h-24 text-sm placeholder:text-gray-400"
                      rows={2}
                      maxLength={maxChars}
                      disabled={saving}
                    />
                    <button
                      onClick={handleSubmitNote}
                      disabled={saving}
                      className={`ml-2 p-2 rounded-full ${
                        saving
                          ? "bg-gray-200 text-gray-400"
                          : input.trim()
                          ? "bg-[#f4a900] text-black hover:opacity-90"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      } transition-colors`}
                      aria-label={input.trim() ? "Enviar" : "Saltar"}
                      title={input.trim() ? "Enviar" : "Saltar este paso"}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setInput("");
                        handleSubmitNote();
                      }}
                      className="text-[11px] text-gray-500 hover:text-[#f4a900]"
                    >
                      Saltar este paso
                    </button>
                    <div className="text-[10px] text-gray-400">
                      {input.length}/{maxChars}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
