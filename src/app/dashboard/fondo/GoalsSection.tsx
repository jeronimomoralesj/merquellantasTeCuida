"use client";

/**
 * Personal savings goals for the /dashboard/fondo user view. Members set a
 * title, target amount, target date and accent color. Progress is measured
 * against their current total savings (saldo_permanente + saldo_social)
 * passed in as `currentSavings`, so the component stays presentational —
 * the actual balance lives on the parent.
 */

import React, { useEffect, useState } from "react";
import { Plus, Target, Trash2, Edit2, Check, X, Sparkles, CalendarDays } from "lucide-react";

export interface Goal {
  _id: string;
  user_id: string;
  title: string;
  target_amount: number;
  target_date: string; // ISO
  color: string;
  created_at: string;
  updated_at?: string;
}

const PALETTE = [
  "#f4a900", // fondo yellow
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ef4444", // red
  "#14b8a6", // teal
  "#475569", // slate
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n || 0);

function daysBetween(iso: string): number {
  const target = new Date(iso);
  if (isNaN(target.getTime())) return 0;
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export default function GoalsSection({ currentSavings }: { currentSavings: number }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fondo/goals");
      if (!res.ok) throw new Error("Error al cargar metas");
      const data = await res.json();
      setGoals(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta meta?")) return;
    try {
      const res = await fetch(`/api/fondo/goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact header row — previous version was a full black hero
          with copy the user had already read once. This collapses the
          intro into a single title + "Nueva meta" button. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-[#f4a900]" />
          Mis metas
          {goals.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({goals.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f4a900] text-black text-xs font-bold hover:bg-[#e68a00] transition"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva meta
        </button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-500">Cargando metas...</div>
      ) : goals.length === 0 ? (
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-[#f4a900] hover:text-[#f4a900] transition flex flex-col items-center justify-center gap-1.5 text-xs"
        >
          <Sparkles className="w-5 h-5 text-[#f4a900]" />
          <span className="font-semibold">Define tu primera meta</span>
          <span className="text-[11px] text-gray-400">Progreso según tu Total Aportes</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard
              key={g._id}
              goal={g}
              currentSavings={currentSavings}
              onEdit={() => { setEditing(g); setShowForm(true); }}
              onDelete={() => handleDelete(g._id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <GoalForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  currentSavings,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currentSavings: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = goal.target_amount > 0
    ? Math.min(100, Math.max(0, (currentSavings / goal.target_amount) * 100))
    : 0;
  const reached = currentSavings >= goal.target_amount;
  const days = daysBetween(goal.target_date);
  const overdue = days < 0 && !reached;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition"
      style={{ borderColor: goal.color + "55" }}
    >
      {/* Accent strip */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: goal.color }}
      />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: goal.color + "20", color: goal.color }}
          >
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{goal.title}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {fmtDate(goal.target_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Editar"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-lg font-extrabold text-gray-900">{fmt(Math.min(currentSavings, goal.target_amount))}</span>
          <span className="text-xs text-gray-500">/ {fmt(goal.target_amount)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: goal.color,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px]">
          <span className="font-semibold" style={{ color: goal.color }}>{pct.toFixed(0)}% completado</span>
          {reached ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <Sparkles className="w-3 h-3" /> ¡Meta alcanzada!
            </span>
          ) : overdue ? (
            <span className="font-semibold text-red-600">{Math.abs(days)} días vencida</span>
          ) : (
            <span className="text-gray-500">
              {days === 0 ? "Vence hoy" : days === 1 ? "1 día restante" : `${days} días restantes`}
            </span>
          )}
        </div>
      </div>

      {!reached && (
        <p className="text-xs text-gray-600">
          Te faltan <span className="font-semibold text-gray-900">{fmt(Math.max(0, goal.target_amount - currentSavings))}</span> para lograrlo.
        </p>
      )}
    </div>
  );
}

function GoalForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Goal | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial?.target_amount ? String(initial.target_amount) : "");
  const [date, setDate] = useState(
    initial?.target_date
      ? (() => {
          const d = new Date(initial.target_date);
          return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
        })()
      : "",
  );
  const [color, setColor] = useState(initial?.color || PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (!title.trim()) return setErr("Escribe un título");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setErr("Monto inválido");
    if (!date) return setErr("Elige una fecha objetivo");
    setSaving(true);
    try {
      const url = initial ? `/api/fondo/goals/${initial._id}` : "/api/fondo/goals";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), target_amount: amt, target_date: date, color }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error al guardar");
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color }} />
            {initial ? "Editar meta" : "Nueva meta"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Viaje a Santa Marta"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Monto objetivo (COP)</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 3000000"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Fecha objetivo</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${color === c ? "ring-2 ring-offset-2 ring-gray-300" : "hover:scale-110"}`}
                  style={{ backgroundColor: c, borderColor: c }}
                  aria-label={`Seleccionar color ${c}`}
                >
                  {color === c && <Check className="w-4 h-4 text-white mx-auto" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>
          )}
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium text-sm">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: color }}
          >
            {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear meta"}
          </button>
        </div>
      </div>
    </div>
  );
}
