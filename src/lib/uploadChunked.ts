const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB — stays under Vercel's 4.5MB body limit

export interface ChunkedUploadResult {
  url: string;
  webUrl: string;
  name: string;
  id: string;
}

export interface ChunkedUploadOptions {
  folder: string;
  onProgress?: (pct: number) => void;
}

// Upload a file in small chunks so each request stays under Vercel's
// serverless-function request body limit. Server reassembles into GridFS.
export async function uploadFileChunked(
  file: File,
  { folder, onProgress }: ChunkedUploadOptions
): Promise<ChunkedUploadResult> {
  const uploadId =
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const fd = new FormData();
    fd.append('upload_id', uploadId);
    fd.append('chunk_index', String(i));
    fd.append('file', chunk, file.name);

    const res = await fetch('/api/upload/chunk', { method: 'POST', body: fd });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg.error || `Chunk ${i + 1}/${totalChunks} falló (HTTP ${res.status})`);
    }
    onProgress?.(Math.round(((i + 1) / totalChunks) * 95));
  }

  const finishRes = await fetch('/api/upload/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_id: uploadId,
      total_chunks: totalChunks,
      file_name: file.name,
      file_type: file.type,
      folder,
    }),
  });
  if (!finishRes.ok) {
    const msg = await finishRes.json().catch(() => ({}));
    throw new Error(msg.error || 'Error al finalizar la subida');
  }

  onProgress?.(100);
  return (await finishRes.json()) as ChunkedUploadResult;
}
