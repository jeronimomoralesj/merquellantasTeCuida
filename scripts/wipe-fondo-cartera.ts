/**
 * One-off: deletes every credit in fondo_cartera.
 *
 * Keeps:
 *   - fondo_members      (affiliation + saldos untouched)
 *   - fondo_aportes      (historical aportes stay)
 *   - fondo_actividad    (historical activities stay)
 *   - fondo_ciclos       (historical cycles stay — their `movimientos`
 *                         array still references the deleted credits by
 *                         id, but that's audit history)
 *   - fondo_retiros      (withdrawal requests stay)
 *   - users              (personal data + cicloActual snapshots stay)
 *
 * Usage:
 *   npx tsx scripts/wipe-fondo-cartera.ts           # dry run
 *   npx tsx scripts/wipe-fondo-cartera.ts --confirm  # actually wipe
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

  const cartera = await db.collection('fondo_cartera').countDocuments();
  const byEstado = await db.collection('fondo_cartera').aggregate([
    { $group: { _id: '$estado', count: { $sum: 1 } } },
  ]).toArray();
  const bySource = await db.collection('fondo_cartera').aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } },
  ]).toArray();

  console.log(`fondo_cartera current count: ${cartera}`);
  console.log(`  by estado:  ${JSON.stringify(byEstado.map((r) => ({ [r._id ?? 'null']: r.count })))}`);
  console.log(`  by source:  ${JSON.stringify(bySource.map((r) => ({ [r._id ?? 'null']: r.count })))}`);

  if (!confirm) {
    console.log('\nDry run. Pass --confirm to delete all credits.');
    await client.close();
    return;
  }

  console.log('\nWiping fondo_cartera...');
  const r = await db.collection('fondo_cartera').deleteMany({});
  console.log(`  deleted: ${r.deletedCount}`);
  const after = await db.collection('fondo_cartera').countDocuments();
  console.log(`  remaining: ${after}`);

  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
