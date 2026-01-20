'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock
} from 'lucide-react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../../../firebase';

interface VacacionesFormData {
  fechaInicio: string;
  fechaFin: string;
  description: string;
  document: File | null;
}

const VacacionesForm = () => {
  const [formData, setFormData] = useState<VacacionesFormData>({
    fechaInicio: '',
    fechaFin: '',
    description: '',
    document: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState(false);
  const [diasVacaciones, setDiasVacaciones] = useState(0);

  // Calculate vacation days whenever dates change
  useEffect(() => {
    if (formData.fechaInicio && formData.fechaFin) {
      const startDate = new Date(formData.fechaInicio);
      const endDate = new Date(formData.fechaFin);
      
      if (endDate >= startDate) {
        // Calculate the difference in time
        const timeDifference = endDate.getTime() - startDate.getTime();
        // Convert to days and add 1 to include both start and end dates
        const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
        setDiasVacaciones(daysDifference);
      } else {
        setDiasVacaciones(0);
      }
    } else {
      setDiasVacaciones(0);
    }
  }, [formData.fechaInicio, formData.fechaFin]);

  const validateForm = () => {
    if (!formData.description.trim()) {
      setFormError('La descripción es requerida');
      return false;
    }
    if (!formData.fechaInicio) {
      setFormError('La fecha de inicio es requerida');
      return false;
    }
    if (!formData.fechaFin) {
      setFormError('La fecha de fin es requerida');
      return false;
    }
    if (new Date(formData.fechaFin) < new Date(formData.fechaInicio)) {
      setFormError('La fecha de fin debe ser posterior o igual a la fecha de inicio');
      return false;
    }
    if (!formData.document) {
      setFormError('Debe adjuntar un documento');
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

    setFormError('');
    setIsSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setFormError('Debe iniciar sesión para enviar una solicitud');
        return;
      }
      
      const storage = getStorage();
      const file = formData.document as File;
      const path = `solicitudes/${user.uid}/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, path);
      const snap = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snap.ref);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const { nombre, cedula } = userData;

      const solicitudData = {
        userId: user.uid,
        nombre: nombre || '',
        cedula: cedula || '',
        tipo: 'vacaciones',
        estado: 'pendiente',
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        diasVacaciones: diasVacaciones,
        description: formData.description,
        documentName: file.name,
        documentUrl: url,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'solicitudes'), solicitudData);

// Send email notification
await sendEmailNotification(formData);

setSubmitted(true);

    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al enviar su solicitud. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        setFileError(true);
        setFormData({ ...formData, document: null });
      } else {
        setFileError(false);
        setFormData({ ...formData, document: file });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFormError('');
  };
  
  const handleNewRequest = () => {
    setFormData({
      fechaInicio: '',
      fechaFin: '',
      description: '',
      document: null,
    });
    setSubmitted(false);
    setFormError('');
    setDiasVacaciones(0);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 mb-6">
          Su solicitud de vacaciones ha sido registrada exitosamente.
        </p>
        <button
          onClick={handleNewRequest}
          className="bg-[#ff9900] hover:bg-[#e68a00] text-white font-medium px-6 py-3 rounded-lg transition-all"
        >
          Nueva Solicitud
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#ff9900]/10 to-white p-4 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Solicitud de Vacaciones</h2>
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
              <Info className="w-5 h-5 mr-2 text-[#ff9900]" />
              Descripción de las Vacaciones
            </h3>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Detalle su solicitud de vacaciones <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all resize-none"
                placeholder="Describa el motivo de su solicitud de vacaciones"
                maxLength={500}
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                {formData.description.length}/500 caracteres
              </p>
            </div>
          </div>
          
          {/* Date Range */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Calendar className="w-5 h-5 mr-2 text-[#ff9900]" />
              Período de Vacaciones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="fechaInicio"
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="fechaFin"
                  name="fechaFin"
                  value={formData.fechaFin}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            {/* Days calculation display */}
            {diasVacaciones > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    Total de días de vacaciones: <span className="font-bold">{diasVacaciones} día{diasVacaciones !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* File Upload */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Upload className="w-5 h-5 mr-2 text-[#ff9900]" />
              Documentación
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="document"
                name="document"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <label htmlFor="document" className="cursor-pointer flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[#ff9900]/10 rounded-full flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6 text-[#ff9900]" />
                </div>
                <span className="font-medium text-gray-700 mb-1 text-sm sm:text-base">
                  {formData.document ? formData.document.name : 'Adjuntar documento'}
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {formData.document 
                    ? `${(formData.document.size / 1024 / 1024).toFixed(2)} MB`
                    : 'PDF, JPG, PNG, DOC (Máx. 5MB)'}
                </span>
                
                {fileError && (
                  <div className="mt-3 text-red-500 text-sm flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    El archivo excede el límite de 5MB
                  </div>
                )}
              </label>
            </div>
          </div>
          
          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-6 py-3 bg-[#ff9900] text-white font-medium rounded-lg shadow-sm hover:bg-[#e68a00] focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:ring-offset-2 transition-all ${
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

export default VacacionesForm;