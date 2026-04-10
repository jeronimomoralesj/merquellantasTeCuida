import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/pqrsf — list all (admin)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = Math.max(1, Math.min(parseInt(limitParam!) || 50, 500));

  const db = await getDb();
  const results = await db.collection('pqrsf').find({}).sort({ created_at: -1 }).limit(limit).toArray();
  return NextResponse.json(results);
}

// POST /api/pqrsf — create PQRSF
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();

  // Input validation
  const validTypes = ['Pregunta', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'];
  if (!body.type || !validTypes.includes(body.type)) {
    return NextResponse.json({ error: 'Tipo de PQRSF inválido' }, { status: 400 });
  }
  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'El mensaje es requerido' }, { status: 400 });
  }

  const db = await getDb();

  // Always store user identity for admin visibility
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { nombre: 1, cedula: 1 } }
  );

  const result = await db.collection('pqrsf').insertOne({
    user_id: session.user.id,
    type: body.type,
    message: body.message,
    is_anonymous: !!body.isAnonymous,
    nombre: user?.nombre || null,
    cedula: user?.cedula || null,
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}
