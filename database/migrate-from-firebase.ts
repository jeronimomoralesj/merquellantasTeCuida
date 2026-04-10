/**
 * Migration script: Firebase Firestore → MongoDB
 *
 * Usage:
 *   1. Set FIREBASE_ADMIN_KEY env var (your existing service account JSON)
 *   2. Set MONGODB_URI env var
 *   3. Run: npx tsx database/migrate-from-firebase.ts
 *
 * This script:
 *   - Reads all documents from every Firestore collection
 *   - Inserts them into MongoDB collections
 *   - Hashes passwords (last 8 digits of cedula)
 *   - Properly links birthday calendar events to users by name matching
 */

import 'dotenv/config';
import admin from 'firebase-admin';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
const raw = process.env.FIREBASE_ADMIN_KEY;
if (!raw) throw new Error('FIREBASE_ADMIN_KEY not set');
const sa = JSON.parse(raw);
sa.private_key = sa.private_key.replace(/\\n/g, '\n');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const firestore = admin.firestore();

// ---------------------------------------------------------------------------
// MongoDB init
// ---------------------------------------------------------------------------
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI not set');

let mongoClient: MongoClient;
let mongoDB: ReturnType<MongoClient['db']>;

async function initMongo() {
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDB = mongoClient.db(process.env.MONGODB_DB || 'merque_bienestar');
  console.log('Connected to MongoDB');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof admin.firestore.Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const epoch = new Date(1900, 0, 1);
    return new Date(epoch.getTime() + (val - 2) * 86400000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Migrate users — returns a map of firebaseUID → { mongoId, nombre, cedula }
// ---------------------------------------------------------------------------
async function migrateUsers(): Promise<Map<string, { mongoId: string; nombre: string; cedula: string }>> {
  console.log('Migrating users...');
  const snap = await firestore.collection('users').get();
  const userMap = new Map<string, { mongoId: string; nombre: string; cedula: string }>();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const cedula = String(d.cedula || '');
    const email = d.email || `${cedula}@merque.com`;
    const extra = d.extra || {};

    // Password = last 8 digits of cedula, hashed
    const password = cedula.slice(-8);
    const passwordHash = await bcrypt.hash(password, 10);

    const userDoc = {
      _firebaseId: doc.id, // keep for reference
      cedula,
      email,
      nombre: d.nombre || '',
      posicion: d.posicion || null,
      rol: d.rol || 'user',
      passwordHash,
      departamento: extra['Nombre Área Funcional'] || extra['Dpto Donde Labora'] || null,
      eps: extra['EPS'] || null,
      banco: extra['Banco'] || null,
      caja_compensacion: extra['CAJA DE COMPENSACION'] || null,
      fondo_pensiones: extra['FONDO DE PENSIONES'] || null,
      arl: extra['ARL'] || null,
      fondo_cesantias: extra['Fondo Cesantías'] || null,
      cargo_empleado: extra['Cargo Empleado'] || null,
      numero_cuenta: extra['Número Cuenta'] || null,
      tipo_cuenta: extra['Tipo Cuenta'] || null,
      tipo_documento: extra['Tipo de Documento'] || null,
      fecha_ingreso: extra['Fecha Ingreso'] ? String(extra['Fecha Ingreso']) : null,
      fecha_nacimiento: extra['fechaNacimiento'] || d.fechaNacimiento || null,
      mood: d.mood || null,
      mood_updated_at: toDate(d.moodUpdatedAt),
      created_at: toDate(d.createdAt) || new Date(),
    };

    const result = await mongoDB.collection('users').insertOne(userDoc);
    userMap.set(doc.id, {
      mongoId: result.insertedId.toString(),
      nombre: d.nombre || '',
      cedula,
    });
    count++;
  }
  console.log(`  Migrated ${count} users`);
  return userMap;
}

// ---------------------------------------------------------------------------
// Migrate solicitudes
// ---------------------------------------------------------------------------
async function migrateSolicitudes(userMap: Map<string, { mongoId: string; nombre: string; cedula: string }>) {
  console.log('Migrating solicitudes...');
  const snap = await firestore.collection('solicitudes').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const mapped = userMap.get(d.userId || '');

    await mongoDB.collection('solicitudes').insertOne({
      user_id: mapped?.mongoId || d.userId || '',
      nombre: d.nombre || mapped?.nombre || '',
      cedula: d.cedula || mapped?.cedula || '',
      tipo: d.tipo || '',
      estado: d.estado || 'pendiente',
      description: d.description || null,
      motivo_respuesta: d.motivoRespuesta || null,
      fecha_inicio: d.fechaInicio || null,
      fecha_fin: d.fechaFin || null,
      dias_vacaciones: d.diasVacaciones || null,
      fecha: d.fecha || null,
      tiempo_inicio: d.tiempoInicio || null,
      tiempo_fin: d.tiempoFin || null,
      edad: d.edad || null,
      gender: d.gender || null,
      tipo_contrato: d.tipoContrato || null,
      ubicacion: d.ubicacion || null,
      cargo: d.cargo || null,
      tipo_evento: d.tipoEvento || null,
      cie10: d.cie10 || null,
      codigo_incap: d.codigoIncap || null,
      mes_diagnostico: d.mesDiagnostico || null,
      start_date: d.startDate || null,
      end_date: d.endDate || null,
      num_dias: d.numDias || null,
      document_url: d.documentUrl || null,
      document_name: d.documentName || null,
      created_at: toDate(d.createdAt) || new Date(),
      updated_at: toDate(d.updatedAt) || new Date(),
    });
    count++;
  }
  console.log(`  Migrated ${count} solicitudes`);
}

