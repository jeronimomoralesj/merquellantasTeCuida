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
  created_at: Date;
  updated_at?: Date;
}

/**
 * GET /api/calendar/reactions?event_id=<id>
 *
 * Returns all reactions (notes + hearts) for a calendar event. The client uses this
 * to render the sticky-note wall and the heart count. No admin gate — any signed-in
 * user can see who reacted to what.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const eventId = req.nextUrl.searchParams.get('event_id');
  if (!eventId || !ObjectId.isValid(eventId)) {
    return NextResponse.json({ error: 'event_id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const reactions = (await db
    .collection('calendar_reactions')
    .find({ event_id: eventId })
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

  return NextResponse.json({ notes, hearts });
}

/**
 * POST /api/calendar/reactions
 *   body: { event_id: string, type: 'note' | 'heart', note?: string }
 *
 * Upserts one reaction per (event_id, user_id, type). For notes, the caller writes
 * the text; for hearts, the body is empty and the row acts as a toggle marker. The
 * event's own celebrant can't react on their own event (checked via calendar.user_id).
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

  // Self-reaction guard: the birthday celebrant can't leave notes/hearts on their own
  // event. For non-birthday events there's no "owner" so we skip the check.
  const event = await db
    .collection('calendar')
    .findOne({ _id: new ObjectId(eventId) }, { projection: { user_id: 1, type: 1 } });
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
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

  const now = new Date();
  await db.collection('calendar_reactions').updateOne(
    { event_id: eventId, user_id: session.user.id, type },
    {
      $set: {
        event_id: eventId,
        user_id: session.user.id,
        nombre: session.user.nombre ?? '',
        type,
        note,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true },
  );

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/calendar/reactions?event_id=<id>&type=<heart|note>
 *
 * Removes the caller's own reaction of the given type. Used for heart-toggle off
 * and for removing a note the user no longer wants visible.
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
  await db
    .collection('calendar_reactions')
    .deleteOne({ event_id: eventId, user_id: session.user.id, type });
  return NextResponse.json({ success: true });
}
