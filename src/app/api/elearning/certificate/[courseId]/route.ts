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
  const completedVideos = await db.collection('course_progress').countDocuments({
    user_id: session.user.id,
    course_id: courseId,
  });

  const isComplete = totalVideos > 0 && completedVideos >= totalVideos;
  if (!isComplete) {
    return NextResponse.json({ error: 'Curso no completado' }, { status: 403 });
  }

  const completion = await db.collection('course_completions').findOne({
    user_id: session.user.id,
    course_id: courseId,
  });

  return NextResponse.json({
    course_title: course.title,
    user_name: session.user.nombre || 'Usuario',
    completed_at: completion?.completed_at || new Date(),
  });
}
