import { NextRequest, NextResponse } from 'next/server';
import { Db } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';
import { getCurrentCyclePeriodo } from '../../../../lib/fondo-period';

// Apply a list of movements to user balances and credit cartera
async function applyCycleMovements(
  db: Db,
  movimientos: Array<Record<string, unknown>>,
  periodo: string,
  cicloId: string
): Promise<void> {
  for (const mov of movimientos) {
    // 1) Aporte (90% permanente / 10% social)
    if (mov.aporte && Number(mov.aporte) > 0) {
      const monto = Number(mov.aporte);
      const permanente = Math.round(monto * 0.9 * 100) / 100;
      const social = Math.round(monto * 0.1 * 100) / 100;

      await db.collection('fondo_aportes').insertOne({
        user_id: mov.user_id,
        periodo,
        monto_total: monto,
        monto_permanente: permanente,
        monto_social: social,
        frecuencia: mov.frecuencia || 'mensual',
        fecha_ejecucion: new Date(),
        ciclo_id: cicloId,
        created_at: new Date(),
      });

      await db.collection('fondo_members').updateOne(
        { user_id: mov.user_id },
        { $inc: { saldo_permanente: permanente, saldo_social: social } }
      );
    }

    // 2) Actividad
    if (mov.actividad && Number(mov.actividad) !== 0) {
      const monto = Math.abs(Number(mov.actividad));
      const tipo = Number(mov.actividad) >= 0 ? 'aporte' : 'retiro';

      await db.collection('fondo_actividad').insertOne({
        user_id: mov.user_id,
        tipo,
        monto,
        fecha: new Date(),
        periodo,
        ciclo_id: cicloId,
        created_at: new Date(),
      });

      const inc = tipo === 'aporte' ? monto : -monto;
      await db.collection('fondo_members').updateOne(
        { user_id: mov.user_id },
        { $inc: { saldo_actividad: inc } }
      );
    }

    // 3) Per-credit payments
    const creditPayments = Array.isArray(mov.creditos)
      ? (mov.creditos as Array<{ cartera_id: string; monto: number }>)
      : [];

    for (const cp of creditPayments) {
      if (!cp.cartera_id || !cp.monto || Number(cp.monto) <= 0) continue;
      if (!ObjectId.isValid(cp.cartera_id)) continue;

      const cartera = await db.collection('fondo_cartera').findOne({ _id: new ObjectId(cp.cartera_id) });
      if (!cartera || cartera.estado !== 'activo') continue;

      const montoTotal = Number(cp.monto);
      const cuotaEsperada = cartera.cuotas_restantes > 0
        ? Math.round((cartera.saldo_total / cartera.cuotas_restantes) * 100) / 100
        : 0;

      const pago = {
        numero_cuota: (cartera.cuotas_pagadas || 0) + 1,
        fecha_pago: new Date(),
        monto_total: montoTotal,
        monto_esperado: cuotaEsperada,
        diferencia: Math.round((montoTotal - cuotaEsperada) * 100) / 100,
        flagged: Math.abs(montoTotal - cuotaEsperada) > 1,
        ciclo_id: cicloId,
      };

      const newSaldoTotal = Math.max(0, (cartera.saldo_total || 0) - montoTotal);
      const ratio = cartera.saldo_total > 0 ? cartera.saldo_capital / cartera.saldo_total : 0;
      const newSaldoCapital = Math.max(0, cartera.saldo_capital - montoTotal * ratio);
      const newSaldoInteres = Math.max(0, cartera.saldo_interes - montoTotal * (1 - ratio));
      const newCuotasPagadas = (cartera.cuotas_pagadas || 0) + 1;
      const newCuotasRestantes = Math.max(0, (cartera.cuotas_restantes || 0) - 1);
      const estado = newSaldoTotal <= 0 ? 'pagado' : 'activo';

      await db.collection('fondo_cartera').updateOne(
        { _id: new ObjectId(cp.cartera_id) },
        {
          $set: {
            cuotas_pagadas: newCuotasPagadas,
            cuotas_restantes: newCuotasRestantes,
            saldo_total: newSaldoTotal,
            saldo_capital: newSaldoCapital,
            saldo_interes: newSaldoInteres,
            estado,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          $push: { pagos: pago } as any,
        }
      );
    }
  }
}

// GET /api/fondo/ciclos?estado=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado');
  const periodo = searchParams.get('periodo');

  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;
  if (periodo) filter.periodo = periodo;

  if (session.user.rol === 'fondo') {
    filter.created_by = session.user.id;
  }

  const results = await db.collection('fondo_ciclos')
    .find(filter).sort({ created_at: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/ciclos — fondo creates or updates a cycle for the current period
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.movimientos || !Array.isArray(body.movimientos)) {
    return NextResponse.json({ error: 'movimientos requeridos' }, { status: 400 });
  }

  const periodo = body.periodo || getCurrentCyclePeriodo();
  const db = await getDb();

  // Check for existing ciclo for this period
  const existing = await db.collection('fondo_ciclos').findOne({
    periodo,
    estado: { $in: ['enviado_admin', 'ajustes_admin', 'aprobado'] },
  });

  if (existing) {
    // If the existing cycle is in 'ajustes_admin' state, the fondo is finalizing
    // its redistribution after admin set the budgets. This goes DIRECTLY to
    // aprobado and applies the balances — no second admin review needed.
    if (existing.estado === 'ajustes_admin') {
      // Apply balances for ALL movements (the ones the fondo is redistributing
      // plus the ones that didn't need changes)
      await applyCycleMovements(db, body.movimientos, existing.periodo, existing._id.toString());

      await db.collection('fondo_ciclos').updateOne(
        { _id: existing._id },
        {
          $set: {
            movimientos: body.movimientos,
            estado: 'aprobado',
            approved_at: new Date(),
            approved_by: session.user.id,
            updated_at: new Date(),
            revision_count: (existing.revision_count || 0) + 1,
          },
        }
      );
      return NextResponse.json({ success: true, id: existing._id.toString(), aprobado: true });
    }
    // Otherwise it's already submitted/approved — block
    return NextResponse.json(
      { error: `Ya existe un ciclo para este periodo (${existing.estado})`, existing_id: existing._id.toString() },
      { status: 409 }
    );
  }

  const result = await db.collection('fondo_ciclos').insertOne({
    periodo,
    tipo: body.tipo || 'biweekly',
    estado: 'enviado_admin',
    movimientos: body.movimientos,
    movimientos_admin: null,
    cambios_admin: null,
    revision_count: 0,
    created_by: session.user.id,
    approved_by: null,
    created_at: new Date(),
    approved_at: null,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/ciclos — admin approves/modifies/rejects a cycle
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'id y action requeridos' }, { status: 400 });
  }

  const db = await getDb();
  const ciclo = await db.collection('fondo_ciclos').findOne({ _id: new ObjectId(body.id) });
  if (!ciclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

  // RECHAZAR
  if (body.action === 'rechazar') {
    await db.collection('fondo_ciclos').updateOne(
      { _id: new ObjectId(body.id) },
      {
        $set: {
          estado: 'rechazado',
          motivo_rechazo: body.motivo_rechazo || null,
          approved_by: session.user.id,
          approved_at: new Date(),
        },
      }
    );
    return NextResponse.json({ success: true });
  }

  // AJUSTES (admin made changes to budgets, send back to fondo)
  // body.budget_adjustments: { user_id: newTotal }[]
  if (body.action === 'ajustes') {
    const ajustes = body.budget_adjustments || [];
    if (!Array.isArray(ajustes)) {
      return NextResponse.json({ error: 'budget_adjustments requeridos' }, { status: 400 });
    }

    await db.collection('fondo_ciclos').updateOne(
      { _id: new ObjectId(body.id) },
      {
        $set: {
          estado: 'ajustes_admin',
          movimientos_admin: ajustes,
          ajustes_admin_at: new Date(),
          ajustado_por: session.user.id,
        },
      }
    );

    return NextResponse.json({ success: true });
  }

  // APROBAR (no changes — apply directly)
  if (body.action === 'aprobar') {
    if (ciclo.estado !== 'enviado_admin') {
      return NextResponse.json({ error: 'Solo se pueden aprobar ciclos en estado enviado_admin' }, { status: 400 });
    }

    const movimientos = ciclo.movimientos || [];
    await applyCycleMovements(db, movimientos, ciclo.periodo, body.id);

    await db.collection('fondo_ciclos').updateOne(
      { _id: new ObjectId(body.id) },
      {
        $set: {
          estado: 'aprobado',
          approved_by: session.user.id,
          approved_at: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
