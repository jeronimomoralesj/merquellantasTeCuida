"use client";

import React, { useState, useEffect } from 'react';
import DashboardNavbar from './navbar';
import { useRouter } from 'next/navigation';
import { 
  Calendar, DollarSign, Briefcase, ChevronRight, Clock, MessageSquare, FileText, Activity, User, CheckCircle,
  PersonStanding,
  ChevronLeft
} from 'lucide-react';
import Solicitudes from "./components/solicitudes";
import AdminPage from './admin/page';
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase'
import GeminiChat from './components/chat';
interface CalendarEvent {
  title: string;
  description: string;
  image: string;
  date: Timestamp;
  type?: string;
  videoUrl?: string;
  videoPath?: string;
  _originalDate?: Date;
  _displayDate?: Date;
  _comparisonDate?: Date;
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

interface UserData {
  nombre: string;
  rol: string;
  posicion: string;
  antiguedad: number | string; // Can be Excel date number or regular number
  extra?: {
    "Nombre Área Funcional"?: string;
    "EPS"?: string;
    "Banco"?: string;
    "FONDO DE PENSIONES"?: string;
    "ARL"?: string;
    "Fecha Ingreso"?: number | string; // Excel date number or date string
  };
}

const Dashboard = () => {
  const [showSolicitudes, setShowSolicitudes] = useState(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
const [currentEventIndex, setCurrentEventIndex] = useState(0);
  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Upcoming events state
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

const [todayEventsCount, setTodayEventsCount] = useState(0);
const [additionalTodayEvents, setAdditionalTodayEvents] = useState<CalendarEvent[]>([]);

// Helper function to add one day to a date
const addOneDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
};

// Helper function to convert Excel date number to JavaScript Date
const convertExcelDateToJSDate = (excelDate: number | string): Date => {
  if (typeof excelDate === 'string') {
    // If it's already a string, try to parse it as a date
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    // If parsing fails, try to convert to number
    const num = parseFloat(excelDate);
    if (!isNaN(num)) {
      excelDate = num;
    } else {
      return new Date(); // fallback to current date
    }
  }
  
  if (typeof excelDate === 'number') {
    // Excel date calculation: days since January 1, 1900
    // Note: Excel incorrectly treats 1900 as a leap year, so we subtract 2 days
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const excelEpoch = new Date(1900, 0, 1); // January 1, 1900
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * millisecondsPerDay);
    return jsDate;
  }
  
  return new Date(); // fallback
};

// Helper function to calculate years of service
const calculateYearsOfService = (startDate: Date): number => {
  const today = new Date();
  const diffTime = today.getTime() - startDate.getTime();
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); // Account for leap years
  return Math.floor(diffYears);
};

// Helper function to determine if an event is happening today (after adding one day)
const isEventToday = (eventDate: Date) => {
  const adjustedDate = eventDate;
  const today = new Date();
  return adjustedDate.toDateString() === today.toDateString();
};

const getEventStatus = (event: CalendarEvent) => {
  const eventDate = event._comparisonDate || event.date.toDate();
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const eventDateOnly = new Date(eventDate);
  eventDateOnly.setHours(0, 0, 0, 0);
  
  // For birthdays, check if it's today based on month and day
  if (event.type === 'cumpleaños' || event.type === 'birthday' || event.title.toLowerCase().includes('cumpleaños')) {
    const isBirthdayToday = 
      eventDate.getDate() === today.getDate() && 
      eventDate.getMonth() === today.getMonth();
    
    if (isBirthdayToday) {
      return { status: 'today', label: 'Hoy', color: 'bg-green-500' };
    } else if (eventDateOnly > today) {
      return { status: 'upcoming', label: 'Próximo', color: 'bg-[#ff9900]' };
    }
  }
  
  // For regular events
  if (eventDateOnly.getTime() === today.getTime()) {
    const originalDate = event.date.toDate();
    const isAllDay = originalDate.getHours() === 0 && originalDate.getMinutes() === 0 && originalDate.getSeconds() === 0;
    if (isAllDay || eventDate > now) {
      return { status: 'today', label: 'Hoy', color: 'bg-green-500' };
    } else {
      return { status: 'happening', label: 'En curso', color: 'bg-blue-500' };
    }
  } else if (eventDateOnly > today) {
    return { status: 'upcoming', label: 'Próximo', color: 'bg-[#ff9900]' };
  }
  return { status: 'past', label: 'Pasado', color: 'bg-gray-500' };
};

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

