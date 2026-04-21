import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Template fields correspond to each cell in the DIAN Formato 220 certificate.
 * These keys are stable. Admins can rename columns, add custom ones, or unmap/remap
 * them — but the certificate download only prints fields that map to a known key.
 */
export interface TemplateFieldDef {
  key: string;
  label: string;
  /** Certificate cell in the "Cert ing y ret" sheet (A1 notation). null if not on cert. */
  certCell: string | null;
  /** Matching Datos empleados column (A1) if we want to populate that sheet too. */
  datosCol: string | null;
  /** `number` for currency/figure fields, `date` for dates, `text` for identity. */
  kind: 'text' | 'number' | 'date' | 'code';
}

export const TEMPLATE_FIELDS: TemplateFieldDef[] = [
  // --- Identity (cedula is the lookup key; everything else from Datos empleados) ---
  { key: 'cedula',            label: 'Número de identificación',           certCell: 'AC5', datosCol: 'A', kind: 'code' },
  { key: 'tipoDocumento',     label: 'Código tipo de documento',           certCell: null,  datosCol: null, kind: 'code' },
  { key: 'primerApellido',    label: 'Primer apellido',                    certCell: 'S15', datosCol: 'C', kind: 'text' },
  { key: 'segundoApellido',   label: 'Segundo apellido',                   certCell: 'X15', datosCol: 'D', kind: 'text' },
  { key: 'primerNombre',      label: 'Primer nombre',                      certCell: 'AD15', datosCol: 'E', kind: 'text' },
  { key: 'otrosNombres',      label: 'Otros nombres',                      certCell: 'AI15', datosCol: 'F', kind: 'text' },

  // --- Period (defaults populated if not provided) ---
  { key: 'fechaInicial',      label: 'Fecha inicial del período',          certCell: 'E18', datosCol: 'G', kind: 'date' },
  { key: 'fechaFinal',        label: 'Fecha final del período',            certCell: 'L18', datosCol: 'H', kind: 'date' },

  // --- Ingresos (36 – 51) ---
  { key: 'pagosSalarios',                 label: '36. Pagos por salarios',                              certCell: 'AC21', datosCol: 'I',  kind: 'number' },
  { key: 'pagosBonosEtc',                 label: '37. Pagos con bonos electrónicos, cheques, vales, etc.', certCell: 'AC22', datosCol: 'J',  kind: 'number' },
  { key: 'valorExcesoAlimentacion',       label: '38. Valor del exceso de los pagos por alimentación (>41 UVT)', certCell: 'AC23', datosCol: 'K',  kind: 'number' },
  { key: 'pagosHonorarios',               label: '39. Pagos por honorarios',                            certCell: 'AC24', datosCol: 'L',  kind: 'number' },
  { key: 'pagosServicios',                label: '40. Pagos por servicios',                             certCell: 'AC25', datosCol: 'M',  kind: 'number' },
  { key: 'pagosComisiones',               label: '41. Pagos por comisiones',                            certCell: 'AC26', datosCol: 'N',  kind: 'number' },
  { key: 'pagosPrestacionesSociales',     label: '42. Pagos por prestaciones sociales',                 certCell: 'AC27', datosCol: 'O',  kind: 'number' },
  { key: 'pagosViaticos',                 label: '43. Pagos por viáticos',                              certCell: 'AC28', datosCol: 'P',  kind: 'number' },
  { key: 'pagosGastosRepresentacion',     label: '44. Pagos por gastos de representación',              certCell: 'AC29', datosCol: 'Q',  kind: 'number' },
  { key: 'pagosCompensacionCoop',         label: '45. Pagos por compensación trabajo asociado cooperativo', certCell: 'AC30', datosCol: 'R',  kind: 'number' },
  { key: 'otrosPagos',                    label: '46. Otros pagos',                                     certCell: 'AC31', datosCol: 'S',  kind: 'number' },
  { key: 'auxilioCesantiasEIntereses',    label: '47. Auxilio de cesantías e intereses de cesantías efectivamente pagadas', certCell: 'AC32', datosCol: 'T',  kind: 'number' },
  { key: 'auxilioCesantiaRegimenTradicional', label: '48. Auxilio de cesantía reconocido (régimen tradicional CST)', certCell: 'AC33', datosCol: 'U',  kind: 'number' },
  { key: 'auxilioCesantiaConsignadas',    label: '49. Auxilio de cesantías consignadas al fondo',       certCell: 'AC34', datosCol: 'V',  kind: 'number' },
  { key: 'pensiones',                     label: '50. Pensiones de jubilación, vejez o invalidez',      certCell: 'AC35', datosCol: 'W',  kind: 'number' },
  { key: 'apoyosEducativos',              label: '51. Apoyos económicos educativos financiados con recursos públicos', certCell: 'AC36', datosCol: 'X',  kind: 'number' },

  // --- Aportes (53 – 60) ---
  { key: 'aportesSalud',                  label: '53. Aportes obligatorios por salud a cargo del trabajador', certCell: 'AC39', datosCol: 'Y',  kind: 'number' },
  { key: 'aportesPension',                label: '54. Aportes obligatorios a fondos de pensiones y solidaridad pensional', certCell: 'AC40', datosCol: 'Z',  kind: 'number' },
  { key: 'cotizacionesVoluntariasRAIS',   label: '55. Cotizaciones voluntarias al régimen de ahorro individual (RAIS)', certCell: 'AC41', datosCol: 'AA', kind: 'number' },
  { key: 'aportesVoluntariosPension',     label: '56. Aportes voluntarios a fondos de pensiones',       certCell: 'AC42', datosCol: 'AB', kind: 'number' },
  { key: 'aportesAFC',                    label: '57. Aportes a cuentas AFC',                           certCell: 'AC43', datosCol: 'AC', kind: 'number' },
  { key: 'aportesAVC',                    label: '58. Aportes a cuentas AVC',                           certCell: 'AC44', datosCol: 'AD', kind: 'number' },
  { key: 'ingresoLaboralPromedio6m',      label: '59. Ingreso laboral promedio últimos 6 meses',        certCell: 'AC45', datosCol: 'AE', kind: 'number' },
  { key: 'valorRetencionFuente',          label: '60. Valor de la retención en la fuente',              certCell: 'AC46', datosCol: 'AF', kind: 'number' },

  // --- Dependiente (79 – 82) ---
  { key: 'tipoDocDependiente',            label: '79. Tipo de documento del dependiente',               certCell: 'A73',  datosCol: 'AK', kind: 'text' },
  { key: 'numDocDependiente',             label: '80. Número de documento del dependiente',             certCell: 'G73',  datosCol: 'AL', kind: 'text' },
  { key: 'nombreDependiente',             label: '81. Apellidos y nombres del dependiente',             certCell: 'N73',  datosCol: 'AM', kind: 'text' },
  { key: 'parentescoDependiente',         label: '82. Parentesco del dependiente',                      certCell: 'AF73', datosCol: 'AN', kind: 'text' },
];

