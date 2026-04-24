import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../lib/auth';
import {
  renderSolicitudCreditoPdf,
  type SolicitudData,
} from '../../../../../../lib/solicitud-credito-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/fondo/cartera/:id/solicitud-pdf — stream the filled Solicitud de
// PRÉSTAMOS PDF for a specific credit request. Accessible to the owning
// user (so they can keep a copy) and to fondo/admin (so they can archive or
// print the signed form).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const cartera = await db.collection('fondo_cartera').findOne({ _id: new ObjectId(id) });
  if (!cartera) return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });

  const isPrivileged = session.user.rol === 'fondo' || session.user.rol === 'admin';
  const isOwner = cartera.user_id === session.user.id;
  if (!isPrivileged && !isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // The structured form payload is stored under `solicitud` by
  // /api/fondo/cartera POST. Older records without it still render — all
  // fields are optional in the PDF template so you just get an empty
  // template with whatever top-level cartera data we have.
  const solicitud: SolicitudData = (cartera.solicitud || {}) as SolicitudData;

  // Fill in a couple of sensible fallbacks from the cartera doc itself in
  // case `solicitud` was persisted by an older client.
  if (!solicitud.monto_solicitado && cartera.valor_prestamo) {
    solicitud.monto_solicitado = Number(cartera.valor_prestamo);
  }
  if (!solicitud.frecuencia_pago && cartera.frecuencia_pago) {
    solicitud.frecuencia_pago = String(cartera.frecuencia_pago);
  }
  if (!solicitud.fecha_solicitud && cartera.fecha_solicitud) {
    solicitud.fecha_solicitud = new Date(cartera.fecha_solicitud).toISOString();
  }
  if (!solicitud.info_asociado?.cedula || !solicitud.info_asociado?.nombres) {
    const user = await db.collection('users').findOne({ _id: new ObjectId(cartera.user_id) });
    if (user) {
      solicitud.info_asociado = {
        ...(solicitud.info_asociado || {}),
        nombres: solicitud.info_asociado?.nombres || String(user.nombre || ''),
        cedula: solicitud.info_asociado?.cedula || String(user.cedula || ''),
        direccion_residencia: solicitud.info_asociado?.direccion_residencia || String(user.direccion || ''),
        barrio: solicitud.info_asociado?.barrio || String(user.barrio || ''),
        ciudad: solicitud.info_asociado?.ciudad || String(user.ciudad || ''),
        telefono_fijo: solicitud.info_asociado?.telefono_fijo || String(user.telefono || ''),
        celular: solicitud.info_asociado?.celular || String(user.movil || ''),
        empresa: solicitud.info_asociado?.empresa || 'Merquellantas',
      };
    }
  }

  const buffer = await renderSolicitudCreditoPdf(solicitud);
  const filename = `solicitud-credito-${(solicitud.info_asociado?.cedula || id).toString().replace(/[^0-9a-zA-Z-]/g, '')}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
