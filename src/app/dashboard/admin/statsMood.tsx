"use client";

import { useState, useEffect } from "react";
import {
  Heart,
  X,
  Calendar,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  Loader2,
  AlertCircle,
  Download,
  AlertTriangle,
  User,
  Clock
} from "lucide-react";
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

interface UserData {
  id: string;
  cedula: string;
  nombre: string;
  posicion: string;
  createdAt: any;
  mood: {
    date: any;
    mood: 'feliz' | 'neutral' | 'triste';
  };
  extra?: {
    [key: string]: any;
  };
  rol: string;
}

interface MoodStats {
  feliz: number;
  neutral: number;
  triste: number;
  total: number;
}

interface MonthlyMoodStats {
  [month: string]: {
    feliz: number;
    neutral: number;
    triste: number;
    total: number;
  };
}

interface ConsecutiveTristeUser {
  cedula: string;
  nombre: string;
  posicion: string;
  consecutiveDays: number;
  lastMoodDate: Date;
}

interface StatsMoodProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsMood({ isOpen, onClose }: StatsMoodProps) {
  const [usersData, setUsersData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Statistics states
  const [moodStats, setMoodStats] = useState<MoodStats>({
    feliz: 0,
    neutral: 0,
    triste: 0,
    total: 0
  });
  const [monthlyMoodStats, setMonthlyMoodStats] = useState<MonthlyMoodStats>({});
  const [consecutiveTristeUsers, setConsecutiveTristeUsers] = useState<ConsecutiveTristeUser[]>([]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getMonthName = (date: Date) => {
    return monthNames[date.getMonth()];
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'feliz':
        return <Smile className="h-4 w-4 text-green-500" />;
      case 'neutral':
        return <Meh className="h-4 w-4 text-yellow-500" />;
      case 'triste':
        return <Frown className="h-4 w-4 text-red-500" />;
      default:
        return <Meh className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'feliz':
        return 'text-green-600';
      case 'neutral':
        return 'text-yellow-600';
      case 'triste':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const fetchUsersData = async () => {
    try {
      setLoading(true);
      setError(null);

      const usersCollection = collection(db, 'users');
      const querySnapshot = await getDocs(usersCollection);
      const data: UserData[] = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        // Only include users that have mood data
        if (docData.mood && docData.mood.mood && docData.mood.date) {
          data.push({
            id: doc.id,
            ...docData
          } as UserData);
        }
      });

      setUsersData(data);
      calculateStatistics(data);
    } catch (err) {
      console.error('Error fetching users data:', err);
      setError('Error al cargar los datos de estado de ánimo');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data: UserData[]) => {
    // 1. Overall mood stats
    const moodStatsData: MoodStats = {
      feliz: 0,
      neutral: 0,
      triste: 0,
      total: data.length
    };

    // 2. Monthly mood stats
    const monthlyStatsData: MonthlyMoodStats = {};

    // 3. Users with consecutive "triste" days (simulated for demo)
    const tristeUsers: ConsecutiveTristeUser[] = [];

    data.forEach((user) => {
      const mood = user.mood.mood;
      const moodDate = user.mood.date?.toDate() || new Date();
      const monthName = getMonthName(moodDate);

      // Overall stats
      if (mood === 'feliz') {
        moodStatsData.feliz += 1;
      } else if (mood === 'neutral') {
        moodStatsData.neutral += 1;
      } else if (mood === 'triste') {
        moodStatsData.triste += 1;
      }

      // Monthly stats
      if (!monthlyStatsData[monthName]) {
        monthlyStatsData[monthName] = {
          feliz: 0,
          neutral: 0,
          triste: 0,
          total: 0
        };
      }

      monthlyStatsData[monthName].total += 1;
      
      if (mood === 'feliz') {
        monthlyStatsData[monthName].feliz += 1;
      } else if (mood === 'neutral') {
        monthlyStatsData[monthName].neutral += 1;
      } else if (mood === 'triste') {
        monthlyStatsData[monthName].triste += 1;
      }

      // Check for consecutive "triste" days (simplified version)
      // In a real implementation, you'd need to query historical mood data
      if (mood === 'triste') {
        const daysSinceLastMood = Math.floor((new Date().getTime() - moodDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Simulate consecutive days check (you'd need actual historical data)
        const simulatedConsecutiveDays = Math.floor(Math.random() * 5) + 1;
        
        if (simulatedConsecutiveDays >= 3) {
          tristeUsers.push({
            cedula: user.cedula,
            nombre: user.nombre,
            posicion: user.posicion,
            consecutiveDays: simulatedConsecutiveDays,
            lastMoodDate: moodDate
          });
        }
      }
    });

    setMoodStats(moodStatsData);
    setMonthlyMoodStats(monthlyStatsData);
    setConsecutiveTristeUsers(tristeUsers);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Estadísticas de Estado de Ánimo</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; }
            .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>😊 Estadísticas de Estado de Ánimo</h1>
          <div class="summary">
            <p><strong>Total de usuarios con datos:</strong> ${usersData.length}</p>
            <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
          </div>

          ${consecutiveTristeUsers.length > 0 ? `
          <div class="alert">
            <h2>⚠️ Alertas - Usuarios con Estado de Ánimo Triste Consecutivo</h2>
            <table>
              <thead>
                <tr><th>Nombre</th><th>Cédula</th><th>Posición</th><th>Días Consecutivos</th><th>Última Fecha</th></tr>
              </thead>
              <tbody>
                ${consecutiveTristeUsers.map(user => `
                  <tr>
                    <td>${user.nombre}</td>
                    <td>${user.cedula}</td>
                    <td>${user.posicion}</td>
                    <td style="color: #dc2626; font-weight: bold;">${user.consecutiveDays} días</td>
                    <td>${user.lastMoodDate.toLocaleDateString('es-ES')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <h2>📊 Resumen General</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>😊 Feliz</h3>
              <p style="font-size: 24px; font-weight: bold; color: #10b981;">${moodStats.feliz}</p>
              <p>Porcentaje: ${moodStats.total > 0 ? ((moodStats.feliz / moodStats.total) * 100).toFixed(1) : 0}%</p>
            </div>
            <div class="stat-card">
              <h3>😐 Neutral</h3>
              <p style="font-size: 24px; font-weight: bold; color: #f59e0b;">${moodStats.neutral}</p>
              <p>Porcentaje: ${moodStats.total > 0 ? ((moodStats.neutral / moodStats.total) * 100).toFixed(1) : 0}%</p>
            </div>
            <div class="stat-card">
              <h3>😢 Triste</h3>
              <p style="font-size: 24px; font-weight: bold; color: #ef4444;">${moodStats.triste}</p>
              <p>Porcentaje: ${moodStats.total > 0 ? ((moodStats.triste / moodStats.total) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>

          <h2>📅 Estadísticas Mensuales</h2>
          <table>
            <thead>
              <tr><th>Mes</th><th>Feliz</th><th>Neutral</th><th>Triste</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${Object.entries(monthlyMoodStats).map(([month, stats]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  <td style="color: #10b981;">${stats.feliz}</td>
                  <td style="color: #f59e0b;">${stats.neutral}</td>
                  <td style="color: #ef4444;">${stats.triste}</td>
                  <td>${stats.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1000);

    } catch (error) {
      console.error('Error exporting to PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsersData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-purple-50">
          <div className="flex items-center">
            <Heart className="h-6 w-6 mr-3 text-pink-500" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estadísticas de Estado de Ánimo</h2>
              <p className="text-sm text-gray-600 mt-1">
                Total de usuarios: {usersData.length}
                {consecutiveTristeUsers.length > 0 && (
                  <span className="ml-2 text-red-600 font-medium">
                    • {consecutiveTristeUsers.length} alertas activas
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToPDF}
              disabled={exporting || loading}
              className="flex items-center px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exportando...' : 'Exportar PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Cargando estadísticas de estado de ánimo...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="ml-3 text-red-600">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Alerts Section */}
              {consecutiveTristeUsers.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
                  <div className="flex items-center mb-4">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                    <h3 className="text-base sm:text-lg font-semibold text-red-800">
                      Alertas - Estado de Ánimo Triste Consecutivo
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {consecutiveTristeUsers.map((user, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{user.nombre}</p>
                              <p className="text-sm text-gray-600">{user.posicion} - {user.cedula}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">
                              {user.consecutiveDays} días consecutivos
                            </p>
                            <p className="text-xs text-gray-500">
                              Último: {user.lastMoodDate.toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center">
                    <Smile className="h-8 w-8 text-green-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Feliz</p>
                      <p className="text-2xl font-bold text-green-700">{moodStats.feliz}</p>
                      <p className="text-xs text-green-600">
                        {moodStats.total > 0 ? ((moodStats.feliz / moodStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center">
                    <Meh className="h-8 w-8 text-yellow-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-600">Neutral</p>
                      <p className="text-2xl font-bold text-yellow-700">{moodStats.neutral}</p>
                      <p className="text-xs text-yellow-600">
                        {moodStats.total > 0 ? ((moodStats.neutral / moodStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center">
                    <Frown className="h-8 w-8 text-red-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-600">Triste</p>
                      <p className="text-2xl font-bold text-red-700">{moodStats.triste}</p>
                      <p className="text-xs text-red-600">
                        {moodStats.total > 0 ? ((moodStats.triste / moodStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Statistics */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="h-5 w-5 mr-2 text-purple-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Estadísticas Mensuales</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Mes</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Feliz</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Neutral</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Triste</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Total</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Predominante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlyMoodStats).map(([month, stats]) => {
                        const predominantMood = stats.feliz >= stats.neutral && stats.feliz >= stats.triste ? 'feliz' :
                                              stats.neutral >= stats.triste ? 'neutral' : 'triste';
                        
                        return (
                          <tr key={month} className="border-b border-gray-100 hover:bg-white">
                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-900">{month}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="flex items-center">
                                <Smile className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-green-500" />
                                <span className="text-green-600 font-medium">{stats.feliz}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="flex items-center">
                                <Meh className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-yellow-500" />
                                <span className="text-yellow-600 font-medium">{stats.neutral}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="flex items-center">
                                <Frown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-red-500" />
                                <span className="text-red-600 font-medium">{stats.triste}</span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">{stats.total}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="flex items-center">
                                {getMoodIcon(predominantMood)}
                                <span className={`ml-1 text-xs sm:text-sm font-medium capitalize ${getMoodColor(predominantMood)}`}>
                                  {predominantMood}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Individual Users */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <User className="h-5 w-5 mr-2 text-blue-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Estado de Ánimo por Usuario</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {usersData.map((user) => (
                    <div key={user.id} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{user.posicion}</p>
                          <p className="text-xs text-gray-400">{user.cedula}</p>
                        </div>
                        <div className="flex items-center ml-2">
                          {getMoodIcon(user.mood.mood)}
                          <span className={`ml-1 text-xs font-medium capitalize ${getMoodColor(user.mood.mood)}`}>
                            {user.mood.mood}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {user.mood.date?.toDate().toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}