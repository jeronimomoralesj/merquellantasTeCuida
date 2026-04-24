/**
 * Festivos nacionales de Colombia — calculados a partir de la fecha de
 * Semana Santa + Ley Emiliani. Se usan para excluir días no laborables
 * del cálculo de vacaciones (los domingos también se excluyen por
 * separado en countVacationDays).
 *
 * 18 festivos por año:
 *   - 6 fijos:  1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic
 *   - 9 Ley Emiliani (movidos al lunes siguiente):
 *       6 ene (Reyes), 19 mar (San José), 29 jun (San Pedro y San Pablo),
 *       15 ago (Asunción), 12 oct (Día de la Raza),
 *       1 nov (Todos los Santos), 11 nov (Independencia de Cartagena),
 *       + Ascensión (Easter+39), Corpus Christi (Easter+60),
 *       Sagrado Corazón (Easter+68) — observados al lunes siguiente.
 *   - 2 relativos a la Pascua (no se mueven):
 *       Jueves Santo (Easter-3), Viernes Santo (Easter-2).
 *
 * Colección `colombia_festivos` es sólo informativa y la llenamos al vuelo
 * (ver scripts/seed-festivos.ts); el cálculo real vive acá para mantener
 * las rutas rápidas y offline-friendly.
 */

/** Algoritmo anónimo gregoriano para calcular el Domingo de Pascua. */
function easterDateUTC(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Corre al lunes siguiente (o se queda si ya es lunes). */
function moveToNextMondayUTC(d: Date): Date {
  const dow = d.getUTCDay(); // 0=dom, 1=lun, ..., 6=sáb
  if (dow === 1) return d;
  const addend = (8 - dow) % 7; // cuántos días faltan para el lunes
  return addDaysUTC(d, addend);
}

function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Devuelve todos los festivos del año como Set<ISO> (YYYY-MM-DD). */
export function getColombianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const easter = easterDateUTC(year);

  // Fijos
  holidays.add(`${year}-01-01`);
  holidays.add(`${year}-05-01`);
  holidays.add(`${year}-07-20`);
  holidays.add(`${year}-08-07`);
  holidays.add(`${year}-12-08`);
  holidays.add(`${year}-12-25`);

  // Ley Emiliani: fechas fijas trasladadas al siguiente lunes
  const pinnedEmiliani: Array<[number, number]> = [
    [1, 6],   // Reyes Magos
    [3, 19],  // San José
    [6, 29],  // San Pedro y San Pablo
    [8, 15],  // Asunción de la Virgen
    [10, 12], // Día de la Raza
    [11, 1],  // Todos los Santos
    [11, 11], // Independencia de Cartagena
  ];
  for (const [m, d] of pinnedEmiliani) {
    holidays.add(isoUTC(moveToNextMondayUTC(new Date(Date.UTC(year, m - 1, d)))));
  }

  // Relativos a la Pascua, SIN mover
  holidays.add(isoUTC(addDaysUTC(easter, -3))); // Jueves Santo
  holidays.add(isoUTC(addDaysUTC(easter, -2))); // Viernes Santo

  // Relativos a la Pascua CON Ley Emiliani (se observan el lunes siguiente)
  //   Ascensión original = Easter + 39 (jueves) → +4 → +43
  //   Corpus original    = Easter + 60 (jueves) → +4 → +64
  //   Sagrado Corazón    = Easter + 68 (viernes) → +3 → +71
  holidays.add(isoUTC(addDaysUTC(easter, 43)));
  holidays.add(isoUTC(addDaysUTC(easter, 64)));
  holidays.add(isoUTC(addDaysUTC(easter, 71)));

  return holidays;
}

/** True si la fecha cae en un festivo colombiano. */
export function isColombianHoliday(dateIso: string): boolean {
  const d = new Date(dateIso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  return getColombianHolidays(d.getUTCFullYear()).has(isoUTC(d));
}

/**
 * Cuenta los días de vacaciones entre dos fechas inclusive, excluyendo
 * domingos y festivos nacionales. Las fechas se interpretan como locales
 * (YYYY-MM-DD) sin zona horaria para evitar sorpresas por UTC en
 * `fechaInicio`/`fechaFin` seleccionadas en un input type="date".
 */
export function countVacationDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end || end < start) return 0;

  // Recolectamos festivos de los años tocados por el rango (casi siempre 1).
  const holidaysPorAño = new Map<number, Set<string>>();
  const getHolidays = (y: number) => {
    let s = holidaysPorAño.get(y);
    if (!s) { s = getColombianHolidays(y); holidaysPorAño.set(y, s); }
    return s;
  };

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    const iso = isoUTC(cur);
    const isSunday = dow === 0;
    const isHoliday = getHolidays(cur.getUTCFullYear()).has(iso);
    if (!isSunday && !isHoliday) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** Parser local para 'YYYY-MM-DD' → Date UTC (misma fecha, 00:00Z). */
function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}
