import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vacations/me — returns the current user's vacation balance.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { cedula: 1, nombre: 1 } }
  );
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Resilient lookup. The happy path matches the balance by the user's
  // cedula string. But we've seen a handful of users in the admin
  // /api/vacations/all view with balances whose cedula field doesn't
  // byte-match the one on the users doc (trailing whitespace, number
  // vs string, empty-string legacy users who got a user_id-keyed
  // balance). Fall back to user_id so those users still see their
  // days on /dashboard.
  const cedulaStr = String(user.cedula || '').trim();
  const or: Record<string, unknown>[] = [];
  if (cedulaStr) {
    or.push({ cedula: cedulaStr });
    // Also try a case-insensitive regex for the exact trimmed value in
    // case the stored cedula has quirky whitespace — cheap, only 1 row.
    or.push({ cedula: new RegExp(`^\\s*${cedulaStr}\\s*$`) });
  }
  or.push({ user_id: session.user.id });
  const balance = await db.collection('vacation_balances').findOne({ $or: or });

  if (!balance) {
    return NextResponse.json({
      cedula: user.cedula || null,
      days: null,
      as_of_date: null,
      scraped_at: null,
      stale: true,
    });
  }

  const asOfDate: string | undefined = balance.as_of_date;
  const now = new Date();
  const currentMonthAnchor = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const stale = !asOfDate || asOfDate < currentMonthAnchor;

  return NextResponse.json({
    cedula: balance.cedula,
    days: balance.days,
    as_of_date: balance.as_of_date || null,
    scraped_at: balance.scraped_at || null,
    last_adjusted_at: balance.last_adjusted_at || null,
    stale,
  });
}
