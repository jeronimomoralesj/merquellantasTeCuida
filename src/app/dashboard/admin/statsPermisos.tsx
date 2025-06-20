"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  X,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Download,
  User
} from "lucide-react";
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

interface PermisosData {
  id: string;
  cedula: string;
  createdAt: any;
  description: string;
  documentName: string;
  documentUrl: string;
  estado: string;
  fecha: string;
  nombre: string;
  tiempoFin: string;
  tiempoInicio: string;
  tipo: string;
  userId: string;
}

interface MonthlyStats {
  [month: string]: {
    cantidad: number;
    totalHoras: number;
  };
}

interface EstadoStats {
  pendiente: number;
  aprobado: number;
  rechazado: number;
  total: number;
}

interface ApprovalStats {
  [month: string]: {
    aprobados: number;
    rechazados: number;
    pendientes: number;
    total: number;
    tasaAprobacion: number;
  };
}

interface StatsPermisosProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsPermisos({ isOpen, onClose }: StatsPermisosProps) {
  const [permisosData, setPermisosData] = useState<PermisosData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Statistics states
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({});
  const [estadoStats, setEstadoStats] = useState<EstadoStats>({
    pendiente: 0,
    aprobado: 0,
    rechazado: 0,
    total: 0
  });
  const [approvalRates, setApprovalRates] = useState<ApprovalStats>({});
  const [totalHoursRequested, setTotalHoursRequested] = useState(0);
  const [averageHoursPerRequest, setAverageHoursPerRequest] = useState(0);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getMonthName = (date: Date) => {
    return monthNames[date.getMonth()];
  };

