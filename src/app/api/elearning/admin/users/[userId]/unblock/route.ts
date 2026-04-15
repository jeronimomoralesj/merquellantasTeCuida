import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../../lib/db';
import { auth } from '../../../../../../../lib/auth';

// POST /api/elearning/admin/users/[userId]/unblock
// Body: { quiz_id: string }
// Resets a user's failed attempts for a specific quiz so they can retry.
// Passed attempts are preserved.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { userId } = await params;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'ID de usuario inválido' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const quizId = typeof body.quiz_id === 'string' ? body.quiz_id : '';
  if (!ObjectId.isValid(quizId)) {
    return NextResponse.json({ error: 'quiz_id inválido' }, { status: 400 });
  }

  const db = await getDb();

  const user = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { nombre: 1 } });
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const quiz = await db
    .collection('course_quizzes')
    .findOne({ _id: new ObjectId(quizId) });
  if (!quiz) {
    return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });
  }

  const alreadyPassed = await db.collection('quiz_attempts').findOne({
    quiz_id: quizId,
    user_id: userId,
    passed: true,
  });
  if (alreadyPassed) {
    return NextResponse.json(
      { error: 'El usuario ya aprobó este quiz' },
      { status: 400 }
    );
  }

  const result = await db.collection('quiz_attempts').deleteMany({
    quiz_id: quizId,
    user_id: userId,
    passed: { $ne: true },
  });

  return NextResponse.json({
    ok: true,
    deleted_attempts: result.deletedCount,
  });
}

export const dynamic = 'force-dynamic';
