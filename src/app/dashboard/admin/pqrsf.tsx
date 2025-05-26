"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
  X,
  User,
  Calendar,
  FileText,
  Users
} from "lucide-react";
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

interface PQRSF {
  id: string;
  cedula?: string;
  createdAt: {
    toDate: () => Date;
    toMillis: () => number;
  };
  isAnonymous: boolean;
  message: string;
  nombre?: string;
  type: string;
  userId: string;
}

export default function PQRSFCard() {
  const [pqrsfList, setPqrsfList] = useState<PQRSF[]>([]);
  const [allPqrsfList, setAllPqrsfList] = useState<PQRSF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Function to get avatar initials from name
  const getAvatarInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Function to get random avatar color
  const getAvatarColor = (index: number) => {
    const colors = [
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600", 
      "bg-purple-100 text-purple-600",
      "bg-pink-100 text-pink-600",
      "bg-yellow-100 text-yellow-600",
      "bg-indigo-100 text-indigo-600",
      "bg-red-100 text-red-600",
      "bg-orange-100 text-orange-600"
    ];
    return colors[index % colors.length];
  };

  // Function to get type color
  const getTypeColor = (type: string) => {
    const colors = {
      'Pregunta': 'bg-blue-100 text-blue-800',
      'Queja': 'bg-red-100 text-red-800',
      'Reclamo': 'bg-orange-100 text-orange-800',
      'Sugerencia': 'bg-green-100 text-green-800',
      'Felicitación': 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Function to format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Fetch last 5 PQRSF entries
  const fetchRecentPQRSF = async () => {
    try {
      setLoading(true);
      setError(null);

      const pqrsfQuery = query(
        collection(db, 'pqrsf'), 
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      const pqrsfSnapshot = await getDocs(pqrsfQuery);
      
      const pqrsfData: PQRSF[] = [];
      pqrsfSnapshot.forEach((doc) => {
        const data = doc.data();
        pqrsfData.push({
          id: doc.id,
          cedula: data.cedula,
          createdAt: data.createdAt,
          isAnonymous: data.isAnonymous || false,
          message: data.message || '',
          nombre: data.nombre,
          type: data.type || 'Sin tipo',
          userId: data.userId || ''
        });
      });

      setPqrsfList(pqrsfData);
    } catch (err) {
      console.error('Error fetching PQRSF:', err);
      setError('Error al cargar los datos de PQRSF');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all PQRSF entries
  const fetchAllPQRSF = async () => {
    try {
      setModalLoading(true);

      const pqrsfQuery = query(
        collection(db, 'pqrsf'), 
        orderBy('createdAt', 'desc')
      );
      
      const pqrsfSnapshot = await getDocs(pqrsfQuery);
      
      const pqrsfData: PQRSF[] = [];
      pqrsfSnapshot.forEach((doc) => {
        const data = doc.data();
        pqrsfData.push({
          id: doc.id,
          cedula: data.cedula,
          createdAt: data.createdAt,
          isAnonymous: data.isAnonymous || false,
          message: data.message || '',
          nombre: data.nombre,
          type: data.type || 'Sin tipo',
          userId: data.userId || ''
        });
      });

      setAllPqrsfList(pqrsfData);
    } catch (err) {
      console.error('Error fetching all PQRSF:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Handle view all
  const handleViewAll = async () => {
    setShowModal(true);
    await fetchAllPQRSF();
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchRecentPQRSF();
  }, []);

  // Refresh data function
  const handleRefresh = () => {
    fetchRecentPQRSF();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
            PQRSF Recientes
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando PQRSF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
            PQRSF Recientes
          </h2>
          <button 
            onClick={handleRefresh}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            <Clock className="h-4 w-4 mr-1" />
            Actualizar
          </button>
        </div>
        <div className="flex items-center justify-center py-8">
          <AlertCircle className="h-6 w-6 text-red-400" />
          <span className="ml-2 text-red-500">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
            PQRSF Recientes ({pqrsfList.length})
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={handleViewAll}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Eye className="h-4 w-4 mr-1" />
              Ver todos
            </button>
            <button 
              onClick={handleRefresh}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
            >
              <Clock className="h-4 w-4 mr-1" />
              Actualizar
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {pqrsfList.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay PQRSF registrados.</p>
            </div>
          ) : (
            pqrsfList.map((pqrsf, index) => (
              <div
                key={pqrsf.id}
                className="flex items-start p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-blue-200 hover:shadow-sm"
              >
                <div className={`w-10 h-10 rounded-full overflow-hidden ${getAvatarColor(index)} flex items-center justify-center font-medium flex-shrink-0`}>
                  {pqrsf.isAnonymous || !pqrsf.nombre ? 
                    <User className="h-5 w-5" /> : 
                    getAvatarInitials(pqrsf.nombre)
                  }
                </div>
                <div className="flex-1 ml-3 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {pqrsf.isAnonymous || !pqrsf.nombre ? 'Anónimo' : pqrsf.nombre}
                    </h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(pqrsf.type)}`}>
                      {pqrsf.type}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {pqrsf.message}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(pqrsf.createdAt.toDate())}
                    </div>
                    {pqrsf.cedula && (
                      <div className="flex items-center">
                        <FileText className="h-3 w-3 mr-1" />
                        {pqrsf.cedula}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for all PQRSF */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Users className="h-6 w-6 mr-2 text-blue-500" />
                Todos los PQRSF ({allPqrsfList.length})
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-3 text-gray-500">Cargando todos los PQRSF...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {allPqrsfList.map((pqrsf, index) => (
                    <div
                      key={pqrsf.id}
                      className="flex items-start p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                      <div className={`w-10 h-10 rounded-full overflow-hidden ${getAvatarColor(index)} flex items-center justify-center font-medium flex-shrink-0`}>
                        {pqrsf.isAnonymous || !pqrsf.nombre ? 
                          <User className="h-5 w-5" /> : 
                          getAvatarInitials(pqrsf.nombre)
                        }
                      </div>
                      <div className="flex-1 ml-3 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {pqrsf.isAnonymous || !pqrsf.nombre ? 'Anónimo' : pqrsf.nombre}
                          </h4>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(pqrsf.type)}`}>
                            {pqrsf.type}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {pqrsf.message}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 space-x-4">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(pqrsf.createdAt.toDate())}
                          </div>
                          {pqrsf.cedula && (
                            <div className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {pqrsf.cedula}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}