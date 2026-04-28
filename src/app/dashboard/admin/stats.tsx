"use client";

import { useState } from "react";
import {
  BarChart3,
  Calendar,
  Heart,
  Activity,
  DollarSign,
  FileText,
  TrendingUp,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import StatsMood from "./statsMood";
import StatsVacaciones from "./statsVacaciones";
import StatsIncapacidad from "./statsIncapacidad";
import StatsCesantias from "./statsCesantias";
import StatsPermisos from "./statsPermisos";
import StatsSeguimientoVentas from "./statsSeguimientoVentas";

type StatsView =
  | "main"
  | "mood"
  | "vacaciones"
  | "incapacidad"
  | "cesantias"
  | "permisos"
  | "ventas";

interface StatItem {
  view: StatsView;
  label: string;
  description: string;
  icon: LucideIcon;
}

const ITEMS: StatItem[] = [
  { view: "mood", label: "Felicidad", description: "Estado de ánimo del equipo", icon: Heart },
  { view: "vacaciones", label: "Vacaciones", description: "Solicitudes y aprobaciones", icon: Calendar },
  { view: "incapacidad", label: "Incapacidades", description: "Ausencias por salud", icon: Activity },
  { view: "cesantias", label: "Cesantías", description: "Retiros y movimientos", icon: DollarSign },
  { view: "permisos", label: "Permisos", description: "Solicitudes de permiso", icon: FileText },
  { view: "ventas", label: "Seguimiento Ventas", description: "Cumplimiento por vendedor", icon: TrendingUp },
];

export default function Stats() {
  const [currentView, setCurrentView] = useState<StatsView>("main");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 overflow-hidden">
      {/* Header strip */}
      <div className="relative bg-black text-white p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 90% 20%, #f4a900 0, transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f4a900]/20 text-[#f4a900] flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">Panel de Estadísticas</h2>
            <p className="text-xs text-white/60">Selecciona una categoría</p>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="p-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className="group w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#f4a900]/10 active:scale-[0.99] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-100 group-hover:bg-[#f4a900] text-gray-600 group-hover:text-black flex items-center justify-center transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.label}</p>
                <p className="text-xs text-gray-500 truncate">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-[#f4a900] group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>

      {/* Stats popups */}
      <StatsMood isOpen={currentView === "mood"} onClose={() => setCurrentView("main")} />
      <StatsVacaciones isOpen={currentView === "vacaciones"} onClose={() => setCurrentView("main")} />
      <StatsIncapacidad isOpen={currentView === "incapacidad"} onClose={() => setCurrentView("main")} />
      <StatsCesantias isOpen={currentView === "cesantias"} onClose={() => setCurrentView("main")} />
      <StatsPermisos isOpen={currentView === "permisos"} onClose={() => setCurrentView("main")} />
      <StatsSeguimientoVentas isOpen={currentView === "ventas"} onClose={() => setCurrentView("main")} />
    </div>
  );
}
