import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
import { canUserAccessCourse, sanitizeAudience } from '../../../../../lib/course-access';

const MAX_ATTEMPTS = 3;

// GET /api/elearning/admin/users?q=... — admin-only list of users with elearning summary
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const db = await getDb();

  const filter: Record<string, unknown> = { rol: { $ne: 'admin' } };
  if (q.length >= 2) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter.$or = [{ nombre: rx }, { cedula: rx }, { cargo_empleado: rx }];
  }

  const users = await db
    .collection('users')
    .find(filter, {
      projection: { nombre: 1, cedula: 1, cargo_empleado: 1, email: 1, rol: 1 },
    })
    .sort({ nombre: 1 })
    .limit(500)
    .toArray();

  const courses = await db.collection('courses').find({}).toArray();

  // Bulk-fetch completions + attempts to avoid N*M queries
  const userIds = users.map((u) => u._id.toString());
  const completions = userIds.length
    ? await db
        .collection('course_completions')
        .find({ user_id: { $in: userIds } })
        .toArray()
    : [];
  const completionsByUser = new Map<string, Set<string>>();
  for (const c of completions) {
    const key = c.user_id as string;
    if (!completionsByUser.has(key)) completionsByUser.set(key, new Set());
    completionsByUser.get(key)!.add(c.course_id as string);
  }

  const attemptsAgg = userIds.length
    ? await db
        .collection('quiz_attempts')
        .aggregate([
          { $match: { user_id: { $in: userIds }, submitted_at: { $ne: null } } },
          {
            $group: {
              _id: { user_id: '$user_id', quiz_id: '$quiz_id' },
              best: { $max: '$score_percent' },
              attempts: { $sum: 1 },
              passed: { $max: { $cond: ['$passed', 1, 0] } },
            },
          },
        ])
        .toArray()
    : [];
  const attemptsByUser = new Map<
    string,
    { best: number; attempts: number; passed: number }[]
  >();
  for (const a of attemptsAgg) {
    const key = a._id.user_id as string;
    if (!attemptsByUser.has(key)) attemptsByUser.set(key, []);
    attemptsByUser.get(key)!.push({
      best: a.best || 0,
      attempts: a.attempts || 0,
      passed: a.passed || 0,
    });
  }

  const result = await Promise.all(
    users.map(async (u) => {
      const userId = u._id.toString();
      const userCargo = u.cargo_empleado || null;

      let accessible = 0;
      for (const c of courses) {
        const audience = sanitizeAudience(c.audience);
        const canAccess = await canUserAccessCourse(
          db,
          audience,
          userId,
          u.rol || 'user',
          userCargo
        );
        if (canAccess) accessible++;
      }

      const completed = completionsByUser.get(userId)?.size || 0;
      const attempts = attemptsByUser.get(userId) || [];
      const avgGrade = attempts.length
        ? Math.round(attempts.reduce((s, a) => s + a.best, 0) / attempts.length)
        : null;
      const blocked = attempts.filter(
        (a) => a.attempts >= MAX_ATTEMPTS && a.passed === 0
      ).length;

      return {
        id: userId,
        nombre: u.nombre || '—',
        cedula: u.cedula || '',
        cargo_empleado: userCargo,
        email: u.email || null,
        accessible_courses: accessible,
        completed_courses: completed,
        avg_grade: avgGrade,
        blocked_quizzes: blocked,
      };
    })
  );

  return NextResponse.json({ users: result });
}

export const dynamic = 'force-dynamic';
