'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Loader2,
  Download,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Plus,
  Settings2,
  Link2,
  Link2Off,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react';

interface TemplateField {
  key: string;
  label: string;
}

interface Column {
  key: string;
  name: string;
  templateField: string | null;
  order: number;
}

interface CertRecord {
  id: string;
  year: number;
  cedula: string;
  user_id: string | null;
  user: { id: string; nombre: string; email: string; cedula: string } | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const BRAND = '#f4a900';
const CURRENT_YEAR = new Date().getFullYear();
// Certificates cover the previous calendar year (e.g. in 2026 we distribute 2025 certificates).
const DEFAULT_YEAR = CURRENT_YEAR - 1;

/**
 * Admin-only section that manages Certificado de Ingresos y Retenciones uploads.
 * Workflow: admin uploads the EXOGENA xlsx → columns are detected and can be renamed /
 * mapped to DIAN template fields → per-user records become downloadable.
 */
export default function CertificadoAdmin() {
  const [year, setYear] = useState<number>(DEFAULT_YEAR);
  const [columns, setColumns] = useState<Column[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [records, setRecords] = useState<CertRecord[]>([]);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    imported: number;
    skipped: number;
    linked_users: number;
    total_rows: number;
    header_row: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column editor
  const [showColumns, setShowColumns] = useState(false);

  // Record editor
  const [editing, setEditing] = useState<CertRecord | null>(null);

  async function loadAll(nextYear = year) {
    setLoading(true);
    try {
      const [cfgRes, recRes] = await Promise.all([
        fetch(`/api/certificados/config?year=${nextYear}`),
        fetch(`/api/certificados?year=${nextYear}`),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setColumns((cfg.columns as Column[]) || []);
        setTemplateFields((cfg.templateFields as TemplateField[]) || []);
        setConfigUpdatedAt(cfg.updated_at || null);
      }
      if (recRes.ok) {
        const rec = await recRes.json();
        setRecords((rec.records as CertRecord[]) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      `${r.cedula} ${r.user?.nombre || ''} ${r.user?.email || ''}`.toLowerCase().includes(q)
    );
  }, [records, search]);

  const linkedCount = records.filter((r) => r.user_id).length;
  const unlinkedCount = records.length - linkedCount;

  // Deadline banner: certificates for year Y are due by March 30 of year Y+2.
  const deadline = new Date(year + 2, 2, 30);
  const today = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  const isOverdue = daysLeft < 0;

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('year', String(year));
      const res = await fetch('/api/certificados/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al procesar el archivo');
        return;
      }
      setUploadResult({
        imported: data.imported,
        skipped: data.skipped,
        linked_users: data.linked_users,
        total_rows: data.total_rows,
        header_row: data.header_row,
      });
      await loadAll(year);
    } catch (err) {
      console.error(err);
      alert('Error al procesar el archivo');
    } finally {
      setUploading(false);
    }
  }

  function closeUpload() {
    setShowUpload(false);
    setUploadFile(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function saveColumns(next: Column[]) {
    const res = await fetch('/api/certificados/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, columns: next.map((c, i) => ({ ...c, order: i })) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Error al guardar columnas');
      return;
    }
    await loadAll(year);
  }

  async function deleteRecord(rec: CertRecord) {
    if (!confirm(`¿Eliminar el certificado de ${rec.user?.nombre || rec.cedula}?`)) return;
    const res = await fetch(`/api/certificados/${rec.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('No se pudo eliminar');
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== rec.id));
  }

  function downloadFor(cedula: string) {
    // Hit the download endpoint directly; the browser handles the file save.
    window.location.href = `/api/certificados/download?year=${year}&cedula=${encodeURIComponent(cedula)}`;
  }

  return (
    <div className="mt-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Hero header */}
        <div className="relative p-5 sm:p-6 bg-black text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ backgroundImage: `radial-gradient(circle at 90% 30%, ${BRAND} 0, transparent 50%)` }}
          />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold">Certificado de Ingresos y Retenciones</h2>
                <p className="text-xs text-white/60">
                  {records.length} {records.length === 1 ? 'registro' : 'registros'} · {linkedCount} vinculados
                  {unlinkedCount > 0 && <> · <span className="text-amber-300">{unlinkedCount} sin usuario</span></>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2.5 text-sm font-semibold"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = CURRENT_YEAR - 1 - i;
                  return (
                    <option key={y} value={y} className="text-black">
                      Año gravable {y}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => setShowColumns(true)}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 active:scale-95 transition-all border border-white/20"
              >
                <Settings2 className="h-4 w-4" /> Columnas
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[#f4a900]/20"
              >
                <Upload className="h-4 w-4" /> Cargar Excel
              </button>
            </div>
          </div>
        </div>

        {/* Deadline banner */}
        <div
          className={`px-5 py-3 text-xs font-semibold border-b ${
            isOverdue
              ? 'bg-red-50 text-red-800 border-red-200'
              : daysLeft <= 30
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            {isOverdue ? (
              <>
                La fecha límite legal fue el 30 de marzo de {year + 2}. Los certificados del año {year} se pueden seguir cargando y editando.
              </>
            ) : (
              <>
                Fecha límite para entregar los certificados del año {year}: <b>30 de marzo de {year + 2}</b>
                {Number.isFinite(daysLeft) && daysLeft >= 0 && ` (quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'})`}
              </>
            )}
          </span>
        </div>

        {/* Search bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cédula, nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f4a900] text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={() => loadAll(year)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            title="Refrescar"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Records table */}
        <div className="overflow-hidden">
          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Empleado</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vínculo</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Campos con datos</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actualizado</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                      {records.length === 0
                        ? 'Aún no hay registros cargados para este año. Usa "Cargar Excel" para importar el archivo EXOGENA.'
                        : 'Sin coincidencias para el filtro.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const populated = Object.values(r.data || {}).filter(
                      (v) => v != null && v !== '' && v !== 0
                    ).length;
                    const totalCols = Object.keys(r.data || {}).length;
                    return (
                      <tr key={r.id} className="hover:bg-[#f4a900]/5 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#f4a900]/10 text-[#f4a900] flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {(r.user?.nombre || r.cedula).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {r.user?.nombre || '(Sin usuario)'}
                              </p>
                              <p className="text-xs text-gray-500">CC {r.cedula}</p>
                              {r.user?.email && (
                                <p className="text-[11px] text-gray-400 truncate">{r.user.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {r.user_id ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                              <Link2 className="h-3 w-3" /> Vinculado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded-full">
                              <Link2Off className="h-3 w-3" /> Sin usuario
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          <span className="font-bold">{populated}</span>
                          <span className="text-gray-400"> / {totalCols}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {r.updated_at ? new Date(r.updated_at).toLocaleString('es-CO') : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => downloadFor(r.cedula)}
                              className="p-2 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                              title="Descargar certificado"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditing(r)}
                              className="p-2 rounded-lg text-gray-500 hover:text-[#f4a900] hover:bg-[#f4a900]/10 transition"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteRecord(r)}
                              className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {configUpdatedAt && (
            <div className="px-5 py-2 text-[11px] text-gray-400 bg-gray-50 border-t border-gray-100">
              Configuración de columnas actualizada el {new Date(configUpdatedAt).toLocaleString('es-CO')}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          year={year}
          onClose={closeUpload}
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          uploading={uploading}
          uploadResult={uploadResult}
          onSubmit={handleUpload}
          fileInputRef={fileInputRef}
        />
      )}

      {showColumns && (
        <ColumnsModal
          columns={columns}
          templateFields={templateFields}
          onClose={() => setShowColumns(false)}
          onSave={async (next) => {
            await saveColumns(next);
            setShowColumns(false);
          }}
        />
      )}

      {editing && (
        <RecordEditor
          record={editing}
          columns={columns}
          templateFields={templateFields}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAll(year);
          }}
        />
      )}
    </div>
  );
}

// --------- Upload modal ---------

function UploadModal(props: {
  year: number;
  onClose: () => void;
  uploadFile: File | null;
  setUploadFile: (f: File | null) => void;
  uploading: boolean;
  uploadResult: {
    imported: number;
    skipped: number;
    linked_users: number;
    total_rows: number;
    header_row: number;
  } | null;
  onSubmit: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { year, onClose, uploadFile, setUploadFile, uploading, uploadResult, onSubmit, fileInputRef } = props;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f4a900]/20 flex items-center justify-center">
              <Upload className="h-4 w-4 text-[#f4a900]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Cargar EXOGENA — año gravable {year}
              </h3>
              <p className="text-xs text-gray-500">.xlsx con el formato 2276 de la DIAN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!uploadResult && (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-xs text-orange-900">
                <p className="font-bold mb-1">Qué se importa:</p>
                <p className="leading-relaxed">
                  Cada fila del archivo se guarda como un certificado individual, usando la columna
                  &quot;Número de Identificación del beneficiario&quot; como cédula. Las filas que coincidan con
                  un usuario ya registrado se enlazan automáticamente.
                </p>
                <p className="mt-2 text-orange-800">
                  Después podrás renombrar columnas, asignarlas a los campos del formato 220 del DIAN,
                  o editar los valores por empleado.
                </p>
              </div>

              <label
                htmlFor="cert-file"
                className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#f4a900] hover:bg-orange-50/30 transition"
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                {uploadFile ? (
                  <>
                    <p className="font-semibold text-gray-800 text-sm">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(uploadFile.size / 1024).toFixed(1)} KB · click para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-700 text-sm">Click para seleccionar archivo</p>
                    <p className="text-xs text-gray-500 mt-1">o arrástralo aquí</p>
                  </>
                )}
                <input
                  id="cert-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </>
          )}

          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Importados" value={uploadResult.imported} tone="green" />
                <Stat label="Vinculados a usuario" value={uploadResult.linked_users} tone="blue" />
                <Stat label="Saltados (sin cédula)" value={uploadResult.skipped} tone="amber" />
                <Stat label="Total filas" value={uploadResult.total_rows} tone="gray" />
              </div>
              <p className="text-xs text-gray-500">
                Fila de encabezados detectada: {uploadResult.header_row}.
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Revisa los nombres de las columnas en <b>Columnas</b> y confirma que estén asignadas a
                  los campos correctos del formato 220. Los valores de cada empleado están listos para
                  editarse en la lista.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
          >
            {uploadResult ? 'Cerrar' : 'Cancelar'}
          </button>
          {!uploadResult && (
            <button
              onClick={onSubmit}
              disabled={!uploadFile || uploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Procesando...' : 'Importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --------- Columns modal ---------

function ColumnsModal(props: {
  columns: Column[];
  templateFields: TemplateField[];
  onClose: () => void;
  onSave: (cols: Column[]) => Promise<void>;
}) {
  const { templateFields, onClose, onSave } = props;
  const [localCols, setLocalCols] = useState<Column[]>(props.columns);
  const [saving, setSaving] = useState(false);

  // Template fields already taken by another column (so the dropdown can warn).
  const usedTemplateFields = useMemo(() => {
    const set = new Set<string>();
    for (const c of localCols) if (c.templateField) set.add(c.templateField);
    return set;
  }, [localCols]);

  function update(idx: number, patch: Partial<Column>) {
    setLocalCols((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= localCols.length) return;
    setLocalCols((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    const col = localCols[idx];
    if (!confirm(`¿Eliminar la columna "${col.name}"? Los datos guardados con esta columna no aparecerán en el formulario ni en el certificado.`))
      return;
    setLocalCols((prev) => prev.filter((_, i) => i !== idx));
  }

  function addNew() {
    const key = `col_${Date.now().toString(36)}`;
    setLocalCols((prev) => [
      ...prev,
      { key, name: 'Nueva columna', templateField: null, order: prev.length },
    ]);
  }

  async function commit() {
    setSaving(true);
    try {
      await onSave(localCols);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-black to-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Columnas del archivo</h3>
              <p className="text-xs text-white/60">
                Renombra, reordena, o vincula cada columna al campo correspondiente del formato 220 del DIAN.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3 bg-gray-50">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              El campo del formato 220 vincula cada columna con la celda correcta del certificado que
              descarga el empleado. Si la DIAN cambia los nombres para un nuevo año, renombra aquí sin
              perder los datos ya cargados.
            </span>
          </div>

          {localCols.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-12 bg-white rounded-xl border border-dashed border-gray-200">
              Sin columnas. Carga un archivo EXOGENA o agrega una manualmente.
            </div>
          )}

          {localCols.map((col, i) => (
            <div key={col.key} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-1 text-xs text-gray-400 font-mono">#{i + 1}</div>
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Nombre visible</label>
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:bg-white"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Campo formato 220</label>
                  <select
                    value={col.templateField || ''}
                    onChange={(e) => update(i, { templateField: e.target.value || null })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:bg-white"
                  >
                    <option value="">— No se imprime en el certificado —</option>
                    {templateFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {usedTemplateFields.has(f.key) && f.key !== col.templateField ? ' (en uso)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-1 justify-end">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Subir"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === localCols.length - 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Bajar"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                    title="Eliminar columna"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addNew}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#f4a900] hover:text-[#f4a900]"
          >
            <Plus className="h-4 w-4" /> Agregar columna manual
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100">
            Cancelar
          </button>
          <button
            onClick={commit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// --------- Record editor ---------

function RecordEditor(props: {
  record: CertRecord;
  columns: Column[];
  templateFields: TemplateField[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { record, columns, templateFields, onClose, onSaved } = props;
  const [cedula, setCedula] = useState(record.cedula);
  const [data, setData] = useState<Record<string, unknown>>(record.data || {});
  const [saving, setSaving] = useState(false);

  const templateFieldLabel = useMemo(() => {
    const map = new Map(templateFields.map((f) => [f.key, f.label]));
    return (k: string | null) => (k ? map.get(k) || k : null);
  }, [templateFields]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/certificados/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al guardar');
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-black to-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
              <Edit className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">
                Editar certificado — {record.user?.nombre || record.cedula}
              </h3>
              <p className="text-xs text-white/60">Año gravable {record.year} · CC {record.cedula}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4 bg-gray-50">
          <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Cédula</label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Usuario vinculado</label>
              <div className="px-3 py-2 rounded-lg text-sm text-gray-700 bg-gray-50 border border-gray-200">
                {record.user?.nombre || <span className="text-amber-700">Sin usuario</span>}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {columns.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">
                Sin columnas configuradas para este año.
              </div>
            )}
            {columns.map((c) => {
              const mapped = templateFieldLabel(c.templateField);
              const v = data[c.key];
              const asStr = v == null ? '' : typeof v === 'number' ? String(v) : String(v);
              return (
                <div key={c.key} className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-5">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{c.name}</p>
                    {mapped && (
                      <p className="text-[11px] text-[#b47e00] mt-0.5">→ {mapped}</p>
                    )}
                  </div>
                  <div className="sm:col-span-7">
                    <input
                      type="text"
                      value={asStr}
                      onChange={(e) =>
                        setData((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:bg-white font-mono"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2 bg-white">
          <button
            onClick={() => window.open(`/api/certificados/download?year=${record.year}&cedula=${encodeURIComponent(cedula)}`, '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100"
          >
            <Download className="h-4 w-4" /> Descargar
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-100">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f4a900] text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------- Small UI helpers ---------

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'blue' | 'amber' | 'gray' }) {
  const palette: Record<typeof tone, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  } as const;
  return (
    <div className={`rounded-xl p-3 border ${palette[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  );
}

