import type { Db } from 'mongodb';

export interface CourseAudience {
  type: 'all' | 'cargos' | 'users';
  cargos?: string[];
  user_ids?: string[];
}

export function sanitizeAudience(raw: unknown): CourseAudience {
  if (!raw || typeof raw !== 'object') return { type: 'all' };
  const a = raw as Record<string, unknown>;
  const type = a.type === 'cargos' || a.type === 'users' ? a.type : 'all';
  const cargos = Array.isArray(a.cargos) ? a.cargos.filter((x) => typeof x === 'string').slice(0, 100) : [];
  const user_ids = Array.isArray(a.user_ids) ? a.user_ids.filter((x) => typeof x === 'string').slice(0, 500) : [];
  if (type === 'cargos') return { type, cargos };
  if (type === 'users') return { type, user_ids };
  return { type: 'all' };
}

export async function canUserAccessCourse(
  db: Db,
  audience: CourseAudience | undefined,
  userId: string,
  userRol: string,
  userCargo: string | null
): Promise<boolean> {
  if (userRol === 'admin') return true;
  if (!audience || audience.type === 'all') return true;
  if (audience.type === 'cargos') {
    if (!userCargo) return false;
    return (audience.cargos || []).includes(userCargo);
  }
  if (audience.type === 'users') {
    return (audience.user_ids || []).includes(userId);
  }
  return true;
}
