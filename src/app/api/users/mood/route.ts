import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { mood } = await req.json();

  const db = await getDb();
  await db.collection('users').updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: { mood, mood_updated_at: new Date() } }
  );

  return NextResponse.json({ success: true });
}