// ---------------------------------------------------------------------------
// Migrate cesantias
// ---------------------------------------------------------------------------
async function migrateCesantias(userMap: Map<string, { mongoId: string; nombre: string; cedula: string }>) {
  console.log('Migrating cesantias...');
  const snap = await firestore.collection('cesantias').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const mapped = userMap.get(d.userId || '');

    await mongoDB.collection('cesantias').insertOne({
      user_id: mapped?.mongoId || d.userId || '',
      nombre: d.nombre || mapped?.nombre || '',
      cedula: d.cedula || mapped?.cedula || '',
      motivo_solicitud: d.motivoSolicitud || '',
      categoria: d.categoria || '',
      file_url: d.fileUrl || null,
      estado: d.estado || 'pendiente',
      motivo_respuesta: d.motivoRespuesta || null,
      created_at: toDate(d.createdAt) || new Date(),
      updated_at: toDate(d.updatedAt) || new Date(),
    });
    count++;
  }
  console.log(`  Migrated ${count} cesantias`);
}

// ---------------------------------------------------------------------------
// Migrate pqrsf
// ---------------------------------------------------------------------------
async function migratePqrsf(userMap: Map<string, { mongoId: string; nombre: string; cedula: string }>) {
  console.log('Migrating pqrsf...');
  const snap = await firestore.collection('pqrsf').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const mapped = userMap.get(d.userId || '');

    await mongoDB.collection('pqrsf').insertOne({
      user_id: mapped?.mongoId || d.userId || '',
      type: d.type || '',
      message: d.message || '',
      is_anonymous: d.isAnonymous || false,
      nombre: d.nombre || mapped?.nombre || null,
      cedula: d.cedula || mapped?.cedula || null,
      created_at: toDate(d.createdAt) || new Date(),
    });
    count++;
  }
  console.log(`  Migrated ${count} pqrsf`);
}

