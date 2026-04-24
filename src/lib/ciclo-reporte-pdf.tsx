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
 * Renders a submitted Fonalmerque cycle as a nómina-style PDF report
 * that mirrors the Heinsohn RELACION DE NOMINA the fondo admin is used
 * to seeing — per-asociado block with aporte (permanente/social),
 * actividades, abonos a crédito, subtotal, plus a grand total at the
 * bottom. Uses @react-pdf/renderer so it runs server-side in a Next.js
 * route handler without any system binaries.
 */

export interface CicloReporteMovimiento {
  user_id?: string;
  nombre?: string;
  cedula?: string;
  frecuencia?: string;
  aporte?: number;
  permanente?: number;
  social?: number;
  actividad?: number;
  creditos?: Array<{ credito_id?: string; monto?: number }>;
  credito_pago_total?: number;
}

export interface CicloReporteData {
  periodo: string;
  periodo_label?: string;
  estado?: string;
  created_at?: string | Date;
  approved_at?: string | Date | null;
  revision_count?: number;
  movimientos: CicloReporteMovimiento[];
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#000',
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
    padding: 5,
    width: 210,
  },
  brandBoxTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center' as const,
  },
  brandBoxSub: {
    fontSize: 7,
    textAlign: 'center' as const,
    color: '#444',
    marginTop: 2,
  },
  reportTitleRow: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  reportMeta: {
    fontSize: 9,
    color: '#444',
  },
  userBlock: {
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#888',
    borderRadius: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 0.5,
    borderColor: '#888',
  },
  asociadoTag: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#555',
    marginRight: 6,
  },
  userCedula: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    minWidth: 68,
  },
  userName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  userFreq: {
    fontSize: 8,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 0.25,
    borderColor: '#d0d0d0',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  rowFirst: { borderTopWidth: 0 },
  rowLabel: { flex: 1, fontSize: 8.5 },
  rowNumber: { width: 80, fontSize: 8.5, textAlign: 'right' as const },
  rowNumberBold: {
    width: 80,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right' as const,
  },
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 0.5,
    borderColor: '#555',
    backgroundColor: '#f8f8f8',
  },
  subtotalLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  subtotalValue: {
    width: 80,
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right' as const,
  },
  grandTotalBox: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7e0',
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    marginTop: 8,
    fontSize: 7.5,
    color: '#777',
    textAlign: 'center' as const,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 32,
    fontSize: 7,
    color: '#777',
  },
});

function fmtCOP(n: number | undefined | null): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v);
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function computeMovTotal(m: CicloReporteMovimiento): number {
  const credTotal = Array.isArray(m.creditos)
    ? m.creditos.reduce((s, c) => s + (Number(c.monto) || 0), 0)
    : Number(m.credito_pago_total) || 0;
  return (Number(m.aporte) || 0) + (Number(m.actividad) || 0) + credTotal;
}

const ESTADO_LABEL: Record<string, string> = {
  enviado_admin: 'Enviado al administrador',
  ajustes_admin: 'Ajustes pendientes',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

function UserBlock({ m }: { m: CicloReporteMovimiento }) {
  const permanente = Number(m.permanente) || 0;
  const social = Number(m.social) || 0;
  const aporte = Number(m.aporte) || (permanente + social);
  const actividad = Number(m.actividad) || 0;
  const creditos = Array.isArray(m.creditos) ? m.creditos : [];
  const credTotal = creditos.reduce((s, c) => s + (Number(c.monto) || 0), 0)
    || Number(m.credito_pago_total) || 0;
  const subtotal = aporte + actividad + credTotal;

  return (
    <View style={styles.userBlock} wrap={false}>
      <View style={styles.userHeader}>
        <Text style={styles.asociadoTag}>ASOCIADO ==&gt;</Text>
        <Text style={styles.userCedula}>{m.cedula || ''}</Text>
        <Text style={styles.userName}>{m.nombre || ''}</Text>
        {m.frecuencia && (
          <Text style={styles.userFreq}>
            {m.frecuencia === 'quincenal' ? 'Quincenal' : 'Mensual'}
          </Text>
        )}
      </View>

      {aporte > 0 && (
        <View style={[styles.row, styles.rowFirst]}>
          <Text style={styles.rowLabel}>
            AHORROS PERMANENTES {permanente > 0 || social > 0 ? `(perm ${fmtCOP(permanente)} / social ${fmtCOP(social)})` : ''}
          </Text>
          <Text style={styles.rowNumber}>{fmtCOP(aporte)}</Text>
        </View>
      )}

      {actividad !== 0 && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>ACTIVIDAD</Text>
          <Text style={styles.rowNumber}>{fmtCOP(actividad)}</Text>
        </View>
      )}

      {creditos.filter((c) => (Number(c.monto) || 0) > 0).map((c, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.rowLabel}>
            ABONO A CREDITO {c.credito_id || ''}
          </Text>
          <Text style={styles.rowNumber}>{fmtCOP(c.monto)}</Text>
        </View>
      ))}

      <View style={styles.subtotalRow}>
        <Text style={styles.subtotalLabel}>Subtotal Asociado ============&gt;</Text>
        <Text style={styles.subtotalValue}>{fmtCOP(subtotal)}</Text>
      </View>
    </View>
  );
}

function CicloReporteDocument({ data }: { data: CicloReporteData }) {
  const grandTotal = data.movimientos.reduce((s, m) => s + computeMovTotal(m), 0);
  const totalUsers = data.movimientos.length;
  const periodoLabel = data.periodo_label || data.periodo;
  const estadoLabel = data.estado ? ESTADO_LABEL[data.estado] || data.estado : '';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Brand header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>
              FONAL<Text style={styles.brandYellow}>MERQUE</Text>
            </Text>
            <Text style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
              Av. Centenario No. 116-40 · fonalmerque@merquellantas.com · 322 8088355
            </Text>
          </View>
          <View style={styles.brandBox}>
            <Text style={styles.brandBoxTitle}>RELACIÓN DE NÓMINA</Text>
            <Text style={styles.brandBoxSub}>Fondo Nacional de Empleados Merquellantas</Text>
          </View>
        </View>

        {/* Report title */}
        <View style={styles.reportTitleRow}>
          <Text style={styles.reportTitle}>Ciclo: {periodoLabel}</Text>
          <Text style={styles.reportMeta}>
            {totalUsers} asociado{totalUsers === 1 ? '' : 's'}
            {estadoLabel ? `  ·  ${estadoLabel}` : ''}
            {data.revision_count ? `  ·  Revisión ${data.revision_count}` : ''}
            {data.created_at ? `  ·  ${fmtDate(data.created_at)}` : ''}
          </Text>
        </View>

        {/* Per-user blocks */}
        {data.movimientos.map((m, i) => (
          <UserBlock key={i} m={m} />
        ))}

        {/* Grand total */}
        <View style={styles.grandTotalBox} wrap={false}>
          <Text style={styles.grandTotalLabel}>TOTAL NÓMINA ==&gt;</Text>
          <Text style={styles.grandTotalValue}>{fmtCOP(grandTotal)}</Text>
        </View>

        <Text style={styles.footer}>
          Generado por Merque te Cuida — {new Date().toLocaleString('es-CO')}
        </Text>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderCicloReportePdf(data: CicloReporteData): Promise<Buffer> {
  return renderToBuffer(<CicloReporteDocument data={data} />);
}
