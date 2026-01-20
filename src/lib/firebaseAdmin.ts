// src/lib/firebaseAdmin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (getApps().length) return;

  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    throw new Error('FIREBASE_ADMIN_KEY not set');
  }

  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    }),
  });

  // IMPORTANT
  getFirestore().settings({
    ignoreUndefinedProperties: true,
  });
}

export const adminDb = () => {
  initFirebaseAdmin(); // 🔥 THIS WAS MISSING
  return getFirestore();
};
