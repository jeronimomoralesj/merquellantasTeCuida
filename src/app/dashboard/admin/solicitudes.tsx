"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Gift,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  Plane,
  Download,
  Eye,
  X,
  Anchor,
  AlertCircle,
  Loader2,
  Search,
  List,
  User,
  FileText,
  Filter,
  RefreshCw,
} from "lucide-react";
// Type definitions
interface BaseDocumentData {
  nombre: string;
  cedula: string;
  estado: string;
  created_at: string;
  updated_at?: string;
  description?: string;
  document_url?: string;
  document_name?: string;
  motivo_respuesta?: string;
}

interface RequestData {
  id: string;
  title: string;
  employee: string;
  date: Date | string;
  status: string;
  statusColor: string;
  type: string;
  avatarColor: string;
  avatarText: string;
  description?: string;
  attachment?: string;
  motivoRespuesta?: string;
  isPermiso: boolean;
  collectionName: string; // 'solicitudes' or 'cesantias'
  rawData?: BaseDocumentData | IncapacidadData | VacacionesData | PermisoData | CesantiasData;
}

interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface IncapacidadData extends BaseDocumentData {
  tipo: 'incapacidad';
  edad: string;
  gender: string;
  tipo_contrato: string;
  ubicacion: string;
  cargo: string;
  tipo_evento: string;
  cie10: string;
  codigo_incap: string;
  mes_diagnostico: string;
  start_date: string;
  end_date: string;
  num_dias: number;
}

interface VacacionesData extends BaseDocumentData {
  tipo: 'vacaciones';
  fecha_inicio: string;
  fecha_fin: string;
  dias_vacaciones: number;
}

interface PermisoData extends BaseDocumentData {
  tipo: 'permiso';
  fecha: string;
  tiempo_inicio: string;
  tiempo_fin: string;
}

interface CesantiasData extends BaseDocumentData {
  motivo_solicitud: string;
  file_url?: string;
}

type TabKey = "pendiente" | "gestionada" | "todas";

