"use client";

import React, { useState } from 'react';
import DashboardNavbar from '../navbar';
import { 
  FileText, 
  Download, 
  Search, 
  Filter,
  File,
  FileSpreadsheet,
  ExternalLink
} from 'lucide-react';

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  // Document data with the provided URLs
  const documents = [
    {
      id: 1,
      title: "Estándares mínimos SG-SST SURA",
      description: "Documento que establece los estándares mínimos del Sistema de Gestión de Seguridad y Salud en el Trabajo según SURA",
      type: "pdf",
      category: "SST",
      url: "https://firebasestorage.googleapis.com/v0/b/gocktail-1d32b.appspot.com/o/Esta%CC%81ndares%20mi%CC%81nimos%20SG-SST%20SURA.pdf?alt=media&token=1bad3d0c-0467-4948-92a7-18ddf31bece0",
      size: "2.3 MB",
      uploadDate: "2024-01-15"
    },
    {
      id: 2,
      title: "Formato Inspección General Sedes",
      description: "Formato FT-SST-25 para realizar inspecciones generales en las diferentes sedes de la empresa",
      type: "excel",
      category: "SST",
      url: "https://firebasestorage.googleapis.com/v0/b/gocktail-1d32b.appspot.com/o/FT-SST-25.%20FORMATO%20INSPECCION%20GENERAL%20sedes.xlsx?alt=media&token=73aa351f-1b43-4bf3-84ff-9547582ebe81",
      size: "45 KB",
      uploadDate: "2024-01-12"
    },
    {
      id: 3,
      title: "Modelo Carta de Vacaciones",
      description: "Plantilla de RRHH para la elaboración de cartas de solicitud y aprobación de vacaciones del personal",
      type: "word",
      category: "RRHH",
      url: "https://firebasestorage.googleapis.com/v0/b/gocktail-1d32b.appspot.com/o/RRHH%20-%20MODELO%20CARTA%20DE%20VACACIONES.docx?alt=media&token=dce8172f-a108-4f85-b880-e7b6403bad7b",
      size: "28 KB",
      uploadDate: "2024-01-10"
    },
    {
      id: 4,
      title: "Formato Acta de Reuniones",
      description: "Formato estándar para documentar y registrar las actas de reuniones corporativas y operativas",
      type: "pdf",
      category: "Administrativo",
      url: "https://firebasestorage.googleapis.com/v0/b/gocktail-1d32b.appspot.com/o/FORMATO%20ACTA%20DE%20REUNIONES.pdf?alt=media&token=50cb2ee4-a304-494d-a99a-5c92db62ecc6",
      size: "156 KB",
      uploadDate: "2024-01-08"
    }
  ];

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(documents.map(doc => doc.category)))];

  // Filter documents based on search and category
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get file icon based on type
  const getFileIcon = (type: string) => {
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
  const handleDocumentAction = (doc: any) => {
    setLoading(true);
    // Open document in new tab
    window.open(doc.url, '_blank');
    setTimeout(() => setLoading(false), 1000);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

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
                    </div>

                    {/* Document Info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-[#ff9900] transition-colors">
                        {doc.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {doc.description}
                      </p>
                    </div>

                    {/* Document Metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>Tamaño: {doc.size}</span>
                      <span>{formatDate(doc.uploadDate)}</span>
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
    </div>
  );
}