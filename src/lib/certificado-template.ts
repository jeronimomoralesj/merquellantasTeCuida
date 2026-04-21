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
 * Build a xlsm buffer by loading the template and populating it for a single user.
 * `values` is keyed by TEMPLATE_FIELDS keys.
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
  const wb = XLSX.read(tpl, { type: 'buffer', bookVBA: true, cellFormula: true, cellStyles: true, cellNF: true });

  const cert = wb.Sheets['Cert ing y ret'];
  const menu = wb.Sheets['MENU'];
  const datos = wb.Sheets['Datos empleados'];

  // Write employer info to MENU sheet (used by formulas on Cert ing y ret).
  function setCell(ws: XLSX.WorkSheet, addr: string, cell: XLSX.CellObject) {
    delete (ws[addr] as XLSX.CellObject | undefined)?.f; // drop formula so cached value stands
    ws[addr] = cell;
  }

  if (opts.employerNit != null) setCell(menu, 'C17', { t: 'n', v: Number(opts.employerNit) });
  if (opts.employerDv != null) setCell(menu, 'E17', { t: 'n', v: Number(opts.employerDv) });
  if (opts.employerRazonSocial) setCell(menu, 'C19', { t: 's', v: opts.employerRazonSocial });
  if (opts.ciudad) setCell(menu, 'N19', { t: 's', v: opts.ciudad });
  if (opts.codDepto != null) setCell(menu, 'N20', { t: 'n', v: Number(opts.codDepto) });
  if (opts.codMunicipio != null) setCell(menu, 'N21', { t: 's', v: String(opts.codMunicipio) });
  const emissionDate = opts.fechaEmision ?? new Date();
  setCell(menu, 'N22', { t: 'n', v: dateToExcelSerial(emissionDate)!, z: 'm/d/yyyy' });
  if (opts.nombreAgenteRetenedor) setCell(menu, 'C24', { t: 's', v: opts.nombreAgenteRetenedor });

  // Always set the lookup cedula on the cert sheet, plus the display cedula cell
  // (which the template would otherwise show with the previous employee's cached number).
  const cedulaRaw = values['cedula'];
  const cedulaNum = typeof cedulaRaw === 'number' ? cedulaRaw : Number(String(cedulaRaw ?? '').replace(/\D/g, ''));
  setCell(cert, 'AC5', { t: 'n', v: cedulaNum || 0 });
  setCell(cert, 'G15', { t: 'n', v: cedulaNum || 0 });

  // Overwrite employer/location formulas on the cert with the literal values so the file
  // is correct even if the user's Excel is set to not recalculate on open.
  if (opts.employerNit != null) setCell(cert, 'D10', { t: 'n', v: Number(opts.employerNit) });
  if (opts.employerDv != null) setCell(cert, 'P10', { t: 'n', v: Number(opts.employerDv) });
  if (opts.employerRazonSocial) setCell(cert, 'B12', { t: 's', v: opts.employerRazonSocial });
  if (opts.ciudad) setCell(cert, 'X18', { t: 's', v: opts.ciudad });
  if (opts.codDepto != null) setCell(cert, 'AI18', { t: 'n', v: Number(opts.codDepto) });
  if (opts.codMunicipio != null) setCell(cert, 'AJ18', { t: 's', v: String(opts.codMunicipio) });
  setCell(cert, 'R18', { t: 'n', v: dateToExcelSerial(emissionDate)!, z: 'm/d/yyyy' });
  if (opts.nombreAgenteRetenedor) setCell(cert, 'A49', { t: 's', v: opts.nombreAgenteRetenedor });

  // Also populate Datos empleados row 5 so VLOOKUPs in cert work if Excel recalculates.
  // Clear any pre-existing EJEMPLO / sample rows to keep the file clean.
  const DATOS_HEADER_ROW = 4; // 0-indexed row 4 = Excel row 5 (first data row)
  // Wipe old rows 5..10 (sample data from template)
  for (let r = DATOS_HEADER_ROW; r <= DATOS_HEADER_ROW + 5; r++) {
    for (let c = 0; c < 40; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (datos[addr]) delete datos[addr];
    }
  }

  // Defaults for period
  if (!values['fechaInicial']) {
    values['fechaInicial'] = new Date(Date.UTC(opts.year, 0, 1));
  }
  if (!values['fechaFinal']) {
    values['fechaFinal'] = new Date(Date.UTC(opts.year, 11, 31));
  }

  for (const f of TEMPLATE_FIELDS) {
    const raw = values[f.key];

    // Convert according to kind.
    let cell: XLSX.CellObject | null = null;
    if (raw == null || raw === '') {
      if (f.kind === 'number') cell = { t: 'n', v: 0 };
      else cell = null; // leave blank for text/date
    } else if (f.kind === 'number') {
      cell = { t: 'n', v: coerceNumber(raw) };
    } else if (f.kind === 'date') {
      const ser = dateToExcelSerial(raw as Date | string | number);
      if (ser != null) cell = { t: 'n', v: ser, z: 'm/d/yyyy' };
    } else if (f.kind === 'code') {
      const n = Number(String(raw).replace(/\D/g, ''));
      cell = Number.isFinite(n) && n > 0
        ? { t: 'n', v: n }
        : { t: 's', v: String(raw) };
    } else {
      cell = { t: 's', v: String(raw) };
    }

    if (cell && f.datosCol) {
      const addr = `${f.datosCol}${DATOS_HEADER_ROW + 1}`;
      datos[addr] = cell;
    }
    if (cell && f.certCell) {
      // Overwrite formula + cached value so the cert is immediately valid without recalc.
      setCell(cert, f.certCell, cell);
    }
  }

  // Totals / dependents helper columns on Datos empleados row 5
  const dependentIndicator = values['numDocDependiente'] ? 1 : 0;
  datos[`AH${DATOS_HEADER_ROW + 1}`] = { t: 'n', v: dependentIndicator };

  // Ensure Excel recalculates when the workbook is opened. `CalcPr` is not in the
  // library's type surface but is a valid workbook property that XLSX.write honours.
  wb.Workbook = wb.Workbook || {};
  (wb.Workbook as unknown as { CalcPr?: { fullCalcOnLoad?: boolean } }).CalcPr = {
    fullCalcOnLoad: true,
  };

  // Expand the used range to include our populated row.
  datos['!ref'] = 'A1:BE10';

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsm', bookVBA: true, cellStyles: true }) as Buffer;
}
