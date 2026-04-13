import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ObjectId } from 'mongodb';
import { auth } from '../../../../lib/auth';

// GET /api/upload/[id] — serve a stored file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = await getDb();
  const file = await db.collection('file_uploads').findOne({ _id: new ObjectId(id) });

  if (!file) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }

  const buffer = Buffer.from(file.data, 'base64');

  const download = req.nextUrl.searchParams.get('download') === '1';
  const headers: Record<string, string> = {
    'Content-Type': file.mimeType || 'application/octet-stream',
    'Content-Length': buffer.length.toString(),
    'Cache-Control': 'private, max-age=3600',
  };

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(file.name)}"`;
  } else {
    headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(file.name)}"`;
  }

  return new NextResponse(buffer, { status: 200, headers });
}
