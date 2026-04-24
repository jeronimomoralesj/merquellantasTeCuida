/**
 * One-off: imports a Fonalmerque CSV (libro de socios) directly into the
 * database, replaying the same logic as /api/fondo/upload-csv/route.ts.
 * Useful after running scripts/wipe-fondo-data.ts so we can seed balances
 * without going through an authenticated HTTP upload.
 *
 * Usage:
 *   npx tsx scripts/import-fondo-csv.ts <path-to-csv>
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: false });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB || 'merque_bienestar';

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim().replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalized = s.replace(/,/g, '');
  } else {
    normalized = s.replace(/[,.]/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

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
    if (count > max) { max = count; best = sep; }
  }
  return best;
}

function normalizeHeader(s: string): string {
  return s
    .replace(/^\ufeff/, '')
    .replace(/^"(.*)"$/, '$1')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-fondo-csv.ts <path-to-csv>');
    process.exit(1);
  }
  const buffer = fs.readFileSync(csvPath);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const bytes = hasBom ? buffer.subarray(3) : buffer;

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  const mojibakeCount = (text.match(/[√Ãâ¬]/g) || []).length;
  if (mojibakeCount > 5) {
    text = new TextDecoder('windows-1252').decode(bytes);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // The real-world file has two preamble lines before the header row (title
  // line and a date line). Hunt for the line that actually contains CEDULA.
  let headerIdx = -1;
  let separator = ';';
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const sep = detectSeparator(lines[i]);
    const cols = parseCsvLine(lines[i], sep).map(normalizeHeader);
    if (cols.some((c) => c === 'CEDULA' || c === 'CC' || c === 'DOCUMENTO' || c === 'IDENTIFICACION')) {
      headerIdx = i;
      separator = sep;
      break;
    }
  }
  if (headerIdx === -1) {
    console.error('No encontré una fila de encabezados con CEDULA');
    console.error('Primeras 5 líneas:');
    for (let i = 0; i < Math.min(5, lines.length); i++) console.error(`  [${i}] ${lines[i].slice(0, 200)}`);
    process.exit(1);
  }

  const rawHeaders = parseCsvLine(lines[headerIdx], separator);
  const headers = rawHeaders.map(normalizeHeader);
  const idx = (...names: string[]) => headers.findIndex((h) => names.includes(h));

  const cedulaIdx = idx('CEDULA', 'CC', 'DOCUMENTO', 'IDENTIFICACION');
  const acumuladoIdx = idx('ACUMULADO', 'TOTAL', 'SALDO');
  const carteraIdx = idx('CARTERA', 'SALDO CARTERA', 'DEUDA');
  const nombreIdx = idx('NOMBRE', 'NOMBRES');
  const direccionIdx = idx('DIRECCION');
  const ciudadIdx = idx('CIUDAD');
  const departamentoUbicIdx = idx('DEPARTAMENTO');
  const barrioIdx = idx('BARRIO');
  const telefonoIdx = idx('TELEFONO');
  const movilIdx = idx('MOVIL', 'CELULAR');
  const fechaAfilIdx = idx('FECHA AFILIACION', 'FECHA AFIL');
  const centroCostoIdx = idx('CENTRO DE COSTO', 'CENTRO COSTO');
  const divisionIdx = idx('DIVISION');
  const pagaduriaIdx = idx('PAGADURIA');

  if (cedulaIdx === -1 || acumuladoIdx === -1) {
    console.error(`Header row found but missing CEDULA/ACUMULADO. Headers: ${headers.join(', ')}`);
    process.exit(1);
  }

  console.log(`Using separator "${separator === '\t' ? 'TAB' : separator}", header row at line ${headerIdx + 1}`);
  console.log(`Data rows to process: ${lines.length - headerIdx - 1}`);

  const client = await new MongoClient(MONGODB_URI).connect();
  const db = client.db(DB_NAME);
  const usersCol = db.collection('users');
  const membersCol = db.collection('fondo_members');
  const aportesCol = db.collection('fondo_aportes');
  const carteraCol = db.collection('fondo_cartera');

  let actualizados = 0;
  let creados = 0;
  let noEncontrados = 0;
  let creditosCreados = 0;
  const errores: { cedula: string; razon: string }[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], separator);
    const cedulaRaw = cols[cedulaIdx];
    if (!cedulaRaw) continue;
    const cedula = cedulaRaw.replace(/\D/g, '');
    if (!cedula) continue;

    const acumulado = parseAmount(cols[acumuladoIdx]);
    const nombre = nombreIdx !== -1 ? cols[nombreIdx] : '';

    const pick = (i: number) => (i !== -1 ? (cols[i] || '').trim() : '');
    const direccion = pick(direccionIdx);
    const ciudad = pick(ciudadIdx);
    const departamentoUbic = pick(departamentoUbicIdx);
    const barrio = pick(barrioIdx);
    const telefono = pick(telefonoIdx);
    const movil = pick(movilIdx);
    const centroCosto = pick(centroCostoIdx);
    const division = pick(divisionIdx);
    const pagaduria = pick(pagaduriaIdx);

    let fechaAfiliacion: Date | null = null;
    if (fechaAfilIdx !== -1 && cols[fechaAfilIdx]) {
      const raw = cols[fechaAfilIdx].trim();
      const datePart = raw.split(/\s+/)[0];
      const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        let year = parseInt(m[3], 10);
        if (year < 100) year += year < 50 ? 2000 : 1900;
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) fechaAfiliacion = d;
      } else {
        const d = new Date(datePart);
        if (!isNaN(d.getTime())) fechaAfiliacion = d;
      }
    }

    const user = await usersCol.findOne({ cedula });
    if (!user) {
      noEncontrados++;
      errores.push({ cedula, razon: `Usuario no encontrado${nombre ? ` (${nombre})` : ''}` });
      continue;
    }

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

    await aportesCol.deleteMany({ user_id: userId, tipo: 'saldo_inicial' });
    if (acumulado > 0) {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await aportesCol.insertOne({
        user_id: userId,
        periodo: periodoActual,
        monto_total: acumulado,
        monto_permanente: permanente,
        monto_social: social,
        frecuencia: 'historico',
        tipo: 'saldo_inicial',
        fecha_ejecucion: firstOfMonth,
        descripcion: 'Saldo inicial cargado desde CSV',
        created_at: new Date(),
      });
    }

    // Seed a placeholder credit record for users who have outstanding cartera
    // in the CSV. We only know the outstanding TOTAL, not the original loan
    // amount, number of cuotas, or interest breakdown — the fondo user will
    // fill those in later via the Buscar Afiliado → Cartera edit flow. We
    // tag source='csv_import' so subsequent re-imports replace cleanly
    // without touching any manually-created credits.
    const cartera = carteraIdx !== -1 ? parseAmount(cols[carteraIdx]) : 0;
    await carteraCol.deleteMany({ user_id: userId, source: 'csv_import' });
    if (cartera > 0) {
      await carteraCol.insertOne({
        user_id: userId,
        credito_id: `CSV-${cedula}`,
        tasa_interes: 0,
        frecuencia_pago: 'mensual',
        fecha_solicitud: new Date(),
        fecha_desembolso: null,
        fecha_cuota_1: null,
        fecha_termina: null,
        valor_prestamo: cartera,
        numero_cuotas: 1,
        cuotas_pagadas: 0,
        cuotas_restantes: 1,
        saldo_capital: cartera,
        saldo_interes: 0,
        saldo_total: cartera,
        estado: 'activo',
        motivo_solicitud: 'Saldo de cartera cargado desde CSV — editar cuotas e intereses reales',
        motivo_respuesta: null,
        pagos: [],
        source: 'csv_import',
        created_at: new Date(),
      });
      creditosCreados++;
    }
  }

  console.log(`\nDONE. actualizados=${actualizados}  creados=${creados}  no_encontrados=${noEncontrados}  creditos_creados=${creditosCreados}`);
  if (errores.length > 0) {
    console.log(`\nPrimeras ${Math.min(20, errores.length)} cédulas no encontradas:`);
    for (const e of errores.slice(0, 20)) console.log(`  ${e.cedula}  ${e.razon}`);
    if (errores.length > 20) console.log(`  ...y ${errores.length - 20} más`);
  }
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
