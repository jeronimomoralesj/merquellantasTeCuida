/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

/**
 * Renders the Fonalmerque "SOLICITUD DE PRÉSTAMOS" form as a PDF using the
 * values submitted through the digital form (see
 * src/app/dashboard/fondo/SolicitudCreditoForm.tsx). Mirrors the paper
 * template layout: línea de crédito + condiciones, garantías, info del
 * asociado, firmas e-signed as PNG data URLs, documentos adjuntos.
 *
 * Uses @react-pdf/renderer so it runs inside a Next.js route handler
 * without any system binaries.
 */

export interface SolicitudDocumentos {
  educativo?: { orden_matricula?: boolean; recibos_pago?: boolean };
  libre_inversion?: { compra_promesa?: boolean; pignoracion?: boolean; reparacion_cotizacion?: boolean };
  seguros?: { cotizacion_poliza?: boolean; soat_tarjeta?: boolean };
  calamidad?: { facturas_recibos?: boolean; certificacion_calamidad?: boolean };
}

export interface SolicitudInfo {
  primer_apellido?: string;
  segundo_apellido?: string;
  nombres?: string;
  cedula?: string;
  empresa?: string;
  seccion?: string;
  cargo?: string;
  antiguedad?: string;
  direccion_residencia?: string;
  barrio?: string;
  telefono_fijo?: string;
  celular?: string;
  ciudad?: string;
}

export interface SolicitudCodeudor {
  nombre?: string;
  cedula?: string;
  firma?: string; // data URL
}

export interface SolicitudData {
  fecha_solicitud?: string;
  linea_credito?: 'educativo' | 'libre_inversion' | 'calamidad' | 'otro' | string;
  linea_credito_otro_text?: string;
  destinacion_credito?: string;
  monto_solicitado?: number;
  cuota_fija?: number;
  cuota_intereses?: number;
  frecuencia_pago?: 'mensual' | 'quincenal' | string;
  quincena_del?: '15' | '30' | '' | string;
  garantias?: string[];
  info_asociado?: SolicitudInfo;
  codeudores?: SolicitudCodeudor[];
  documentos?: SolicitudDocumentos;
  autorizacion_aceptada?: boolean;
  firma_deudor?: string; // data URL
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  brand: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  brandYellow: { color: '#f4a900' },
  brandBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 6,
    textAlign: 'center' as const,
  },
  brandBoxText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 6,
  },
  box: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 4,
  },
  boxTitle: {
    borderBottomWidth: 1,
    borderColor: '#000',
    padding: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center' as const,
    backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row' },
  cell: {
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  cellLast: { padding: 5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  label: { fontSize: 8, color: '#333' },
  value: { fontSize: 9, marginTop: 1 },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 2,
  },
  checkBox: {
    width: 9,
    height: 9,
    borderWidth: 0.8,
    borderColor: '#000',
    marginRight: 3,
    textAlign: 'center' as const,
    fontSize: 8,
    lineHeight: 1,
  },
  checkLabel: { fontSize: 8 },
  checkChecked: {
    backgroundColor: '#000',
    color: '#fff',
  },
  destRed: { fontSize: 8, color: '#c0392b', fontFamily: 'Helvetica-Bold' },
  autText: { fontSize: 7.5, lineHeight: 1.3, textAlign: 'justify' as const },
  firmasRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    borderTopWidth: 0,
  },
  firmaCell: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 4,
    height: 80,
    justifyContent: 'space-between',
  },
  firmaCellLast: {
    flex: 1,
    padding: 4,
    height: 80,
    justifyContent: 'space-between',
  },
  firmaImg: { flex: 1, objectFit: 'contain' as const },
  firmaLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  docsBox: {
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 6,
  },
  docsHeader: {
    padding: 4,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center' as const,
  },
  docsGrid: { flexDirection: 'row' },
  docsCol: {
    flex: 1,
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  docsColLast: {
    flex: 1,
    padding: 5,
  },
  docsTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  footer: {
    marginTop: 10,
    textAlign: 'center' as const,
    fontSize: 7.5,
    color: '#333',
  },
});

