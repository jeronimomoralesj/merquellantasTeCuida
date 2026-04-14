import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';

// GET /api/elearning/certificate/[courseId] — confirm completion and return cert data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { courseId } = await params;
  if (!ObjectId.isValid(courseId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const course = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
  if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

  const totalVideos = await db.collection('course_videos').countDocuments({ course_id: courseId });
  const totalQuizzes = await db.collection('course_quizzes').countDocuments({ course_id: courseId });
  const totalItems = totalVideos + totalQuizzes;
  const completedItems = await db.collection('course_progress').countDocuments({
    user_id: session.user.id,
    course_id: courseId,
  });

  const isComplete = totalItems > 0 && completedItems >= totalItems;
  if (!isComplete) {
    return NextResponse.json({ error: 'Curso no completado' }, { status: 403 });
  }

  const completion = await db.collection('course_completions').findOne({
    user_id: session.user.id,
    course_id: courseId,
  });

  // Compute overall score: average of the best passing score per quiz.
  // If no quizzes, default to 100.
  let scorePercent = 100;
  if (totalQuizzes > 0) {
    const quizzes = await db.collection('course_quizzes').find({ course_id: courseId }).toArray();
    const quizIds = quizzes.map((q) => q._id.toString());
    const attempts = await db.collection('quiz_attempts').find({
      user_id: session.user.id,
      quiz_id: { $in: quizIds },
      passed: true,
    }).toArray();
    const bestByQuiz = new Map<string, number>();
    for (const a of attempts) {
      const prev = bestByQuiz.get(a.quiz_id) ?? 0;
      bestByQuiz.set(a.quiz_id, Math.max(prev, a.score_percent ?? 0));
    }
    const scores = quizIds.map((qid) => bestByQuiz.get(qid) ?? 0);
    scorePercent = Math.round(scores.reduce((s, n) => s + n, 0) / quizIds.length);
  }

  return NextResponse.json({
    course_title: course.title,
    user_name: session.user.nombre || 'Usuario',
    completed_at: completion?.completed_at || new Date(),
    score_percent: scorePercent,
    has_quizzes: totalQuizzes > 0,
  });
}
