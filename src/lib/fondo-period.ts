/**
 * Fondo cycle period helpers.
 * Each month has TWO cycles:
 *   - "A" cycle (1ra quincena): covers days 1–15 of the month
 *   - "B" cycle (2da quincena): covers days 16–end of month
 *
 * The uploads happen AFTER each quincena closes (not during it):
 *   - 1ra quincena is uploaded on/after the 16th of the same month
 *   - 2da quincena is uploaded on the 1st–2nd of the following month
 *
 * So the "current" periodo is the most recently closed half, not the half
 * we happen to be in. See the doc comment history — an earlier version
 * returned the in-progress half, which produced B on the 20th ("2da
 * quincena") when the user was actually uploading that month's 1ra.
 */

export function getCurrentCyclePeriodo(now: Date = new Date()): string {
  const day = now.getDate();
  if (day > 15) {
    // Past the 15th → the current month's 1ra quincena has just closed.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-A`;
  }
  // 1st–15th → the previous month's 2da quincena has just closed. Date
  // handles the year rollover (month -1 of January becomes December of the
  // previous year).
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = String(prev.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-B`;
}

export function formatPeriodoLabel(periodo: string): string {
  const parts = periodo.split('-');
  if (parts.length < 3) return periodo;
  const [year, month, half] = parts;
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const monthLabel = monthNames[parseInt(month) - 1] || month;
  const halfLabel = half === 'A' ? '1ra quincena' : '2da quincena';
  return `${halfLabel} de ${monthLabel} ${year}`;
}
