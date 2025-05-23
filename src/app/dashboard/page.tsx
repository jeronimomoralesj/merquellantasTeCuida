"use client";

import React, { useState, useEffect } from 'react';
import DashboardNavbar from './navbar';
import { useRouter } from 'next/navigation';
import { 
  Calendar, DollarSign, Briefcase, ChevronRight, 
  Gift, Clock, MessageSquare, FileText, Activity, User,
  UserIcon, CheckCircle
} from 'lucide-react';
import Solicitudes from "./components/solicitudes";
import AdminPage from './admin/page';
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase'
import GeminiChat from './components/chat';

// Type definitions
interface CalendarEvent {
  title: string;
  description: string;
  image: string;
  date: Timestamp;
  type?: string;
}

interface PendingRequest {
  id: string;
  tipo: 'cesantias' | 'enfermedad' | 'permiso';
  createdAt: Timestamp;
  estado: string;
}

interface UserProfile {
  nombre: string;
  rol: string;
  antiguedad: number;
  posicion: string;
  dpto: string;
  eps: string;
  banco: string;
  pensiones: string;
  arl: string;
}

interface Birthday {
  name: string;
  position: string;
  date: Timestamp;
}

interface UserData {
  nombre: string;
  rol: string;
  posicion: string;
  antiguedad: number;
  extra?: {
    "Nombre Área Funcional"?: string;
    "EPS"?: string;
    "Banco"?: string;
    "FONDO DE PENSIONES"?: string;
    "ARL"?: string;
  };
}

