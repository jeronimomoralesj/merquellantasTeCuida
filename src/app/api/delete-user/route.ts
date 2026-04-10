import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const db = await getDb();

    // Delete related records first
    await db.collection('calendar').deleteMany({ user_id: id });
    await db.collection('solicitudes').deleteMany({ user_id: id });
    await db.collection('cesantias').deleteMany({ user_id: id });
    await db.collection('pqrsf').deleteMany({ user_id: id });

    // Delete the user by _id (ObjectId)
    await db.collection('users').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete user error');
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
