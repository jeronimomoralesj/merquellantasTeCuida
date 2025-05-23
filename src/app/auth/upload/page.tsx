"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Users, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function MassRegisterPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [progress, setProgress] = useState(0);

  // Parse date from Excel format or string
  const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle Excel serial date number
    if (typeof dateStr === 'number') {
      return new Date((dateStr - 25569) * 86400 * 1000);
    }
    
    // Handle string dates
    if (typeof dateStr === 'string') {
      // Try different date formats
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
      ];
      
      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          // Assume DD/MM/YYYY format for first pattern
          if (format === formats[0]) {
            const [, day, month, year] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else if (format === formats[1]) {
            const [, year, month, day] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else if (format === formats[2]) {
            const [, day, month, year] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        }
      }
      
      // Try direct Date parsing as fallback
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return null;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
        alert('Por favor seleccione un archivo Excel (.xlsx o .xls)');
        return;
      }
      setFile(selectedFile);
      setResults([]);
      setShowResults(false);
    }
  };

  const processRegistrations = async () => {
    if (!file) {
      alert('Por favor seleccione un archivo Excel');
      return;
    }

    setLoading(true);
    setResults([]);
    setShowResults(false);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('El archivo Excel está vacío o no tiene datos válidos');
        setLoading(false);
        return;
      }

      setTotalUsers(jsonData.length);
      const processResults = [];
      let successCounter = 0;
      let errorCounter = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        setProgress(((i + 1) / jsonData.length) * 100);

        try {
          // Extract and clean data
          const numeroDocumento = String(row['Número Documento'] || row['Numero Documento'] || '').trim();
          const primerApellido = String(row['Primer Apellido'] || '').trim();
          const segundoApellido = String(row['Segundo Apellido'] || '').trim();
          const nombreEmpleado = String(row['Nombre Empleado'] || '').trim();
          const cargoEmpleado = String(row['Cargo Empleado'] || '').trim();
          const fechaNacimiento = row['Fecha Nacimiento'];

          // Validate required fields
          if (!numeroDocumento) {
            throw new Error('Número de documento es requerido');
          }

          if (!nombreEmpleado && !primerApellido) {
            throw new Error('Nombre del empleado es requerido');
          }

          // Merge names
          const nombreCompleto = [nombreEmpleado, primerApellido, segundoApellido]
            .filter(name => name && name.trim())
            .join(' ')
            .trim();

          if (!nombreCompleto) {
            throw new Error('No se pudo construir el nombre completo');
          }

          // Generate PIN from last 4 digits of cedula
          const pin = numeroDocumento.slice(-4).padStart(4, '0');
          const fakeEmail = `${numeroDocumento}@merque.com`;
          const firebasePassword = pin + '11'; // Firebase requires min 6 chars

          // Set persistence
          await setPersistence(auth, browserLocalPersistence);

          // Create Firebase Auth user
          const userCred = await createUserWithEmailAndPassword(
            auth,
            fakeEmail,
            firebasePassword
          );

          // Prepare user data for Firestore
          const userData = {
            cedula: numeroDocumento,
            nombre: nombreCompleto,
            posicion: cargoEmpleado || 'No especificado',
            rol: 'user',
            createdAt: serverTimestamp()
          };

          // Add extra fields
          const extraFields = {};
          Object.keys(row).forEach(key => {
            if (!['Número Documento', 'Numero Documento', 'Primer Apellido', 'Segundo Apellido', 'Nombre Empleado', 'Cargo Empleado', 'Fecha Nacimiento'].includes(key)) {
              extraFields[key] = row[key];
            }
          });

          if (Object.keys(extraFields).length > 0) {
            userData.extra = extraFields;
          }

          // Save to Firestore users collection
          await setDoc(doc(db, 'users', userCred.user.uid), userData);

          // Create birthday calendar event if birth date exists
          let birthdayCreated = false;
          if (fechaNacimiento) {
            try {
              const birthDate = parseDateString(fechaNacimiento);
              if (birthDate && !isNaN(birthDate.getTime())) {
                // Set to current year for the birthday event
                const currentYear = new Date().getFullYear();
                const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
                birthdayThisYear.setHours(0, 0, 0, 0);

                await addDoc(collection(db, 'calendar'), {
                  title: `Cumpleaños de ${nombreCompleto}`,
                  date: birthdayThisYear,
                  description: `Recuerden que cumple años ${nombreCompleto}`,
                  type: 'birthday',
                  image: 'https://media.istockphoto.com/id/1349208049/es/foto/marco-multicolor-de-accesorios-para-fiestas-o-cumplea%C3%B1os.jpg?b=1&s=612x612&w=0&k=20&c=TXLNCnfhI6JQmBQmK_WxvkjWxelBe1Dx306dHpBALDo=',
                  userId: userCred.user.uid,
                  createdAt: serverTimestamp()
                });
                birthdayCreated = true;
              }
            } catch (dateError) {
              console.warn(`Error processing birth date for ${nombreCompleto}:`, dateError);
            }
          }

          processResults.push({
            nombre: nombreCompleto,
            cedula: numeroDocumento,
            status: 'success',
            message: birthdayCreated ? 'Usuario creado y cumpleaños agregado al calendario' : 'Usuario creado exitosamente',
            pin: pin
          });

          successCounter++;

        } catch (error) {
          console.error(`Error processing row ${i + 1}:`, error);
          
          const nombre = [
            String(row['Primer Apellido'] || '').trim(),
            String(row['Segundo Apellido'] || '').trim(),
            String(row['Nombre Empleado'] || '').trim()
          ].filter(n => n).join(' ') || 'Usuario desconocido';

          processResults.push({
            nombre: nombre,
            cedula: String(row['Número Documento'] || row['Numero Documento'] || 'N/A'),
            status: 'error',
            message: error.message || 'Error desconocido',
            pin: null
          });

          errorCounter++;
        }

        // Small delay to prevent overwhelming Firebase
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setResults(processResults);
      setSuccessCount(successCounter);
      setErrorCount(errorCounter);
      setShowResults(true);

    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error al procesar el archivo: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const downloadResults = () => {
    const csvContent = [
      ['Nombre', 'Cédula', 'Estado', 'Mensaje', 'PIN'],
      ...results.map(result => [
        result.nombre,
        result.cedula,
        result.status === 'success' ? 'Exitoso' : 'Error',
        result.message,
        result.pin || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `resultados_registro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Registro Masivo de Usuarios</h1>
            <p className="text-gray-600">Sube un archivo Excel para registrar múltiples usuarios automáticamente</p>
          </div>

          {/* File Upload Section */}
          <div className="mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <FileSpreadsheet className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <div className="mb-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center">
                    <Upload className="mr-2 h-5 w-5" />
                    Seleccionar archivo Excel
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              {file && (
                <p className="text-sm text-gray-600 mb-4">
                  Archivo seleccionado: <span className="font-medium">{file.name}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">
                El archivo debe contener las columnas: Número Documento, Primer Apellido, Segundo Apellido, Nombre Empleado, Cargo Empleado, Fecha Nacimiento
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="text-center mb-8">
            <button
              onClick={processRegistrations}
              disabled={!file || loading}
              className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center text-lg font-medium"
            >
              <Users className="mr-2 h-6 w-6" />
              {loading ? 'Procesando...' : 'Procesar Registros'}
            </button>
          </div>

          {/* Progress Bar */}
          {loading && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Procesando usuarios...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-center mt-2 text-sm text-gray-600">
                {successCount} exitosos, {errorCount} errores de {totalUsers} total
              </div>
            </div>
          )}

          {/* Results Section */}
          {showResults && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Resultados del Procesamiento</h2>
                <button
                  onClick={downloadResults}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Descargar Resultados
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-green-900">{successCount}</p>
                      <p className="text-sm text-green-700">Usuarios creados</p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <XCircle className="h-8 w-8 text-red-600 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-red-900">{errorCount}</p>
                      <p className="text-sm text-red-700">Errores</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-2xl font-bold text-blue-900">
                        {results.filter(r => r.message.includes('cumpleaños')).length}
                      </p>
                      <p className="text-sm text-blue-700">Cumpleaños agregados</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Results Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cédula
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PIN
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mensaje
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.map((result, index) => (
                        <tr key={index} className={result.status === 'success' ? 'bg-green-50' : 'bg-red-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {result.nombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {result.cedula}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              result.status === 'success' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.status === 'success' ? (
                                <CheckCircle className="mr-1 h-3 w-3" />
                              ) : (
                                <XCircle className="mr-1 h-3 w-3" />
                              )}
                              {result.status === 'success' ? 'Exitoso' : 'Error'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                            {result.pin || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {result.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-medium text-blue-900 mb-2">Instrucciones</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• El archivo Excel debe contener las columnas mencionadas</li>
                  <li>• El PIN se generará automáticamente usando los últimos 4 dígitos de la cédula</li>
                  <li>• Se crearán usuarios en Firebase Auth y en la colección users</li>
                  <li>• Se agregarán eventos de cumpleaños al calendario automáticamente</li>
                  <li>• Todos los usuarios tendrán rol user por defecto</li>
                  <li>• Los campos adicionales se guardarán en el campo extra</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}