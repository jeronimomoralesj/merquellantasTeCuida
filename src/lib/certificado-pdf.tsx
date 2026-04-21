import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

/**
 * DIAN Formato 220 "Certificado de Ingresos y Retenciones por Rentas de Trabajo y de
 * Pensiones" rendered as a PDF that mirrors the official layout.
 *
 * Uses @react-pdf/renderer (server-side; no browser required) so this works inside
 * a Next.js route handler without any system binaries.
 */

export interface CertificadoValues {
  // Identity
  cedula: string;
  tipoDocumentoCode?: string; // DIAN code, e.g. "13" for cedula
  primerApellido?: string;
  segundoApellido?: string;
  primerNombre?: string;
  otrosNombres?: string;

  // Period
  fechaInicial?: Date;
  fechaFinal?: Date;
  fechaEmision?: Date;

  // Ingresos (36–51)
  pagosSalarios?: number;
  pagosBonosEtc?: number;
  valorExcesoAlimentacion?: number;
  pagosHonorarios?: number;
  pagosServicios?: number;
  pagosComisiones?: number;
  pagosPrestacionesSociales?: number;
  pagosViaticos?: number;
  pagosGastosRepresentacion?: number;
  pagosCompensacionCoop?: number;
  otrosPagos?: number;
  auxilioCesantiasEIntereses?: number;
  auxilioCesantiaRegimenTradicional?: number;
  auxilioCesantiaConsignadas?: number;
  pensiones?: number;
  apoyosEducativos?: number;

  // Aportes (53–60)
  aportesSalud?: number;
  aportesPension?: number;
  cotizacionesVoluntariasRAIS?: number;
  aportesVoluntariosPension?: number;
  aportesAFC?: number;
  aportesAVC?: number;
  ingresoLaboralPromedio6m?: number;
  valorRetencionFuente?: number;

  // Dependiente (79–82)
  tipoDocDependiente?: string;
  numDocDependiente?: string;
  nombreDependiente?: string;
  parentescoDependiente?: string;
}

export interface EmployerInfo {
  nit: number;
  dv: number;
  razonSocial: string;
  ciudad: string;
  codDepto: number;
  codMunicipio: string;
  nombrePagador?: string;
}

const BORDER = '0.5pt solid #000';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#000',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  // --- Top header ---
  topRow: {
    flexDirection: 'row',
    borderTop: BORDER,
    borderLeft: BORDER,
    borderRight: BORDER,
    minHeight: 38,
  },
  dianBox: {
    width: 80,
    borderRight: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  dianText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
  titleBox: {
    flex: 1,
    borderRight: BORDER,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  form220Box: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5aa6',
    padding: 4,
  },
  form220Text: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
    letterSpacing: 1,
  },

  // --- Grid primitives ---
  row: {
    flexDirection: 'row',
    borderLeft: BORDER,
    borderRight: BORDER,
    borderTop: BORDER,
  },
  cell: {
    padding: 2,
    borderRight: BORDER,
    justifyContent: 'center',
  },
  cellLast: {
    padding: 2,
    justifyContent: 'center',
  },
  label: {
    fontSize: 6,
    color: '#333',
  },
  valueText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  valueRight: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },

  // Small section tag on the left edge. @react-pdf/renderer has shaky transform
  // support so we keep these as narrow solid bars without rotated text.
  sectionTag: {
    width: 10,
    backgroundColor: '#d8d8d8',
    borderRight: BORDER,
  },

  // Line-item table
  itemRow: {
    flexDirection: 'row',
    borderLeft: BORDER,
    borderRight: BORDER,
    borderTop: BORDER,
    minHeight: 11,
  },
  itemLabel: {
    flex: 1,
    padding: 2,
    borderRight: BORDER,
    justifyContent: 'center',
  },
  itemNumberCol: {
    width: 20,
    padding: 2,
    borderRight: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  itemValueCol: {
    width: 100,
    padding: 2,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    borderLeft: BORDER,
    borderRight: BORDER,
    borderTop: BORDER,
    backgroundColor: '#e8e8e8',
  },
  sectionHeaderLabel: {
    flex: 1,
    padding: 2,
    borderRight: BORDER,
    alignItems: 'center',
  },
  sectionHeaderValue: {
    width: 120,
    padding: 2,
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },

  // Bottom sections
  legal: {
    marginTop: 4,
    padding: 4,
    fontSize: 6,
    color: '#333',
  },
  noteBlock: {
    marginTop: 4,
    padding: 5,
    borderTop: BORDER,
    fontSize: 6,
    color: '#1f1f1f',
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 6,
    color: '#666',
  },
});

