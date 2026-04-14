"use client";

import {
  FileText,
  LayoutDashboard,
  Users as UsersIcon,
  Calendar as CalendarIcon,
  Zap,
  ShieldAlert,
} from "lucide-react";
import { useSession } from "next-auth/react";
import StatsCard from "./stats";
import TristesCard from "./tristes";
import SolicitudesCard from "./solicitudes";
import CalendarCard from "./calendar";
import PQRSFCard from "./pqrsf";
import Users from "./user";
import QuickActionsAdmin from "./quickActionsAdmin";
import FondoAdmin from "./fondo";

interface AdminPageProps {
  /** When true, the parent already renders the navbar so we shouldn't add another one. */
  embedded?: boolean;
}

export default function AdminPage({ embedded = false }: AdminPageProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#f4a900] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || session.user.rol !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <ShieldAlert className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso denegado</h1>
          <p className="text-gray-600">No tienes permisos de administrador.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={embedded ? "" : "min-h-screen bg-gray-50"}>
      <div className={`${embedded ? "" : "pt-20"} px-4 sm:px-6 lg:px-8 pb-12`}>
        <div className="max-w-7xl mx-auto">
          {/* HERO header — black/yellow */}
          <section className="relative mb-8 overflow-hidden rounded-3xl bg-black text-white shadow-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 12% 20%, #f4a900 0, transparent 45%), radial-gradient(circle at 88% 90%, #f4a900 0, transparent 35%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#f4a900] to-transparent" />

            <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4a900]/15 text-[#f4a900] text-xs font-semibold uppercase tracking-wider border border-[#f4a900]/30">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Panel de Administración
                </span>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
                  Centro de <span className="text-[#f4a900]">control</span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-white/70">
                  Gestiona usuarios, solicitudes, eventos y más desde un solo lugar.
                </p>
              </div>

              {/* Quick KPIs / shortcut chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: FileText, label: "Solicitudes" },
                  { icon: UsersIcon, label: "Usuarios" },
                  { icon: CalendarIcon, label: "Calendario" },
                  { icon: Zap, label: "Accesos" },
                ].map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80"
                  >
                    <c.icon className="h-3.5 w-3.5 text-[#f4a900]" />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              <SectionCard icon={<FileText className="h-5 w-5" />} title="Solicitudes">
                <SolicitudesCard />
              </SectionCard>

              <CalendarCard />

              <Users />

              <QuickActionsAdmin />

              <FondoAdmin />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <StatsCard />
              <TristesCard />
              <PQRSFCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#f4a900]" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#f4a900]/10 text-[#f4a900] flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
