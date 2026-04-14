import { NextRequest, NextResponse } from 'next/server';
import { GridFSBucket, Binary } from 'mongodb';
import { Readable } from 'stream';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Binary) {
    // driver v6+: Binary.buffer is a Buffer
    const b = (data as Binary & { buffer: Buffer }).buffer;
    if (Buffer.isBuffer(b)) return b;
    return Buffer.from(b);
  }
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data && typeof data === 'object' && 'buffer' in data) {
    const inner = (data as { buffer: unknown }).buffer;
    if (Buffer.isBuffer(inner)) return inner;
    if (inner instanceof ArrayBuffer) return Buffer.from(inner);
    if (inner instanceof Uint8Array) return Buffer.from(inner);
  }
  throw new Error('Tipo de chunk no soportado');
}

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
  try {
    return await handle(req);
  } catch (err) {
    console.error('[upload/finish] unhandled error', err);
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handle(req: NextRequest) {
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

  let combined: Buffer;
  try {
    const buffers = chunks.map((c) => toBuffer(c.data));
    combined = Buffer.concat(buffers);
  } catch (err) {
    console.error('[upload/finish] buffer concat failed', err);
    return NextResponse.json({ error: 'Error procesando los chunks' }, { status: 500 });
  }

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

  try {
    await new Promise<void>((resolve, reject) => {
      Readable.from(combined).pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });
  } catch (err) {
    console.error('[upload/finish] GridFS write failed', err);
    return NextResponse.json({ error: 'Error al guardar el archivo' }, { status: 500 });
  }

  // Cleanup temp chunks (best-effort)
  try {
    await db.collection('upload_chunks').deleteMany({ upload_id, uploaded_by: session.user.id });
  } catch (err) {
    console.error('[upload/finish] chunk cleanup failed', err);
  }

  const fileId = uploadStream.id.toString();
  const fileUrl = `/api/upload/${fileId}`;

  return NextResponse.json({
    url: fileUrl,
    webUrl: fileUrl,
    name: file_name,
    id: fileId,
  });
}
