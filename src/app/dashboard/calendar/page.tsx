"use client";

import React, { useState, useEffect } from 'react';
import DashboardNavbar from '../navbar';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  X, 
  Clock, 
  Gift
} from 'lucide-react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
const [eventsForSelectedDate, setEventsForSelectedDate] = useState<CalendarEvent[]>([]);  
const [viewTransition, setViewTransition] = useState(false);
const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  time?: string;
  type: string;
}

  // Helper function to add one day to a date
  const addOneDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    return newDate;
  };

  // Fetch all calendar events on component mount
useEffect(() => {
  async function fetchEvents() {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'calendar'),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);

      const events = snapshot.docs.map(doc => {
        const data = doc.data();
        const storedDate = data.date.toDate();
        return {
  id: doc.id,
  title: data.title || '',
  description: data.description || '',
  date: addOneDay(storedDate), // Add one day to the stored date
  time: data.time || undefined,
  type: data.type || 'event',
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

  // Calendar navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  
  // Get events for a specific date, including recurring birthdays
const getEventsForDate = (date: Date) => {
    if (!allEvents.length) return [];
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.date); // This date is already +1 day from stored date
      
      // For birthdays, match just day and month (recurring yearly)
      if (event.type === 'birthday') {
        return eventDate.getDate() === day && eventDate.getMonth() === month;
      }
      
      // For regular events, match the full date
      return eventDate.getDate() === day && 
             eventDate.getMonth() === month && 
             eventDate.getFullYear() === year;
    });
  };
  
  // Handle date selection
const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    
    // Find events for the selected date
    const events = getEventsForDate(date);
    setEventsForSelectedDate(events);
    
    // Open sidebar if there are events, otherwise toggle
    if (events.length > 0) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
    
    // Add view transition
    setViewTransition(true);
    setTimeout(() => setViewTransition(false), 300);
  };
  
  // Close sidebar
  const closeSidebar = () => {
    setSidebarOpen(false);
  };
  
  // Generate calendar grid
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get day of week of first day (0 is Sunday, 1 is Monday, etc.)
    let dayOfWeek = firstDayOfMonth.getDay();
    // Adjust to make Monday the first day of the week
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const days = [];
    
    // Previous month's days
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPreviousMonth - i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Next month's days to fill the grid
    const remainingCells = 42 - days.length; // 6 rows of 7 days
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  };
  
  // Check if a date has events (including recurring birthdays)
const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };
  
  // Check if a date is today
const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };
  
  // Check if a date is selected
const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };
  
  // Format date for display in sidebar
const formatDate = (date: Date) => {
const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
  };
  
  // Calendar days
  const calendarDays = generateCalendarDays();
  
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <DashboardNavbar activePage=""/>
      
      {/* Main Content */}
      <div className="pt-16 pb-8 text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">Calendario Merquellantas</h1>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={goToToday}
                className="px-4 py-2 bg-[#ff9900] text-white rounded-lg shadow-sm hover:bg-[#e68a00] transition-colors"
              >
                Hoy
              </button>
              
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center px-4 font-medium">
                  {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Loading state */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff9900]"></div>
            </div>
          ) : (
            /* Main Calendar */
            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-px bg-gray-200">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day, index) => (
                  <div key={index} className="bg-white p-3 text-center font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 cursor-pointer">
                {calendarDays.map((day, index) => {
                  const dateHasEvents = hasEvents(day.date);
                  return (
                    <div 
                      key={index} 
                      className={`bg-white min-h-24 sm:min-h-32 p-2 relative transition-all duration-200 ${
                        !day.isCurrentMonth ? 'opacity-40' : ''
                      } ${
                        isSelected(day.date) ? 'ring-2 ring-[#ff9900] z-10' : ''
                      }`}
                      onClick={() => handleDateClick(day.date)}
                    >
                      <div 
                        className={`flex items-center justify-center h-8 w-8 rounded-full mb-1 ${
                          isToday(day.date) ? 'bg-[#ff9900] text-white' : ''
                        } ${
                          isSelected(day.date) && !isToday(day.date) ? 'bg-[#ff9900]/10 text-[#ff9900]' : ''
                        }`}
                      >
                        {day.date.getDate()}
                      </div>
                      
                      {dateHasEvents && (
                        <div className="px-1">
                          {getEventsForDate(day.date).slice(0, 3).map(event => (
                            <div 
                              key={event.id}
                              className="text-xs p-1 mb-1 rounded-md bg-[#ff9900]/10 text-[#ff9900] border-l-2 border-[#ff9900] truncate"
                            >
                              <div className="flex items-center">
                                {event.type === "birthday" ? (
                                  <Gift size={12} className="mr-1" />
                                ) : (
                                  <Calendar size={12} className="mr-1" />
                                )}
                                {event.title}
                              </div>
                            </div>
                          ))}
                          {getEventsForDate(day.date).length > 3 && (
                            <div className="text-xs text-gray-500 ml-1">
                              +{getEventsForDate(day.date).length - 3} más
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Sidebar for Event Details */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${viewTransition ? 'ease-out' : 'ease-in-out'}`}
      >
        <div className="h-full flex flex-col pt-10 pb-6">
          {/* Sidebar Header */}
          <div className="flex justify-between items-center px-6 py-1 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Detalles del Día</h2>
            <button 
              onClick={closeSidebar}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X className="text-black cursor-pointer" size={20} />
            </button>
          </div>
          
          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedDate && (
              <>
                <div className="flex items-center mb-6">
                  <Calendar size={24} className="text-[#ff9900] mr-3" />
                  <h3 className="text-xl font-medium text-gray-900">
                    {formatDate(selectedDate)}
                  </h3>
                </div>
                
                {eventsForSelectedDate.length > 0 ? (
                  <>
                    <h4 className="font-medium text-gray-700 mb-3">Eventos del día:</h4>
                    <div className="space-y-4">
                      {eventsForSelectedDate.map(event => (
                        <div 
                          key={event.id}
                          className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start">
                            <div className="flex-shrink-0 p-2 bg-[#ff9900]/10 text-[#ff9900] rounded-lg">
                              {event.type === "birthday" ? (
                                <Gift size={24} />
                              ) : (
                                <Calendar size={24} />
                              )}
                            </div>
                            <div className="ml-4">
                              <h5 className="font-medium text-gray-900">{event.title}</h5>
                              <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                              <div className="mt-3 flex items-center text-xs text-gray-500">
                                <Clock size={14} className="mr-1" />
                                <span>{event.time || "Todo el día"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                    <h4 className="text-gray-500 font-medium">No hay eventos para este día</h4>
                    <p className="text-gray-400 text-sm mt-2">
                      No se han registrado eventos para esta fecha.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Backdrop when sidebar is open (on mobile only) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
}