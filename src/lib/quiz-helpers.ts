export interface QuestionInput {
  question: string;
  options: { text: string; is_correct: boolean }[];
}

export function sanitizeQuestions(raw: unknown): QuestionInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const clean: QuestionInput[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') return null;
    const item = q as Record<string, unknown>;
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    if (!question) return null;
    const opts = Array.isArray(item.options) ? item.options : null;
    if (!opts || opts.length < 2 || opts.length > 6) return null;
    const cleanOpts: { text: string; is_correct: boolean }[] = [];
    for (const o of opts) {
      if (!o || typeof o !== 'object') return null;
      const oo = o as Record<string, unknown>;
      const text = typeof oo.text === 'string' ? oo.text.trim() : '';
      if (!text) return null;
      cleanOpts.push({ text, is_correct: !!oo.is_correct });
    }
    if (!cleanOpts.some((o) => o.is_correct)) return null;
    clean.push({ question, options: cleanOpts });
  }
  return clean;
}