// ---------- formatting helpers ----------
function formatCedula(raw: string | number): string {
  if (raw == null || raw === '') return '';
  const n = Number(String(raw).replace(/\D/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString('es-CO');
}

function formatDate(d?: Date): string {
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrency(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '-';
  if (v === 0) return '-';
  return v.toLocaleString('es-CO');
}

// ---------- Reusable rows ----------

function LineItem({
  label,
  number,
  value,
  bold,
}: {
  label: string;
  number: number | string;
  value?: number;
  bold?: boolean;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLabel}>
        <Text style={bold ? styles.valueText : styles.label}>{label}</Text>
      </View>
      <View style={styles.itemNumberCol}>
        <Text style={styles.valueText}>{number}</Text>
      </View>
      <View style={[styles.itemValueCol, bold ? { backgroundColor: '#f5f5f5' } : {}]}>
        <Text style={styles.valueRight}>{formatCurrency(value)}</Text>
      </View>
    </View>
  );
}

function SectionBanner({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLabel}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      <View style={styles.sectionHeaderValue}>
        <Text style={styles.sectionHeaderText}>Valor</Text>
      </View>
    </View>
  );
}

function TwoColValueRow({
  label,
  number1,
  value1,
  number2,
  value2,
}: {
  label: string;
  number1: number | string;
  value1?: number;
  number2?: number | string;
  value2?: number;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLabel}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.itemNumberCol}>
        <Text style={styles.valueText}>{number1}</Text>
      </View>
      <View style={[styles.itemValueCol, { borderRight: BORDER, width: 70 }]}>
        <Text style={styles.valueRight}>{formatCurrency(value1)}</Text>
      </View>
      <View style={[styles.itemNumberCol]}>
        <Text style={styles.valueText}>{number2 ?? ''}</Text>
      </View>
      <View style={[styles.itemValueCol, { width: 70 }]}>
        <Text style={styles.valueRight}>{formatCurrency(value2)}</Text>
      </View>
    </View>
  );
}

// ---------- Main document ----------

