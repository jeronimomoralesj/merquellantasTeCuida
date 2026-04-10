import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/ciclos?estado=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado');

  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;

  // Fondo user sees their own cycles, admin sees those sent to them
  if (session.user.rol === 'fondo') {
    filter.created_by = session.user.id;
  }

  const results = await db.collection('fondo_ciclos')
    .find(filter).sort({ created_at: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/ciclos — create a new cycle (fondo submits for admin approval)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.periodo || !body.movimientos || !Array.isArray(body.movimientos)) {
    return NextResponse.json({ error: 'periodo y movimientos requeridos' }, { status: 400 });
  }

  const db = await getDb();

  const result = await db.collection('fondo_ciclos').insertOne({
    periodo: body.periodo,
    tipo: body.tipo || 'mensual',
    estado: 'enviado_admin',
    movimientos: body.movimientos, // array of {user_id, nombre, cedula, aporte, actividad, credito, ...}
    movimientos_admin: null, // admin-modified version
    cambios_admin: null, // diff
    created_by: session.user.id,
    approved_by: null,
    created_at: new Date(),
    approved_at: null,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/ciclos — admin approves/modifies a cycle
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

  if (body.action === 'aprobar') {
    // Compute changes between original and admin version
    const adminMovimientos = body.movimientos || ciclo.movimientos;
    const cambios: Record<string, unknown>[] = [];

    for (let i = 0; i < adminMovimientos.length; i++) {
      const original = ciclo.movimientos[i];
      const modified = adminMovimientos[i];
      if (!original || !modified) continue;

      const diff: Record<string, { antes: unknown; despues: unknown }> = {};
      for (const key of Object.keys(modified)) {
        if (key === 'user_id' || key === 'nombre' || key === 'cedula') continue;
        if (String(original[key]) !== String(modified[key])) {
          diff[key] = { antes: original[key], despues: modified[key] };
        }
      }

      if (Object.keys(diff).length > 0) {
        cambios.push({ user_id: modified.user_id, nombre: modified.nombre, cambios: diff });
      }
    }

    await db.collection('fondo_ciclos').updateOne(
      { _id: new ObjectId(body.id) },
      {
        $set: {
          estado: 'aprobado',
          movimientos_admin: adminMovimientos,
          cambios_admin: cambios,
          approved_by: session.user.id,
          approved_at: new Date(),
        },
      }
    );

    // Apply the approved movements
    for (const mov of adminMovimientos) {
      // Record aportes if present
      if (mov.aporte && Number(mov.aporte) > 0) {
        const monto = Number(mov.aporte);
        const permanente = Math.round(monto * 0.9 * 100) / 100;
        const social = Math.round(monto * 0.1 * 100) / 100;

        await db.collection('fondo_aportes').insertOne({
          user_id: mov.user_id,
          periodo: ciclo.periodo,
          monto_total: monto,
          monto_permanente: permanente,
          monto_social: social,
          frecuencia: mov.frecuencia || 'mensual',
          fecha_ejecucion: new Date(),
          ciclo_id: body.id,
          created_at: new Date(),
        });

        await db.collection('fondo_members').updateOne(
          { user_id: mov.user_id },
          { $inc: { saldo_permanente: permanente, saldo_social: social } }
        );
      }

      // Record actividad if present
      if (mov.actividad && Number(mov.actividad) !== 0) {
        const monto = Math.abs(Number(mov.actividad));
        const tipo = Number(mov.actividad) >= 0 ? 'aporte' : 'retiro';

        await db.collection('fondo_actividad').insertOne({
          user_id: mov.user_id,
          tipo,
          monto,
          fecha: new Date(),
          periodo: ciclo.periodo,
          ciclo_id: body.id,
          created_at: new Date(),
        });

        const inc = tipo === 'aporte' ? monto : -monto;
        await db.collection('fondo_members').updateOne(
          { user_id: mov.user_id },
          { $inc: { saldo_actividad: inc } }
        );
      }

      // Record credito payment if present
      if (mov.credito_pago && Number(mov.credito_pago) > 0 && mov.cartera_id) {
        const montoTotal = Number(mov.credito_pago);
        const cartera = await db.collection('fondo_cartera').findOne({ _id: new ObjectId(mov.cartera_id) });

        if (cartera) {
          const cuotaEsperada = cartera.numero_cuotas > 0
            ? Math.round(cartera.saldo_total / cartera.cuotas_restantes * 100) / 100
            : 0;

          const pago = {
            numero_cuota: cartera.cuotas_pagadas + 1,
            fecha_pago: new Date(),
            monto_total: montoTotal,
            monto_esperado: cuotaEsperada,
            diferencia: Math.round((montoTotal - cuotaEsperada) * 100) / 100,
            flagged: Math.abs(montoTotal - cuotaEsperada) > 1,
            ciclo_id: body.id,
          };

          const newSaldoTotal = Math.max(0, cartera.saldo_total - montoTotal);
          const estado = newSaldoTotal <= 0 ? 'pagado' : 'activo';

          await db.collection('fondo_cartera').updateOne(
            { _id: new ObjectId(mov.cartera_id) },
            {
              $set: {
                cuotas_pagadas: cartera.cuotas_pagadas + 1,
                cuotas_restantes: Math.max(0, cartera.cuotas_restantes - 1),
                saldo_total: newSaldoTotal,
                saldo_capital: Math.max(0, cartera.saldo_capital - (montoTotal * 0.8)),
                saldo_interes: Math.max(0, cartera.saldo_interes - (montoTotal * 0.2)),
                estado,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              $push: { pagos: pago } as any,
            }
          );
        }
      }
    }

    return NextResponse.json({ success: true, cambios });
  }

  if (body.action === 'rechazar') {
    await db.collection('fondo_ciclos').updateOne(
      { _id: new ObjectId(body.id) },
      { $set: { estado: 'rechazado', approved_by: session.user.id, approved_at: new Date() } }
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
