"use client";

import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Image as ImageIcon,
  Cake,
} from "lucide-react";

// Firebase imports
import { auth, db, storage } from '../../../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Type definitions
interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  description: string;
  type: 'general' | 'birthday';
  image: string;
  userId: string;
  createdAt: import('firebase/firestore').Timestamp;
}

interface NewEventForm {
  title: string;
  date: string;
  time: string;
  description: string;
  type: 'general' | 'birthday';
  image: File | null;
}

// Helper functions for date offset handling
const addOneDayForDisplay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
};

const subtractOneDayForStorage = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() - 1);
  return newDate;
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CalendarCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState<NewEventForm>({
    title: "",
    date: "",
    time: "",
    description: "",
    type: "general",
    image: null
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState("");
  const [imageError, setImageError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch events on component mount and when currentDate changes
  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get start and end dates for the current month
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const eventsRef = collection(db, 'calendar');
      const q = query(
        eventsRef, 
        where('date', '>=', startDate), 
        where('date', '<=', endDate),
        orderBy('date')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedEvents: CalendarEvent[] = [];
      querySnapshot.forEach((doc) => {
        const eventData = doc.data();
        fetchedEvents.push({
          id: doc.id,
          ...eventData,
          // Add one day to the stored date for display
          date: addOneDayForDisplay(eventData.date.toDate())
        } as CalendarEvent);
      });
      
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar generation functions
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = (): (number | null)[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  };

  // Check if a day has events
  const hasEvents = (day: number | null): boolean => {
    if (!day) return false;
    
    const checkDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
    
    return events.some(event => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === checkDate.getDate() &&
        eventDate.getMonth() === checkDate.getMonth() &&
        eventDate.getFullYear() === checkDate.getFullYear()
      );
    });
  };

  // Navigation functions
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Modal functions
  const openModal = () => {
    // Format today's date + 1 day to YYYY-MM-DD for the date input (since we display one day ahead)
    const today = new Date();
    const displayDate = addOneDayForDisplay(today);
    const formattedDate = formatDateForInput(displayDate);
    
    setNewEvent({
      title: "",
      date: formattedDate,
      time: "",
      description: "",
      type: "general",
      image: null
    });
    setSelectedImage(null);
    setImageFileName("");
    setImageError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewEvent({
      ...newEvent,
      [name]: value,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setImageError("La imagen no debe superar los 5MB");
        setSelectedImage(null);
        setImageFileName("");
      } else if (!file.type.startsWith('image/')) {
        setImageError("El archivo debe ser una imagen");
        setSelectedImage(null);
        setImageFileName("");
      } else {
        setImageError("");
        setSelectedImage(file);
        setImageFileName(file.name);
      }
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageFileName("");
    setImageError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Usuario no autenticado");
      
      let imageUrl = "";
      
      // Upload image if provided
      if (selectedImage) {
        const path = `calendar/${user.uid}/${Date.now()}_${selectedImage.name}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, selectedImage);
        imageUrl = await getDownloadURL(fileRef);
      } else if (newEvent.type === "birthday") {
        // Use default birthday image if no image is uploaded for birthdays
        imageUrl = "https://media.istockphoto.com/id/1349208049/es/foto/marco-multicolor-de-accesorios-para-fiestas-o-cumplea%C3%B1os.jpg?b=1&s=612x612&w=0&k=20&c=TXLNCnfhI6JQmBQmK_WxvkjWxelBe1Dx306dHpBALDo=";
      }
      
      // Create event object - subtract one day from user input before storing
      const inputDate = new Date(newEvent.date);
      const eventDate = subtractOneDayForStorage(inputDate);
      
      // For birthdays, set time to midnight
      if (newEvent.type === "birthday") {
        eventDate.setHours(0, 0, 0, 0);
      } else if (newEvent.time) {
        // For other events, use the specified time
        const [hours, minutes] = newEvent.time.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
      }
      
      // Add to Firestore (storing the date minus one day)
      await addDoc(collection(db, 'calendar'), {
        title: newEvent.title,
        date: eventDate,
        description: newEvent.description,
        type: newEvent.type,
        image: imageUrl,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      
      // Close modal and reset form
      setIsModalOpen(false);
      setNewEvent({
        title: "",
        date: "",
        time: "",
        description: "",
        type: "general",
        image: null
      });
      setSelectedImage(null);
      setImageFileName("");
      
      // Refresh events
      fetchEvents();
      
    } catch (error) {
      console.error("Error adding event:", error);
      alert("Error al guardar el evento. Por favor intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display (dates are already adjusted by +1 day in fetchEvents)
  const formatEventDate = (date: Date): string => {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Get upcoming events (limited to 3) - dates are already adjusted for display
  const getUpcomingEvents = (): CalendarEvent[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return events
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  };

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden text-black">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
          Calendario
        </h2>
        <button 
          onClick={openModal}
          className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Mini Calendar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <button onClick={previousMonth} className="p-1 rounded hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <h3 className="text-sm font-medium text-gray-700 capitalize">
            {formatMonthYear(currentDate)}
          </h3>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["D", "L", "M", "X", "J", "V", "S"].map((day, index) => (
            <div key={index} className="py-1 text-gray-500 font-medium">
              {day}
            </div>
          ))}
          
          {generateCalendarDays().map((day, index) => (
            <div 
              key={index} 
              className={`py-1 relative ${
                day === null
                  ? ""
                  : day === new Date().getDate() && 
                    currentDate.getMonth() === new Date().getMonth() && 
                    currentDate.getFullYear() === new Date().getFullYear()
                    ? "bg-blue-500 text-white font-medium rounded-full"
                    : "hover:bg-gray-100 cursor-pointer rounded-full"
              }`}
            >
              {day !== null ? day : ""}
              {day !== null && hasEvents(day) && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Events Preview */}
      <div className="space-y-2 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Próximos eventos</h3>
        {loading ? (
          <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
            <p className="text-xs text-gray-500">Cargando eventos...</p>
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-start">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
                  event.type === "birthday" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600"
                }`}>
                  {event.type === "birthday" ? (
                    <Cake className="h-4 w-4" />
                  ) : (
                    <CalendarIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-800 truncate">{event.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{formatEventDate(event.date)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">No hay eventos próximos</p>
          </div>
        )}
      </div>

      {/* Add Event Modal - Now Responsive */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Agregar nuevo evento</h3>
              <button 
                onClick={closeModal}
                className="p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-5">
                {/* Event type selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de evento
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`
                      flex items-center justify-center p-3 sm:p-4 rounded-lg border cursor-pointer transition-all
                      ${newEvent.type === "general" 
                        ? "border-blue-500 bg-blue-50 text-blue-700" 
                        : "border-gray-300 hover:bg-gray-50"}
                    `}>
                      <input 
                        type="radio" 
                        name="type" 
                        value="general" 
                        checked={newEvent.type === "general"} 
                        onChange={handleInputChange} 
                        className="sr-only" 
                      />
                      <CalendarIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium">General</span>
                    </label>
                    <label className={`
                      flex items-center justify-center p-3 sm:p-4 rounded-lg border cursor-pointer transition-all
                      ${newEvent.type === "birthday" 
                        ? "border-pink-500 bg-pink-50 text-pink-700" 
                        : "border-gray-300 hover:bg-gray-50"}
                    `}>
                      <input 
                        type="radio" 
                        name="type" 
                        value="birthday" 
                        checked={newEvent.type === "birthday"} 
                        onChange={handleInputChange} 
                        className="sr-only" 
                      />
                      <Cake className="h-5 w-5 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium">Cumpleaños</span>
                    </label>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Título
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={newEvent.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder={newEvent.type === "birthday" ? "Ej: Cumpleaños de Juan Pérez" : "Título del evento"}
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha
                    </label>
                    <input
                      type="date"
                      id="date"
                      name="date"
                      value={newEvent.date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Time input (only shown for non-birthday events) */}
                  {newEvent.type !== "birthday" && (
                    <div>
                      <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                        Hora
                      </label>
                      <input
                        type="time"
                        id="time"
                        name="time"
                        value={newEvent.time}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={newEvent.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder={newEvent.type === "birthday" ? "Ej: Recuerden que cumple Juan" : "Descripción del evento"}
                  />
                </div>

                {/* Image upload - Now available for all event types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imagen {newEvent.type === "birthday" ? "(opcional - se usará imagen por defecto si no se selecciona)" : "(opcional)"}
                  </label>
                  
                  {!selectedImage ? (
                    <div className={`
                      border-2 border-dashed rounded-lg p-4 sm:p-6 flex flex-col items-center justify-center
                      ${imageError ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-500'}
                      transition-all cursor-pointer min-h-[120px]
                    `}>
                      <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 mb-2 text-center">
                        {newEvent.type === "birthday" 
                          ? "Sube una imagen personalizada o usa la imagen por defecto"
                          : "Haga clic para subir una imagen"
                        }
                      </p>
                      <label className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer inline-block transition-colors">
                        Seleccionar imagen
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageChange}
                        />
                      </label>
                      <p className="mt-2 text-xs text-gray-500 text-center">JPG, PNG, GIF (máx. 5MB)</p>
                      
                      {imageError && (
                        <p className="mt-2 text-sm text-red-600 text-center">{imageError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3 sm:p-4 flex items-center justify-between bg-blue-50 border-blue-200">
                      <div className="flex items-center min-w-0 flex-1">
                        <ImageIcon className="h-6 w-6 text-blue-500 mr-3 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-700 truncate">{imageFileName}</p>
                          <p className="text-xs text-gray-500">Imagen seleccionada</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="p-1.5 bg-white rounded-full border border-gray-300 hover:bg-gray-100 ml-3 flex-shrink-0"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-3 sm:gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    'Guardar evento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}