"use client";

import React, { useState } from 'react';
import DashboardNavbar from '../navbar';
import { X, Send, Check, AlertCircle } from 'lucide-react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../firebase';

type PqrsfType = 'Pregunta' | 'Queja' | 'Reclamo' | 'Sugerencia' | 'Felicitación';

interface UserData {
  nombre: string;
  cedula: string;
}

interface PqrsfPayload {
  type: PqrsfType;
  message: string;
  isAnonymous: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
  userId: string;
  nombre?: string;
  cedula?: string;
}

export default function PqrsfPage() {
  const [type, setType] = useState<PqrsfType>('Pregunta');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleAnonymousToggle = () => {
    if (!isAnonymous) setShowConfirm(true);
    else setIsAnonymous(false);
  };
  
  const confirmAnonymous = () => { setIsAnonymous(true); setShowConfirm(false); };
  const cancelAnonymous = () => { setShowConfirm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setSubmitError('El mensaje no puede estar vacío.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Debes iniciar sesión antes de enviar.');

      // base payload
      const payload: PqrsfPayload = {
        type,
        message: message.trim(),
        isAnonymous,
        createdAt: serverTimestamp(),
        userId: user.uid
      };

      // if not anonymous, grab their nombre & cedula from users/{uid}
      if (!isAnonymous) {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        if (uSnap.exists()) {
          const data = uSnap.data() as UserData;
          payload.nombre = data.nombre;
          payload.cedula = data.cedula;
        }
      }

      // write to pqrsf collection
      await addDoc(collection(db, 'pqrsf'), payload);

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Error al enviar. Intenta de nuevo.';
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen after submission
  if (submitted) {
    return (
      <>
        <DashboardNavbar activePage="pqrsf" />
        <div className="pt-20 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 text-black">
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md w-full border border-gray-100">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Check size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">¡Enviado con éxito!</h2>
            <p className="mb-6 text-gray-600">Tu {type.toLowerCase()} ha sido registrada correctamente. Gracias por tu aporte.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-full hover:from-amber-600 hover:to-amber-700 transition shadow-md flex items-center justify-center gap-2 w-full sm:w-auto mx-auto"
            >
              <Send size={18} />
              Enviar otro
            </button>
          </div>
        </div>
      </>
    );
  }

  // Form screen
  return (
    <>
      <DashboardNavbar activePage='pqrsf' />
      <div className="pt-20 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6 lg:px-8 text-black">
        <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Enviar una PQRSF</h1>
            <div className="mt-2 sm:mt-0 text-sm text-gray-500 italic">
              Su opinión es importante
            </div>
          </div>

          {submitError && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <p>{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo */}
            <div className="space-y-2">
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">Tipo de solicitud</label>
              <div className="relative">
                <select
                  id="type"
                  value={type}
                  onChange={e => setType(e.target.value as PqrsfType)}
                  className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:ring-amber-500 focus:border-amber-500 py-3 px-4 bg-white appearance-none"
                >
                  {['Pregunta','Queja','Reclamo','Sugerencia','Felicitación']
                    .map(o => <option key={o}>{o}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Mensaje */}
            <div className="space-y-2">
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Mensaje</label>
              <textarea
                id="message"
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:ring-amber-500 focus:border-amber-500 p-4 resize-y"
              />
              <p className="text-xs text-gray-500 ml-1">
                Sé claro y específico para poder atender mejor tu solicitud.
              </p>
            </div>

            {/* Anónimo */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <button
                type="button"
                onClick={handleAnonymousToggle}
                className={`px-5 py-3 rounded-xl border transition-colors ${
                  isAnonymous
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } flex items-center gap-2`}
              >
                <span className={`w-4 h-4 rounded-full border ${isAnonymous ? 'bg-white border-white' : 'border-gray-400'} flex items-center justify-center`}>
                  {isAnonymous && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                </span>
                {isAnonymous ? 'Anónimo activado' : 'Enviar como anónimo'}
              </button>
              
              {isAnonymous && (
                <span className="text-sm text-gray-600 mt-2 sm:mt-0">
                  Haz clic de nuevo para cancelar el modo anónimo
                </span>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl shadow-md hover:from-amber-600 hover:to-amber-700 transition-colors disabled:opacity-50 font-medium"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar {type.toLowerCase()}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm Anonymous Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl relative border border-gray-100 animate-fadeIn">
            <button
              onClick={cancelAnonymous}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle size={24} className="text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Confirmar envío anónimo
              </h2>
            </div>
            
            <p className="text-gray-700 mb-6">
              Al escoger el envío anónimo no podremos identificar quién envió esta solicitud, lo cual puede retrasar o dificultar una respuesta personalizada.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <button
                onClick={cancelAnonymous}
                className="order-2 sm:order-1 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAnonymous}
                className="order-1 sm:order-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-md"
              >
                Continuar como anónimo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}