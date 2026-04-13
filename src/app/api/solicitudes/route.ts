import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/solicitudes — list solicitudes
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo');

  const filter: Record<string, unknown> = {};

  if (session.user.rol !== 'admin') {
    filter.user_id = session.user.id;
  }

  if (tipo) {
    filter.tipo = tipo;
  }

  const results = await db.collection('solicitudes').find(filter).sort({ created_at: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/solicitudes — create solicitud
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();

  // Validate tipo
  const validTipos = ['vacaciones', 'incapacidad', 'permiso'];
  if (!body.tipo || !validTipos.includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo de solicitud inválido' }, { status: 400 });
  }

  const db = await getDb();

  const result = await db.collection('solicitudes').insertOne({
    user_id: session.user.id,
    nombre: session.user.nombre,
    cedula: session.user.cedula,
    tipo: body.tipo,
    estado: 'pendiente',
    description: body.description || null,
    fecha_inicio: body.fechaInicio || null,
    fecha_fin: body.fechaFin || null,
    dias_vacaciones: body.diasVacaciones || null,
    fecha: body.fecha || null,
    tiempo_inicio: body.tiempoInicio || null,
    tiempo_fin: body.tiempoFin || null,
    edad: body.edad || null,
    gender: body.gender || null,
    tipo_contrato: body.tipoContrato || null,
    ubicacion: body.ubicacion || null,
    cargo: body.cargo || null,
    tipo_evento: body.tipoEvento || null,
    cie10: body.cie10 || null,
    codigo_incap: body.codigoIncap || null,
    mes_diagnostico: body.mesDiagnostico || null,
    start_date: body.startDate || null,
    end_date: body.endDate || null,
    num_dias: body.numDias || null,
    document_url: body.documentUrl || null,
    document_name: body.documentName || null,
    document_urls: Array.isArray(body.documentUrls) ? body.documentUrls : (body.documentUrl ? [{ url: body.documentUrl, name: body.documentName }] : []),
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/solicitudes — update status (admin)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id, estado, motivoRespuesta } = await req.json();

  // Validate estado
  const validEstados = ['pendiente', 'aprobado', 'rechazado'];
  if (!estado || !validEstados.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: 'ID de solicitud requerido' }, { status: 400 });
  }

  const db = await getDb();
  await db.collection('solicitudes').updateOne(
    { _id: new ObjectId(id) },
    { $set: { estado, motivo_respuesta: motivoRespuesta || null, updated_at: new Date() } }
  );

  return NextResponse.json({ success: true });
}
