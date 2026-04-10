import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/cesantias
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();

  const filter: Record<string, unknown> = {};
  if (session.user.rol !== 'admin') {
    filter.user_id = session.user.id;
  }

  const results = await db.collection('cesantias').find(filter).sort({ created_at: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/cesantias
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const db = await getDb();

  const result = await db.collection('cesantias').insertOne({
    user_id: session.user.id,
    nombre: body.nombre || session.user.nombre,
    cedula: body.cedula || session.user.cedula,
    motivo_solicitud: body.motivoSolicitud,
    categoria: body.categoria,
    file_url: body.fileUrl || null,
    estado: 'pendiente',
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/cesantias — update status (admin)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id, estado, motivoRespuesta } = await req.json();

  const validEstados = ['pendiente', 'aprobado', 'rechazado'];
  if (!estado || !validEstados.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }

  const db = await getDb();

  await db.collection('cesantias').updateOne(
    { _id: new ObjectId(id) },
    { $set: { estado, motivo_respuesta: motivoRespuesta || null, updated_at: new Date() } }
  );

  return NextResponse.json({ success: true });
}