export const TEMPLATE_FIELD_MAP: Record<string, TemplateFieldDef> = Object.fromEntries(
  TEMPLATE_FIELDS.map((f) => [f.key, f])
);

/** Normalise a string for fuzzy column-name matching (NFD, strip accents, lowercase, collapse ws). */
export function norm(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Guess the TEMPLATE_FIELDS key for a raw column header from an uploaded EXOGENA sheet.
 * Returns null if no confident match.
 */
export function guessTemplateFieldForHeader(header: string): string | null {
  const n = norm(header);
  if (!n) return null;

  // Direct substring hits ordered from most specific to most general.
  const rules: [string, string][] = [
    ['numero de identificacion', 'cedula'],
    ['numero identificacion', 'cedula'],
    ['cedula del beneficiario', 'cedula'],
    ['tipo de documento del beneficiario', 'tipoDocumento'],
    ['primer apellido', 'primerApellido'],
    ['segundo apellido', 'segundoApellido'],
    ['primer nombre', 'primerNombre'],
    ['otros nombres', 'otrosNombres'],
    ['pagos por salarios', 'pagosSalarios'],
    ['bonos electronicos', 'pagosBonosEtc'],
    ['exceso de los pagos por alimentacion', 'valorExcesoAlimentacion'],
    ['pagos por honorarios', 'pagosHonorarios'],
    ['pagos por servicios', 'pagosServicios'],
    ['pagos por comisiones', 'pagosComisiones'],
    ['pagos por prestaciones sociales', 'pagosPrestacionesSociales'],
    ['pagos por viaticos', 'pagosViaticos'],
    ['pagos por gastos de representacion', 'pagosGastosRepresentacion'],
    ['compensaciones trabajo asociado cooperativo', 'pagosCompensacionCoop'],
    ['compensacion por el trabajo asociado', 'pagosCompensacionCoop'],
    ['apoyos economicos', 'apoyosEducativos'],
    ['otros pagos', 'otrosPagos'],
    ['cesantias consignadas al fondo', 'auxilioCesantiaConsignadas'],
    ['cesantias e intereses de cesantias efectivamente', 'auxilioCesantiasEIntereses'],
    ['auxilio de cesantias reconocido', 'auxilioCesantiaRegimenTradicional'],
    ['pensiones de jubilacion', 'pensiones'],
    ['aportes obligatorios por salud', 'aportesSalud'],
    ['aportes obligatorios a fondos de pensiones', 'aportesPension'],
    ['aportes voluntarios al regimen de ahorro', 'cotizacionesVoluntariasRAIS'],
    ['aportes voluntarios a fondos de pensiones', 'aportesVoluntariosPension'],
    ['aportes a cuentas afc', 'aportesAFC'],
    ['aportes a cuentas avc', 'aportesAVC'],
    ['retenciones en la fuente por pagos de rentas de trabajo', 'valorRetencionFuente'],
    ['valor de las retenciones en la fuente', 'valorRetencionFuente'],
    ['ingreso laboral promedio', 'ingresoLaboralPromedio6m'],
    ['tipo de documento del dependiente', 'tipoDocDependiente'],
    ['numero de identificacion del dependiente', 'numDocDependiente'],
  ];
  for (const [needle, key] of rules) {
    if (n.includes(needle)) return key;
  }
  return null;
}

/**
 * Convert a JS Date (or YYYY-MM-DD) into an Excel serial number for date cells.
 * Excel uses 1900-based serial with the 1900-leap bug, but for any date post-1900
 * the formula below is accurate.
 */
export function dateToExcelSerial(input: Date | string | number | null | undefined): number | null {
  if (input == null || input === '') return null;
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) return null;
  const utcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return utcMs / 86400000 + 25569;
}

