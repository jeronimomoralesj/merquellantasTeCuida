import { NextRequest, NextResponse } from 'next/server';
import { Binary } from 'mongodb';
import { getDb } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const maxDuration = 60;

// POST /api/upload/chunk — store one chunk of a chunked upload.
// FormData: upload_id, chunk_index (number), file (Blob)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const form = await req.formData();
  const uploadId = form.get('upload_id') as string | null;
  const chunkIndexRaw = form.get('chunk_index') as string | null;
  const blob = form.get('file') as File | null;

  if (!uploadId || chunkIndexRaw == null || !blob) {
    return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 });
  }

  const chunkIndex = Number(chunkIndexRaw);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: 'chunk_index inválido' }, { status: 400 });
  }

  // Cap each chunk at 4MB to stay under Vercel's body limit.
  if (blob.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Chunk demasiado grande' }, { status: 400 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const db = await getDb();

  await db.collection('upload_chunks').updateOne(
    { upload_id: uploadId, chunk_index: chunkIndex, uploaded_by: session.user.id },
    {
      $set: {
        upload_id: uploadId,
        chunk_index: chunkIndex,
        uploaded_by: session.user.id,
        data: new Binary(buffer),
        created_at: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}
