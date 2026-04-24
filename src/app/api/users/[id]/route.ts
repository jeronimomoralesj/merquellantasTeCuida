import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/users/:id — fetch another user's profile (fondo/admin only).
// Regular users have /api/users/me for their own record.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.user.rol !== 'fondo' && session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(id) },
    { projection: { passwordHash: 0 } },
  );
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json(user);
}
