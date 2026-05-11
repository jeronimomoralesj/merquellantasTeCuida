import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[a-f0-9]{32,128}$/i;

interface SolicitudLite {
  _id: { toString(): string };
  user_id?: string | null;
  nombre?: string | null;
  tipo?: string | null;
  estado?: string | null;
  fecha?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  tiempo_inicio?: string | null;
  tiempo_fin?: string | null;
  approver_id?: string | null;
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/solicitudes/by-token/:token/team-calendar
 *
 * Token-gated read that returns vacaciones + permisos for everyone sharing the
 * same approver_id as the current solicitud — i.e. the rest of this jefe's
 * team. Powers the calendar on the approval page so the jefe can see overlap
 * before approving. Window: 3 months back, 6 months forward.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'token inválido' }, { status: 404 });
  }

  const db = await getDb();
  const current = await db.collection('solicitudes').findOne(
    { approval_token: token },
    {
      projection: {
        approval_token_expires_at: 1,
        approver_id: 1,
      },
    },
  );
  if (!current) return NextResponse.json({ error: 'token inválido' }, { status: 404 });
  if (isExpired(current.approval_token_expires_at)) {
    return NextResponse.json({ error: 'token vencido' }, { status: 410 });
  }
  if (!current.approver_id) {
    return NextResponse.json({ items: [] });
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 7, 0);
  const fromStr = ymd(from);
  const toStr = ymd(to);

  // Match any solicitud where some date field falls in the window. fecha
  // (permisos) is a single day; vacaciones is fecha_inicio..fecha_fin. A
  // permissive range filter on either keeps the query simple and indexed.
  const docs = (await db
    .collection('solicitudes')
    .find(
      {
        approver_id: current.approver_id,
        tipo: { $in: ['vacaciones', 'permiso'] },
        estado: { $in: ['aprobado', 'pendiente'] },
        $or: [
          { fecha: { $gte: fromStr, $lte: toStr } },
          { fecha_inicio: { $lte: toStr }, fecha_fin: { $gte: fromStr } },
        ],
      },
      {
        projection: {
          user_id: 1,
          nombre: 1,
          tipo: 1,
          estado: 1,
          fecha: 1,
          fecha_inicio: 1,
          fecha_fin: 1,
          tiempo_inicio: 1,
          tiempo_fin: 1,
        },
      },
    )
    .sort({ fecha_inicio: 1, fecha: 1 })
    .limit(500)
    .toArray()) as unknown as SolicitudLite[];

  return NextResponse.json({
    items: docs.map((d) => ({
      id: d._id.toString(),
      user_id: d.user_id ?? null,
      nombre: d.nombre ?? '',
      tipo: d.tipo ?? '',
      estado: d.estado ?? '',
      fecha: d.fecha ?? null,
      fecha_inicio: d.fecha_inicio ?? null,
      fecha_fin: d.fecha_fin ?? null,
      tiempo_inicio: d.tiempo_inicio ?? null,
      tiempo_fin: d.tiempo_fin ?? null,
    })),
  });
}