function Checkbox({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <View style={styles.check}>
      <Text style={[styles.checkBox, checked ? styles.checkChecked : {}]}>
        {checked ? 'x' : ' '}
      </Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function fmtCOP(n?: number): string {
  if (!Number.isFinite(n as number)) return '';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n || 0);
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const LINEA_LABELS: Record<string, string> = {
  educativo: 'EDUCATIVO',
  libre_inversion: 'LIBRE INVERSIÓN',
  calamidad: 'CALAMIDAD',
  otro: 'OTRO',
};

const GARANTIA_LABELS: Record<string, string> = {
  aportes_ahorros: 'APORTES Y AHORROS',
  codeudor: 'CODEUDOR',
  cesantias: 'CESANTÍAS',
  primas: 'PRIMAS',
  hipoteca: 'HIPOTECA',
};

function SolicitudCreditoDocument({ data }: { data: SolicitudData }) {
  const info = data.info_asociado || {};
  const docs = data.documentos || {};
  const g = new Set(data.garantias || []);
  const lc = data.linea_credito || '';
  const isMensual = data.frecuencia_pago === 'mensual';
  const isQuincenal = data.frecuencia_pago === 'quincenal';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              FONAL<Text style={styles.brandYellow}>MERQUE</Text>
            </Text>
          </View>
          <View style={[styles.brandBox, { width: 200 }]}>
            <Text style={styles.brandBoxText}>FONDO NACIONAL DE</Text>
            <Text style={styles.brandBoxText}>EMPLEADOS MERQUELLANTAS</Text>
            <Text style={styles.brandBoxText}>FONALMERQUE</Text>
          </View>
        </View>

        <View style={styles.fechaRow}>
          <Text style={styles.label}>FECHA DE SOLICITUD. </Text>
          <Text style={[styles.value, { borderBottomWidth: 0.5, borderColor: '#000', flex: 1, paddingBottom: 1 }]}>
            {fmtDate(data.fecha_solicitud) || ' '}
          </Text>
        </View>

        {/* Línea de crédito + condiciones (two columns) */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>LÍNEA DE CRÉDITO SOLICITADA</Text>
          <View style={styles.row}>
            <View style={[styles.cell, { flex: 1 }]}>
              <Checkbox checked={lc === 'educativo'} label="EDUCATIVO" />
              <Checkbox checked={lc === 'libre_inversion'} label="LIBRE INVERSIÓN" />
              <Checkbox checked={lc === 'calamidad'} label="CALAMIDAD" />
              <Checkbox
                checked={lc === 'otro'}
                label={lc === 'otro' && data.linea_credito_otro_text ? `OTRO: ${data.linea_credito_otro_text}` : 'OTRO'}
              />
              <Text style={styles.destRed}>DESTINACIÓN DEL CRÉDITO:</Text>
              <Text style={[styles.value, { minHeight: 22 }]}>{data.destinacion_credito || ''}</Text>
            </View>
            <View style={[styles.cellLast, { flex: 1 }]}>
              <View style={{ marginBottom: 3 }}>
                <Text style={styles.label}>MONTO SOLICITADO</Text>
                <Text style={styles.value}>{fmtCOP(data.monto_solicitado) || '$'}</Text>
              </View>
              <View style={{ marginBottom: 3 }}>
                <Text style={styles.label}>CUOTA FIJA</Text>
                <Text style={styles.value}>{fmtCOP(data.cuota_fija) || '$'}</Text>
              </View>
              <View style={{ marginBottom: 5 }}>
                <Text style={styles.label}>CUOTA + INTERESES</Text>
                <Text style={styles.value}>{fmtCOP(data.cuota_intereses) || '$'}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Checkbox checked={isMensual} label="MENSUAL" />
                <Checkbox checked={isQuincenal} label="QUINCENAL" />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 2 }}>
                <Text style={styles.checkLabel}>QUINCENA DEL </Text>
                <Checkbox checked={data.quincena_del === '15'} label="15" />
                <Checkbox checked={data.quincena_del === '30'} label="30" />
              </View>
            </View>
          </View>
        </View>

        {/* Garantías */}
        <View style={[styles.box, { paddingVertical: 4, paddingHorizontal: 6 }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={[styles.checkLabel, { fontFamily: 'Helvetica-Bold', marginRight: 4 }]}>GARANTÍA:</Text>
            {Object.keys(GARANTIA_LABELS).map((k) => (
              <Checkbox key={k} checked={g.has(k)} label={GARANTIA_LABELS[k]} />
            ))}
          </View>
        </View>

        {/* Información general del asociado */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>INFORMACIÓN GENERAL DEL ASOCIADO</Text>
          <View style={{ padding: 5 }}>
            <Text style={styles.value}>
              <Text style={styles.bold}>1º APELLIDO: </Text>{info.primer_apellido || ''}
              <Text>   </Text>
              <Text style={styles.bold}>2º APELLIDO: </Text>{info.segundo_apellido || ''}
              <Text>   </Text>
              <Text style={styles.bold}>NOMBRES: </Text>{info.nombres || ''}
              <Text>   </Text>
              <Text style={styles.bold}>C.C. Nº: </Text>{info.cedula || ''}
            </Text>
            <Text style={[styles.value, { marginTop: 3 }]}>
              <Text style={styles.bold}>EMPRESA: </Text>{info.empresa || ''}
            </Text>
            <Text style={[styles.value, { marginTop: 3 }]}>
              <Text style={styles.bold}>SECCIÓN: </Text>{info.seccion || ''}
              <Text>   </Text>
              <Text style={styles.bold}>CARGO: </Text>{info.cargo || ''}
              <Text>   </Text>
              <Text style={styles.bold}>ANTIGÜEDAD: </Text>{info.antiguedad || ''}
            </Text>
            <Text style={[styles.value, { marginTop: 3 }]}>
              <Text style={styles.bold}>DIRECCIÓN RESIDENCIA: </Text>{info.direccion_residencia || ''}
              <Text>   </Text>
              <Text style={styles.bold}>BARRIO: </Text>{info.barrio || ''}
            </Text>
            <Text style={[styles.value, { marginTop: 3 }]}>
              <Text style={styles.bold}>TELÉFONO FIJO: </Text>{info.telefono_fijo || ''}
              <Text>   </Text>
              <Text style={styles.bold}>CELULAR: </Text>{info.celular || ''}
              <Text>   </Text>
              <Text style={styles.bold}>CIUDAD: </Text>{info.ciudad || ''}
            </Text>
          </View>
        </View>

        {/* Autorización */}
        <View style={[styles.box, { padding: 6 }]}>
          <Text style={[styles.boxTitle, { borderBottomWidth: 0, padding: 0, marginBottom: 3 }]}>
            AUTORIZACIÓN
          </Text>
          <Text style={styles.autText}>
            Autorizamos de manera irrevocable para que con fines estadísticos, de control, supervisión e información
            comercial, <Text style={styles.bold}>Fonalmerque</Text> reporte a la central de información de la Asociación
            Bancaria y de entidades financieras de Colombia y a cualquier otra entidad que maneje bases de datos con los
            mismos fines el nacimiento, modificación y extinción de obligaciones contraídas con anterioridad o que se
            llegaren a contraer fruto de contratos financieros con <Text style={styles.bold}>Fonalmerque</Text>, y en
            especial el manejo de ahorros y demás operaciones de crédito. La presente autorización comprende además el
            reporte de información referente a la existencia de deudas vencidas y/o la utilización indebida de los
            servicios financieros por un término no mayor al momento en el cual se extingue la obligación y en todo
            caso durante el tiempo en mora, el retardo o el incumplimiento. Declaro(amos) también que conozco(cemos) y
            acepto(amos) los reglamentos de <Text style={styles.bold}>Fonalmerque</Text>.
            {data.autorizacion_aceptada ? '  (Aceptado digitalmente)' : ''}
          </Text>
        </View>

        {/* Firmas */}
        <View style={styles.firmasRow}>
          <View style={styles.firmaCell}>
            {data.firma_deudor ? (
              <Image src={data.firma_deudor} style={styles.firmaImg} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.firmaLabel}>DEUDOR  C.C. {info.cedula || ''}</Text>
          </View>
          <View style={styles.firmaCell}>
            {data.codeudores?.[0]?.firma ? (
              <Image src={data.codeudores[0].firma} style={styles.firmaImg} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.firmaLabel}>
              CODEUDOR 1  {data.codeudores?.[0]?.nombre ? `— ${data.codeudores[0].nombre}` : ''}  C.C. {data.codeudores?.[0]?.cedula || ''}
            </Text>
          </View>
          <View style={styles.firmaCellLast}>
            {data.codeudores?.[1]?.firma ? (
              <Image src={data.codeudores[1].firma} style={styles.firmaImg} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.firmaLabel}>
              CODEUDOR 2  {data.codeudores?.[1]?.nombre ? `— ${data.codeudores[1].nombre}` : ''}  C.C. {data.codeudores?.[1]?.cedula || ''}
            </Text>
          </View>
        </View>

        {/* Documentos adjuntos */}
        <Text style={[styles.label, { marginTop: 6, fontFamily: 'Helvetica-Bold' }]}>
          A LA PRESENTE SOLICITUD SE ADJUNTA: PAGARÉ EN BLANCO FIRMADO POR EL SOLICITANTE Y LIBRANZA FIRMADA POR EL ASOCIADO Y EL PAGADOR Y LOS DOCUMENTOS QUE SE RELACIONAN A CONTINUACIÓN:
        </Text>
        <View style={styles.docsBox}>
          <View style={styles.docsGrid}>
            <View style={styles.docsCol}>
              <Text style={styles.docsTitle}>EDUCATIVO:</Text>
              <Checkbox checked={!!docs.educativo?.orden_matricula} label="Orden de matrícula" />
              <Checkbox checked={!!docs.educativo?.recibos_pago} label="Recibos de pago" />
            </View>
            <View style={styles.docsCol}>
              <Text style={styles.docsTitle}>LIBRE INVERSIÓN: (vehículo)</Text>
              <Checkbox checked={!!docs.libre_inversion?.compra_promesa} label="Compra: promesa de compraventa" />
              <Checkbox checked={!!docs.libre_inversion?.pignoracion} label="Pignoración" />
              <Checkbox checked={!!docs.libre_inversion?.reparacion_cotizacion} label="Reparación: cotización" />
            </View>
            <View style={styles.docsColLast}>
              <Text style={styles.docsTitle}>SEGUROS:</Text>
              <Checkbox checked={!!docs.seguros?.cotizacion_poliza} label="Cotización póliza" />
              <Checkbox checked={!!docs.seguros?.soat_tarjeta} label="SOAT / Tarjeta de propiedad" />
              <Text style={[styles.docsTitle, { marginTop: 4 }]}>CALAMIDAD:</Text>
              <Checkbox checked={!!docs.calamidad?.facturas_recibos} label="Facturas o recibos de pago" />
              <Checkbox checked={!!docs.calamidad?.certificacion_calamidad} label="Certificación calamidad" />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Av. Centenario No.116-40</Text>
          <Text>e-mail: fonalmerque@merquellantas.com</Text>
          <Text>Tel.: 322 8088355</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderSolicitudCreditoPdf(data: SolicitudData): Promise<Buffer> {
  return renderToBuffer(<SolicitudCreditoDocument data={data} />);
}
