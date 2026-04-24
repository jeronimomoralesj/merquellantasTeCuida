import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';
import { sendApprovalEmail } from '../../../lib/send-approval-email';
import { countVacationDays } from '../../../lib/colombia-holidays';

// 30 days of validity for the approval link — long enough that the jefe can handle
// the request at their own pace but short enough that stale tokens get garbage-collected.
const APPROVAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

  // --- Resolve jefe inmediato for permisos + vacaciones ------------------
  // The form passes `approverId` (a users._id string). We look up the user and, if
  // found, generate a single-use token the supervisor will click from the email.
  let approver: {
    id: string;
    nombre: string;
    email: string | null;
    cedula: string;
  } | null = null;
  let approvalToken: string | null = null;
  let approvalTokenExpiresAt: Date | null = null;

  const needsApprover = body.tipo === 'permiso' || body.tipo === 'vacaciones';
  if (needsApprover && typeof body.approverId === 'string' && ObjectId.isValid(body.approverId)) {
    const jefe = await db.collection('users').findOne(
      { _id: new ObjectId(body.approverId) },
      { projection: { nombre: 1, email: 1, cedula: 1 } },
    );
    if (jefe) {
      approver = {
        id: jefe._id.toString(),
        nombre: jefe.nombre ?? '',
        email: jefe.email ?? null,
        cedula: jefe.cedula ?? '',
      };
      approvalToken = crypto.randomBytes(32).toString('hex');
      approvalTokenExpiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);
    }
  }
  if (needsApprover && !approver) {
    return NextResponse.json(
      { error: 'Debe seleccionar un jefe inmediato para esta solicitud' },
      { status: 400 },
    );
  }

  // Recalculate dias_vacaciones server-side so the stored value always
  // matches our count logic (excluye domingos y festivos), incluso si el
  // cliente está usando una versión vieja que mandaba los días corridos.
  const computedDias =
    body.tipo === 'vacaciones' && body.fechaInicio && body.fechaFin
      ? countVacationDays(String(body.fechaInicio), String(body.fechaFin))
      : null;

  const result = await db.collection('solicitudes').insertOne({
    user_id: session.user.id,
    nombre: session.user.nombre,
    cedula: session.user.cedula,
    tipo: body.tipo,
    estado: 'pendiente',
    description: body.description || null,
    fecha_inicio: body.fechaInicio || null,
    fecha_fin: body.fechaFin || null,
    dias_vacaciones: computedDias ?? body.diasVacaciones ?? null,
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
    document_urls: Array.isArray(body.documentUrls)
      ? body.documentUrls
      : body.documentUrl
      ? [{ url: body.documentUrl, name: body.documentName }]
      : [],
    // Supervisor-approval fields (null for incapacidad).
    approver_id: approver?.id ?? null,
    approver_nombre: approver?.nombre ?? null,
    approver_email: approver?.email ?? null,
    approver_cedula: approver?.cedula ?? null,
    approval_token: approvalToken,
    approval_token_expires_at: approvalTokenExpiresAt,
    approval_token_used_at: null,
    approval_decided_by: null,
    created_at: new Date(),
  });

  // Send the email asynchronously if we have an approver.
  if (approver && approvalToken && approver.email) {
    const origin =
      req.headers.get('origin') ||
      req.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
      process.env.NEXTAUTH_URL ||
      '';
    const baseUrl = origin.replace(/\/$/, '');
    const approvalUrl = `${baseUrl}/aprobar-solicitud/${approvalToken}`;

    // We intentionally don't await — the solicitud create should succeed even if
    // mailgun hiccups. The approver email lives on the doc so an admin can retry.
    sendApprovalEmail({
      jefeEmail: approver.email,
      jefeNombre: approver.nombre,
      employeeNombre: session.user.nombre || 'Empleado',
      tipo: body.tipo,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin,
      fecha: body.fecha,
      tiempoInicio: body.tiempoInicio,
      tiempoFin: body.tiempoFin,
      diasVacaciones: body.diasVacaciones,
      description: body.description,
      approvalUrl,
    }).catch((err) => {
      console.error('Approval email send failed:', err);
    });
  }

  return NextResponse.json({
    success: true,
    id: result.insertedId.toString(),
    approver_nombre: approver?.nombre ?? null,
  });
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
  const solicitud = await db.collection('solicitudes').findOne({ _id: new ObjectId(id) });
  if (!solicitud) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }

  await db.collection('solicitudes').updateOne(
    { _id: new ObjectId(id) },
    { $set: { estado, motivo_respuesta: motivoRespuesta || null, updated_at: new Date() } }
  );

  // Real-time vacation balance adjustment: decrement on new approval, restore
  // on new rejection if we previously debited this solicitud.
  if (solicitud.tipo === 'vacaciones' && solicitud.cedula) {
    const dias = Number(solicitud.dias_vacaciones);
    const prevEstado = solicitud.estado;
    const cedula = String(solicitud.cedula);
    const wasCharged = prevEstado === 'aprobado';
    const isCharged = estado === 'aprobado';

    if (Number.isFinite(dias) && dias > 0 && wasCharged !== isCharged) {
      const delta = isCharged ? -dias : dias;
      await db.collection('vacation_balances').updateOne(
        { cedula },
        {
          $inc: { days: delta },
          $set: { last_adjusted_at: new Date() },
          $push: {
            adjustments: {
              solicitud_id: id,
              delta,
              reason: isCharged ? 'vacaciones-aprobada' : 'vacaciones-rechazada',
              at: new Date(),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        }
      );
    }
  }

  return NextResponse.json({ success: true });
}
