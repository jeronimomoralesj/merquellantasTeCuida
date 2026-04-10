import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/actividad?user_id=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');

  const filter: Record<string, unknown> = {};
  if (session.user.rol === 'user') {
    filter.user_id = session.user.id;
  } else if (userId) {
    filter.user_id = userId;
  }

  const results = await db.collection('fondo_actividad')
    .find(filter).sort({ fecha: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/actividad — record deposit or withdrawal (fondo/admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.user_id || !body.monto || !body.tipo) {
    return NextResponse.json({ error: 'user_id, monto y tipo requeridos' }, { status: 400 });
  }

  const validTipos = ['aporte', 'retiro'];
  if (!validTipos.includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo debe ser aporte o retiro' }, { status: 400 });
  }

  const monto = Math.abs(Number(body.monto));
  const db = await getDb();

  await db.collection('fondo_actividad').insertOne({
    user_id: body.user_id,
    tipo: body.tipo,
    monto,
    fecha: body.fecha ? new Date(body.fecha) : new Date(),
    periodo: body.periodo || new Date().toISOString().slice(0, 7),
    descripcion: body.descripcion || null,
    created_at: new Date(),
  });

  // Update balance
  const increment = body.tipo === 'aporte' ? monto : -monto;
  await db.collection('fondo_members').updateOne(
    { user_id: body.user_id },
    { $inc: { saldo_actividad: increment } }
  );

  return NextResponse.json({ success: true });
}
