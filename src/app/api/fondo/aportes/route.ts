import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import type { WithId, Document } from 'mongodb';
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

// PATCH /api/fondo/aportes — edit a single aporte (fondo/admin).
// Adjusts member saldos by the delta so balances stay consistent.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.id || !ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const db = await getDb();
  const existing = (await db.collection('fondo_aportes').findOne({
    _id: new ObjectId(body.id),
  })) as WithId<Document> | null;
  if (!existing) return NextResponse.json({ error: 'Aporte no encontrado' }, { status: 404 });

  const update: Record<string, unknown> = {};
  let newPermanente = existing.monto_permanente || 0;
  let newSocial = existing.monto_social || 0;
  let montoChanged = false;

  if (body.monto_total !== undefined) {
    const monto = Number(body.monto_total);
    if (!Number.isFinite(monto) || monto < 0) {
      return NextResponse.json({ error: 'monto_total inválido' }, { status: 400 });
    }
    newPermanente = Math.round(monto * 0.9 * 100) / 100;
    newSocial = Math.round(monto * 0.1 * 100) / 100;
    update.monto_total = monto;
    update.monto_permanente = newPermanente;
    update.monto_social = newSocial;
    montoChanged = monto !== (existing.monto_total || 0);
  }
  if (body.periodo !== undefined) update.periodo = String(body.periodo);
  if (body.descripcion !== undefined) update.descripcion = body.descripcion || null;
  if (body.frecuencia !== undefined) update.frecuencia = String(body.frecuencia);
  if (body.fecha_ejecucion !== undefined) {
    const d = new Date(body.fecha_ejecucion);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'fecha_ejecucion inválida' }, { status: 400 });
    }
    update.fecha_ejecucion = d;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }
  update.updated_at = new Date();

  await db.collection('fondo_aportes').updateOne(
    { _id: new ObjectId(body.id) },
    { $set: update }
  );

  // Only touch member balances if the amount actually moved.
  if (montoChanged) {
    const deltaPermanente = newPermanente - (existing.monto_permanente || 0);
    const deltaSocial = newSocial - (existing.monto_social || 0);
    if (deltaPermanente !== 0 || deltaSocial !== 0) {
      await db.collection('fondo_members').updateOne(
        { user_id: existing.user_id },
        { $inc: { saldo_permanente: deltaPermanente, saldo_social: deltaSocial } }
      );
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/fondo/aportes?id=xxx — removes an aporte and reverses its
// contribution to the member's saldos.
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const db = await getDb();
  const existing = (await db.collection('fondo_aportes').findOne({
    _id: new ObjectId(id),
  })) as WithId<Document> | null;
  if (!existing) return NextResponse.json({ error: 'Aporte no encontrado' }, { status: 404 });

  await db.collection('fondo_aportes').deleteOne({ _id: new ObjectId(id) });

  const permanente = existing.monto_permanente || 0;
  const social = existing.monto_social || 0;
  if (permanente || social) {
    await db.collection('fondo_members').updateOne(
      { user_id: existing.user_id },
      { $inc: { saldo_permanente: -permanente, saldo_social: -social } }
    );
  }

  return NextResponse.json({ success: true });
}
