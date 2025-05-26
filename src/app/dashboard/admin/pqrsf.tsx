"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  MessageSquare,
  Clock,
  User,
  Loader2,
  FileText,
  Calendar,
} from "lucide-react";
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

interface PQRSFEntry {
  id: string;
  cedula?: string;
  createdAt: {
    toMillis: () => number;
    toDate: () => Date;
  };
  isAnonymous: boolean;
  message: string;
  nombre?: string;
  type: string;
  userId?: string;
}

export default function PQRSFCard() {
  const [pqrsfEntries, setPqrsfEntries] = useState<PQRSFEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to get avatar initials from name
  const getAvatarInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Function to get random avatar color based on type
  const getAvatarColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'Pregunta': "bg-blue-100 text-blue-600",
      'Queja': "bg-red-100 text-red-600",
      'Reclamo': "bg-orange-100 text-orange-600",
      'Sugerencia': "bg-green-100 text-green-600",
      'Felicitacion': "bg-purple-100 text-purple-600",
    };
    return colorMap[type] || "bg-gray-100 text-gray-600";
  };

  // Function to get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Pregunta':
        return MessageSquare;
      case 'Queja':
      case 'Reclamo':
        return AlertCircle;
      case 'Sugerencia':
        return FileText;
      case 'Felicitacion':
        return User;
      default:
        return MessageSquare;
    }
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

  // Function to truncate message
  const truncateMessage = (message: string, maxLength: number = 100) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  // Fetch PQRSF entries
  const fetchPQRSFEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all PQRSF entries from the 'pqrsf' collection, ordered by creation date (newest first)
      const pqrsfQuery = query(
        collection(db, 'pqrsf'),
        orderBy('createdAt', 'desc')
      );
      const pqrsfSnapshot = await getDocs(pqrsfQuery);
      
      const entries: PQRSFEntry[] = [];

      pqrsfSnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          cedula: data.cedula,
          createdAt: data.createdAt,
          isAnonymous: data.isAnonymous || false,
          message: data.message || '',
          nombre: data.nombre,
          type: data.type || 'Pregunta',
          userId: data.userId
        });
      });

      setPqrsfEntries(entries);
    } catch (err) {
      console.error('Error fetching PQRSF entries:', err);
      setError('Error al cargar los datos de PQRSF');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchPQRSFEntries();
  }, []);

  // Refresh data function
  const handleRefresh = () => {
    fetchPQRSFEntries();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
            PQRSF
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
            PQRSF
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
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
          PQRSF ({pqrsfEntries.length})
        </h2>
        <button 
          onClick={handleRefresh}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
        >
          <Clock className="h-4 w-4 mr-1" />
          Actualizar
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {pqrsfEntries.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No hay entradas de PQRSF registradas.</p>
          </div>
        ) : (
          pqrsfEntries.map((entry) => {
            const TypeIcon = getTypeIcon(entry.type);
            const displayName = entry.isAnonymous || !entry.nombre ? 'Anónimo' : entry.nombre;
            const displayCedula = entry.isAnonymous || !entry.cedula ? '' : entry.cedula;
            
            return (
              <div
                key={entry.id}
                className="flex items-start p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-blue-200 hover:shadow-sm"
              >
                <div className={`w-10 h-10 rounded-full overflow-hidden ${getAvatarColor(entry.type)} flex items-center justify-center font-medium flex-shrink-0`}>
                  {entry.isAnonymous || !entry.nombre ? (
                    <User className="h-5 w-5" />
                  ) : (
                    getAvatarInitials(entry.nombre)
                  )}
                </div>
                
                <div className="flex-1 ml-3 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {displayName}
                    </h3>
                    <div className={`px-2 py-1 flex items-center rounded-full text-xs font-medium ${getAvatarColor(entry.type)}`}>
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {entry.type}
                    </div>
                  </div>
                  
                  {displayCedula && (
                    <p className="text-xs text-gray-500 mb-1">
                      Cédula: {displayCedula}
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                    {truncateMessage(entry.message)}
                  </p>
                  
                  <div className="flex items-center text-xs text-gray-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(entry.createdAt.toDate())}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}