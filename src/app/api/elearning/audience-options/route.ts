import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

/**
 * GET /api/elearning/audience-options?q=...
 *
 * Admin-only picker data for the "¿Quién puede ver este curso?" dialog. Returns
 * the distinct áreas across the users collection plus a list of individual users
 * when a query is given. The legacy `cargos` key is still returned so older
 * clients keep working until the UI fully rolls over.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const db = await getDb();

  const [areas, cargos] = await Promise.all([
    db
      .collection('users')
      .distinct('area')
      .then((vals) =>
        vals
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .sort((a, b) => a.localeCompare(b, 'es')),
      ),
    db
      .collection('users')
      .distinct('cargo_empleado')
      .then((vals) =>
        vals.filter((v): v is string => typeof v === 'string' && v.length > 0).sort(),
      ),
  ]);

  let users: {
    id: string;
    nombre: string;
    cedula: string;
    cargo_empleado: string | null;
    area: string | null;
  }[] = [];
  if (q.length >= 2) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const docs = await db
      .collection('users')
      .find(
        { $or: [{ nombre: rx }, { cedula: rx }] },
        { projection: { nombre: 1, cedula: 1, cargo_empleado: 1, area: 1 } },
      )
      .limit(20)
      .toArray();
    users = docs.map((u) => ({
      id: u._id.toString(),
      nombre: u.nombre || '—',
      cedula: u.cedula || '',
      cargo_empleado: u.cargo_empleado || null,
      area: u.area || null,
    }));
  }

  return NextResponse.json({ areas, cargos, users });
}
