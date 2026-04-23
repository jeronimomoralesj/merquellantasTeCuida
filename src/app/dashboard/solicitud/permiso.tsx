'use client';

import React, { useState } from 'react';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  FileText,
  X,
  UserCheck,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import JefeSelector, { type JefeOption } from './JefeSelector';
import { uploadFileChunked } from '../../../lib/uploadChunked';

interface PermisoFormData {
  fecha: string;
  tiempoInicio: string;
  tiempoFin: string;
  description: string;
  documents: File[];
}

const PermisoForm = () => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<PermisoFormData>({
    fecha: '',
    tiempoInicio: '',
    tiempoFin: '',
    description: '',
    documents: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState(false);
  const [jefe, setJefe] = useState<JefeOption | null>(null);

  const validateForm = () => {
    if (!formData.description.trim()) {
      setFormError('La descripción es requerida');
      return false;
    }
    if (!formData.fecha) {
      setFormError('La fecha es requerida');
      return false;
    }
    if (!formData.tiempoInicio) {
      setFormError('El tiempo de inicio es requerido');
      return false;
    }
    if (!formData.tiempoFin) {
      setFormError('El tiempo fin es requerido');
      return false;
    }
    if (!jefe) {
      setFormError('Selecciona al jefe inmediato que aprobará esta solicitud');
      return false;
    }
    return true;
  };

  const sendEmailNotification = async (userName: string) => {
  const emails = [
    'marcelagonzalez@merquellantas.com',
    'saludocupacional@merquellantas.com',
    'dptodelagente@merquellantas.com',
  ];

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emails, userName }),
  });

  if (!res.ok) {
    throw new Error('Email failed');
  }
};

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Confirm if user is submitting without an attachment
    if (formData.documents.length === 0) {
      const ok = window.confirm('¿Seguro que no quieres agregar un adjunto?');
      if (!ok) return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      if (!session) {
        setFormError('Debe iniciar sesión para enviar una solicitud');
        return;
      }

      // Upload documents via the chunked helper — Vercel's ~4.5 MB serverless
      // body cap 413s the single-shot endpoint for anything larger.
      const documentUrls: { url: string; name: string }[] = [];
      for (const file of formData.documents) {
        const uploaded = await uploadFileChunked(file, { folder: 'permisos' });
        documentUrls.push({ url: uploaded.url || uploaded.webUrl, name: file.name });
      }

      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'permiso',
          fecha: formData.fecha,
          tiempoInicio: formData.tiempoInicio,
          tiempoFin: formData.tiempoFin,
          description: formData.description,
          documentName: documentUrls[0]?.name || null,
          documentUrl: documentUrls[0]?.url || null,
          documentUrls,
          approverId: jefe?.id,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Error al crear solicitud');
      }

      // Also notify HR for their records. The supervisor approval email is sent
      // server-side directly from the solicitudes POST, so we don't duplicate here.
      await sendEmailNotification(session.user.nombre || 'Usuario');

      setSubmitted(true);

    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al enviar su solicitud. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) { setFileError(true); return; }
      valid.push(file);
    }
    if (formData.documents.length + valid.length > 5) { setFileError(true); return; }
    setFileError(false);
    setFormData({ ...formData, documents: [...formData.documents, ...valid] });
    e.target.value = '';
  };

  const handleRemoveFile = (idx: number) => {
    setFormData({ ...formData, documents: formData.documents.filter((_, i) => i !== idx) });
    setFileError(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFormError('');
  };
  
  const handleNewRequest = () => {
    setFormData({
      fecha: '',
      tiempoInicio: '',
      tiempoFin: '',
      description: '',
      documents: [],
    });
    setSubmitted(false);
    setFormError('');
    setJefe(null);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 mb-6">
          Su solicitud de permiso ha sido registrada exitosamente.
        </p>
        <button
          onClick={handleNewRequest}
          className="bg-[#f4a900] hover:bg-[#e68a00] text-white font-medium px-6 py-3 rounded-lg transition-all"
        >
          Nueva Solicitud
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#f4a900]/10 to-white p-4 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Solicitud de Permiso</h2>
        <p className="text-gray-600 text-sm mt-1">Complete todos los campos requeridos</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        {formError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-sm sm:text-base">{formError}</p>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Info className="w-5 h-5 mr-2 text-[#f4a900]" />
              Descripción del Permiso
            </h3>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Detalle su solicitud de permiso <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all resize-none"
                placeholder="Describa el motivo de su solicitud de permiso"
                maxLength={500}
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                {formData.description.length}/500 caracteres
              </p>
            </div>
          </div>
          
          {/* Date and Time */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Clock className="w-5 h-5 mr-2 text-[#f4a900]" />
              Horario del Permiso
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="fecha"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="tiempoInicio" className="block text-sm font-medium text-gray-700 mb-1">
                  Tiempo de Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="tiempoInicio"
                  name="tiempoInicio"
                  value={formData.tiempoInicio}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="tiempoFin" className="block text-sm font-medium text-gray-700 mb-1">
                  Tiempo Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="tiempoFin"
                  name="tiempoFin"
                  value={formData.tiempoFin}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>
          
          {/* Jefe inmediato */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <UserCheck className="w-5 h-5 mr-2 text-[#f4a900]" />
              Jefe inmediato <span className="ml-2 text-red-500 text-sm">*</span>
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Selecciona a la persona que debe aprobar esta solicitud. Recibirá un correo
              con un enlace para aprobarla o rechazarla.
            </p>
            <JefeSelector value={jefe} onChange={setJefe} />
          </div>

          {/* File Upload */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Upload className="w-5 h-5 mr-2 text-[#f4a900]" />
              Documentación <span className="ml-2 text-xs font-normal text-gray-500">(opcional)</span>
            </h3>
            <p className="mt-2 text-sm text-gray-600">Si lo tienes, adjunta el formato de autorización con firma del jefe inmediato.</p>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${fileError ? 'border-red-300 bg-red-50' : formData.documents.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#f4a900]'}`}>
              {formData.documents.length < 5 && (
                <label className="cursor-pointer flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-[#f4a900]/10 rounded-full flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-[#f4a900]" />
                  </div>
                  <span className="font-medium text-gray-700 mb-1 text-sm">Adjuntar documentos</span>
                  <span className="text-xs text-gray-500">Hasta 5 archivos, máx. 50MB c/u</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} multiple />
                </label>
              )}
              {formData.documents.length > 0 && (
                <div className="space-y-2 mt-3 text-left">
                  {formData.documents.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center min-w-0">
                        <FileText className="h-5 w-5 text-[#f4a900] mr-2 flex-shrink-0" />
                        <p className="text-sm text-gray-700 truncate">{f.name}</p>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                      <button type="button" onClick={() => handleRemoveFile(i)} className="p-1 hover:bg-gray-100 rounded-full ml-2">
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
          
          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-6 py-3 bg-[#f4a900] text-white font-medium rounded-lg shadow-sm hover:bg-[#e68a00] focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:ring-offset-2 transition-all ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </span>
              ) : (
                'Enviar Solicitud'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PermisoForm;