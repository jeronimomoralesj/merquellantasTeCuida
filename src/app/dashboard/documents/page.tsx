"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from '../../../firebase'; // Adjust path as needed
import DashboardNavbar from '../navbar';
import { 
  FileText, 
  Download, 
  Search, 
  Filter,
  File,
  FileSpreadsheet,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  X
} from 'lucide-react';

// Type definitions
interface Document {
  id: string;
  name: string;
  category: string;
  dateUploaded: Timestamp | Date; 
  document: string;
  size?: string;
  type?: 'pdf' | 'excel' | 'word' | 'other';
}

interface UserData {
  nombre: string;
  rol: string;
  posicion: string;
  antiguedad?: number | string;
  extra?: Record<string, unknown>;
}


export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [userRole, setUserRole] = useState<string>('user');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploading, setUploading] = useState(false);

  // Helper functions
  const convertExcelDateToJSDate = (excelDate: number): Date => {
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
    return jsDate;
  };

  const calculateYearsOfService = (startDate: Date): number => {
    const today = new Date();
    const years = today.getFullYear() - startDate.getFullYear();
    const monthDiff = today.getMonth() - startDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < startDate.getDate())) {
      return years - 1;
    }
    return years;
  };

  // Auth and user profile setup
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) {
        const data = snap.data() as UserData;

        // Handle antiguedad calculation
        let calculatedAntiguedad = 0;
        
        if (data.extra?.["Fecha Ingreso"]) {
          const fechaIngreso = data.extra["Fecha Ingreso"];
          console.log("Fecha Ingreso found:", fechaIngreso);
          const startDate = convertExcelDateToJSDate(fechaIngreso);
          console.log("Converted start date:", startDate);
          calculatedAntiguedad = calculateYearsOfService(startDate);
          console.log("Calculated antiguedad:", calculatedAntiguedad);
        } else if (data.antiguedad) {
          if (typeof data.antiguedad === 'number' && data.antiguedad > 1000) {
            const startDate = convertExcelDateToJSDate(data.antiguedad);
            calculatedAntiguedad = calculateYearsOfService(startDate);
            console.log("Converted antiguedad from Excel date:", calculatedAntiguedad);
          } else {
            calculatedAntiguedad = typeof data.antiguedad === 'string' 
              ? parseInt(data.antiguedad) || 0 
              : data.antiguedad;
          }
        }

        setUserRole(data.rol || "user");
      }
    });
    
    return () => unsub();
  }, []);

  // Fetch documents from Firestore
useEffect(() => {
  fetchDocuments();
}, []);


  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'documentos'));
      const docs: Document[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({
          id: doc.id,
          name: data.name,
          category: data.category,
          dateUploaded: data.dateUploaded,
          document: data.document,
          size: data.size || 'N/A',
          type: getFileTypeFromUrl(data.document)
        });
      });
      
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get file type from URL
  const getFileTypeFromUrl = (url: string): 'pdf' | 'excel' | 'word' | 'other' => {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'docx':
      case 'doc':
        return 'word';
      default:
        return 'other';
    }
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(documents.map(doc => doc.category)))];

  // Filter documents based on search and category
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get file icon based on type
  const getFileIcon = (type: Document['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="text-red-500" size={24} />;
      case 'excel':
        return <FileSpreadsheet className="text-green-500" size={24} />;
      case 'word':
        return <File className="text-blue-500" size={24} />;
      default:
        return <File className="text-gray-500" size={24} />;
    }
  };

  // Handle document download/view
  const handleDocumentAction = (doc: Document) => {
    window.open(doc.document, '_blank');
  };

  // Format date
const formatDate = (
  timestamp: Timestamp | Date | string | null | undefined
): string => {
  if (!timestamp) return 'N/A';

  let date: Date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if ('toDate' in timestamp) {
    date = timestamp.toDate();
  } else {
    return 'N/A';
  }

  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadFile || !uploadName || !uploadCategory) {
      alert('Por favor completa todos los campos');
      return;
    }

    setUploading(true);
    try {
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `documentos/${uploadFile.name}`);
      const snapshot = await uploadBytes(storageRef, uploadFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Add document to Firestore
      await addDoc(collection(db, 'documentos'), {
        name: uploadName,
        category: uploadCategory,
        dateUploaded: new Date(),
        document: downloadURL,
        size: `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB`
      });

      // Reset form and refresh documents
      setUploadFile(null);
      setUploadName('');
      setUploadCategory('');
      setShowUploadModal(false);
      fetchDocuments();
      
      alert('Documento subido exitosamente');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion
  const handleDelete = async (docToDelete: Document) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      return;
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'documentos', docToDelete.id));
      
      // Delete from Storage
      const storageRef = ref(storage, docToDelete.document);
      await deleteObject(storageRef);
      
      // Refresh documents
      fetchDocuments();
      alert('Documento eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error al eliminar el documento');
    }
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <DashboardNavbar activePage="documents" />
      
      {/* Main Content */}
      <div className="pt-16 pb-8 text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Documentos Merquellantas</h1>
            <p className="text-gray-600">Gestiona y accede a todos los documentos corporativos</p>
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div className="bg-gradient-to-r from-[#ff9900] to-[#e68a00] rounded-xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white text-lg font-semibold mb-2">Panel de Administración</h2>
                  <p className="text-white/80 text-sm">Gestiona los documentos de la empresa</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center px-4 py-2 bg-white text-[#ff9900] rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Plus size={16} className="mr-2" />
                  Subir Documento
                </button>
              </div>
            </div>
          )}

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent appearance-none bg-white min-w-40"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.slice(1).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Document Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-[#ff9900]/10 rounded-lg">
                  <FileText className="text-[#ff9900]" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
                  <p className="text-gray-600">Total Documentos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff9900]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map(doc => (
                <div 
                  key={doc.id}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="p-6">
                    {/* Document Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-[#ff9900]/10 transition-colors">
                          {getFileIcon(doc.type)}
                        </div>
                        <div className="ml-3">
                          <span className="inline-block px-2 py-1 bg-[#ff9900]/10 text-[#ff9900] text-xs font-medium rounded-full">
                            {doc.category}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Document Info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-[#ff9900] transition-colors">
                        {doc.name}
                      </h3>
                    </div>

                    {/* Document Metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>Tamaño: {doc.size}</span>
                      <span>{formatDate(doc.dateUploaded)}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDocumentAction(doc)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-[#ff9900] text-white rounded-lg hover:bg-[#e68a00] transition-colors"
                      >
                        <ExternalLink size={16} className="mr-2" />
                        Ver/Abrir
                      </button>
                      <button
                        onClick={() => handleDocumentAction(doc)}
                        className="px-4 py-2 border border-[#ff9900] text-[#ff9900] rounded-lg hover:bg-[#ff9900]/10 transition-colors"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {filteredDocuments.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-gray-500 font-medium mb-2">No se encontraron documentos</h3>
              <p className="text-gray-400 text-sm">
                Intenta ajustar los filtros de búsqueda o categoría.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Subir Documento</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivo
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent"
                  accept=".pdf,.xlsx,.xls,.docx,.doc"
                />
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Documento
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent"
                  placeholder="Ingresa el nombre del documento"
                />
              </div>

              {/* Category Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoría
                </label>
                <input
                  type="text"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff9900] focus:border-transparent"
                  placeholder="Ingresa la categoría (ej: SST, RRHH, etc.)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !uploadName || !uploadCategory}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-[#ff9900] text-white rounded-lg hover:bg-[#e68a00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2" />
                      Subir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}