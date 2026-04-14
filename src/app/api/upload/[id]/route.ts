import { NextRequest, NextResponse } from 'next/server';
import { GridFSBucket, ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const maxDuration = 60;

// GET /api/upload/[id] — serve a stored file (GridFS with legacy base64 fallback)
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
  const objectId = new ObjectId(id);
  const download = req.nextUrl.searchParams.get('download') === '1';

  // Try GridFS first
  const gridFile = await db.collection('uploads.files').findOne({ _id: objectId });
  if (gridFile) {
    const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    const downloadStream = bucket.openDownloadStream(objectId);

    const disposition = download ? 'attachment' : 'inline';
    const headers: Record<string, string> = {
      'Content-Type': gridFile.metadata?.contentType || gridFile.contentType || 'application/octet-stream',
      'Content-Length': String(gridFile.length),
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(gridFile.filename)}"`,
    };

    const webStream = new ReadableStream({
      start(controller) {
        downloadStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        downloadStream.on('end', () => controller.close());
        downloadStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        downloadStream.destroy();
      },
    });

    return new NextResponse(webStream, { status: 200, headers });
  }

  // Legacy base64 fallback
  const file = await db.collection('file_uploads').findOne({ _id: objectId });
  if (!file) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
  }

  const buffer = Buffer.from(file.data, 'base64');
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