export default function SolicitudesCard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<RequestData | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [tab, setTab] = useState<TabKey>("pendiente");

  // Helper: format date
  const formatDate = (d: Date | string | undefined): string => {
    if (!d) return 'Fecha no disponible';
    try {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Fecha no disponible';
    }
  };

  // Helper: format short date
  const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return 'No disponible';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "error:" + error;
    }
  };

  // Helper: get initials
  const initials = (name: string): string => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Map status to badge color
  const statusColor = (st: string): string => {
    switch(st?.toLowerCase()) {
      case "pendiente":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      case "aprobado":
        return "bg-green-100 text-green-800 border border-green-200";
      case "rechazado":
        return "bg-red-100 text-red-800 border border-red-200";
      default:
        return "bg-blue-100 text-blue-800 border border-blue-200";
    }
  };

  // Pick icon by request type
  const typeIcon = (t: string) => {
    switch (t) {
      case "Vacaciones":
        return <Plane className="h-5 w-5 text-blue-600" />;
      case "Reembolso":
        return <Gift className="h-5 w-5 text-purple-600" />;
      case "RRHH":
      case "Permiso":
        return <Briefcase className="h-5 w-5 text-orange-600" />;
      case "Horario":
        return <Clock className="h-5 w-5 text-green-600" />;
      case "Cesantías":
        return <Anchor className="h-5 w-5 text-indigo-600" />;
      case "Incapacidad":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Briefcase className="h-5 w-5 text-gray-600" />;
    }
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Reason modal state
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    requestId: string;
    collectionName: string;
    newStatus: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const openReasonModal = (requestId: string, newStatus: string, collectionName: string) => {
    setReasonText("");
    setReasonModal({ open: true, requestId, collectionName, newStatus });
  };

  // Handle approval/rejection
  const handleStatusUpdate = async (
    requestId: string,
    newStatus: string,
    collectionName: string,
    motivo: string
  ) => {
    if (!requestId) {
      showNotification("ID de solicitud no válido", "error");
      return;
    }
    if (!collectionName) {
      showNotification("Colección no identificada", "error");
      return;
    }

    try {
      setProcessingId(requestId);
      const endpoint = collectionName === 'cesantias' ? '/api/cesantias' : '/api/solicitudes';
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, estado: newStatus, motivoRespuesta: motivo }),
      });
      if (!res.ok) throw new Error('Error updating status');

      setRequests(prevRequests =>
        prevRequests.map(req =>
          req.id === requestId
            ? { ...req, status: newStatus, statusColor: statusColor(newStatus), motivoRespuesta: motivo }
            : req
        )
      );

      if (showDetails && selected?.id === requestId) {
        setSelected(prev =>
          prev ? { ...prev, status: newStatus, statusColor: statusColor(newStatus), motivoRespuesta: motivo } : null
        );
      }

      const actionText = newStatus === "aprobado" ? "aprobada" : "rechazada";
      showNotification(`✓ Solicitud ${actionText} exitosamente`, "success");
      setReasonModal(null);
      setReasonText("");
    } catch (error) {
      console.error("Error updating request:", error);
      const actionText = newStatus === "aprobado" ? "aprobar" : "rechazar";
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      showNotification(`Error al ${actionText} la solicitud: ${errorMessage}`, "error");
    } finally {
      setProcessingId(null);
    }
  };

  // Load all requests from API
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [cesRes, solRes] = await Promise.all([
          fetch('/api/cesantias'),
          fetch('/api/solicitudes'),
        ]);

        if (!cesRes.ok || !solRes.ok) throw new Error('Error fetching data');

        const cesData: CesantiasData[] = await cesRes.json();
        const solData: (IncapacidadData | VacacionesData | PermisoData)[] = await solRes.json();

        // Process cesantias
        const ces: RequestData[] = cesData.map((data) => ({
          id: String((data as unknown as Record<string, unknown>)._id || (data as unknown as Record<string, unknown>).id || ''),
          title: "Solicitud de Cesantías",
          employee: data.nombre,
          date: data.created_at,
          status: data.estado,
          statusColor: statusColor(data.estado),
          type: "Cesantías",
          avatarColor: "bg-indigo-100",
          avatarText: initials(data.nombre),
          description: data.motivo_solicitud,
          attachment: data.file_url,
          motivoRespuesta: data.motivo_respuesta,
          isPermiso: false,
          collectionName: "cesantias",
          rawData: data,
        }));

        // Process solicitudes
        const sol: RequestData[] = solData.map((data) => {
          let typ = "Desconocido";
          let avatarColor = "bg-gray-100";

          if (data.tipo === "incapacidad") {
            typ = "Incapacidad";
            avatarColor = "bg-red-100";
          } else if (data.tipo === "vacaciones") {
            typ = "Vacaciones";
            avatarColor = "bg-blue-100";
          } else if (data.tipo === "permiso") {
            typ = "Permiso";
            avatarColor = "bg-orange-100";
          }

          return {
            id: String((data as unknown as Record<string, unknown>)._id || (data as unknown as Record<string, unknown>).id || ''),
            title: `Solicitud de ${typ}`,
            employee: data.nombre,
            date: data.created_at,
            status: data.estado,
            statusColor: statusColor(data.estado),
            type: typ,
            avatarColor: avatarColor,
            avatarText: initials(data.nombre),
            description: data.description,
            attachment: data.document_url,
            motivoRespuesta: data.motivo_respuesta,
            isPermiso: typ === "Permiso",
            collectionName: "solicitudes",
            rawData: data,
          };
        });

        // Merge and sort: pending first, then by date (oldest first)
        const merged = [...ces, ...sol].sort((a, b) => {
          if (a.status === "pendiente" && b.status !== "pendiente") return -1;
          if (a.status !== "pendiente" && b.status === "pendiente") return 1;

          const da = new Date(a.date as string).getTime();
          const db_ = new Date(b.date as string).getTime();
          return da - db_;
        });

        setRequests(merged);
      } catch (error) {
        console.error("Error loading requests:", error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        showNotification(`Error al cargar las solicitudes: ${errorMessage}`, "error");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Filter requests — search hits name, cédula, type, and description
  const filteredRequests = requests.filter(req => {
    const term = searchTerm.toLowerCase().trim();
    const cedula = (req.rawData as BaseDocumentData | undefined)?.cedula || "";
    const matchesSearch = !term ||
      req.employee.toLowerCase().includes(term) ||
      cedula.toLowerCase().includes(term) ||
      req.type.toLowerCase().includes(term) ||
      (req.description?.toLowerCase().includes(term) ?? false) ||
      (req.motivoRespuesta?.toLowerCase().includes(term) ?? false);
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    const matchesType = filterType === "all" || req.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Get unique request types
  const requestTypes = Array.from(new Set(requests.map(r => r.type)));

  // Status tag component
  const StatusTag: React.FC<{ status: string }> = ({ status }) => {
    const text = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span className={`px-3 py-1 text-xs font-medium ${statusColor(status)} rounded-full`}>
        {text}
      </span>
    );
  };

  // Status accent helpers
  const accentBar = (st: string) => {
    switch (st?.toLowerCase()) {
      case "pendiente": return "bg-[#ff9900]";
      case "aprobado": return "bg-green-500";
      case "rechazado": return "bg-red-500";
      default: return "bg-gray-300";
    }
  };

  // Request card component
  const RequestCard: React.FC<{ s: RequestData; isInModal?: boolean }> = ({ s, isInModal = false }) => (
    <div
      className={`relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all duration-200 ${
        processingId === s.id ? "opacity-70 pointer-events-none" : ""
      }`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${accentBar(s.status)}`} />
      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-start min-w-0 flex-1">
            <div className={`w-11 h-11 rounded-xl ${s.avatarColor} flex items-center justify-center mr-3 flex-shrink-0`}>
              {typeIcon(s.type)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{s.title}</h3>
              <p className="text-sm text-gray-700 font-medium truncate">{s.employee}</p>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {formatDate(s.date)}
              </p>
            </div>
          </div>
          <StatusTag status={s.status} />
        </div>

        {s.motivoRespuesta && (
          <div className={`mt-3 p-3 rounded-lg text-xs border ${
            s.status === "rechazado"
              ? "bg-red-50 border-red-100 text-red-700"
              : "bg-green-50 border-green-100 text-green-700"
          }`}>
            <p className="font-bold mb-0.5">
              {s.status === "rechazado" ? "Motivo del rechazo:" : "Comentario:"}
            </p>
            <p>{s.motivoRespuesta}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => {
              setSelected(s);
              setShowDetails(true);
              if (isInModal) setShowAll(false);
            }}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center transition-colors"
          >
            <Eye className="mr-1.5 h-4 w-4" /> Ver detalles
          </button>

          {s.status === "pendiente" && (
            <>
              <button
                onClick={() => openReasonModal(s.id, "aprobado", s.collectionName)}
                disabled={processingId === s.id}
                className="text-xs font-semibold px-3 py-2 bg-green-500 text-white rounded-lg flex items-center hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {processingId === s.id ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                )}
                Aprobar
              </button>
              <button
                onClick={() => openReasonModal(s.id, "rechazado", s.collectionName)}
                disabled={processingId === s.id}
                className="text-xs font-semibold px-3 py-2 bg-red-500 text-white rounded-lg flex items-center hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {processingId === s.id ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-4 w-4" />
                )}
                Rechazar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Type guard
  const isIncapacidadData = (data: RequestData['rawData']): data is IncapacidadData => {
    return data !== undefined && 'tipo' in data && data.tipo === 'incapacidad';
  };
  const isVacacionesData = (data: RequestData['rawData']): data is VacacionesData => {
    return data !== undefined && 'tipo' in data && data.tipo === 'vacaciones';
  };
  const isPermisoData = (data: RequestData['rawData']): data is PermisoData => {
    return data !== undefined && 'tipo' in data && data.tipo === 'permiso';
  };
  const isCesantiasData = (data: RequestData['rawData']): data is CesantiasData => {
    return data !== undefined && 'motivo_solicitud' in data;
  };

  // Enhanced details for Incapacidad
  const EnfermedadDetails: React.FC<{ data: IncapacidadData }> = ({ data }) => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <User className="h-5 w-5 mr-2 text-blue-600" />
          Información Personal
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Nombre completo</p>
            <p className="font-medium text-gray-800">{data.nombre || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cédula</p>
            <p className="font-medium text-gray-800">{data.cedula || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Edad</p>
            <p className="font-medium text-gray-800">{data.edad || 'No disponible'} años</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Género</p>
            <p className="font-medium text-gray-800 capitalize">{data.gender || 'No disponible'}</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <Briefcase className="h-5 w-5 mr-2 text-green-600" />
          Información Contractual
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tipo de contrato</p>
            <p className="font-medium text-gray-800 capitalize">{data.tipo_contrato || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Ubicación</p>
            <p className="font-medium text-gray-800">{data.ubicacion || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cargo</p>
            <p className="font-medium text-gray-800">{data.cargo || 'No disponible'}</p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
          Información Médica
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tipo de evento</p>
            <p className="font-medium text-gray-800">{data.tipo_evento || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Código CIE-10</p>
            <p className="font-medium text-gray-800">{data.cie10 || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Código de incapacidad</p>
            <p className="font-medium text-gray-800">{data.codigo_incap || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mes de diagnóstico</p>
            <p className="font-medium text-gray-800">{data.mes_diagnostico || 'No disponible'}</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-yellow-600" />
          Período de Incapacidad
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Fecha de inicio</p>
            <p className="font-medium text-gray-800">{formatShortDate(data.start_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de fin</p>
            <p className="font-medium text-gray-800">{formatShortDate(data.end_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Número de días</p>
            <p className="font-medium text-gray-800">{data.num_dias || 0} días</p>
          </div>
        </div>
      </div>

      {data.document_url && (
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-purple-600" />
            Documento Adjunto
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-gray-700">{data.document_name || 'Documento médico'}</p>
            <button
              onClick={() => window.open(data.document_url, "_blank")}
              className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-200"
            >
              <Download className="mr-2 h-4 w-4" /> Ver documento
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const pendingCount = requests.filter(r => r.status === "pendiente").length;
  const approvedCount = requests.filter(r => r.status === "aprobado").length;
  const rejectedCount = requests.filter(r => r.status === "rechazado").length;
  const handledCount = approvedCount + rejectedCount;

  const tabFiltered = requests.filter(r => {
    if (tab === "pendiente") return r.status === "pendiente";
    if (tab === "gestionada") return r.status === "aprobado" || r.status === "rechazado";
    return true;
  });

  const shown = tabFiltered.slice(0, 3);

  return (
    <div className="space-y-4 text-black">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-2 animate-in slide-in-from-top-2
        ${notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 
          notification.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
          'bg-green-50 text-green-800 border border-green-200'}`}>
          {notification.type === 'error' ? <XCircle className="h-5 w-5" /> : 
           notification.type === 'info' ? <AlertCircle className="h-5 w-5" /> :
           <CheckCircle className="h-5 w-5" />}
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      {/* Stat counters */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setTab("pendiente")}
          className={`text-left p-4 rounded-xl border transition-all ${
            tab === "pendiente"
              ? "bg-black text-white border-[#ff9900] shadow-md"
              : "bg-white border-gray-200 hover:border-[#ff9900]/50"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${tab === "pendiente" ? "text-[#ff9900]" : "text-gray-500"}`}>
            Pendientes
          </p>
          <p className="text-2xl font-extrabold mt-1">{pendingCount}</p>
        </button>
        <button
          onClick={() => setTab("gestionada")}
          className={`text-left p-4 rounded-xl border transition-all ${
            tab === "gestionada"
              ? "bg-black text-white border-[#ff9900] shadow-md"
              : "bg-white border-gray-200 hover:border-[#ff9900]/50"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${tab === "gestionada" ? "text-[#ff9900]" : "text-gray-500"}`}>
            Gestionadas
          </p>
          <p className="text-2xl font-extrabold mt-1">{handledCount}</p>
          <p className={`text-[10px] mt-0.5 ${tab === "gestionada" ? "text-white/60" : "text-gray-400"}`}>
            ✓ {approvedCount} · ✗ {rejectedCount}
          </p>
        </button>
        <button
          onClick={() => setTab("todas")}
          className={`text-left p-4 rounded-xl border transition-all ${
            tab === "todas"
              ? "bg-black text-white border-[#ff9900] shadow-md"
              : "bg-white border-gray-200 hover:border-[#ff9900]/50"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wider ${tab === "todas" ? "text-[#ff9900]" : "text-gray-500"}`}>
            Todas
          </p>
          <p className="text-2xl font-extrabold mt-1">{requests.length}</p>
        </button>
      </div>

      {/* Reload row */}
      <div className="flex justify-end">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#ff9900] transition"
          title="Recargar solicitudes"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recargar
        </button>
      </div>

      {loading ? (
        <div className="w-full flex justify-center items-center py-12 border border-gray-100 rounded-xl bg-gray-50">
          <Loader2 className="h-6 w-6 text-[#ff9900] animate-spin" />
          <span className="ml-2 text-gray-600 text-sm">Cargando solicitudes...</span>
        </div>
      ) : tabFiltered.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl bg-gray-50">
          <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {tab === "pendiente"
              ? "No hay solicitudes pendientes"
              : tab === "gestionada"
              ? "Aún no hay solicitudes gestionadas"
              : "No hay solicitudes"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {shown.map((s) => (
            <RequestCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {!loading && tabFiltered.length > 3 && (
        <div className="text-center mt-2">
          <button
            onClick={() => setShowAll(true)}
            className="inline-flex items-center px-4 py-2 bg-black text-white rounded-full hover:bg-[#ff9900] hover:text-black transition-colors text-sm font-semibold"
          >
            <List className="mr-2 h-4 w-4" />
            Ver todas ({tabFiltered.length})
          </button>
        </div>
      )}

      {/* All Requests Modal */}
      {showAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Todas las solicitudes ({filteredRequests.length})
              </h2>
              <button 
                onClick={() => setShowAll(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula, tipo, descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-[#ff9900] outline-none text-black placeholder:text-gray-400"
                />
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="inline h-4 w-4 mr-1" />
                    Estado
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="inline h-4 w-4 mr-1" />
                    Tipo
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Todos</option>
                    {requestTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 border rounded-xl bg-gray-50">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No se encontraron solicitudes con los filtros aplicados</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                    setFilterType("all");
                  }}
                  className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map((s) => (
                  <RequestCard key={s.id} s={s} isInModal={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal header — black hero */}
            <div className="relative p-5 sm:p-6 bg-black text-white">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 90% 30%, #ff9900 0, transparent 50%)",
                }}
              />
              <div className="relative flex justify-between items-start gap-3">
                <div className="flex items-center min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#ff9900]/20 text-[#ff9900] flex items-center justify-center mr-3 flex-shrink-0">
                    {typeIcon(selected.type)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-extrabold truncate">{selected.title}</h2>
                    <p className="text-xs text-white/60 truncate">{selected.employee} · {selected.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag status={selected.status} />
                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto p-5 sm:p-6">
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
              <p className="text-xs text-gray-500 flex items-center">
                <Calendar className="h-3.5 w-3.5 mr-1 text-[#ff9900]" />
                Enviada el {formatDate(selected.date)}
              </p>
            </div>

            {selected.motivoRespuesta && (
              <div className={`p-4 rounded-lg mb-6 border ${
                selected.status === "rechazado"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-green-50 border-green-200 text-green-800"
              }`}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1">
                  {selected.status === "rechazado" ? "Motivo del rechazo" : "Comentario del admin"}
                </p>
                <p className="text-sm">{selected.motivoRespuesta}</p>
              </div>
            )}
            
            {isIncapacidadData(selected.rawData) ? (
              <EnfermedadDetails data={selected.rawData} />
            ) : isPermisoData(selected.rawData) ? (
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-orange-600" />
                    Detalles del Permiso
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Fecha</p>
                      <p className="font-medium text-gray-800">{selected.rawData.fecha ? formatShortDate(selected.rawData.fecha) : 'No disponible'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Hora inicio</p>
                      <p className="font-medium text-gray-800">{selected.rawData.tiempo_inicio || 'No disponible'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Hora fin</p>
                      <p className="font-medium text-gray-800">{selected.rawData.tiempo_fin || 'No disponible'}</p>
                    </div>
                  </div>
                </div>
                {selected.rawData.description && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Descripción
                    </h4>
                    <p className="bg-gray-50 p-4 rounded-lg text-gray-800 border border-gray-200">{selected.rawData.description}</p>
                  </div>
                )}
                {selected.rawData.document_url && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center"><Download className="h-5 w-5 mr-2" /> Documento adjunto</h4>
                    <button onClick={() => window.open(selected.rawData && 'document_url' in selected.rawData ? (selected.rawData as PermisoData).document_url : undefined, "_blank")} className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors border border-blue-200">
                      <Download className="mr-2 h-4 w-4" /> Ver documento
                    </button>
                  </div>
                )}
              </div>
            ) : isVacacionesData(selected.rawData) ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
                    <Plane className="h-5 w-5 mr-2 text-blue-600" />
                    Detalles de Vacaciones
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Fecha inicio</p>
                      <p className="font-medium text-gray-800">{selected.rawData.fecha_inicio ? formatShortDate(selected.rawData.fecha_inicio) : 'No disponible'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Fecha fin</p>
                      <p className="font-medium text-gray-800">{selected.rawData.fecha_fin ? formatShortDate(selected.rawData.fecha_fin) : 'No disponible'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Días solicitados</p>
                      <p className="font-medium text-gray-800">{selected.rawData.dias_vacaciones || 0} días</p>
                    </div>
                  </div>
                </div>
                {selected.rawData.description && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center"><FileText className="h-5 w-5 mr-2" /> Descripción</h4>
                    <p className="bg-gray-50 p-4 rounded-lg text-gray-800 border border-gray-200">{selected.rawData.description}</p>
                  </div>
                )}
                {selected.rawData.document_url && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center"><Download className="h-5 w-5 mr-2" /> Documento adjunto</h4>
                    <button onClick={() => window.open(selected.rawData && 'document_url' in selected.rawData ? (selected.rawData as VacacionesData).document_url : undefined, "_blank")} className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors border border-blue-200">
                      <Download className="mr-2 h-4 w-4" /> Ver documento
                    </button>
                  </div>
                )}
              </div>
            ) : isCesantiasData(selected.rawData) ? (
              <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
                    <Anchor className="h-5 w-5 mr-2 text-indigo-600" />
                    Detalles de Cesantías
                  </h4>
                  <div>
                    <p className="text-sm text-gray-600">Motivo de la solicitud</p>
                    <p className="font-medium text-gray-800 mt-1">{selected.rawData.motivo_solicitud || 'No disponible'}</p>
                  </div>
                </div>
                {selected.rawData.file_url && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center"><Download className="h-5 w-5 mr-2" /> Documento adjunto</h4>
                    <button onClick={() => window.open((selected.rawData as CesantiasData).file_url, "_blank")} className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors border border-blue-200">
                      <Download className="mr-2 h-4 w-4" /> Ver documento
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h4 className="font-semibold mb-2 text-gray-700 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Descripción
                  </h4>
                  <p className="bg-gray-50 p-4 rounded-lg text-gray-800 border border-gray-200">
                    {selected.description || "No hay descripción disponible"}
                  </p>
                </div>

                {selected.attachment && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2 text-gray-700 flex items-center">
                      <Download className="h-5 w-5 mr-2" />
                      Documento adjunto
                    </h4>
                    <button
                      onClick={() => window.open(selected.attachment, "_blank")}
                      className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 border border-blue-200"
                    >
                      <Download className="mr-2 h-4 w-4" /> Ver y descargar documento
                    </button>
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDetails(false)}
                className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
              >
                Cerrar
              </button>
              
              {selected.status === "pendiente" && (
                <>
                  <button
                    onClick={() => {
                      openReasonModal(selected.id, "aprobado", selected.collectionName);
                      setShowDetails(false);
                    }}
                    disabled={processingId === selected.id}
                    className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {processingId === selected.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Aprobar solicitud
                  </button>
                  
                  <button
                    onClick={() => {
                      openReasonModal(selected.id, "rechazado", selected.collectionName);
                      setShowDetails(false);
                    }}
                    disabled={processingId === selected.id}
                    className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {processingId === selected.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Rechazar solicitud
                  </button>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Reason modal */}
      {reasonModal?.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="relative p-5 bg-black text-white">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 90% 30%, #ff9900 0, transparent 50%)",
                }}
              />
              <div className="relative flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-extrabold">
                    {reasonModal.newStatus === "aprobado" ? "Aprobar solicitud" : "Rechazar solicitud"}
                  </h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    {reasonModal.newStatus === "aprobado"
                      ? "Agrega un comentario opcional para el empleado"
                      : "Cuéntale al empleado por qué se rechaza"}
                  </p>
                </div>
                <button
                  onClick={() => setReasonModal(null)}
                  className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={
                  reasonModal.newStatus === "aprobado"
                    ? "Comentario opcional..."
                    : "Motivo del rechazo..."
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff9900] text-black placeholder:text-gray-400 text-sm resize-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setReasonModal(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (reasonModal.newStatus === "rechazado" && !reasonText.trim()) {
                      showNotification("Por favor escribe un motivo de rechazo", "error");
                      return;
                    }
                    handleStatusUpdate(
                      reasonModal.requestId,
                      reasonModal.newStatus,
                      reasonModal.collectionName,
                      reasonText.trim()
                    );
                  }}
                  disabled={processingId === reasonModal.requestId}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center transition disabled:opacity-50 ${
                    reasonModal.newStatus === "aprobado"
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {processingId === reasonModal.requestId ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : reasonModal.newStatus === "aprobado" ? (
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                  ) : (
                    <XCircle className="mr-1.5 h-4 w-4" />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}