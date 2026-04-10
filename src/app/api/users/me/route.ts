import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { passwordHash: 0 } }
  );

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json(user);
}
