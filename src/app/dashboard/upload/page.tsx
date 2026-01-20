"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import DeleteAllUsersButton from './delete';

interface ExcelRow {
  'Tipo de Documento': string;
  'Número Documento': string;
  'Primer Apellido': string;
  'Segundo Apellido': string;
  'Nombre Empleado': string;
  'Fecha Nacimiento': string | number;
  'Fecha Ingreso': string | number;
  'Dpto Donde Labora': string;
  'Cargo Empleado': string;
  'Tipo Cuenta': string;
  'Número Cuenta': string;
  'Banco': string;
  'EPS': string;
  'AFP': string;
  'Caja Compensación': string;
  'ARL': string;
  'Fondo Cesantías': string;
}

interface ProcessResult {
  success: number;
  failed: number;
  errors: string[];
}

const ExcelUserUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const excelDateToJSDate = (value: string | number): Date => {
    if (typeof value === 'number') {
      const base = new Date(1899, 11, 30);
      return new Date(base.getTime() + value * 86400000);
    }

    const normalized = value.replace(/-/g, '/');
    const [d, m, y] = normalized.split('/').map(Number);
    return new Date(y, m - 1, d);
  };

  const dateToExcelSerial = (date: Date): number => {
    const epoch = new Date(1899, 11, 30);
    return Math.floor((date.getTime() - epoch.getTime()) / 86400000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const processExcel = async () => {
    if (!file) return;

    setProcessing(true);
    setResult(null);

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];

          try {
            if (!row['Número Documento'] || !row['Nombre Empleado']) {
              throw new Error('Missing required fields');
            }

            const birthDate = excelDateToJSDate(row['Fecha Nacimiento']);
            const ingresoDate = excelDateToJSDate(row['Fecha Ingreso']);

            const fullName = `${row['Nombre Empleado']} ${row['Primer Apellido'] || ''} ${row['Segundo Apellido'] || ''}`.trim();

            let posicion = 'ADMINISTRATIVO';
            const cargo = (row['Cargo Empleado'] || '').toUpperCase();
            if (cargo.includes('CONDUCTOR')) posicion = 'CONDUCTOR';
            if (cargo.includes('AUXILIAR') || cargo.includes('OPERARIO')) posicion = 'AUXILIAR';

            const cedula = String(row['Número Documento']);

            const res = await fetch('/api/create-user-from-excel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cedula,
                nombre: fullName,
                posicion,
                fechaNacimiento: birthDate,
                extra: {
                  'Tipo de Documento': row['Tipo de Documento'] || '',
                  'Dpto Donde Labora': row['Dpto Donde Labora'] || '',
                  'Cargo Empleado': row['Cargo Empleado'] || '',
                  'Tipo Cuenta': row['Tipo Cuenta'] || '',
                  'Número Cuenta': String(row['Número Cuenta'] || ''),
                  'Banco': row['Banco'] || '',
                  'EPS': row['EPS'] || '',
                  'FONDO DE PENSIONES': row['AFP'] || '',
                  'CAJA DE COMPENSACION': row['Caja Compensación'] || '',
                  'ARL': row['ARL'] || '',
                  'Fondo Cesantías': row['Fondo Cesantías'] || '',
                  'Fecha Ingreso': dateToExcelSerial(ingresoDate),
                },
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'API error');
            }

            success++;
          } catch (err) {
            failed++;
            errors.push(
              `Row ${i + 2} (${row['Nombre Empleado'] || 'Unknown'}): ${
                err instanceof Error ? err.message : 'Unknown error'
              }`
            );
          }
        }

        setResult({ success, failed, errors });
      } catch (err) {
        setResult({
          success: 0,
          failed: 1,
          errors: [err instanceof Error ? err.message : 'Excel processing failed'],
        });
      } finally {
        setProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold mb-6 flex gap-3 items-center">
          <Upload /> Upload Excel – Create Users
        </h1>

        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />

        <button
          onClick={processExcel}
          disabled={!file || processing}
          className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg"
        >
          {processing ? <Loader2 className="animate-spin mx-auto" /> : 'Process'}
        </button>

        {result && (
          <div className="mt-6">
            <p className="text-green-700">Success: {result.success}</p>
            <p className="text-red-700">Failed: {result.failed}</p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-sm text-red-600">{e}</p>
            ))}
          </div>
        )}
      </div>

      <DeleteAllUsersButton />
    </div>
  );
};

export default ExcelUserUpload;
