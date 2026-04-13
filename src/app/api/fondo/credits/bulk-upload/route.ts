import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

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
      items.push({ str: item.str, x: tx[4], y: Math.round(tx[5]) });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: string[] = [];
    let currentY = items.length > 0 ? items[0].y : 0;
    let currentLine: string[] = [];

    for (const item of items) {
      if (Math.abs(item.y - currentY) > 2) {
        lines.push(currentLine.join(' '));
        currentLine = [];
        currentY = item.y;
      }
      currentLine.push(item.str);
    }
    if (currentLine.length > 0) lines.push(currentLine.join(' '));

    pages.push(lines.join('\n'));
  }
  return pages.join('\n');
}

// Normalize Colombian number format: "103.813,00" → 103813
function parseColNumber(raw: string): number {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

// Parse date DD/MM/YYYY
function parseDate(raw: string): Date | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

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

function parseCreditRows(text: string): ParsedCredit[] {
  const credits: ParsedCredit[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip headers, footers, and non-data lines
    if (/REPORTE DE CREDITOS|FONALMERQUE|PAGINA|CREDITO\s+CCN|TOTAL|^\s*$/i.test(line)) continue;
    if (/^FONDO NACIONAL/i.test(line)) continue;
    if (!/^\d{1,6}\s/.test(line)) continue;

    // Strategy: find credit_id, CCN, cedula as first three numbers,
    // then name until first date, then parse remaining fields

    // Extract all dates first
    const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}/g;
    const dates: { match: string; index: number }[] = [];
    let dm;
    while ((dm = datePattern.exec(line)) !== null) {
      dates.push({ match: dm[0], index: dm.index });
    }

    if (dates.length < 2) continue; // Need at least desembolso + primera cuota dates

    // Everything before the first date: credit_id, CCN, cedula, name
    const beforeDates = line.substring(0, dates[0].index).trim();

    // Extract first three numbers from the prefix
    const prefixNums = beforeDates.match(/\d+/g);
    if (!prefixNums || prefixNums.length < 3) continue;

    const credit_id = prefixNums[0];
    // prefixNums[1] = CCN (ignore)
    const cedula = prefixNums[2];

    // Name: text between the cedula and the first date
    const cedulaIdx = beforeDates.indexOf(cedula);
    const nameStart = cedulaIdx + cedula.length;
    const name = beforeDates.substring(nameStart).replace(/\s+/g, ' ').trim();

    const fecha_desembolso = parseDate(dates[0].match);
    const fecha_primera_cuota = parseDate(dates[1].match);

    // Everything after the second date
    const afterDates = line.substring(dates[1].index + dates[1].match.length).trim();

    // Parse remaining fields after dates: FRE [CUOTA_NUM] CUOTA_VALOR NUMERO_CUOTAS TASA SALDO VR_INICIAL
    const freMatch = afterDates.match(/^([MQ])\s/i);
    const frecuencia = freMatch ? freMatch[1].toUpperCase() : 'M';

    const afterFre = freMatch ? afterDates.substring(freMatch[0].length) : afterDates;
    // Split into tokens preserving Colombian number format
    const numTokens = afterFre.match(/[\d.]+,\d+|\d+/g) || [];

    // Separate: tokens with commas are monetary/rate values, pure integers are counts
    // Expected sequence: [optional_small_int] cuota_valor(comma) numero_cuotas(int) tasa(comma) saldo(comma) valor_inicial(comma)
    const commaTokens: { raw: string; idx: number }[] = [];
    const intTokens: { val: number; idx: number }[] = [];
    numTokens.forEach((t, i) => {
      if (t.includes(',')) {
        commaTokens.push({ raw: t, idx: i });
      } else {
        intTokens.push({ val: parseInt(t, 10), idx: i });
      }
    });

    let cuota_valor = 0, numero_cuotas = 0, tasa = 0, saldo = 0, valor_inicial = 0;

    // comma tokens in order: cuota_valor, tasa, saldo, valor_inicial
    if (commaTokens.length >= 4) {
      cuota_valor = parseColNumber(commaTokens[0].raw);
      tasa = parseFloat(commaTokens[1].raw.replace(/\./g, '').replace(',', '.')) || 0;
      saldo = parseColNumber(commaTokens[2].raw);
      valor_inicial = parseColNumber(commaTokens[3].raw);
    } else if (commaTokens.length >= 2) {
      cuota_valor = parseColNumber(commaTokens[0].raw);
      tasa = parseFloat(commaTokens[1].raw.replace(/\./g, '').replace(',', '.')) || 0;
      if (commaTokens.length >= 3) saldo = parseColNumber(commaTokens[2].raw);
      if (commaTokens.length >= 4) valor_inicial = parseColNumber(commaTokens[3].raw);
    }

    // numero_cuotas: the integer that appears between cuota_valor and tasa positions
    for (const it of intTokens) {
      if (commaTokens.length >= 2 && it.idx > commaTokens[0].idx && it.idx < commaTokens[1].idx) {
        numero_cuotas = it.val;
        break;
      }
    }
    // Fallback: if not found between those positions, take the largest small integer
    if (numero_cuotas === 0) {
      const candidates = intTokens.filter(it => it.val > 1 && it.val <= 360);
      if (candidates.length > 0) numero_cuotas = candidates[0].val;
    }

    if (!credit_id || !cedula) continue;

    credits.push({
      credit_id,
      cedula,
      name,
      fecha_desembolso,
      fecha_primera_cuota,
      frecuencia,
      cuota_valor,
      numero_cuotas,
      tasa,
      saldo,
      valor_inicial,
    });
  }

  return credits;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdf(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No se pudo extraer texto del PDF' }, { status: 400 });
    }

    const parsedCredits = parseCreditRows(text);

    if (parsedCredits.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron créditos en el PDF. Verifica que el formato sea correcto.',
        _debug_raw_preview: text.substring(0, 2000),
      }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const carteraCol = db.collection('fondo_cartera');

    let created = 0;
    let updated = 0;
    let notFound = 0;
    const notFoundCedulas: string[] = [];
    const processed: { credit_id: string; cedula: string; name: string; action: string }[] = [];

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

      // Check if credit_id already exists for this user
      const existing = await carteraCol.findOne({
        user_id: userId,
        credito_id: cr.credit_id,
      });

      if (existing) {
        // Update existing credit
        await carteraCol.updateOne(
          { _id: existing._id },
          {
            $set: {
              tasa_interes: cr.tasa,
              frecuencia_pago: frecuenciaPago,
              fecha_desembolso: cr.fecha_desembolso,
              fecha_cuota_1: cr.fecha_primera_cuota,
              fecha_termina: fechaTermina,
              valor_prestamo: cr.valor_inicial,
              numero_cuotas: cr.numero_cuotas,
              saldo_capital: cr.saldo,
              saldo_total: cr.saldo,
              cuota_valor: cr.cuota_valor,
              updated_at: new Date(),
            },
          }
        );
        updated++;
        processed.push({ credit_id: cr.credit_id, cedula: cr.cedula, name: cr.name, action: 'actualizado' });
      } else {
        // Create new credit
        await carteraCol.insertOne({
          user_id: userId,
          credito_id: cr.credit_id,
          tasa_interes: cr.tasa,
          frecuencia_pago: frecuenciaPago,
          fecha_solicitud: new Date(),
          fecha_desembolso: cr.fecha_desembolso,
          fecha_cuota_1: cr.fecha_primera_cuota,
          fecha_termina: fechaTermina,
          valor_prestamo: cr.valor_inicial,
          numero_cuotas: cr.numero_cuotas,
          cuotas_pagadas: 0,
          cuotas_restantes: cr.numero_cuotas,
          saldo_capital: cr.saldo,
          saldo_interes: 0,
          saldo_total: cr.saldo,
          cuota_valor: cr.cuota_valor,
          estado: 'activo',
          motivo_solicitud: null,
          motivo_respuesta: null,
          pagos: [],
          created_by: session.user.id,
          created_at: new Date(),
        });
        created++;
        processed.push({ credit_id: cr.credit_id, cedula: cr.cedula, name: cr.name, action: 'creado' });
      }
    }

    return NextResponse.json({
      success: true,
      total_en_pdf: parsedCredits.length,
      creados: created,
      actualizados: updated,
      no_encontrados: notFound,
      cedulas_no_encontradas: notFoundCedulas,
      detalle: processed,
    });
  } catch (err) {
    console.error('Bulk credit upload error:', err);
    return NextResponse.json(
      { error: 'Error procesando el PDF: ' + (err instanceof Error ? err.message : 'desconocido') },
      { status: 500 }
    );
  }
}
