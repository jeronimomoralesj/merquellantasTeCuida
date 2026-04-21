import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PUT /api/certificados/:id   (admin)
 * body: { cedula?: string, data?: Record<string, unknown> }
 * Updates an individual certificado record's data.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'body inválido' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date() };
  if (typeof body.cedula === 'string') {
    const c = body.cedula.replace(/\D/g, '');
    if (c) update.cedula = c;
  }
  if (body.data && typeof body.data === 'object') update.data = body.data;

  const db = await getDb();
  const res = await db.collection('certificados').updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  // Re-link user_id if cedula changed
  if (update.cedula) {
    const u = await db.collection('users').findOne(
      { cedula: update.cedula as string },
      { projection: { _id: 1 } }
    );
    await db.collection('certificados').updateOne(
      { _id: new ObjectId(id) },
      { $set: { user_id: u?._id?.toString() ?? null } }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/certificados/:id  (admin)
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  const db = await getDb();
  const res = await db.collection('certificados').deleteOne({ _id: new ObjectId(id) });
  if (res.deletedCount === 0) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
