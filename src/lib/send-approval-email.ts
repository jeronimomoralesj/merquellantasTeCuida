import nodemailer from 'nodemailer';

/**
 * Shared nodemailer transport configured the same way as /api/send-email but without
 * the HR whitelist — this path is used for supervisor approval emails whose recipients
 * are determined at runtime from the users collection.
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a solicitud approval request to the employee's designated supervisor.
 * `approvalUrl` must be absolute so the link works from any email client.
 */
export async function sendApprovalEmail(params: {
  jefeEmail: string;
  jefeNombre: string;
  employeeNombre: string;
  tipo: 'permiso' | 'vacaciones' | 'incapacidad';
  fechaInicio?: string | null;
  fechaFin?: string | null;
  fecha?: string | null;
  tiempoInicio?: string | null;
  tiempoFin?: string | null;
  diasVacaciones?: number | null;
  description?: string | null;
  approvalUrl: string;
}): Promise<void> {
  const tipoLabel =
    params.tipo === 'vacaciones' ? 'vacaciones' : params.tipo === 'permiso' ? 'permiso' : 'incapacidad';
  const subject = `Solicitud de ${tipoLabel} — ${params.employeeNombre}`;

  const detailRows: string[] = [];
  if (params.tipo === 'permiso') {
    if (params.fecha) detailRows.push(`<tr><td><b>Fecha:</b></td><td>${esc(params.fecha)}</td></tr>`);
    if (params.tiempoInicio && params.tiempoFin)
      detailRows.push(
        `<tr><td><b>Horario:</b></td><td>${esc(params.tiempoInicio)} – ${esc(params.tiempoFin)}</td></tr>`,
      );
  } else if (params.tipo === 'vacaciones') {
    if (params.fechaInicio && params.fechaFin)
      detailRows.push(
        `<tr><td><b>Período:</b></td><td>${esc(params.fechaInicio)} a ${esc(params.fechaFin)}</td></tr>`,
      );
    if (params.diasVacaciones != null)
      detailRows.push(
        `<tr><td><b>Días solicitados:</b></td><td>${params.diasVacaciones}</td></tr>`,
      );
  }
  if (params.description) {
    detailRows.push(
      `<tr><td valign="top"><b>Motivo:</b></td><td>${esc(params.description)}</td></tr>`,
    );
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color:#1f2937">
      <div style="background: linear-gradient(135deg, #000000 0%, #1f1f1f 100%); color: white; padding: 22px; border-radius: 12px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; color: #f4a900">Merque Bienestar</h1>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.8;">Nueva solicitud para aprobar</p>
      </div>

      <div style="margin-top: 18px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
        <p style="margin: 0 0 12px;">Hola <b>${esc(params.jefeNombre || 'jefe inmediato')}</b>,</p>
        <p style="margin: 0 0 14px;">
          <b>${esc(params.employeeNombre)}</b> te ha designado como jefe inmediato para aprobar
          su solicitud de <b>${esc(tipoLabel)}</b>. Revisa los detalles a continuación:
        </p>
        <table style="width:100%; border-collapse: collapse; font-size: 14px; margin-bottom: 18px;">
          ${detailRows
            .map((r) => r.replace('<tr>', '<tr style="border-bottom:1px solid #f3f4f6;">').replace(/<td>/g, '<td style="padding:8px 4px;">'))
            .join('')}
        </table>

        <div style="text-align:center; margin: 22px 0 10px;">
          <a href="${params.approvalUrl}"
             style="display:inline-block; background:#f4a900; color:#000; font-weight:700; text-decoration:none; padding: 12px 24px; border-radius: 10px; font-size: 15px;">
            Revisar y aprobar
          </a>
        </div>
        <p style="font-size:12px; color:#6b7280; margin-top:14px;">
          Al hacer clic podrás aprobar o rechazar la solicitud. El enlace es personal y
          expira automáticamente.
        </p>
      </div>

      <p style="text-align:center; font-size:11px; color:#9ca3af; margin-top:16px;">
        Sistema de Bienestar · Merquellantas
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Merque Bienestar" <${process.env.GMAIL_USER}>`,
    to: params.jefeEmail,
    subject,
    html,
  });
}
