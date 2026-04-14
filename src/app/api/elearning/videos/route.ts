import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { sanitizeFiles } from '../../../../lib/lesson-files';

// POST /api/elearning/videos — create lesson in a course (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.course_id || !ObjectId.isValid(body.course_id)) {
    return NextResponse.json({ error: 'course_id inválido' }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
  }

  const files = sanitizeFiles(body.files);
  if (!files) {
    return NextResponse.json({ error: 'Máximo 5 archivos por lección' }, { status: 400 });
  }

  const db = await getDb();
  const courseExists = await db.collection('courses').findOne({ _id: new ObjectId(body.course_id) });
  if (!courseExists) {
    return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
  }

  const lastOrder = await db.collection('course_videos')
    .find({ course_id: body.course_id })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  const nextOrder = lastOrder.length > 0 ? (lastOrder[0].order ?? 0) + 1 : 0;

  const primaryVideo = files.find((f) => f.category === 'video') || null;

  const result = await db.collection('course_videos').insertOne({
    course_id: body.course_id,
    title: body.title.trim(),
    description: body.description?.trim() || '',
    video_url: primaryVideo?.url || null,
    files,
    order: typeof body.order === 'number' ? body.order : nextOrder,
    created_at: new Date(),
    created_by: session.user.id,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}
