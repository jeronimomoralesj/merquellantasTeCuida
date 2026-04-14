import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';
import { getDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../lib/auth';

const ALERT_RECIPIENTS = [
  'marcelagonzalez@merquellantas.com',
  'saludocupacional@merquellantas.com',
  'dptodelagente@merquellantas.com',
];

const MAX_ATTEMPTS = 3;

// GET /api/elearning/quizzes/[id]/attempt — get current user's attempt history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const db = await getDb();
  const attempts = await db.collection('quiz_attempts').find({
    quiz_id: id,
    user_id: session.user.id,
  }).sort({ attempt_number: 1 }).toArray();

  const best = attempts.filter((a) => a.submitted_at).reduce(
    (max, a) => Math.max(max, a.score_percent ?? 0),
    0
  );
  const passed = attempts.some((a) => a.passed);

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      attempt_number: a.attempt_number,
      score_percent: a.score_percent ?? null,
      passed: !!a.passed,
      submitted_at: a.submitted_at || null,
    })),
    attempts_used: attempts.filter((a) => a.submitted_at).length,
    attempts_remaining: Math.max(0, MAX_ATTEMPTS - attempts.filter((a) => a.submitted_at).length),
    best_score: best,
    passed,
  });
}

// POST /api/elearning/quizzes/[id]/attempt — submit an attempt (grades server-side)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = await req.json();
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'answers requerido' }, { status: 400 });
  }

  const db = await getDb();
  const quiz = await db.collection('course_quizzes').findOne({ _id: new ObjectId(id) });
  if (!quiz) return NextResponse.json({ error: 'Quiz no encontrado' }, { status: 404 });

  const priorAttempts = await db.collection('quiz_attempts').countDocuments({
    quiz_id: id,
    user_id: session.user.id,
    submitted_at: { $ne: null },
  });

  const alreadyPassed = await db.collection('quiz_attempts').findOne({
    quiz_id: id,
    user_id: session.user.id,
    passed: true,
  });
  if (alreadyPassed) {
    return NextResponse.json({ error: 'Ya aprobaste este quiz' }, { status: 400 });
  }

  if (priorAttempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Sin intentos restantes' }, { status: 400 });
  }

  const questions = await db.collection('quiz_questions').find({ quiz_id: id }).sort({ order: 1 }).toArray();
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Quiz sin preguntas' }, { status: 400 });
  }

  // Grade
  const answerMap = new Map<string, number>();
  for (const a of body.answers as { question_id: string; selected_index: number }[]) {
    if (typeof a?.question_id === 'string' && typeof a?.selected_index === 'number') {
      answerMap.set(a.question_id, a.selected_index);
    }
  }

  let correct = 0;
  const gradedAnswers = questions.map((q) => {
    const selected = answerMap.get(q._id.toString()) ?? -1;
    const option = q.options?.[selected];
    const isCorrect = !!option?.is_correct;
    if (isCorrect) correct++;
    return { question_id: q._id.toString(), selected_index: selected, is_correct: isCorrect };
  });

  const scorePercent = Math.round((correct / questions.length) * 100);
  const passed = scorePercent >= (quiz.pass_percent ?? 70);
  const attemptNumber = priorAttempts + 1;

  const attempt = {
    quiz_id: id,
    course_id: quiz.course_id,
    user_id: session.user.id,
    user_name: session.user.nombre || 'Usuario',
    attempt_number: attemptNumber,
    started_at: body.started_at ? new Date(body.started_at) : new Date(),
    submitted_at: new Date(),
    answers: gradedAnswers,
    score_percent: scorePercent,
    passed,
  };

  await db.collection('quiz_attempts').insertOne(attempt);

  // If passed, record item progress so course unlocks next item
  if (passed) {
    await db.collection('course_progress').updateOne(
      { user_id: session.user.id, item_id: id, item_type: 'quiz' },
      {
        $setOnInsert: {
          user_id: session.user.id,
          course_id: quiz.course_id,
          item_id: id,
          video_id: id, // legacy compat
          item_type: 'quiz',
          completed_at: new Date(),
        },
      },
      { upsert: true }
    );
  }

  // On final failed attempt, email the bienestar team
  if (!passed && attemptNumber >= MAX_ATTEMPTS) {
    const course = await db.collection('courses').findOne({ _id: new ObjectId(quiz.course_id) });
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      const rows = gradedAnswers.map((a, i) => {
        const q = questions[i];
        const chosen = q.options?.[a.selected_index]?.text ?? 'Sin responder';
        return `<tr><td style="padding:6px 10px;border:1px solid #eee">${i + 1}. ${escapeHtml(q.question)}</td><td style="padding:6px 10px;border:1px solid #eee">${escapeHtml(chosen)}</td><td style="padding:6px 10px;border:1px solid #eee;color:${a.is_correct ? '#059669' : '#dc2626'}">${a.is_correct ? 'Correcta' : 'Incorrecta'}</td></tr>`;
      }).join('');

      await transporter.sendMail({
        from: `"Merque Bienestar" <${process.env.GMAIL_USER}>`,
        to: ALERT_RECIPIENTS.join(','),
        subject: `Alerta: ${attempt.user_name} reprobó quiz - ${quiz.title}`,
        html: `
          <h2 style="color:#dc2626">Usuario reprobó todos los intentos del quiz</h2>
          <p><strong>Usuario:</strong> ${escapeHtml(attempt.user_name)}</p>
          <p><strong>Curso:</strong> ${escapeHtml(course?.title ?? '—')}</p>
          <p><strong>Quiz:</strong> ${escapeHtml(quiz.title)}</p>
          <p><strong>Intentos usados:</strong> ${attemptNumber}/${MAX_ATTEMPTS}</p>
          <p><strong>Última puntuación:</strong> ${scorePercent}% (requerida: ${quiz.pass_percent}%)</p>
          <table style="border-collapse:collapse;margin-top:12px;font-size:13px">
            <thead><tr style="background:#f9fafb"><th style="padding:6px 10px;border:1px solid #eee;text-align:left">Pregunta</th><th style="padding:6px 10px;border:1px solid #eee;text-align:left">Respuesta</th><th style="padding:6px 10px;border:1px solid #eee;text-align:left">Resultado</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:16px;color:#6b7280;font-size:12px">Se recomienda hacer seguimiento con el usuario.</p>
        `,
      });
    } catch (err) {
      console.error('[quiz attempt] alert email failed', err);
    }
  }

  return NextResponse.json({
    score_percent: scorePercent,
    passed,
    attempt_number: attemptNumber,
    attempts_remaining: Math.max(0, MAX_ATTEMPTS - attemptNumber),
    pass_percent: quiz.pass_percent,
    breakdown: gradedAnswers.map((a) => ({
      question_id: a.question_id,
      is_correct: a.is_correct,
    })),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
