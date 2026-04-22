'use client';

import React, { useState, useEffect } from 'react';
import {
  Upload,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  FileText,
  X,
  UserCheck,
  Umbrella,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import JefeSelector, { type JefeOption } from './JefeSelector';

interface VacationBalance {
  days: number | null;
  as_of_date: string | null;
  scraped_at: string | null;
  stale: boolean;
}

interface VacacionesFormData {
  fechaInicio: string;
  fechaFin: string;
  description: string;
  documents: File[];
}

const VacacionesForm = () => {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<VacacionesFormData>({
    fechaInicio: '',
    fechaFin: '',
    description: '',
    documents: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState(false);
  const [diasVacaciones, setDiasVacaciones] = useState(0);
  const [jefe, setJefe] = useState<JefeOption | null>(null);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Fetch the user's current vacation balance on mount so they can see how many
  // días they actually have before trying to pick dates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vacations/me');
        if (!res.ok || cancelled) { setBalance(null); return; }
        const data = await res.json();
        if (!cancelled) {
          setBalance({
            days: typeof data.days === 'number' ? data.days : null,
            as_of_date: data.as_of_date ?? null,
            scraped_at: data.scraped_at ?? null,
            stale: !!data.stale,
          });
        }
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const availableDays = balance?.days ?? null;
  const exceedsAvailable =
    availableDays != null && diasVacaciones > 0 && diasVacaciones > availableDays;

  // Calculate vacation days whenever dates change
  useEffect(() => {
    if (formData.fechaInicio && formData.fechaFin) {
      const startDate = new Date(formData.fechaInicio);
      const endDate = new Date(formData.fechaFin);
      
      if (endDate >= startDate) {
        // Calculate the difference in time
        const timeDifference = endDate.getTime() - startDate.getTime();
        // Convert to days and add 1 to include both start and end dates
        const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;
        setDiasVacaciones(daysDifference);
      } else {
        setDiasVacaciones(0);
      }
    } else {
      setDiasVacaciones(0);
    }
  }, [formData.fechaInicio, formData.fechaFin]);

  const validateForm = () => {
    if (!formData.description.trim()) {
      setFormError('La descripción es requerida');
      return false;
    }
    if (!formData.fechaInicio) {
      setFormError('La fecha de inicio es requerida');
      return false;
    }
    if (!formData.fechaFin) {
      setFormError('La fecha de fin es requerida');
      return false;
    }
    if (new Date(formData.fechaFin) < new Date(formData.fechaInicio)) {
      setFormError('La fecha de fin debe ser posterior o igual a la fecha de inicio');
      return false;
    }
    if (formData.documents.length === 0) {
      setFormError('Debe adjuntar al menos un documento');
      return false;
    }
    if (!jefe) {
      setFormError('Selecciona al jefe inmediato que aprobará esta solicitud');
      return false;
    }
    return true;
  };

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormError('');
    setIsSubmitting(true);

    try {
      if (!session) {
        setFormError('Debe iniciar sesión para enviar una solicitud');
        return;
      }

      // Upload all documents
      const documentUrls: { url: string; name: string }[] = [];
      for (const file of formData.documents) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'vacaciones');
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) throw new Error('Error al subir el documento');
        const uploaded = await uploadRes.json();
        documentUrls.push({ url: uploaded.url || uploaded.webUrl, name: file.name });
      }

      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'vacaciones',
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          diasVacaciones,
          description: formData.description,
          documentName: documentUrls[0]?.name || null,
          documentUrl: documentUrls[0]?.url || null,
          documentUrls,
          approverId: jefe?.id,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Error al crear solicitud');
      }

      // Notify HR for their records. Supervisor approval email is sent server-side.
      await sendEmailNotification(session.user.nombre || 'Usuario');

      setSubmitted(true);

    } catch (err) {
      console.error(err);
      setFormError('Hubo un error al enviar su solicitud. Intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleRemoveFile = (idx: number) => {
    setFormData({ ...formData, documents: formData.documents.filter((_, i) => i !== idx) });
    setFileError(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFormError('');
  };
  
  const handleNewRequest = () => {
    setFormData({
      fechaInicio: '',
      fechaFin: '',
      description: '',
      documents: [],
    });
    setSubmitted(false);
    setFormError('');
    setDiasVacaciones(0);
    setJefe(null);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
        <p className="text-gray-600 mb-6">
          Su solicitud de vacaciones ha sido registrada exitosamente.
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
      <div className="bg-gradient-to-r from-[#f4a900]/10 to-white p-4 sm:p-6 border-b border-gray-100">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Solicitud de Vacaciones</h2>
        <p className="text-gray-600 text-sm mt-1">Complete todos los campos requeridos</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        {/* Current balance — fetched from /api/vacations/me so the employee can see
            how many días they have before picking dates. */}
        <VacationBalanceCard
          balance={balance}
          loading={loadingBalance}
          pendingDays={diasVacaciones}
          exceedsAvailable={exceedsAvailable}
        />

        {formError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-sm sm:text-base">{formError}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Info className="w-5 h-5 mr-2 text-[#f4a900]" />
              Descripción de las Vacaciones
            </h3>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Detalle su solicitud de vacaciones <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all resize-none"
                placeholder="Describa el motivo de su solicitud de vacaciones"
                maxLength={500}
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                {formData.description.length}/500 caracteres
              </p>
            </div>
          </div>
          
          {/* Date Range */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Calendar className="w-5 h-5 mr-2 text-[#f4a900]" />
              Período de Vacaciones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="fechaInicio"
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="fechaFin"
                  name="fechaFin"
                  value={formData.fechaFin}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f4a900] focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            {/* Days calculation display */}
            {diasVacaciones > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    Total de días de vacaciones: <span className="font-bold">{diasVacaciones} día{diasVacaciones !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Jefe inmediato */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <UserCheck className="w-5 h-5 mr-2 text-[#f4a900]" />
              Jefe inmediato <span className="ml-2 text-red-500 text-sm">*</span>
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Selecciona a la persona que debe aprobar tus vacaciones. Recibirá un correo
              con un enlace único para aprobarlas o rechazarlas.
            </p>
            <JefeSelector value={jefe} onChange={setJefe} />
          </div>

          {/* File Upload */}
          <div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 flex items-center mb-4">
              <Upload className="w-5 h-5 mr-2 text-[#f4a900]" />
              Documentación
            </h3>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${fileError ? 'border-red-300 bg-red-50' : formData.documents.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#f4a900]'}`}>
              {formData.documents.length < 5 && (
                <label className="cursor-pointer flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-[#f4a900]/10 rounded-full flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-[#f4a900]" />
                  </div>
                  <span className="font-medium text-gray-700 mb-1 text-sm">Adjuntar documentos</span>
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
          </div>
          
          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-6 py-3 bg-[#f4a900] text-white font-medium rounded-lg shadow-sm hover:bg-[#e68a00] focus:outline-none focus:ring-2 focus:ring-[#f4a900] focus:ring-offset-2 transition-all ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
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
      </form>
    </div>
  );
};

function VacationBalanceCard({
  balance,
  loading,
  pendingDays,
  exceedsAvailable,
}: {
  balance: VacationBalance | null;
  loading: boolean;
  pendingDays: number;
  exceedsAvailable: boolean;
}) {
  if (loading) {
    return (
      <div className="mb-6 h-24 bg-gray-100 rounded-2xl animate-pulse" />
    );
  }

  const days = balance?.days ?? null;
  const hasBalance = typeof days === 'number';
  const corte =
    balance?.as_of_date
      ? new Date(balance.as_of_date + 'T00:00:00').toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
  const actualizado =
    balance?.scraped_at
      ? new Date(balance.scraped_at).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

  return (
    <div
      className={`mb-6 relative overflow-hidden rounded-2xl border p-5 ${
        hasBalance
          ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              hasBalance ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Umbrella className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Tu saldo de vacaciones
            </p>
            {hasBalance ? (
              <p className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold text-emerald-600 leading-none">
                  {Number(days).toFixed(days! % 1 === 0 ? 0 : 2)}
                </span>
                <span className="text-sm text-gray-600">
                  {days === 1 ? 'día disponible' : 'días disponibles'}
                </span>
              </p>
            ) : (
              <p className="text-sm text-amber-800 mt-1">
                Aún no tenemos tus días sincronizados desde Heinsohn. Habla con Talento Humano
                si necesitas confirmar tu saldo antes de continuar.
              </p>
            )}
            {hasBalance && corte && (
              <p className="text-[11px] text-gray-500 mt-1">
                Corte: <span className="font-semibold text-gray-700">{corte}</span>
                {actualizado && <span className="text-gray-400"> · Actualizado {actualizado}</span>}
              </p>
            )}
          </div>
        </div>

        {hasBalance && balance?.stale && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" /> Pendiente actualizar
          </span>
        )}
      </div>

      {/* Soft warning when the picked range exceeds what's available. We don't
          block the submit — sometimes HR approves negative balances — but the
          employee should see it. */}
      {hasBalance && exceedsAvailable && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Estás solicitando <b>{pendingDays} días</b> pero solo tienes{' '}
            <b>{Number(days).toFixed(days! % 1 === 0 ? 0 : 2)} días disponibles</b>. Ajusta las
            fechas o habla con tu jefe para confirmar si te pueden aprobar el excedente.
          </span>
        </div>
      )}
    </div>
  );
}

export default VacacionesForm;