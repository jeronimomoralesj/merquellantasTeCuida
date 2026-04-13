import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
import * as XLSX from 'xlsx';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface ParsedCredit {
  credit_id: string;
  cedula: string;
  name: string;
  fecha_desembolso: Date | null;
  fecha_primera_cuota: Date | null;
  frecuencia: string;
  cuota_valor: number;
  numero_cuotas: number;
  tasa: number;
  saldo: number;
  valor_inicial: number;
}

/* ------------------------------------------------------------------ */
/*  Number / date helpers                                              */
/* ------------------------------------------------------------------ */

function parseColNumber(raw: string): number {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

function parseDateStr(raw: string): Date | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

// XLSX can give dates as JS Date objects, serial numbers, or strings
function normalizeDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }
  if (typeof val === 'string') return parseDateStr(val);
  return null;
}

function normalizeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') return parseColNumber(val);
  return 0;
}

/* ------------------------------------------------------------------ */
/*  XLSX parser (clean, reliable)                                      */
/* ------------------------------------------------------------------ */

function normalizeHeader(h: string): string {
  return String(h || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim()
    .replace(/\s+/g, ' ');
}

// Map various possible header names to our canonical field names
const HEADER_MAP: Record<string, string> = {
  'CREDITO': 'credit_id',
  'CEDULA': 'cedula',
  'NOMBRE': 'name',
  'FECHA DESEMBOLSO': 'fecha_desembolso',
  'FECHA 1RA CUOTA': 'fecha_primera_cuota',
  'FECHA PRIMERA CUOTA': 'fecha_primera_cuota',
  'FRE': 'frecuencia',
  'FRECUENCIA': 'frecuencia',
  'CUOTA': 'cuota_valor',
  'NUMERO CUOTAS': 'numero_cuotas',
  'NUM CUOTAS': 'numero_cuotas',
  'TASA': 'tasa',
  'SALDO': 'saldo',
  'VR INICIAL': 'valor_inicial',
  'VALOR INICIAL': 'valor_inicial',
};

function parseXlsx(buffer: Buffer): ParsedCredit[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) return [];

  // Map actual headers to canonical field names
  const actualHeaders = Object.keys(rows[0]);
  const fieldMap: Record<string, string> = {};
  for (const h of actualHeaders) {
    const norm = normalizeHeader(h);
    if (HEADER_MAP[norm]) {
      fieldMap[h] = HEADER_MAP[norm];
    }
  }

  const credits: ParsedCredit[] = [];

  for (const row of rows) {
    const get = (field: string): unknown => {
      for (const [actualH, mappedField] of Object.entries(fieldMap)) {
        if (mappedField === field) return row[actualH];
      }
      return undefined;
    };

    const credit_id = String(get('credit_id') || '').trim();
    const cedula = String(get('cedula') || '').replace(/\./g, '').trim();
    if (!credit_id || !cedula) continue;

    const name = String(get('name') || '').trim();
    const fecha_desembolso = normalizeDate(get('fecha_desembolso'));
    const fecha_primera_cuota = normalizeDate(get('fecha_primera_cuota'));

    const freRaw = String(get('frecuencia') || 'M').toUpperCase().trim();
    const frecuencia = freRaw === 'Q' ? 'Q' : 'M';

    const cuota_valor = normalizeNumber(get('cuota_valor'));
    const numero_cuotas = normalizeNumber(get('numero_cuotas'));
    const saldo = normalizeNumber(get('saldo'));
    const valor_inicial = normalizeNumber(get('valor_inicial'));

    // Tasa: keep as float (e.g. 1.2)
    const tasaRaw = get('tasa');
    let tasa = 0;
    if (typeof tasaRaw === 'number') {
      tasa = tasaRaw;
    } else if (typeof tasaRaw === 'string') {
      tasa = parseFloat(tasaRaw.replace(/\./g, '').replace(',', '.')) || 0;
    }

    credits.push({
      credit_id, cedula, name,
      fecha_desembolso, fecha_primera_cuota,
      frecuencia, cuota_valor, numero_cuotas, tasa, saldo, valor_inicial,
    });
  }

  return credits;
}

