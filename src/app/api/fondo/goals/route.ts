import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/fondo/goals — list the current user's savings goals (newest first).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const goals = await db
    .collection('fondo_goals')
    .find({ user_id: session.user.id })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json(goals);
}

// POST /api/fondo/goals — create a savings goal.
// body: { title, target_amount, target_date, color }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const title = String(body.title || '').trim();
  const targetAmount = Number(body.target_amount);
  const targetDateRaw = body.target_date;
  const color = String(body.color || '#f4a900').trim();

  if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: 'Monto objetivo inválido' }, { status: 400 });
  }
  const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;
  if (!targetDate || isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: 'Fecha objetivo inválida' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection('fondo_goals').insertOne({
    user_id: session.user.id,
    title,
    target_amount: targetAmount,
    target_date: targetDate,
    color,
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}
