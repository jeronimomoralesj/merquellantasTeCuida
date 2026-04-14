import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/elearning/comments?video_id=... — list comments for a video
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const video_id = req.nextUrl.searchParams.get('video_id');
  if (!video_id || !ObjectId.isValid(video_id)) {
    return NextResponse.json({ error: 'video_id inválido' }, { status: 400 });
  }

  const db = await getDb();
  const comments = await db.collection('course_comments')
    .find({ video_id })
    .sort({ created_at: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json(comments.map((c) => ({
    id: c._id.toString(),
    user_id: c.user_id,
    user_name: c.user_name,
    comment: c.comment,
    created_at: c.created_at,
    is_own: c.user_id === session.user.id,
  })));
}

// POST /api/elearning/comments — add a comment
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { video_id, comment } = body;

  if (!video_id || !ObjectId.isValid(video_id)) {
    return NextResponse.json({ error: 'video_id inválido' }, { status: 400 });
  }
  if (!comment?.trim()) {
    return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
  }
  if (comment.length > 2000) {
    return NextResponse.json({ error: 'El comentario es demasiado largo' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection('course_comments').insertOne({
    video_id,
    user_id: session.user.id,
    user_name: session.user.nombre || 'Usuario',
    comment: comment.trim(),
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// DELETE /api/elearning/comments?id=... — delete own comment (or admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const comment = await db.collection('course_comments').findOne({ _id: new ObjectId(id) });
  if (!comment) return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });

  if (comment.user_id !== session.user.id && session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  await db.collection('course_comments').deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ success: true });
}
