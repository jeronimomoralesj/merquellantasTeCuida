/**
 * Fondo cycle period helpers.
 * Each month has TWO cycles:
 *   - "A" cycle: covers days 1-15 of the month (first quincena)
 *   - "B" cycle: covers days 16-end of month (second quincena)
 *
 * The submission window for each cycle is roughly 7 days before its
 * payment date (1st or 30th of the month) and during the cycle itself.
 * For simplicity we treat the current periodo as the half of the month
 * we're currently in.
 */

export function getCurrentCyclePeriodo(now: Date = new Date()): string {
  const day = now.getDate();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const half = day <= 15 ? 'A' : 'B';
  return `${year}-${month}-${half}`;
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
