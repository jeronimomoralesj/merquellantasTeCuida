import { NextResponse } from 'next/server';
import https from 'https';
import { auth } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_HOST = 'shared-mqplatform-prod.azurewebsites.net';
const UPSTREAM_PATH = '/api/report/documentsalerts';

interface UpstreamResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function callUpstream(headerName: string, headerValue: string): Promise<UpstreamResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: UPSTREAM_HOST,
        path: UPSTREAM_PATH,
        method: 'GET',
        protocol: 'https:',
        headers: { [headerName]: headerValue },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (Array.isArray(v)) headers[k] = v.join(', ');
            else if (v != null) headers[k] = String(v);
          }
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers,
          });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

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
    const result = await callUpstream(headerName, headerValue);
    if (result.status < 200 || result.status >= 300) {
      console.error('sales-alerts upstream non-2xx', {
        status: result.status,
        headerName,
        scheme: scheme || '(none)',
        keyFingerprint,
        upstreamHeaders: result.headers,
        body: result.body,
      });
      return NextResponse.json(
        {
          error: 'Error consultando reporte',
          status: result.status,
          headerNameSent: headerName,
          schemeSent: scheme || '(none)',
          keyFingerprint,
          upstreamHeaders: result.headers,
          body: result.body.slice(0, 800),
          via: 'node-https',
        },
        { status: 502 }
      );
    }
    try {
      return NextResponse.json(JSON.parse(result.body));
    } catch {
      return new NextResponse(result.body, {
        status: 200,
        headers: { 'content-type': result.headers['content-type'] || 'application/json' },
      });
    }
  } catch (err) {
    console.error('sales-alerts proxy error', err);
    return NextResponse.json({ error: 'Error de red', detail: String(err) }, { status: 502 });
  }
}
