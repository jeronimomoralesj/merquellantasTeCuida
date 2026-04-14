import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { sanitizeQuestions } from '../../../../lib/quiz-helpers';

// POST /api/elearning/quizzes — create quiz with questions (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.course_id || !ObjectId.isValid(body.course_id)) {
    return NextResponse.json({ error: 'course_id inválido' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 });

  const timeLimit = Math.max(1, Math.min(180, Number(body.time_limit_minutes) || 10));
  const passPercent = Math.max(1, Math.min(100, Number(body.pass_percent) || 70));
  const questions = sanitizeQuestions(body.questions);
  if (!questions) {
    return NextResponse.json({ error: 'Preguntas inválidas (mín 1, opciones 2-6, al menos 1 correcta)' }, { status: 400 });
  }

  const db = await getDb();
  const course = await db.collection('courses').findOne({ _id: new ObjectId(body.course_id) });
  if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

  // Compute next order (max across videos and quizzes)
  const lastVideo = await db.collection('course_videos').find({ course_id: body.course_id }).sort({ order: -1 }).limit(1).toArray();
  const lastQuiz = await db.collection('course_quizzes').find({ course_id: body.course_id }).sort({ order: -1 }).limit(1).toArray();
  const maxOrder = Math.max(lastVideo[0]?.order ?? -1, lastQuiz[0]?.order ?? -1);
  const nextOrder = typeof body.order === 'number' ? body.order : maxOrder + 1;

  const quizDoc = await db.collection('course_quizzes').insertOne({
    course_id: body.course_id,
    title,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    time_limit_minutes: timeLimit,
    pass_percent: passPercent,
    max_attempts: 3,
    questions_count: questions.length,
    order: nextOrder,
    created_at: new Date(),
    created_by: session.user.id,
  });

  await db.collection('quiz_questions').insertMany(
    questions.map((q, i) => ({
      quiz_id: quizDoc.insertedId.toString(),
      question: q.question,
      options: q.options,
      order: i,
    }))
  );

  return NextResponse.json({ success: true, id: quizDoc.insertedId.toString() });
}
