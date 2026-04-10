import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/retiros?estado=pendiente&user_id=X
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado');
  const userId = searchParams.get('user_id');

  const filter: Record<string, unknown> = {};
  if (session.user.rol === 'user' || session.user.rol === 'admin') {
    if (!userId) {
      filter.user_id = session.user.id;
    } else {
      filter.user_id = userId;
    }
  } else if (userId) {
    filter.user_id = userId;
  }
  if (estado) filter.estado = estado;

  const results = await db.collection('fondo_retiros')
    .find(filter).sort({ fecha_solicitud: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/fondo/retiros — request a withdrawal (any user with eligibility)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const monto = Number(body.monto || 0);
  if (!monto || monto <= 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }

  const db = await getDb();
  const member = await db.collection('fondo_members').findOne({ user_id: session.user.id });
  if (!member) {
    return NextResponse.json({ error: 'No estás afiliado al fondo' }, { status: 400 });
  }

  // Eligibility: must be affiliated for at least 3 years
  const fechaAfiliacion = member.fecha_afiliacion ? new Date(member.fecha_afiliacion) : null;
  if (!fechaAfiliacion) {
    return NextResponse.json({ error: 'Sin fecha de afiliación registrada' }, { status: 400 });
  }
  const anos = (Date.now() - fechaAfiliacion.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (anos < 3) {
    return NextResponse.json({ error: 'Debes estar afiliado al menos 3 años para solicitar un retiro' }, { status: 400 });
  }

  // Max retiro = 30% of total aportes per year
  const totalAportes = (member.saldo_permanente || 0) + (member.saldo_social || 0);
  const maxRetiro = Math.round(totalAportes * 0.3 * 100) / 100;
  if (monto > maxRetiro) {
    return NextResponse.json({
      error: `El monto solicitado excede el máximo permitido (${maxRetiro.toLocaleString('es-CO')} COP)`,
    }, { status: 400 });
  }

  // Check if user already has a pending retiro
  const existing = await db.collection('fondo_retiros').findOne({
    user_id: session.user.id,
    estado: 'pendiente',
  });
  if (existing) {
    return NextResponse.json({ error: 'Ya tienes una solicitud de retiro pendiente' }, { status: 400 });
  }

  const result = await db.collection('fondo_retiros').insertOne({
    user_id: session.user.id,
    nombre: session.user.nombre,
    cedula: session.user.cedula,
    monto,
    motivo: body.motivo || null,
    estado: 'pendiente',
    saldo_anterior: totalAportes,
    fecha_solicitud: new Date(),
    aprobado_por: null,
    aprobado_at: null,
    motivo_respuesta: null,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/retiros — approve or reject (fondo only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'fondo') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id, action, motivo_respuesta } = await req.json();
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  if (action !== 'aprobar' && action !== 'rechazar') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  const db = await getDb();
  const retiro = await db.collection('fondo_retiros').findOne({ _id: new ObjectId(id) });
  if (!retiro) return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 });
  if (retiro.estado !== 'pendiente') {
    return NextResponse.json({ error: 'Solo se pueden procesar retiros pendientes' }, { status: 400 });
  }

  if (action === 'aprobar') {
    // Deduct from member balances proportionally (90% permanente, 10% social)
    const member = await db.collection('fondo_members').findOne({ user_id: retiro.user_id });
    if (!member) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });

    const monto = Number(retiro.monto);
    const fromPermanente = Math.round(monto * 0.9 * 100) / 100;
    const fromSocial = Math.round(monto * 0.1 * 100) / 100;

    await db.collection('fondo_members').updateOne(
      { user_id: retiro.user_id },
      {
        $inc: {
          saldo_permanente: -fromPermanente,
          saldo_social: -fromSocial,
        },
      }
    );

    await db.collection('fondo_retiros').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          estado: 'aprobado',
          aprobado_por: session.user.id,
          aprobado_at: new Date(),
          saldo_despues: ((member.saldo_permanente || 0) + (member.saldo_social || 0)) - monto,
        },
      }
    );
  } else {
    await db.collection('fondo_retiros').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          estado: 'rechazado',
          motivo_respuesta: motivo_respuesta || null,
          aprobado_por: session.user.id,
          aprobado_at: new Date(),
        },
      }
    );
  }

  return NextResponse.json({ success: true });
}
