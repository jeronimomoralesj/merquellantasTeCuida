import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/aportes?user_id=X&periodo=YYYY-MM
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const periodo = searchParams.get('periodo');

  const filter: Record<string, unknown> = {};

  if (session.user.rol === 'user') {
    filter.user_id = session.user.id;
  } else if (userId) {
    filter.user_id = userId;
  }

  if (periodo) filter.periodo = periodo;

  const results = await db.collection('fondo_aportes')
    .find(filter).sort({ fecha_ejecucion: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/aportes — record a contribution (fondo/admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.user_id || !body.monto_total) {
    return NextResponse.json({ error: 'user_id y monto_total requeridos' }, { status: 400 });
  }

  const monto = Number(body.monto_total);
  const permanente = Math.round(monto * 0.9 * 100) / 100;
  const social = Math.round(monto * 0.1 * 100) / 100;

  const db = await getDb();

  const result = await db.collection('fondo_aportes').insertOne({
    user_id: body.user_id,
    periodo: body.periodo || new Date().toISOString().slice(0, 7),
    monto_total: monto,
    monto_permanente: permanente,
    monto_social: social,
    frecuencia: body.frecuencia || 'mensual',
    fecha_ejecucion: body.fecha_ejecucion ? new Date(body.fecha_ejecucion) : new Date(),
    tipo: body.tipo || 'quincena',
    created_at: new Date(),
  });

  // Update member balances
  await db.collection('fondo_members').updateOne(
    { user_id: body.user_id },
    {
      $inc: { saldo_permanente: permanente, saldo_social: social },
    }
  );

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// POST batch — record multiple contributions at once
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { aportes } = await req.json();
  if (!Array.isArray(aportes) || aportes.length === 0) {
    return NextResponse.json({ error: 'Array de aportes requerido' }, { status: 400 });
  }

  const db = await getDb();

  for (const aporte of aportes) {
    const monto = Number(aporte.monto_total);
    const permanente = Math.round(monto * 0.9 * 100) / 100;
    const social = Math.round(monto * 0.1 * 100) / 100;

    await db.collection('fondo_aportes').insertOne({
      user_id: aporte.user_id,
      periodo: aporte.periodo || new Date().toISOString().slice(0, 7),
      monto_total: monto,
      monto_permanente: permanente,
      monto_social: social,
      frecuencia: aporte.frecuencia || 'mensual',
      fecha_ejecucion: aporte.fecha_ejecucion ? new Date(aporte.fecha_ejecucion) : new Date(),
      tipo: aporte.tipo || 'quincena',
      created_at: new Date(),
    });

    await db.collection('fondo_members').updateOne(
      { user_id: aporte.user_id },
      { $inc: { saldo_permanente: permanente, saldo_social: social } }
    );
  }

  return NextResponse.json({ success: true, count: aportes.length });
}
