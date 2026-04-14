import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { sanitizeAudience, canUserAccessCourse } from '../../../../lib/course-access';

// GET /api/elearning/courses — list courses visible to the current user
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const courses = await db.collection('courses').find({}).sort({ created_at: -1 }).toArray();

  const user = await db.collection('users').findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { cargo_empleado: 1 } }
  );
  const userCargo = (user?.cargo_empleado as string | undefined) || null;
  const rol = session.user.rol;

  const visible = [];
  for (const c of courses) {
    const allowed = await canUserAccessCourse(db, c.audience, session.user.id, rol, userCargo);
    if (!allowed) continue;

    const videoCount = await db.collection('course_videos').countDocuments({ course_id: c._id.toString() });
    const quizCount = await db.collection('course_quizzes').countDocuments({ course_id: c._id.toString() });
    const totalItems = videoCount + quizCount;
    const completedCount = await db.collection('course_progress').countDocuments({
      course_id: c._id.toString(),
      user_id: session.user.id,
    });

    visible.push({
      id: c._id.toString(),
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail || null,
      created_at: c.created_at,
      video_count: totalItems,
      completed_count: completedCount,
      audience: c.audience || { type: 'all' },
    });
  }

  return NextResponse.json(visible);
}

// POST /api/elearning/courses — create course (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
  }

  const audience = sanitizeAudience(body.audience);

  const db = await getDb();
  const result = await db.collection('courses').insertOne({
    title: body.title.trim(),
    description: body.description?.trim() || '',
    thumbnail: body.thumbnail || null,
    audience,
    created_at: new Date(),
    created_by: session.user.id,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}
