"use client";

import { useState } from "react";
import {
  BarChart,
  Calendar,
  Heart,
  Activity,
  DollarSign,
  FileText
} from "lucide-react";

// Import your stats components
import StatsMood from './statsMood';
import StatsVacaciones from './statsVacaciones';
import StatsIncapacidad from './statsIncapacidad';
import StatsCesantias from './statsCesantias';
import StatsPermisos from './statsPermisos';

type StatsView = 'main' | 'mood' | 'vacaciones' | 'incapacidad' | 'cesantias' | 'permisos';

export default function Stats() {
  const [currentView, setCurrentView] = useState<StatsView>('main');

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center mb-6">
        <BarChart className="h-6 w-6 mr-3 text-blue-500" />
        <h2 className="text-xl font-bold text-gray-900">Panel de Estadísticas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Estadísticas de Felicidad */}
        <button
          onClick={() => setCurrentView('mood')}
          className="group p-6 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-100 hover:border-pink-200 hover:shadow-lg transition-all duration-300 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-pink-100 rounded-lg group-hover:bg-pink-200 transition-colors">
              <Heart className="h-6 w-6 text-pink-600" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Felicidad</h3>
        </button>

        {/* Estadísticas de Vacaciones */}
        <button
          onClick={() => setCurrentView('vacaciones')}
          className="group p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Vacaciones</h3>
        </button>

        {/* Estadísticas de Incapacidad */}
        <button
          onClick={() => setCurrentView('incapacidad')}
          className="group p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 hover:border-red-200 hover:shadow-lg transition-all duration-300 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Incapacidad</h3>
        </button>

        {/* Estadísticas de Cesantías */}
        <button
          onClick={() => setCurrentView('cesantias')}
          className="group p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:border-green-200 hover:shadow-lg transition-all duration-300 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Cesantías</h3>
        </button>

        {/* Estadísticas de Permisos */}
        <button
          onClick={() => setCurrentView('permisos')}
          className="group p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100 hover:border-purple-200 hover:shadow-lg transition-all duration-300 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Permisos</h3>
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Selecciona una categoría para ver estadísticas detalladas y análisis específicos.
        </p>
      </div>

      {/* Render all stats components as popups */}
      <StatsMood 
        isOpen={currentView === 'mood'} 
        onClose={() => setCurrentView('main')} 
      />

      <StatsVacaciones 
        isOpen={currentView === 'vacaciones'} 
        onClose={() => setCurrentView('main')} 
      />

      <StatsIncapacidad 
        isOpen={currentView === 'incapacidad'} 
        onClose={() => setCurrentView('main')} 
      />

      <StatsCesantias 
        isOpen={currentView === 'cesantias'} 
        onClose={() => setCurrentView('main')} 
      />

      <StatsPermisos 
        isOpen={currentView === 'permisos'} 
        onClose={() => setCurrentView('main')} 
      />
    </div>
  );
}