'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, PencilLine, X, Send, Loader2 } from 'lucide-react';

interface EventWallProps {
  eventId: string;
  eventTitle: string;
  /** True when the signed-in user is the celebrant of this event (so they can't react). */
  isOwnEvent: boolean;
  /** Compact variant drops borders/padding so we can embed below the event card. */
  compact?: boolean;
}

interface NoteRow {
  id: string;
  user_id: string;
  nombre: string;
  note: string;
  mine: boolean;
  created_at: string;
}

interface HeartRow {
  id: string;
  user_id: string;
  nombre: string;
  mine: boolean;
}

const MAX_NOTE_LEN = 160;
// Keep the visual wall bounded — past this, the rest collapse into a "+N más" chip
// so the layout stays readable even on very popular birthdays.
const MAX_STICKIES_VISIBLE = 6;

const STICKY_PALETTES = [
  { bg: 'bg-yellow-100', border: 'border-yellow-200', rotate: '-rotate-2' },
  { bg: 'bg-pink-100', border: 'border-pink-200', rotate: 'rotate-1' },
  { bg: 'bg-blue-100', border: 'border-blue-200', rotate: '-rotate-1' },
  { bg: 'bg-emerald-100', border: 'border-emerald-200', rotate: 'rotate-2' },
  { bg: 'bg-purple-100', border: 'border-purple-200', rotate: '-rotate-2' },
  { bg: 'bg-orange-100', border: 'border-orange-200', rotate: 'rotate-1' },
];

/**
 * Sticky-notes wall + heart reactions for a calendar event (birthday or otherwise).
 *
 * Visual: compact Polaroid-style grid of sticky notes, each rotated at a small angle
 * so they look scattered on a corkboard. Heart reactions render as a Facebook-style
 * count at the bottom with the commenters' names on hover.
 */
export default function EventWall({ eventId, eventTitle, isOwnEvent, compact }: EventWallProps) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [hearts, setHearts] = useState<HeartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingHeart, setTogglingHeart] = useState(false);

  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/reactions?event_id=${encodeURIComponent(eventId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotes((data.notes as NoteRow[]) ?? []);
      setHearts((data.hearts as HeartRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    fetchReactions();
  }, [fetchReactions]);

  const myNote = useMemo(() => notes.find((n) => n.mine) ?? null, [notes]);
  const iHearted = useMemo(() => hearts.some((h) => h.mine), [hearts]);

  const submitNote = async () => {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/calendar/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, type: 'note', note: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'No se pudo guardar la nota');
        return;
      }
      setDraft('');
      setNoteOpen(false);
      await fetchReactions();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMyNote = async () => {
    if (!myNote) return;
    setSubmitting(true);
    try {
      await fetch(`/api/calendar/reactions?event_id=${encodeURIComponent(eventId)}&type=note`, {
        method: 'DELETE',
      });
      await fetchReactions();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHeart = async () => {
    if (togglingHeart) return;
    setTogglingHeart(true);
    try {
      if (iHearted) {
        await fetch(`/api/calendar/reactions?event_id=${encodeURIComponent(eventId)}&type=heart`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/calendar/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, type: 'heart' }),
        });
      }
      await fetchReactions();
    } finally {
      setTogglingHeart(false);
    }
  };

  const visibleNotes = notes.slice(0, MAX_STICKIES_VISIBLE);
  const hiddenCount = Math.max(0, notes.length - visibleNotes.length);

  return (
    <div className={compact ? '' : 'bg-white rounded-2xl border border-gray-100 p-5'}>
      {/* Sticky wall */}
      {notes.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-3">
            Mensajes del equipo
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleNotes.map((n, i) => {
              const palette = STICKY_PALETTES[i % STICKY_PALETTES.length];
              return (
                <div
                  key={n.id}
                  className={`relative ${palette.bg} ${palette.border} border rounded-lg p-3 shadow-sm transform ${palette.rotate} hover:rotate-0 hover:scale-105 transition-transform`}
                >
                  <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-snug">
                    &ldquo;{n.note}&rdquo;
                  </p>
                  <p className="mt-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider truncate">
                    — {n.nombre.split(' ').slice(0, 2).join(' ')}
                  </p>
                  {n.mine && (
                    <button
                      onClick={deleteMyNote}
                      disabled={submitting}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center shadow-sm"
                      title="Quitar mi nota"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 flex items-center justify-center text-sm text-gray-500">
                +{hiddenCount} {hiddenCount === 1 ? 'mensaje' : 'mensajes'} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reaction bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Hearts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleHeart}
            disabled={isOwnEvent || togglingHeart || loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              iHearted
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
            } ${isOwnEvent ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={
              isOwnEvent
                ? 'No puedes reaccionar a tu propio evento'
                : iHearted
                ? 'Quitar corazón'
                : 'Enviar un corazón'
            }
          >
            {togglingHeart ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${iHearted ? 'fill-current' : ''}`} />
            )}
            {hearts.length > 0 && <span>{hearts.length}</span>}
          </button>

          {hearts.length > 0 && (
            <span
              className="text-xs text-gray-500 truncate max-w-[200px]"
              title={hearts.map((h) => h.nombre).join(', ')}
            >
              {hearts
                .slice(0, 3)
                .map((h) => h.nombre.split(' ')[0])
                .join(', ')}
              {hearts.length > 3 && ` y ${hearts.length - 3} más`}
            </span>
          )}
        </div>

        {/* Add note button */}
        {!isOwnEvent && !myNote && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#f4a900]/10 text-[#b47e00] border border-[#f4a900]/30 hover:bg-[#f4a900]/20 active:scale-95 transition-all"
          >
            <PencilLine className="h-4 w-4" />
            Agregar nota
          </button>
        )}
        {!isOwnEvent && myNote && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Tu mensaje está publicado 💌
          </span>
        )}
        {isOwnEvent && (
          <span className="text-xs text-gray-500 italic">
            Los mensajes son para ti — tú no puedes agregar ni reaccionar.
          </span>
        )}
      </div>

      {/* Inline note composer */}
      {noteOpen && (
        <div className="mt-4 border border-gray-200 rounded-xl p-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Escribe un mensaje para <span className="text-[#b47e00]">{eventTitle}</span>
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTE_LEN))}
            rows={2}
            placeholder="Un saludo, una felicitación, una anécdota..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="text-[10px] text-gray-400">
              {draft.length}/{MAX_NOTE_LEN} caracteres
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  setNoteOpen(false);
                }}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitNote}
                disabled={submitting || !draft.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f4a900] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
