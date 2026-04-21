import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NOTE_LEN = 160;

interface ReactionDoc {
  _id: { toString(): string };
  event_id: string;
  user_id: string;
  nombre: string;
  type: 'note' | 'heart';
  note: string | null;
  cycle_key?: string;
  created_at: Date;
  updated_at?: Date;
}

interface EventDoc {
  _id: { toString(): string };
  type?: string;
  user_id?: string | null;
  date?: Date | string;
}

/**
 * Compute the "cycle key" for an event — a YYYY-MM-DD stamp identifying *which*
 * occurrence of the event the reactions belong to. For birthdays this rolls over
 * each year, so last year's stickies get purged and the wall starts fresh for the
 * new celebration. For one-off events it just stays as the event date.
 *
 * Rule: return the next (or today's) occurrence date. Once the birthday has passed,
 * cycle_key flips to next year's date and the previous year's reactions become stale.
 */
function currentCycleKey(event: EventDoc): string {
  const raw = event.date ? new Date(event.date) : new Date();
  if (isNaN(raw.getTime())) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  if (event.type === 'birthday') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let occurrence = new Date(today.getFullYear(), raw.getMonth(), raw.getDate());
    occurrence.setHours(0, 0, 0, 0);
    if (occurrence < today) {
      occurrence = new Date(today.getFullYear() + 1, raw.getMonth(), raw.getDate());
      occurrence.setHours(0, 0, 0, 0);
    }
    return `${occurrence.getFullYear()}-${String(occurrence.getMonth() + 1).padStart(2, '0')}-${String(occurrence.getDate()).padStart(2, '0')}`;
  }

  return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
}

/**
 * Delete any reactions for this event that belong to a previous cycle. Returns the
 * current cycle_key so callers can use it for writes/filters without recomputing.
 */
async function pruneStaleReactions(
  db: Awaited<ReturnType<typeof getDb>>,
  event: EventDoc,
): Promise<string> {
  const cycle = currentCycleKey(event);
  await db
    .collection('calendar_reactions')
    .deleteMany({ event_id: event._id.toString(), cycle_key: { $ne: cycle } });
  return cycle;
}

/**
 * GET /api/calendar/reactions?event_id=<id>
 *
 * Returns the reactions belonging to the current cycle. Old-cycle rows are deleted
 * in-line so storage stays bounded to "this year's birthday" + "this quarter's event".
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId || !ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: 'event_id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const event = (await db
    .collection('calendar')
    .findOne({ _id: new ObjectId(eventId) })) as unknown as EventDoc | null;
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

  const cycle = await pruneStaleReactions(db, event);

  const reactions = (await db
    .collection('calendar_reactions')
    .find({ event_id: eventId, cycle_key: cycle })
    .sort({ created_at: 1 })
    .toArray()) as unknown as ReactionDoc[];

  const notes = reactions
    .filter((r) => r.type === 'note' && r.note)
    .map((r) => ({
      id: r._id.toString(),
      user_id: r.user_id,
      nombre: r.nombre,
      note: r.note,
      created_at: r.created_at,
      mine: r.user_id === session.user.id,
    }));
  const hearts = reactions
    .filter((r) => r.type === 'heart')
    .map((r) => ({
      id: r._id.toString(),
      user_id: r.user_id,
      nombre: r.nombre,
      mine: r.user_id === session.user.id,
    }));

  return NextResponse.json({ notes, hearts, cycle });
}

/**
 * POST /api/calendar/reactions
 *   body: { event_id: string, type: 'note' | 'heart', note?: string }
 *
 * Upserts one reaction per (event_id, user_id, type) for the *current cycle*. Any
 * prior-cycle reactions for the same user+event get cleaned up first so there's
 * only one canonical note per user per celebration.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const eventId = body?.event_id;
  const type: 'note' | 'heart' | undefined = body?.type;
  const rawNote = typeof body?.note === 'string' ? body.note : '';

  if (!eventId || !ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: 'event_id inválido' }, { status: 400 });
  }
  if (type !== 'note' && type !== 'heart') {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 });
  }

  const note = type === 'note' ? rawNote.trim().slice(0, MAX_NOTE_LEN) : null;
  if (type === 'note' && !note) {
    return NextResponse.json({ error: 'La nota no puede estar vacía' }, { status: 400 });
  }

  const db = await getDb();
  const event = (await db
    .collection('calendar')
    .findOne({ _id: new ObjectId(eventId) })) as unknown as EventDoc | null;
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

  // Self-reaction guard for birthdays.
  if (
    event.type === 'birthday' &&
    event.user_id &&
    String(event.user_id) === session.user.id
  ) {
    return NextResponse.json(
      { error: 'No puedes reaccionar a tu propio cumpleaños' },
      { status: 403 },
    );
  }

  const cycle = await pruneStaleReactions(db, event);
  const now = new Date();

  await db.collection('calendar_reactions').updateOne(
    { event_id: eventId, user_id: session.user.id, type, cycle_key: cycle },
    {
      $set: {
        event_id: eventId,
        user_id: session.user.id,
        nombre: session.user.nombre ?? '',
        type,
        note,
        cycle_key: cycle,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true },
  );

  return NextResponse.json({ success: true, cycle });
}

/**
 * DELETE /api/calendar/reactions?event_id=<id>&type=<heart|note>
 *
 * Removes the caller's own reaction of the given type for the current cycle.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get('event_id');
  const type = req.nextUrl.searchParams.get('type');
  if (!eventId || !ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: 'event_id inválido' }, { status: 400 });
  }
  if (type !== 'note' && type !== 'heart') {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 });
  }

  const db = await getDb();
  const event = (await db
    .collection('calendar')
    .findOne({ _id: new ObjectId(eventId) })) as unknown as EventDoc | null;
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

  const cycle = await pruneStaleReactions(db, event);

  await db
    .collection('calendar_reactions')
    .deleteOne({ event_id: eventId, user_id: session.user.id, type, cycle_key: cycle });
  return NextResponse.json({ success: true });
}
