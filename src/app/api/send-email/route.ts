import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { auth } from '../../../lib/auth';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Whitelist of allowed recipient emails
const ALLOWED_RECIPIENTS = new Set([
  'marcelagonzalez@merquellantas.com',
  'saludocupacional@merquellantas.com',
  'dptodelagente@merquellantas.com',
]);

export async function POST(req: NextRequest) {
  // Require authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { emails, userName, subject, html } = await req.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: 'Lista de emails inválida' }, { status: 400 });
    }

    // Only allow whitelisted recipients — prevents open relay abuse
    const safeEmails = emails.filter(
      (e: unknown) => typeof e === 'string' && ALLOWED_RECIPIENTS.has(e)
    );

    if (safeEmails.length === 0) {
      return NextResponse.json({ error: 'No hay destinatarios válidos' }, { status: 400 });
    }

    // Sanitize subject to prevent header injection
    const safeSubject = typeof subject === 'string'
      ? subject.replace(/[\r\n]/g, '').slice(0, 200)
      : 'Nueva Solicitud';

    // Use the authenticated user's name, not the one from the body
    const safeUserName = session.user.nombre || 'Usuario';

    await transporter.sendMail({
      from: `"Merque Bienestar" <${process.env.GMAIL_USER}>`,
      to: safeEmails.join(','),
      subject: safeSubject,
      html: html && typeof html === 'string'
        ? html.slice(0, 5000) // Limit HTML length
        : `
          <h2>Nueva solicitud</h2>
          <p>Se ha registrado una nueva solicitud en el sistema.</p>
          <p><strong>Usuario:</strong> ${safeUserName}</p>
          <p>Por favor ingrese al sistema para revisarla.</p>
        `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error');
    return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
  }
}
