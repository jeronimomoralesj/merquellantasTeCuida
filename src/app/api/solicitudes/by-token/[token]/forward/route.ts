import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';
import { sendApprovalEmail } from '../../../../../../lib/send-approval-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[a-f0-9]{32,128}$/i;
const APPROVAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface SolicitudDoc {
  _id: ObjectId;
  user_id?: string;
  nombre?: string;
  cedula?: string;
  tipo?: 'permiso' | 'vacaciones' | 'incapacidad';
  fecha?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_vacaciones?: number | null;
  tiempo_inicio?: string | null;
  tiempo_fin?: string | null;
  description?: string | null;
  estado?: string;
  approver_id?: string | null;
  approver_nombre?: string | null;
  approver_email?: string | null;
  approver_cedula?: string | null;
  approval_token?: string;
  approval_token_expires_at?: Date | null;
  approval_token_used_at?: Date | null;
}

/**
 * POST /api/solicitudes/by-token/:token/forward
 *   body: { toApproverId: string, note?: string }
 *
 * Lets the current (mis-designated) approver hand the request off to the right
 * supervisor. Rotates the token so the prior recipient can no longer act on the
 * link, records the full forwarding chain in `approval_forwards`, and sends a
 * fresh approval email to the new approver.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'token inválido' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const toId = body?.toApproverId;
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (!toId || typeof toId !== 'string' || !ObjectId.isValid(toId)) {
    return NextResponse.json({ error: 'toApproverId inválido' }, { status: 400 });
  }

  const db = await getDb();
  const solicitud = (await db
    .collection('solicitudes')
    .findOne({ approval_token: token })) as unknown as SolicitudDoc | null;

  if (!solicitud) return NextResponse.json({ error: 'solicitud no encontrada' }, { status: 404 });

  // Don't let a decided / expired token be forwarded — the employee would have to
  // submit a brand-new request in those cases.
  if (solicitud.approval_token_used_at) {
    return NextResponse.json({ error: 'solicitud ya decidida' }, { status: 409 });
  }
  if (solicitud.estado && solicitud.estado !== 'pendiente') {
    return NextResponse.json({ error: 'solicitud ya decidida' }, { status: 409 });
  }
  if (
    solicitud.approval_token_expires_at &&
    new Date(solicitud.approval_token_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: 'token vencido' }, { status: 410 });
  }

  // Safety: can't forward to the employee who submitted the request.
  if (solicitud.user_id && solicitud.user_id === toId) {
    return NextResponse.json(
      { error: 'No puedes remitir la solicitud al mismo solicitante' },
      { status: 400 },
    );
  }
  // Safety: can't forward to yourself (the current approver). Same request, no change.
  if (solicitud.approver_id && solicitud.approver_id === toId) {
    return NextResponse.json(
      { error: 'Esa persona ya es el jefe asignado a esta solicitud' },
      { status: 400 },
    );
  }

  const newApprover = await db.collection('users').findOne(
    { _id: new ObjectId(toId) },
    { projection: { nombre: 1, email: 1, cedula: 1 } },
  );
  if (!newApprover) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Rotate the token so the current (incorrect) recipient can't also act.
  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS);
  const now = new Date();

  await db.collection('solicitudes').updateOne(
    { _id: solicitud._id },
    {
      $set: {
        approver_id: newApprover._id.toString(),
        approver_nombre: newApprover.nombre ?? '',
        approver_email: newApprover.email ?? null,
        approver_cedula: newApprover.cedula ?? '',
        approval_token: newToken,
        approval_token_expires_at: newExpiresAt,
        approval_token_used_at: null,
        updated_at: now,
      },
      $push: {
        // Audit trail: who bounced this request around and why.
        approval_forwards: {
          at: now,
          from_approver_id: solicitud.approver_id ?? null,
          from_approver_nombre: solicitud.approver_nombre ?? null,
          to_approver_id: newApprover._id.toString(),
          to_approver_nombre: newApprover.nombre ?? '',
          note: note || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    },
  );

  // Send the new approver their own link. Fire-and-forget — the rotation already
  // happened so even if SMTP hiccups, the admin can reissue manually later.
  if (newApprover.email) {
    const origin =
      req.headers.get('origin') ||
      req.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
      process.env.NEXTAUTH_URL ||
      '';
    const baseUrl = origin.replace(/\/$/, '');
    const approvalUrl = `${baseUrl}/aprobar-solicitud/${newToken}`;

    const tipo = (solicitud.tipo ?? 'permiso') as 'permiso' | 'vacaciones' | 'incapacidad';

    sendApprovalEmail({
      jefeEmail: newApprover.email,
      jefeNombre: newApprover.nombre ?? '',
      employeeNombre: solicitud.nombre ?? 'Empleado',
      tipo,
      fechaInicio: solicitud.fecha_inicio ?? null,
      fechaFin: solicitud.fecha_fin ?? null,
      fecha: solicitud.fecha ?? null,
      tiempoInicio: solicitud.tiempo_inicio ?? null,
      tiempoFin: solicitud.tiempo_fin ?? null,
      diasVacaciones: solicitud.dias_vacaciones ?? null,
      description: solicitud.description ?? null,
      approvalUrl,
    }).catch((err) => {
      console.error('Forwarded approval email failed:', err);
    });
  }

  return NextResponse.json({
    success: true,
    new_approver_nombre: newApprover.nombre ?? '',
  });
}
