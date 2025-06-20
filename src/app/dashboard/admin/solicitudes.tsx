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
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc,
  Timestamp 
} from "firebase/firestore";
import { db } from "../../../firebase"; // adjust to your path

// Base interface for common document fields
interface BaseDocumentData {
  nombre: string;
  cedula: string;
  estado: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  description?: string;
  documentUrl?: string;
  documentName?: string;
}

// Type definitions
interface RequestData {
  id: string;
  title: string;
  employee: string;
  date: Timestamp | Date | string;
  status: string;
  statusColor: string;
  type: string;
  avatarColor: string;
  avatarText: string;
  description?: string;
  attachment?: string;
  isPermiso: boolean;
  rawData?: BaseDocumentData | IncapacidadData | VacacionesData | PermisoData | CesantiasData;
}

interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

interface IncapacidadData extends BaseDocumentData {
  tipo: 'enfermedad';
  edad: string;
  gender: string;
  tipoContrato: string;
  ubicacion: string;
  cargo: string;
  tipoEvento: string;
  cie10: string;
  codigoIncap: string;
  mesDiagnostico: string;
  startDate: string;
  endDate: string;
  numDias: number;
}

interface VacacionesData extends BaseDocumentData {
  tipo: 'vacaciones';
  fechaInicio: string;
  fechaFin: string;
  diasVacaciones: number;
}

interface PermisoData extends BaseDocumentData {
  tipo: 'permiso';
  fecha: string;
  tiempoInicio: string;
  tiempoFin: string;
}

interface CesantiasData extends BaseDocumentData {
  motivoSolicitud: string;
  fileUrl?: string;
}

