import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../lib/auth';
import { canUserAccessCourse, sanitizeAudience } from '../../../../../../lib/course-access';

const MAX_ATTEMPTS = 3;

// GET /api/elearning/admin/users/[userId] — admin-only; per-user elearning detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { userId } = await params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const user = await db
    .collection('users')
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { nombre: 1, cedula: 1, cargo_empleado: 1, email: 1, rol: 1 } }
    );
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const userIdStr = user._id.toString();
  const userCargo = user.cargo_empleado || null;

  const courses = await db.collection('courses').find({}).toArray();

  // Fetch all progress / completions / attempts for this user in bulk
  const [progress, completions, attempts] = await Promise.all([
    db.collection('course_progress').find({ user_id: userIdStr }).toArray(),
    db.collection('course_completions').find({ user_id: userIdStr }).toArray(),
    db
      .collection('quiz_attempts')
      .find({ user_id: userIdStr, submitted_at: { $ne: null } })
      .sort({ submitted_at: 1 })
      .toArray(),
  ]);

  const progressByCourse = new Map<string, number>();
  for (const p of progress) {
    const k = p.course_id as string;
    progressByCourse.set(k, (progressByCourse.get(k) || 0) + 1);
  }
  const completionDate = new Map<string, Date>();
  for (const c of completions) {
    completionDate.set(c.course_id as string, c.completed_at as Date);
  }
  const attemptsByQuiz = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const k = a.quiz_id as string;
    if (!attemptsByQuiz.has(k)) attemptsByQuiz.set(k, []);
    attemptsByQuiz.get(k)!.push(a);
  }

  const accessibleCourses: Array<Record<string, unknown>> = [];
  const notAccessibleCourses: Array<Record<string, unknown>> = [];

  for (const c of courses) {
    const courseId = c._id.toString();
    const audience = sanitizeAudience(c.audience);
    const canAccess = await canUserAccessCourse(
      db,
      audience,
      userIdStr,
      user.rol || 'user',
      userCargo
    );

    const quizzes = await db
      .collection('course_quizzes')
      .find({ course_id: courseId })
      .sort({ order: 1 })
      .toArray();
    const videos = await db
      .collection('course_videos')
      .countDocuments({ course_id: courseId });
    const totalItems = videos + quizzes.length;
    const done = progressByCourse.get(courseId) || 0;

    const courseQuizzes = quizzes.map((q) => {
      const qid = q._id.toString();
      const as = attemptsByQuiz.get(qid) || [];
      const best = as.length ? Math.max(...as.map((x) => x.score_percent || 0)) : null;
      const passed = as.some((x) => x.passed);
      const attemptsUsed = as.length;
      const blocked = !passed && attemptsUsed >= MAX_ATTEMPTS;
      return {
        id: qid,
        title: q.title,
        pass_percent: q.pass_percent,
        attempts_used: attemptsUsed,
        attempts_max: MAX_ATTEMPTS,
        best_score: best,
        passed,
        blocked,
        attempts: as.map((x) => ({
          attempt_number: x.attempt_number,
          score_percent: x.score_percent,
          passed: !!x.passed,
          submitted_at: x.submitted_at,
        })),
      };
    });

    const quizzesWithAttempts = courseQuizzes.filter((q) => q.attempts_used > 0);
    const courseAvgGrade = quizzesWithAttempts.length
      ? Math.round(
          quizzesWithAttempts.reduce((s, q) => s + (q.best_score || 0), 0) /
            quizzesWithAttempts.length
        )
      : null;

    const entry = {
      id: courseId,
      title: c.title,
      thumbnail: c.thumbnail || null,
      total_items: totalItems,
      items_completed: done,
      progress_percent: totalItems ? Math.round((done / totalItems) * 100) : 0,
      completed_at: completionDate.get(courseId) || null,
      avg_grade: courseAvgGrade,
      quizzes: courseQuizzes,
    };

    if (canAccess) accessibleCourses.push(entry);
    else if (courseQuizzes.some((q) => q.attempts_used > 0) || done > 0) {
      // surface historical activity even if audience changed
      notAccessibleCourses.push(entry);
    }
  }

  // Summary
  const allAttempts = attempts;
  const bestByQuiz = new Map<string, number>();
  for (const a of allAttempts) {
    const q = a.quiz_id as string;
    bestByQuiz.set(q, Math.max(bestByQuiz.get(q) || 0, a.score_percent || 0));
  }
  const avgGrade = bestByQuiz.size
    ? Math.round(
        Array.from(bestByQuiz.values()).reduce((s, v) => s + v, 0) / bestByQuiz.size
      )
    : null;

  return NextResponse.json({
    user: {
      id: userIdStr,
      nombre: user.nombre || '—',
      cedula: user.cedula || '',
      cargo_empleado: userCargo,
      email: user.email || null,
    },
    summary: {
      accessible_courses: accessibleCourses.length,
      completed_courses: accessibleCourses.filter((c) => c.completed_at).length,
      avg_grade: avgGrade,
      total_attempts: allAttempts.length,
      blocked_quizzes: accessibleCourses
        .flatMap((c) => c.quizzes as Array<{ blocked: boolean }>)
        .filter((q) => q.blocked).length,
    },
    courses: accessibleCourses,
    historical_courses: notAccessibleCourses,
  });
}

export const dynamic = 'force-dynamic';
