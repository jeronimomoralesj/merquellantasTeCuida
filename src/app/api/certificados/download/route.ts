import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import {
  buildCertificadoXlsm,
  TEMPLATE_FIELDS,
} from '../../../../lib/certificado-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Column {
  key: string;
  name: string;
  templateField: string | null;
  order: number;
}

/**
 * GET /api/certificados/download?year=2025[&cedula=xxx]
 * - Admins can download any cedula's certificate.
 * - Regular users can only download their own (cedula derived from session).
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
      { projection: { _id: 1, nombre: 1, cedula: 1, primer_apellido: 1, segundo_apellido: 1, first_name: 1 } }
    ),
  ]);

  if (!record) {
    return NextResponse.json(
      { error: `No hay certificado del año ${year} para la cédula ${cedula}.` },
      { status: 404 }
    );
  }

  // Build templateField -> value mapping using the config's column key mapping.
  const columns: Column[] = (config?.columns as Column[]) || [];
  const data = (record.data ?? {}) as Record<string, unknown>;

  const templateValues: Record<string, unknown> = {};
  for (const c of columns) {
    if (!c.templateField) continue;
    const v = data[c.key];
    if (v !== undefined && v !== null && v !== '') {
      templateValues[c.templateField] = v;
    }
  }

  // Always include cedula (from the record, not just from the column mapping).
  templateValues['cedula'] = record.cedula;

  // Fill in identity fields from the user profile if not present in data (nicer fallback).
  if (user) {
    if (!templateValues['primerApellido'] && user.primer_apellido) {
      templateValues['primerApellido'] = String(user.primer_apellido).toUpperCase();
    }
    if (!templateValues['segundoApellido'] && user.segundo_apellido) {
      templateValues['segundoApellido'] = String(user.segundo_apellido).toUpperCase();
    }
    if (!templateValues['primerNombre'] && user.first_name) {
      templateValues['primerNombre'] = String(user.first_name).toUpperCase();
    }
  }

  const buf = buildCertificadoXlsm(templateValues, {
    year,
    employerNit: 800166833,
    employerDv: 3,
    employerRazonSocial: 'MERQUELLANTAS SAS',
    ciudad: 'Bogotá',
    codDepto: 11,
    codMunicipio: '001',
    fechaEmision: new Date(),
  });

  // Sanity log for debugging in dev (number of populated template fields).
  const populated = Object.keys(templateValues).length;
  console.log(
    `[cert-download] cedula=${cedula} year=${year} populated=${populated}/${TEMPLATE_FIELDS.length}`
  );

  const filename = `certificado_ingresos_${year}_${cedula}.xlsm`;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  });
}

// Helper endpoint for clients that need to check availability before showing the button.
export async function HEAD(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse(null, { status: 401 });
  const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear() - 1);
  const cedula = session.user.cedula;
  if (!cedula) return new NextResponse(null, { status: 400 });
  const db = await getDb();
  const rec = await db.collection('certificados').findOne(
    { year, cedula },
    { projection: { _id: 1 } }
  );
  return new NextResponse(null, { status: rec ? 200 : 404 });
}

