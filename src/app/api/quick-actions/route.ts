import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/quick-actions — list active quick actions
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();

  const filter = session.user.rol === 'admin' ? {} : { active: true };
  const results = await db.collection('quick_actions').find(filter).sort({ order: 1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/quick-actions — create (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'Título requerido' }, { status: 400 });
  }
  if (!body.href || typeof body.href !== 'string') {
    return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
  }

  const db = await getDb();

  const result = await db.collection('quick_actions').insertOne({
    title: body.title.slice(0, 255),
    href: body.href,
    icon: body.icon,
    order: body.order || 0,
    active: body.active !== false,
    created_at: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// PUT /api/quick-actions — update (admin)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id, title, href, icon, order, active } = await req.json();
  const db = await getDb();

  await db.collection('quick_actions').updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        title,
        href,
        icon,
        order: order || 0,
        active: !!active,
      },
    }
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/quick-actions — delete (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await req.json();
  const db = await getDb();
  await db.collection('quick_actions').deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ success: true });
}
