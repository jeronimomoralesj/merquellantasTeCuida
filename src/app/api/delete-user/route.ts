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
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    if (id === session.user.id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });
    }

    const db = await getDb();

    // Resolve the user — accept ObjectId, cedula, or email as identifier
    let user = null;
    if (ObjectId.isValid(id)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(id) });
    }
    if (!user) user = await db.collection('users').findOne({ cedula: id });
    if (!user) user = await db.collection('users').findOne({ email: id });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userIdStr = user._id.toString();

    // Delete related records first
    await db.collection('calendar').deleteMany({ user_id: userIdStr });
    await db.collection('solicitudes').deleteMany({ user_id: userIdStr });
    await db.collection('cesantias').deleteMany({ user_id: userIdStr });
    await db.collection('pqrsf').deleteMany({ user_id: userIdStr });
    await db.collection('fondo_members').deleteMany({ user_id: userIdStr });
    await db.collection('fondo_aportes').deleteMany({ user_id: userIdStr });
    await db.collection('fondo_actividad').deleteMany({ user_id: userIdStr });
    await db.collection('fondo_cartera').deleteMany({ user_id: userIdStr });
    await db.collection('fondo_retiros').deleteMany({ user_id: userIdStr });

    // Delete the user
    await db.collection('users').deleteOne({ _id: user._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error');
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
