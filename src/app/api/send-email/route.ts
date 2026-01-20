import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: Request) {
  try {
    const { emails, userName } = await req.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Invalid email list' },
        { status: 400 }
      );
    }

    await transporter.sendMail({
      from: `"Sistema Incapacidades" <${process.env.GMAIL_USER}>`,
      to: emails.join(','),
      subject: 'Nueva Solicitud de Incapacidad',
      html: `
        <h2>Nueva solicitud de incapacidad</h2>
        <p>Se ha registrado una nueva solicitud de incapacidad.</p>
        <p><strong>Usuario:</strong> ${userName}</p>
        <p>Por favor ingrese al sistema para revisarla.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
