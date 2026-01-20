"use client";

import React, { useState, useEffect } from 'react';
import DashboardNavbar from './navbar';
import { useRouter } from 'next/navigation';
import { 
  Calendar, DollarSign, Briefcase, ChevronRight, Clock, MessageSquare, FileText, Activity, User, CheckCircle,
  PersonStanding
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
  videoUrl?: string;
  videoPath?: string;

  _originalDate?: Date; // ✅ ADD THIS
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

// Helper function to add one day to a date
const addOneDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
};

// Helper function to determine if an event is happening today (after adding one day)
const isEventToday = (eventDate: Date) => {
  const adjustedDate = addOneDay(eventDate);
  const today = new Date();
  return adjustedDate.toDateString() === today.toDateString();
};

// Helper function to determine event status (with date adjustment)
const getEventStatus = (eventDate: Date) => {
  const adjustedDate = addOneDay(eventDate);
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const eventDateOnly = new Date(adjustedDate);
  eventDateOnly.setHours(0, 0, 0, 0);
  
  if (eventDateOnly.getTime() === today.getTime()) {
    // Check if it's an all-day event or if the time has passed
    const isAllDay = eventDate.getHours() === 0 && eventDate.getMinutes() === 0 && eventDate.getSeconds() === 0;
    if (isAllDay || adjustedDate > now) {
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

// Determina si HOY es cumpleaños (ignorando año)
const isBirthdayToday = (originalDate: Date): boolean => {
  const today = new Date();
  return (
    today.getDate() === originalDate.getDate() &&
    today.getMonth() === originalDate.getMonth()
  );
};

useEffect(() => {
  async function fetchNextEvent() {
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
          
          // Apply +1 day to the stored date (matching calendar behavior)
          const adjustedDate = addOneDay(storedDate);
          
          let comparisonDate = new Date(adjustedDate);

          // For birthdays, normalize to next occurrence (using the already adjusted date)
          if (
            data.type === 'cumpleaños' ||
            data.title.toLowerCase().includes('cumpleaños')
          ) {
            comparisonDate = normalizeBirthdayDate(adjustedDate);
          }

          // Set to start of day for comparison
          comparisonDate.setHours(0, 0, 0, 0);

          return {
            ...data,
            date: data.date, // Keep original Timestamp
            _originalDate: storedDate, // Store the original date from DB
            _adjustedDate: adjustedDate, // Store the +1 adjusted date
            _comparisonDate: comparisonDate, // Store the final comparison date
          };
        })
        // Keep only future or today events
        .filter(evt => {
          const eventDate = new Date(evt._comparisonDate!);
          eventDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return eventDate >= today;
        })
        // Sort by closest date
        .sort(
          (a, b) =>
            a._comparisonDate!.getTime() - b._comparisonDate!.getTime()
        );

      setNextEvent(events.length > 0 ? events[0] : null);
    } catch (error) {
      console.error('Error fetching next event:', error);
      setNextEvent(null);
    } finally {
      setLoadingEvent(false);
    }
  }

  fetchNextEvent();
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

  // Load upcoming events
  useEffect(() => {
  async function fetchUpcoming() {
    try {
      const q = query(
        collection(db, 'calendar'),
        orderBy('date', 'asc'),
        limit(50) // traemos más para cumpleaños antiguos
      );

      const snap = await getDocs(q);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const events = snap.docs
        .map(doc => {
          const data = doc.data() as CalendarEvent;
          const originalDate = data.date.toDate();

          let effectiveDate = originalDate;

          if (
            data.type === 'cumpleaños' ||
            data.title.toLowerCase().includes('cumpleaños')
          ) {
            effectiveDate = normalizeBirthdayDate(originalDate);
          }

          return {
            ...data,
            date: Timestamp.fromDate(effectiveDate),
          };
        })
        // 🔽 FILTRAMOS DESPUÉS DE NORMALIZAR
        .filter(evt => evt.date.toDate() >= now)
        // 🔽 ORDEN FINAL
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())
        // 🔽 SOLO LOS 3 PRÓXIMOS
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
    const isBirthday =
  nextEvent &&
  (
    nextEvent.type === 'cumpleaños' ||
    nextEvent.title.toLowerCase().includes('cumpleaños')
  ) &&
  isBirthdayToday(nextEvent._originalDate ?? nextEvent.date.toDate());

    
    // Birthday messages array
    const birthdayMessages = [
      "Eres un integrante muy importante de todo el equipo y esperamos que tengas un hermoso día junto a tu familia, compañeros y demás. ¡Que este nuevo año de vida esté lleno de éxitos y alegrías!",
      "Hoy celebramos tu día especial y queremos que sepas lo importante que eres para nuestro equipo. Que este cumpleaños sea el inicio de un año lleno de bendiciones, logros y momentos inolvidables.",
      "Tu dedicación y compromiso hacen de este equipo un lugar mejor cada día. Esperamos que celebres este día rodeado de las personas que más quieres y que recibas todo el amor que mereces. ¡Feliz cumpleaños!",
      "En este día tan especial, queremos reconocer todo lo que aportas a nuestro equipo. Tu presencia marca la diferencia y tu energía nos inspira. Que tu cumpleaños esté lleno de sorpresas maravillosas y momentos de felicidad.",
      "Hoy es un día para celebrarte a ti y todo lo que representas para nosotros. Eres una pieza fundamental de esta familia laboral. Deseamos que este nuevo año de vida te traiga prosperidad, salud y muchos motivos para sonreír."
    ];
    
    // Get random message (using event title as seed for consistency during the day)
    const randomMessage = nextEvent ? birthdayMessages[nextEvent.title.length % birthdayMessages.length] : birthdayMessages[0];
    
    if (isBirthday) {
      return (
        <div className="relative p-6 md:p-8">
          {/* Animated confetti background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-400 via-purple-400 via-blue-400 via-green-400 via-yellow-400 to-red-400"></div>
            {/* Decorative elements */}
            <div className="absolute top-4 left-4 text-yellow-400 text-2xl animate-pulse">🎈</div>
            <div className="absolute top-8 right-8 text-pink-400 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</div>
            <div className="absolute bottom-8 left-12 text-purple-400 text-xl animate-pulse" style={{ animationDelay: '0.4s' }}>✨</div>
            <div className="absolute bottom-12 right-16 text-blue-400 text-xl animate-bounce" style={{ animationDelay: '0.6s' }}>🎊</div>
          </div>

          <div className="relative flex flex-col md:flex-row items-center gap-6">
            {/* Left side - Birthday message */}
            <div className="md:flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100">
                <span className="text-2xl">🎂</span>
                <span className="text-sm font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 text-transparent bg-clip-text">
                  ¡Celebración Especial!
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 text-transparent bg-clip-text">
                {nextEvent?.title}
              </h2>

              {/* Date */}
              {(() => {
                const dt = nextEvent?.date.toDate();
                if (!dt) return null;
                const adjustedDt = addOneDay(dt);
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

              {/* Special birthday message */}
              <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-xl p-5 mb-5 border-2 border-purple-200">
                <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                  {randomMessage}
                </p>
              </div>

              {/* Show additional events if any */}
              {todayEventsCount > 1 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    📅 Hay {todayEventsCount} eventos hoy
                  </p>
                  {additionalTodayEvents.length > 0 && (
                    <div className="space-y-1">
                      {additionalTodayEvents.slice(0, 2).map((event, idx) => (
                        <p key={idx} className="text-xs text-blue-700">
                          • {event.title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <a href='dashboard/calendar'>
                <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-full font-bold text-sm hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-200">
                  Ver más celebraciones
                  <ChevronRight className="ml-2 h-5 w-5" />
                </button>
              </a>
            </div>

            {/* Right side - Image with birthday decoration */}
            <div className="flex-shrink-0 w-full md:w-auto relative">
              {nextEvent?.videoUrl && nextEvent.videoUrl.trim() !== '' ? (
  <div className="h-48 w-full md:w-72 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-purple-200 bg-black">
    <video
      src={nextEvent.videoUrl}
      controls
      playsInline
      preload="metadata"
      className="h-full w-full object-contain"
    />
  </div>
) : nextEvent?.image ? (
  <img
    src={nextEvent.image}
    alt={nextEvent.title}
    className="rounded-2xl shadow-2xl h-48 w-full object-cover md:w-72 ring-4 ring-purple-200"
  />
) : (
  <div className="h-48 w-full md:w-72 flex items-center justify-center text-6xl rounded-2xl bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 shadow-xl">
    🎂
  </div>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      // Regular event display
      return (
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-[#ff9900] via-[#ffb347] to-white"></div>

          <div className="md:flex-1 mb-6 md:mb-0 md:pr-6">
            {loadingEvent ? (
              <p className="text-gray-500">Cargando evento…</p>
            ) : nextEvent ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="inline-block px-3 py-1 rounded-full bg-[#ff9900]/10 text-[#ff9900] text-xs font-medium">
                    Evento destacado
                  </div>
                  {(() => {
                    const eventStatus = getEventStatus(nextEvent.date.toDate());
                    return (
                      <div className={`inline-block px-2 py-1 rounded-full ${eventStatus.color} text-white text-xs font-medium`}>
                        {eventStatus.label}
                      </div>
                    );
                  })()}
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  {nextEvent.title}
                </h2>

                {/* Format date/time or "All day" with +1 day adjustment */}
                {(() => {
  const dt = nextEvent.date.toDate();
  const adjustedDt = addOneDay(dt);
  const isAllDay = dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0;
  const isToday = isEventToday(dt);

  if (isAllDay) {
    return (
      <p className="text-xs text-gray-500 mb-3">
        {isToday ? 'Hoy' : adjustedDt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long'
        })} — Todo el día
      </p>
    );
  } else {
    return (
      <p className="text-xs text-gray-500 mb-3">
        {isToday ? 'Hoy' : adjustedDt.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long'
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
                
                {/* Show additional events today if any */}
                {todayEventsCount > 1 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      📅 Hay {todayEventsCount} eventos hoy
                    </p>
                    {additionalTodayEvents.length > 0 && (
                      <div className="space-y-1">
                        {additionalTodayEvents.slice(0, 2).map((event, idx) => (
                          <p key={idx} className="text-xs text-blue-700">
                            • {event.title}
                            {(() => {
                              const dt = event.date.toDate();
                              const isAllDay = dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0;
                              return isAllDay ? '' : ` (${dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`;
                            })()}
                          </p>
                        ))}
                        {additionalTodayEvents.length > 2 && (
                          <p className="text-xs text-blue-600">
                            y {additionalTodayEvents.length - 2} más...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
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

         <div className="flex-shrink-0 w-full md:w-auto">
  {loadingEvent ? (
    <div className="h-40 w-full md:w-64 bg-gray-100 rounded-xl animate-pulse" />
  ) : nextEvent ? (
    nextEvent.videoUrl && nextEvent.videoUrl.trim() !== '' ? (
      <div className="h-40 w-full md:w-64 rounded-xl overflow-hidden bg-black shadow">
        <video
          key={nextEvent.videoUrl}
          src={nextEvent.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
        />
      </div>
    ) : nextEvent.image ? (
      <img
        src={nextEvent.image}
        alt={nextEvent.title}
        className="rounded-xl shadow h-40 w-full object-cover md:w-64"
      />
    ) : (
      <div className="h-40 w-full md:w-64 flex items-center justify-center text-gray-400 rounded-xl border border-gray-200">
        No hay media
      </div>
    )
  ) : (
    <div className="h-40 w-full md:w-64 flex items-center justify-center text-gray-400 rounded-xl border border-gray-200">
      No hay evento
    </div>
  )}
</div>

        </div>
      );
    }
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
                        const adjustedDt = addOneDay(dt); // Add one day for display
                        const isAllDay = dt.getHours()===0 && dt.getMinutes()===0 && dt.getSeconds()===0;
                        const dateLabel = isAllDay
                          ? `${adjustedDt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })} — Todo el día`
                          : `${adjustedDt.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric' })}, ${dt.toLocaleTimeString('es-ES',{ hour:'2-digit',minute:'2-digit' })}`;

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