"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  X,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Download
} from "lucide-react";
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed

interface IncapacidadData {
  id: string;
  cargo: string;
  cedula: string;
  cie10: string;
  codigoIncap: string;
  createdAt?: Timestamp;
  edad: string;
  endDate: string;
  estado: string;
  gender: string;
  mesDiagnostico: string;
  nombre: string;
  numDias: number;
  startDate: string;
  tipo: string;
  tipoContrato: string;
  tipoEvento: string;
  ubicacion: string;
}

interface MonthlyStats {
  [month: string]: {
    [tipoEvento: string]: number;
  };
}

interface DaysStats {
  [tipoEvento: string]: number;
}

interface CIE10Stats {
  [month: string]: {
    [cie10: string]: number;
  };
}

interface ApprovalStats {
  [month: string]: {
    aprobados: number;
    rechazados: number;
    total: number;
    tasaAprobacion: number;
  };
}

interface StatsIncapacidadProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsIncapacidad({ isOpen, onClose }: StatsIncapacidadProps) {
  const [incapacidadData, setIncapacidadData] = useState<IncapacidadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Statistics states
  const [monthlyAmounts, setMonthlyAmounts] = useState<MonthlyStats>({});
  const [daysPerType, setDaysPerType] = useState<DaysStats>({});
  const [cie10PerMonth, setCie10PerMonth] = useState<CIE10Stats>({});
  const [approvalRates, setApprovalRates] = useState<ApprovalStats>({});

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getMonthName = (date: Date) => {
    return monthNames[date.getMonth()];
  };

const fetchIncapacidadData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    const solicitudesQuery = query(
      collection(db, 'solicitudes'),
      where('tipo', '==', 'incapacidad')
    );
    
    const querySnapshot = await getDocs(solicitudesQuery);
    const data: IncapacidadData[] = [];

    querySnapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        id: doc.id,
        ...docData,
      } as IncapacidadData);
    });

    setIncapacidadData(data);
    calculateStatistics(data);
  } catch (err) {
    console.error('Error fetching incapacidad data:', err);
    setError('Error al cargar los datos de incapacidad');
  } finally {
    setLoading(false);
  }
}, []);


  const calculateStatistics = (data: IncapacidadData[]) => {
    // 1. Monthly amounts per tipoEvento
    const monthlyStats: MonthlyStats = {};
    
    // 2. Total days per tipoEvento
    const daysStats: DaysStats = {};
    
    // 3. CIE10 per month
    const cie10Stats: CIE10Stats = {};
    
    // 4. Approval rates per month
    const approvalStats: ApprovalStats = {};

    data.forEach((item) => {
      const createdDate = item.createdAt?.toDate() || new Date();
      const monthName = getMonthName(createdDate);
      const tipoEvento = item.tipoEvento || 'Sin especificar';
      const cie10 = item.cie10 || 'Sin CIE10';
      const estado = item.estado?.toLowerCase() || '';

      // Monthly amounts per tipoEvento
      if (!monthlyStats[monthName]) {
        monthlyStats[monthName] = {};
      }
      monthlyStats[monthName][tipoEvento] = (monthlyStats[monthName][tipoEvento] || 0) + 1;

      // Days per tipoEvento
      daysStats[tipoEvento] = (daysStats[tipoEvento] || 0) + (item.numDias || 0);

      // CIE10 per month
      if (!cie10Stats[monthName]) {
        cie10Stats[monthName] = {};
      }
      cie10Stats[monthName][cie10] = (cie10Stats[monthName][cie10] || 0) + 1;

      // Approval rates per month
      if (!approvalStats[monthName]) {
        approvalStats[monthName] = {
          aprobados: 0,
          rechazados: 0,
          total: 0,
          tasaAprobacion: 0
        };
      }
      
      approvalStats[monthName].total += 1;
      
      if (estado === 'aprobado') {
        approvalStats[monthName].aprobados += 1;
      } else if (estado === 'rechazado') {
        approvalStats[monthName].rechazados += 1;
      }
      
      // Calculate approval rate
      approvalStats[monthName].tasaAprobacion = 
        (approvalStats[monthName].aprobados / approvalStats[monthName].total) * 100;
    });

    setMonthlyAmounts(monthlyStats);
    setDaysPerType(daysStats);
    setCie10PerMonth(cie10Stats);
    setApprovalRates(approvalStats);
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
          <title>Estadísticas de Incapacidad</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
            .approval-bar { height: 10px; background-color: #e0e0e0; border-radius: 5px; overflow: hidden; }
            .approval-fill { height: 100%; background-color: #10b981; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>📊 Estadísticas de Incapacidad</h1>
          <div class="summary">
            <p><strong>Total de registros:</strong> ${incapacidadData.length}</p>
            <p><strong>Fecha de generación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
          </div>

          <h2>📅 Cantidad por Mes y Tipo de Evento</h2>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                ${Object.values(monthlyAmounts).reduce((types, monthData) => {
                  Object.keys(monthData).forEach(type => {
                    if (!types.includes(type)) types.push(type);
                  });
                  return types;
                }, [] as string[]).map(tipo => `<th>${tipo}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(monthlyAmounts).map(([month, data]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  ${Object.values(monthlyAmounts).reduce((types, monthData) => {
                    Object.keys(monthData).forEach(type => {
                      if (!types.includes(type)) types.push(type);
                    });
                    return types;
                  }, [] as string[]).map(tipo => `<td>${data[tipo] || 0}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>📈 Total de Días por Tipo de Evento</h2>
          <table>
            <thead>
              <tr><th>Tipo de Evento</th><th>Total de Días</th></tr>
            </thead>
            <tbody>
              ${Object.entries(daysPerType).map(([tipo, dias]) => `
                <tr><td>${tipo}</td><td>${dias}</td></tr>
              `).join('')}
            </tbody>
          </table>

          <h2>🏥 Códigos CIE10 por Mes</h2>
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                ${Object.values(cie10PerMonth).reduce((codes, monthData) => {
                  Object.keys(monthData).forEach(code => {
                    if (!codes.includes(code)) codes.push(code);
                  });
                  return codes;
                }, [] as string[]).map(code => `<th>${code}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(cie10PerMonth).map(([month, data]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  ${Object.values(cie10PerMonth).reduce((codes, monthData) => {
                    Object.keys(monthData).forEach(code => {
                      if (!codes.includes(code)) codes.push(code);
                    });
                    return codes;
                  }, [] as string[]).map(code => `<td>${data[code] || 0}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>✅ Tasa de Aprobación por Mes</h2>
          <table>
            <thead>
              <tr><th>Mes</th><th>Aprobados</th><th>Rechazados</th><th>Total</th><th>Tasa de Aprobación</th></tr>
            </thead>
            <tbody>
              ${Object.entries(approvalRates).map(([month, stats]) => `
                <tr>
                  <td><strong>${month}</strong></td>
                  <td style="color: #10b981;">${stats.aprobados}</td>
                  <td style="color: #ef4444;">${stats.rechazados}</td>
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
    fetchIncapacidadData();
  }
}, [isOpen, fetchIncapacidadData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center">
            <Activity className="h-6 w-6 mr-3 text-red-500" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Estadísticas de Incapacidad</h2>
              <p className="text-sm text-gray-600 mt-1">
                Total de registros: {incapacidadData.length}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToPDF}
              disabled={exporting || loading}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
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
              {/* Monthly amounts per tipoEvento */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="h-5 w-5 mr-2 text-blue-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cantidad por Mes y Tipo de Evento</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 sticky left-0 bg-gray-50">Mes</th>
                        {Object.values(monthlyAmounts).reduce((types, monthData) => {
                          Object.keys(monthData).forEach(type => {
                            if (!types.includes(type)) types.push(type);
                          });
                          return types;
                        }, [] as string[]).map(tipo => (
                          <th key={tipo} className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap">{tipo}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlyAmounts).map(([month, data]) => (
                        <tr key={month} className="border-b border-gray-100 hover:bg-white">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-900 sticky left-0 bg-gray-50">{month}</td>
                          {Object.values(monthlyAmounts).reduce((types, monthData) => {
                            Object.keys(monthData).forEach(type => {
                              if (!types.includes(type)) types.push(type);
                            });
                            return types;
                          }, [] as string[]).map(tipo => (
                            <td key={tipo} className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-center">
                              {data[tipo] || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Days per tipoEvento */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Total de Días por Tipo de Evento</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {Object.entries(daysPerType).map(([tipo, dias]) => (
                    <div key={tipo} className="p-3 sm:p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-1 text-sm">{tipo}</h4>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600">{dias}</p>
                      <p className="text-xs text-gray-500">días</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CIE10 per month */}
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-5 w-5 mr-2 text-purple-500" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Códigos CIE10 por Mes</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 sticky left-0 bg-gray-50">Mes</th>
                        {Object.values(cie10PerMonth).reduce((codes, monthData) => {
                          Object.keys(monthData).forEach(code => {
                            if (!codes.includes(code)) codes.push(code);
                          });
                          return codes;
                        }, [] as string[]).map(code => (
                          <th key={code} className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap">{code}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(cie10PerMonth).map(([month, data]) => (
                        <tr key={month} className="border-b border-gray-100 hover:bg-white">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-900 sticky left-0 bg-gray-50">{month}</td>
                          {Object.values(cie10PerMonth).reduce((codes, monthData) => {
                            Object.keys(monthData).forEach(code => {
                              if (!codes.includes(code)) codes.push(code);
                            });
                            return codes;
                          }, [] as string[]).map(code => (
                            <td key={code} className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-center">
                              {data[code] || 0}
                            </td>
                          ))}
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
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Aprobados</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700">Rechazados</th>
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