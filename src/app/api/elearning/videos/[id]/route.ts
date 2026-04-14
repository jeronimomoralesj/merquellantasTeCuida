import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../lib/db';
import { auth } from '../../../../../lib/auth';
import { sanitizeFiles } from '../../../../../lib/lesson-files';

// PUT /api/elearning/videos/[id] — update lesson (admin)
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
  if (typeof body.order === 'number') setDoc.order = body.order;

  if (body.files !== undefined) {
    const files = sanitizeFiles(body.files);
    if (!files) {
      return NextResponse.json({ error: 'Se requiere al menos 1 archivo (máx 5)' }, { status: 400 });
    }
    if (!files.some((f) => f.category === 'video')) {
      return NextResponse.json({ error: 'La lección debe incluir al menos un video' }, { status: 400 });
    }
    const primaryVideo = files.find((f) => f.category === 'video')!;
    setDoc.files = files;
    setDoc.video_url = primaryVideo.url;
  }

  if (Object.keys(setDoc).length === 0) {
    return NextResponse.json({ success: true });
  }

  const db = await getDb();
  await db.collection('course_videos').updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
  return NextResponse.json({ success: true });
}

// DELETE /api/elearning/videos/[id] — delete lesson (admin)
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
  await db.collection('course_videos').deleteOne({ _id: new ObjectId(id) });
  await db.collection('course_progress').deleteMany({ video_id: id });
  await db.collection('course_comments').deleteMany({ video_id: id });
  return NextResponse.json({ success: true });
}
