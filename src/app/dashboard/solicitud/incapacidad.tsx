'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Upload,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  User,
  Briefcase,
  X,
} from 'lucide-react';
import { uploadFileChunked } from '../../../lib/uploadChunked';

// Interface definition - removed name and cedula
interface FormData {
  edad: string;
  gender: string;
  cargo: string;
  tipoContrato: string;
  ubicacion: string;
  tipoEvento: string;
  codigoIncap: string;
  cie10: string;
  mesDiagnostico: string;
  startDate: string;
  endDate: string;
  documents: File[];
}

const IncapacidadForm = () => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<FormData>({
    edad: '',
    gender: '',
    cargo: '',
    tipoContrato: 'directo', // directo or temporal
    ubicacion: '',
    tipoEvento: '',
    codigoIncap: '',
    cie10: '',
    mesDiagnostico: '',
    startDate: '',
    endDate: '',
    documents: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState(false);
  const [numDias, setNumDias] = useState(0);

  const tipoEventoOptions = [
    'Enfermedad general',
    'Accidente de trabajo',
    'Enfermedad laboral',
    'Licencia de maternidad',
    'Licencia de paternidad',
    'Otro'
  ];

  // NEW FUNCTION: Send email notification
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

  useEffect(() => {
  if (formData.startDate && formData.endDate) {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (end >= start) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setNumDias(diffDays);
    } else {
      setNumDias(0); // Invalid range
    }
  } else {
    setNumDias(0); // Missing one of the dates
  }
}, [formData.startDate, formData.endDate]);

  const validateForm = () => {
    if (!formData.edad) {
      setFormError('La edad es requerida');
      return false;
    }
    if (!formData.gender) {
      setFormError('El género es requerido');
      return false;
    }
    if (!formData.cargo.trim()) {
      setFormError('El cargo es requerido');
      return false;
    }
    if (!formData.ubicacion.trim()) {
      setFormError('La Sede es requerida');
      return false;
    }
    if (!formData.tipoEvento) {
      setFormError('El tipo de evento es requerido');
      return false;
    }
    if (!formData.startDate) {
      setFormError('La fecha de inicio es requerida');
      return false;
    }
    if (!formData.endDate) {
      setFormError('La fecha de finalización es requerida');
      return false;
    }
    if (!formData.codigoIncap.trim()) {
      setFormError('El código de incapacidad es requerido');
      return false;
    }
    if (!formData.cie10.trim()) {
      setFormError('El CIE-10 es requerido');
      return false;
    }
    if (!formData.mesDiagnostico.trim()) {
      setFormError('El mes de diagnóstico es requerido');
      return false;
    }
    
    if (formData.documents.length === 0) {
      setFormError('Debe adjuntar al menos un documento');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormError('');
    setIsSubmitting(true);

    try {
      // 1) check session
      if (!session?.user) {
        setFormError('Debe iniciar sesión para enviar una solicitud');
        setIsSubmitting(false);
        return;
      }

      // 2) upload files
      if (formData.documents.length === 0) {
        setFormError('Debe adjuntar al menos un documento');
        setIsSubmitting(false);
        return;
      }

      // Chunked uploader stays under Vercel's ~4.5 MB serverless request cap.
      const documentUrls: { url: string; name: string }[] = [];
      for (const file of formData.documents) {
        const uploaded = await uploadFileChunked(file, { folder: 'incapacidad' });
        documentUrls.push({ url: uploaded.url || uploaded.webUrl, name: file.name });
      }

      // 3) user info from session
      const nombre = session.user.nombre || 'Usuario';
      const cedula = session.user.cedula || 'No disponible';

      // 4) calculate number of days
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // 5) create solicitud via API
      const solicitudData = {
        nombre,
        cedula,
        tipo: 'incapacidad',
        estado: 'pendiente',
        startDate: formData.startDate,
        endDate: formData.endDate,
        documentName: documentUrls[0]?.name || null,
        documentUrl: documentUrls[0]?.url || null,
        documentUrls,
        edad: formData.edad,
        gender: formData.gender,
        cargo: formData.cargo,
        tipoContrato: formData.tipoContrato,
        ubicacion: formData.ubicacion,
        tipoEvento: formData.tipoEvento,
        codigoIncap: formData.codigoIncap,
        cie10: formData.cie10,
        mesDiagnostico: formData.mesDiagnostico,
        numDias: diffDays,
      };

      const solRes = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitudData),
      });
      if (!solRes.ok) throw new Error('Error al crear solicitud');

      // Send email notification after successful save
      await sendEmailNotification(nombre);

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
    }
  };

  const handleRemoveFile = (idx: number) => {
    setFormData({ ...formData, documents: formData.documents.filter((_, i) => i !== idx) });
    setFileError(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setFormError('');
    
    // Calculate days whenever start or end date changes
    if (name === 'startDate' || name === 'endDate') {
    }
  };
  
  const handleNewRequest = () => {
    setFormData({
      edad: '',
      gender: '',
      cargo: '',
      tipoContrato: 'directo',
      ubicacion: '',
      tipoEvento: '',
      codigoIncap: '',
      cie10: '',
      mesDiagnostico: '',
      startDate: '',
      endDate: '',
      documents: [],
    });
    setSubmitted(false);
    setFormError('');
    setNumDias(0);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 mb-6">
          Su solicitud de incapacidad ha sido registrada exitosamente. Le notificaremos cuando sea procesada.
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
      {/* Form header */}
      <div className="bg-gradient-to-r from-[#f4a900]/10 to-white p-6 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800">Solicitud de Incapacidad</h2>
        <p className="text-gray-600 text-sm mt-1">Complete todos los campos requeridos</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6">
        {formError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <p>{formError}</p>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Personal Information */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
              <User className="w-5 h-5 mr-2 text-[#f4a900]" />
              Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Edad */}
              <div>
                <label htmlFor="edad" className="block text-sm font-medium text-gray-700 mb-1">
                  Edad <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="edad"
                  name="edad"
                  value={formData.edad}
                  onChange={handleChange}
                  min="18"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                  placeholder="Ingrese su edad"
                />
              </div>
              
              {/* Gender */}
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Género <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all bg-white"
                >
                  <option value="">Seleccionar género</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Información Laboral */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
              <Briefcase className="w-5 h-5 mr-2 text-[#f4a900]" />
              Información Laboral
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cargo */}
              <div>
                <label htmlFor="cargo" className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cargo"
                  name="cargo"
                  value={formData.cargo}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                  placeholder="Ingrese su cargo"
                />
              </div>
              
              {/* Tipo de Contrato */}
              <div>
                <label htmlFor="tipoContrato" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Contrato <span className="text-red-500">*</span>
                </label>
                <select
                  id="tipoContrato"
                  name="tipoContrato"
                  value={formData.tipoContrato}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all bg-white"
                >
                  <option value="directo">Directo</option>
                  <option value="temporal">Temporal</option>
                </select>
              </div>
              
              {/* Ubicación */}
              <div className="md:col-span-2">
                <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700 mb-1">
                  Sede <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="ubicacion"
                  name="ubicacion"
                  value={formData.ubicacion}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                  placeholder="Ingrese su ubicación laboral"
                />
              </div>
            </div>
          </div>
          
          {/* Información de la Incapacidad */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
              <FileText className="w-5 h-5 mr-2 text-[#f4a900]" />
              Información de la Incapacidad
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tipo de Evento */}
              <div>
                <label htmlFor="tipoEvento" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Evento <span className="text-red-500">*</span>
                </label>
                <select
                  id="tipoEvento"
                  name="tipoEvento"
                  value={formData.tipoEvento}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all bg-white"
                >
                  <option value="">Seleccionar tipo de evento</option>
                  {tipoEventoOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              {/* Código de Incapacidad */}
              <div>
                <label htmlFor="codigoIncap" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Incapacidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="codigoIncap"
                  name="codigoIncap"
                  value={formData.codigoIncap}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                  placeholder="Ingrese el código"
                />
              </div>
              
              {/* CIE-10 */}
              <div>
                <label htmlFor="cie10" className="block text-sm font-medium text-gray-700 mb-1">
                  CIE-10 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="cie10"
                  name="cie10"
                  value={formData.cie10}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                  placeholder="Ingrese código CIE-10"
                />
              </div>
              
              {/* Mes Diagnóstico */}
              <div>
                <label htmlFor="mesDiagnostico" className="block text-sm font-medium text-gray-700 mb-1">
                  Mes de Diagnóstico <span className="text-red-500">*</span>
                </label>
                <select
                  id="mesDiagnostico"
                  name="mesDiagnostico"
                  value={formData.mesDiagnostico}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all bg-white"
                >
                  <option value="">Seleccionar mes</option>
                  <option value="Enero">Enero</option>
                  <option value="Febrero">Febrero</option>
                  <option value="Marzo">Marzo</option>
                  <option value="Abril">Abril</option>
                  <option value="Mayo">Mayo</option>
                  <option value="Junio">Junio</option>
                  <option value="Julio">Julio</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Septiembre">Septiembre</option>
                  <option value="Octubre">Octubre</option>
                  <option value="Noviembre">Noviembre</option>
                  <option value="Diciembre">Diciembre</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Date Range */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
              <Calendar className="w-5 h-5 mr-2 text-[#f4a900]" />
              Período de Incapacidad
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Finalización <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="numDias" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Días
                </label>
                <input
                  type="number"
                  id="numDias"
                  name="numDias"
                  value={numDias}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              </div>
            </div>
          </div>
          
          {/* File Upload Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
              <Upload className="w-5 h-5 mr-2 text-[#f4a900]" />
              Documentación
            </h3>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${fileError ? 'border-red-300 bg-red-50' : formData.documents.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#f4a900]'}`}>
              {formData.documents.length < 5 && (
                <label className="cursor-pointer flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-[#f4a900]/10 rounded-full flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-[#f4a900]" />
                  </div>
                  <span className="font-medium text-gray-700 mb-1">Adjuntar documentos</span>
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
              {fileError && (
                <div className="mt-3 text-red-500 text-sm flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Máximo 5 archivos de 50MB cada uno
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 flex items-center">
              <Info className="h-3 w-3 mr-1" />
              Adjunte la incapacidad médica en formato PDF, JPG o PNG
            </p>
          </div>
          
          {/* Terms and submit */}
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  className="h-4 w-4 text-[#f4a900] border-gray-300 rounded focus:ring-[#f4a900]"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-600">
                  Declaro que la información proporcionada es verídica y autorizo su verificación
                </label>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-3 bg-[#f4a900] text-white font-medium rounded-lg shadow-sm hover:bg-[#e68a00] focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:ring-offset-2 transition-all ${
                  isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
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
        </div>
      </form>
    </div>
  );
};

export default IncapacidadForm;