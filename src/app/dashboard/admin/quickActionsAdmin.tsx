"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../../firebase";
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { ICON_OPTIONS, getIcon } from "./quickActionIcons";

export interface QuickAction {
  id?: string;
  title: string;
  href: string;
  icon: string;
  order: number;
  active: boolean;
}

const emptyForm: QuickAction = {
  title: "",
  href: "",
  icon: "calendar",
  order: 0,
  active: true,
};

export default function QuickActionsAdmin() {
  const [items, setItems] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<QuickAction>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "quickActions"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuickAction, "id">) }))
      );
    } catch (e) {
      console.error("Error loading quickActions", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setForm({ ...emptyForm, order: items.length });
    setCreating(true);
    setEditingId(null);
  };

  const startEdit = (item: QuickAction) => {
    setForm(item);
    setEditingId(item.id || null);
    setCreating(false);
  };

  const cancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCreating(false);
  };

  const save = async () => {
    if (!form.title.trim() || !form.href.trim()) {
      alert("Título y enlace son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        href: form.href.trim(),
        icon: form.icon,
        order: Number(form.order) || 0,
        active: !!form.active,
      };
      if (editingId) {
        await updateDoc(doc(db, "quickActions", editingId), payload);
      } else {
        await addDoc(collection(db, "quickActions"), payload);
      }
      cancel();
      await load();
    } catch (e) {
      console.error(e);
      alert("Error guardando la acción");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!confirm("¿Eliminar esta acción rápida?")) return;
    try {
      await deleteDoc(doc(db, "quickActions", id));
      await load();
    } catch (e) {
      console.error(e);
      alert("Error eliminando");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mt-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Zap className="h-5 w-5 mr-2 text-[#ff9900]" />
          Acciones Rápidas
        </h2>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-[#ff9900] text-black text-sm font-semibold hover:bg-[#ffae33] transition"
          >
            <Plus className="h-4 w-4 mr-1" /> Nueva acción
          </button>
        )}
      </div>

      {(creating || editingId) && (
        <div className="mb-5 p-4 rounded-xl border border-[#ff9900]/30 bg-[#ff9900]/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. Solicitar vacaciones"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Enlace (URL o ruta)</label>
              <input
                type="text"
                value={form.href}
                onChange={(e) => setForm({ ...form, href: e.target.value })}
                placeholder="/dashboard/solicitud o https://..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ícono</label>
              <select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Orden</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-[#ff9900]"
                />
                Activa (visible en el dashboard)
              </label>
              <div className="flex-1" />
              <button
                onClick={cancel}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
              >
                <X className="h-4 w-4 mr-1" /> Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay acciones rápidas configuradas. Crea una con el botón de arriba.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => {
            const Icon = getIcon(item.icon);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#ff9900]/10 flex items-center justify-center text-[#ff9900]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.title}
                    </p>
                    {!item.active && (
                      <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Oculta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{item.href}</p>
                </div>
                <span className="text-xs text-gray-400 mr-2">#{item.order}</span>
                <button
                  onClick={() => startEdit(item)}
                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
