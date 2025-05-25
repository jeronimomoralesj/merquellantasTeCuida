'use client';

import React, { useState } from 'react';
import DashboardNavbar from '../navbar';
import { 
  Upload, 
  Calendar, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  User, 
  ChevronRight,
  Briefcase,
} from 'lucide-react';
// Imports for Firebase
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../../../firebase';    // adjust path if needed

const SolicitudPage = () => {
  const [requestType, setRequestType] = useState('enfermedad');
  const [formData, setFormData] = useState({
    name: '',
    cedula: '',
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
    description: '',
    document: null,
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

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 because both days are inclusive
      setNumDias(diffDays);
    } else {
      setNumDias(0);
    }
  };

  const validateForm = () => {
    if (requestType === 'enfermedad') {
      if (!formData.name.trim()) {
        setFormError('El nombre es requerido');
        return false;
      }
      if (!formData.cedula.trim()) {
        setFormError('La cédula es requerida');
        return false;
      }
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
        setFormError('La ubicación es requerida');
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
    } else {
      if (!formData.description.trim()) {
        setFormError('La descripción es requerida');
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
    }
    
    if (!formData.document) {
      setFormError('Debe adjuntar un documento');
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
      // 1) get current user
      const user = auth.currentUser;
      if (!user) {
        setFormError('Debe iniciar sesión para enviar una solicitud');
        setIsSubmitting(false);
        return;
      }
      
// 2) upload the file to Storage
const storage = getStorage();
const fileToUpload = formData.document;
if (!fileToUpload) {
  setFormError('Debe adjuntar un documento');
  setIsSubmitting(false);
  return;
}
const path = `solicitudes/${user.uid}/${Date.now()}_${fileToUpload.name}`;
const fileRef = storageRef(storage, path);
const snap = await uploadBytes(fileRef, fileToUpload);
const url = await getDownloadURL(snap.ref);

      // 3) fetch user profile info from users collection
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const { nombre, cedula } = userData;

      // 4) calculate number of days
      calculateDays();

      // 5) write the solicitud to Firestore with all required fields
      const solicitudData = {
        userId: user.uid,
        nombre: nombre || formData.name,
        cedula: cedula || formData.cedula,
        tipo: requestType,
        estado: 'pendiente',
        startDate: formData.startDate,
        endDate: formData.endDate,
        numDias: numDias,
        documentName: fileToUpload.name,
        documentUrl: url,
        createdAt: serverTimestamp(),
      };

      // Add specific fields based on request type
      if (requestType === 'enfermedad') {
        Object.assign(solicitudData, {
          edad: formData.edad,
          gender: formData.gender,
          cargo: formData.cargo,
          tipoContrato: formData.tipoContrato,
          ubicacion: formData.ubicacion,
          tipoEvento: formData.tipoEvento,
          codigoIncap: formData.codigoIncap,
          cie10: formData.cie10,
          mesDiagnostico: formData.mesDiagnostico
        });
      } else {
        Object.assign(solicitudData, {
          description: formData.description
        });
      }

      await addDoc(collection(db, 'solicitudes'), solicitudData);
      setSubmitted(true);

    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al enviar su solicitud. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setFileError(true);
        setFormData({
          ...formData,
          document: null
        });
      } else {
        setFileError(false);
        setFormData({
          ...formData,
          document: file
        });
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setFormError('');
    
    // Calculate days whenever start or end date changes
    if (name === 'startDate' || name === 'endDate') {
      setTimeout(calculateDays, 0);
    }
  };
  
  const handleNewRequest = () => {
    setFormData({
      name: '',
      cedula: '',
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
      description: '',
      document: null,
    });
    setSubmitted(false);
    setFormError('');
    setNumDias(0);
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <DashboardNavbar activePage='permisos' />
      
      <main className="max-w-4xl mx-auto pt-24 pb-12 px-4 sm:px-6">
        {/* Page header with breadcrumbs */}
        <div className="mb-8">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <a href="/dashboard" className="hover:text-gray-700">Inicio</a>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="text-[#ff9900] font-medium">Nueva Solicitud</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Solicitud</h1>
          <p className="mt-2 text-gray-600">Complete el formulario para enviar su solicitud</p>
        </div>
        
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
            <p className="text-gray-600 mb-6">
              Su solicitud ha sido registrada exitosamente. Le notificaremos cuando sea procesada.
            </p>
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
            
            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 flex items-start">
                  <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              
              {/* Toggle Button */}
              <div className="max-w-sm mx-auto mb-8">
                <div className="bg-gray-100 rounded-full p-1 flex">
                  <button
                    type="button"
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                      requestType === 'enfermedad' 
                        ? 'bg-white text-[#ff9900] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setRequestType('enfermedad')}
                  >
                    Incapacidad
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                      requestType === 'permiso' 
                        ? 'bg-white text-[#ff9900] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setRequestType('permiso')}
                  >
                    Permiso
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {requestType === 'enfermedad' ? (
                  <>
                    {/* Personal Information */}
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
                        <User className="w-5 h-5 mr-2 text-[#ff9900]" />
                        Información Personal
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre Completo <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
                            placeholder="Ingrese su nombre completo"
                          />
                        </div>
                        
                        {/* Cedula */}
                        <div>
                          <label htmlFor="cedula" className="block text-sm font-medium text-gray-700 mb-1">
                            Cédula <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="cedula"
                            name="cedula"
                            value={formData.cedula}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
                            placeholder="Ingrese su número de cédula"
                          />
                        </div>
                        
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all bg-white"
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
                        <Briefcase className="w-5 h-5 mr-2 text-[#ff9900]" />
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all bg-white"
                          >
                            <option value="directo">Directo</option>
                            <option value="temporal">Temporal</option>
                          </select>
                        </div>
                        
                        {/* Ubicación */}
                        <div>
                          <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700 mb-1">
                            Ubicación <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="ubicacion"
                            name="ubicacion"
                            value={formData.ubicacion}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
                            placeholder="Ingrese su ubicación laboral"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Información de la Incapacidad */}
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
                        <FileText className="w-5 h-5 mr-2 text-[#ff9900]" />
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all bg-white"
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
                            Código de Incapacidad <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="codigoIncap"
                            name="codigoIncap"
                            value={formData.codigoIncap}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all bg-white"
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
                        <Calendar className="w-5 h-5 mr-2 text-[#ff9900]" />
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
                        <Info className="w-5 h-5 mr-2 text-[#ff9900]" />
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all resize-none"
                          placeholder="Describa el motivo de su solicitud de permiso"
                        ></textarea>
                        <p className="mt-1 text-xs text-gray-500">
                          {formData.description.length}/500 caracteres
                        </p>
                      </div>
                    </div>
                    
                    {/* Date Range for Permiso */}
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
                        <Calendar className="w-5 h-5 mr-2 text-[#ff9900]" />
                        Período del Permiso
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent transition-all"
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
                  </>
                )}
                
                {/* File Upload Section - Common for both types */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 flex items-center mb-4">
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
                    <label
                      htmlFor="document"
                      className="cursor-pointer flex flex-col items-center justify-center"
                    >
                      <div className="w-12 h-12 bg-[#ff9900]/10 rounded-full flex items-center justify-center mb-3">
                        <Upload className="h-6 w-6 text-[#ff9900]" />
                      </div>
                      <span className="font-medium text-gray-700 mb-1">
                        {formData.document ? formData.document.name : 'Adjuntar documento'}
                      </span>
                      <span className="text-sm text-gray-500">
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
                  <p className="mt-2 text-xs text-gray-500 flex items-center">
                    <Info className="h-3 w-3 mr-1" />
                    {requestType === 'enfermedad' 
                      ? 'Adjunte la incapacidad médica en formato PDF, JPG o PNG'
                      : 'Adjunte la documentación de soporte para su solicitud de permiso'}
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
                        className="h-4 w-4 text-[#ff9900] border-gray-300 rounded focus:ring-[#ff9900]"
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
                      className={`px-6 py-3 bg-[#ff9900] text-white font-medium rounded-lg shadow-sm hover:bg-[#e68a00] focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:ring-offset-2 transition-all ${
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
            
            {/* Help section */}
            <div className="bg-gray-50 p-6 border-t border-gray-100">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-[#ff9900]/10 rounded-full flex items-center justify-center">
                    <Info className="h-5 w-5 text-[#ff9900]" />
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">¿Necesita ayuda?</h4>
                  <p className="mt-1 text-sm text-gray-600">
                    Si tiene dudas sobre cómo llenar este formulario, contacte al departamento de Recursos Humanos al correo <a href="mailto:marcela@merquellantas.com" className="text-[#ff9900] hover:underline">marcela@merquellantas.com</a> o al teléfono <a href="tel:+571234567890" className="text-[#ff9900] hover:underline">+57 123 456 7890</a>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SolicitudPage;