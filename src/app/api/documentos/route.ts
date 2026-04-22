import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../lib/auth';

const VALID_KINDS = new Set(['regular', 'policy']);

/**
 * GET /api/documentos[?kind=regular|policy]
 *
 * Returns all documents, optionally filtered by kind. Legacy records missing the
 * `kind` field are treated as "regular" so nothing from before this change hides.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const kind = req.nextUrl.searchParams.get('kind');
  const filter: Record<string, unknown> = {};
  if (kind === 'policy') {
    filter.kind = 'policy';
  } else if (kind === 'regular') {
    // Match both explicit 'regular' and legacy docs with no kind field.
    filter.$or = [{ kind: 'regular' }, { kind: { $exists: false } }, { kind: null }];
  }

  const db = await getDb();
  const results = await db
    .collection('documentos')
    .find(filter)
    .sort({ date_uploaded: -1 })
    .toArray();
  return NextResponse.json(results);
}

/**
 * POST /api/documentos — admins/fondo create a document record (the file has already
 * been uploaded via /api/upload; this stores the metadata + URL). Accepts an optional
 * `kind` of 'regular' (default) or 'policy' which splits the listing into two panes.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'admin' && session.user.rol !== 'fondo')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const kind = typeof body.kind === 'string' && VALID_KINDS.has(body.kind) ? body.kind : 'regular';

  const db = await getDb();

  const result = await db.collection('documentos').insertOne({
    name: body.name,
    category: body.category,
    document: body.document,
    size: body.size || null,
    type: body.type || 'other',
    kind,
    date_uploaded: new Date(),
  });

  return NextResponse.json({ success: true, id: result.insertedId.toString(), kind });
}

/**
 * DELETE /api/documentos — admins/fondo remove a record. The underlying file in
 * OneDrive is not auto-deleted; clean that up separately if needed.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.rol !== 'admin' && session.user.rol !== 'fondo')) {
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
