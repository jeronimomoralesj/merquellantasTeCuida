import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const config = {
  api: { bodyParser: false },
};

// Increase body size limit for Next.js App Router
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.mov',
]);

// POST /api/upload — upload a file, store in MongoDB
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'uploads';

  if (!file) {
    return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 25MB' }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  }

  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  const db = await getDb();
  const result = await db.collection('file_uploads').insertOne({
    name: file.name,
    folder,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    data: base64,
    uploaded_by: session.user.id,
    uploaded_at: new Date(),
  });

  const fileId = result.insertedId.toString();
  const fileUrl = `/api/upload/${fileId}`;

  return NextResponse.json({
    url: fileUrl,
    webUrl: fileUrl,
    name: file.name,
    id: fileId,
  });
}
