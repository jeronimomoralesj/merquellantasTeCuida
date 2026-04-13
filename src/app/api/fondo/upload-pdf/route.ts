import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
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

    // Group text items by Y position to reconstruct lines
    const items: { str: string; x: number; y: number }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const tx = item.transform;
      items.push({ str: item.str, x: tx[4], y: Math.round(tx[5]) });
    }

    // Sort by Y descending (top to bottom), then X ascending (left to right)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    // Group into lines by Y coordinate (items within 2px are same line)
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

// Normalize Colombian-format numbers: "1.578.234" → 1578234
function parseNumber(raw: string): number {
  const cleaned = raw.replace(/\./g, '').replace(/,/g, '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

interface ParsedCredit {
  credit_id: string;
  interest: number;
  capital: number;
  total: number;
}

interface ParsedSavings {
  ahorro_permanente: number;
  ahorro_social: number;
  total: number;
}

interface ParsedActivity {
  description: string;
  amount: number;
}

interface ParsedUser {
  cedula: string;
  name: string;
  credits: ParsedCredit[];
  savings: ParsedSavings | null;
  activities: ParsedActivity[];
}

function parseUserBlocks(text: string): ParsedUser[] {
  const users: ParsedUser[] = [];

  // Split into user blocks: each starts with a line containing "ASOCIADO ==>"
  // Pattern: [CEDULA] [FULL NAME] ASOCIADO ==>
  const blockPattern = /(\d[\d.]*)\s+(.+?)\s+ASOCIADO\s*==>/g;
  const matches: { index: number; cedula: string; name: string }[] = [];

  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      cedula: match[1].replace(/\./g, ''),
      name: match[2].trim(),
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const blockText = text.substring(start, end);

    // Find content between "ASOCIADO ==>" and "Subtotal Asociado"
    const asociadoIdx = blockText.indexOf('ASOCIADO ==>');
    const subtotalIdx = blockText.indexOf('Subtotal Asociado');
    if (asociadoIdx === -1) continue;

    const contentStart = asociadoIdx + 'ASOCIADO ==>'.length;
    const contentEnd = subtotalIdx !== -1 ? subtotalIdx : blockText.length;
    const content = blockText.substring(contentStart, contentEnd);

    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const credits: ParsedCredit[] = [];
    let savings: ParsedSavings | null = null;
    const activities: ParsedActivity[] = [];

    for (const line of lines) {
      if (line.includes('ABONO A CREDTO') || line.includes('ABONO A CREDITO')) {
        // Credit payment line
        // Pattern: [credit_id] ABONO A CREDTO [values...]
        const creditMatch = line.match(/^(\d+)\s+ABONO A CRED(?:TO|ITO)\s+(.+)$/i);
        if (creditMatch) {
          const creditId = creditMatch[1];
          const valuesStr = creditMatch[2];
          const numbers = valuesStr.match(/[\d.]+(?:,\d+)?/g) || [];
          const nums = numbers.map(parseNumber).filter(n => n > 0);

          if (nums.length >= 3) {
            credits.push({
              credit_id: creditId,
              interest: nums[0],
              capital: nums[1],
              total: nums[nums.length - 1],
            });
          } else if (nums.length === 2) {
            credits.push({
              credit_id: creditId,
              interest: nums[0],
              capital: nums[1],
              total: nums[0] + nums[1],
            });
          } else if (nums.length === 1) {
            credits.push({
              credit_id: creditId,
              interest: 0,
              capital: nums[0],
              total: nums[0],
            });
          }
        }
      } else if (line.includes('AHORROS PERMANENTES')) {
        // Savings line
        const numbers = line.match(/[\d.]+(?:,\d+)?/g) || [];
        const nums = numbers.map(parseNumber).filter(n => n > 0);

        if (nums.length >= 2) {
          const sorted = [...nums].sort((a, b) => a - b);
          const smaller = sorted[0];
          const larger = sorted[sorted.length - 1];
          savings = {
            ahorro_social: smaller,
            ahorro_permanente: larger,
            total: smaller + larger,
          };
        } else if (nums.length === 1) {
          const total = nums[0];
          savings = {
            ahorro_permanente: Math.round(total * 0.9),
            ahorro_social: Math.round(total * 0.1),
            total,
          };
        }
      } else {
        // Activity line — anything else with a numeric value
        const numbers = line.match(/[\d.]+(?:,\d+)?/g) || [];
        const nums = numbers.map(parseNumber).filter(n => n > 0);
        if (nums.length > 0) {
          // Extract description: remove numbers and clean up
          const description = line
            .replace(/[\d.]+(?:,\d+)?/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (description.length > 0) {
            activities.push({
              description,
              amount: nums[nums.length - 1],
            });
          }
        }
      }
    }

    users.push({
      cedula: matches[i].cedula,
      name: matches[i].name,
      credits,
      savings,
      activities,
    });
  }

  return users;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
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
    const debug = formData.get('debug') === '1';
    const text = await extractTextFromPdf(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No se pudo extraer texto del PDF' }, { status: 400 });
    }

    // Debug mode: return raw text for analysis
    if (debug) {
      return NextResponse.json({
        raw_text_length: text.length,
        raw_text_preview: text.substring(0, 5000),
        raw_text_sample_middle: text.substring(Math.floor(text.length / 2), Math.floor(text.length / 2) + 3000),
      });
    }

    const parsedUsers = parseUserBlocks(text);

    if (parsedUsers.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron bloques de usuario en el PDF. Verifica que el formato contenga "ASOCIADO ==>" y "Subtotal Asociado".',
      }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    let updated = 0;
    let notFound = 0;
    const notFoundCedulas: string[] = [];
    const updatedUsers: { cedula: string; name: string; credits: number; savings: boolean; activities: number }[] = [];

    for (const parsed of parsedUsers) {
      const dbUser = await usersCollection.findOne({ cedula: parsed.cedula });
      if (!dbUser) {
        notFound++;
        notFoundCedulas.push(parsed.cedula);
        continue;
      }

      await usersCollection.updateOne(
        { cedula: parsed.cedula },
        {
          $set: {
            cicloActual: {
              credits: parsed.credits,
              savings: parsed.savings,
              activities: parsed.activities,
              uploaded_at: new Date(),
              uploaded_by: session.user.id,
            },
          },
        }
      );
      updated++;
      updatedUsers.push({
        cedula: parsed.cedula,
        name: parsed.name,
        credits: parsed.credits.length,
        savings: parsed.savings !== null,
        activities: parsed.activities.length,
      });
    }

    return NextResponse.json({
      success: true,
      total_en_pdf: parsedUsers.length,
      actualizados: updated,
      no_encontrados: notFound,
      cedulas_no_encontradas: notFoundCedulas,
      detalle: updatedUsers,
      _debug_raw_text_preview: text.substring(0, 3000),
      _debug_parsed_sample: parsedUsers.slice(0, 3),
    });
  } catch (err) {
    console.error('PDF upload error:', err);
    return NextResponse.json(
      { error: 'Error procesando el PDF: ' + (err instanceof Error ? err.message : 'desconocido') },
      { status: 500 }
    );
  }
}
