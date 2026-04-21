import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/certificados?year=2025[&cedula=xxx][&q=search]
 *
 *   - admin: lists all certificados for the year, joined with the user's nombre/email.
 *   - regular user: only returns their own record (cedula from session).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear() - 1);
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const cedulaFilter = req.nextUrl.searchParams.get('cedula') || '';

  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: 'year inválido' }, { status: 400 });
  }

  const db = await getDb();
  const isAdmin = session.user.rol === 'admin';

  if (!isAdmin) {
    // User can only read their own
    const doc = await db.collection('certificados').findOne({
      year,
      cedula: session.user.cedula,
    });
    return NextResponse.json({ year, records: doc ? [doc] : [] });
  }

  const query: Record<string, unknown> = { year };
  if (cedulaFilter) query.cedula = cedulaFilter;
  const records = await db
    .collection('certificados')
    .find(query)
    .sort({ cedula: 1 })
    .limit(2000)
    .toArray();

  // Join with users
  const userIds = records
    .map((r) => r.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const users = await db
    .collection('users')
    .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) } }, { projection: { nombre: 1, email: 1, cedula: 1 } })
    .toArray();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const userByCedula = new Map(users.map((u) => [u.cedula, u]));

  const enriched = records.map((r) => {
    const u = (r.user_id && userById.get(r.user_id)) || userByCedula.get(r.cedula) || null;
    return {
      id: r._id.toString(),
      year: r.year,
      cedula: r.cedula,
      user_id: r.user_id,
      user: u
        ? { id: u._id.toString(), nombre: u.nombre, email: u.email, cedula: u.cedula }
        : null,
      data: r.data,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });

  const filtered = q
    ? enriched.filter((r) => {
        const hay = `${r.cedula} ${r.user?.nombre || ''} ${r.user?.email || ''}`.toLowerCase();
        return hay.includes(q);
      })
    : enriched;

  return NextResponse.json({ year, records: filtered });
}
