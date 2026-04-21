import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/users/search?q=<query>[&limit=20]
 *
 * Returns minimal user fields (id, nombre, email, cedula, cargo) matching the query
 * by nombre / primer/segundo apellido / cedula. Authenticated users of any role can
 * call this — it's used by the solicitud forms to let employees pick their immediate
 * supervisor. We intentionally don't return email addresses in the payload to keep
 * this side-channel tight; the server resolves the email at send time.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 20)));

  const db = await getDb();
  const filter: Record<string, unknown> = {};

  if (q) {
    // Escape regex special chars before building the case-insensitive query.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { nombre: { $regex: escaped, $options: 'i' } },
      { first_name: { $regex: escaped, $options: 'i' } },
      { primer_apellido: { $regex: escaped, $options: 'i' } },
      { segundo_apellido: { $regex: escaped, $options: 'i' } },
      { cedula: { $regex: `^${escaped}`, $options: 'i' } },
    ];
  }

  // Hide self — a user can't pick themselves as jefe.
  if (session.user.id) {
    filter._id = { $ne: new (await import('mongodb')).ObjectId(session.user.id) };
  }

  const users = await db
    .collection('users')
    .find(filter, {
      projection: {
        nombre: 1,
        cedula: 1,
        cargo_empleado: 1,
        posicion: 1,
        area: 1,
        departamento: 1,
      },
    })
    .sort({ nombre: 1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({
    results: users.map((u) => ({
      id: u._id.toString(),
      nombre: u.nombre ?? '',
      cedula: u.cedula ?? '',
      cargo: u.cargo_empleado ?? u.posicion ?? '',
      area: u.area ?? '',
      departamento: u.departamento ?? '',
    })),
  });
}
