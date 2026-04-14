import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

// GET /api/elearning/courses — list all courses with video counts
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const courses = await db.collection('courses').find({}).sort({ created_at: -1 }).toArray();

  const withCounts = await Promise.all(
    courses.map(async (c) => {
      const videoCount = await db.collection('course_videos').countDocuments({ course_id: c._id.toString() });
      const completedCount = await db.collection('course_progress').countDocuments({
        course_id: c._id.toString(),
        user_id: session.user.id,
      });
      return {
        id: c._id.toString(),
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail || null,
        created_at: c.created_at,
        video_count: videoCount,
        completed_count: completedCount,
      };
    })
  );

  return NextResponse.json(withCounts);
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

  const db = await getDb();
  const result = await db.collection('courses').insertOne({
    title: body.title.trim(),
    description: body.description?.trim() || '',
    thumbnail: body.thumbnail || null,
    created_at: new Date(),
    created_by: session.user.id,
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}
