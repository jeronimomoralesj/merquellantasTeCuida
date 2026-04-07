"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send, MessageSquare } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../../../firebase";

type Mood = "feliz" | "neutral" | "triste";
type Role = "user" | "bot";

interface ChatMessage {
  role: Role;
  content: string;
}

interface FlowOption {
  label: string;
  next: string; // next node id, or "end"
}

interface FlowNode {
  id: string;
  bot: string; // text the bot says when arriving at this node
  options?: FlowOption[]; // quick replies
}

// ────────────────────────────────────────────────────────────────────
// Conversation flows by mood. Keeping these in code (not Firestore)
// keeps the chat instant and zero-cost.
// ────────────────────────────────────────────────────────────────────
const FLOWS: Record<Mood, Record<string, FlowNode>> = {
  feliz: {
    start: {
      id: "start",
      bot: "¡Qué bueno escucharlo! 😊 ¿Qué te tiene tan bien hoy?",
      options: [
        { label: "Mi equipo de trabajo", next: "equipo" },
        { label: "Mi familia", next: "familia" },
        { label: "Logré una meta", next: "meta" },
        { label: "Otra razón", next: "otra" },
      ],
    },
    equipo: {
      id: "equipo",
      bot: "Trabajar con buenos compañeros hace la diferencia 💪. ¡Sigue contagiando esa energía al equipo Merquellantas!",
      options: [{ label: "Gracias 🙌", next: "end" }],
    },
    familia: {
      id: "familia",
      bot: "La familia es lo más importante ❤️. Disfrútala y aprovecha cada momento.",
      options: [{ label: "Así lo haré", next: "end" }],
    },
    meta: {
      id: "meta",
      bot: "¡Felicidades! Eso merece celebrarse 🎉 Cada logro suma para tu camino.",
      options: [{ label: "Gracias", next: "end" }],
    },
    otra: {
      id: "otra",
      bot: "Cuéntame más en el cuadro de texto, o sigue cuando quieras.",
      options: [{ label: "Continuar", next: "end" }],
    },
  },
  neutral: {
    start: {
      id: "start",
      bot: "Entendido 🙂. ¿Hay algo en lo que te podamos ayudar hoy?",
      options: [
        { label: "Solicitar un permiso", next: "permiso" },
        { label: "Ver mis cesantías", next: "cesantias" },
        { label: "Solo es un día normal", next: "normal" },
      ],
    },
    permiso: {
      id: "permiso",
      bot: "Puedes solicitar tu permiso desde Acciones rápidas → \"Solicitar vacaciones/permisos\".",
      options: [{ label: "Listo", next: "end" }],
    },
    cesantias: {
      id: "cesantias",
      bot: "Encuentra todo lo de cesantías en el menú \"Cesantías\" del dashboard.",
      options: [{ label: "Listo", next: "end" }],
    },
    normal: {
      id: "normal",
      bot: "¡Que tengas un excelente día 👋!",
      options: [{ label: "Gracias", next: "end" }],
    },
  },
  triste: {
    start: {
      id: "start",
      bot: "Lamento que te sientas así 💛. Ya notificamos a Talento Humano para acompañarte. ¿Qué es lo que te tiene así hoy?",
      options: [
        { label: "Tema de trabajo", next: "trabajo" },
        { label: "Tema personal", next: "personal" },
        { label: "Tema de salud", next: "salud" },
        { label: "Prefiero no decir", next: "privado" },
      ],
    },
    trabajo: {
      id: "trabajo",
      bot: "Tu bienestar es prioridad. Un compañero de Talento Humano se comunicará contigo pronto. Si necesitas un permiso, puedes solicitarlo desde el dashboard.",
      options: [{ label: "Gracias", next: "end" }],
    },
    personal: {
      id: "personal",
      bot: "No estás solo. Si lo necesitas, puedes pedir un permiso o hablar con Talento Humano de forma confidencial.",
      options: [{ label: "Gracias", next: "end" }],
    },
    salud: {
      id: "salud",
      bot: "Cuídate. Recuerda que tienes EPS y puedes solicitar una incapacidad si la necesitas.",
      options: [{ label: "Gracias", next: "end" }],
    },
    privado: {
      id: "privado",
      bot: "Está bien, respetamos tu espacio. Estamos aquí cuando lo necesites 💛.",
      options: [{ label: "Gracias", next: "end" }],
    },
  },
};