export function parseExcelValueAsDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const s = String(value).trim();
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

export function coerceNumber(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function templatePath(): string {
  return path.join(process.cwd(), 'data', 'templates', 'certificado-template.xlsm');
}

/**
 * Write a value into a worksheet cell while preserving the original formatting
 * (style `s`, number format `z`). Drops any pre-existing formula so the cached
 * value stands even if Excel doesn't recalculate on open.
 *
 * Using this everywhere is what makes the downloaded file look visually identical
 * to the DIAN F-220 template — thousand separators on currency cells, borders on
 * the grid, correctly formatted dates, etc.
 */
function writeCell(
  ws: XLSX.WorkSheet,
  addr: string,
  patch: Partial<XLSX.CellObject> & Pick<XLSX.CellObject, 't' | 'v'>,
) {
  const existing = (ws[addr] as XLSX.CellObject | undefined) ?? {};
  const next: XLSX.CellObject = {
    ...existing,
    ...patch,
  };
  // Drop the cached display string and formula so Excel rebuilds them from v.
  delete (next as { w?: string }).w;
  delete next.f;
  delete (next as { h?: string }).h;
  delete (next as { r?: string }).r;
  ws[addr] = next;
}

/** Write a currency/integer number using the cell's existing number format. */
function writeNumber(ws: XLSX.WorkSheet, addr: string, v: number) {
  writeCell(ws, addr, { t: 'n', v });
}
/** Write a plain string using the cell's existing style. */
function writeText(ws: XLSX.WorkSheet, addr: string, v: string) {
  writeCell(ws, addr, { t: 's', v });
}
/** Write a date; preserves existing format if present, otherwise forces d/m/yyyy. */
function writeDate(ws: XLSX.WorkSheet, addr: string, d: Date) {
  const existing = ws[addr] as XLSX.CellObject | undefined;
  writeCell(ws, addr, {
    t: 'n',
    v: dateToExcelSerial(d)!,
    z: existing?.z ?? 'd/m/yyyy',
  });
}
/** Clear a cell entirely — used for blank text fields so Excel doesn't show "0". */
function clearCell(ws: XLSX.WorkSheet, addr: string) {
  const existing = (ws[addr] as XLSX.CellObject | undefined) ?? {};
  // Keep style but replace the value with an empty string.
  const next: XLSX.CellObject = { ...existing, t: 's', v: '' };
  delete next.f;
  delete (next as { w?: string }).w;
  delete (next as { h?: string }).h;
  delete (next as { r?: string }).r;
  ws[addr] = next;
}

/**
 * Build a xlsm buffer by loading the template and populating it for a single user.
 * `values` is keyed by TEMPLATE_FIELDS keys.
 *
 * The resulting file matches the DIAN F-220 template visually: employer header,
 * employee identity row, "Periodo de la Certificación", all 36-60 line items with
 * their own numbering column, the 52-row total, the "Datos a cargo del trabajador"
 * block, dependents and signature block. All cell styles, merges, column widths
 * and row heights are preserved from the template.
 */
export function buildCertificadoXlsm(values: Record<string, unknown>, opts: {
  year: number;
  employerNit?: string | number | null;
  employerDv?: string | number | null;
  employerRazonSocial?: string | null;
  ciudad?: string | null;
  codDepto?: string | number | null;
  codMunicipio?: string | number | null;
  fechaEmision?: Date | null;
  nombreAgenteRetenedor?: string | null;
}): Buffer {
  const tpl = fs.readFileSync(templatePath());
  const wb = XLSX.read(tpl, {
    type: 'buffer',
    bookVBA: true,
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
  });

  const cert = wb.Sheets['Cert ing y ret'];
  const menu = wb.Sheets['MENU'];
  const datos = wb.Sheets['Datos empleados'];

  // --- Employer (MENU sheet) ----------------------------------------------
  if (opts.employerNit != null) writeNumber(menu, 'C17', Number(opts.employerNit));
  if (opts.employerDv != null) writeNumber(menu, 'E17', Number(opts.employerDv));
  if (opts.employerRazonSocial) writeText(menu, 'C19', opts.employerRazonSocial);
  if (opts.ciudad) writeText(menu, 'N19', opts.ciudad);
  if (opts.codDepto != null) writeNumber(menu, 'N20', Number(opts.codDepto));
  if (opts.codMunicipio != null) writeText(menu, 'N21', String(opts.codMunicipio));
  const emissionDate = opts.fechaEmision ?? new Date();
  writeDate(menu, 'N22', emissionDate);
  const retenedorName = opts.nombreAgenteRetenedor ?? opts.employerRazonSocial ?? '';
  if (retenedorName) writeText(menu, 'C24', retenedorName);

  // --- Employer (Cert sheet header) ---------------------------------------
  if (opts.employerNit != null) writeNumber(cert, 'D10', Number(opts.employerNit));
  if (opts.employerDv != null) writeNumber(cert, 'P10', Number(opts.employerDv));
  if (opts.employerRazonSocial) writeText(cert, 'B12', opts.employerRazonSocial);
  // Primer apellido / Segundo apellido / Primer nombre / Otros nombres del retenedor
  // (only relevant if the employer is a natural person; for a SAS we leave blank).
  clearCell(cert, 'Q10');
  clearCell(cert, 'W10');
  clearCell(cert, 'AC10');
  clearCell(cert, 'AH10');

  // --- Employee identity --------------------------------------------------
  const cedulaRaw = values['cedula'];
  const cedulaNum =
    typeof cedulaRaw === 'number'
      ? cedulaRaw
      : Number(String(cedulaRaw ?? '').replace(/\D/g, ''));
  if (cedulaNum) {
    writeNumber(cert, 'AC5', cedulaNum);
    writeNumber(cert, 'G15', cedulaNum);
  }

  // --- Period + emission + location ---------------------------------------
  writeDate(cert, 'R18', emissionDate);
  if (opts.ciudad) writeText(cert, 'X18', opts.ciudad);
  if (opts.codDepto != null) writeNumber(cert, 'AI18', Number(opts.codDepto));
  if (opts.codMunicipio != null) writeText(cert, 'AJ18', String(opts.codMunicipio));
  writeText(cert, 'A49', retenedorName || '');

  // Defaults for period (jan 1 → dec 31 of the gravable year) if the admin didn't fill it.
  if (!values['fechaInicial']) values['fechaInicial'] = new Date(Date.UTC(opts.year, 0, 1));
  if (!values['fechaFinal']) values['fechaFinal'] = new Date(Date.UTC(opts.year, 11, 31));

  // --- Datos empleados: wipe sample rows + fill row 5 for VLOOKUP fallback ---
  const DATOS_ROW = 5; // Excel row
  for (let r = DATOS_ROW - 1; r <= DATOS_ROW + 4; r++) {
    for (let c = 0; c < 60; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (datos[addr]) delete datos[addr];
    }
  }

  // --- Fill every template field, preserving styles ------------------------
  const populatedNumbers: Record<string, number> = {};
  for (const f of TEMPLATE_FIELDS) {
    const raw = values[f.key];
    const hasValue = raw != null && raw !== '';

    if (f.kind === 'number') {
      const n = hasValue ? coerceNumber(raw) : 0;
      populatedNumbers[f.key] = n;
      if (f.certCell) writeNumber(cert, f.certCell, n);
      if (f.datosCol) datos[`${f.datosCol}${DATOS_ROW}`] = { t: 'n', v: n };
    } else if (f.kind === 'date') {
      if (hasValue) {
        const d = raw instanceof Date ? raw : new Date(String(raw));
        if (!isNaN(d.getTime())) {
          if (f.certCell) writeDate(cert, f.certCell, d);
          if (f.datosCol) {
            datos[`${f.datosCol}${DATOS_ROW}`] = {
              t: 'n',
              v: dateToExcelSerial(d)!,
              z: 'd/m/yyyy',
            };
          }
        }
      }
    } else if (f.kind === 'code') {
      // A literal 0 or "0" in EXOGENA means the field isn't filled — treat as empty.
      const n = hasValue ? Number(String(raw).replace(/\D/g, '')) : NaN;
      if (Number.isFinite(n) && n > 0) {
        if (f.certCell) writeNumber(cert, f.certCell, n);
        if (f.datosCol) datos[`${f.datosCol}${DATOS_ROW}`] = { t: 'n', v: n };
      } else if (hasValue && String(raw).trim() !== '0') {
        if (f.certCell) writeText(cert, f.certCell, String(raw));
        if (f.datosCol) datos[`${f.datosCol}${DATOS_ROW}`] = { t: 's', v: String(raw) };
      } else if (f.certCell) {
        clearCell(cert, f.certCell);
      }
    } else {
      // text — treat literal zeros as "no data" so "0" doesn't show up on dependents.
      const isEffectivelyEmpty =
        !hasValue ||
        raw === 0 ||
        String(raw).trim() === '' ||
        String(raw).trim() === '0';
      if (!isEffectivelyEmpty) {
        const v = String(raw);
        if (f.certCell) writeText(cert, f.certCell, v);
        if (f.datosCol) datos[`${f.datosCol}${DATOS_ROW}`] = { t: 's', v };
      } else if (f.certCell) {
        // Explicitly clear so the stale cached value (like "0" from a VLOOKUP against
        // an empty row) doesn't show up on the printed form.
        clearCell(cert, f.certCell);
      }
    }
  }

  // --- Computed totals (so the file reads correctly even without recalc) ---

  // Line 52 — Total ingresos brutos = sum of lines 36..51 (AC21..AC36).
  const totalIngresos =
    (populatedNumbers['pagosSalarios'] ?? 0) +
    (populatedNumbers['pagosBonosEtc'] ?? 0) +
    (populatedNumbers['valorExcesoAlimentacion'] ?? 0) +
    (populatedNumbers['pagosHonorarios'] ?? 0) +
    (populatedNumbers['pagosServicios'] ?? 0) +
    (populatedNumbers['pagosComisiones'] ?? 0) +
    (populatedNumbers['pagosPrestacionesSociales'] ?? 0) +
    (populatedNumbers['pagosViaticos'] ?? 0) +
    (populatedNumbers['pagosGastosRepresentacion'] ?? 0) +
    (populatedNumbers['pagosCompensacionCoop'] ?? 0) +
    (populatedNumbers['otrosPagos'] ?? 0) +
    (populatedNumbers['auxilioCesantiasEIntereses'] ?? 0) +
    (populatedNumbers['auxilioCesantiaRegimenTradicional'] ?? 0) +
    (populatedNumbers['auxilioCesantiaConsignadas'] ?? 0) +
    (populatedNumbers['pensiones'] ?? 0) +
    (populatedNumbers['apoyosEducativos'] ?? 0);
  writeNumber(cert, 'AC37', totalIngresos);

  // Line 67 / 74 — "Otros ingresos" totales. We don't capture these (employee fills
  // them in by hand if applicable), but we explicitly write 0 so the cached
  // totals from the sample template don't bleed through.
  writeNumber(cert, 'Z59', 0);
  writeNumber(cert, 'AG59', 0);

  // Line 75 — total retenciones (line 60 + line 74).
  const totalRetenciones = (populatedNumbers['valorRetencionFuente'] ?? 0) + 0;
  writeNumber(cert, 'AG60', totalRetenciones);

  // --- Dependent flag on the hidden helper column --------------------------
  const dependentIndicator = values['numDocDependiente'] ? 1 : 0;
  datos[`AH${DATOS_ROW}`] = { t: 'n', v: dependentIndicator };

  // Keep the Datos empleados range small (the template's original is 57324 rows of
  // empty cells — shrinking it makes the generated file ~4× smaller).
  datos['!ref'] = 'A1:BE10';

  // --- Workbook-level: force Excel to recompute any remaining formulas AND
  // --- open on the certificate sheet (not the MENU sheet the template defaults to).
  wb.Workbook = wb.Workbook || {};
  (wb.Workbook as unknown as { CalcPr?: { fullCalcOnLoad?: boolean } }).CalcPr = {
    fullCalcOnLoad: true,
  };
  const certIdx = wb.SheetNames.indexOf('Cert ing y ret');
  if (certIdx >= 0) {
    wb.Workbook.Views = wb.Workbook.Views ?? [];
    wb.Workbook.Views[0] = { ...(wb.Workbook.Views[0] ?? {}) };
    (wb.Workbook.Views[0] as unknown as { activeTab: number }).activeTab = certIdx;
  }
  // Hide helper sheets (MENU, Datos empleados, Hoja libre, Hoja1-3) so the downloaded
  // file looks clean — the employee sees only the formatted certificate.
  const keepVisible = new Set(['Cert ing y ret']);
  wb.Workbook.Sheets = wb.SheetNames.map((name, i) => {
    const prev = wb.Workbook!.Sheets?.[i] ?? {};
    return { ...prev, name, Hidden: keepVisible.has(name) ? 0 : 1 };
  });

  return XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsm',
    bookVBA: true,
    cellStyles: true,
  }) as Buffer;
}
