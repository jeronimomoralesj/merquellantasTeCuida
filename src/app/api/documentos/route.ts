import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

// GET /api/documentos — list all documents
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const results = await db.collection('documentos').find({}).sort({ date_uploaded: -1 }).toArray();
  return NextResponse.json(results);
}

// POST /api/documentos — create document record (admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const db = await getDb();

  const result = await db.collection('documentos').insertOne({
    name: body.name,
    category: body.category,
    document: body.document,
    size: body.size || null,
    type: body.type || 'other',
    date_uploaded: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString() });
}

// DELETE /api/documentos — delete document (admin)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }
  const db = await getDb();
  const result = await db.collection('documentos').deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
