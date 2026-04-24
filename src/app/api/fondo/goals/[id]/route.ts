import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/fondo/goals/:id — update a goal the current user owns.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection('fondo_goals').findOne({ _id: new ObjectId(id) });
  if (!existing) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
  if (existing.user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
    update.title = title;
  }
  if (body.target_amount !== undefined) {
    const n = Number(body.target_amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: 'Monto objetivo inválido' }, { status: 400 });
    }
    update.target_amount = n;
  }
  if (body.target_date !== undefined) {
    const d = new Date(body.target_date);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Fecha objetivo inválida' }, { status: 400 });
    }
    update.target_date = d;
  }
  if (body.color !== undefined) update.color = String(body.color || '#f4a900').trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }
  update.updated_at = new Date();

  await db.collection('fondo_goals').updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/fondo/goals/:id — remove a goal the current user owns.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.collection('fondo_goals').findOne({ _id: new ObjectId(id) });
  if (!existing) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
  if (existing.user_id !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  await db.collection('fondo_goals').deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ success: true });
}
