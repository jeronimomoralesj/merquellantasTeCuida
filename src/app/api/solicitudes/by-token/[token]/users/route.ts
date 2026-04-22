import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_PATTERN = /^[a-f0-9]{32,128}$/i;

/**
 * GET /api/solicitudes/by-token/:token/users?q=<query>
 *
 * Token-gated variant of /api/users/search so an external approver (who doesn't
 * have a session cookie for the dashboard) can look up the correct supervisor to
 * forward the approval to. The token is the only credential; we still validate it
 * against a live, unexpired, unused solicitud before returning any user data.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: 'token inválido' }, { status: 404 });
  }

  const db = await getDb();
  const solicitud = await db
    .collection('solicitudes')
    .findOne(
      { approval_token: token },
      {
        projection: {
          approval_token_expires_at: 1,
          approval_token_used_at: 1,
          estado: 1,
          user_id: 1,
          approver_id: 1,
        },
      },
    );
  if (!solicitud) return NextResponse.json({ error: 'token inválido' }, { status: 404 });
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

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 20)));

  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { nombre: { $regex: escaped, $options: 'i' } },
      { first_name: { $regex: escaped, $options: 'i' } },
      { primer_apellido: { $regex: escaped, $options: 'i' } },
      { segundo_apellido: { $regex: escaped, $options: 'i' } },
      { cedula: { $regex: `^${escaped}`, $options: 'i' } },
    ];
  }

  // Can't forward to: the employee who submitted the request, or the current
  // (incorrect) approver themselves — both make no sense.
  const excludedIds = [solicitud.user_id, solicitud.approver_id]
    .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (excludedIds.length > 0) filter._id = { $nin: excludedIds };

  const users = await db
    .collection('users')
    .find(filter, {
      projection: {
        nombre: 1,
        cedula: 1,
        cargo_empleado: 1,
        posicion: 1,
        area: 1,
        departamento: 1,
      },
    })
    .sort({ nombre: 1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({
    results: users.map((u) => ({
      id: u._id.toString(),
      nombre: u.nombre ?? '',
      cedula: u.cedula ?? '',
      cargo: u.cargo_empleado ?? u.posicion ?? '',
      area: u.area ?? '',
      departamento: u.departamento ?? '',
    })),
  });
}
