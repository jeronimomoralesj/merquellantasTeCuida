/**
 * One-off: wipes fondo_aportes, fondo_actividad, fondo_cartera and resets
 * saldo_* fields on all fondo_members to 0. Use before re-running the CSV
 * "Cargar Saldos" upload so the member balances match ACUMULADO exactly.
 *
 * KEEPS: fondo_ciclos (cycle history), fondo_retiros, fondo_members rows
 *        themselves (fecha_afiliacion, activo, frecuencia, monto_aporte),
 *        users.cicloActual (PDF payroll snapshots).
 *
 * Usage:
 *   npx tsx scripts/wipe-fondo-data.ts --confirm
 *
 * Without --confirm it prints counts and exits.
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

async function main() {
  const confirm = process.argv.includes('--confirm');
  const client = await new MongoClient(MONGODB_URI).connect();
  const db = client.db(DB_NAME);

  const [aportes, actividad, cartera, members, ciclos, retiros] = await Promise.all([
    db.collection('fondo_aportes').countDocuments(),
    db.collection('fondo_actividad').countDocuments(),
    db.collection('fondo_cartera').countDocuments(),
    db.collection('fondo_members').countDocuments(),
    db.collection('fondo_ciclos').countDocuments(),
    db.collection('fondo_retiros').countDocuments(),
  ]);

  console.log('Current counts:');
  console.log(`  fondo_aportes:    ${aportes}   (will DELETE)`);
  console.log(`  fondo_actividad:  ${actividad}  (will DELETE)`);
  console.log(`  fondo_cartera:    ${cartera}   (will DELETE)`);
  console.log(`  fondo_members:    ${members}   (keep rows, ZERO saldos)`);
  console.log(`  fondo_ciclos:     ${ciclos}    (keep)`);
  console.log(`  fondo_retiros:    ${retiros}   (keep)`);

  if (!confirm) {
    console.log('\nDry run. Pass --confirm to actually wipe.');
    await client.close();
    return;
  }

  console.log('\nWiping...');
  const r1 = await db.collection('fondo_aportes').deleteMany({});
  const r2 = await db.collection('fondo_actividad').deleteMany({});
  const r3 = await db.collection('fondo_cartera').deleteMany({});
  const r4 = await db.collection('fondo_members').updateMany(
    {},
    {
      $set: {
        saldo_permanente: 0,
        saldo_social: 0,
        saldo_actividad: 0,
        saldo_intereses: 0,
      },
    }
  );

  console.log(`  deleted aportes:   ${r1.deletedCount}`);
  console.log(`  deleted actividad: ${r2.deletedCount}`);
  console.log(`  deleted cartera:   ${r3.deletedCount}`);
  console.log(`  zeroed members:    ${r4.modifiedCount}`);
  console.log('\nDone. Re-upload /Users/jeronimo/Downloads/libro_de_socios.CSV via the Cargar CSV tab.');

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
