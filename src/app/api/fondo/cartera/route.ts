import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

function getInterestRate(numCuotas: number): number {
  if (numCuotas <= 12) return 1.0;
  if (numCuotas <= 24) return 1.2;
  return 1.3;
}

// GET /api/fondo/cartera?user_id=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  const creditoId = searchParams.get('credito_id');

  const filter: Record<string, unknown> = {};
  if (session.user.rol === 'user') {
    filter.user_id = session.user.id;
  } else if (userId) {
    filter.user_id = userId;
  }
  if (creditoId) filter.credito_id = creditoId;

  const results = await db.collection('fondo_cartera')
    .find(filter).sort({ fecha_desembolso: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/cartera — create a new loan (fondo/admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.user_id || !body.credito_id || !body.valor_prestamo || !body.numero_cuotas) {
    return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
  }

  const numCuotas = Number(body.numero_cuotas);
  const valorPrestamo = Number(body.valor_prestamo);
  const tasaInteres = getInterestRate(numCuotas);

  // Calculate total interest
  const totalInteres = Math.round(valorPrestamo * (tasaInteres / 100) * numCuotas * 100) / 100;

  const fechaDesembolso = body.fecha_desembolso ? new Date(body.fecha_desembolso) : new Date();
  const fechaCuota1 = body.fecha_cuota_1 ? new Date(body.fecha_cuota_1) : new Date();

  // Calculate fecha_termina based on cuotas
  const fechaTermina = new Date(fechaCuota1);
  fechaTermina.setMonth(fechaTermina.getMonth() + numCuotas);

  const db = await getDb();

  const result = await db.collection('fondo_cartera').insertOne({
    user_id: body.user_id,
    credito_id: body.credito_id,
    tasa_interes: tasaInteres,
    fecha_desembolso: fechaDesembolso,
    fecha_cuota_1: fechaCuota1,
    fecha_termina: fechaTermina,
    valor_prestamo: valorPrestamo,
    numero_cuotas: numCuotas,
    cuotas_pagadas: 0,
    cuotas_restantes: numCuotas,
    saldo_capital: valorPrestamo,
    saldo_interes: totalInteres,
    saldo_total: valorPrestamo + totalInteres,
    estado: 'activo',
    pagos: [],
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/cartera — record a payment on a loan
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.cartera_id || !body.monto_total) {
    return NextResponse.json({ error: 'cartera_id y monto_total requeridos' }, { status: 400 });
  }

  const db = await getDb();
  const cartera = await db.collection('fondo_cartera').findOne({ _id: new ObjectId(body.cartera_id) });
  if (!cartera) return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });

  const montoTotal = Number(body.monto_total);
  const montoCapital = Number(body.monto_capital || 0);
  const montoInteres = Number(body.monto_interes || 0);

  // Calculate expected payment per cuota
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
    flagged: Math.abs(montoTotal - cuotaEsperada) > 1, // flag if differs by more than $1
  };

  const newSaldoCapital = Math.max(0, cartera.saldo_capital - montoCapital);
  const newSaldoInteres = Math.max(0, cartera.saldo_interes - montoInteres);
  const newCuotasPagadas = cartera.cuotas_pagadas + 1;
  const newCuotasRestantes = Math.max(0, cartera.cuotas_restantes - 1);

  // Recalculate fecha_termina based on remaining cuotas
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
