import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../../../lib/db';
import { auth } from '../../../../../../lib/auth';

// PUT /api/elearning/courses/[id]/reorder
// Body: { items: [{ type: 'video'|'quiz', id }] } — order is implied by array index
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
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items requerido' }, { status: 400 });
  }

  const db = await getDb();
  const course = await db.collection('courses').findOne({ _id: new ObjectId(id) });
  if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

  // Validate ownership: every id must belong to this course
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i] as { type?: string; id?: string };
    if (!it || typeof it.id !== 'string' || !ObjectId.isValid(it.id)) {
      return NextResponse.json({ error: `Item inválido en índice ${i}` }, { status: 400 });
    }
    if (it.type !== 'video' && it.type !== 'quiz') {
      return NextResponse.json({ error: `Tipo inválido en índice ${i}` }, { status: 400 });
    }
  }

  for (let i = 0; i < body.items.length; i++) {
    const { type, id: itemId } = body.items[i] as { type: 'video' | 'quiz'; id: string };
    const collection = type === 'video' ? 'course_videos' : 'course_quizzes';
    await db.collection(collection).updateOne(
      { _id: new ObjectId(itemId), course_id: id },
      { $set: { order: i } }
    );
  }

  return NextResponse.json({ success: true });
}
