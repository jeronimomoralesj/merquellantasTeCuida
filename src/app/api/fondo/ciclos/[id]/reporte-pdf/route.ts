import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../lib/auth';
import {
  renderCicloReportePdf,
  type CicloReporteData,
  type CicloReporteMovimiento,
} from '../../../../../../lib/ciclo-reporte-pdf';
import { formatPeriodoLabel } from '../../../../../../lib/fondo-period';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/fondo/ciclos/:id/reporte-pdf — stream a nómina-style PDF of
// the ciclo's full detail (fondo/admin only). Mirrors the Heinsohn
// RELACION DE NOMINA layout so the fondo admin can archive a human-
// readable copy of what was submitted.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.user.rol !== 'fondo' && session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const ciclo = await db.collection('fondo_ciclos').findOne({ _id: new ObjectId(id) });
  if (!ciclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

  // fondo can only see cycles they created; admin can see any.
  if (session.user.rol === 'fondo' && ciclo.created_by !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const movimientos = Array.isArray(ciclo.movimientos)
    ? (ciclo.movimientos as CicloReporteMovimiento[])
    : [];

  const data: CicloReporteData = {
    periodo: String(ciclo.periodo || ''),
    periodo_label: formatPeriodoLabel(String(ciclo.periodo || '')),
    estado: String(ciclo.estado || ''),
    created_at: ciclo.created_at,
    approved_at: ciclo.approved_at,
    revision_count: typeof ciclo.revision_count === 'number' ? ciclo.revision_count : 0,
    movimientos,
  };

  const buffer = await renderCicloReportePdf(data);
  const safePeriodo = String(ciclo.periodo || id).replace(/[^0-9A-Za-z-]/g, '_');
  const filename = `ciclo-${safePeriodo}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
