"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Frown,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

export default function TristesCard() {
  const [trabajadoresTriste, setTrabajadoresTriste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to check if a user has 3 consecutive "triste" moods
const hasConsecutiveSadMoods = (moodHistory: any[], consecutiveCount = 3) => {
    if (!moodHistory || moodHistory.length < consecutiveCount) {
      return { hasConsecutive: false, count: 0 };
    }

    // Sort by date descending (most recent first)
    const sortedMoods = moodHistory.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    
    let consecutiveSadCount = 0;
    
    for (let i = 0; i < sortedMoods.length; i++) {
      if (sortedMoods[i].mood === 'triste') {
        consecutiveSadCount++;
        if (consecutiveSadCount >= consecutiveCount) {
          return { hasConsecutive: true, count: consecutiveSadCount };
        }
      } else {
        // If we hit a non-sad mood, reset the counter
        break;
      }
    }
    
    return { hasConsecutive: false, count: consecutiveSadCount };
  };

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

  // Fetch users with consecutive sad moods
  const fetchSadWorkers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all users from the 'users' collection
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const sadWorkers = [];

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;
        
        // Check if user has mood history
        if (userData.moodHistory && Array.isArray(userData.moodHistory)) {
          const { hasConsecutive, count } = hasConsecutiveSadMoods(userData.moodHistory);
          
          if (hasConsecutive) {
            sadWorkers.push({
              id: userId,
              name: userData.nombre || userData.name || 'Usuario Sin Nombre',
              position: userData.position || userData.cargo || 'Sin Cargo',
              department: userData.department || userData.departamento || 'Sin Departamento',
              consecutiveSadDays: count,
              avatar: getAvatarInitials(userData.nombre || userData.name || 'NN'),
              avatarColor: getAvatarColor(sadWorkers.length),
              email: userData.email || '',
              lastMoodDate: userData.moodHistory[0]?.date?.toDate() || new Date()
            });
          }
        }
        // Fallback: check single mood entry (for backward compatibility)
        else if (userData.mood && userData.mood.mood === 'triste') {
          // If only single mood entry, we can't determine consecutive days
          // but we can still flag users who are currently sad
          sadWorkers.push({
            id: userId,
            name: userData.nombre || userData.name || 'Usuario Sin Nombre',
            position: userData.position || userData.cargo || 'Sin Cargo',
            department: userData.department || userData.departamento || 'Sin Departamento',
            consecutiveSadDays: 1, // We only know they're currently sad
            avatar: getAvatarInitials(userData.nombre || userData.name || 'NN'),
            avatarColor: getAvatarColor(sadWorkers.length),
            email: userData.email || '',
            lastMoodDate: userData.mood.date?.toDate() || new Date()
          });
        }
      });

      // Sort by consecutive sad days (highest first)
      sadWorkers.sort((a, b) => b.consecutiveSadDays - a.consecutiveSadDays);

      setTrabajadoresTriste(sadWorkers);
    } catch (err) {
      console.error('Error fetching sad workers:', err);
      setError('Error al cargar los datos de trabajadores');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchSadWorkers();
  }, []);

  // Refresh data function
  const handleRefresh = () => {
    fetchSadWorkers();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Frown className="h-5 w-5 mr-2 text-red-500" />
            Trabajadores Tristes
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando trabajadores...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <Frown className="h-5 w-5 mr-2 text-red-500" />
            Trabajadores Tristes
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
      <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Frown className="h-5 w-5 mr-2 text-red-500" />
          Trabajadores Tristes ({trabajadoresTriste.length})
        </h2>
        <button 
          onClick={handleRefresh}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
        >
          <Clock className="h-4 w-4 mr-1" />
          Actualizar
        </button>
      </div>

      <div className="space-y-4">
        {trabajadoresTriste.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500">No hay trabajadores con estados de ánimo consecutivamente tristes.</p>
          </div>
        ) : (
          trabajadoresTriste.map((trabajador) => (
            <div
              key={trabajador.id}
              className="flex items-center p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-red-200 hover:shadow-sm"
            >
              <div className={`w-10 h-10 rounded-full overflow-hidden ${trabajador.avatarColor} flex items-center justify-center font-medium`}>
                {trabajador.avatar}
              </div>
              <div className="flex-1 ml-3">
                <h3 className="font-medium text-gray-900">
                  {trabajador.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {trabajador.position} · {trabajador.department}
                </p>
                {trabajador.email && (
                  <p className="text-xs text-gray-400">
                    {trabajador.email}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <div className="px-3 py-1 flex items-center rounded-full bg-red-100 text-sm font-medium text-red-800">
                  <Frown className="h-3.5 w-3.5 mr-1.5" />
                  {trabajador.consecutiveSadDays} día{trabajador.consecutiveSadDays !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}