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

  // Real PDF format: ASOCIADO ==> [CEDULA]   [FULL NAME]
  // Cedula comes AFTER "ASOCIADO ==>", name is uppercase letters+spaces on same line
  const blockPattern = /ASOCIADO\s*==>\s*(\d{5,12})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+)/g;
  const matches: { index: number; cedula: string; name: string }[] = [];

  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      cedula: match[1].trim(),
      name: match[2].trim(),
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const blockEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const blockText = text.substring(matches[i].index, blockEnd);

    // Find the line after "ASOCIADO ==>" header up to "Subtotal Asociado"
    const subtotalIdx = blockText.indexOf('Subtotal Asociado');
    const content = subtotalIdx !== -1 ? blockText.substring(0, subtotalIdx) : blockText;

    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const credits: ParsedCredit[] = [];
    let savings: ParsedSavings | null = null;
    const activities: ParsedActivity[] = [];

    for (const line of lines) {
      // Skip the ASOCIADO header line itself
      if (line.includes('ASOCIADO ==>')) continue;

      if (line.includes('ABONO A CREDTO') || line.includes('ABONO A CREDITO')) {
        // Credit line: [credit_id] [line_num] ABONO A CREDTO [values in jumbled column order]
        const creditIdMatch = line.match(/^(\d{3,6})\s/);
        const creditId = creditIdMatch ? creditIdMatch[1] : '0';

        const afterDesc = line.replace(/^.*?ABONO A CRED(?:TO|ITO)\s*/, '');
        const nums = extractNumbers(afterDesc);
        const nonZero = nums.filter(n => n > 0).sort((a, b) => b - a);

        // Find the value that is the sum of two others (that's the total)
        // total = capital + interest, so find a+b=c among the nonzero values
        let capital = 0, interest = 0, total = 0;
        let found = false;
        if (nonZero.length >= 3) {
          for (let a = 0; a < nonZero.length && !found; a++) {
            for (let b = a + 1; b < nonZero.length && !found; b++) {
              for (let c = b + 1; c < nonZero.length && !found; c++) {
                const vals = [nonZero[a], nonZero[b], nonZero[c]];
                vals.sort((x, y) => y - x);
                if (Math.abs(vals[0] - (vals[1] + vals[2])) <= 1) {
                  total = vals[0];
                  capital = vals[1];
                  interest = vals[2];
                  found = true;
                }
              }
            }
          }
        }
        if (!found && nonZero.length >= 2) {
          // Fallback: largest is total, second is capital, rest is interest
          capital = nonZero[1];
          interest = nonZero.length > 2 ? nonZero[2] : 0;
          total = nonZero[0];
        } else if (!found && nonZero.length === 1) {
          capital = nonZero[0]; total = nonZero[0];
        }

        if (total > 0 || capital > 0) {
          credits.push({ credit_id: creditId, capital, interest, total });
        }

      } else if (line.includes('AHORROS PERMANENTES')) {
        // Savings line has columns in jumbled order from pdfjs.
        // We know: ahorro_permanente ≈ 90%, ahorro_social ≈ 10%, total = sum.
        // The total value equals the sum of the other two, so find the pair that sums correctly.
        const afterDesc = line.replace(/^.*?AHORROS PERMANENTES\s*/, '');
        const nums = extractNumbers(afterDesc);
        const nonZero = nums.filter(n => n > 0);

        if (nonZero.length >= 3) {
          // Find the value that is the sum of two others
          const sorted = [...nonZero].sort((a, b) => a - b);
          // Smallest = social, second = permanente, largest = total (= social + permanente)
          savings = {
            ahorro_social: sorted[0],
            ahorro_permanente: sorted[1],
            total: sorted[0] + sorted[1],
          };
        } else if (nonZero.length === 2) {
          const sorted = [...nonZero].sort((a, b) => a - b);
          savings = {
            ahorro_social: sorted[0],
            ahorro_permanente: sorted[1],
            total: sorted[0] + sorted[1],
          };
        } else if (nonZero.length === 1) {
          const total = nonZero[0];
          savings = {
            ahorro_permanente: Math.round(total * 0.9),
            ahorro_social: Math.round(total * 0.1),
            total,
          };
        }

      } else {
        // Activity line — anything else with a description and values
        // Pattern: [id] [line] [desc like ACTIVIDAD MES] [values...]
        // Detect: line has a text description AND numeric values
        const hasDescription = /[A-ZÁÉÍÓÚÑ]{3,}/.test(line);
        if (!hasDescription) continue;

        // Extract the description text
        const descMatch = line.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑA-Za-záéíóúñ\s]+)/);
        const description = descMatch ? descMatch[1].trim() : '';
        if (!description || description.length < 3) continue;
        // Skip header-like lines
        if (/^(CREDITO|LINEA|DESCRIPCION|CAPITAL|MERQUELLANTAS|FONDO NACIONAL|FONALMERQUE|RELACION|PAGINA)/.test(description)) continue;

        const nums = extractNumbers(line);
        const nonZero = nums.filter(n => n > 0);
        if (nonZero.length > 0) {
          // The last non-zero is typically the total
          activities.push({
            description,
            amount: nonZero[nonZero.length - 1],
          });
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

// Extract all numbers from a string, handling Colombian format (dots as thousands)
function extractNumbers(str: string): number[] {
  // Match numbers like 131.521 or 16.724 or 0 or 45.000
  const matches = str.match(/\d[\d.]*(?:,\d+)?/g) || [];
  return matches.map(parseNumber);
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
