import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/saldos?user_id=X — get user balances and full history
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get('user_id');

  // Regular users can only see their own data — ignore any user_id param
  // Admin/fondo can pass a user_id to look up another user
  // If no user_id is provided, default to the logged-in user's own data
  let userId: string;
  if (session.user.rol === 'user') {
    userId = session.user.id;
  } else {
    userId = requestedUserId || session.user.id;
  }

  const [member, aportes, actividad, cartera, retiros] = await Promise.all([
    db.collection('fondo_members').findOne({ user_id: userId }),
    db.collection('fondo_aportes').find({ user_id: userId }).sort({ fecha_ejecucion: -1 }).toArray(),
    db.collection('fondo_actividad').find({ user_id: userId }).sort({ fecha: -1 }).toArray(),
    db.collection('fondo_cartera').find({ user_id: userId }).sort({ created_at: -1 }).toArray(),
    db.collection('fondo_retiros').find({ user_id: userId }).sort({ fecha_solicitud: -1 }).toArray(),
  ]);

  // Calculate retirement eligibility (3 years)
  let retiroElegible = false;
  let anosAfiliacion = 0;
  if (member?.fecha_afiliacion) {
    const now = new Date();
    const afiliacion = new Date(member.fecha_afiliacion);
    anosAfiliacion = Math.floor((now.getTime() - afiliacion.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    retiroElegible = anosAfiliacion >= 3;
  }

  // Calculate max retirement amount (30% of total aportes per year)
  const totalAportes = (member?.saldo_permanente || 0) + (member?.saldo_social || 0);
  const maxRetiroAnual = retiroElegible ? Math.round(totalAportes * 0.3 * 100) / 100 : 0;

  // Check if November for interest alert
  const isNovember = new Date().getMonth() === 10;

  return NextResponse.json({
    member,
    saldos: {
      permanente: member?.saldo_permanente || 0,
      social: member?.saldo_social || 0,
      actividad: member?.saldo_actividad || 0,
      intereses: member?.saldo_intereses || 0,
      total_aportes: totalAportes,
    },
    retiro: {
      elegible: retiroElegible,
      anos_afiliacion: anosAfiliacion,
      max_retiro_anual: maxRetiroAnual,
    },
    interest_alert: isNovember,
    aportes,
    actividad,
    cartera,
    retiros,
  });
}

// PUT /api/fondo/saldos — update member balances (fondo only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const userId = body.user_id;
  if (!userId) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });

  const db = await getDb();
  const update: Record<string, unknown> = {};

  if (body.saldo_permanente !== undefined) update.saldo_permanente = Number(body.saldo_permanente);
  if (body.saldo_social !== undefined) update.saldo_social = Number(body.saldo_social);
  if (body.saldo_actividad !== undefined) update.saldo_actividad = Number(body.saldo_actividad);
  if (body.saldo_intereses !== undefined) update.saldo_intereses = Number(body.saldo_intereses);
  if (body.monto_aporte !== undefined) update.monto_aporte = Number(body.monto_aporte);
  if (body.frecuencia !== undefined) update.frecuencia = body.frecuencia;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  await db.collection('fondo_members').updateOne(
    { user_id: userId },
    { $set: update }
  );

  return NextResponse.json({ success: true });
}
