export interface LessonFile {
  url: string;
  name: string;
  mime_type: string;
  size: number;
  category: 'video' | 'document' | 'image' | 'other';
}

export function sanitizeFiles(raw: unknown): LessonFile[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.length > 5) return null;
  const clean: LessonFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const f = item as Record<string, unknown>;
    if (typeof f.url !== 'string' || typeof f.name !== 'string') return null;
    const mime = typeof f.mime_type === 'string' ? f.mime_type : 'application/octet-stream';
    const size = typeof f.size === 'number' ? f.size : 0;
    let category: LessonFile['category'] = 'other';
    if (mime.startsWith('video/')) category = 'video';
    else if (mime.startsWith('image/')) category = 'image';
    else if (mime === 'application/pdf' || /word|excel|sheet|document/.test(mime)) category = 'document';
    clean.push({ url: f.url, name: f.name, mime_type: mime, size, category });
  }
  return clean;
}

export function categoryFromMime(mime: string): LessonFile['category'] {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /word|excel|sheet|document/.test(mime)) return 'document';
  return 'other';
}
