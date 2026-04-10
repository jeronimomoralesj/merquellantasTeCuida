import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/calendar — list events
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const results = await db.collection('calendar').find({}).sort({ date: 1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/calendar — create event (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
  }
  if (!body.date) {
    return NextResponse.json({ error: 'La fecha es requerida' }, { status: 400 });
  }

  const validTypes = ['event', 'birthday'];
  const eventType = validTypes.includes(body.type) ? body.type : 'event';

  const db = await getDb();

  const result = await db.collection('calendar').insertOne({
    user_id: body.userId || null,
    type: eventType,
    title: body.title,
    description: body.description || null,
    image: body.image || null,
    date: body.date,
    video_url: body.videoUrl || null,
    video_path: body.videoPath || null,
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/calendar — update event (admin)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...fields } = body;

  const allowedFields: Record<string, string> = {
    title: 'title',
    description: 'description',
    image: 'image',
    date: 'date',
    videoUrl: 'video_url',
    videoPath: 'video_path',
  };

  const setDoc: Record<string, unknown> = {};
  for (const [bodyKey, dbKey] of Object.entries(allowedFields)) {
    if (fields[bodyKey] !== undefined) {
      setDoc[dbKey] = fields[bodyKey];
    }
  }

  if (Object.keys(setDoc).length > 0) {
    const db = await getDb();
    await db.collection('calendar').updateOne(
      { _id: new ObjectId(id) },
      { $set: setDoc }
    );
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/calendar — delete event (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await req.json();
  const db = await getDb();
  await db.collection('calendar').deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ success: true });
}
