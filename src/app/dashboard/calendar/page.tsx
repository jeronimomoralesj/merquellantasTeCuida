"use client";

import React, { useState, useEffect, useMemo } from "react";
import DashboardNavbar from "../navbar";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  Clock,
  Gift,
  Sparkles,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  time?: string;
  type: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // +1 day to compensate for stored UTC offset (kept from original)
  const addOneDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    return newDate;
  };

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const res = await fetch("/api/calendar");
        if (!res.ok) throw new Error("Failed to fetch events");
        const data: { id: string; title: string; description: string; date: string; time?: string; type: string }[] = await res.json();

        const events = data.map((item) => {
          const storedDate = new Date(item.date);
          return {
            id: item.id,
            title: item.title || "",
            description: item.description || "",
            date: addOneDay(storedDate),
            time: item.time || undefined,
            type: item.type || "event",
          };
        });

        setAllEvents(events);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const goToPreviousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => {
    const t = new Date();
    setCurrentDate(t);
    setSelectedDate(t);
  };

  const isBirthday = (e: CalendarEvent) =>
    e.type === "birthday" ||
    e.type === "cumpleaños" ||
    e.title.toLowerCase().includes("cumpleaños");

  const getEventsForDate = (date: Date) => {
    if (!allEvents.length) return [];
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    return allEvents.filter((event) => {
      const eventDate = new Date(event.date);
      if (isBirthday(event)) {
        return eventDate.getDate() === day && eventDate.getMonth() === month;
      }
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const eventsForSelectedDate = useMemo(
    () => (selectedDate ? getEventsForDate(selectedDate) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, allEvents]
  );

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSidebarOpen(true);
  };

  const closeSidebar = () => setSidebarOpen(false);

  // Calendar grid generation (Monday-first)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let dayOfWeek = firstDayOfMonth.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const daysInPrev = new Date(year, month, 0).getDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const isToday = (date: Date) => {
    const t = new Date();
    return (
      date.getDate() === t.getDate() &&
      date.getMonth() === t.getMonth() &&
      date.getFullYear() === t.getFullYear()
    );
  };

  const isSelected = (date: Date) =>
    !!selectedDate &&
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const formatLongDate = (date: Date) =>
    date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Upcoming events (next 5 from today)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allEvents
      .map((e) => {
        const next = new Date(e.date);
        if (isBirthday(e)) {
          next.setFullYear(today.getFullYear());
          if (next < today) next.setFullYear(today.getFullYear() + 1);
        }
        return { ...e, _next: next };
      })
      .filter((e) => e._next >= today)
      .sort((a, b) => a._next.getTime() - b._next.getTime())
      .slice(0, 5);
  }, [allEvents]);

  const monthLabel = currentDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage="" />

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-black">
        <div className="max-w-7xl mx-auto">
          {/* HERO header */}
          <section className="relative mb-6 overflow-hidden rounded-3xl bg-black text-white shadow-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 12% 20%, #ff9900 0, transparent 45%), radial-gradient(circle at 88% 90%, #ff9900 0, transparent 35%)",
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
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff9900] to-transparent" />

            <div className="relative p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff9900]/15 text-[#ff9900] text-xs font-semibold uppercase tracking-wider border border-[#ff9900]/30">
                  <Sparkles className="h-3.5 w-3.5" /> Calendario
                </span>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
                  Eventos <span className="text-[#ff9900]">Merquellantas</span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-white/70 capitalize">{monthLabel}</p>
              </div>

              {/* Month nav */}
              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 rounded-xl bg-[#ff9900] text-black text-sm font-bold hover:bg-[#ffae33] active:scale-95 transition-all shadow-lg shadow-[#ff9900]/20"
                >
                  Hoy
                </button>
                <div className="flex items-center bg-white/10 border border-white/15 rounded-xl p-1">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-lg hover:bg-white/10 transition"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-lg hover:bg-white/10 transition"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#ff9900] border-t-transparent" />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Days of week */}
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                      <div
                        key={day}
                        className="p-3 text-center text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                      const events = getEventsForDate(day.date);
                      const today = isToday(day.date);
                      const selected = isSelected(day.date);
                      const colIdx = index % 7;
                      const rowIdx = Math.floor(index / 7);
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateClick(day.date)}
                          className={`relative text-left min-h-20 sm:min-h-28 p-1.5 sm:p-2 transition-all
                            ${colIdx !== 0 ? "border-l border-gray-100" : ""}
                            ${rowIdx !== 0 ? "border-t border-gray-100" : ""}
                            ${!day.isCurrentMonth ? "bg-gray-50/50 text-gray-400" : "bg-white hover:bg-[#ff9900]/5"}
                            ${selected ? "ring-2 ring-[#ff9900] z-10" : ""}
                          `}
                        >
                          <div
                            className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold mb-1 transition-colors
                              ${today ? "bg-[#ff9900] text-black shadow-md" : ""}
                              ${selected && !today ? "bg-black text-[#ff9900]" : ""}
                              ${!today && !selected ? "text-gray-700" : ""}
                            `}
                          >
                            {day.date.getDate()}
                          </div>

                          {events.length > 0 && (
                            <div className="space-y-1">
                              {events.slice(0, 2).map((event) => {
                                const bday = isBirthday(event);
                                return (
                                  <div
                                    key={event.id}
                                    className={`hidden sm:flex items-center text-[10px] px-1.5 py-0.5 rounded truncate ${
                                      bday
                                        ? "bg-pink-100 text-pink-700"
                                        : "bg-[#ff9900]/15 text-[#ff9900]"
                                    }`}
                                  >
                                    {bday ? (
                                      <Gift size={10} className="mr-1 flex-shrink-0" />
                                    ) : (
                                      <CalendarIcon size={10} className="mr-1 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{event.title}</span>
                                  </div>
                                );
                              })}
                              {events.length > 2 && (
                                <div className="hidden sm:block text-[10px] text-gray-500 pl-1">
                                  +{events.length - 2} más
                                </div>
                              )}
                              {/* Mobile dots */}
                              <div className="flex sm:hidden gap-0.5 mt-0.5">
                                {events.slice(0, 4).map((e) => (
                                  <span
                                    key={e.id}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isBirthday(e) ? "bg-pink-500" : "bg-[#ff9900]"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: upcoming events */}
            <aside className="hidden lg:block">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-[#ff9900]" /> Próximos eventos
                  </h3>
                </div>
                <div className="p-3">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      No hay próximos eventos.
                    </p>
                  ) : (
                    upcomingEvents.map((evt) => {
                      const bday = isBirthday(evt);
                      return (
                        <button
                          key={evt.id}
                          onClick={() => handleDateClick(evt._next)}
                          className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-[#ff9900]/5 transition-colors"
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              bday
                                ? "bg-pink-100 text-pink-600"
                                : "bg-[#ff9900]/10 text-[#ff9900]"
                            }`}
                          >
                            {bday ? <Gift size={16} /> : <CalendarIcon size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {evt.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {evt._next.toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "long",
                              })}
                              {evt.time ? ` · ${evt.time}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="relative p-5 bg-black text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 90% 30%, #ff9900 0, transparent 50%)",
              }}
            />
            <div className="relative flex justify-between items-start">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#ff9900]">
                  Detalles del día
                </p>
                <h2 className="mt-1 text-lg font-extrabold capitalize truncate">
                  {selectedDate ? formatLongDate(selectedDate) : ""}
                </h2>
              </div>
              <button
                onClick={closeSidebar}
                className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {eventsForSelectedDate.length > 0 ? (
              <div className="space-y-3">
                {eventsForSelectedDate.map((event) => {
                  const bday = isBirthday(event);
                  return (
                    <div
                      key={event.id}
                      className={`relative bg-white border border-gray-200 rounded-xl overflow-hidden`}
                    >
                      <div
                        className={`absolute top-0 left-0 w-1 h-full ${
                          bday ? "bg-pink-500" : "bg-[#ff9900]"
                        }`}
                      />
                      <div className="p-4 pl-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              bday
                                ? "bg-pink-100 text-pink-600"
                                : "bg-[#ff9900]/10 text-[#ff9900]"
                            }`}
                          >
                            {bday ? <Gift size={18} /> : <CalendarIcon size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-gray-900">{event.title}</h5>
                            {event.description && (
                              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                {event.description}
                              </p>
                            )}
                            <div className="mt-3 inline-flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              <Clock size={12} className="mr-1" />
                              {event.time || "Todo el día"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#ff9900]/10 text-[#ff9900] flex items-center justify-center mb-4">
                  <CalendarIcon size={28} />
                </div>
                <h4 className="text-gray-700 font-bold">Sin eventos</h4>
                <p className="text-gray-500 text-sm mt-1">
                  No se han registrado eventos para este día.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
}