function CertificadoDocument({
  year,
  values,
  employer,
}: {
  year: number;
  values: CertificadoValues;
  employer: EmployerInfo;
}) {
  const totalIngresos =
    (values.pagosSalarios ?? 0) +
    (values.pagosBonosEtc ?? 0) +
    (values.valorExcesoAlimentacion ?? 0) +
    (values.pagosHonorarios ?? 0) +
    (values.pagosServicios ?? 0) +
    (values.pagosComisiones ?? 0) +
    (values.pagosPrestacionesSociales ?? 0) +
    (values.pagosViaticos ?? 0) +
    (values.pagosGastosRepresentacion ?? 0) +
    (values.pagosCompensacionCoop ?? 0) +
    (values.otrosPagos ?? 0) +
    (values.auxilioCesantiasEIntereses ?? 0) +
    (values.auxilioCesantiaRegimenTradicional ?? 0) +
    (values.auxilioCesantiaConsignadas ?? 0) +
    (values.pensiones ?? 0) +
    (values.apoyosEducativos ?? 0);

  const totalRetenciones = values.valorRetencionFuente ?? 0;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* ===== Top header ===== */}
        <View style={styles.topRow}>
          <View style={styles.dianBox}>
            <Text style={styles.dianText}>DIAN</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.titleText}>
              Certificado de Ingresos y Retenciones por Rentas de Trabajo y de Pensiones
            </Text>
            <Text style={styles.titleText}>Año gravable {year}</Text>
          </View>
          <View style={styles.form220Box}>
            <Text style={styles.form220Text}>220</Text>
          </View>
        </View>

        {/* ===== Instructions + formulario # ===== */}
        <View style={styles.row}>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={styles.label}>
              Antes de diligenciar este formulario lea cuidadosamente las instrucciones
            </Text>
          </View>
          <View style={[styles.cell, { width: 100 }]}>
            <Text style={styles.label}>4. Número de formulario</Text>
          </View>
          <View style={[styles.cellLast, { width: 150 }]}>
            <Text style={styles.valueText}>{formatCedula(values.cedula)}</Text>
          </View>
        </View>

        {/* ===== Retenedor header ===== */}
        <View style={styles.row}>
          <View style={styles.sectionTag} />
          <View style={[styles.cell, { width: 160 }]}>
            <Text style={styles.label}>5. Número de Identificación Tributaria (NIT):</Text>
          </View>
          <View style={[styles.cell, { width: 40 }]}>
            <Text style={styles.label}>6. DV.</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.label}>7. Primer Apellido</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.label}>8. Segundo Apellido</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.label}>9. Primer Nombre</Text>
          </View>
          <View style={[styles.cellLast, { width: 70 }]}>
            <Text style={styles.label}>10. Otros Nombres</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.sectionTag} />
          <View style={[styles.cell, { width: 160, alignItems: 'flex-end' }]}>
            <Text style={styles.valueText}>{formatCedula(employer.nit)}</Text>
          </View>
          <View style={[styles.cell, { width: 40, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{employer.dv}</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]} />
          <View style={[styles.cell, { width: 70 }]} />
          <View style={[styles.cell, { width: 70 }]} />
          <View style={[styles.cellLast, { width: 70 }]} />
        </View>
        <View style={styles.row}>
          <View style={styles.sectionTag} />
          <View style={[styles.cellLast, { flex: 1 }]}>
            <Text style={styles.label}>11. Razón Social</Text>
            <Text style={styles.valueText}>{employer.razonSocial}</Text>
          </View>
        </View>

        {/* ===== Empleado header ===== */}
        <View style={styles.row}>
          <View style={styles.sectionTag} />
          <View style={[styles.cell, { width: 110 }]}>
            <Text style={styles.label}>24. Cód. Tipo de documento</Text>
          </View>
          <View style={[styles.cell, { width: 170 }]}>
            <Text style={styles.label}>25. Número de documento de identificación</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.label}>26. Primer apellido</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.label}>27 Segundo apellido</Text>
          </View>
          <View style={[styles.cell, { width: 60 }]}>
            <Text style={styles.label}>28. Primer Nombre</Text>
          </View>
          <View style={[styles.cellLast, { width: 70 }]}>
            <Text style={styles.label}>29 Otros Nombres</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.sectionTag} />
          <View style={[styles.cell, { width: 110, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{values.tipoDocumentoCode ?? '13'}</Text>
          </View>
          <View style={[styles.cell, { width: 170, alignItems: 'flex-end' }]}>
            <Text style={styles.valueText}>{formatCedula(values.cedula)}</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.valueText}>{values.primerApellido ?? ''}</Text>
          </View>
          <View style={[styles.cell, { width: 70 }]}>
            <Text style={styles.valueText}>{values.segundoApellido ?? ''}</Text>
          </View>
          <View style={[styles.cell, { width: 60 }]}>
            <Text style={styles.valueText}>{values.primerNombre ?? ''}</Text>
          </View>
          <View style={[styles.cellLast, { width: 70 }]}>
            <Text style={styles.valueText}>{values.otrosNombres ?? ''}</Text>
          </View>
        </View>

        {/* ===== Periodo + emisión + lugar ===== */}
        <View style={styles.row}>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={styles.label}>Periodo de la Certificación</Text>
          </View>
          <View style={[styles.cell, { width: 110 }]}>
            <Text style={styles.label}>32. Fecha de Expedición</Text>
          </View>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={styles.label}>33. Lugar donde se practicó la retención</Text>
          </View>
          <View style={[styles.cell, { width: 40 }]}>
            <Text style={styles.label}>34 Cód. Dpto.</Text>
          </View>
          <View style={[styles.cellLast, { width: 65 }]}>
            <Text style={styles.label}>35. Cód. Ciudad/ Municipio</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.cell, { width: 45 }]}>
            <Text style={styles.label}>30. de:</Text>
          </View>
          <View style={[styles.cell, { width: 110, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{formatDate(values.fechaInicial)}</Text>
          </View>
          <View style={[styles.cell, { width: 45 }]}>
            <Text style={styles.label}>31. A:</Text>
          </View>
          <View style={[styles.cell, { flex: 1, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{formatDate(values.fechaFinal)}</Text>
          </View>
          <View style={[styles.cell, { width: 110, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{formatDate(values.fechaEmision ?? new Date())}</Text>
          </View>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={styles.valueText}>{employer.ciudad}</Text>
          </View>
          <View style={[styles.cell, { width: 40, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{employer.codDepto}</Text>
          </View>
          <View style={[styles.cellLast, { width: 65, alignItems: 'center' }]}>
            <Text style={styles.valueText}>{employer.codMunicipio}</Text>
          </View>
        </View>

        {/* ===== Concepto de los Ingresos ===== */}
        <SectionBanner title="Concepto de los Ingresos" />
        <LineItem label="Pagos por salarios" number={36} value={values.pagosSalarios} />
        <LineItem
          label="Pagos realizados con bonos electrónicos o de papel de servicio, cheques, tarjetas, vales, etc"
          number={37}
          value={values.pagosBonosEtc}
        />
        <LineItem
          label="Valor del exceso de los pagos por alimentación mayores a 41 UVT, art. 387-1 E.T."
          number={38}
          value={values.valorExcesoAlimentacion}
        />
        <LineItem label="Pagos por honorarios" number={39} value={values.pagosHonorarios} />
        <LineItem label="Pagos por servicios" number={40} value={values.pagosServicios} />
        <LineItem label="Pagos por comisiones" number={41} value={values.pagosComisiones} />
        <LineItem
          label="Pagos por prestaciones sociales"
          number={42}
          value={values.pagosPrestacionesSociales}
        />
        <LineItem label="Pagos por viáticos" number={43} value={values.pagosViaticos} />
        <LineItem
          label="Pagos por gastos de representación"
          number={44}
          value={values.pagosGastosRepresentacion}
        />
        <LineItem
          label="Pagos por compensaciones por el trabajo asociado cooperativo"
          number={45}
          value={values.pagosCompensacionCoop}
        />
        <LineItem label="Otros pagos" number={46} value={values.otrosPagos} />
        <LineItem
          label="Auxilio de cesantía e intereses efectivamente pagadas al empleado"
          number={47}
          value={values.auxilioCesantiasEIntereses}
        />
        <LineItem
          label="Auxilio de cesantía reconocido a trabajadores del régimen tradicional del CST, contenido en el Capítulo VII, Título VIII Parte Primera"
          number={48}
          value={values.auxilioCesantiaRegimenTradicional}
        />
        <LineItem
          label="Auxilio de cesantías consignado al fondo de cesantias"
          number={49}
          value={values.auxilioCesantiaConsignadas}
        />
        <LineItem
          label="Pensiones de jubilación, vejez o invalidez"
          number={50}
          value={values.pensiones}
        />
        <LineItem
          label="Apoyos económicos educativos financiados con recursos públicos, no reembolsables o condonados"
          number={51}
          value={values.apoyosEducativos}
        />
        <LineItem
          label="Total de ingresos brutos (Sume 36 a 51)"
          number={52}
          value={totalIngresos}
          bold
        />

        {/* ===== Concepto de los Aportes ===== */}
        <SectionBanner title="Concepto de los aportes" />
        <LineItem
          label="Aportes obligatorios por salud a cargo del trabajador"
          number={53}
          value={values.aportesSalud}
        />
        <LineItem
          label="Aportes obligatorios a fondos de pensiones y solidaridad pensional a cargo del trabajador"
          number={54}
          value={values.aportesPension}
        />
        <LineItem
          label="Cotizaciones voluntarias al régimen de ahorro individual  con solidaridad -  RAIS"
          number={55}
          value={values.cotizacionesVoluntariasRAIS}
        />
        <LineItem
          label="Aportes voluntarios a fondos de pensiones"
          number={56}
          value={values.aportesVoluntariosPension}
        />
        <LineItem label="Aportes a cuentas AFC" number={57} value={values.aportesAFC} />
        <LineItem label="Aportes a cuentas AVC" number={58} value={values.aportesAVC} />
        <LineItem
          label="Ingreso laboral promedio de los últimos seis meses anteriores (numeral 4 art. 206 E.T.)"
          number={59}
          value={values.ingresoLaboralPromedio6m}
        />
        <LineItem
          label="Valor de la retención en la fuente por ingresos laborales y de pensiones"
          number={60}
          value={values.valorRetencionFuente}
          bold
        />

        {/* ===== Nombre del pagador ===== */}
        <View style={[styles.row, { minHeight: 22 }]}>
          <View style={[styles.cellLast, { flex: 1 }]}>
            <Text style={styles.label}>Nombre del pagador o agente retenedor</Text>
            <Text style={styles.valueText}>
              {employer.nombrePagador ?? employer.razonSocial}
            </Text>
          </View>
        </View>

        {/* ===== Datos a cargo del trabajador ===== */}
        <View style={[styles.sectionHeader, { backgroundColor: '#d8d8d8' }]}>
          <View style={[styles.sectionHeaderLabel, { flex: 1 }]}>
            <Text style={styles.sectionHeaderText}>Datos a cargo del trabajador o pensionado</Text>
          </View>
        </View>
        <View style={[styles.itemRow, { backgroundColor: '#f0f0f0' }]}>
          <View style={[styles.itemLabel]}>
            <Text style={styles.valueText}>Concepto de otros ingresos</Text>
          </View>
          <View style={[styles.itemValueCol, { width: 90, borderRight: BORDER, alignItems: 'center' }]}>
            <Text style={styles.valueText}>Valor recibido</Text>
          </View>
          <View style={[styles.itemValueCol, { width: 90, alignItems: 'center' }]}>
            <Text style={styles.valueText}>Valor retenido</Text>
          </View>
        </View>
        <TwoColValueRow label="Arrendamientos" number1={61} number2={68} />
        <TwoColValueRow label="Honorarios, comisiones y servicios" number1={62} number2={69} />
        <TwoColValueRow label="Intereses y rendimientos financieros" number1={63} number2={70} />
        <TwoColValueRow label="Enajenación de activos fijos" number1={64} number2={71} />
        <TwoColValueRow label="Loterías, rifas, apuestas y similares" number1={65} number2={72} />
        <TwoColValueRow label="Otros" number1={66} number2={73} />
        <TwoColValueRow
          label="Totales: (Valor recibido: Sume casillas 61 a 66), (Valor retenido: Sume 68 a 73)"
          number1={67}
          value1={0}
          number2={74}
          value2={0}
        />
        <View style={styles.itemRow}>
          <View style={styles.itemLabel}>
            <Text style={styles.valueText}>Total retenciones año gravable (Sume 60 + 74)</Text>
          </View>
          <View style={styles.itemNumberCol}>
            <Text style={styles.valueText}>75</Text>
          </View>
          <View style={[styles.itemValueCol, { backgroundColor: '#f5f5f5' }]}>
            <Text style={styles.valueRight}>{formatCurrency(totalRetenciones)}</Text>
          </View>
        </View>

        {/* ===== Bienes poseídos ===== */}
        <View style={[styles.sectionHeader, { backgroundColor: '#f0f0f0' }]}>
          <View style={[styles.sectionHeaderLabel, { width: 30, borderRight: BORDER }]}>
            <Text style={styles.sectionHeaderText}>Ítem</Text>
          </View>
          <View style={[styles.sectionHeaderLabel, { flex: 1, alignItems: 'center' }]}>
            <Text style={styles.sectionHeaderText}>76. Identificación de los bienes poseídos</Text>
          </View>
          <View style={[styles.sectionHeaderValue, { width: 100 }]}>
            <Text style={styles.sectionHeaderText}>77. Valor Patrimonial</Text>
          </View>
        </View>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.itemRow}>
            <View style={[styles.itemLabel, { width: 30, flex: 0, alignItems: 'center' }]}>
              <Text style={styles.valueText}>{i}</Text>
            </View>
            <View style={styles.itemLabel}>
              <Text style={styles.label}> </Text>
            </View>
            <View style={[styles.itemValueCol, { width: 100 }]} />
          </View>
        ))}
        <View style={styles.itemRow}>
          <View style={[styles.itemLabel, { flex: 1 }]}>
            <Text style={styles.valueText}>Deudas vigentes a 31 de Diciembre</Text>
          </View>
          <View style={styles.itemNumberCol}>
            <Text style={styles.valueText}>78</Text>
          </View>
          <View style={[styles.itemValueCol, { width: 110 }]} />
        </View>

        {/* ===== Dependiente + firma ===== */}
        <View style={[styles.sectionHeader, { backgroundColor: '#d8d8d8' }]}>
          <View style={[styles.sectionHeaderLabel, { flex: 1 }]}>
            <Text style={styles.sectionHeaderText}>
              Identificación del dependiente económico de acuerdo al parágrafo 2 del artículo 387 del Estatuto Tributario
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.cell, { width: 110 }]}>
            <Text style={styles.label}>79. Tipo de documento</Text>
            <Text style={styles.valueText}>{values.tipoDocDependiente ?? ''}</Text>
          </View>
          <View style={[styles.cell, { width: 110 }]}>
            <Text style={styles.label}>80. No. Documento</Text>
            <Text style={styles.valueText}>{values.numDocDependiente ?? ''}</Text>
          </View>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={styles.label}>81. Apellidos y Nombres</Text>
            <Text style={styles.valueText}>{values.nombreDependiente ?? ''}</Text>
          </View>
          <View style={[styles.cell, { width: 90 }]}>
            <Text style={styles.label}>82. Parentesco</Text>
            <Text style={styles.valueText}>{values.parentescoDependiente ?? ''}</Text>
          </View>
          <View style={[styles.cellLast, { width: 120, minHeight: 40 }]}>
            <Text style={styles.label}>Firma del trabajador o pensionado</Text>
          </View>
        </View>

        {/* ===== Certifico que durante el año gravable ===== */}
        <View style={[styles.row, { minHeight: 58 }]}>
          <View style={[styles.cellLast, { flex: 1 }]}>
            <Text style={[styles.label, { fontFamily: 'Helvetica-Bold' }]}>
              Certifico que durante el año gravable de {year}:
            </Text>
            <Text style={styles.label}>
              1. Mi patrimonio bruto no excedió de 4.500 UVT ($224.095.000).
            </Text>
            <Text style={styles.label}>
              2. Mis ingresos brutos fueron inferiores a 1.400 UVT ($69.719.000).
            </Text>
            <Text style={styles.label}>
              3. No fui responsable del impuesto sobre las ventas a 31 de diciembre de {year}
            </Text>
            <Text style={styles.label}>
              4. Mis consumos mediante tarjeta de crédito no excedieron la suma de 1.400 UVT ($66.719.000).
            </Text>
            <Text style={styles.label}>
              5. Que el total de mis compras y consumos no superaron la suma de 1.400 UVT ($69.719.000).
            </Text>
            <Text style={styles.label}>
              6. Que el valor total de mis consignaciones bancarias, depósitos o inversiones financieras no excedieron los 1.400 UVT ($69.719.000).
            </Text>
          </View>
        </View>

        {/* ===== Legal note ===== */}
        <View style={[styles.row, { backgroundColor: '#f0f0f0' }]}>
          <View style={[styles.cellLast, { flex: 1 }]}>
            <Text style={{ fontSize: 6, fontStyle: 'italic' }}>
              NOTA: este certificado sustituye para todos los efectos legales la declaración de Renta y Complementario para el trabajador o pensionado que cumpla con lo establecido en el artículo 1.6.1.13.2.7. del Decreto 1625 de 2016 Único reglamentario en materia tributaria. Para aquellos trabajadores independientes contribuyentes del impuesto unificado deberán presentar la declaración anual consolidada del Régimen Simple de Tributación (SIMPLE).
            </Text>
          </View>
        </View>

        <View style={{
          flexDirection: 'row',
          borderLeft: BORDER,
          borderRight: BORDER,
          borderTop: BORDER,
          borderBottom: BORDER,
        }} />

        <Text style={styles.footer}>www.merquellantas.com</Text>
      </Page>
    </Document>
  );
}

export async function renderCertificadoPdf(args: {
  year: number;
  values: CertificadoValues;
  employer: EmployerInfo;
}): Promise<Buffer> {
  return await renderToBuffer(<CertificadoDocument {...args} />);
}