export default function BienestarChat() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showMoodSelector, setShowMoodSelector] = useState(true);
  const [mood, setMood] = useState<Mood | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>("start");
  const [finished, setFinished] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 240;

  const shouldAskMood = (lastMoodDate: { toDate: () => Date } | null) => {
    if (!lastMoodDate) return true;
    return new Date().toDateString() !== lastMoodDate.toDate().toDateString();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserName("");
        setUserId(null);
        return;
      }
      setUserId(user.uid);
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.nombre || "Usuario");
          if (userData.mood && userData.mood.date && !shouldAskMood(userData.mood.date)) {
            setShowMoodSelector(false);
          }
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
        setUserName("Usuario");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, finished]);

  useEffect(() => {
    if (isOpen && inputRef.current && !showMoodSelector) inputRef.current.focus();
  }, [isOpen, showMoodSelector]);

  const storeMoodInFirebase = async (selectedMood: Mood) => {
    if (!userId) return;
    try {
      await setDoc(
        doc(db, "users", userId),
        { mood: { mood: selectedMood, date: Timestamp.now() } },
        { merge: true }
      );
    } catch (e) {
      console.error("Error storing mood:", e);
    }
  };

  const sendSadMoodAlert = async () => {
    try {
      const formData = new FormData();
      formData.append(
        "email",
        "saludocupacional@merquellantas.com, dptodelagente@merquellantas.com"
      );
      formData.append("subject", "Alert: Bienestar - usuario triste");
      formData.append(
        "message",
        `Usuario: ${userName}\nEstado de ánimo: Triste\nFecha: ${new Date().toLocaleString(
          "es-CO"
        )}\n\nSistema de Bienestar - Merquellantas`
      );
      await fetch("https://formsubmit.co/ajax/marcelagonzalez@merquellantas.com", {
        method: "POST",
        body: formData,
      });
    } catch (e) {
      console.error("Error sending email alert:", e);
    }
  };

  const startFlow = async (selectedMood: Mood) => {
    setMood(selectedMood);
    setShowMoodSelector(false);
    setFinished(false);
    setCurrentNodeId("start");
    await storeMoodInFirebase(selectedMood);
    if (selectedMood === "triste") await sendSadMoodAlert();

    const startNode = FLOWS[selectedMood].start;
    setMessages([
      { role: "bot", content: `Hola ${userName || "Usuario"} 👋` },
      { role: "user", content: `Me siento ${selectedMood}` },
      { role: "bot", content: startNode.bot },
    ]);
  };

  const pickOption = (option: FlowOption) => {
    if (!mood) return;
    setMessages((prev) => [...prev, { role: "user", content: option.label }]);
    if (option.next === "end") {
      setFinished(true);
      return;
    }
    const nextNode = FLOWS[mood][option.next];
    if (!nextNode) {
      setFinished(true);
      return;
    }
    setCurrentNodeId(nextNode.id);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "bot", content: nextNode.bot }]);
    }, 250);
  };

  const sendFreeText = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      {
        role: "bot",
        content:
          "Gracias por compartirlo 💛. Lo tenemos en cuenta. Si quieres, sigue con una de las opciones de abajo.",
      },
    ]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFreeText();
    }
  };

  const restart = () => {
    setMessages([]);
    setMood(null);
    setCurrentNodeId("start");
    setFinished(false);
    setShowMoodSelector(true);
  };

  const goToPqrsf = () => {
    setIsOpen(false);
    router.push("/dashboard/pqrsf");
  };

  const currentNode = mood ? FLOWS[mood][currentNodeId] : null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-[#ff9900] text-black shadow-2xl ring-2 ring-black hover:bg-[#ffae33] active:scale-95 transition-all"
        aria-label="Abrir chat de bienestar"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat container */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[22rem] sm:w-96 h-[32rem] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="relative p-4 bg-black text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 90% 30%, #ff9900 0, transparent 50%)",
              }}
            />
            <div className="relative flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg">Chat Bienestar</h3>
                <p className="text-xs text-white/70">Estamos aquí para ti</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white"
                aria-label="Cerrar chat"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Mood selector */}
          {showMoodSelector ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <p className="text-center mb-6 text-gray-700 font-medium">
                Hola {userName || "Usuario"}, ¿cómo te sientes hoy?
              </p>
              <div className="flex justify-center gap-6">
                {(
                  [
                    { mood: "feliz" as Mood, emoji: "😊", label: "Feliz" },
                    { mood: "neutral" as Mood, emoji: "😐", label: "Neutral" },
                    { mood: "triste" as Mood, emoji: "😢", label: "Triste" },
                  ]
                ).map((m) => (
                  <button
                    key={m.mood}
                    onClick={() => startFlow(m.mood)}
                    className="flex flex-col items-center hover:scale-110 active:scale-95 transition-transform"
                  >
                    <div className="text-5xl mb-2">{m.emoji}</div>
                    <span className="text-sm text-gray-600 font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
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
                      className={`inline-block max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-[#ff9900] text-black rounded-br-none font-medium"
                          : "bg-white text-gray-800 rounded-bl-none border border-gray-200 shadow-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Quick replies for current node */}
                {!finished && currentNode?.options && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentNode.options.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => pickOption(opt)}
                        className="px-3 py-1.5 rounded-full bg-white border border-[#ff9900] text-[#ff9900] text-xs font-semibold hover:bg-[#ff9900] hover:text-black active:scale-95 transition-all"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* End-of-flow CTA */}
                {finished && (
                  <div className="mt-4 space-y-3">
                    <div className="p-4 rounded-2xl bg-black text-white relative overflow-hidden">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 100% 0%, #ff9900 0, transparent 50%)",
                        }}
                      />
                      <div className="relative">
                        <p className="text-sm font-bold mb-1">¿Tienes quejas o ideas?</p>
                        <p className="text-xs text-white/70 mb-3">
                          Cuéntanos en nuestro buzón de PQRSF, lo leeremos.
                        </p>
                        <button
                          onClick={goToPqrsf}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ff9900] text-black text-sm font-bold hover:bg-[#ffae33] active:scale-95 transition-all"
                        >
                          <MessageSquare size={16} /> Ir a PQRSF
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={restart}
                      className="w-full text-xs text-gray-500 hover:text-[#ff9900] underline"
                    >
                      Iniciar otra conversación
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Free-text input */}
              {!finished && (
                <div className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex items-center">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, maxChars))}
                      onKeyDown={handleKeyDown}
                      placeholder="Escribe lo que sientes..."
                      className="text-black flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff9900] resize-none max-h-20 text-sm placeholder:text-gray-400"
                      rows={1}
                      maxLength={maxChars}
                    />
                    <button
                      onClick={sendFreeText}
                      disabled={!input.trim()}
                      className={`ml-2 p-2 rounded-full ${
                        !input.trim()
                          ? "bg-gray-200 text-gray-400"
                          : "bg-[#ff9900] text-black hover:bg-[#ffae33]"
                      } transition-colors`}
                      aria-label="Enviar mensaje"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="mt-1 text-right text-[10px] text-gray-400">
                    {input.length}/{maxChars}
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
