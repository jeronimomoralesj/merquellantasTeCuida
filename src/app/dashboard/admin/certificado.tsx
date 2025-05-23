import { useState } from "react";
import {
  FileText,
  Search,
} from "lucide-react";

// Sample data for account certificates
const certificadosCuentaData = [
  {
    id: 1,
    name: "Juan Pérez García",
    accountNumber: "1234-5678-9012",
    outstandingBalance: 5500.50,
    status: "Pendiente",
    statusColor: "bg-yellow-100 text-yellow-800",
    lastPaymentDate: "2025-04-15"
  },
  {
    id: 2,
    name: "María Rodríguez López",
    accountNumber: "9876-5432-1098",
    outstandingBalance: 0,
    status: "Al día",
    statusColor: "bg-green-100 text-green-800",
    lastPaymentDate: "2025-05-01"
  },
  {
    id: 3,
    name: "Carlos Martínez Sánchez",
    accountNumber: "5432-1098-7654",
    outstandingBalance: 12500.75,
    status: "Vencido",
    statusColor: "bg-red-100 text-red-800",
    lastPaymentDate: "2024-12-15"
  },
  {
    id: 4,
    name: "Ana Gómez Fernández",
    accountNumber: "2109-8765-4321",
    outstandingBalance: 3200.25,
    status: "Pendiente",
    statusColor: "bg-yellow-100 text-yellow-800",
    lastPaymentDate: "2025-03-20"
  }
];

export default function CertificadoCuentaAdminCard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCertificados, setFilteredCertificados] = useState(certificadosCuentaData);

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Filter certificados based on name
    const filtered = certificadosCuentaData.filter(cert => 
      cert.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredCertificados(filtered);
  };

  // Format currency in Spanish format
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden text-black">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      
      {/* Header with Title and Search */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-blue-500" />
          Certificados de Cuenta
        </h2>
        
        {/* Search Input */}
        <div className="relative">
          <input 
            type="text"
            placeholder="Buscar por nombre"
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
          />
          <Search className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Certificados List */}
      <div className="space-y-4">
        {filteredCertificados.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No se encontraron resultados
          </div>
        ) : (
          filteredCertificados.map((certificado) => (
            <div
              key={certificado.id}
              className="flex items-center p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-blue-200 hover:shadow-sm"
            >
              {/* Account Initials Avatar */}
              <div className={`w-10 h-10 rounded-full overflow-hidden bg-blue-100 text-blue-600 flex items-center justify-center font-medium`}>
                {certificado.name.split(' ')[0][0] + certificado.name.split(' ')[1][0]}
              </div>

              {/* Account Details */}
              <div className="flex-1 ml-3">
                <h3 className="font-medium text-gray-900">
                  {certificado.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Cuenta: {certificado.accountNumber}
                </p>
              </div>

              {/* Balance and Status */}
              <div className="flex flex-col items-end">
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  {formatCurrency(certificado.outstandingBalance)}
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${certificado.statusColor}`}>
                  {certificado.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with Additional Info */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        Última actualización: {new Date().toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </div>
    </div>
  );
}