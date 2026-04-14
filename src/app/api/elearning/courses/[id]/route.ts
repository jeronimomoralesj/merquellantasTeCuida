import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';

// GET /api/elearning/courses/[id] — get course with videos + user progress
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

  const videos = await db.collection('course_videos')
    .find({ course_id: id })
    .sort({ order: 1, created_at: 1 })
    .toArray();

  const progress = await db.collection('course_progress').find({
    user_id: session.user.id,
    course_id: id,
  }).toArray();

  const completedIds = new Set(progress.map((p) => p.video_id));

  return NextResponse.json({
    id: course._id.toString(),
    title: course.title,
    description: course.description,
    thumbnail: course.thumbnail || null,
    created_at: course.created_at,
    videos: videos.map((v, idx) => ({
      id: v._id.toString(),
      title: v.title,
      description: v.description || '',
      video_url: v.video_url,
      order: v.order ?? idx,
      completed: completedIds.has(v._id.toString()),
    })),
    total_videos: videos.length,
    completed_videos: progress.length,
    is_complete: videos.length > 0 && progress.length >= videos.length,
  });
}

// PUT /api/elearning/courses/[id] — update (admin)
export async function PUT(
  req: NextRequest,
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

  const body = await req.json();
  const setDoc: Record<string, unknown> = {};
  if (typeof body.title === 'string') setDoc.title = body.title.trim();
  if (typeof body.description === 'string') setDoc.description = body.description.trim();
  if (body.thumbnail !== undefined) setDoc.thumbnail = body.thumbnail || null;

  if (Object.keys(setDoc).length === 0) {
    return NextResponse.json({ success: true });
  }

  const db = await getDb();
  await db.collection('courses').updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
  return NextResponse.json({ success: true });
}

// DELETE /api/elearning/courses/[id] — delete course + videos + progress + comments (admin)
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

  await db.collection('course_videos').deleteMany({ course_id: id });
  await db.collection('course_progress').deleteMany({ course_id: id });
  await db.collection('course_comments').deleteMany({ video_id: { $in: videoIds } });
  await db.collection('courses').deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ success: true });
}
