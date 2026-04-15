import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const FONDO_COLLECTIONS_TO_LINK = [
  'fondo_members',
  'fondo_aportes',
  'fondo_actividad',
  'fondo_cartera',
  'fondo_retiros',
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'WIPE') {
    return NextResponse.json({ error: 'Confirmación requerida' }, { status: 400 });
  }

  const db = await getDb();

  // 1) Snapshot cedula onto fondo records so bulk-upload can re-link them
  const userIdToCedula = new Map<string, string>();
  const allUsers = await db
    .collection('users')
    .find({}, { projection: { _id: 1, cedula: 1 } })
    .toArray();
  for (const u of allUsers) {
    if (u.cedula) userIdToCedula.set(u._id.toString(), String(u.cedula));
  }

  const snapshots: Record<string, number> = {};
  for (const cName of FONDO_COLLECTIONS_TO_LINK) {
    const col = db.collection(cName);
    const docs = await col
      .find({ cedula_snapshot: { $exists: false } }, { projection: { _id: 1, user_id: 1 } })
      .toArray();
    let written = 0;
    for (const d of docs) {
      const ced = userIdToCedula.get(String(d.user_id));
      if (!ced) continue;
      await col.updateOne({ _id: d._id }, { $set: { cedula_snapshot: ced } });
      written++;
    }
    snapshots[cName] = written;
  }

  // 2) Wipe user-owned collections
  const deleted: Record<string, number> = {};
  for (const cName of COLLECTIONS_TO_WIPE) {
    const col = db.collection(cName);
    try {
      const r = await col.deleteMany({});
      deleted[cName] = r.deletedCount || 0;
    } catch {
      deleted[cName] = 0;
    }
  }

  return NextResponse.json({
    success: true,
    snapshots,
    deleted,
    total_deleted: Object.values(deleted).reduce((a, b) => a + b, 0),
  });
}
