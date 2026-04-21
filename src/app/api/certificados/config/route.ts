import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { TEMPLATE_FIELDS } from '../../../../lib/certificado-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Column {
  key: string;
  name: string;
  templateField: string | null;
  order: number;
}

/**
 * GET /api/certificados/config?year=2025
 * Returns the field configuration for the given year. If none exists,
 * returns an empty one with the template fields list (for reference).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear() - 1);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'year inválido' }, { status: 400 });
  }

  const db = await getDb();
  const config = await db.collection('certificado_config').findOne({ year });

  return NextResponse.json({
    year,
    columns: (config?.columns ?? []) as Column[],
    templateFields: TEMPLATE_FIELDS,
    updated_at: config?.updated_at ?? null,
  });
}

/**
 * PUT /api/certificados/config { year, columns: [{ key, name, templateField, order }] }
 * Upserts the full column list for a year. When admins rename a column, this keeps the
 * stable `key` but updates the display `name`. When they remove a column from the
 * list, its data in `certificados[i].data[key]` is left untouched — it is simply not
 * rendered in the UI.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.year !== 'number' || !Array.isArray(body.columns)) {
    return NextResponse.json({ error: 'body inválido' }, { status: 400 });
  }

  const templateKeys = new Set(TEMPLATE_FIELDS.map((f) => f.key));
  const columns: Column[] = body.columns.map((c: Column, i: number) => ({
    key: String(c.key || `col_${Date.now()}_${i}`),
    name: String(c.name || '').trim(),
    templateField: c.templateField && templateKeys.has(c.templateField) ? c.templateField : null,
    order: typeof c.order === 'number' ? c.order : i,
  }));

  const db = await getDb();
  await db.collection('certificado_config').updateOne(
    { year: body.year },
    {
      $set: { columns, updated_at: new Date() },
      $setOnInsert: { year: body.year, created_at: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true, year: body.year, columns });
}
