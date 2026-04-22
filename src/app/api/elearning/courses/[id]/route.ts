import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
import { sanitizeAudience, canUserAccessCourse } from '../../../../../lib/course-access';

// GET /api/elearning/courses/[id] — course with merged items + user progress
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const course = await db.collection('courses').findOne({ _id: new ObjectId(id) });
  if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { cargo_empleado: 1, area: 1 } }
  );
  const userCargo = (user?.cargo_empleado as string | undefined) || null;
  const userArea = (user?.area as string | undefined) || null;
  const allowed = await canUserAccessCourse(
    db, course.audience, session.user.id, session.user.rol, userCargo, userArea,
  );
  if (!allowed) return NextResponse.json({ error: 'No tienes acceso a este curso' }, { status: 403 });

  const videos = await db.collection('course_videos').find({ course_id: id }).toArray();
  const quizzes = await db.collection('course_quizzes').find({ course_id: id }).toArray();

  const progress = await db.collection('course_progress').find({
    user_id: session.user.id,
    course_id: id,
  }).toArray();

  const completedIds = new Set(progress.map((p) => (p.item_id || p.video_id) as string));

  // Attempt summaries for quizzes (for UI state: attempts_used, passed, best_score)
  const quizIds = quizzes.map((q) => q._id.toString());
  const attempts = quizIds.length > 0
    ? await db.collection('quiz_attempts').find({
        quiz_id: { $in: quizIds },
        user_id: session.user.id,
        submitted_at: { $ne: null },
      }).toArray()
    : [];
  const attemptsByQuiz = new Map<string, { used: number; passed: boolean; best: number }>();
  for (const a of attempts) {
    const entry = attemptsByQuiz.get(a.quiz_id) || { used: 0, passed: false, best: 0 };
    entry.used += 1;
    if (a.passed) entry.passed = true;
    entry.best = Math.max(entry.best, a.score_percent ?? 0);
    attemptsByQuiz.set(a.quiz_id, entry);
  }

  type Item =
    | { type: 'video'; id: string; title: string; description: string; video_url: string | null; files: unknown[]; order: number; completed: boolean; locked: boolean }
    | { type: 'quiz'; id: string; title: string; description: string; time_limit_minutes: number; pass_percent: number; max_attempts: number; questions_count: number; order: number; completed: boolean; locked: boolean; attempts_used: number; best_score: number };

  const merged: Item[] = [];

  for (const v of videos) {
    const files = Array.isArray(v.files) && v.files.length > 0
      ? v.files
      : (v.video_url
          ? [{ url: v.video_url, name: 'video', mime_type: 'video/mp4', size: 0, category: 'video' }]
          : []);
    merged.push({
      type: 'video',
      id: v._id.toString(),
      title: v.title,
      description: v.description || '',
      video_url: v.video_url || null,
      files,
      order: v.order ?? 0,
      completed: completedIds.has(v._id.toString()),
      locked: false,
    });
  }
  for (const q of quizzes) {
    const qid = q._id.toString();
    const summary = attemptsByQuiz.get(qid) || { used: 0, passed: false, best: 0 };
    merged.push({
      type: 'quiz',
      id: qid,
      title: q.title,
      description: q.description || '',
      time_limit_minutes: q.time_limit_minutes,
      pass_percent: q.pass_percent,
      max_attempts: q.max_attempts ?? 3,
      questions_count: q.questions_count ?? 0,
      order: q.order ?? 0,
      completed: completedIds.has(qid) || summary.passed,
      locked: false,
      attempts_used: summary.used,
      best_score: summary.best,
    });
  }

  merged.sort((a, b) => a.order - b.order);

  // Apply strict sequential locking (admins see everything unlocked).
  // Only the first non-completed item is unlocked — completed items to the
  // left and future items to the right are both locked for navigation.
  const isAdmin = session.user.rol === 'admin';
  if (!isAdmin) {
    const currentIdx = merged.findIndex((item) => !item.completed);
    for (let i = 0; i < merged.length; i++) {
      if (i !== currentIdx) merged[i].locked = true;
    }
  }

  const totalItems = merged.length;
  const completedItems = merged.filter((m) => m.completed).length;

  // Legacy `videos` field kept for older clients (filters to unlocked)
  const legacyVideos = merged
    .filter((m) => m.type === 'video')
    .map((m) => {
      if (m.type !== 'video') return m;
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        video_url: m.video_url,
        files: m.files,
        order: m.order,
        completed: m.completed,
      };
    });

  return NextResponse.json({
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail || null,
    audience: course.audience || { type: 'all' },
    created_at: course.created_at,
    items: merged,
    videos: legacyVideos,
    total_videos: totalItems,
    completed_videos: completedItems,
    is_complete: totalItems > 0 && completedItems >= totalItems,
  });
}

// PUT /api/elearning/courses/[id] (admin)
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
  if (body.thumbnail !== undefined) setDoc.thumbnail = body.thumbnail || null;
  if (body.audience !== undefined) setDoc.audience = sanitizeAudience(body.audience);

  if (Object.keys(setDoc).length === 0) {
    return NextResponse.json({ success: true });
  }

  const db = await getDb();
  await db.collection('courses').updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
  return NextResponse.json({ success: true });
}

// DELETE /api/elearning/courses/[id] — delete course + videos + quizzes (admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const videos = await db.collection('course_videos').find({ course_id: id }).toArray();
  const videoIds = videos.map((v) => v._id.toString());
  const quizzes = await db.collection('course_quizzes').find({ course_id: id }).toArray();
  const quizIds = quizzes.map((q) => q._id.toString());

  await db.collection('course_videos').deleteMany({ course_id: id });
  await db.collection('course_quizzes').deleteMany({ course_id: id });
  await db.collection('quiz_questions').deleteMany({ quiz_id: { $in: quizIds } });
  await db.collection('quiz_attempts').deleteMany({ quiz_id: { $in: quizIds } });
  await db.collection('course_progress').deleteMany({ course_id: id });
  await db.collection('course_comments').deleteMany({ video_id: { $in: videoIds } });
  await db.collection('courses').deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ success: true });
}
