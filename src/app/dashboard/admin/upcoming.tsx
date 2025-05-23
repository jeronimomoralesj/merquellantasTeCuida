"use client";

import { useState } from "react";
import {
  User,
  CalendarIcon,
  Share2,
  PieChart,
} from "lucide-react";

  const solicitudesData = [
    {
      id: 1,
      title: "Solicitud de vacaciones",
      employee: "María Rodríguez",
      date: "2025-05-10",
      status: "Pendiente",
      statusColor: "bg-yellow-100 text-yellow-800",
      type: "Vacaciones",
    },
    {
      id: 2,
      title: "Reembolso de gastos",
      employee: "Juan Pérez",
      date: "2025-05-08",
      status: "Pendiente",
      statusColor: "bg-yellow-100 text-yellow-800",
      type: "Finanzas",
    },
    {
      id: 3,
      title: "Solicitud de aumento",
      employee: "Ana López",
      date: "2025-05-12",
      status: "En revisión",
      statusColor: "bg-blue-100 text-blue-800",
      type: "Compensación",
    },
    {
      id: 4,
      title: "Solicitud de permiso",
      employee: "Pedro Sánchez",
      date: "2025-05-07",
      status: "Pendiente",
      statusColor: "bg-yellow-100 text-yellow-800",
      type: "Permisos",
    },
    {
      id: 5,
      title: "Cambio de horario",
      employee: "Laura Martínez",
      date: "2025-05-15",
      status: "En revisión",
      statusColor: "bg-blue-100 text-blue-800",
      type: "Horarios",
    },
  ];

export default function UpcomingCard() {

  // Sort solicitudes by date (closest to today first)
  const sortedSolicitudes = [...solicitudesData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Format date to display as "10 de Mayo, 2025"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
<div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <CalendarIcon className="h-5 w-5 mr-2 text-purple-500" />
                    Próximos Eventos
                  </h2>
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                    3 eventos
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                      <CalendarIcon className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Reunión de equipo</p>
                      <p className="text-xs text-gray-500">Mañana, 10:00 AM</p>
                    </div>
                    <button className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                      <Share2 className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="flex items-center p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                      <PieChart className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Presentación trimestral</p>
                      <p className="text-xs text-gray-500">8 de mayo, 2:00 PM</p>
                    </div>
                    <button className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                      <Share2 className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="flex items-center p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-all">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Entrevista candidatos</p>
                      <p className="text-xs text-gray-500">9 de mayo, 11:30 AM</p>
                    </div>
                    <button className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors">
                      <Share2 className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
  );
}