import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/fondo/stats — anonymous aggregate stats for the fondo
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();

  const totalMembers = await db.collection('fondo_members').countDocuments({ activo: true });

  // Aggregate average savings across active members
  const agg = await db.collection('fondo_members').aggregate([
    { $match: { activo: true } },
    {
      $group: {
        _id: null,
        avg_permanente: { $avg: '$saldo_permanente' },
        avg_social: { $avg: '$saldo_social' },
        max_permanente: { $max: '$saldo_permanente' },
        total_ahorrado: { $sum: { $add: ['$saldo_permanente', '$saldo_social'] } },
      },
    },
  ]).toArray();

  const stats = agg[0] || { avg_permanente: 0, avg_social: 0, max_permanente: 0, total_ahorrado: 0 };

  // Count active credits
  const activeCredits = await db.collection('fondo_cartera').countDocuments({ estado: 'activo' });

  return NextResponse.json({
    total_afiliados: totalMembers,
    promedio_ahorro: Math.round((stats.avg_permanente || 0) + (stats.avg_social || 0)),
    total_ahorrado: Math.round(stats.total_ahorrado || 0),
    creditos_activos: activeCredits,
  });
}
