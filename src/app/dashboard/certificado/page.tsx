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
        <h1 className='text-black text-center mt-40'>Estamos trabajando para traerte esto..</h1>
      </main>
    </div>
  );
};

export default CertificadoPage;