import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import {
  TEMPLATE_FIELDS,
  guessTemplateFieldForHeader,
} from '../../../../lib/certificado-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Column {
  key: string;
  name: string;
  templateField: string | null;
  order: number;
}

function cleanCell(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' ? null : s;
  }
  return v;
}

function normalizeCedula(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(/\D/g, '');
}

/**
 * POST /api/certificados/upload
 *  - form field `file`   : the EXOGENA xlsx file (required)
 *  - form field `year`   : gravable year, e.g. 2025
 *  - form field `headerRow` (optional): 1-indexed row number where headers live. If absent,
 *    we auto-detect (look for a row containing the cedula column).
 *
 * Behaviour:
 *  1. Parses the sheet's headers and locates the cedula column.
 *  2. If no `certificado_config` exists for the year, auto-generates one by fuzzy-mapping
 *     headers to TEMPLATE_FIELDS. If one exists, we *add* any missing columns using the
 *     same guessing — never overwriting an admin's rename.
 *  3. Upserts one document per cedula into `certificados` keyed by (year, cedula), linking
 *     to users._id where the cedula matches.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Form inválido' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }
  const year = Number(form.get('year') || new Date().getFullYear() - 1);
  const headerRowHint = Number(form.get('headerRow') || 0);

  if (!Number.isFinite(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: 'year inválido' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellFormula: false });
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 });
  }

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return NextResponse.json({ error: 'El archivo no tiene hojas' }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  }

  // --- Locate the header row ---
  let headerRowIdx = -1;
  if (headerRowHint > 0 && headerRowHint <= rows.length) {
    headerRowIdx = headerRowHint - 1;
  } else {
    // Heuristic: pick the first row containing a cedula/identification column, scanning up to first 8 rows.
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const row = rows[i] || [];
      const asText = row.map((v) => String(v ?? '').toLowerCase());
      const hasCedula = asText.some(
        (s) =>
          s.includes('identificacion del beneficiario') ||
          s.includes('identificación del beneficiario') ||
          s.includes('numero de identificacion') ||
          s.includes('número de identificación')
      );
      if (hasCedula) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    return NextResponse.json(
      { error: 'No se encontró la fila de encabezados (debe contener "Número de Identificación del beneficiario")' },
      { status: 400 }
    );
  }

  const headerRow = rows[headerRowIdx] as unknown[];
  const headers: string[] = headerRow.map((v) => (v == null ? '' : String(v).trim()));

  // Find cedula column index
  const cedulaColIdx = headers.findIndex((h) => {
    const n = h.toLowerCase();
    return (
      n.includes('identificación del beneficiario') ||
      n.includes('identificacion del beneficiario') ||
      n.includes('número de identificación') ||
      n.includes('numero de identificacion')
    );
  });

  if (cedulaColIdx === -1) {
    return NextResponse.json(
      { error: 'No se encontró la columna "Número de Identificación del beneficiario"' },
      { status: 400 }
    );
  }

  const db = await getDb();
  const configCol = db.collection('certificado_config');
  const certificadosCol = db.collection('certificados');
  const usersCol = db.collection('users');

  // --- Load or create config ---
  const existingConfig = await configCol.findOne({ year });
  const existingColumns: Column[] = (existingConfig?.columns as Column[]) || [];

  // Build a map of header → existing column (by name OR by previous header-derived key)
  const byName = new Map<string, Column>();
  for (const c of existingColumns) byName.set(c.name.toLowerCase(), c);

  // Build the final column list by iterating header columns in order
  const columns: Column[] = [];
  const headerToKey = new Map<number, string>();

  for (let i = 0; i < headers.length; i++) {
    const headerRaw = headers[i];
    if (!headerRaw) continue;

    // Try to preserve existing column's key+templateField by matching the header name.
    const matchedExisting = byName.get(headerRaw.toLowerCase());
    if (matchedExisting) {
      columns.push({ ...matchedExisting, order: columns.length });
      headerToKey.set(i, matchedExisting.key);
      continue;
    }

    // Otherwise generate a new key (stable for the lifetime of the year).
    const key = `col_${year}_${i}_${Date.now().toString(36)}`;
    const templateField = guessTemplateFieldForHeader(headerRaw);
    const col: Column = { key, name: headerRaw, templateField, order: columns.length };
    columns.push(col);
    headerToKey.set(i, key);
  }

  // Keep any columns that existed before but aren't in the current header row (admin may
  // have added custom ones previously); don't strip them.
  for (const prev of existingColumns) {
    if (!columns.find((c) => c.key === prev.key)) {
      columns.push({ ...prev, order: columns.length });
    }
  }

  await configCol.updateOne(
    { year },
    {
      $set: { columns, updated_at: new Date() },
      $setOnInsert: { year, created_at: new Date() },
    },
    { upsert: true }
  );

  // --- Import data rows ---
  interface RowResult {
    row: number;
    cedula: string;
    status: 'imported' | 'skipped' | 'error';
    linked_user: boolean;
    error?: string;
  }
  const results: RowResult[] = [];
  let imported = 0;
  let skipped = 0;
  let linked = 0;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.length === 0) continue;

    const cedula = normalizeCedula(row[cedulaColIdx]);
    if (!cedula) {
      skipped++;
      continue;
    }

    // Build `data` object keyed by column key
    const data: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headerToKey.get(c);
      if (!key) continue;
      const val = cleanCell(row[c]);
      data[key] = val;
    }

    try {
      const userDoc = await usersCol.findOne(
        { cedula },
        { projection: { _id: 1, nombre: 1 } }
      );
      const userId = userDoc?._id?.toString() ?? null;
      if (userId) linked++;

      await certificadosCol.updateOne(
        { year, cedula },
        {
          $set: {
            year,
            cedula,
            user_id: userId,
            data,
            updated_at: new Date(),
            uploaded_by: session.user.id,
          },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      );
      imported++;
      results.push({
        row: r + 1,
        cedula,
        status: 'imported',
        linked_user: !!userId,
      });
    } catch (err) {
      results.push({
        row: r + 1,
        cedula,
        status: 'error',
        linked_user: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    year,
    header_row: headerRowIdx + 1,
    columns,
    imported,
    skipped,
    linked_users: linked,
    total_rows: rows.length - headerRowIdx - 1,
    results: results.slice(0, 1000),
    template_fields: TEMPLATE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
  });
}
