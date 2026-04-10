import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { uploadToOneDrive } from '../../../lib/onedrive';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.webm', '.mov',
]);
const ALLOWED_FOLDERS = new Set([
  'uploads', 'permisos', 'vacaciones', 'incapacidad',
  'cesantias', 'documentos', 'calendar',
]);

// POST /api/upload — upload a file to OneDrive
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'uploads';

  if (!file) {
    return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 25MB' }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  }

  // Validate file extension
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  // Validate folder (prevent path traversal)
  const safeFolder = ALLOWED_FOLDERS.has(folder) ? folder : 'uploads';

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadToOneDrive(buffer, file.name, safeFolder);

  return NextResponse.json({
    webUrl: result.webUrl,
    name: result.name,
    id: result.id,
  });
}
