// OneDrive file operations via Microsoft Graph API
// Uses app-level credentials (client credentials flow) to upload to a specific user's OneDrive

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const tenantId = process.env.AZURE_TENANT_ID!;
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get token: ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

const ONEDRIVE_OWNER = process.env.ONEDRIVE_OWNER || 'saludocupacional@merquellantas.com';
const ONEDRIVE_BASE_FOLDER = process.env.ONEDRIVE_BASE_FOLDER || 'MerqueBienestar';

function sanitizeFilename(name: string): string {
  // Strip path separators to prevent traversal, then remove reserved chars
  const basename = name.split(/[/\\]/).pop() || 'file';
  return basename.replace(/[<>:"/\\|?*#%]/g, '_').replace(/^\.+/, '_');
}

export async function uploadToOneDrive(
  file: Buffer,
  fileName: string,
  folder: string
): Promise<{ webUrl: string; name: string; id: string }> {
  const token = await getAccessToken();
  const safeName = sanitizeFilename(fileName);
  const folderPath = `${ONEDRIVE_BASE_FOLDER}/${folder}`;
  const uploadPath = `/users/${ONEDRIVE_OWNER}/drive/root:/${folderPath}/${safeName}:/content`;

  const graphUrl = `https://graph.microsoft.com/v1.0${uploadPath}`;

  if (file.length <= 4 * 1024 * 1024) {
    // Direct upload for files <= 4MB
    const res = await fetch(graphUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`OneDrive upload failed: ${await res.text()}`);
    }

    const data = await res.json();
    return { webUrl: data.webUrl, name: data.name, id: data.id };
  }

  // Upload session for files > 4MB
  const sessionUrl = `https://graph.microsoft.com/v1.0/users/${ONEDRIVE_OWNER}/drive/root:/${folderPath}/${safeName}:/createUploadSession`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: { '@microsoft.graph.conflictBehavior': 'rename', name: safeName },
    }),
  });

  if (!sessionRes.ok) {
    throw new Error(`Failed to create upload session: ${await sessionRes.text()}`);
  }

  const session = await sessionRes.json();
  const chunkSize = 3_932_160; // ~3.75 MB chunks
  let offset = 0;

  while (offset < file.length) {
    const end = Math.min(offset + chunkSize, file.length);
    const chunk = file.subarray(offset, end);

    const chunkRes = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunk.length.toString(),
        'Content-Range': `bytes ${offset}-${end - 1}/${file.length}`,
      },
      body: chunk,
    });

    if (!chunkRes.ok && chunkRes.status !== 202) {
      throw new Error(`Chunk upload failed: ${await chunkRes.text()}`);
    }

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      const data = await chunkRes.json();
      return { webUrl: data.webUrl, name: data.name, id: data.id };
    }

    offset = end;
  }

  throw new Error('Upload session completed without final response');
}

export async function deleteFromOneDrive(fileUrl: string): Promise<void> {
  // Extract item ID from the URL or use the URL as a driveItem path
  const token = await getAccessToken();

  // Try to get item by URL — we'll use the sharing API
  const encodedUrl = Buffer.from(fileUrl).toString('base64url');
  const shareId = `u!${encodedUrl}`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    console.error('Could not resolve OneDrive item for deletion');
    return;
  }

  const item = await res.json();
  const deleteRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${ONEDRIVE_OWNER}/drive/items/${item.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!deleteRes.ok && deleteRes.status !== 204) {
    console.error('Failed to delete OneDrive item:', await deleteRes.text());
  }
}

export async function getDownloadUrl(fileUrl: string): Promise<string> {
  const token = await getAccessToken();
  const encodedUrl = Buffer.from(fileUrl).toString('base64url');
  const shareId = `u!${encodedUrl}`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    }
  );

  // Graph returns a 302 redirect to the actual download URL
  return res.headers.get('Location') || fileUrl;
}
