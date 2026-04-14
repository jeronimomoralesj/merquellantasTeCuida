import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// POST /api/elearning/users-by-ids — admin only; hydrate ids to { id, nombre, cedula }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && ObjectId.isValid(x)) : [];
  if (ids.length === 0) return NextResponse.json([]);

  const db = await getDb();
  const docs = await db.collection('users').find(
    { _id: { $in: ids.map((i: string) => new ObjectId(i)) } },
    { projection: { nombre: 1, cedula: 1, cargo_empleado: 1 } }
  ).toArray();

  return NextResponse.json(docs.map((u) => ({
    id: u._id.toString(),
    nombre: u.nombre || '—',
    cedula: u.cedula || '',
    cargo_empleado: u.cargo_empleado || null,
  })));
}
