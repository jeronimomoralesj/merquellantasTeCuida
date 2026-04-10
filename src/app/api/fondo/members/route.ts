import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/members — list all fondo members (fondo/admin) or own membership (user)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();

  if (session.user.rol === 'fondo' || session.user.rol === 'admin') {
    const members = await db.collection('fondo_members').aggregate([
      {
        $lookup: {
          from: 'users',
          let: { uid: '$user_id' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$uid'] } } },
            { $project: { nombre: 1, cedula: 1, email: 1, cargo_empleado: 1, departamento: 1 } },
          ],
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { 'user.nombre': 1 } },
    ]).toArray();
    return NextResponse.json(members);
  }

  // Regular user: own membership only
  const member = await db.collection('fondo_members').findOne({ user_id: session.user.id });
  return NextResponse.json(member || null);
}

// POST /api/fondo/members — enroll user in fondo (fondo/admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.user_id || !body.monto_aporte) {
    return NextResponse.json({ error: 'user_id y monto_aporte requeridos' }, { status: 400 });
  }

  const validFrecuencias = ['quincenal', 'mensual'];
  const frecuencia = validFrecuencias.includes(body.frecuencia) ? body.frecuencia : 'mensual';

  const db = await getDb();

  // Check if already enrolled
  const existing = await db.collection('fondo_members').findOne({ user_id: body.user_id });
  if (existing) {
    return NextResponse.json({ error: 'Usuario ya está afiliado al fondo' }, { status: 400 });
  }

  const result = await db.collection('fondo_members').insertOne({
    user_id: body.user_id,
    fecha_afiliacion: new Date(),
    activo: true,
    frecuencia,
    monto_aporte: Number(body.monto_aporte),
    saldo_permanente: 0,
    saldo_social: 0,
    saldo_actividad: 0,
    saldo_intereses: 0,
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/fondo/members — update member settings
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'fondo' && session.user.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.monto_aporte !== undefined) update.monto_aporte = Number(body.monto_aporte);
  if (body.frecuencia) update.frecuencia = body.frecuencia;
  if (body.activo !== undefined) update.activo = !!body.activo;

  const db = await getDb();
  await db.collection('fondo_members').updateOne(
    { _id: new ObjectId(body.id) },
    { $set: update }
  );

  return NextResponse.json({ success: true });
}
