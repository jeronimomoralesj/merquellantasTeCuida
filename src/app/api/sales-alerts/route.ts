import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://shared-mqplatform-prod.azurewebsites.net/api/report/documentsalerts';

export async function GET() {
  const session = await auth();
  if (!session || session.user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const apiKey = process.env.MQPLATFORM_REPORT_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta MQPLATFORM_REPORT_KEY en variables de entorno' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(UPSTREAM, {
      headers: { Authorization: apiKey },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'Error consultando reporte', status: res.status, body: body.slice(0, 500) },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('sales-alerts proxy error', err);
    return NextResponse.json({ error: 'Error de red' }, { status: 502 });
  }
}