// Normaliza una fecha de cumpleaños al próximo cumpleaños válido
const normalizeBirthdayDate = (originalDate: Date): Date => {
  const today = new Date();
  const currentYear = today.getFullYear();

  const birthdayThisYear = new Date(
    currentYear,
    originalDate.getMonth(),
    originalDate.getDate()
  );

  birthdayThisYear.setHours(0, 0, 0, 0);

  // Si ya pasó este año, usar el siguiente
  if (birthdayThisYear < today) {
    birthdayThisYear.setFullYear(currentYear + 1);
  }

  return birthdayThisYear;
};

const isBirthdayToday = (originalDate: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(originalDate);
  checkDate.setHours(0, 0, 0, 0);
  
  return (
    today.getDate() === checkDate.getDate() &&
    today.getMonth() === checkDate.getMonth()
  );
};

useEffect(() => {
  async function fetchNextEvents() {
    try {
      setLoadingEvent(true);

      const q = query(
        collection(db, 'calendar'),
        orderBy('date', 'asc'),
        limit(100)
      );

      const snap = await getDocs(q);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const events = snap.docs
        .map(doc => {
          const data = doc.data() as CalendarEvent;
          const storedDate = data.date.toDate();
          
          const displayDate = addOneDay(storedDate);
          
          let comparisonDate: Date;

          if (
            data.type === 'cumpleaños' ||
            data.type === 'birthday' ||
            data.title.toLowerCase().includes('cumpleaños')
          ) {
            comparisonDate = normalizeBirthdayDate(displayDate);
          } else {
            comparisonDate = new Date(displayDate);
          }

          comparisonDate.setHours(0, 0, 0, 0);

          return {
            ...data,
            date: Timestamp.fromDate(displayDate),
            _originalDate: storedDate,
            _displayDate: displayDate,
            _comparisonDate: comparisonDate,
          };
        })
        .filter(evt => evt._comparisonDate! >= now)
        .sort((a, b) => a._comparisonDate!.getTime() - b._comparisonDate!.getTime())
        .slice(0, 3); // Take only the 3 closest events

      const todayEvents = events.filter(evt => {
        const evtDate = new Date(evt._comparisonDate!);
        evtDate.setHours(0, 0, 0, 0);
        return evtDate.getTime() === now.getTime();
      });

      setTodayEventsCount(todayEvents.length);
      
      if (todayEvents.length > 1) {
        setAdditionalTodayEvents(todayEvents.slice(1));
      } else {
        setAdditionalTodayEvents([]);
      }

      setNextEvent(events.length > 0 ? events[0] : null);
      setUpcomingEvents(events); // This will now contain up to 3 events
    } catch (error) {
      console.error('Error fetching next events:', error);
      setNextEvent(null);
      setUpcomingEvents([]);
    } finally {
      setLoadingEvent(false);
    }
  }

  fetchNextEvents();
}, []);

  // Load user profile with date conversion and antiguedad calculation
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
        
        // Handle antiguedad calculation
        let calculatedAntiguedad = 0;
        
        // Check if there's a "Fecha Ingreso" in extra data
        if (data.extra?.["Fecha Ingreso"]) {
          const fechaIngreso = data.extra["Fecha Ingreso"];
          console.log("Fecha Ingreso found:", fechaIngreso);
          
          // Convert the Excel date number to JavaScript Date
          const startDate = convertExcelDateToJSDate(fechaIngreso);
          console.log("Converted start date:", startDate);
          
          // Calculate years of service
          calculatedAntiguedad = calculateYearsOfService(startDate);
          console.log("Calculated antiguedad:", calculatedAntiguedad);
        } else if (data.antiguedad) {
          // If there's an antiguedad field, check if it's an Excel date or regular number
          if (typeof data.antiguedad === 'number' && data.antiguedad > 1000) {
            // Looks like an Excel date number (bigger than reasonable years)
            const startDate = convertExcelDateToJSDate(data.antiguedad);
            calculatedAntiguedad = calculateYearsOfService(startDate);
            console.log("Converted antiguedad from Excel date:", calculatedAntiguedad);
          } else {
            // Regular number, use as is
            calculatedAntiguedad = typeof data.antiguedad === 'string' 
              ? parseInt(data.antiguedad) || 0 
              : data.antiguedad;
          }
        }
        
        setProfile({
          nombre: data.nombre,
          rol: data.rol,
          posicion: data.posicion,
          dpto: dpto,
          eps: eps,
          banco: banco,
          pensiones: pensiones,
          arl: arl,
          antiguedad: calculatedAntiguedad
        });
        setUserRole(data.rol || "user");
      }
    });
    return () => unsub();
  }, []);

