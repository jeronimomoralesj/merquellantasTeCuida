"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  AlertCircle,
  CheckCircle,
  Bell,
  X,
  Download,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase"; // adjust to your path

// Type definitions
interface MonthlyData {
  name: string;
  solicitudes?: number;
  aprobadas?: number;
  cantidad?: number;
}

interface MoodData {
  feliz: number;
  neutral: number;
  triste: number;
}

interface MonthlyMoodData extends MoodData {
  name: string;
}

interface DepartmentStats extends MoodData {
  total: number;
}

interface MoodDistribution {
  name: string;
  value: number;
}

interface TopDepartment {
  name: string;
  satisfaction: number;
}

interface MotivosStats {
  vivienda: number;
  educacion: number;
  compraVivienda: number;
  otros: number;
}

interface FelicidadData {
  moodDistribution: MoodDistribution[];
  monthlyTrend: MonthlyMoodData[];
  departmentStats: Record<string, DepartmentStats>;
  totalResponses: number;
  overallSatisfaction: number;
  workersNeedingAttention: number;
  topDepartment: TopDepartment | null;
  error?: string;
}

interface StatsData {
  solicitudes: {
    total: number;
    loading: boolean;
    error: string | null;
    monthly: MonthlyData[];
  };
  cesantias: {
    total: number;
    loading: boolean;
    error: string | null;
    monthly: MonthlyData[];
    motivosStats: MotivosStats;
  };
  felicidad: {
    loading: boolean;
    error: string | null;
    moodDistribution: MoodDistribution[];
    monthlyTrend: MonthlyMoodData[];
    departmentStats: Record<string, DepartmentStats>;
    totalResponses: number;
    overallSatisfaction: number;
    workersNeedingAttention: number;
    topDepartment: TopDepartment | null;
  };
}

interface MoodEntry {
  mood: string;
  date: Timestamp;
}

interface UserData {
  department?: string;
  departamento?: string;
  mood?: {
    mood: string;
    date: Timestamp;
  };
  moodHistory?: MoodEntry[];
}