export default function SolicitudesCard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<RequestData | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // helper: format Firestore Timestamp or ISO string
  const formatDate = (d: Timestamp | Date | string | undefined): string => {
    if (!d) return 'Fecha no disponible';
    const dt = (d as Timestamp)?.toDate?.() || new Date(d as string | Date);
    return dt.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // helper: format date for display (shorter format)
  const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return 'No disponible';
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // helper: initials from full name
  const initials = (name: string): string =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // map status → badge color
  const statusColor = (st: string): string => {
    switch(st) {
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

  // pick icon by request type
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

  // Function to show notification
  const showNotification = (message: string, type: 'success' | 'error' = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle approval/rejection
  const handleStatusUpdate = async (requestId: string, newStatus: string, isPermiso: boolean) => {
    if (!requestId) return;
    
    try {
      setProcessingId(requestId);
      
      // Determine which collection to update based on request type
      const collectionName = isPermiso ? "solicitudes" : "cesantias";
      const requestRef = doc(db, collectionName, requestId);
      
      // Update the document with new status and timestamp
      await updateDoc(requestRef, {
        estado: newStatus,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setRequests(requests.map(req => 
        req.id === requestId 
          ? {...req, status: newStatus, statusColor: statusColor(newStatus)} 
          : req
      ));
      
      // Close modal if open
      if (showDetails && selected?.id === requestId) {
        setSelected({...selected, status: newStatus, statusColor: statusColor(newStatus)});
      }
      
      showNotification(`Solicitud ${newStatus === "aprobado" ? "aprobada" : "rechazada"} correctamente`);
    } catch (error) {
      console.error("Error updating request:", error);
      showNotification(`Error al ${newStatus === "aprobado" ? "aprobar" : "rechazar"} la solicitud`, "error");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        // 1) fetch cesantias
        const qCes = query(
          collection(db, "cesantias"),
          orderBy("createdAt", "desc")
        );
        // 2) fetch solicitudes
        const qSol = query(
          collection(db, "solicitudes"),
          orderBy("createdAt", "desc")
        );
        const [cesSnap, solSnap] = await Promise.all([
          getDocs(qCes),
          getDocs(qSol),
        ]);

        const ces: RequestData[] = cesSnap.docs.map((d) => {
          const data = d.data() as CesantiasData;
          return {
            id: d.id,
            title: "Solicitud de Cesantías",
            employee: data.nombre,
            date: data.createdAt,
            status: data.estado,
            statusColor: statusColor(data.estado),
            type: "Cesantías",
            avatarColor: "bg-indigo-100",
            avatarText: initials(data.nombre),
            description: data.motivoSolicitud,
            attachment: data.fileUrl,
            isPermiso: false,
            rawData: data,
          };
        });

        const sol: RequestData[] = solSnap.docs.map((d) => {
          const data = d.data() as IncapacidadData | VacacionesData | PermisoData;
          let typ = "";
          let avatarColor = "";
          
          // Determine type based on data.tipo
          if (data.tipo === "enfermedad") {
            typ = "Incapacidad";
            avatarColor = "bg-red-100";
          } else if (data.tipo === "vacaciones") {
            typ = "Vacaciones";
            avatarColor = "bg-blue-100";
          } else {
            typ = "Permiso";
            avatarColor = "bg-orange-100";
          }
          
          return {
            id: d.id,
            title: `Solicitud de ${typ}`,
            employee: data.nombre,
            date: data.createdAt,
            status: data.estado,
            statusColor: statusColor(data.estado),
            type: typ,
            avatarColor: avatarColor,
            avatarText: initials(data.nombre),
            description: data.description,
            attachment: data.documentUrl,
            isPermiso: true,
            rawData: data,
          };
        });

        // merge & sort:
        // 1. Pending requests first
        // 2. Then by date (oldest first)
        const merged = [...ces, ...sol].sort((a, b) => {
          // First prioritize pending status
          if (a.status === "pendiente" && b.status !== "pendiente") return -1;
          if (a.status !== "pendiente" && b.status === "pendiente") return 1;
          
          // Then sort by date (oldest first)
          const da = (a.date as Timestamp)?.toDate?.().getTime() || new Date(a.date as string | Date).getTime();
          const db_ = (b.date as Timestamp)?.toDate?.().getTime() || new Date(b.date as string | Date).getTime();
          return da - db_; // Changed to ascending order (oldest first)
        });

        setRequests(merged);
      } catch (error) {
        console.error("Error loading requests:", error);
        showNotification("Error al cargar las solicitudes", "error");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Filter requests by search term
  const filteredRequests = requests.filter(req => 
    req.employee.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const shown = requests.slice(0, 3);
  
  // Status tag component
  const StatusTag: React.FC<{ status: string }> = ({ status }) => {
    const text = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span className={`px-3 py-1 text-xs font-medium ${statusColor(status)} rounded-full`}>
        {text}
      </span>
    );
  };

  // Individual request card component
  const RequestCard: React.FC<{ s: RequestData; isInModal?: boolean }> = ({ s, isInModal = false }) => (
    <div
      className={`border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200 bg-white ${
        processingId === s.id ? "opacity-70" : ""
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-start">
          <div
            className={`w-12 h-12 rounded-lg ${s.avatarColor} flex items-center justify-center mr-4 shadow-sm`}
          >
            {typeIcon(s.type)}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-800">{s.title}</h3>
            <p className="text-gray-700 font-medium">{s.employee}</p>
            <p className="text-sm text-gray-500 flex items-center mt-1">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(s.date)}
            </p>
          </div>
        </div>
        <StatusTag status={s.status} />
      </div>
      
      {/* Only show action buttons if status is pending */}
      {s.status === "pendiente" && (
        <div className="mt-4 flex space-x-2 justify-end">
          <button
            onClick={() => {
              setSelected(s);
              setShowDetails(true);
              if (isInModal) setShowAll(false);
            }}
            className="text-sm px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center transition-colors duration-200"
          >
            <Eye className="mr-1.5 h-4 w-4" /> Ver detalles
          </button>
          
          <button 
            onClick={() => handleStatusUpdate(s.id, "aprobado", s.isPermiso)}
            disabled={processingId === s.id}
            className="text-sm px-3 py-1.5 bg-green-500 text-white rounded-lg flex items-center hover:bg-green-600 transition-colors duration-200"
          >
            {processingId === s.id ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-4 w-4" />
            )}
            Aprobar
          </button>
          
          <button 
            onClick={() => handleStatusUpdate(s.id, "rechazado", s.isPermiso)}
            disabled={processingId === s.id}
            className="text-sm px-3 py-1.5 bg-red-500 text-white rounded-lg flex items-center hover:bg-red-600 transition-colors duration-200"
          >
            {processingId === s.id ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 h-4 w-4" />
            )}
            Rechazar
          </button>
        </div>
      )}
    </div>
  );

  // Type guard to check if data is IncapacidadData
  const isIncapacidadData = (data: RequestData['rawData']): data is IncapacidadData => {
    return data !== undefined && 'tipo' in data && data.tipo === 'enfermedad';
  };

  // Enhanced details modal for different types
  const EnfermedadDetails: React.FC<{ data: IncapacidadData }> = ({ data }) => (
    <div className="space-y-6">
      {/* Personal Information */}
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

      {/* Contract Information */}
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <Briefcase className="h-5 w-5 mr-2 text-green-600" />
          Información Contractual
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tipo de contrato</p>
            <p className="font-medium text-gray-800 capitalize">{data.tipoContrato || 'No disponible'}</p>
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

      {/* Medical Information */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
          Información Médica
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tipo de evento</p>
            <p className="font-medium text-gray-800">{data.tipoEvento || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Código CIE-10</p>
            <p className="font-medium text-gray-800">{data.cie10 || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Código de incapacidad</p>
            <p className="font-medium text-gray-800">{data.codigoIncap || 'No disponible'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Mes de diagnóstico</p>
            <p className="font-medium text-gray-800">{data.mesDiagnostico || 'No disponible'}</p>
          </div>
        </div>
      </div>

      {/* Incapacity Period */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-yellow-600" />
          Período de Incapacidad
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Fecha de inicio</p>
            <p className="font-medium text-gray-800">{formatShortDate(data.startDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de fin</p>
            <p className="font-medium text-gray-800">{formatShortDate(data.endDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Número de días</p>
            <p className="font-medium text-gray-800">{data.numDias || 0} días</p>
          </div>
        </div>
      </div>

      {/* Document Information */}
      {data.documentUrl && (
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-800 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-purple-600" />
            Documento Adjunto
          </h4>
          <div className="flex items-center justify-between">
            <p className="text-gray-700">{data.documentName || 'Documento médico'}</p>
            <button
              onClick={() => window.open(data.documentUrl, "_blank")}
              className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-200"
            >
              <Download className="mr-2 h-4 w-4" /> Ver documento
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 text-black">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-2 
        ${notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {notification.type === 'error' ? 
            <XCircle className="h-5 w-5" /> : 
            <CheckCircle className="h-5 w-5" />
          }
          <p>{notification.message}</p>
        </div>
      )}

      
      {loading ? (
        <div className="w-full flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-600">Cargando solicitudes...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 border rounded-xl bg-gray-50">
          <p className="text-gray-500">No hay solicitudes disponibles</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map((s) => (
            <RequestCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {!loading && (
        <div className="text-center mt-4">
          {requests.length > 3 && (
            <button
              onClick={() => setShowAll(true)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200 font-medium flex items-center justify-center mx-auto"
            >
              <List className="mr-2 h-4 w-4" />
              Ver todas las solicitudes ({requests.length})
            </button>
          )}
        </div>
      )}

      {/* All Requests Modal */}
      {showAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Todas las solicitudes</h2>
              <button 
                onClick={() => setShowAll(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Search */}
            <div className="mb-6 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            
            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 border rounded-xl bg-gray-50">
                <p className="text-gray-500">No se encontraron solicitudes</p>
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

      {/* Enhanced Details modal */}
      {showDetails && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-lg ${selected.avatarColor} flex items-center justify-center mr-3`}>
                  {typeIcon(selected.type)}
                </div>
                <h2 className="text-xl font-bold text-gray-800">{selected.title}</h2>
              </div>
              <button 
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center mb-2">
                <p className="text-gray-700 font-medium">{selected.employee}</p>
                <StatusTag status={selected.status} />
              </div>
              <p className="text-sm text-gray-600 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Enviada el {formatDate(selected.date)}
              </p>
            </div>
            
            {/* Show enhanced details for enfermedad type */}
            {isIncapacidadData(selected.rawData) ? (
              <EnfermedadDetails data={selected.rawData} />
            ) : (
              <>
                <div className="mb-6">
                  <h4 className="font-medium mb-2 text-gray-700">Descripción</h4>
                  <p className="bg-gray-50 p-3 rounded-lg text-gray-800">{selected.description || "No hay descripción disponible"}</p>
                </div>
                
                {selected.attachment && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-2 text-gray-700">Documento adjunto</h4>
                    <button
                      onClick={() => window.open(selected.attachment, "_blank")}
                      className="flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                    >
                      <Download className="mr-2 h-4 w-4" /> Ver documento
                    </button>
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Cerrar
              </button>
              
              {selected.status === "pendiente" && (
                <>
                  <button 
                    onClick={() => {
                      handleStatusUpdate(selected.id, "aprobado", selected.isPermiso);
                      setShowDetails(false);
                    }}
                    disabled={processingId === selected.id}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center transition-colors duration-200"
                  >
                    {processingId === selected.id ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-1.5" />
                    )}
                    Aprobar
                  </button>
                  
                  <button 
                    onClick={() => {
                      handleStatusUpdate(selected.id, "rechazado", selected.isPermiso);
                      setShowDetails(false);
                    }}
                    disabled={processingId === selected.id}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center transition-colors duration-200"
                  >
                    {processingId === selected.id ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-1.5" />
                    )}
                    Rechazar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}