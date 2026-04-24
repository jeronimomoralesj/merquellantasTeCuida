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
    <div className="space-y-4">
      {/* Intro card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 30%, #f4a900 0, transparent 45%), radial-gradient(circle at 85% 80%, #f4a900 0, transparent 35%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-[#f4a900]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#f4a900]">Mis metas</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">
              Ahorra con un propósito
            </h2>
            <p className="mt-1 text-sm text-white/70 max-w-md">
              Define un objetivo (viaje, curso, colchón de emergencia...) y mira tu progreso
              en función de tu <span className="font-semibold text-white">Total Aportes</span>
              (permanente + social) con cada quincena que ahorras en Fonalmerque.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f4a900] text-black font-bold text-sm hover:bg-[#f4a900]/90 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva meta
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">Cargando metas...</div>
      ) : goals.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 text-center">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-[#f4a900]" />
          </div>
          <p className="font-bold text-gray-900 mb-1">Aún no tienes metas</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
            Agrega tu primera meta: puede ser ahorrar para unas vacaciones, una deuda
            que quieras pagar o simplemente un fondo de emergencia.
          </p>
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4a900] text-white font-semibold text-sm hover:bg-[#e68a00]"
          >
            <Plus className="w-4 h-4" /> Crear mi primera meta
          </button>
        </div>
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
