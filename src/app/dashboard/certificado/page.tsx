"use client";

import React, { useState } from 'react';
import { 
  FileText, Download, DollarSign, Calendar, ChevronRight, 
  ArrowDown, ArrowUp, 
} from 'lucide-react';
import DashboardNavbar from '../navbar';

const CertificadoPage = () => {
  // Sample account statement data
  const accountStatementData = {
    totalBalance: 1250000,
    currentDebt: 750000,
    availableCredit: 500000,
    minimumPayment: 150000,
    paymentDueDate: "15 mayo, 2025",
    transactions: [
      {
        id: 1,
        date: "02 mayo, 2025",
        description: "Pago deuda",
        amount: -85000,
        type: "expense",
        category: "Groceries"
      },
      {
        id: 2,
        date: "28 abril, 2025",
        description: "Pago deuda",
        amount: -120000,
        type: "expense",
        category: "Reimbursement"
      },
      {
        id: 3,
        date: "20 abril, 2025",
        description: "Pago deuda",
        amount: -45000,
        type: "expense",
        category: "Utilities"
      },
      {
        id: 4,
        date: "15 abril, 2025",
        description: "Pago deuda",
        amount: -2500000,
        type: "expense",
        category: "Salary"
      }
    ]
  };

  const [showFullStatement, setShowFullStatement] = useState(false);

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar activePage='' />

      <main className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 mt-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center">
              <span className="bg-gradient-to-r from-[#ff9900] to-[#ffb347] text-transparent bg-clip-text">
                Estado de Cuenta
              </span>
            </h1>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).charAt(0).toUpperCase()}
            </p>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#ff9900] to-white"></div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-[#ff9900]" />
                    Resumen de Cuenta
                  </h2>
                  <button 
                    className="text-[#ff9900] text-sm font-medium flex items-center hover:underline"
                    onClick={() => window.print()}
                  >
                    <Download className="h-4 w-4 mr-1" /> Descargar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#ff9900]/10 p-4 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Saldo Total</p>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {formatCurrency(accountStatementData.totalBalance)}
                    </h3>
                  </div>
                  <div className="bg-blue-100 p-4 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Deuda Actual</p>
                    <h3 className="text-2xl font-bold text-blue-900">
                      {formatCurrency(accountStatementData.currentDebt)}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Pago Mínimo</p>
                    <p className="font-medium text-[#ff9900]">
                      {formatCurrency(accountStatementData.minimumPayment)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fecha Límite de Pago</p>
                    <p className="font-medium text-gray-900 flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                      {accountStatementData.paymentDueDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions Section */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-white"></div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-[#ff9900]" />
                    Transacciones Recientes
                  </h2>
                  <button 
                    className="text-[#ff9900] text-sm font-medium flex items-center hover:underline"
                    onClick={() => setShowFullStatement(!showFullStatement)}
                  >
                    {showFullStatement ? "Ver menos" : "Ver todas"}
                    <ChevronRight className={`ml-1 h-4 w-4 transition-transform ${showFullStatement ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  {(showFullStatement ? accountStatementData.transactions : accountStatementData.transactions.slice(0, 3)).map(transaction => (
                    <div 
                      key={transaction.id} 
                      className="flex items-center p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-[#ff9900]/30 hover:shadow-sm"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                        transaction.type === 'income' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {transaction.type === 'income' ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{transaction.description}</h3>
                        <p className="text-xs text-gray-500">{transaction.date}</p>
                      </div>
                      <div>
                        <span className={`font-medium ${
                          transaction.type === 'income' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Account Details Card */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-green-500 via-green-400 to-white"></div>
                <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-[#ff9900]" />
                  Detalles de la Cuenta
                </h2>
                
                <div className="space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <p className="text-sm text-gray-500">Número de Cuenta</p>
                    <p className="font-medium text-gray-900">4532 **** **** 7890</p>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <p className="text-sm text-gray-500">Tipo de Cuenta</p>
                    <p className="font-medium text-gray-900">Cuenta Corriente</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CertificadoPage;