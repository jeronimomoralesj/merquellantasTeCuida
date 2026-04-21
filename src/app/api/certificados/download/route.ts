import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { TEMPLATE_FIELDS, coerceNumber } from '../../../../lib/certificado-template';
import {
  renderCertificadoPdf,
  type CertificadoValues,
} from '../../../../lib/certificado-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Column {
  key: string;
  name: string;
  templateField: string | null;
  order: number;
}

function toDate(v: unknown): Date | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  if (typeof v === 'number') {
    // Excel serial
    const ms = (v - 25569) * 86400000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * GET /api/certificados/download?year=2025[&cedula=xxx]
 *
 * Returns a PDF rendering of the DIAN F-220 certificate for the requested user/year.
 * Admins can pass any cedula; regular users are automatically scoped to their own.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const isAdmin = session.user.rol === 'admin';
  const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear() - 1);
  const cedulaParam = req.nextUrl.searchParams.get('cedula') || '';

  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'year inválido' }, { status: 400 });
  }

  const cedula = isAdmin && cedulaParam ? cedulaParam.replace(/\D/g, '') : session.user.cedula;
  if (!cedula) {
    return NextResponse.json({ error: 'Sin cédula en sesión' }, { status: 400 });
  }

  const db = await getDb();
  const [record, config, user] = await Promise.all([
    db.collection('certificados').findOne({ year, cedula }),
    db.collection('certificado_config').findOne({ year }),
    db.collection('users').findOne(
      { cedula },
      {
        projection: {
          _id: 1,
          nombre: 1,
          cedula: 1,
          primer_apellido: 1,
          segundo_apellido: 1,
          first_name: 1,
        },
      },
    ),
  ]);

  if (!record) {
    return NextResponse.json(
      { error: `No hay certificado del año ${year} para la cédula ${cedula}.` },
      { status: 404 },
    );
  }

  // Map stored column values → well-known template fields via the config mapping.
  const columns: Column[] = (config?.columns as Column[]) || [];
  const data = (record.data ?? {}) as Record<string, unknown>;
  const bag: Record<string, unknown> = {};
  for (const c of columns) {
    if (!c.templateField) continue;
    const v = data[c.key];
    if (v !== undefined && v !== null && v !== '') bag[c.templateField] = v;
  }
  // Cedula always comes from the record (the column mapping may be misconfigured).
  bag['cedula'] = record.cedula;

  // Fallback identity from the user doc when EXOGENA didn't provide those fields.
  if (user) {
    if (!bag['primerApellido'] && user.primer_apellido) {
      bag['primerApellido'] = String(user.primer_apellido).toUpperCase();
    }
    if (!bag['segundoApellido'] && user.segundo_apellido) {
      bag['segundoApellido'] = String(user.segundo_apellido).toUpperCase();
    }
    if (!bag['primerNombre'] && user.first_name) {
      bag['primerNombre'] = String(user.first_name).toUpperCase();
    }
  }

  // Period defaults — jan 1 → dec 31 of the gravable year.
  const fechaInicial =
    toDate(bag['fechaInicial']) ?? new Date(Date.UTC(year, 0, 1));
  const fechaFinal =
    toDate(bag['fechaFinal']) ?? new Date(Date.UTC(year, 11, 31));

  // Only the number-kind template fields get coerced; text/date stay strings/Dates.
  const numberKeys = new Set(
    TEMPLATE_FIELDS.filter((f) => f.kind === 'number').map((f) => f.key),
  );

  const values: CertificadoValues = {
    cedula: String(bag['cedula']),
    tipoDocumentoCode: bag['tipoDocumento'] ? String(bag['tipoDocumento']) : '13',
    primerApellido: bag['primerApellido'] ? String(bag['primerApellido']) : undefined,
    segundoApellido: bag['segundoApellido'] ? String(bag['segundoApellido']) : undefined,
    primerNombre: bag['primerNombre'] ? String(bag['primerNombre']) : undefined,
    otrosNombres: bag['otrosNombres'] && String(bag['otrosNombres']).trim() !== '0'
      ? String(bag['otrosNombres'])
      : undefined,
    fechaInicial,
    fechaFinal,
    fechaEmision: new Date(),

    pagosSalarios: numberKeys.has('pagosSalarios') ? coerceNumber(bag['pagosSalarios']) : 0,
    pagosBonosEtc: numberKeys.has('pagosBonosEtc') ? coerceNumber(bag['pagosBonosEtc']) : 0,
    valorExcesoAlimentacion: coerceNumber(bag['valorExcesoAlimentacion']),
    pagosHonorarios: coerceNumber(bag['pagosHonorarios']),
    pagosServicios: coerceNumber(bag['pagosServicios']),
    pagosComisiones: coerceNumber(bag['pagosComisiones']),
    pagosPrestacionesSociales: coerceNumber(bag['pagosPrestacionesSociales']),
    pagosViaticos: coerceNumber(bag['pagosViaticos']),
    pagosGastosRepresentacion: coerceNumber(bag['pagosGastosRepresentacion']),
    pagosCompensacionCoop: coerceNumber(bag['pagosCompensacionCoop']),
    otrosPagos: coerceNumber(bag['otrosPagos']),
    auxilioCesantiasEIntereses: coerceNumber(bag['auxilioCesantiasEIntereses']),
    auxilioCesantiaRegimenTradicional: coerceNumber(bag['auxilioCesantiaRegimenTradicional']),
    auxilioCesantiaConsignadas: coerceNumber(bag['auxilioCesantiaConsignadas']),
    pensiones: coerceNumber(bag['pensiones']),
    apoyosEducativos: coerceNumber(bag['apoyosEducativos']),

    aportesSalud: coerceNumber(bag['aportesSalud']),
    aportesPension: coerceNumber(bag['aportesPension']),
    cotizacionesVoluntariasRAIS: coerceNumber(bag['cotizacionesVoluntariasRAIS']),
    aportesVoluntariosPension: coerceNumber(bag['aportesVoluntariosPension']),
    aportesAFC: coerceNumber(bag['aportesAFC']),
    aportesAVC: coerceNumber(bag['aportesAVC']),
    ingresoLaboralPromedio6m: coerceNumber(bag['ingresoLaboralPromedio6m']),
    valorRetencionFuente: coerceNumber(bag['valorRetencionFuente']),

    // Dependents — treat literal "0" as empty (EXOGENA puts zeros for "no dependent").
    tipoDocDependiente:
      bag['tipoDocDependiente'] && String(bag['tipoDocDependiente']).trim() !== '0'
        ? String(bag['tipoDocDependiente'])
        : undefined,
    numDocDependiente:
      bag['numDocDependiente'] && String(bag['numDocDependiente']).trim() !== '0'
        ? String(bag['numDocDependiente'])
        : undefined,
    nombreDependiente:
      bag['nombreDependiente'] && String(bag['nombreDependiente']).trim() !== '0'
        ? String(bag['nombreDependiente'])
        : undefined,
    parentescoDependiente:
      bag['parentescoDependiente'] && String(bag['parentescoDependiente']).trim() !== '0'
        ? String(bag['parentescoDependiente'])
        : undefined,
  };

  const pdf = await renderCertificadoPdf({
    year,
    values,
    employer: {
      nit: 800166833,
      dv: 3,
      razonSocial: 'MERQUELLANTAS SAS',
      ciudad: 'Bogotá',
      codDepto: 11,
      codMunicipio: '001',
      nombrePagador: 'MERQUELLANTAS SAS',
    },
  });

  const filename = `certificado_ingresos_${year}_${cedula}.pdf`;
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store',
    },
  });
}

export async function HEAD(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse(null, { status: 401 });
  const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear() - 1);
  const cedula = session.user.cedula;
  if (!cedula) return new NextResponse(null, { status: 400 });
  const db = await getDb();
  const rec = await db.collection('certificados').findOne(
    { year, cedula },
    { projection: { _id: 1 } },
  );
  return new NextResponse(null, { status: rec ? 200 : 404 });
}
