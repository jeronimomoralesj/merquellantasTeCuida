import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// POST /api/elearning/progress — mark a video as completed for the current user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { video_id, course_id } = body;

  if (!video_id || !ObjectId.isValid(video_id)) {
    return NextResponse.json({ error: 'video_id inválido' }, { status: 400 });
  }
  if (!course_id || !ObjectId.isValid(course_id)) {
    return NextResponse.json({ error: 'course_id inválido' }, { status: 400 });
  }

  const db = await getDb();

  await db.collection('course_progress').updateOne(
    { user_id: session.user.id, video_id, course_id },
    {
      $setOnInsert: {
        user_id: session.user.id,
        video_id,
        course_id,
        completed_at: new Date(),
      },
    },
    { upsert: true }
  );

  // Check if course is fully completed — if so, record course completion
  const totalVideos = await db.collection('course_videos').countDocuments({ course_id });
  const completedVideos = await db.collection('course_progress').countDocuments({
    user_id: session.user.id,
    course_id,
  });

  const isCourseComplete = totalVideos > 0 && completedVideos >= totalVideos;

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
    total_videos: totalVideos,
  });
}