// ---------------------------------------------------------------------------
// Migrate calendar — with proper birthday-to-user linking
// ---------------------------------------------------------------------------
async function migrateCalendar(userMap: Map<string, { mongoId: string; nombre: string; cedula: string }>) {
  console.log('Migrating calendar...');
  const snap = await firestore.collection('calendar').get();
  let count = 0;
  let birthdaysLinked = 0;
  let birthdaysUnlinked = 0;

  // Build a lookup for matching birthdays to users by name
  const usersByName = new Map<string, string>(); // normalized name → mongoId
  for (const [, userData] of userMap) {
    const normalized = normalizeName(userData.nombre);
    if (normalized) usersByName.set(normalized, userData.mongoId);
  }

  for (const doc of snap.docs) {
    const d = doc.data();
    const date = toDate(d.date);
    if (!date) continue;

    let userId: string | null = null;

    if (d.type === 'birthday') {
      // Try to link by existing userId first
      if (d.userId) {
        const mapped = userMap.get(d.userId);
        if (mapped) userId = mapped.mongoId;
      }

      // If no userId or couldn't map, try matching by name in the title
      if (!userId && d.title) {
        const title = normalizeName(d.title);

        // Try direct match: "Cumpleaños de Juan Perez" → extract "Juan Perez"
        const nameMatch = title.match(/cumpleanos\s+de\s+(.+)/);
        if (nameMatch) {
          const extractedName = nameMatch[1].trim();

          // Exact match
          if (usersByName.has(extractedName)) {
            userId = usersByName.get(extractedName)!;
          } else {
            // Fuzzy: find user whose name contains the extracted name or vice versa
            for (const [userName, mongoId] of usersByName) {
              if (userName.includes(extractedName) || extractedName.includes(userName)) {
                userId = mongoId;
                break;
              }
            }

            // Last resort: match by first name
            if (!userId) {
              const firstName = extractedName.split(' ')[0];
              if (firstName.length > 2) {
                for (const [userName, mongoId] of usersByName) {
                  if (userName.startsWith(firstName)) {
                    userId = mongoId;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      if (userId) birthdaysLinked++;
      else birthdaysUnlinked++;
    } else {
      // Non-birthday events: map userId if present
      if (d.userId) {
        const mapped = userMap.get(d.userId);
        userId = mapped?.mongoId || null;
      }
    }

    await mongoDB.collection('calendar').insertOne({
      user_id: userId,
      type: d.type || 'event',
      title: d.title || '',
      description: d.description || null,
      image: d.image || null,
      date,
      video_url: d.videoUrl || null,
      video_path: d.videoPath || null,
      created_at: toDate(d.createdAt) || new Date(),
    });
    count++;
  }
  console.log(`  Migrated ${count} calendar events`);
  console.log(`    Birthdays linked to users: ${birthdaysLinked}`);
  console.log(`    Birthdays unlinked: ${birthdaysUnlinked}`);
}

// ---------------------------------------------------------------------------
// Migrate documentos
// ---------------------------------------------------------------------------
async function migrateDocumentos() {
  console.log('Migrating documentos...');
  const snap = await firestore.collection('documentos').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    await mongoDB.collection('documentos').insertOne({
      name: d.name || '',
      category: d.category || '',
      document: d.document || '',
      size: d.size || null,
      type: d.type || 'other',
      date_uploaded: toDate(d.dateUploaded) || new Date(),
    });
    count++;
  }
  console.log(`  Migrated ${count} documentos`);
}

// ---------------------------------------------------------------------------
// Migrate quickActions
// ---------------------------------------------------------------------------
async function migrateQuickActions() {
  console.log('Migrating quickActions...');
  const snap = await firestore.collection('quickActions').get();
  let count = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    await mongoDB.collection('quick_actions').insertOne({
      title: d.title || '',
      href: d.href || '',
      icon: d.icon || '',
      order: d.order || 0,
      active: d.active !== false,
    });
    count++;
  }
  console.log(`  Migrated ${count} quick actions`);
}

// ---------------------------------------------------------------------------
// Create indexes
// ---------------------------------------------------------------------------
async function createIndexes() {
  console.log('Creating indexes...');
  await mongoDB.collection('users').createIndex({ cedula: 1 }, { unique: true });
  await mongoDB.collection('users').createIndex({ email: 1 }, { unique: true });
  await mongoDB.collection('solicitudes').createIndex({ user_id: 1 });
  await mongoDB.collection('solicitudes').createIndex({ tipo: 1 });
  await mongoDB.collection('solicitudes').createIndex({ created_at: -1 });
  await mongoDB.collection('cesantias').createIndex({ user_id: 1 });
  await mongoDB.collection('cesantias').createIndex({ created_at: -1 });
  await mongoDB.collection('pqrsf').createIndex({ created_at: -1 });
  await mongoDB.collection('calendar').createIndex({ date: 1 });
  await mongoDB.collection('calendar').createIndex({ user_id: 1 });
  console.log('  Indexes created');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  console.log('Starting migration from Firebase to MongoDB...\n');

  await initMongo();
  const userMap = await migrateUsers();
  await migrateSolicitudes(userMap);
  await migrateCesantias(userMap);
  await migratePqrsf(userMap);
  await migrateCalendar(userMap);
  await migrateDocumentos();
  await migrateQuickActions();
  await createIndexes();

  console.log('\nMigration complete!');
  await mongoClient.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
