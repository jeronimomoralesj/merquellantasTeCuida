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

// Parse a CSV line respecting quoted fields, with configurable separator
function parseCsvLine(line: string, sep: string): string[] {
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
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((s) => s.replace(/^"(.*)"$/, '$1').trim());
}

// Auto-detect the most likely CSV separator from the first line
function detectSeparator(line: string): string {
  const counts: Record<string, number> = {
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
    '|': (line.match(/\|/g) || []).length,
  };
  let best = ';';
  let max = 0;
  for (const [sep, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = sep;
    }
  }
  return best;
}

// Normalize a header: strip BOM, accents, quotes, lowercase, trim
function normalizeHeader(s: string): string {
  return s
    .replace(/^\ufeff/, '') // strip UTF-8 BOM
    .replace(/^"(.*)"$/, '$1') // strip surrounding quotes
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toUpperCase()
    .trim();
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

    let text = await file.text();
    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV vacío o sin datos' }, { status: 400 });
    }

    // Auto-detect separator
    const separator = detectSeparator(lines[0]);

    // Parse header to find column indices
    const rawHeaders = parseCsvLine(lines[0], separator);
    const headers = rawHeaders.map(normalizeHeader);

    const cedulaIdx = headers.findIndex(
      (h) => h === 'CEDULA' || h === 'CC' || h === 'DOCUMENTO' || h === 'IDENTIFICACION'
    );
    const acumuladoIdx = headers.findIndex(
      (h) => h === 'ACUMULADO' || h === 'TOTAL' || h === 'SALDO'
    );
    const nombreIdx = headers.findIndex((h) => h === 'NOMBRE' || h === 'NOMBRES');
    const direccionIdx = headers.findIndex((h) => h === 'DIRECCION');
    const ciudadIdx = headers.findIndex((h) => h === 'CIUDAD');
    const departamentoUbicIdx = headers.findIndex((h) => h === 'DEPARTAMENTO');
    const barrioIdx = headers.findIndex((h) => h === 'BARRIO');
    const telefonoIdx = headers.findIndex((h) => h === 'TELEFONO');
    const movilIdx = headers.findIndex((h) => h === 'MOVIL' || h === 'CELULAR');
    const fechaAfilIdx = headers.findIndex((h) => h === 'FECHA AFILIACION' || h === 'FECHA AFIL');
    const centroCostoIdx = headers.findIndex((h) => h === 'CENTRO DE COSTO' || h === 'CENTRO COSTO');
    const divisionIdx = headers.findIndex((h) => h === 'DIVISION');
    const pagaduriaIdx = headers.findIndex((h) => h === 'PAGADURIA');

    if (cedulaIdx === -1) {
      return NextResponse.json(
        {
          error: `Columna CEDULA no encontrada. Encabezados detectados: ${headers.join(', ')}. Separador detectado: "${separator === '\t' ? 'TAB' : separator}"`,
        },
        { status: 400 }
      );
    }
    if (acumuladoIdx === -1) {
      return NextResponse.json(
        {
          error: `Columna ACUMULADO no encontrada. Encabezados detectados: ${headers.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const membersCol = db.collection('fondo_members');

    let actualizados = 0;
    let creados = 0;
    let noEncontrados = 0;
    const erroresList: { cedula: string; razon: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i], separator);
      const cedulaRaw = cols[cedulaIdx];
      if (!cedulaRaw) continue;

      // Strip non-digits from cedula for matching
      const cedula = cedulaRaw.replace(/\D/g, '');
      if (!cedula) continue;

      const acumulado = parseAmount(cols[acumuladoIdx]);
      const nombre = nombreIdx !== -1 ? cols[nombreIdx] : '';

      // Extract optional user fields from CSV
      const direccion = direccionIdx !== -1 ? cols[direccionIdx]?.trim() : '';
      const ciudad = ciudadIdx !== -1 ? cols[ciudadIdx]?.trim() : '';
      const departamentoUbic = departamentoUbicIdx !== -1 ? cols[departamentoUbicIdx]?.trim() : '';
      const barrio = barrioIdx !== -1 ? cols[barrioIdx]?.trim() : '';
      const telefono = telefonoIdx !== -1 ? cols[telefonoIdx]?.trim() : '';
      const movil = movilIdx !== -1 ? cols[movilIdx]?.trim() : '';
      const centroCosto = centroCostoIdx !== -1 ? cols[centroCostoIdx]?.trim() : '';
      const division = divisionIdx !== -1 ? cols[divisionIdx]?.trim() : '';
      const pagaduria = pagaduriaIdx !== -1 ? cols[pagaduriaIdx]?.trim() : '';

      // Parse fecha_afiliacion
      let fechaAfiliacion: Date | null = null;
      if (fechaAfilIdx !== -1 && cols[fechaAfilIdx]) {
        const datePart = cols[fechaAfilIdx].split(' ')[0]; // strip time
        // Try DD/MM/YYYY first (Colombian format), then ISO
        const ddmmyyyy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          fechaAfiliacion = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
        } else {
          const d = new Date(datePart);
          if (!isNaN(d.getTime())) fechaAfiliacion = d;
        }
      }

      // Find user by cedula
      const user = await usersCol.findOne({ cedula });
      if (!user) {
        noEncontrados++;
        erroresList.push({ cedula, razon: `Usuario no encontrado${nombre ? ` (${nombre})` : ''}` });
        continue;
      }

      // Update user record with address/contact info (only fields that have values)
      const userUpdate: Record<string, unknown> = {};
      if (direccion) userUpdate.direccion = direccion;
      if (ciudad) userUpdate.ciudad = ciudad;
      if (departamentoUbic) userUpdate.departamento_ubicacion = departamentoUbic;
      if (barrio) userUpdate.barrio = barrio;
      if (telefono) userUpdate.telefono = telefono;
      if (movil) userUpdate.movil = movil;
      if (centroCosto) userUpdate.centro_costo = centroCosto;
      if (division) userUpdate.division = division;
      if (pagaduria) userUpdate.pagaduria = pagaduria;

      if (Object.keys(userUpdate).length > 0) {
        await usersCol.updateOne({ _id: user._id }, { $set: userUpdate });
      }

      const userId = user._id.toString();
      const permanente = Math.round(acumulado * 0.9 * 100) / 100;
      const social = Math.round(acumulado * 0.1 * 100) / 100;

      // Upsert fondo membership
      const existing = await membersCol.findOne({ user_id: userId });

      if (existing) {
        const updateDoc: Record<string, unknown> = {
          saldo_permanente: permanente,
          saldo_social: social,
          updated_at: new Date(),
        };
        if (fechaAfiliacion) updateDoc.fecha_afiliacion = fechaAfiliacion;
        await membersCol.updateOne({ user_id: userId }, { $set: updateDoc });
        actualizados++;
      } else {
        await membersCol.insertOne({
          user_id: userId,
          fecha_afiliacion: fechaAfiliacion || new Date(),
          activo: true,
          frecuencia: 'quincenal',
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
