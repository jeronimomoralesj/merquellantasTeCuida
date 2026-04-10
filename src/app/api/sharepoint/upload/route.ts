import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';

// In-memory caches. These live for the lifetime of the serverless function
// instance, which is fine — tokens are refreshed when they expire and folder
// IDs are stable.
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedFolder: { driveId: string; itemId: string } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)'
    );
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Token fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function resolveFolder(
  token: string
): Promise<{ driveId: string; itemId: string }> {
  if (cachedFolder) return cachedFolder;

  const owner =
    process.env.SHAREPOINT_FOLDER_OWNER ||
    'saludocupacional@merquellantas.com';
  const folderPath =
    process.env.SHAREPOINT_FOLDER_PATH || '17. DOCUMENTOS NUESTRA GENTE';

  // Graph path addressing: /users/{upn}/drive/root:/path/to/folder
  // encodeURI (not encodeURIComponent) preserves `/` as separator.
  const encodedPath = encodeURI(folderPath);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      owner
    )}/drive/root:/${encodedPath}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(
      `Folder resolve failed: ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();
  cachedFolder = {
    driveId: data.parentReference.driveId,
    itemId: data.id,
  };
  return cachedFolder;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawName =
      (formData.get('filename') as string | null) || file?.name || 'upload';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Sanitize filename for SharePoint (strip reserved characters)
    const safeName = rawName.replace(/[\\/:*?"<>|#%]/g, '_');

    const token = await getAccessToken();
    const { driveId, itemId } = await resolveFolder(token);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Simple PUT upload — permiso form caps files at 5 MB, well under the
    // 4 MB simple-upload threshold... actually 4 MB is the limit for simple
    // PUT, so we use an upload session to be safe for anything above 4 MB.
    let webUrl: string;
    let uploadedName: string;
    let uploadedId: string;

    if (buffer.byteLength <= 4 * 1024 * 1024) {
      const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}:/${encodeURIComponent(
        safeName
      )}:/content`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: buffer,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('SharePoint simple upload failed', uploadRes.status, errText);
        return NextResponse.json(
          { error: 'Upload failed', details: errText },
          { status: 500 }
        );
      }
      const uploaded = await uploadRes.json();
      webUrl = uploaded.webUrl;
      uploadedName = uploaded.name;
      uploadedId = uploaded.id;
    } else {
      // Upload session for larger files
      const sessionRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}:/${encodeURIComponent(
          safeName
        )}:/createUploadSession`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item: { '@microsoft.graph.conflictBehavior': 'rename' },
          }),
        }
      );
      if (!sessionRes.ok) {
        const errText = await sessionRes.text();
        console.error('Upload session create failed', sessionRes.status, errText);
        return NextResponse.json(
          { error: 'Upload session failed', details: errText },
          { status: 500 }
        );
      }
      const session = await sessionRes.json();
      const putRes = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(buffer.byteLength),
          'Content-Range': `bytes 0-${buffer.byteLength - 1}/${buffer.byteLength}`,
        },
        body: buffer,
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error('Upload session PUT failed', putRes.status, errText);
        return NextResponse.json(
          { error: 'Upload failed', details: errText },
          { status: 500 }
        );
      }
      const uploaded = await putRes.json();
      webUrl = uploaded.webUrl;
      uploadedName = uploaded.name;
      uploadedId = uploaded.id;
    }

    return NextResponse.json({
      webUrl,
      name: uploadedName,
      id: uploadedId,
    });
  } catch (err) {
    console.error('SharePoint upload error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
