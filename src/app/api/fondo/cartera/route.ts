import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

function getInterestRate(numCuotas: number, frecuencia: string): number {
  // Convert quincenal cuotas to equivalent months for the rate brackets
  const cuotasComoMeses = frecuencia === 'quincenal' ? numCuotas / 2 : numCuotas;
  if (cuotasComoMeses <= 12) return 1.0;
  if (cuotasComoMeses <= 24) return 1.2;
  return 1.3;
}

// GET /api/fondo/cartera?user_id=X&estado=pendiente
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const creditoId = searchParams.get('credito_id');
  const estado = searchParams.get('estado');

  const filter: Record<string, unknown> = {};
  if (session.user.rol === 'user' || session.user.rol === 'admin') {
    if (!userId) {
      filter.user_id = session.user.id;
    } else {
      filter.user_id = userId;
    }
  } else if (userId) {
    // fondo: filter by user_id if provided, otherwise return all
    filter.user_id = userId;
  }
  if (creditoId) filter.credito_id = creditoId;
  if (estado) filter.estado = estado;

  const results = await db.collection('fondo_cartera')
    .find(filter).sort({ created_at: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/cartera — create or request a loan
// - user/admin without admin powers: creates a request (estado='pendiente')
// - fondo: creates an active loan immediately
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const valorPrestamo = Number(body.valor_prestamo || 0);
  const numCuotas = Number(body.numero_cuotas || 0);
  const frecuenciaPago = body.frecuencia_pago === 'quincenal' ? 'quincenal' : 'mensual';

  if (!valorPrestamo || valorPrestamo <= 0) {
    return NextResponse.json({ error: 'Valor del préstamo inválido' }, { status: 400 });
  }
  if (!numCuotas || numCuotas <= 0 || numCuotas > 120) {
    return NextResponse.json({ error: 'Número de cuotas inválido (1-120)' }, { status: 400 });
  }

  const tasaMensual = getInterestRate(numCuotas, frecuenciaPago);
  // For quincenal, half of monthly rate per period; for mensual, full rate per period
  const tasaPorPeriodo = frecuenciaPago === 'quincenal' ? tasaMensual / 2 : tasaMensual;
  const totalInteres = Math.round(valorPrestamo * (tasaPorPeriodo / 100) * numCuotas * 100) / 100;

  const isFondo = session.user.rol === 'fondo';
  const targetUserId = isFondo && body.user_id ? body.user_id : session.user.id;

  const db = await getDb();

  const creditoIdAuto = isFondo
    ? (body.credito_id || `CR-${Date.now().toString().slice(-8)}`)
    : null;

  const fechaCuota1 = body.fecha_cuota_1 ? new Date(body.fecha_cuota_1) : new Date();
  const fechaTermina = new Date(fechaCuota1);
  // Increment by days based on frecuencia
  const daysPerCuota = frecuenciaPago === 'quincenal' ? 15 : 30;
  fechaTermina.setDate(fechaTermina.getDate() + daysPerCuota * numCuotas);

  const doc = {
    user_id: targetUserId,
    credito_id: creditoIdAuto,
    tasa_interes: tasaMensual,
    frecuencia_pago: frecuenciaPago,
    fecha_solicitud: new Date(),
    fecha_desembolso: isFondo ? (body.fecha_desembolso ? new Date(body.fecha_desembolso) : new Date()) : null,
    fecha_cuota_1: isFondo ? fechaCuota1 : null,
    fecha_termina: isFondo ? fechaTermina : null,
    valor_prestamo: valorPrestamo,
    numero_cuotas: numCuotas,
    cuotas_pagadas: 0,
    cuotas_restantes: numCuotas,
    saldo_capital: valorPrestamo,
    saldo_interes: totalInteres,
    saldo_total: valorPrestamo + totalInteres,
    estado: isFondo ? 'activo' : 'pendiente',
    motivo_solicitud: body.motivo_solicitud || null,
    motivo_respuesta: null,
    pagos: [],
    created_by: session.user.id,
    created_at: new Date(),
  };

  const result = await db.collection('fondo_cartera').insertOne(doc);

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/cartera — multiple actions:
//   action='pago' → record a payment (fondo only)
//   action='aprobar' → approve a pending request (fondo only)
//   action='rechazar' → reject a pending request (fondo only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action || 'pago';

  if (!body.cartera_id || !ObjectId.isValid(body.cartera_id)) {
    return NextResponse.json({ error: 'cartera_id requerido' }, { status: 400 });
  }

  const db = await getDb();
  const cartera = await db.collection('fondo_cartera').findOne({ _id: new ObjectId(body.cartera_id) });
  if (!cartera) return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });

  // ----- APROBAR a pending request -----
  if (action === 'aprobar') {
    if (cartera.estado !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden aprobar solicitudes pendientes' }, { status: 400 });
    }

    const fechaCuota1 = body.fecha_cuota_1 ? new Date(body.fecha_cuota_1) : new Date();
    const fechaTermina = new Date(fechaCuota1);
    const daysPerCuota = cartera.frecuencia_pago === 'quincenal' ? 15 : 30;
    fechaTermina.setDate(fechaTermina.getDate() + daysPerCuota * cartera.numero_cuotas);
    const creditoId = body.credito_id || `CR-${Date.now().toString().slice(-8)}`;

    await db.collection('fondo_cartera').updateOne(
      { _id: new ObjectId(body.cartera_id) },
      {
        $set: {
          estado: 'activo',
          credito_id: creditoId,
          fecha_desembolso: new Date(),
          fecha_cuota_1: fechaCuota1,
          fecha_termina: fechaTermina,
          aprobado_por: session.user.id,
          aprobado_at: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  }

  // ----- RECHAZAR a pending request -----
  if (action === 'rechazar') {
    await db.collection('fondo_cartera').updateOne(
      { _id: new ObjectId(body.cartera_id) },
      {
        $set: {
          estado: 'rechazado',
          motivo_respuesta: body.motivo_respuesta || null,
          aprobado_por: session.user.id,
          aprobado_at: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  }

  // ----- PAGO (default) -----
  if (cartera.estado !== 'activo') {
    return NextResponse.json({ error: 'Solo se pueden pagar créditos activos' }, { status: 400 });
  }

  if (!body.monto_total) {
    return NextResponse.json({ error: 'monto_total requerido' }, { status: 400 });
  }

  const montoTotal = Number(body.monto_total);
  const montoCapital = Number(body.monto_capital || 0);
  const montoInteres = Number(body.monto_interes || 0);

  const cuotaEsperada = cartera.numero_cuotas > 0
    ? Math.round((cartera.valor_prestamo + cartera.saldo_interes) / cartera.numero_cuotas * 100) / 100
    : 0;

  const pago = {
    numero_cuota: cartera.cuotas_pagadas + 1,
    fecha_pago: body.fecha_pago ? new Date(body.fecha_pago) : new Date(),
    monto_capital: montoCapital,
    monto_interes: montoInteres,
    monto_total: montoTotal,
    monto_esperado: cuotaEsperada,
    diferencia: Math.round((montoTotal - cuotaEsperada) * 100) / 100,
    flagged: Math.abs(montoTotal - cuotaEsperada) > 1,
  };

  const newSaldoCapital = Math.max(0, cartera.saldo_capital - montoCapital);
  const newSaldoInteres = Math.max(0, cartera.saldo_interes - montoInteres);
  const newCuotasPagadas = cartera.cuotas_pagadas + 1;
  const newCuotasRestantes = Math.max(0, cartera.cuotas_restantes - 1);

  const newFechaTermina = new Date(cartera.fecha_cuota_1);
  newFechaTermina.setMonth(newFechaTermina.getMonth() + newCuotasPagadas + newCuotasRestantes);

  const estado = newSaldoCapital <= 0 ? 'pagado' : 'activo';

  await db.collection('fondo_cartera').updateOne(
    { _id: new ObjectId(body.cartera_id) },
    {
      $set: {
        cuotas_pagadas: newCuotasPagadas,
        cuotas_restantes: newCuotasRestantes,
        saldo_capital: newSaldoCapital,
        saldo_interes: newSaldoInteres,
        saldo_total: newSaldoCapital + newSaldoInteres,
        fecha_termina: newFechaTermina,
        estado,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $push: { pagos: pago } as any,
    }
  );

  return NextResponse.json({ success: true, pago });
}
