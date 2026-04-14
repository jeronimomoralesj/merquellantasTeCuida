import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/elearning/audience-options?q=... — admin only; returns distinct cargos + user matches
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const db = await getDb();

  const cargos = (await db.collection('users').distinct('cargo_empleado'))
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .sort();

  let users: { id: string; nombre: string; cedula: string; cargo_empleado: string | null }[] = [];
  if (q.length >= 2) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const docs = await db.collection('users')
      .find({ $or: [{ nombre: rx }, { cedula: rx }] }, { projection: { nombre: 1, cedula: 1, cargo_empleado: 1 } })
      .limit(20)
      .toArray();
    users = docs.map((u) => ({
      id: u._id.toString(),
      nombre: u.nombre || '—',
      cedula: u.cedula || '',
      cargo_empleado: u.cargo_empleado || null,
    }));
  }

  return NextResponse.json({ cargos, users });
}
