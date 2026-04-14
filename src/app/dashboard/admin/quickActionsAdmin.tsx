"use client";

import React, { useEffect, useState } from "react";
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

// Internal routes the admin can pick from a dropdown
const INTERNAL_ROUTES: { value: string; label: string }[] = [
  { value: "/dashboard/solicitud", label: "Solicitar vacaciones / permisos" },
  { value: "/dashboard/cesantias", label: "Cesantías" },
  { value: "/dashboard/calendar", label: "Calendario" },
  { value: "/dashboard/certificado", label: "Certificados" },
  { value: "/dashboard/documents", label: "Documentos" },
  { value: "/dashboard/pqrsf", label: "PQRSF" },
  { value: "/dashboard/upload", label: "Cargar archivos" },
];

// Defaults to seed the collection on first run
const DEFAULT_ACTIONS: Omit<QuickAction, "id">[] = [
  { title: "Solicitar vacaciones/permisos", href: "/dashboard/solicitud", icon: "calendar", order: 0, active: true },
  { title: "Ir a Heinsohn nómina", href: "https://portal.heinsohn.com.co/", icon: "dollar", order: 1, active: true },
  { title: "Seguridad social", href: "https://www.aportesenlinea.com/Autoservicio/CertificadoAportes.aspx", icon: "shield", order: 2, active: true },
  { title: "Gente útil", href: "https://genteutil.net/", icon: "person", order: 3, active: true },
  { title: "Temporales 1A", href: "https://temporalesunoa.com.co/", icon: "person", order: 4, active: true },
];

export default function QuickActionsAdmin() {
  const [items, setItems] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<QuickAction>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [linkType, setLinkType] = useState<"internal" | "external">("external");
  const [seeding, setSeeding] = useState(false);

  const seedDefaults = async () => {
    if (!confirm("¿Crear las acciones rápidas por defecto?")) return;
    setSeeding(true);
    try {
      for (const a of DEFAULT_ACTIONS) {
        await fetch('/api/quick-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a),
        });
      }
      await load();
    } catch (e) {
      console.error(e);
      alert("Error creando las acciones por defecto.");
    } finally {
      setSeeding(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quick-actions');
      if (!res.ok) throw new Error('Error loading quick actions');
      const raw: Record<string, unknown>[] = await res.json();
      const data: QuickAction[] = raw.map(d => ({
        id: String(d._id || d.id || ''),
        title: String(d.title || ''),
        href: String(d.href || ''),
        icon: String(d.icon || 'zap'),
        order: Number(d.order || 0),
        active: !!d.active,
      }));
      setItems(data);
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
    setLinkType("external");
    setCreating(true);
    setEditingId(null);
  };

  const startEdit = (item: QuickAction) => {
    setForm(item);
    setLinkType(item.href.startsWith("http") ? "external" : "internal");
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
        await fetch('/api/quick-actions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await fetch('/api/quick-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
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
      await fetch('/api/quick-actions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
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
          <Zap className="h-5 w-5 mr-2 text-[#f4a900]" />
          Acciones Rápidas
        </h2>
        {!creating && !editingId && (
          <div className="flex gap-2">
            {items.length === 0 && !loading && (
              <button
                onClick={seedDefaults}
                disabled={seeding}
                className="inline-flex items-center px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {seeding ? "Creando..." : "Crear acciones por defecto"}
              </button>
            )}
            <button
              onClick={startCreate}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-[#f4a900] text-black text-sm font-semibold hover:bg-[#f4a900] transition"
            >
              <Plus className="h-4 w-4 mr-1" /> Nueva acción
            </button>
          </div>
        )}
      </div>

      {(creating || editingId) && (
        <div className="mb-5 p-4 rounded-xl border border-[#f4a900]/30 bg-[#f4a900]/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej. Solicitar vacaciones"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-black placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de enlace</label>
              <div className="flex gap-4 py-2">
                <label className="flex items-center gap-2 text-sm text-black cursor-pointer">
                  <input
                    type="radio"
                    name="linkType"
                    checked={linkType === "internal"}
                    onChange={() => {
                      setLinkType("internal");
                      setForm({ ...form, href: INTERNAL_ROUTES[0].value });
                    }}
                    className="accent-[#f4a900]"
                  />
                  Página interna
                </label>
                <label className="flex items-center gap-2 text-sm text-black cursor-pointer">
                  <input
                    type="radio"
                    name="linkType"
                    checked={linkType === "external"}
                    onChange={() => {
                      setLinkType("external");
                      setForm({ ...form, href: "" });
                    }}
                    className="accent-[#f4a900]"
                  />
                  URL externa
                </label>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {linkType === "internal" ? "Página del sitio" : "URL externa"}
              </label>
              {linkType === "internal" ? (
                <select
                  value={form.href}
                  onChange={(e) => setForm({ ...form, href: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-black"
                >
                  {INTERNAL_ROUTES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} ({r.value})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="url"
                  value={form.href}
                  onChange={(e) => setForm({ ...form, href: e.target.value })}
                  placeholder="https://ejemplo.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-black placeholder:text-gray-400"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ícono</label>
              <select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-black"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-black"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-[#f4a900]"
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
                <div className="w-10 h-10 rounded-lg bg-[#f4a900]/10 flex items-center justify-center text-[#f4a900]">
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
