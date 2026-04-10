import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// Parse Colombian number format: "1.234.567,89" or "1234567.89" or plain "1234567"
function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim().replace(/[^\d,.-]/g, '');
  if (!s) return 0;

  // If both . and , present, the last one is the decimal separator
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  let normalized: string;
  if (lastComma > lastDot) {
    // Comma is decimal separator (e.g. "1.234.567,89")
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (e.g. "1,234,567.89")
    normalized = s.replace(/,/g, '');
  } else {
    // Only one or none — assume it's a thousands separator if no decimals
    normalized = s.replace(/[,.]/g, '');
  }

  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// Parse a CSV line respecting quoted fields, semicolon separator
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
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
      return NextResponse.json({ error: 'Archivo CSV requerido' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV vacío o sin datos' }, { status: 400 });
    }

    // Parse header to find column indices
    const headers = parseCsvLine(lines[0]).map((h) => h.toUpperCase().trim());
    const cedulaIdx = headers.findIndex((h) => h === 'CEDULA' || h === 'CÉDULA');
    const acumuladoIdx = headers.findIndex((h) => h === 'ACUMULADO');
    const nombreIdx = headers.findIndex((h) => h === 'NOMBRE');

    if (cedulaIdx === -1) {
      return NextResponse.json({ error: 'Columna CEDULA no encontrada' }, { status: 400 });
    }
    if (acumuladoIdx === -1) {
      return NextResponse.json({ error: 'Columna ACUMULADO no encontrada' }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const membersCol = db.collection('fondo_members');

    let actualizados = 0;
    let creados = 0;
    let noEncontrados = 0;
    const erroresList: { cedula: string; razon: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const cedulaRaw = cols[cedulaIdx];
      if (!cedulaRaw) continue;

      // Strip non-digits from cedula for matching
      const cedula = cedulaRaw.replace(/\D/g, '');
      if (!cedula) continue;

      const acumulado = parseAmount(cols[acumuladoIdx]);
      const nombre = nombreIdx !== -1 ? cols[nombreIdx] : '';

      // Find user by cedula
      const user = await usersCol.findOne({ cedula });
      if (!user) {
        noEncontrados++;
        erroresList.push({ cedula, razon: `Usuario no encontrado${nombre ? ` (${nombre})` : ''}` });
        continue;
      }

      const userId = user._id.toString();
      const permanente = Math.round(acumulado * 0.9 * 100) / 100;
      const social = Math.round(acumulado * 0.1 * 100) / 100;

      // Upsert fondo membership
      const existing = await membersCol.findOne({ user_id: userId });

      if (existing) {
        await membersCol.updateOne(
          { user_id: userId },
          {
            $set: {
              saldo_permanente: permanente,
              saldo_social: social,
              updated_at: new Date(),
            },
          }
        );
        actualizados++;
      } else {
        await membersCol.insertOne({
          user_id: userId,
          fecha_afiliacion: new Date(),
          activo: true,
          frecuencia: 'mensual',
          monto_aporte: 0,
          saldo_permanente: permanente,
          saldo_social: social,
          saldo_actividad: 0,
          saldo_intereses: 0,
          created_at: new Date(),
        });
        creados++;
      }
    }

    return NextResponse.json({
      success: true,
      total_procesados: lines.length - 1,
      actualizados,
      creados,
      no_encontrados: noEncontrados,
      errores: erroresList.slice(0, 50), // limit to first 50
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    return NextResponse.json({ error: 'Error procesando CSV' }, { status: 500 });
  }
}
