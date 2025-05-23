"use client";
import {
  User,
  CalendarIcon,
  Share2,
  PieChart,
} from "lucide-react";


export default function UpcomingCard() {


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