/* ------------------------------------------------------------------ */
/*  PDF parser (fallback)                                              */
/* ------------------------------------------------------------------ */

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: { str: string; x: number; y: number }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const tx = item.transform;
      items.push({ str: item.str, x: tx[4], y: tx[5] });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lineGroups: { y: number; items: { str: string; x: number }[] }[] = [];
    for (const item of items) {
      const existing = lineGroups.find(g => Math.abs(g.y - item.y) <= 5);
      if (existing) {
        existing.items.push({ str: item.str, x: item.x });
      } else {
        lineGroups.push({ y: item.y, items: [{ str: item.str, x: item.x }] });
      }
    }

    lineGroups.sort((a, b) => b.y - a.y);
    const lines = lineGroups.map(g => {
      g.items.sort((a, b) => a.x - b.x);
      return g.items.map(it => it.str).join(' ');
    });

    pages.push(lines.join('\n'));
  }
  return pages.join('\n');
}

function parseCreditRowsFromText(text: string): ParsedCredit[] {
  const credits: ParsedCredit[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    if (/REPORTE DE CREDITOS|FONALMERQUE|PAGINA|CREDITO\s+CCN|TOTAL|^\s*$/i.test(line)) continue;
    if (/^FONDO NACIONAL/i.test(line)) continue;
    if (!/^\d{1,6}\s/.test(line)) continue;

    const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}/g;
    const dates: { match: string; index: number }[] = [];
    let dm;
    while ((dm = datePattern.exec(line)) !== null) {
      dates.push({ match: dm[0], index: dm.index });
    }
    if (dates.length < 2) continue;

    const beforeDates = line.substring(0, dates[0].index).trim();
    const prefixNums = beforeDates.match(/\d+/g);
    if (!prefixNums || prefixNums.length < 3) continue;

    const credit_id = prefixNums[0];
    const cedula = prefixNums[2];
    const cedulaIdx = beforeDates.indexOf(cedula);
    const name = beforeDates.substring(cedulaIdx + cedula.length).replace(/\s+/g, ' ').trim();

    const fecha_desembolso = parseDateStr(dates[0].match);
    const fecha_primera_cuota = parseDateStr(dates[1].match);

    const afterDates = line.substring(dates[1].index + dates[1].match.length).trim();
    const freMatch = afterDates.match(/^([MQ])\s/i);
    const frecuencia = freMatch ? freMatch[1].toUpperCase() : 'M';

    const afterFre = freMatch ? afterDates.substring(freMatch[0].length) : afterDates;
    const numTokens = afterFre.match(/[\d.]+,\d+|\d+/g) || [];

    const commaTokens: { raw: string; idx: number }[] = [];
    const intTokens: { val: number; idx: number }[] = [];
    numTokens.forEach((t, i) => {
      if (t.includes(',')) commaTokens.push({ raw: t, idx: i });
      else intTokens.push({ val: parseInt(t, 10), idx: i });
    });

    let cuota_valor = 0, numero_cuotas = 0, tasa = 0, saldo = 0, valor_inicial = 0;

    if (commaTokens.length >= 4) {
      cuota_valor = parseColNumber(commaTokens[0].raw);
      tasa = parseFloat(commaTokens[1].raw.replace(/\./g, '').replace(',', '.')) || 0;
      const lastTwo = [parseColNumber(commaTokens[2].raw), parseColNumber(commaTokens[3].raw)];
      valor_inicial = Math.max(...lastTwo);
      saldo = Math.min(...lastTwo);
    } else if (commaTokens.length === 3) {
      cuota_valor = parseColNumber(commaTokens[0].raw);
      tasa = parseFloat(commaTokens[1].raw.replace(/\./g, '').replace(',', '.')) || 0;
      // Only got one big value — it's saldo; valor_inicial is missing
      saldo = parseColNumber(commaTokens[2].raw);
      valor_inicial = saldo; // best guess
    } else if (commaTokens.length >= 2) {
      cuota_valor = parseColNumber(commaTokens[0].raw);
      tasa = parseFloat(commaTokens[1].raw.replace(/\./g, '').replace(',', '.')) || 0;
    }

    for (const it of intTokens) {
      if (commaTokens.length >= 2 && it.idx > commaTokens[0].idx && it.idx < commaTokens[1].idx) {
        numero_cuotas = it.val;
        break;
      }
    }
    if (numero_cuotas === 0) {
      const candidates = intTokens.filter(it => it.val > 1 && it.val <= 360);
      if (candidates.length > 0) numero_cuotas = candidates[0].val;
    }

    if (!credit_id || !cedula) continue;

    credits.push({
      credit_id, cedula, name,
      fecha_desembolso, fecha_primera_cuota,
      frecuencia, cuota_valor, numero_cuotas, tasa, saldo, valor_inicial,
    });
  }

  return credits;
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isPdf = fileName.endsWith('.pdf');

    if (!isXlsx && !isPdf) {
      return NextResponse.json({ error: 'El archivo debe ser PDF o Excel (.xlsx/.xls)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsedCredits: ParsedCredit[];

    if (isXlsx) {
      parsedCredits = parseXlsx(buffer);
    } else {
      const text = await extractTextFromPdf(buffer);
      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: 'No se pudo extraer texto del PDF' }, { status: 400 });
      }
      parsedCredits = parseCreditRowsFromText(text);
    }

    if (parsedCredits.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron créditos en el archivo. Verifica que el formato y los nombres de columnas sean correctos.',
      }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const carteraCol = db.collection('fondo_cartera');

    let created = 0;
    let updated = 0;
    let notFound = 0;
    const notFoundCedulas: string[] = [];
    const processed: { credit_id: string; cedula: string; name: string; action: string; valor_prestamo: number; saldo: number }[] = [];

    for (const cr of parsedCredits) {
      const user = await usersCol.findOne({ cedula: cr.cedula });
      if (!user) {
        notFound++;
        if (!notFoundCedulas.includes(cr.cedula)) notFoundCedulas.push(cr.cedula);
        continue;
      }

      const userId = user._id.toString();
      const frecuenciaPago = cr.frecuencia === 'Q' ? 'quincenal' : 'mensual';
      const daysPerCuota = frecuenciaPago === 'quincenal' ? 15 : 30;

      const fechaTermina = cr.fecha_primera_cuota ? new Date(cr.fecha_primera_cuota) : new Date();
      fechaTermina.setDate(fechaTermina.getDate() + daysPerCuota * cr.numero_cuotas);

      // Estimate cuotas_pagadas from fecha_primera_cuota to today
      let cuotasPagadas = 0;
      if (cr.fecha_primera_cuota) {
        const now = new Date();
        const diffMs = now.getTime() - cr.fecha_primera_cuota.getTime();
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        cuotasPagadas = Math.min(cr.numero_cuotas, Math.floor(diffDays / daysPerCuota));
      }
      const cuotasRestantes = Math.max(0, cr.numero_cuotas - cuotasPagadas);

      // valor_prestamo = VR INICIAL; if 0 or missing, use saldo as fallback
      const valorPrestamo = cr.valor_inicial > 0 ? cr.valor_inicial : cr.saldo;

      const existing = await carteraCol.findOne({
        user_id: userId,
        credito_id: cr.credit_id,
      });

      const docFields = {
        tasa_interes: cr.tasa,
        frecuencia_pago: frecuenciaPago,
        fecha_desembolso: cr.fecha_desembolso,
        fecha_cuota_1: cr.fecha_primera_cuota,
        fecha_termina: fechaTermina,
        valor_prestamo: valorPrestamo,
        numero_cuotas: cr.numero_cuotas,
        cuotas_pagadas: cuotasPagadas,
        cuotas_restantes: cuotasRestantes,
        saldo_capital: cr.saldo,
        saldo_total: cr.saldo,
        cuota_valor: cr.cuota_valor,
      };

      if (existing) {
        await carteraCol.updateOne(
          { _id: existing._id },
          { $set: { ...docFields, updated_at: new Date() } }
        );
        updated++;
      } else {
        await carteraCol.insertOne({
          user_id: userId,
          credito_id: cr.credit_id,
          ...docFields,
          fecha_solicitud: new Date(),
          saldo_interes: 0,
          estado: 'activo',
          motivo_solicitud: null,
          motivo_respuesta: null,
          pagos: [],
          created_by: session.user.id,
          created_at: new Date(),
        });
        created++;
      }
      processed.push({
        credit_id: cr.credit_id, cedula: cr.cedula, name: cr.name,
        action: existing ? 'actualizado' : 'creado',
        valor_prestamo: valorPrestamo, saldo: cr.saldo,
      });
    }

    return NextResponse.json({
      success: true,
      total_en_archivo: parsedCredits.length,
      creados: created,
      actualizados: updated,
      no_encontrados: notFound,
      cedulas_no_encontradas: notFoundCedulas,
      detalle: processed,
    });
  } catch (err) {
    console.error('Bulk credit upload error:', err);
    return NextResponse.json(
      { error: 'Error procesando el archivo: ' + (err instanceof Error ? err.message : 'desconocido') },
      { status: 500 }
    );
  }
}
