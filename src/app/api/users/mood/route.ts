import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MOODS = new Set(['feliz', 'neutral', 'triste']);

/**
 * PUT /api/users/mood
 *   body: { mood: 'feliz' | 'neutral' | 'triste', note?: string, helpTopic?: string }
 *
 * Upserts the latest mood on the user document (for quick lookups) AND appends a full
 * record to `mood_checkins` so admin stats can compute streaks, monthly charts, and show
 * the optional note the employee wrote.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.mood !== 'string' || !ALLOWED_MOODS.has(body.mood)) {
    return NextResponse.json({ error: 'mood inválido' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const helpTopic = typeof body.helpTopic === 'string' ? body.helpTopic.trim().slice(0, 100) : '';
  const now = new Date();

  const db = await getDb();
  const userId = new ObjectId(session.user.id);

  const user = await db.collection('users').findOne(
    { _id: userId },
    { projection: { nombre: 1, cedula: 1, email: 1, cargo_empleado: 1, posicion: 1, area: 1, departamento: 1 } }
  );

  await db.collection('users').updateOne(
    { _id: userId },
    { $set: { mood: body.mood, mood_updated_at: now } }
  );

  await db.collection('mood_checkins').insertOne({
    user_id: session.user.id,
    cedula: session.user.cedula ?? user?.cedula ?? null,
    nombre: user?.nombre ?? session.user.nombre ?? null,
    email: user?.email ?? null,
    cargo: user?.cargo_empleado ?? user?.posicion ?? null,
    area: user?.area ?? null,
    departamento: user?.departamento ?? null,
    mood: body.mood,
    note: note || null,
    help_topic: helpTopic || null,
    created_at: now,
  });

  return NextResponse.json({ success: true, mood: body.mood, at: now });
}

/**
 * PATCH /api/users/mood — update the most recent check-in for the current user. Used when
 * the user adds a note or picks a help topic *after* already submitting the mood emoji.
 * This keeps the flow feeling responsive (mood saves on emoji click, note/topic save later)
 * without orphaning the pieces into separate rows.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.note === 'string') {
    const n = body.note.trim().slice(0, 1000);
    patch.note = n || null;
  }
  if (typeof body.helpTopic === 'string') {
    const h = body.helpTopic.trim().slice(0, 100);
    patch.help_topic = h || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });
  }

  const db = await getDb();
  const latest = await db.collection('mood_checkins').findOne(
    { user_id: session.user.id },
    { sort: { created_at: -1 }, projection: { _id: 1 } }
  );
  if (!latest) {
    return NextResponse.json({ error: 'No hay mood reciente para actualizar' }, { status: 404 });
  }
  await db.collection('mood_checkins').updateOne(
    { _id: latest._id },
    { $set: patch }
  );
  return NextResponse.json({ success: true });
}

/**
 * GET /api/users/mood  (current user)
 *   → returns the most recent check-in for the authenticated user so the chat widget can
 *     decide whether to ask again today.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const latest = await db.collection('mood_checkins').findOne(
    { user_id: session.user.id },
    { sort: { created_at: -1 } }
  );
  return NextResponse.json({ latest });
}
