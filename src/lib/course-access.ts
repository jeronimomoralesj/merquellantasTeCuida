import type { Db } from 'mongodb';

/**
 * Course audience model. Supports three targeting modes:
 *   - "all"     → everyone (default)
 *   - "areas"   → members of one or more áreas (e.g. Administrativo, Call Center)
 *   - "users"   → explicit list of user ids
 *
 * The legacy "cargos" type is still accepted for reads so courses saved under the
 * old per-cargo model keep working until an admin re-saves them. New writes should
 * use "areas".
 */
export interface CourseAudience {
  type: 'all' | 'areas' | 'cargos' | 'users';
  areas?: string[];
  /** @deprecated Preserved for legacy courses; new ones use `areas`. */
  cargos?: string[];
  user_ids?: string[];
}

export function sanitizeAudience(raw: unknown): CourseAudience {
  if (!raw || typeof raw !== 'object') return { type: 'all' };
  const a = raw as Record<string, unknown>;
  const type =
    a.type === 'areas' || a.type === 'cargos' || a.type === 'users' ? a.type : 'all';

  const areas = Array.isArray(a.areas)
    ? a.areas.filter((x) => typeof x === 'string').slice(0, 100)
    : [];
  const cargos = Array.isArray(a.cargos)
    ? a.cargos.filter((x) => typeof x === 'string').slice(0, 100)
    : [];
  const user_ids = Array.isArray(a.user_ids)
    ? a.user_ids.filter((x) => typeof x === 'string').slice(0, 500)
    : [];

  if (type === 'areas') return { type, areas };
  if (type === 'cargos') return { type, cargos };
  if (type === 'users') return { type, user_ids };
  return { type: 'all' };
}

export async function canUserAccessCourse(
  _db: Db,
  audience: CourseAudience | undefined,
  userId: string,
  userRol: string,
  userCargo: string | null,
  userArea: string | null = null
): Promise<boolean> {
  if (userRol === 'admin') return true;
  if (!audience || audience.type === 'all') return true;
  if (audience.type === 'areas') {
    if (!userArea) return false;
    return (audience.areas || []).includes(userArea);
  }
  if (audience.type === 'cargos') {
    // Legacy courses still restrict by cargo until an admin re-saves them as areas.
    if (!userCargo) return false;
    return (audience.cargos || []).includes(userCargo);
  }
  if (audience.type === 'users') {
    return (audience.user_ids || []).includes(userId);
  }
  return true;
}
