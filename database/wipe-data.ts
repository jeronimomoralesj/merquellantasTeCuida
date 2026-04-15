/**
 * Wipe all user-related data so the system can be re-seeded via bulk upload.
 *
 * Preserves:
 *   - documentos                (per requirement)
 *   - fondo_*  collections      (saldos / aportes / cartera / retiros / actividad / ciclos)
 *
 * Before deleting users, the script *snapshots the user's cedula* onto every
 * fondo record that references the user by user_id. The bulk-upload endpoint
 * then re-links those records to the new user's _id by matching on cedula.
 *
 * Usage:
 *   MONGODB_URI=... npx tsx database/wipe-data.ts --confirm WIPE
 *
 * Without `--confirm WIPE` the script does a dry run and exits without writing.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}
const DB_NAME = process.env.MONGODB_DB || 'merque_bienestar';

const args = process.argv.slice(2);
const confirmed =
  args.includes('--confirm') &&
  args[args.indexOf('--confirm') + 1] === 'WIPE';

const COLLECTIONS_TO_WIPE = [
  'users',
  'calendar',
  'solicitudes',
  'cesantias',
  'pqrsf',
  'courses',
  'course_videos',
  'course_quizzes',
  'quiz_questions',
  'quiz_attempts',
  'course_progress',
  'course_completions',
  'course_comments',
  'quick_actions',
  'file_uploads',
  'upload_chunks',
  'uploads.files',
  'uploads.chunks',
];

// Fondo collections that reference users via user_id and need cedula snapshot
const FONDO_COLLECTIONS_TO_LINK = [
  'fondo_members',
  'fondo_aportes',
  'fondo_actividad',
  'fondo_cartera',
  'fondo_retiros',
];

async function main() {
  console.log(`\n=== wipe-data.ts ===`);
  console.log(`DB: ${DB_NAME}`);
  console.log(`Mode: ${confirmed ? 'EXECUTE' : 'DRY-RUN (pass --confirm WIPE to execute)'}\n`);

  const client = await new MongoClient(URI!).connect();
  try {
    const db = client.db(DB_NAME);

    // 1) Snapshot cedula onto fondo records before deleting users
    const usersCol = db.collection('users');
    const userIdToCedula = new Map<string, string>();
    const allUsers = await usersCol.find({}, { projection: { _id: 1, cedula: 1 } }).toArray();
    for (const u of allUsers) {
      if (u.cedula) userIdToCedula.set(u._id.toString(), String(u.cedula));
    }
    console.log(`Found ${allUsers.length} users (${userIdToCedula.size} with cedula).`);

    for (const cName of FONDO_COLLECTIONS_TO_LINK) {
      const col = db.collection(cName);
      const docs = await col.find({}, { projection: { _id: 1, user_id: 1, cedula_snapshot: 1 } }).toArray();
      let toUpdate = 0;
      for (const d of docs) {
        if (d.cedula_snapshot) continue;
        const ced = userIdToCedula.get(String(d.user_id));
        if (!ced) continue;
        toUpdate++;
        if (confirmed) {
          await col.updateOne({ _id: d._id }, { $set: { cedula_snapshot: ced } });
        }
      }
      console.log(
        `  ${cName}: ${docs.length} docs, ${toUpdate} need cedula_snapshot ${confirmed ? '(written)' : '(dry-run)'}`
      );
    }

    // 2) Wipe collections
    console.log('\nDeleting collections:');
    for (const cName of COLLECTIONS_TO_WIPE) {
      const col = db.collection(cName);
      const count = await col.countDocuments();
      if (count === 0) {
        console.log(`  ${cName}: 0 docs (skip)`);
        continue;
      }
      if (confirmed) {
        const r = await col.deleteMany({});
        console.log(`  ${cName}: ${count} → deleted ${r.deletedCount}`);
      } else {
        console.log(`  ${cName}: ${count} docs (would delete)`);
      }
    }

    // 3) Report preserved collections
    const preserved = ['documentos', ...FONDO_COLLECTIONS_TO_LINK, 'fondo_ciclos'];
    console.log('\nPreserved collections:');
    for (const cName of preserved) {
      const c = await db.collection(cName).countDocuments();
      console.log(`  ${cName}: ${c} docs kept`);
    }

    if (!confirmed) {
      console.log('\nDRY RUN — no changes were made. Re-run with --confirm WIPE to execute.\n');
    } else {
      console.log('\nDONE. Use the bulk-upload UI to recreate users; fondo records will re-link by cedula.\n');
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
