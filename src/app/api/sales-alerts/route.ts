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

  const rawKey = process.env.MQPLATFORM_REPORT_KEY || '';
  const apiKey = rawKey.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta MQPLATFORM_REPORT_KEY en variables de entorno' },
      { status: 500 }
    );
  }

  const scheme = (process.env.MQPLATFORM_REPORT_SCHEME || '').trim();
  const headerName = (process.env.MQPLATFORM_REPORT_HEADER || 'Authorization').trim();
  const headerValue = scheme ? `${scheme} ${apiKey}` : apiKey;

  const keyFingerprint = {
    rawLength: rawKey.length,
    trimmedLength: apiKey.length,
    first4: apiKey.slice(0, 4),
    last4: apiKey.slice(-4),
    hasInnerWhitespace: /\s/.test(apiKey),
    hasNonAscii: /[^\x20-\x7E]/.test(apiKey),
    looksLikeGuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(apiKey),
  };

  try {
    const res = await fetch(UPSTREAM, {
      headers: { [headerName]: headerValue },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const upstreamHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        upstreamHeaders[k] = v;
      });
      console.error('sales-alerts upstream non-2xx', {
        status: res.status,
        headerName,
        scheme: scheme || '(none)',
        keyFingerprint,
        upstreamHeaders,
        body,
      });
      return NextResponse.json(
        {
          error: 'Error consultando reporte',
          status: res.status,
          headerNameSent: headerName,
          schemeSent: scheme || '(none)',
          keyFingerprint,
          upstreamHeaders,
          body: body.slice(0, 800),
        },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('sales-alerts proxy error', err);
    return NextResponse.json({ error: 'Error de red', detail: String(err) }, { status: 502 });
  }
}
