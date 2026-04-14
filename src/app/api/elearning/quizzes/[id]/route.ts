import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';

// GET /api/elearning/quizzes/[id] — admin gets full (with answers), user gets sanitized
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const db = await getDb();
  const quiz = await db.collection('course_quizzes').findOne({ _id: new ObjectId(id) });
  if (!quiz) return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });

  const questions = await db.collection('quiz_questions').find({ quiz_id: id }).sort({ order: 1 }).toArray();

  const isAdmin = session.user.rol === 'admin';

  return NextResponse.json({
    id: quiz._id.toString(),
    course_id: quiz.course_id,
    title: quiz.title,
    description: quiz.description || '',
    time_limit_minutes: quiz.time_limit_minutes,
    pass_percent: quiz.pass_percent,
    max_attempts: quiz.max_attempts ?? 3,
    questions_count: questions.length,
    questions: questions.map((q) => ({
      id: q._id.toString(),
      question: q.question,
      options: q.options.map((o: { text: string; is_correct: boolean }) => ({
        text: o.text,
        ...(isAdmin ? { is_correct: o.is_correct } : {}),
      })),
    })),
  });
}

// PUT /api/elearning/quizzes/[id] — update (admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await req.json();
  const setDoc: Record<string, unknown> = {};
  if (typeof body.title === 'string') setDoc.title = body.title.trim();
  if (typeof body.description === 'string') setDoc.description = body.description.trim();
  if (typeof body.time_limit_minutes === 'number') {
    setDoc.time_limit_minutes = Math.max(1, Math.min(180, body.time_limit_minutes));
  }
  if (typeof body.pass_percent === 'number') {
    setDoc.pass_percent = Math.max(1, Math.min(100, body.pass_percent));
  }
  if (typeof body.order === 'number') setDoc.order = body.order;

  const db = await getDb();

  if (Array.isArray(body.questions)) {
    const { sanitizeQuestions } = await import('../../../../../lib/quiz-helpers');
    const qs = sanitizeQuestions(body.questions);
    if (!qs) return NextResponse.json({ error: 'Preguntas inválidas' }, { status: 400 });
    await db.collection('quiz_questions').deleteMany({ quiz_id: id });
    if (qs.length > 0) {
      await db.collection('quiz_questions').insertMany(
        qs.map((q, i) => ({ quiz_id: id, question: q.question, options: q.options, order: i }))
      );
    }
    setDoc.questions_count = qs.length;
  }

  if (Object.keys(setDoc).length > 0) {
    await db.collection('course_quizzes').updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/elearning/quizzes/[id] (admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const db = await getDb();
  await db.collection('course_quizzes').deleteOne({ _id: new ObjectId(id) });
  await db.collection('quiz_questions').deleteMany({ quiz_id: id });
  await db.collection('quiz_attempts').deleteMany({ quiz_id: id });
  await db.collection('course_progress').deleteMany({ item_id: id, item_type: 'quiz' });
  return NextResponse.json({ success: true });
}
