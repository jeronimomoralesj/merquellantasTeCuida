import { NextRequest, NextResponse } from 'next/server';
import { GridFSBucket } from 'mongodb';
import { Readable } from 'stream';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.mov',
]);

// POST /api/upload/finish — assemble chunks into a GridFS file
// Body: { upload_id, total_chunks, file_name, file_type, folder }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { upload_id, total_chunks, file_name, file_type, folder } = body;

  if (!upload_id || typeof total_chunks !== 'number' || total_chunks < 1) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }
  if (!file_name || typeof file_name !== 'string') {
    return NextResponse.json({ error: 'file_name requerido' }, { status: 400 });
  }

  const ext = '.' + (file_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  const db = await getDb();

  const chunks = await db.collection('upload_chunks')
    .find({ upload_id, uploaded_by: session.user.id })
    .sort({ chunk_index: 1 })
    .toArray();

  if (chunks.length !== total_chunks) {
    return NextResponse.json(
      { error: `Faltan chunks (${chunks.length}/${total_chunks})` },
      { status: 400 }
    );
  }

  // Validate continuity
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].chunk_index !== i) {
      return NextResponse.json({ error: 'Chunks fuera de orden' }, { status: 400 });
    }
  }

  const buffers = chunks.map((c) => c.data.buffer ?? Buffer.from(c.data));
  const combined = Buffer.concat(buffers);

  if (combined.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  }
  if (combined.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 50MB' }, { status: 400 });
  }

  const bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  const isCalendar = folder === 'calendar';
  const expiresAt = isCalendar ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : null;

  const uploadStream = bucket.openUploadStream(file_name, {
    metadata: {
      contentType: file_type || 'application/octet-stream',
      folder: folder || 'uploads',
      uploaded_by: session.user.id,
      uploaded_at: new Date(),
      expires_at: expiresAt,
    },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(combined).pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve());
  });

  // Cleanup temp chunks
  await db.collection('upload_chunks').deleteMany({ upload_id, uploaded_by: session.user.id });

  const fileId = uploadStream.id.toString();
  const fileUrl = `/api/upload/${fileId}`;

  return NextResponse.json({
    url: fileUrl,
    webUrl: fileUrl,
    name: file_name,
    id: fileId,
  });
}
