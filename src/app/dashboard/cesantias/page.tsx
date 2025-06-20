"use client";

import DashboardNavbar from '../navbar';
import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  X, 
  FileText,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

// Firebase imports
import { auth, db, storage } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Type definitions
interface UserProfile {
  nombre?: string;
  [key: string]: unknown;
}

export default function CesantiasPage() {
  // form state
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [categoria, setCategoria] = useState('');
  const [selectedFile, setSelectedFile] = useState<File|null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState(false);

  // submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // user profile state
  const [userNombre, setUserNombre] = useState('');
  const [userCedula, setUserCedula] = useState('');

  // on mount, grab user profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      // parse cedula from email (before @)
      const cedula = u.email?.split('@')[0] || '';
      setUserCedula(cedula);

      // fetch their profile doc for "nombre"
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserNombre(data.nombre || '');
        }
      } catch (e) {
        console.error("Error fetching user profile:", e);
      }
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFileError(true);
        setSelectedFile(null);
        setFileName('');
      } else {
        setFileError(false);
        setSelectedFile(file);
        setFileName(file.name);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileName('');
    setFileError(false);
  };

  const sendEmailNotification = async (motivoSolicitud: string, categoria: string) => {
  try {
    const response = await fetch('https://formsubmit.co/moraljero@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _to: 'moraljero@gmail.com,jeronimo.morales@merquellantas.com',
        _subject: 'Alerta: Nueva Solicitud de Cesantías Pendiente',
        message: 'Hay una nueva solicitud de cesantías esperándote...',
        categoria: categoria,
        motivo: motivoSolicitud,
        nombre: userNombre,
        cedula: userCedula,
        _captcha: 'false'
      })
    });
    
    if (!response.ok) {
      console.warn('Email notification failed, but form submission succeeded');
    }
  } catch (error) {
    console.warn('Email notification error:', error);
    // Don't throw error - we don't want to fail the form submission if email fails
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!motivoSolicitud.trim()) {
      setFormError('El motivo de solicitud es requerido');
      return;
    }
    if (!categoria) {
      setFormError('Debe seleccionar una categoría');
      return;
    }
    if (!selectedFile) {
      setFormError('Debe adjuntar un documento');
      return;
    }
    setIsSubmitting(true);

    try {
      const user = auth.currentUser!;
      // 1) upload to Storage
      const path = `cesantias/${user.uid}/${Date.now()}_${selectedFile.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, selectedFile);
      const url = await getDownloadURL(ref);

      // 2) write Firestore doc
      // 2) write Firestore doc
await addDoc(collection(db, 'cesantias'), {
  motivoSolicitud: motivoSolicitud.trim(),
  categoria,
  fileName,
  fileUrl: url,
  userId: user.uid,
  nombre: userNombre,
  cedula: userCedula,
  createdAt: serverTimestamp(),
  estado: "pendiente"
});

// 3) Send email notification
await sendEmailNotification(motivoSolicitud, categoria);

// 4) done
setSubmitted(true);

      // 3) done
      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Error submitting cesantias:", err);
      setFormError('Ocurrió un error al enviar. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewRequest = () => {
    setMotivoSolicitud('');
    setCategoria('');
    setSelectedFile(null);
    setFileName('');
    setFileError(false);
    setFormError('');
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <DashboardNavbar activePage="cesantias" />

      <main className="max-w-4xl mx-auto pt-24 pb-12 px-4 sm:px-6">
        {/* Header & breadcrumbs */}
        <div className="mb-8">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <a href="/dashboard" className="hover:text-gray-700">Inicio</a>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="text-[#ff9900] font-medium">Solicitud de Cesantías</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitud de Cesantías</h1>
          <p className="mt-2 text-gray-600">Complete el formulario para solicitar sus cesantías</p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
            <p className="text-gray-600 mb-6">Su solicitud de cesantías ha sido registrada exitosamente. Le notificaremos cuando sea procesada.</p>
            <button
              onClick={handleNewRequest}
              className="bg-[#ff9900] hover:bg-[#e68a00] text-white font-medium px-6 py-3 rounded-lg transition-all"
            >
              Nueva Solicitud
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Form header */}
            <div className="bg-gradient-to-r from-[#ff9900]/10 to-white p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Formulario de Solicitud</h2>
              <p className="text-gray-600 text-sm mt-1">Complete todos los campos requeridos</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 flex items-start">
                  <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              {/* Categoría dropdown */}
              <div className="mb-6">
                <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="categoria"
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all pr-10"
                    required
                  >
                    <option value="" disabled>Seleccione una categoría</option>
                    <option value="Arreglos de Vivienda">Arreglos de Vivienda</option>
                    <option value="Educación">Educación</option>
                    <option value="Compra de Vivienda">Compra de Vivienda</option>
                    <option value="Otro">Otro</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Motivo */}
              <div className="mb-6">
                <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de solicitud <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="motivo"
                  value={motivoSolicitud}
                  onChange={e => setMotivoSolicitud(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all resize-none"
                  placeholder="Describa el motivo de su solicitud de cesantías..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  {motivoSolicitud.length}/500 caracteres
                </p>
              </div>

              {/* File upload */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento de soporte <span className="text-red-500">*</span>
                </label>

                <div className={`
                  border-2 border-dashed rounded-lg p-6
                  ${fileError ? 'border-red-300 bg-red-50' 
                    : fileName ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-[#ff9900]'}
                  transition-all
                `}>
                  {!fileName ? (
                    <div className="text-center">
                      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-1">Arrastre su archivo aquí o</p>
                      <label className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer inline-block">
                        Seleccionar archivo
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="mt-2 text-xs text-gray-500">PDF, DOC, DOCX, JPG o PNG (máx. 5MB)</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-8 w-8 text-[#ff9900] mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{fileName}</p>
                          <p className="text-xs text-gray-500">Documento cargado correctamente</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 bg-white rounded-full border border-gray-300 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <div className="mt-3 flex items-center text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1.5" />
                      El archivo excede el tamaño máximo de 5MB
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`
                    px-6 py-3 rounded-lg font-medium text-white flex items-center
                    ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#ff9900] hover:bg-[#e68a00]'}
                    transition-all
                  `}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Enviando...
                    </>
                  ) : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}