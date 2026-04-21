import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/certificados/me — lists the years for which the *current* user has a certificate.
 * Used by the user dashboard to decide whether to render the download button.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const cedula = session.user.cedula;
  if (!cedula) return NextResponse.json({ years: [] });

  const db = await getDb();
  const docs = await db
    .collection('certificados')
    .find({ cedula }, { projection: { year: 1, updated_at: 1 } })
    .sort({ year: -1 })
    .toArray();

  return NextResponse.json({
    cedula,
    years: docs.map((d) => ({ year: d.year, updated_at: d.updated_at })),
  });
}
