import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// POST /api/elearning/progress — mark a video as completed for the current user
// (quizzes are marked via the attempt endpoint when passed)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const itemId = body.item_id || body.video_id;
  const { course_id } = body;
  const itemType: 'video' | 'quiz' = body.item_type === 'quiz' ? 'quiz' : 'video';

  if (!itemId || !ObjectId.isValid(itemId)) {
    return NextResponse.json({ error: 'item_id inválido' }, { status: 400 });
  }
  if (!course_id || !ObjectId.isValid(course_id)) {
    return NextResponse.json({ error: 'course_id inválido' }, { status: 400 });
  }

  const db = await getDb();

  // Enforce sequential progress: can only complete the first pending item
  if (session.user.rol !== 'admin' && itemType === 'video') {
    const videos = await db.collection('course_videos').find({ course_id }).toArray();
    const quizzes = await db.collection('course_quizzes').find({ course_id }).toArray();
    type Item = { id: string; order: number };
    const items: Item[] = [
      ...videos.map((v) => ({ id: v._id.toString(), order: v.order ?? 0 })),
      ...quizzes.map((q) => ({ id: q._id.toString(), order: q.order ?? 0 })),
    ].sort((a, b) => a.order - b.order);
    const progress = await db.collection('course_progress').find({
      user_id: session.user.id,
      course_id,
    }).toArray();
    const completed = new Set(progress.map((p) => (p.item_id || p.video_id) as string));

    const nextPending = items.find((it) => !completed.has(it.id));
    if (nextPending && nextPending.id !== itemId && !completed.has(itemId)) {
      return NextResponse.json(
        { error: 'Debes completar las lecciones anteriores primero' },
        { status: 403 }
      );
    }
  }

  await db.collection('course_progress').updateOne(
    { user_id: session.user.id, item_id: itemId, course_id },
    {
      $setOnInsert: {
        user_id: session.user.id,
        course_id,
        item_id: itemId,
        video_id: itemId, // legacy compat
        item_type: itemType,
        completed_at: new Date(),
      },
    },
    { upsert: true }
  );

  const totalVideos = await db.collection('course_videos').countDocuments({ course_id });
  const totalQuizzes = await db.collection('course_quizzes').countDocuments({ course_id });
  const totalItems = totalVideos + totalQuizzes;
  const completedVideos = await db.collection('course_progress').countDocuments({
    user_id: session.user.id,
    course_id,
  });

  const isCourseComplete = totalItems > 0 && completedVideos >= totalItems;

  if (isCourseComplete) {
    await db.collection('course_completions').updateOne(
      { user_id: session.user.id, course_id },
      {
        $setOnInsert: {
          user_id: session.user.id,
          course_id,
          completed_at: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return NextResponse.json({
    success: true,
    course_complete: isCourseComplete,
    completed_videos: completedVideos,
    total_videos: totalItems,
  });
}
