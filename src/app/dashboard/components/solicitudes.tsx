"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface RequestItem {
  id: number;
  title: string;
  status: string;
  date: string;
}

// Dummy data for initial display
const DUMMY_REQUESTS: RequestItem[] = [
  { id: 1, title: "Solicitud de prueba A", status: "Pendiente", date: "1 mayo" },
  { id: 2, title: "Solicitud de prueba B", status: "En revisión", date: "2 mayo" },
  { id: 3, title: "Solicitud de prueba C", status: "Aprobada", date: "3 mayo" }
];

interface SolicitudesProps {
  /** Optional array of request items; uses DUMMY_REQUESTS if undefined */
  requests?: RequestItem[];
  onClose: () => void;
}

export default function Solicitudes({ requests = DUMMY_REQUESTS, onClose }: SolicitudesProps) {
  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      >
        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 p-6 relative overflow-y-auto max-h-[90vh]"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={24} />
          </button>

          {/* Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Todas mis solicitudes
          </h2>

          {/* Requests List */}
          <div className="space-y-4">
            {requests.length > 0 ? (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-800">{req.title}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full
                        ${
                          req.status === 'Pendiente'
                            ? 'bg-yellow-100 text-yellow-800'
                            : req.status === 'En revisión'
                            ? 'bg-blue-100 text-blue-800'
                            : req.status === 'Aprobada'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      `}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{req.date}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No tienes solicitudes.</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