const Dashboard = () => {
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Upcoming events state
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Birthdays state
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Birthday[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);

  const router = useRouter();

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) {
        router.replace('/auth/login');
      }
    });
    return unsubscribe;
  }, [router]);

  // Load pending requests
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingRequests(true);

      if (!user) {
        setPendingRequests([]);
        setLoadingRequests(false);
        return;
      }

      try {
        // Build both queries in parallel
        const qCes = query(
          collection(db, 'cesantias'),
          where('userId', '==', user.uid),
          where('estado', '==', 'pendiente'),
          orderBy('createdAt', 'desc')
        );
        const qSol = query(
          collection(db, 'solicitudes'),
          where('userId', '==', user.uid),
          where('estado', '==', 'pendiente'),
          orderBy('createdAt', 'desc')
        );

        const [cesSnap, solSnap] = await Promise.all([
          getDocs(qCes),
          getDocs(qSol),
        ]);

        // Map to a unified shape
        const ces = cesSnap.docs.map(d => ({
          id: d.id,
          tipo: 'cesantias' as const,
          createdAt: d.data().createdAt as Timestamp,
          estado: d.data().estado as string,
        }));
        const sol = solSnap.docs.map(d => ({
          id: d.id,
          tipo: d.data().tipo as 'enfermedad' | 'permiso',
          createdAt: d.data().createdAt as Timestamp,
          estado: d.data().estado as string,
        }));

        // Merge & sort by timestamp desc
        const all = [...ces, ...sol].sort((a, b) =>
          b.createdAt.seconds - a.createdAt.seconds
        );
        setPendingRequests(all);
      } catch (err) {
        console.error('Error loading pending requests', err);
        setPendingRequests([]);
      } finally {
        setLoadingRequests(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch the next calendar event
  useEffect(() => {
    async function fetchNext() {
      try {
        const q = query(
          collection(db, 'calendar'),
          where('date', '>=', Timestamp.now()),
          orderBy('date', 'asc'),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const eventData = snap.docs[0].data() as Omit<CalendarEvent, 'date'> & { date: Timestamp };
          setNextEvent(eventData);
        } else {
          setNextEvent(null);
        }
      } catch (e) {
        console.error("Error fetching calendar:", e);
        setNextEvent(null);
      } finally {
        setLoadingEvent(false);
      }
    }
    fetchNext();
  }, []);

  // Load user profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return setProfile(null);
      
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data() as UserData;
        const dpto = data.extra?.["Nombre Área Funcional"] ?? "";
        const eps = data.extra?.["EPS"] ?? "";
        const banco = data.extra?.["Banco"] ?? "";
        const pensiones = data.extra?.["FONDO DE PENSIONES"] ?? "";
        const arl = data.extra?.["ARL"] ?? "";
        
        setProfile({
          nombre: data.nombre,
          rol: data.rol,
          posicion: data.posicion,
          dpto: dpto,
          eps: eps,
          banco: banco,
          pensiones: pensiones,
          arl: arl,
          antiguedad: data.antiguedad
        });
        setUserRole(data.rol || "user");
      }
    });
    return () => unsub();
  }, []);

  // Load upcoming events
  useEffect(() => {
    async function fetchUpcoming() {
      try {
        const q = query(
          collection(db, 'calendar'),
          where('date', '>=', Timestamp.now()),
          orderBy('date', 'asc'),
          limit(3)
        );
        const snap = await getDocs(q);
        const events = snap.docs.map(d => d.data() as CalendarEvent);
        setUpcomingEvents(events);
      } catch (e) {
        console.error("Error fetching upcoming:", e);
      } finally {
        setLoadingEvents(false);
      }
    }
    fetchUpcoming();
  }, []);

  // Load upcoming birthdays
  useEffect(() => {
    async function fetchBirthdays() {
      try {
        const q = query(
          collection(db, 'calendar'),
          where('type', '==', 'birthday'),
          where('date', '>=', Timestamp.now()),
          orderBy('date', 'asc'),
          limit(3)
        );
        const snap = await getDocs(q);
        setUpcomingBirthdays(snap.docs.map(d => ({
          name: d.data().title,
          position: d.data().description,
          date: d.data().date as Timestamp
        })));
      } catch (e) {
        console.error("Error fetching birthdays:", e);
      } finally {
        setLoadingBirthdays(false);
      }
    }
    fetchBirthdays();
  }, []);

  // If flagged, render the solicitudes screen instead of the dashboard
  if (showSolicitudes) {
    return (
      <>
        <DashboardNavbar />
        <div className="pt-20 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          <button
            className="mb-4 flex items-center text-sm text-[#ff9900] hover:text-[#e68a00] transition-colors hover:underline group"
            onClick={() => setShowSolicitudes(false)}
          >
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">&larr;</span> Volver al Dashboard
          </button>
          <Solicitudes />
        </div>
      </>
    );
  }

  const quickActions = [
    { 
      id: 1, 
      title: "Solicitar vacaciones/permisos", 
      icon: <Calendar className="h-5 w-5" />, 
      color: "bg-[#ff9900]/10 text-[#ff9900]",
      bgHover: "hover:bg-gradient-to-br from-[#ff9900]/5 to-[#ff9900]/20",
      href: "/dashboard/solicitud"
    },
    { 
      id: 2, 
      title: "Ir a Heinsohn nómina", 
      icon: <DollarSign className="h-5 w-5" />, 
      color: "bg-purple-100 text-purple-600",
      bgHover: "hover:bg-gradient-to-br from-purple-50 to-purple-100",
      href: "https://portal.heinsohn.com.co/"
    },
    { 
      id: 3, 
      title: "Certificado de cuenta", 
      icon: <Clock className="h-5 w-5" />, 
      color: "bg-blue-100 text-blue-600",
      bgHover: "hover:bg-gradient-to-br from-blue-50 to-blue-100",
      href: "/dashboard/certificado"
    },
    { 
      id: 4, 
      title: "Seguridad social", 
      icon: <MessageSquare className="h-5 w-5" />, 
      color: "bg-green-100 text-green-600",
      bgHover: "hover:bg-gradient-to-br from-green-50 to-green-100",
      href: "https://www.aportesenlinea.com/Home/home.aspx?ReturnUrl=%2f"
    }
  ];

  // Format current date in Spanish
  const formattedDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Capitalize first letter of the formatted date
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (userRole !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar />
        <GeminiChat />
        {/* Main content */}
        <main className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header with welcome message */}
            <div className="mb-8 mt-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center">
                <span className="bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text">
                  ¡Bienvenido a Merque te cuida!
                </span>
                <div className="ml-3 hidden sm:flex items-center h-8 px-3 text-xs font-medium rounded-full bg-[#ff9900]/10 text-[#ff9900]">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Hoy es un buen día
                </div>
              </h1>
              <p className="text-gray-500 text-sm">{capitalizedDate}</p>
            </div>

            {/* Main section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column (spans 2 columns on large screens) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Welcome banner with gradient */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow duration-300">
                  <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center">
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-[#ff9900] via-[#ffb347] to-white"></div>

                    <div className="md:flex-1 mb-6 md:mb-0 md:pr-6">
                      <div className="inline-block px-3 py-1 rounded-full bg-[#ff9900]/10 text-[#ff9900] text-xs font-medium mb-3">
                        Evento destacado
                      </div>

                      {loadingEvent ? (
                        <p className="text-gray-500">Cargando evento…</p>
                      ) : nextEvent ? (
                        <>
                          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                            {nextEvent.title}
                          </h2>

                          {/* Format date/time or "All day" */}
                          {(() => {
                            const dt = nextEvent.date.toDate();
                            const isAllDay =
                              dt.getHours() === 0 &&
                              dt.getMinutes() === 0 &&
                              dt.getSeconds() === 0;

                            if (isAllDay) {
                              return (
                                <p className="text-xs text-gray-500 mb-3">
                                  {dt.toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })} — Todo el día
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-xs text-gray-500 mb-3">
                                  {dt.toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })},{' '}
                                  {dt.toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              );
                            }
                          })()}

                          <p className="mb-4 text-gray-600">{nextEvent.description}</p>
                          <a href='dashboard/calendar'>
                            <button className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-white rounded-full font-medium text-sm hover:from-[#e68a00] hover:to-[#ff9900] transition-all shadow-sm hover:shadow transform hover:-translate-y-0.5 duration-200">
                              Ver detalles
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </button>
                          </a>
                        </>
                      ) : (
                        <p className="text-gray-500">No hay eventos próximos</p>
                      )}
                    </div>

                    {/* Event image or placeholder */}
                    <div className="flex-shrink-0 w-full md:w-auto">
                      {loadingEvent ? (
                        <div className="h-40 w-full md:w-64 bg-gray-100 rounded-xl animate-pulse" />
                      ) : nextEvent ? (
                        <img
                          src={nextEvent.image}
                          alt={nextEvent.title}
                          className="rounded-xl shadow h-40 w-full object-cover md:w-64"
                        />
                      ) : (
                        <div className="h-40 w-full md:w-64 flex items-center justify-center text-gray-400 rounded-xl border border-gray-200">
                          No hay imagen
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions with improved design */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#ff9900] to-white"></div>
                  <h2 className="text-lg font-bold mb-5 text-gray-900 flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-[#ff9900]" />
                    Acciones rápidas
                  </h2>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-4">
                    {quickActions.map(action => (
                      <a 
                        key={action.id} 
                        href={action.href}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-gray-100 hover:border-opacity-0 hover:shadow-md transition-all group ${action.bgHover}`}
                        target={action.href.startsWith('http') ? "_blank" : "_self"}
                        rel={action.href.startsWith('http') ? "noopener noreferrer" : ""}
                      >
                        <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          {action.icon}
                        </div>
                        <span className="text-sm font-medium text-gray-700 text-center group-hover:text-[#ff9900]">{action.title}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Upcoming activities with hover effects */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-white"></div>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-[#ff9900]" />
                      Próximas actividades
                    </h2>
                    <a href="/dashboard/calendar" className="text-[#ff9900] text-sm font-medium flex items-center hover:underline">
                      Ver todas
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </div>

                  <div className="space-y-3">
                    {loadingEvents ? (
                      // loading skeletons
                      [1,2,3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                      ))
                    ) : upcomingEvents.length > 0 ? (
                      upcomingEvents.map((evt, idx) => {
                        const dt = evt.date.toDate();
                        const isAllDay = dt.getHours()===0 && dt.getMinutes()===0 && dt.getSeconds()===0;
                        const dateLabel = isAllDay
                          ? `${dt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })} — Todo el día`
                          : `${dt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })}, ${dt.toLocaleTimeString('es-ES',{ hour:'2-digit',minute:'2-digit' })}`;

                        return (
                          <div
                            key={idx}
                            className="flex items-start p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-[#ff9900]/30 hover:shadow-sm"
                          >
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#ff9900]/10 flex items-center justify-center mr-4">
                              <Activity className="h-6 w-6 text-[#ff9900]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">{evt.title}</h3>
                              <p className="text-xs text-gray-500 mt-1">{dateLabel}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500">No hay próximas actividades</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Personal summary with shadow on hover */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-[#ff9900] via-[#ffb347] to-white"></div>
                  <div className="flex items-center mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff9900]/20 to-[#ff9900]/40 flex items-center justify-center">
                      <User className="h-8 w-8 text-[#ff9900]" />
                    </div>
                    <div className="ml-4">
                      <h2 className="font-bold text-gray-900">
                        {profile?.nombre ?? 'Cargando...'}
                      </h2>
                      <p className="text-sm text-gray-600 text-black">
                        {profile?.dpto ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Posición</p>
                        <p className="font-medium text-gray-900">{profile?.posicion ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Antigüedad</p>
                        <p className="font-medium text-gray-900">
                          {profile
                             ? `${profile.antiguedad} ${profile.antiguedad === 1 ? 'año' : 'años'}`
                             : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">EPS</p>
                        <p className="font-medium text-gray-900">{profile?.eps ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Banco</p>
                       <p className="font-medium text-gray-900">{profile?.banco ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Pension</p>
                        <p className="font-medium text-gray-900">{profile?.pensiones ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ARL</p>
                        <p className="font-medium text-gray-900">{profile?.arl ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending requests (cesantías + incapacidades/permiso) */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-blue-500 via-blue-400 to-white"></div>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-[#ff9900]" />
                      Solicitudes pendientes
                    </h2>
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#ff9900]/10 text-[#ff9900] text-xs font-medium">
                      {loadingRequests ? '…' : pendingRequests.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {loadingRequests ? (
                      // skeleton loaders
                      [1,2].map(i => (
                        <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                      ))
                    ) : pendingRequests.length > 0 ? (
                      pendingRequests.map(req => {
                        const dt = req.createdAt.toDate();
                        // pick the correct title
                        const title = req.tipo === 'cesantias'
                          ? 'Solicitud de Cesantías'
                          : req.tipo === 'enfermedad'
                            ? 'Solicitud de Incapacidad'
                            : 'Solicitud de Permiso';

                        return (
                          <div
                            key={req.id}
                            className="border border-gray-100 rounded-xl p-4 hover:border-[#ff9900]/30 hover:shadow-sm transition-all hover:bg-gray-50 flex justify-between items-start"
                          >
                            <div>
                              <h3 className="font-medium text-gray-900">{title}</h3>
                              <p className="text-xs text-gray-500 mt-1">
                                {dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            </div>
                            <span className="inline-block px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                              {req.estado}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500">No tienes solicitudes pendientes.</p>
                    )}
                  </div>
                </div>

                {/* Upcoming birthdays */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-green-500 via-green-400 to-white"></div>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <Gift className="h-5 w-5 mr-2 text-[#ff9900]" />
                      Próximos cumpleaños
                    </h2>
                  </div>

  <div className="space-y-4">
    {loadingBirthdays ? (
      // tres esqueletos de carga
      [1, 2, 3].map(i => (
        <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
      ))
    ) : upcomingBirthdays.length > 0 ? (
      upcomingBirthdays.map((person, idx) => {
        const dt = person.date.toDate()
        const dayMonth = dt.toLocaleDateString('es-ES', {
          day:   'numeric',
          month: 'long'
        })
        return (
          <div
            key={idx}
            className="flex items-center p-2 rounded-xl hover:bg-gray-50 transition-colors hover:shadow-sm transform hover:-translate-y-0.5 duration-200"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff9900]/20 bg-gray-100 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-gray-500" />
            </div>
            <div className="flex-1 ml-3">
              <h3 className="font-medium text-gray-900 truncate">{person.name}</h3>
              <p className="text-xs text-gray-500">{person.position}</p>
              <p className="text-xs text-gray-500">{dayMonth}</p>
            </div>
          </div>
        )
      })
    ) : (
      <p className="text-gray-500">No hay próximos cumpleaños</p>
    )}
  </div>

  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
    <a
      href="/dashboard/calendar"
      className="text-sm font-medium text-[#ff9900] inline-flex items-center hover:underline group"
    >
      Ver calendario completo
      <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
    </a>
  </div>
</div>


            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
else{
  return(
    <AdminPage />
  )
}
};

export default Dashboard;