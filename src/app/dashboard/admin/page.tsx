"use client";

import {
  FileText,
} from "lucide-react";
import DashboardNavbar from "../navbar";
import StatsCard from "./stats";
import TristesCard from "./tristes";
import SolicitudesCard from "./solicitudes";
import CalendarCard from "./calendar";


export default function AdminPage() {

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