  const calculateHours = (tiempoInicio: string, tiempoFin: string): number => {
    try {
      const [inicioHour, inicioMin] = tiempoInicio.split(':').map(Number);
      const [finHour, finMin] = tiempoFin.split(':').map(Number);
      
      const inicioMinutes = inicioHour * 60 + inicioMin;
      const finMinutes = finHour * 60 + finMin;
      
      let diffMinutes = finMinutes - inicioMinutes;
      
      // Handle case where end time is next day
      if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
      }
      
      return diffMinutes / 60; // Convert to hours
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 0;
    }
  };

  const fetchPermisosData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query solicitudes collection for tipo === 'permiso'
      const solicitudesQuery = query(
        collection(db, 'solicitudes'),
        where('tipo', '==', 'permiso')
      );
      
      const querySnapshot = await getDocs(solicitudesQuery);
      const data: PermisosData[] = [];

      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({
          id: doc.id,
          ...docData
        } as PermisosData);
      });

      setPermisosData(data);
      calculateStatistics(data);
    } catch (err) {
      console.error('Error fetching permisos data:', err);
      setError('Error al cargar los datos de permisos');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data: PermisosData[]) => {
    // 1. Monthly stats
    const monthlyStatsData: MonthlyStats = {};
    
    // 2. Status stats
    const estadoStatsData: EstadoStats = {
      pendiente: 0,
      aprobado: 0,
      rechazado: 0,
      total: data.length
    };
    
    // 3. Approval rates per month
    const approvalStatsData: ApprovalStats = {};

    // 4. Total hours and average
    let totalHoras = 0;

    data.forEach((item) => {
      const createdDate = item.createdAt?.toDate() || new Date();
      const monthName = getMonthName(createdDate);
      const estado = item.estado?.toLowerCase() || 'pendiente';
      const horas = calculateHours(item.tiempoInicio || '00:00', item.tiempoFin || '00:00');

      // Monthly stats
      if (!monthlyStatsData[monthName]) {
        monthlyStatsData[monthName] = {
          cantidad: 0,
          totalHoras: 0
        };
      }
      monthlyStatsData[monthName].cantidad += 1;
      monthlyStatsData[monthName].totalHoras += horas;

      // Status stats
      if (estado === 'aprobado') {
        estadoStatsData.aprobado += 1;
      } else if (estado === 'rechazado') {
        estadoStatsData.rechazado += 1;
      } else {
        estadoStatsData.pendiente += 1;
      }

      // Approval rates per month
      if (!approvalStatsData[monthName]) {
        approvalStatsData[monthName] = {
          aprobados: 0,
          rechazados: 0,
          pendientes: 0,
          total: 0,
          tasaAprobacion: 0
        };
      }
      
      approvalStatsData[monthName].total += 1;
      
      if (estado === 'aprobado') {
        approvalStatsData[monthName].aprobados += 1;
      } else if (estado === 'rechazado') {
        approvalStatsData[monthName].rechazados += 1;
      } else {
        approvalStatsData[monthName].pendientes += 1;
      }
      
      // Calculate approval rate (excluding pending)
      const decidedCases = approvalStatsData[monthName].aprobados + approvalStatsData[monthName].rechazados;
      approvalStatsData[monthName].tasaAprobacion = decidedCases > 0 
        ? (approvalStatsData[monthName].aprobados / decidedCases) * 100
        : 0;

      // Total hours
      totalHoras += horas;
    });

    setMonthlyStats(monthlyStatsData);
    setEstadoStats(estadoStatsData);
    setApprovalRates(approvalStatsData);
    setTotalHoursRequested(totalHoras);
    setAverageHoursPerRequest(data.length > 0 ? totalHoras / data.length : 0);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Estadísticas de Permisos</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>🕐 Estadísticas de Permisos</h1>
          <div class="summary">
            <p><strong>Total de solicitudes:</strong> ${permisosData.length}</p>
            <p><strong>Total de horas solicitadas:</strong> ${totalHoursRequested.toFixed(1)}</p>
            <p><strong>Promedio de horas por solicitud:</strong> ${averageHoursPerRequest.toFixed(1)}</p>
            <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
          </div>

          <h2>📊 Resumen por Estado</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>✅ Aprobadas</h3>
              <p style="font-size: 24px; font-weight: bold; color: #10b981;">${estadoStats.aprobado}</p>
            </div>
            <div class="stat-card">
              <h3>❌ Rechazadas</h3>
              <p style="font-size: 24px; font-weight: bold; color: #ef4444;">${estadoStats.rechazado}</p>
            </div>
            <div class="stat-card">
              <h3>⏳ Pendientes</h3>
              <p style="font-size: 24px; font-weight: bold; color: #f59e0b;">${estadoStats.pendiente}</p>
            </div>
          </div>

          <h2>📅 Estadísticas Mensuales</h2>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Cantidad de Solicitudes</th>
                <th>Total de Horas</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(monthlyStats).map(([month, stats]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  <td>${stats.cantidad}</td>
                  <td>${stats.totalHoras.toFixed(1)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>✅ Tasa de Aprobación por Mes</h2>
          <table>
            <thead>
              <tr><th>Mes</th><th>Aprobadas</th><th>Rechazadas</th><th>Pendientes</th><th>Total</th><th>Tasa de Aprobación</th></tr>
            </thead>
            <tbody>
              ${Object.entries(approvalRates).map(([month, stats]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  <td style="color: #10b981;">${stats.aprobados}</td>
                  <td style="color: #ef4444;">${stats.rechazados}</td>
                  <td style="color: #f59e0b;">${stats.pendientes}</td>
                  <td>${stats.total}</td>
                  <td>${stats.tasaAprobacion.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load then print
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
      fetchPermisosData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center">
            <Clock className="h-6 w-6 mr-3 text-purple-500" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estadísticas de Permisos</h2>
              <p className="text-sm text-gray-600 mt-1">
                Total de solicitudes: {permisosData.length} | Horas solicitadas: {totalHoursRequested.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToPDF}
              disabled={exporting || loading}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
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
              <span className="ml-3 text-gray-600">Cargando estadísticas...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <span className="ml-3 text-red-600">{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Aprobadas</p>
                      <p className="text-2xl font-bold text-green-700">{estadoStats.aprobado}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center">
                    <XCircle className="h-8 w-8 text-red-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-600">Rechazadas</p>
                      <p className="text-2xl font-bold text-red-700">{estadoStats.rechazado}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-yellow-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-600">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-700">{estadoStats.pendiente}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-600">Promedio horas</p>
                      <p className="text-2xl font-bold text-purple-700">{averageHoursPerRequest.toFixed(1)}</p>
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
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Solicitudes</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Total Horas</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Promedio Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlyStats).map(([month, stats]) => (
                        <tr key={month} className="border-b border-gray-100 hover:bg-white">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-900">{month}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">{stats.cantidad}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">{stats.totalHoras.toFixed(1)}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">
                            {stats.cantidad > 0 ? (stats.totalHoras / stats.cantidad).toFixed(1) : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval rates */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tasa de Aprobación por Mes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Mes</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Aprobadas</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Rechazadas</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Pendientes</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Total</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Tasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(approvalRates).map(([month, stats]) => (
                        <tr key={month} className="border-b border-gray-100 hover:bg-white">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-900">{month}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className="flex items-center">
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-green-500" />
                              <span className="text-green-600 font-medium">{stats.aprobados}</span>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className="flex items-center">
                              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-red-500" />
                              <span className="text-red-600 font-medium">{stats.rechazados}</span>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-yellow-500" />
                              <span className="text-yellow-600 font-medium">{stats.pendientes}</span>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600">{stats.total}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <div className="flex items-center">
                              <div className="w-8 sm:w-12 h-2 bg-gray-200 rounded-full mr-2">
                                <div 
                                  className="h-2 bg-green-500 rounded-full transition-all duration-300" 
                                  style={{ width: `${stats.tasaAprobacion}%` }}
                                ></div>
                              </div>
                              <span className="text-xs sm:text-sm font-medium text-gray-700">
                                {stats.tasaAprobacion.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}