useEffect(() => {
  async function fetchUpcoming() {
    try {
      setLoadingEvents(true);
      
      const q = query(
        collection(db, 'calendar'),
        orderBy('date', 'asc'),
        limit(100)
      );

      const snap = await getDocs(q);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const events = snap.docs
        .map(doc => {
          const data = doc.data() as CalendarEvent;
          const storedDate = data.date.toDate();
          
          // Add +1 day to match what was subtracted during storage
          const displayDate = addOneDay(storedDate);
          
          let comparisonDate: Date;

          // For birthdays, normalize to next occurrence
          if (
            data.type === 'cumpleaños' ||
            data.type === 'birthday' ||
            data.title.toLowerCase().includes('cumpleaños')
          ) {
            comparisonDate = normalizeBirthdayDate(displayDate);
          } else {
            comparisonDate = new Date(displayDate);
          }

          comparisonDate.setHours(0, 0, 0, 0);

          return {
            ...data,
            date: Timestamp.fromDate(comparisonDate),
            _originalDate: storedDate,
            _displayDate: displayDate,
          };
        })
        // Filter: keep only future or today events
        .filter(evt => evt.date.toDate() >= now)
        // Sort by closest date
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())
        // Take only the 3 closest events
        .slice(0, 3);

      setUpcomingEvents(events);
    } catch (e) {
      console.error('Error fetching upcoming:', e);
    } finally {
      setLoadingEvents(false);
    }
  }

  fetchUpcoming();
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
<Solicitudes onClose={() => setShowSolicitudes(false)} />
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
      id: 4, 
      title: "Seguridad social", 
      icon: <MessageSquare className="h-5 w-5" />, 
      color: "bg-green-100 text-green-600",
      bgHover: "hover:bg-gradient-to-br from-green-50 to-green-100",
      href: "https://www.aportesenlinea.com/Autoservicio/CertificadoAportes.aspx"
    },
    { 
      id: 5, 
      title: "Gente útil", 
      icon: <PersonStanding className="h-5 w-5" />, 
      color: "bg-red-100 text-red-600",
      bgHover: "hover:bg-gradient-to-br from-red-50 to-red-100",
      href: "https://genteutil.net/"
    },
    { 
      id: 6, 
      title: "Temporales 1A", 
      icon: <PersonStanding className="h-5 w-5" />, 
      color: "bg-gray-100 text-gray-600",
      bgHover: "hover:bg-gradient-to-br from-gray-50 to-gray-100",
      href: "https://temporalesunoa.com.co/"
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
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar />
        <GeminiChat />
        {/* Admin content appears first if the user is admin */}
    {userRole === "admin" && (
      <div className="border-b border-gray-200">
        <AdminPage />
      </div>
    )}
        {/* Main content */}
        <main className="pb-16 px-4 sm:px-6 lg:px-8">
          <br />
          <br />
          <br />
          <div className="max-w-7xl mx-auto">
            {/* Header with welcome message */}
            <div className="mb-8 mt-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center">
                <span className="bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text">
                  ¡Bienvenido a Nuestra Gente!
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
  {(() => {
    if (loadingEvent) {
      return (
        <div className="relative p-6 md:p-8">
          <div className="h-48 bg-gray-100 animate-pulse rounded-xl"></div>
        </div>
      );
    }

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return (
        <div className="relative p-6 md:p-8">
          <p className="text-gray-500">No hay eventos próximos</p>
        </div>
      );
    }

    const currentEvent = upcomingEvents[currentEventIndex];
    const isBirthday = currentEvent && (
      currentEvent.type === 'cumpleaños' ||
      currentEvent.type === 'birthday' ||
      currentEvent.title.toLowerCase().includes('cumpleaños')
    );
    const isCurrentBirthdayToday = isBirthday && currentEvent._originalDate && isBirthdayToday(currentEvent._originalDate);

    if (isCurrentBirthdayToday) {
      // Birthday messages array
      const birthdayMessages = [
        "Eres un integrante muy importante de todo el equipo y esperamos que tengas un hermoso día junto a tu familia, compañeros y demás. ¡Que este nuevo año de vida esté lleno de éxitos y alegrías!",
        "Hoy celebramos tu día especial y queremos que sepas lo importante que eres para nuestro equipo. Que este cumpleaños sea el inicio de un año lleno de bendiciones, logros y momentos inolvidables.",
        "Tu dedicación y compromiso hacen de este equipo un lugar mejor cada día. Esperamos que celebres este día rodeado de las personas que más quieres y que recibas todo el amor que mereces. ¡Feliz cumpleaños!",
        "En este día tan especial, queremos reconocer todo lo que aportas a nuestro equipo. Tu presencia marca la diferencia y tu energía nos inspira. Que tu cumpleaños esté lleno de sorpresas maravillosas y momentos de felicidad.",
        "Hoy es un día para celebrarte a ti y todo lo que representas para nosotros. Eres una pieza fundamental de esta familia laboral. Deseamos que este nuevo año de vida te traiga prosperidad, salud y muchos motivos para sonreír."
      ];
      
      const randomMessage = birthdayMessages[currentEvent.title.length % birthdayMessages.length];
      
      return (
        <div className="relative p-6 md:p-8">
          {/* Birthday decorations with orange theme */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ff9900] via-[#ffb347] to-[#ffd700]"></div>
            <div className="absolute top-4 left-4 text-[#ff9900] text-2xl animate-pulse">🎈</div>
            <div className="absolute top-8 right-8 text-[#ffb347] text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</div>
            <div className="absolute bottom-8 left-12 text-[#ffd700] text-xl animate-pulse" style={{ animationDelay: '0.4s' }}>✨</div>
            <div className="absolute bottom-12 right-16 text-[#ff9900] text-xl animate-bounce" style={{ animationDelay: '0.6s' }}>🎊</div>
          </div>

          <div className="relative flex flex-col md:flex-row items-center gap-6">
            {/* Carousel navigation - Left */}
            {upcomingEvents.length > 1 && (
              <button
                onClick={() => setCurrentEventIndex((prev) => (prev === 0 ? upcomingEvents.length - 1 : prev - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg hover:shadow-xl transition-all"
              >
                <ChevronLeft className="h-5 w-5 text-[#ff9900]" />
              </button>
            )}

            {/* Birthday content */}
            <div className="md:flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff9900]/20 via-[#ffb347]/20 to-[#ffd700]/20">
                <span className="text-2xl">🎂</span>
                <span className="text-sm font-bold bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text">
                  ¡Celebración Especial!
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text">
                {currentEvent.title}
              </h2>

              {(() => {
                const dt = currentEvent.date.toDate();
                const adjustedDt = dt;
                const isToday = isEventToday(dt);

                return (
                  <p className="text-sm text-gray-600 mb-4 font-medium">
                    {isToday ? '🎈 ¡Hoy es el gran día!' : `📅 ${adjustedDt.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long'
                    })}`}
                  </p>
                );
              })()}

              <div className="bg-gradient-to-br from-[#ff9900]/10 via-[#ffb347]/10 to-[#ffd700]/10 rounded-xl p-5 mb-5 border-2 border-[#ff9900]/30">
                <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                  {randomMessage}
                </p>
              </div>

              {/* Carousel indicator dots */}
              {upcomingEvents.length > 1 && (
                <div className="flex justify-center md:justify-start gap-2 mb-4">
                  {upcomingEvents.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentEventIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentEventIndex 
                          ? 'w-8 bg-[#ff9900]' 
                          : 'w-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              )}

              <a href='dashboard/calendar'>
                <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-white rounded-full font-bold text-sm hover:from-[#e68a00] hover:to-[#ff9900] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-200">
                  Ver más celebraciones
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              </a>
            </div>

            {/* Right side - Image/Video */}
            <div className="flex-shrink-0 w-full md:w-auto relative">
              {currentEvent.videoUrl && currentEvent.videoUrl.trim() !== '' ? (
                <div className="h-48 w-full md:w-72 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-[#ff9900]/30 bg-black">
                  <video
                    src={currentEvent.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : currentEvent.image ? (
                <img
                  src={currentEvent.image}
                  alt={currentEvent.title}
                  className="rounded-2xl shadow-2xl h-48 w-full object-cover md:w-72 ring-4 ring-[#ff9900]/30"
                />
              ) : (
                <div className="h-48 w-full md:w-72 flex items-center justify-center text-6xl rounded-2xl bg-gradient-to-br from-[#ff9900]/20 via-[#ffb347]/20 to-[#ffd700]/20 shadow-xl">
                  🎂
                </div>
              )}
            </div>

            {/* Carousel navigation - Right */}
            {upcomingEvents.length > 1 && (
              <button
                onClick={() => setCurrentEventIndex((prev) => (prev === upcomingEvents.length - 1 ? 0 : prev + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg hover:shadow-xl transition-all"
              >
                <ChevronRight className="h-5 w-5 text-[#ff9900]" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // Regular event (birthday or not, but not today)
    return (
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center">
        <div className={`absolute top-0 ${isBirthday ? 'left' : 'right'}-0 w-full h-1 bg-gradient-to-${isBirthday ? 'r' : 'r'} from-[#ff9900] via-[#ffb347] to-white`}></div>

        {/* Carousel navigation - Left */}
        {upcomingEvents.length > 1 && (
          <button
            onClick={() => setCurrentEventIndex((prev) => (prev === 0 ? upcomingEvents.length - 1 : prev - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white hover:bg-gray-50 shadow-md hover:shadow-lg transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-[#ff9900]" />
          </button>
        )}

        <div className="md:flex-1 mb-6 md:mb-0 md:pr-6">
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                isBirthday 
                  ? 'bg-[#ff9900]/20 text-[#ff9900] border-2 border-[#ff9900]/30' 
                  : 'bg-[#ff9900]/10 text-[#ff9900]'
              }`}>
                {isBirthday ? '🎂 Próximo cumpleaños' : 'Evento destacado'}
              </div>
              {(() => {
                const eventStatus = getEventStatus(currentEvent);
                return (
                  <div className={`inline-block px-2 py-1 rounded-full ${eventStatus.color} text-white text-xs font-medium`}>
                    {eventStatus.label}
                  </div>
                );
              })()}
            </div>

            <h2 className={`text-xl md:text-2xl font-bold mb-2 ${
              isBirthday 
                ? 'bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text' 
                : 'text-gray-900'
            }`}>
              {currentEvent.title}
            </h2>

            {(() => {
              const dt = currentEvent.date.toDate();
              const adjustedDt = dt;
              const isAllDay = dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0;
              const isToday = isEventToday(dt);

              if (isAllDay) {
                return (
                  <p className="text-xs text-gray-500 mb-3">
                    {isToday ? 'Hoy' : adjustedDt.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: isBirthday ? undefined : 'numeric'
                    })} — Todo el día
                  </p>
                );
              } else {
                return (
                  <p className="text-xs text-gray-500 mb-3">
                    {isToday ? 'Hoy' : adjustedDt.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: isBirthday ? undefined : 'numeric'
                    })},{' '}
                    {dt.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                );
              }
            })()}

            {(() => {
  if (isBirthday) {
    const birthdayMessages = [
     "¡Feliz cumpleaños! En Merquellantas nos sentimos orgullosos de contar con tu talento. Que este nuevo año de vida venga cargado de kilómetros de éxitos y alegrías. ¡Disfruta tu día!",
  "Hoy celebramos la vida de una pieza fundamental de nuestra familia. De parte de todo el equipo de Merquellantas, te deseamos un cumpleaños extraordinario. ¡Gracias por rodar con nosotros!",
  "¡Felicidades en tu día! Para Merquellantas es un honor tenerte en el equipo. Esperamos que este día esté lleno de sonrisas, buena compañía y el reconocimiento que mereces.",
  "¡Llegó el momento de celebrar! En Merquellantas nos unimos a tu alegría y te deseamos un año lleno de prosperidad y momentos inolvidables. ¡Que pases un muy feliz cumpleaños!",
  "Hoy los aplausos son para ti. En Merquellantas celebramos no solo un año más de tu vida, sino tu valiosa contribución a nuestra empresa. ¡Que sea un día memorable!",
  "¡Es momento de hacer una parada para celebrar! En Merquellantas te deseamos un feliz cumpleaños lleno de buena energía y que este año sigas avanzando con paso firme hacia tus metas.",
  "¡Felicidades! Que este nuevo año sea como un camino libre de obstáculos y lleno de grandes destinos. Gracias por poner todo tu esfuerzo y pasión en el equipo de Merquellantas.",
  "En Merquellantas celebramos tu vida y tu talento. Deseamos que este día sea el inicio de una vuelta más al sol llena de salud, éxito y momentos especiales junto a los que más quieres.",
  "¡Feliz cumpleaños! Eres parte del engranaje que hace que Merquellantas llegue cada día más lejos. Esperamos que disfrutes de un día extraordinario y muy merecido.",
  "¡Hoy celebramos que eres parte de Merquellantas! Que la alegría de este día te acompañe durante todo el año y que sigamos compartiendo muchos éxitos más en el camino."
];
    
    const randomMessage = birthdayMessages[currentEvent.title.length % birthdayMessages.length];
    
    return (
      <div className="mb-4 p-4 bg-gradient-to-br from-[#ff9900]/10 to-[#ffb347]/10 rounded-lg border-l-4 border-[#ff9900]">
        <p className="text-gray-700 leading-relaxed text-sm md:text-base">
          {randomMessage}
        </p>
      </div>
    );
  } else {
    return <p className="mb-4 text-gray-600">{currentEvent.description}</p>;
  }
})()}

            {isBirthday && currentEvent.videoUrl && (
              <div className="mb-4 p-3 bg-[#ff9900]/10 rounded-lg border border-[#ff9900]/30">
                <p className="text-sm text-[#ff9900] font-medium flex items-center">
                  <span className="mr-2">🎬</span> Este cumpleaños tiene un video especial
                </p>
              </div>
            )}

            {/* Carousel indicator dots */}
            {upcomingEvents.length > 1 && (
              <div className="flex gap-2 mb-4">
                {upcomingEvents.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentEventIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentEventIndex 
                        ? 'w-8 bg-[#ff9900]' 
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}

            <a href='dashboard/calendar'>
              <button className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-white rounded-full font-medium text-sm hover:from-[#e68a00] hover:to-[#ff9900] transition-all shadow-sm hover:shadow transform hover:-translate-y-0.5 duration-200">
                Ver detalles
                <ChevronRight className="ml-1 h-4 w-4" />
              </button>
            </a>
          </>
        </div>

        <div className="flex-shrink-0 w-full md:w-auto">
          {currentEvent.videoUrl && currentEvent.videoUrl.trim() !== '' ? (
            <div className={`h-40 w-full md:w-64 rounded-xl overflow-hidden bg-black shadow ${
              isBirthday ? 'ring-4 ring-[#ff9900]/30' : ''
            }`}>
              <video
                key={currentEvent.videoUrl}
                src={currentEvent.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            </div>
          ) : currentEvent.image || isBirthday ? (
            <img
              src={isBirthday 
                ? "https://thumbs.dreamstime.com/b/imprimir-parte-corporativa-cumplea%C3%B1os-de-empleados-la-gente-desea-un-feliz-ilustraci%C3%B3n-vectorial-plana-bolas-torta-crackers-184335154.jpg"
                : currentEvent.image
              }
              alt={currentEvent.title}
              className={`rounded-xl shadow h-40 w-full object-cover md:w-64 ${
                isBirthday ? 'ring-4 ring-[#ff9900]/30' : ''
              }`}
            />
          ) : (
            <div className={`h-40 w-full md:w-64 flex items-center justify-center rounded-xl border border-gray-200 ${
              isBirthday 
                ? 'text-6xl bg-gradient-to-br from-[#ff9900]/20 to-[#ffb347]/20' 
                : 'text-gray-400'
            }`}>
              {isBirthday ? '🎂' : 'No hay media'}
            </div>
          )}
        </div>

        {/* Carousel navigation - Right */}
        {upcomingEvents.length > 1 && (
          <button
            onClick={() => setCurrentEventIndex((prev) => (prev === upcomingEvents.length - 1 ? 0 : prev + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white hover:bg-gray-50 shadow-md hover:shadow-lg transition-all"
          >
            <ChevronRight className="h-5 w-5 text-[#ff9900]" />
          </button>
        )}
      </div>
    );
  })()}
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
                      Ver calendario
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
      const adjustedDt = dt; 
      const isAllDay = dt.getHours()===0 && dt.getMinutes()===0 && dt.getSeconds()===0;
      const isBirthday = evt.type === 'cumpleaños' || evt.type === 'birthday' || evt.title.toLowerCase().includes('cumpleaños');
      
      const dateLabel = isAllDay
        ? `${adjustedDt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })} — Todo el día`
        : `${adjustedDt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })}, ${dt.toLocaleTimeString('es-ES',{ hour:'2-digit',minute:'2-digit' })}`;

      return (
        <div
          key={idx}
          className={`flex items-start p-4 rounded-xl transition-colors border hover:shadow-sm ${
            isBirthday 
              ? 'bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border-pink-200 hover:border-pink-300' 
              : 'hover:bg-gray-50 border-gray-100 hover:border-[#ff9900]/30'
          }`}
        >
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
            isBirthday 
              ? 'bg-gradient-to-br from-pink-400 to-purple-400' 
              : 'bg-[#ff9900]/10'
          }`}>
            {isBirthday ? (
              <span className="text-2xl">🎂</span>
            ) : (
              <Activity className="h-6 w-6 text-[#ff9900]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate ${
              isBirthday ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-transparent bg-clip-text' : 'text-gray-900'
            }`}>
              {evt.title}
            </h3>
            <p className={`text-xs mt-1 ${isBirthday ? 'text-purple-600' : 'text-gray-500'}`}>
              {dateLabel}
            </p>
            {isBirthday && evt.videoUrl && (
              <p className="text-xs text-pink-600 mt-1 flex items-center">
                <span className="mr-1">🎬</span> Con video
              </p>
            )}
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
                        <p className="text-sm text-gray-500">Area</p>
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

                {/* Salario emocional section */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;