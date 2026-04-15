import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
import { canUserAccessCourse, sanitizeAudience } from '../../../../../lib/course-access';

const MAX_ATTEMPTS = 3;

// GET /api/elearning/admin/stats — admin-only aggregate stats for elearning
export async function GET() {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();

  const courses = await db.collection('courses').find({}).toArray();
  const allUsers = await db
    .collection('users')
    .find({}, { projection: { nombre: 1, cedula: 1, cargo_empleado: 1, rol: 1 } })
    .toArray();
  const nonAdminUsers = allUsers.filter((u) => u.rol !== 'admin');

  const perCourse = await Promise.all(
    courses.map(async (c) => {
      const courseId = c._id.toString();
      const audience = sanitizeAudience(c.audience);

      const [videos, quizzes] = await Promise.all([
        db.collection('course_videos').countDocuments({ course_id: courseId }),
        db.collection('course_quizzes').find({ course_id: courseId }).toArray(),
      ]);
      const totalItems = videos + quizzes.length;
      const quizIds = quizzes.map((q) => q._id.toString());

      const accessible: string[] = [];
      for (const u of nonAdminUsers) {
        const canAccess = await canUserAccessCourse(
          db,
          audience,
          u._id.toString(),
          u.rol || 'user',
          u.cargo_empleado || null
        );
        if (canAccess) accessible.push(u._id.toString());
      }

      const completedCount = accessible.length
        ? await db.collection('course_completions').countDocuments({
            course_id: courseId,
            user_id: { $in: accessible },
          })
        : 0;

      let avgQuizScore: number | null = null;
      let blockedUserCount = 0;
      if (quizIds.length > 0 && accessible.length > 0) {
        const attemptAgg = await db
          .collection('quiz_attempts')
          .aggregate([
            {
              $match: {
                quiz_id: { $in: quizIds },
                user_id: { $in: accessible },
                submitted_at: { $ne: null },
              },
            },
            {
              $group: {
                _id: { quiz_id: '$quiz_id', user_id: '$user_id' },
                best: { $max: '$score_percent' },
                attempts: { $sum: 1 },
                passed: { $max: { $cond: ['$passed', 1, 0] } },
              },
            },
          ])
          .toArray();

        if (attemptAgg.length > 0) {
          const avg =
            attemptAgg.reduce((sum, a) => sum + (a.best || 0), 0) / attemptAgg.length;
          avgQuizScore = Math.round(avg);
        }
        blockedUserCount = attemptAgg.filter(
          (a) => a.attempts >= MAX_ATTEMPTS && a.passed === 0
        ).length;
      }

      return {
        id: courseId,
        title: c.title,
        thumbnail: c.thumbnail || null,
        total_items: totalItems,
        quiz_count: quizzes.length,
        enrolled: accessible.length,
        completed: completedCount,
        completion_rate: accessible.length
          ? Math.round((completedCount / accessible.length) * 100)
          : 0,
        avg_quiz_score: avgQuizScore,
        blocked_users: blockedUserCount,
      };
    })
  );

  // Global totals
  const totalAttempts = await db
    .collection('quiz_attempts')
    .countDocuments({ submitted_at: { $ne: null } });
  const totalCompletions = await db.collection('course_completions').countDocuments({});
  const totalBlocked = perCourse.reduce((s, c) => s + c.blocked_users, 0);

  const allAttemptsAgg = await db
    .collection('quiz_attempts')
    .aggregate([
      { $match: { submitted_at: { $ne: null } } },
      {
        $group: {
          _id: { quiz_id: '$quiz_id', user_id: '$user_id' },
          best: { $max: '$score_percent' },
        },
      },
      { $group: { _id: null, avg: { $avg: '$best' } } },
    ])
    .toArray();
  const globalAvgScore = allAttemptsAgg[0]?.avg
    ? Math.round(allAttemptsAgg[0].avg)
    : null;

  return NextResponse.json({
    totals: {
      courses: courses.length,
      users: nonAdminUsers.length,
      completions: totalCompletions,
      attempts: totalAttempts,
      avg_score: globalAvgScore,
      blocked: totalBlocked,
    },
    courses: perCourse.sort((a, b) => a.title.localeCompare(b.title)),
  });
}

export const dynamic = 'force-dynamic';
