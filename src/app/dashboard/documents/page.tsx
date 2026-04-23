"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import DashboardNavbar from '../navbar';
import { uploadFileChunked } from '../../../lib/uploadChunked';
import {
  FileText,
  Download,
  Search,
  Filter,
  File,
  FileSpreadsheet,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  X,
  ShieldCheck,
  Folder,
} from 'lucide-react';

type DocKind = 'regular' | 'policy';

interface DocumentItem {
  id: string;
  name: string;
  category: string;
  dateUploaded: string;
  document: string;
  size?: string;
  type?: 'pdf' | 'excel' | 'word' | 'other';
  kind: DocKind;
}

function getFileTypeFromUrl(url: string): 'pdf' | 'excel' | 'word' | 'other' {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'docx':
    case 'doc':
      return 'word';
    default:
      return 'other';
  }
}

function formatDate(ts: string | Date | null | undefined): string {
  if (!ts) return 'N/A';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fileIcon(type: DocumentItem['type']) {
  switch (type) {
    case 'pdf':
      return <FileText className="text-red-500" size={24} />;
    case 'excel':
      return <FileSpreadsheet className="text-green-500" size={24} />;
    case 'word':
      return <File className="text-blue-500" size={24} />;
    default:
      return <File className="text-gray-500" size={24} />;
  }
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadKind, setUploadKind] = useState<DocKind>('regular');
  const [uploading, setUploading] = useState(false);

  // Active tab decides which section renders. Defaults to the regular documents list
  // since it's what most users will reach for on page load.
  const [activeTab, setActiveTab] = useState<DocKind>('regular');

  const userRole = (session?.user as { rol?: string } | undefined)?.rol || 'user';
  const canManage = userRole === 'admin' || userRole === 'fondo';

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documentos');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      const docs: DocumentItem[] = (data.documents ?? data).map((d: Record<string, unknown>) => ({
        id: (d._id ?? d.id) as string,
        name: d.name as string,
        category: d.category as string,
        dateUploaded: (d.date_uploaded || d.dateUploaded) as string,
        document: d.document as string,
        size: (d.size as string) || 'N/A',
        type: getFileTypeFromUrl((d.document as string) || ''),
        // Legacy docs without `kind` default to 'regular' so they stay visible.
        kind: d.kind === 'policy' ? 'policy' : 'regular',
      }));
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(documents.map((d) => d.category).filter(Boolean)))],
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch = !q || doc.name.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchTerm, selectedCategory]);

  const regularDocs = useMemo(
    () => filteredDocuments.filter((d) => d.kind === 'regular'),
    [filteredDocuments],
  );
  const policyDocs = useMemo(
    () => filteredDocuments.filter((d) => d.kind === 'policy'),
    [filteredDocuments],
  );

  const totalRegular = useMemo(() => documents.filter((d) => d.kind === 'regular').length, [documents]);
  const totalPolicy = useMemo(() => documents.filter((d) => d.kind === 'policy').length, [documents]);

  const handleDocumentAction = (doc: DocumentItem, download = false) => {
    if (!doc.document) return;
    const url = download && doc.document.startsWith('/api/upload/')
      ? `${doc.document}?download=1`
      : doc.document;
    window.open(url, '_blank');
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadCategory('');
    setUploadKind('regular');
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName || !uploadCategory) {
      alert('Por favor completa todos los campos');
      return;
    }

    setUploading(true);
    try {
      // Chunked upload so files past Vercel's ~4.5 MB serverless body cap still land.
      const uploadData = await uploadFileChunked(uploadFile, {
        folder: uploadKind === 'policy' ? 'politicas' : 'documentos',
      });
      const downloadURL = uploadData.url || uploadData.webUrl;

      const docRes = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadName,
          category: uploadCategory,
          document: downloadURL,
          size: `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB`,
          kind: uploadKind,
        }),
      });
      if (!docRes.ok) throw new Error('Failed to create document record');

      resetUploadForm();
      setShowUploadModal(false);
      fetchDocuments();
      alert('Documento subido exitosamente');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este documento?')) return;
    try {
      const res = await fetch('/api/documentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      });
      if (!res.ok) throw new Error('Failed to delete document');
      fetchDocuments();
      alert('Documento eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error al eliminar el documento');
    }
  };

  return (
    // `text-gray-900` at the top forces every descendant to render with dark text
    // regardless of the user's system dark-mode preference (the page has a white bg).
    <div className="min-h-screen bg-white text-gray-900">
      <DashboardNavbar activePage="documents" />

      <div className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Documentos Merquellantas</h1>
            <p className="text-gray-600">Gestiona y accede a todos los documentos corporativos</p>
          </div>

          {/* Admin panel */}
          {canManage && (
            <div className="bg-gradient-to-r from-[#f4a900] to-[#e68a00] rounded-xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white text-lg font-semibold mb-2">Panel de Administración</h2>
                  <p className="text-white/80 text-sm">Gestiona los documentos de la empresa</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center px-4 py-2 bg-white text-[#f4a900] rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                >
                  <Plus size={16} className="mr-2" />
                  Subir Documento
                </button>
              </div>
            </div>
          )}

          {/* Search + filter */}
          <div className="bg-white rounded-xl shadow-xl p-6 mb-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent appearance-none bg-white text-gray-900 min-w-40"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.slice(1).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tab switcher — the two stats cards double as tabs so users pick which
              set of files they're browsing without scrolling past the other. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <TabCard
              active={activeTab === 'regular'}
              onClick={() => setActiveTab('regular')}
              icon={<FileText size={24} />}
              label="Total Documentos"
              count={totalRegular}
              accent="#f4a900"
            />
            <TabCard
              active={activeTab === 'policy'}
              onClick={() => setActiveTab('policy')}
              icon={<ShieldCheck size={24} />}
              label="Políticas de la empresa"
              count={totalPolicy}
              accent="#1d4ed8"
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f4a900]"></div>
            </div>
          ) : activeTab === 'regular' ? (
            <DocumentSection
              title="Documentos"
              icon={<Folder className="text-[#f4a900]" size={20} />}
              docs={regularDocs}
              accent="#f4a900"
              canManage={canManage}
              onOpen={(d) => handleDocumentAction(d)}
              onDownload={(d) => handleDocumentAction(d, true)}
              onDelete={handleDelete}
              emptyText="No hay documentos que coincidan con tu búsqueda."
            />
          ) : (
            <DocumentSection
              title="Políticas de la empresa"
              icon={<ShieldCheck className="text-blue-600" size={20} />}
              docs={policyDocs}
              accent="#1d4ed8"
              canManage={canManage}
              onOpen={(d) => handleDocumentAction(d)}
              onDownload={(d) => handleDocumentAction(d, true)}
              onDelete={handleDelete}
              emptyText="Aún no hay políticas publicadas."
            />
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md text-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Subir Documento</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Kind picker — regular vs policy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de documento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadKind('regular')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      uploadKind === 'regular'
                        ? 'border-[#f4a900] bg-[#f4a900]/10 ring-2 ring-[#f4a900]/40'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Folder size={16} className="text-[#f4a900]" />
                      <span className="font-semibold text-sm text-gray-900">Documento</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Circulares, manuales, formularios, etc.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadKind('policy')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      uploadKind === 'policy'
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={16} className="text-blue-600" />
                      <span className="font-semibold text-sm text-gray-900">Política</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Políticas internas que aplican a todo el equipo.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Archivo</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent bg-white text-gray-900"
                  accept=".pdf,.xlsx,.xls,.docx,.doc"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Documento
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400"
                  placeholder={
                    uploadKind === 'policy'
                      ? 'Ej: Política de Seguridad y Salud en el Trabajo'
                      : 'Ingresa el nombre del documento'
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
                <input
                  type="text"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400"
                  placeholder={
                    uploadKind === 'policy'
                      ? 'Ej: SST, Tratamiento de datos, Convivencia'
                      : 'Ej: SST, RRHH, Nómina'
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !uploadName || !uploadCategory}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-[#f4a900] text-white rounded-lg hover:bg-[#e68a00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2" />
                      Subir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Subcomponents ------------------------------------------------------------

function TabCard({
  active,
  onClick,
  icon,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-xl shadow-lg p-6 border transition-all active:scale-[0.99] ${
        active
          ? 'border-transparent ring-2 shadow-xl'
          : 'border-gray-100 hover:shadow-xl hover:border-gray-200'
      }`}
      style={active ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
      aria-pressed={active}
    >
      <div className="flex items-center">
        <div
          className="p-3 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: active ? accent : `${accent}1a`,
            color: active ? '#fff' : accent,
          }}
        >
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <p className="text-2xl font-bold text-gray-900">{count}</p>
          <p className="text-gray-600">{label}</p>
        </div>
        {active && (
          <span
            className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            Viendo
          </span>
        )}
      </div>
    </button>
  );
}

function DocumentSection({
  title,
  icon,
  docs,
  accent,
  canManage,
  onOpen,
  onDownload,
  onDelete,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  docs: DocumentItem[];
  accent: string;
  canManage: boolean;
  onOpen: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
  emptyText: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 border border-gray-100">
          {icon}
        </span>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <span className="ml-2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {docs.length}
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <FileText size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group border border-gray-100"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div
                      className="p-3 rounded-lg transition-colors"
                      style={{ backgroundColor: `${accent}1a` }}
                    >
                      {fileIcon(doc.type)}
                    </div>
                    <div className="ml-3">
                      <span
                        className="inline-block px-2 py-1 text-xs font-medium rounded-full"
                        style={{ backgroundColor: `${accent}1a`, color: accent }}
                      >
                        {doc.category}
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => onDelete(doc)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 group-hover:text-[#f4a900] transition-colors">
                  {doc.name}
                </h3>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>Tamaño: {doc.size}</span>
                  <span>{formatDate(doc.dateUploaded)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onOpen(doc)}
                    className="flex-1 flex items-center justify-center px-4 py-2 text-white rounded-lg transition-colors font-semibold"
                    style={{ backgroundColor: accent }}
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Ver/Abrir
                  </button>
                  <button
                    onClick={() => onDownload(doc)}
                    className="px-4 py-2 border rounded-lg transition-colors"
                    style={{ borderColor: accent, color: accent }}
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
