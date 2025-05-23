"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  Gift,
  Briefcase,
  Clock,
} from "lucide-react";
import DashboardNavbar from "../navbar";
import StatsCard from "./stats";
import TristesCard from "./tristes";
import SolicitudesCard from "./solicitudes";
import CalendarCard from "./calendar";
import CertificadoCuentaAdminCard from "./certificado";

// Sample data for solicitudes
const solicitudesData = [
  {
    id: 1,
    title: "Solicitud de vacaciones",
    employee: "María Rodríguez",
    date: "2025-05-10",
    status: "Pendiente",
    statusColor: "bg-yellow-100 text-yellow-800",
    type: "Vacaciones",
    avatarColor: "bg-blue-100",
    avatarText: "MR",
    iconType: <Calendar className="h-5 w-5 text-[#ff9900]" />,
  },
  {
    id: 2,
    title: "Reembolso de gastos",
    employee: "Juan Pérez",
    date: "2025-05-08",
    status: "Pendiente",
    statusColor: "bg-yellow-100 text-yellow-800",
    type: "Finanzas",
    avatarColor: "bg-green-100",
    avatarText: "JP",
    iconType: <Gift className="h-5 w-5 text-[#ff9900]" />,
  },
  {
    id: 3,
    title: "Solicitud de aumento",
    employee: "Ana López",
    date: "2025-05-12",
    status: "En revisión",
    statusColor: "bg-blue-100 text-blue-800",
    type: "Compensación",
    avatarColor: "bg-purple-100",
    avatarText: "AL",
    iconType: <Briefcase className="h-5 w-5 text-[#ff9900]" />,
  },
  {
    id: 4,
    title: "Solicitud de permiso",
    employee: "Pedro Sánchez",
    date: "2025-05-07",
    status: "Pendiente",
    statusColor: "bg-yellow-100 text-yellow-800",
    type: "Permisos",
    avatarColor: "bg-red-100",
    avatarText: "PS",
    iconType: <Clock className="h-5 w-5 text-[#ff9900]" />,
  },
  {
    id: 5,
    title: "Cambio de horario",
    employee: "Laura Martínez",
    date: "2025-05-15",
    status: "En revisión",
    statusColor: "bg-blue-100 text-blue-800",
    type: "Horarios",
    avatarColor: "bg-yellow-100",
    avatarText: "LM",
    iconType: <Clock className="h-5 w-5 text-[#ff9900]" />,
  },
];

// Sample data for trabajadores tristes
const trabajadoresTristeData = [
  {
    id: 1,
    name: "Carlos Mendoza",
    position: "Desarrollador Frontend",
    department: "Tecnología",
    consecutiveSadDays: 5,
    avatar: "CM",
    avatarColor: "bg-blue-100 text-blue-600",
  },
  {
    id: 2,
    name: "Elena Torres",
    position: "Analista de Datos",
    department: "Business Intelligence",
    consecutiveSadDays: 3,
    avatar: "ET",
    avatarColor: "bg-green-100 text-green-600",
  },
  {
    id: 3,
    name: "Miguel Ángel Ruiz",
    position: "Diseñador UX/UI",
    department: "Diseño",
    consecutiveSadDays: 7,
    avatar: "MR",
    avatarColor: "bg-purple-100 text-purple-600",
  },
  {
    id: 4,
    name: "Sofia Castro",
    position: "Ejecutiva de Ventas",
    department: "Comercial",
    consecutiveSadDays: 4,
    avatar: "SC",
    avatarColor: "bg-pink-100 text-pink-600",
  },
];

export default function AdminPage() {
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [showAllSolicitudes, setShowAllSolicitudes] = useState(false);


  // Sort solicitudes by date (closest to today first)
  const sortedSolicitudes = [...solicitudesData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      {/* Main content */}
      <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Bienvenido de nuevo. Aquí está el resumen del día.
                </p>
              </div>
        
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Solicitudes */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ff9900]"></div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-[#ff9900]" />
                    Solicitudes
                  </h2>
                </div>

                <SolicitudesCard />
              </div>
              <br />

<CalendarCard />
              <br />
              
            </div>

            {/* Right column - Cards */}
            <div className="space-y-6">
              {/* Notificaciones */}
              <StatsCard />

              {/* Trabajadores tristes card */}
              <TristesCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}