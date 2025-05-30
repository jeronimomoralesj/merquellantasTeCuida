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
        fetchedEvents.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate() // Convert Firestore timestamp to JS Date
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
    // Format today's date to YYYY-MM-DD for the date input
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
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
      
      // Process based on event type
      if (newEvent.type === "birthday") {
        // For birthdays, use the default image
        imageUrl = "https://media.istockphoto.com/id/1349208049/es/foto/marco-multicolor-de-accesorios-para-fiestas-o-cumplea%C3%B1os.jpg?b=1&s=612x612&w=0&k=20&c=TXLNCnfhI6JQmBQmK_WxvkjWxelBe1Dx306dHpBALDo=";
      } else if (selectedImage) {
        // For other events, upload the user's image if provided
        const path = `calendar/${user.uid}/${Date.now()}_${selectedImage.name}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, selectedImage);
        imageUrl = await getDownloadURL(fileRef);
      }
      
      // Create event object
      const eventDate = new Date(newEvent.date);
      
      // For birthdays, set time to midnight
      if (newEvent.type === "birthday") {
        eventDate.setHours(0, 0, 0, 0);
      } else if (newEvent.time) {
        // For other events, use the specified time
        const [hours, minutes] = newEvent.time.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
      }
      
      // Add to Firestore
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

  // Format date for display
  const formatEventDate = (date: Date): string => {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Get upcoming events (limited to 3)
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

      {/* Add Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Agregar nuevo evento</h3>
              <button 
                onClick={closeModal}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                {/* Event type selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de evento
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`
                      flex items-center justify-center p-3 rounded-lg border cursor-pointer
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
                      <CalendarIcon className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">General</span>
                    </label>
                    <label className={`
                      flex items-center justify-center p-3 rounded-lg border cursor-pointer
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
                      <Cake className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium">Cumpleaños</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={newEvent.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder={newEvent.type === "birthday" ? "Ej: Cumpleaños de Juan Pérez" : "Título del evento"}
                  />
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={newEvent.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Time input (only shown for non-birthday events) */}
                {newEvent.type !== "birthday" && (
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                      Hora
                    </label>
                    <input
                      type="time"
                      id="time"
                      name="time"
                      value={newEvent.time}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={newEvent.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={newEvent.type === "birthday" ? "Ej: Recuerden que cumple Juan" : "Descripción del evento"}
                  />
                </div>

                {/* Image upload (only for non-birthday events) */}
                {newEvent.type !== "birthday" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Imagen (opcional)
                    </label>
                    
                    {!selectedImage ? (
                      <div className={`
                        border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center
                        ${imageError ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-500'}
                        transition-all cursor-pointer
                      `}>
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-1">Haga clic para subir una imagen</p>
                        <label className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer inline-block">
                          Seleccionar imagen
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="mt-1 text-xs text-gray-500">JPG, PNG, GIF (máx. 5MB)</p>
                        
                        {imageError && (
                          <p className="mt-2 text-xs text-red-600">{imageError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="border rounded-lg p-3 flex items-center justify-between bg-blue-50 border-blue-200">
                        <div className="flex items-center">
                          <ImageIcon className="h-6 w-6 text-blue-500 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-700 truncate max-w-xs">{imageFileName}</p>
                            <p className="text-xs text-gray-500">Imagen seleccionada</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="p-1.5 bg-white rounded-full border border-gray-300 hover:bg-gray-100"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 mr-2"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center"
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