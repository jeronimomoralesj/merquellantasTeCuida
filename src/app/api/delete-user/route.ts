import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const key = process.env.FIREBASE_ADMIN_KEY;
  if (!key) {
    throw new Error('FIREBASE_ADMIN_KEY is missing');
  }

  const serviceAccount = JSON.parse(key);

  serviceAccount.private_key =
    serviceAccount.private_key.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID required' }, { status: 400 });
    }

    await admin.auth().deleteUser(uid);
    await admin.firestore().collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE USER ERROR:', error);
    return NextResponse.json(
      { error: error.message ?? 'Internal error' },
      { status: 500 }
    );
  }
}
