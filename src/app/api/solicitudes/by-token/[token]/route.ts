import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[a-f0-9]{32,128}$/i;

interface SolicitudDoc {
  _id: { toString(): string };
  tipo?: string;
  nombre?: string;
  cedula?: string;
  estado?: string;
  description?: string | null;
  fecha?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_vacaciones?: number | null;
  tiempo_inicio?: string | null;
  tiempo_fin?: string | null;
  document_url?: string | null;
  document_name?: string | null;
  document_urls?: { url: string; name: string }[];
  approver_id?: string | null;
  approver_nombre?: string | null;
  approver_email?: string | null;
  approval_token_expires_at?: Date | null;
  approval_token_used_at?: Date | null;
  approval_decided_by?: string | null;
  motivo_respuesta?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * GET /api/solicitudes/by-token/:token
 *
 * Token-gated read. No session required — the token is the credential. Returns the
 * solicitud details the jefe needs to decide, plus a `status` flag that's one of:
 *   - `ready`    → not yet decided, token valid
 *   - `decided`  → already approved/rejected (token was one-shot)
 *   - `expired`  → token past its expiration date
 *   - `not_found`→ no solicitud matches this token
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }

  const db = await getDb();
  const doc = (await db
    .collection('solicitudes')
    .findOne({ approval_token: token })) as SolicitudDoc | null;

  if (!doc) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }
  if (isExpired(doc.approval_token_expires_at)) {
    return NextResponse.json({ status: 'expired' }, { status: 410 });
  }
  const alreadyDecided = !!doc.approval_token_used_at || (doc.estado && doc.estado !== 'pendiente');

  return NextResponse.json({
    status: alreadyDecided ? 'decided' : 'ready',
    solicitud: {
      id: doc._id.toString(),
      tipo: doc.tipo,
      nombre: doc.nombre,
      cedula: doc.cedula,
      estado: doc.estado,
      description: doc.description ?? null,
      fecha: doc.fecha ?? null,
      fecha_inicio: doc.fecha_inicio ?? null,
      fecha_fin: doc.fecha_fin ?? null,
      dias_vacaciones: doc.dias_vacaciones ?? null,
      tiempo_inicio: doc.tiempo_inicio ?? null,
      tiempo_fin: doc.tiempo_fin ?? null,
      document_url: doc.document_url ?? null,
      document_name: doc.document_name ?? null,
      document_urls: Array.isArray(doc.document_urls) ? doc.document_urls : [],
      approver_nombre: doc.approver_nombre ?? null,
      motivo_respuesta: doc.motivo_respuesta ?? null,
      created_at: doc.created_at ?? null,
      updated_at: doc.updated_at ?? null,
    },
  });
}

/**
 * PUT /api/solicitudes/by-token/:token
 *   body: { estado: 'aprobado' | 'rechazado', motivoRespuesta?: string }
 *
 * One-shot decision endpoint. Sets estado + motivo_respuesta, stamps
 * approval_token_used_at so the token can't be reused, and mirrors the
 * vacation-balance adjustment logic from the admin PUT so approvals made via
 * email stay consistent with approvals made from the admin UI.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const estado = body?.estado;
  const motivoRespuesta = typeof body?.motivoRespuesta === 'string' ? body.motivoRespuesta.slice(0, 1000) : null;
  if (estado !== 'aprobado' && estado !== 'rechazado') {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const db = await getDb();
  const doc = (await db
    .collection('solicitudes')
    .findOne({ approval_token: token })) as SolicitudDoc | null;

  if (!doc) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  if (isExpired(doc.approval_token_expires_at)) {
    return NextResponse.json({ error: 'El enlace ha expirado' }, { status: 410 });
  }
  if (doc.approval_token_used_at || (doc.estado && doc.estado !== 'pendiente')) {
    return NextResponse.json({ error: 'Esta solicitud ya fue decidida' }, { status: 409 });
  }

  const now = new Date();
  const approverName = doc.approver_nombre ?? 'Jefe inmediato';

  await db.collection('solicitudes').updateOne(
    { _id: doc._id as unknown as import('mongodb').ObjectId },
    {
      $set: {
        estado,
        motivo_respuesta: motivoRespuesta,
        approval_token_used_at: now,
        approval_decided_by: approverName,
        updated_at: now,
      },
    },
  );

  // Mirror admin PUT's vacation-balance side effect (approved → debit, else no-op).
  if (doc.tipo === 'vacaciones' && doc.cedula) {
    const dias = Number(doc.dias_vacaciones);
    if (Number.isFinite(dias) && dias > 0 && estado === 'aprobado') {
      await db.collection('vacation_balances').updateOne(
        { cedula: String(doc.cedula) },
        {
          $inc: { days: -dias },
          $set: { last_adjusted_at: now },
          $push: {
            adjustments: {
              solicitud_id: doc._id.toString(),
              delta: -dias,
              reason: 'vacaciones-aprobada-por-jefe',
              at: now,
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
      );
    }
  }

  return NextResponse.json({ success: true, estado });
}