export default function StatsCard() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<StatsData>({
    solicitudes: {
      total: 0,
      loading: true,
      error: null,
      monthly: []
    },
    cesantias: {
      total: 0,
      loading: true,
      error: null,
      monthly: [],
      motivosStats: {
        vivienda: 0,
        educacion: 0,
        compraVivienda: 0,
        otros: 0
      }
    },
    felicidad: {
      loading: true,
      error: null,
      moodDistribution: [],
      monthlyTrend: [],
      departmentStats: {},
      totalResponses: 0,
      overallSatisfaction: 0,
      workersNeedingAttention: 0,
      topDepartment: null
    }
  });

  const COLORS = ["#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6"];

  // Helper function to get the first and last day of the current month
  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return {
      start: Timestamp.fromDate(firstDay),
      end: Timestamp.fromDate(lastDay)
    };
  };

  // Helper function to get month name from date
  const getMonthName = (date: Date): string => {
    return date.toLocaleString('es-ES', { month: 'short' });
  };

  // Fetch happiness survey data
  const fetchHappinessData = useCallback(async (): Promise<FelicidadData> => {
    try {
      const monthRange = getCurrentMonthRange();
      
      // Get all users with mood data
      const usersQuery = query(collection(db, "users"));
      const usersSnapshot = await getDocs(usersQuery);
      
      const moodCounts: MoodData = { feliz: 0, neutral: 0, triste: 0 };
      const departmentMoods: Record<string, DepartmentStats> = {};
      const monthlyMoodData: MonthlyMoodData[] = Array(5).fill(null).map((_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (4 - i));
        return {
          name: getMonthName(date),
          feliz: 0,
          neutral: 0,
          triste: 0
        };
      });
      
      let totalResponses = 0;
      let workersNeedingAttention = 0;
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        const department = userData.department || userData.departamento || 'Sin Departamento';
        
        // Initialize department stats if not exists
        if (!departmentMoods[department]) {
          departmentMoods[department] = { feliz: 0, neutral: 0, triste: 0, total: 0 };
        }
        
        // Check for mood history (new format)
        if (userData.moodHistory && Array.isArray(userData.moodHistory)) {
          userData.moodHistory.forEach((moodEntry) => {
            const moodDate = moodEntry.date?.toDate();
            if (moodDate && moodDate >= monthRange.start.toDate() && moodDate <= monthRange.end.toDate()) {
              totalResponses++;
              const mood = moodEntry.mood as keyof MoodData;
              
              // Count overall moods
              if (mood in moodCounts) {
                moodCounts[mood]++;
              }
              
              // Count department moods
              if (departmentMoods[department] && mood in moodCounts) {
                departmentMoods[department][mood]++;
                departmentMoods[department].total++;
              }
              
              // Add to monthly trend
              const monthIndex = monthlyMoodData.findIndex(m => 
                m.name === getMonthName(moodDate)
              );
              if (monthIndex !== -1 && mood in moodCounts) {
                monthlyMoodData[monthIndex][mood]++;
              }
            }
          });
          
          // Check for workers needing attention (3+ consecutive sad days)
          const sortedMoods = userData.moodHistory
            .sort((a, b) => b.date.toMillis() - a.date.toMillis());
          
          let consecutiveSad = 0;
          for (const mood of sortedMoods) {
            if (mood.mood === 'triste') {
              consecutiveSad++;
              if (consecutiveSad >= 3) {
                workersNeedingAttention++;
                break;
              }
            } else {
              break;
            }
          }
        }
        // Fallback for single mood entry (old format)
        else if (userData.mood && userData.mood.mood) {
          const moodDate = userData.mood.date?.toDate();
          if (moodDate && moodDate >= monthRange.start.toDate() && moodDate <= monthRange.end.toDate()) {
            totalResponses++;
            const mood = userData.mood.mood as keyof MoodData;
            
            if (mood in moodCounts) {
              moodCounts[mood]++;
            }
            
            if (departmentMoods[department] && mood in moodCounts) {
              departmentMoods[department][mood]++;
              departmentMoods[department].total++;
            }
            
            if (mood === 'triste') {
              workersNeedingAttention++;
            }
          }
        }
      });
      
      // Calculate overall satisfaction percentage
      const totalMoodResponses = moodCounts.feliz + moodCounts.neutral + moodCounts.triste;
      const overallSatisfaction = totalMoodResponses > 0 
        ? Math.round((moodCounts.feliz / totalMoodResponses) * 100) 
        : 0;
      
      // Find top department by satisfaction
      let topDepartment: TopDepartment | null = null;
      let highestSatisfaction = 0;
      
      Object.entries(departmentMoods).forEach(([dept, stats]) => {
        if (stats.total > 0) {
          const satisfaction = Math.round((stats.feliz / stats.total) * 100);
          if (satisfaction > highestSatisfaction) {
            highestSatisfaction = satisfaction;
            topDepartment = { name: dept, satisfaction };
          }
        }
      });
      
      // Format data for charts
      const moodDistribution: MoodDistribution[] = [
        { name: "Feliz", value: moodCounts.feliz },
        { name: "Neutral", value: moodCounts.neutral },
        { name: "Triste", value: moodCounts.triste },
      ].filter(item => item.value > 0);
      
      return {
        moodDistribution,
        monthlyTrend: monthlyMoodData,
        departmentStats: departmentMoods,
        totalResponses,
        overallSatisfaction,
        workersNeedingAttention,
        topDepartment
      };
      
    } catch (error) {
      console.error("Error fetching happiness data:", error);
      throw error;
    }
  }, []);

  // Fetch historical data for charts
  const fetchHistoricalData = useCallback(async () => {
    // Get the last 5 months
    const months: Array<{ name: string; start: Timestamp; end: Timestamp }> = [];
    const currentDate = new Date();
    
    for (let i = 4; i >= 0; i--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        name: getMonthName(month),
        start: Timestamp.fromDate(new Date(month.getFullYear(), month.getMonth(), 1)),
        end: Timestamp.fromDate(new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59))
      });
    }
    
    // Initialize result arrays
    const solicitudesData: MonthlyData[] = [];
    const cesantiasData: MonthlyData[] = [];
    
    // Fetch data for each month
    for (const month of months) {
      // Fetch solicitudes count and status
      const solicitudesQuery = query(
        collection(db, "solicitudes"),
        where("createdAt", ">=", month.start),
        where("createdAt", "<=", month.end)
      );
      
      const cesantiasQuery = query(
        collection(db, "cesantias"),
        where("createdAt", ">=", month.start),
        where("createdAt", "<=", month.end)
      );
      
      const [solicitudesSnap, cesantiasSnap] = await Promise.all([
        getDocs(solicitudesQuery),
        getDocs(cesantiasQuery)
      ]);
      
      // Count approved solicitudes
      const approvedSolicitudes = solicitudesSnap.docs.filter(doc => 
        doc.data().estado === "aprobado"
      ).length;
      
      solicitudesData.push({
        name: month.name,
        solicitudes: solicitudesSnap.size,
        aprobadas: approvedSolicitudes
      });
      
      cesantiasData.push({
        name: month.name,
        cantidad: cesantiasSnap.size
      });
    }
    
    return {
      solicitudes: solicitudesData,
      cesantias: cesantiasData
    };
  }, []);

  // Fetch cesantias motivos data
  const fetchCesantiasMotivos = useCallback(async (): Promise<MotivosStats> => {
    try {
      const monthRange = getCurrentMonthRange();
      
      const cesantiasQuery = query(
        collection(db, "cesantias"),
        where("createdAt", ">=", monthRange.start),
        where("createdAt", "<=", monthRange.end)
      );
      
      const cesantiasSnapshot = await getDocs(cesantiasQuery);
      
      const motivosStats: MotivosStats = {
        vivienda: 0,
        educacion: 0,
        compraVivienda: 0,
        otros: 0
      };
      
      cesantiasSnapshot.forEach((doc) => {
        const data = doc.data();
        const motivo = (data.motivoSolicitud?.toLowerCase() || '') as string;
        
        if (motivo.includes('vivienda') || motivo.includes('arreglo')) {
          motivosStats.vivienda++;
        } else if (motivo.includes('educacion') || motivo.includes('estudio')) {
          motivosStats.educacion++;
        } else if (motivo.includes('compra') && motivo.includes('vivienda')) {
          motivosStats.compraVivienda++;
        } else {
          motivosStats.otros++;
        }
      });
      
      return motivosStats;
    } catch (error) {
      console.error("Error fetching cesantias motivos:", error);
      return { vivienda: 0, educacion: 0, compraVivienda: 0, otros: 0 };
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        const monthRange = getCurrentMonthRange();
        
        // Fetch solicitudes for the current month
        const solicitudesQuery = query(
          collection(db, "solicitudes"),
          where("createdAt", ">=", monthRange.start),
          where("createdAt", "<=", monthRange.end),
          orderBy("createdAt", "desc")
        );
        
        // Fetch cesantias for the current month
        const cesantiasQuery = query(
          collection(db, "cesantias"),
          where("createdAt", ">=", monthRange.start),
          where("createdAt", "<=", monthRange.end),
          orderBy("createdAt", "desc")
        );
        
        // Execute queries concurrently
        const [solicitudesSnapshot, cesantiasSnapshot, historicalData, motivosStats] = await Promise.all([
          getDocs(solicitudesQuery),
          getDocs(cesantiasQuery),
          fetchHistoricalData(),
          fetchCesantiasMotivos()
        ]);
        
        // Fetch happiness data
        let felicidadData: FelicidadData;
        try {
          felicidadData = await fetchHappinessData();
        } catch (error) {
          console.error("Error fetching happiness data:", error);
          felicidadData = {
            moodDistribution: [],
            monthlyTrend: [],
            departmentStats: {},
            totalResponses: 0,
            overallSatisfaction: 0,
            workersNeedingAttention: 0,
            topDepartment: null,
            error: "Error al cargar datos de felicidad"
          };
        }
        
        setStatsData({
          solicitudes: {
            total: solicitudesSnapshot.size,
            loading: false,
            error: null,
            monthly: historicalData.solicitudes
          },
          cesantias: {
            total: cesantiasSnapshot.size,
            loading: false,
            error: null,
            monthly: historicalData.cesantias,
            motivosStats: motivosStats
          },
          felicidad: {
            ...felicidadData,
            loading: false,
            error: felicidadData.error || null
          }
        });
      } catch (error) {
        console.error("Error fetching statistics:", error);
        setStatsData(prev => ({
          solicitudes: {
            ...prev.solicitudes,
            loading: false,
            error: "Error al cargar las estadísticas de solicitudes"
          },
          cesantias: {
            ...prev.cesantias,
            loading: false,
            error: "Error al cargar las estadísticas de cesantías"
          },
          felicidad: {
            ...prev.felicidad,
            loading: false,
            error: "Error al cargar las estadísticas de felicidad"
          }
        }));
      }
    }
    
    fetchData();
  }, [fetchHistoricalData, fetchCesantiasMotivos, fetchHappinessData]);

  const handleExportPDF = (type: string) => {
    // In a real application, this would generate and download a PDF
    alert(`Exportando informe de ${type} como PDF...`);
  };

  const openModal = async (type: string) => {
    setActiveModal(type);
    
    // If opening felicidad modal and data hasn't been loaded yet, fetch it
    if (type === "felicidad" && statsData.felicidad.loading) {
      try {
        const felicidadData = await fetchHappinessData();
        setStatsData(prev => ({
          ...prev,
          felicidad: {
            ...felicidadData,
            loading: false,
            error: null
          }
        }));
      } catch (error) {
        console.error("Error fetching happiness data:", error);
        setStatsData(prev => ({
          ...prev,
          felicidad: {
            ...prev.felicidad,
            loading: false,
            error: "Error al cargar datos de felicidad"
          }
        }));
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden text-black">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Bell className="h-5 w-5 mr-2 text-blue-500" />
          Estadísticas
        </h2>
      </div>
      
      <div className="space-y-3">
        {/* Solicitudes Stats Card */}
        <div 
          className="p-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => openModal("vacaciones")}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-600">
              <User className="h-4 w-4" />
            </div>
            <div className="ml-3">
              {statsData.solicitudes.loading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <p className="text-sm font-medium text-gray-900">Cargando...</p>
                </div>
              ) : statsData.solicitudes.error ? (
                <p className="text-sm font-medium text-red-500">Error al cargar datos</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">{statsData.solicitudes.total} solicitudes este mes</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ver estadisticas de vacaciones</p>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Cesantias Stats Card */}
        <div 
          className="p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors cursor-pointer"
          onClick={() => openModal("permisos")}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div className="ml-3">
              {statsData.cesantias.loading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <p className="text-sm font-medium text-gray-900">Cargando...</p>
                </div>
              ) : statsData.cesantias.error ? (
                <p className="text-sm font-medium text-red-500">Error al cargar datos</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">{statsData.cesantias.total} cesantias este mes</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ver estadisticas de permisos</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Happiness Survey Card */}
        <div 
          className="p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors cursor-pointer"
          onClick={() => openModal("felicidad")}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Encuestas de felicidad</p>
              <p className="text-xs text-gray-500 mt-0.5">Ver estadisticas de felicidad</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Vacaciones Statistics */}
      {activeModal === "vacaciones" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Estadísticas de Vacaciones</h2>
              <div className="flex space-x-2">
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm hover:bg-blue-700 transition-colors"
                  onClick={() => handleExportPDF("vacaciones")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar como PDF
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full"
                  onClick={() => setActiveModal(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Solicitudes por mes</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.solicitudes.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="solicitudes" fill="#3B82F6" name="Total Solicitudes" />
                      <Bar dataKey="aprobadas" fill="#10B981" name="Aprobadas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Tasa de aprobación</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={statsData.solicitudes.monthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="solicitudes" 
                        stroke="#3B82F6" 
                        name="Total Solicitudes"
                        activeDot={{ r: 8 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="aprobadas" 
                        stroke="#10B981" 
                        name="Aprobadas" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-medium mb-2">Resumen</h3>
              {statsData.solicitudes.loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Cargando estadísticas...</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>
                      Total de solicitudes este mes: {statsData.solicitudes.total}
                    </span>
                  </li>
                  {statsData.solicitudes.monthly.length > 1 && (
                    <>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span>
                          Solicitudes aprobadas: {statsData.solicitudes.monthly[statsData.solicitudes.monthly.length - 1]?.aprobadas || 0} 
                          ({(() => {
                            const lastMonth = statsData.solicitudes.monthly[statsData.solicitudes.monthly.length - 1];
                            if (lastMonth?.solicitudes && lastMonth.solicitudes > 0 && lastMonth.aprobadas !== undefined) {
                              return Math.round((lastMonth.aprobadas / lastMonth.solicitudes) * 100);
                            }
                            return 0;
                          })()}%)
                        </span>
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span>Tiempo promedio de aprobación: 2.3 días</span>
                      </li>
                      {statsData.solicitudes.monthly.length >= 2 && (
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          {(() => {
                            const current = statsData.solicitudes.monthly[statsData.solicitudes.monthly.length - 1]?.solicitudes || 0;
                            const previous = statsData.solicitudes.monthly[statsData.solicitudes.monthly.length - 2]?.solicitudes || 0;
                            const percentChange = previous > 0 
                              ? Math.round(((current - previous) / previous) * 100) 
                              : 0;
                            
                            return (
                              <span>
                                {percentChange >= 0 
                                  ? `Incremento del ${percentChange}% respecto al mes anterior` 
                                  : `Disminución del ${Math.abs(percentChange)}% respecto al mes anterior`}
                              </span>
                            );
                          })()}
                        </li>
                      )}
                    </>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Permisos Statistics */}
      {activeModal === "permisos" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Estadísticas de Cesantías</h2>
              <div className="flex space-x-2">
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm hover:bg-blue-700 transition-colors"
                  onClick={() => handleExportPDF("permisos")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar como PDF
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full"
                  onClick={() => setActiveModal(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="text-lg font-medium mb-2">Permisos por mes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData.cesantias.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cantidad" fill="#10B981" name="Permisos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-medium mb-2">Motivos de cesantías en {new Date().toLocaleString('es-ES', { month: 'long' })}</h3>
              {statsData.cesantias.loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Cargando estadísticas...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* We'll implement the dynamic category grouping in the useEffect */}
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm font-medium">Arreglos de Vivienda</p>
<p className="text-lg font-bold">{statsData.cesantias.motivosStats?.vivienda || 0}</p>                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm font-medium">Educación</p>
                    <p className="text-lg font-bold">{statsData.cesantias.motivosStats?.educacion || 0}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm font-medium">Compra de Vivienda</p>
                    <p className="text-lg font-bold">{statsData.cesantias.motivosStats?.compraVivienda || 0}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm font-medium">Otros</p>
                    <p className="text-lg font-bold">{statsData.cesantias.motivosStats?.otros || 0}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Resumen</h3>
              {statsData.cesantias.loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Cargando estadísticas...</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Total de permisos en {new Date().toLocaleString('es-ES', { month: 'long' })}: {statsData.cesantias.total}</span>
                  </li>
                  {statsData.cesantias.monthly.length >= 2 && (
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {(() => {
                        const current = statsData.cesantias.monthly[statsData.cesantias.monthly.length - 1]?.cantidad || 0;
                        const previous = statsData.cesantias.monthly[statsData.cesantias.monthly.length - 2]?.cantidad || 0;
                        const percentChange = previous > 0 
                          ? Math.round(((current - previous) / previous) * 100) 
                          : 0;
                        
                        return (
                          <span>
                            {percentChange >= 0 
                              ? `Aumento del ${percentChange}% respecto al mes anterior` 
                              : `Disminución del ${Math.abs(percentChange)}% respecto al mes anterior`}
                          </span>
                        );
                      })()}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for Felicidad Statistics - Updated with real data */}
      {activeModal === "felicidad" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Estadísticas de Encuestas de Felicidad</h2>
              <div className="flex space-x-2">
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center text-sm hover:bg-blue-700 transition-colors"
                  onClick={() => handleExportPDF("felicidad")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar como PDF
                </button>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full"
                  onClick={() => setActiveModal(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Niveles de satisfacción</h3>
                <div className="h-64">
                  {statsData.felicidad.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Cargando datos...</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statsData.felicidad.moodDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {statsData.felicidad.moodDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Tendencia mensual</h3>
                <div className="h-64">
                  {statsData.felicidad.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Cargando datos...</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={statsData.felicidad.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="feliz" 
                          stroke="#10B981" 
                          name="Feliz"
                          activeDot={{ r: 8 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="neutral" 
                          stroke="#F59E0B" 
                          name="Neutral" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="triste" 
                          stroke="#EF4444" 
                          name="Triste" 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-medium mb-2">Departamentos por nivel de satisfacción</h3>
              {statsData.felicidad.loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Cargando estadísticas...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(statsData.felicidad.departmentStats).map(([dept, stats]) => (
                    <div key={dept} className="bg-white p-3 rounded-lg shadow-sm">
                      <p className="text-sm font-medium">{dept}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600">Feliz: {stats.feliz}</span>
                          <span className="text-yellow-600">Neutral: {stats.neutral}</span>
                          <span className="text-red-600">Triste: {stats.triste}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-l-full" 
                            style={{ width: `${(stats.feliz / stats.total) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {stats.total} respuestas • {Math.round((stats.feliz / stats.total) * 100)}% satisfacción
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Resumen</h3>
              {statsData.felicidad.loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Cargando estadísticas...</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Total de respuestas este mes: {statsData.felicidad.totalResponses}</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Nivel general de satisfacción: {statsData.felicidad.overallSatisfaction}%</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Trabajadores que requieren atención: {statsData.felicidad.workersNeedingAttention}</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>
                      Departamento con mayor satisfacción: {statsData.felicidad.topDepartment?.name || 'N/A'} 
                      ({statsData.felicidad.topDepartment?.satisfaction || 0}%)
                    </span>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}