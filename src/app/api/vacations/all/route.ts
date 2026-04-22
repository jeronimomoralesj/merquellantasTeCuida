import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/vacations/all  (admin only)
 *
 * Returns every user's latest vacation balance — from the monthly Heinsohn scrape
 * stored in `vacation_balances`, joined with their users row for name/area/cargo
 * context. Users without a balance row still appear (days=null) so admins can spot
 * who's missing from the scrape.
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();

  const [users, balances] = await Promise.all([
    db
      .collection('users')
      .find(
        { rol: { $ne: 'admin' } },
        {
          projection: {
            cedula: 1,
            nombre: 1,
            email: 1,
            cargo_empleado: 1,
            posicion: 1,
            area: 1,
            departamento: 1,
            fecha_ingreso: 1,
          },
        },
      )
      .sort({ nombre: 1 })
      .toArray(),
    db.collection('vacation_balances').find({}).toArray(),
  ]);

  const byCedula = new Map<string, (typeof balances)[number]>();
  for (const b of balances) {
    if (typeof b.cedula === 'string') byCedula.set(b.cedula, b);
  }

  // Stale if the scrape's as_of_date is before the current month's 1st.
  const now = new Date();
  const currentMonthAnchor = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const rows = users.map((u) => {
    const bal = byCedula.get(u.cedula);
    const asOfDate = (bal?.as_of_date as string | undefined) || null;
    const stale = !asOfDate || asOfDate < currentMonthAnchor;
    return {
      cedula: u.cedula,
      nombre: u.nombre || '',
      email: u.email || null,
      cargo: u.cargo_empleado || u.posicion || null,
      area: u.area || null,
      departamento: u.departamento || null,
      fecha_ingreso: u.fecha_ingreso || null,
      days: typeof bal?.days === 'number' ? bal.days : null,
      as_of_date: asOfDate,
      scraped_at: bal?.scraped_at ?? null,
      last_adjusted_at: bal?.last_adjusted_at ?? null,
      source: bal?.source ?? null,
      stale,
      // Flag users with no row at all so admins can see who's missing from Heinsohn.
      missing: !bal,
    };
  });

  // Aggregate metrics for the header cards.
  const withDays = rows.filter((r) => typeof r.days === 'number');
  const totalDays = withDays.reduce((s, r) => s + (r.days as number), 0);
  const avgDays = withDays.length ? totalDays / withDays.length : null;
  const staleCount = rows.filter((r) => r.stale && !r.missing).length;
  const missingCount = rows.filter((r) => r.missing).length;

  // Most recent scrape timestamp across all rows — tells admins "how fresh is my data?"
  let latestScrapedAt: Date | null = null;
  for (const b of balances) {
    const t = b.scraped_at ? new Date(b.scraped_at as Date) : null;
    if (t && (!latestScrapedAt || t > latestScrapedAt)) latestScrapedAt = t;
  }

  return NextResponse.json({
    totals: {
      users: rows.length,
      with_balance: withDays.length,
      missing: missingCount,
      stale: staleCount,
      total_days: Number(totalDays.toFixed(2)),
      avg_days: avgDays !== null ? Number(avgDays.toFixed(2)) : null,
      latest_scraped_at: latestScrapedAt,
    },
    rows,
  });
}
